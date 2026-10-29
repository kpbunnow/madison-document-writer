"""Draft backup writes against the retained function: request validation order, the written snapshot, retention of
daily, weekly and replacement snapshots, unreadable and undeletable files, and the audit records, on real folders."""

import copy
from datetime import datetime, timedelta
import json
from pathlib import Path
import random
import tempfile
import unittest
from unittest.mock import patch

import server

ROOT = Path(__file__).resolve().parents[2]
NAMESPACE = server.__dict__.copy()
exec(compile((ROOT / "tests/fixtures/backup_write_reference.txt").read_text(encoding="utf-8"), "backup_write_reference", "exec"), NAMESPACE)
LEGACY = NAMESPACE["backup_write"]
WORKSPACE, CASE = "a" * 32, "b" * 32


class Clock(datetime):
    base = datetime(2026, 10, 27, 12, 0, 0)

    @classmethod
    def now(cls, tz=None):
        return cls.base.replace(tzinfo=tz)


def request(rng):
    payload = {"format": "madison-draft-recovery", "version": 1, "workspace": WORKSPACE, "case": CASE, "drafts": [{"id": "d"}]}
    data = {"workspace": WORKSPACE, "case": CASE, "backup": payload}
    kind = rng.choice(("ok", "ok", "ok", "ok", "extra", "missing", "format", "version", "identity", "badworkspace", "deposit", "big", "notdict"))
    if kind == "extra":
        data["extra"] = 1
    elif kind == "missing":
        del data["case"]
    elif kind == "format":
        payload["format"] = "other"
    elif kind == "version":
        payload["version"] = 2
    elif kind == "identity":
        payload["case"] = "c" * 32
    elif kind == "badworkspace":
        data["workspace"] = payload["workspace"] = "short"
    elif kind == "deposit":
        payload["cits"] = {"x": {"amount": rng.choice(("0", "", "bad", "-5"))}}
    elif kind == "big":
        payload["blob"] = "x" * 3000
    elif kind == "notdict":
        data["backup"] = ["not", "a", "dict"]
    return kind, data


def seed_folder(folder, rng):
    folder.mkdir(parents=True, exist_ok=True)
    names = []
    day = datetime(2026, 10, 27)
    for n in range(rng.choice((0, 3, 10, 30, 60, 90))):
        stamp = (day - timedelta(days=rng.randrange(0, 500), hours=n)).strftime("%Y%m%dT%H%M%S%fZ")
        name = stamp + "-" + format(n, "012x") + ".json"
        names.append(name)
        body = rng.choice(
            ['{"a": 1}'] * 8
            + ['{"preReplacement": true}'] * 3
            + ['{"preReplacement": false}'] * 4
            + ["not json"]
            + (["[]"] if rng.random() < 0.02 else [])
        )
        (folder / name).write_text(body, encoding="utf-8")
    if rng.random() < 0.05:
        (folder / "zz-badname.json").write_text("{}", encoding="utf-8")
    return names


def run(function, root, data, seeded_names, undeletable, records):
    folder = root / WORKSPACE / CASE
    with patch.object(Path, "unlink", autospec=True) as unlink:
        original = Path.unlink.__wrapped__ if hasattr(Path.unlink, "__wrapped__") else None
        del original

        def fake(path, *args, **kwargs):
            if path.name in undeletable:
                raise PermissionError("locked " + path.name)
            return real_unlink(path, *args, **kwargs)

        unlink.side_effect = fake
        try:
            result = ("result", function(copy.deepcopy(data)))
        except Exception as error:
            result = ("error", type(error).__name__, str(error).replace(str(root), "ROOT"))
    files = {p.name: p.read_bytes() for p in sorted(folder.glob("*.json"))} if folder.is_dir() else None
    return result, files


real_unlink = Path.unlink


class BackupWriteRules(unittest.TestCase):
    def test_writes_and_retention_match_the_retained_function(self):
        rng = random.Random(20261209)
        kinds = set()
        stats = {"written": 0, "refused": 0, "records": 0, "trimmed": 0}
        for index in range(500):
            kind, data = request(rng)
            kinds.add(kind)
            with tempfile.TemporaryDirectory() as temporary:
                roots = [Path(temporary) / "old", Path(temporary) / "new"]
                outcomes, recorded = [], []
                rng_state = rng.getstate()
                undeletable = set()
                tick = rng.choice((0, 1, 2))
                for root, function, module_target in zip(roots, (LEGACY, server.backup_write), (NAMESPACE, server.__dict__)):
                    rng.setstate(rng_state)
                    names = seed_folder(root / WORKSPACE / CASE, rng) if rng.random() < 0.85 else []
                    undeletable = {n for n in names if n.endswith(("1.json", "5.json")) and tick == 1}
                    Clock.base = datetime(2026, 10, 27, 12, 0, 0) + timedelta(seconds=tick)
                    log = []
                    with (
                        patch.object(server, "BACKUP_ROOT", root),
                        patch.dict(module_target, {"datetime": Clock, "MAX_BODY": 2000 if kind == "big" else server.MAX_BODY}),
                        patch.dict(
                            module_target,
                            {"record": lambda *a, **k: log.append((a, {key: str(v).replace(str(root), "ROOT") for key, v in k.items()}))},
                        ),
                    ):
                        outcomes.append(run(function, root, data, names, undeletable, log))
                    recorded.append(log)
                self.assertEqual(outcomes[1], outcomes[0], (index, kind, data))
                (result, files) = outcomes[0]
                stats["written" if result[0] == "result" else "refused"] += 1
                stats["records"] += len(recorded[0])
                if files is not None and result[0] == "result" and len(files) < 3 + 24:
                    stats["trimmed"] += 1 if any(not n.startswith("2026") for n in files) is False else 0
                self.assertEqual(recorded[1], recorded[0], (index, kind))
        self.assertGreaterEqual(len(kinds), 10)
        self.assertGreater(stats["written"], 100)
        self.assertGreater(stats["refused"], 60)
        self.assertGreater(stats["records"], 20)


if __name__ == "__main__":
    unittest.main()
