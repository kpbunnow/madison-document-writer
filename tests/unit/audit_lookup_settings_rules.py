"""Case-lookup settings against the retained function on real folders: the shared folder and file, allowed keys and
value rules, the approved-server check, the per-user certificate setting and the disabled switch, with the exact
configuration or refusal each produces."""

import json
import os
from pathlib import Path
import random
import shutil
import tempfile
import unittest
from unittest.mock import patch

import case_lookup as current

ROOT = Path(__file__).resolve().parents[2]
NAMESPACE = current.__dict__.copy()
exec(compile((ROOT / "tests/fixtures/lookup_settings_reference.txt").read_text(encoding="utf-8"), "lookup_settings_reference", "exec"), NAMESPACE)
LEGACY = NAMESPACE["settings"]

SHARED = [
    None,
    "{}",
    "﻿{}",
    '{"server": "sqlelam"}',
    '{"server": "sqlelam", "database": "BI", "enabled": true}',
    '{"server": "other.example.test"}',
    '{"server": "bad server!"}',
    '{"server": 5}',
    '{"server": ""}',
    '{"database": 7}',
    '{"database": "x\\u0001y"}',
    '{"database": "x\\u001fy"}',
    '{"database": "x y"}',
    '{"enabled": "yes"}',
    '{"enabled": false}',
    '{"extra": 1}',
    '{"database": "' + "d" * 129 + '"}',
    "[]",
    "not json",
    "{",
    "DIRECTORY",
    "NULLBYTES",
]
LOCAL = [
    None,
    "{}",
    '{"trustServerCertificate": true}',
    '{"trustServerCertificate": false}',
    '{"trustServerCertificate": 1}',
    '{"other": true}',
    '{"x": true}',
    "[]",
    "not json",
    "DIRECTORY",
    "BADBYTES",
]


def build(root, rng):
    state = rng.choice(("ok",) * 8 + ("missing-root", "file-root"))
    shared = root / "shared"
    local = root / "appdata"
    if state == "ok":
        shared.mkdir()
    elif state == "file-root":
        shared.write_text("x")
    kind = rng.choice(SHARED)
    if state == "ok" and kind is not None:
        folder = shared / "Case Lookup"
        folder.mkdir()
        target = folder / "settings.json"
        if kind == "DIRECTORY":
            target.mkdir()
        elif kind == "NULLBYTES":
            target.write_bytes(b"\xff\xfe\x00")
        else:
            target.write_text(kind, encoding="utf-8")
    use_env = rng.random() < 0.7
    local_kind = rng.choice(LOCAL)
    if use_env:
        folder = local / "MadisonDocWriter"
        folder.mkdir(parents=True)
        if local_kind is not None:
            target = folder / current.LOCAL_TLS_SETTINGS
            if local_kind == "DIRECTORY":
                target.mkdir()
            elif local_kind == "BADBYTES":
                target.write_bytes(b"\xff\xfe\x00{")
            else:
                target.write_text(local_kind, encoding="utf-8")
    return shared, (str(local) if use_env else None), state


class LookupSettingsRules(unittest.TestCase):
    def test_settings_match_the_retained_function(self):
        families = set()
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            for index in range(1500):
                outcomes = []
                for function in (LEGACY, current.settings):
                    for child in list(root.iterdir()):
                        shutil.rmtree(child) if child.is_dir() else child.unlink()
                    rng = random.Random(index)
                    shared, appdata, state = build(root, rng)
                    environment = {"LOCALAPPDATA": appdata} if appdata else {}
                    with patch.dict(os.environ, environment, clear=False):
                        if not appdata:
                            os.environ.pop("LOCALAPPDATA", None)
                        try:
                            result = ("result", function(shared))
                        except current.CaseLookupError as error:
                            result = ("refused", str(error), error.status)
                        except Exception as error:
                            result = ("raised", type(error).__name__, str(error))
                    outcomes.append(json.loads(json.dumps(result, default=str).replace(temporary, "ROOT")))
                self.assertEqual(outcomes[1], outcomes[0], (index, state))
                families.add(outcomes[0][0] if outcomes[0][0] == "result" else outcomes[0][1][:30])
        self.assertIn("result", families)
        self.assertGreaterEqual(len(families), 8, sorted(families))


if __name__ == "__main__":
    unittest.main()
