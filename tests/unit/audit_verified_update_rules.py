"""Verified update staging against the retained module on real folders: manifest reading and size limit, version and
build pins, downgrade refusal, path rules, symlink and stray-file detection, size and checksum recheck, the staged
files and pin, and the diagnostic each failure leaves."""

import hashlib
import json
import os
from pathlib import Path
import random
import shutil
import tempfile
import unittest

import verified_update as current

ROOT = Path(__file__).resolve().parents[2]
REFERENCE = {"__name__": "verified_update_reference"}
exec(compile((ROOT / "tests/fixtures/verified_update_reference.txt").read_text(encoding="utf-8"), "verified_update_reference", "exec"), REFERENCE)


def wipe(root):
    for child in list(root.iterdir()):
        if child.is_dir() and not child.is_symlink():
            shutil.rmtree(child)
        else:
            child.unlink()


def tree(root):
    out = {}
    for p in sorted(root.rglob("*")):
        if p.is_symlink():
            out[str(p.relative_to(root))] = ("link", os.readlink(p))
        elif p.is_file():
            out[str(p.relative_to(root))] = p.read_bytes()
    return out


def build(root, rng):
    """One shared folder, a local folder and a staging folder in a randomly damaged state."""
    share, local, staging = root / "share", root / "local", root / "staging"
    for folder in (share, local, staging):
        folder.mkdir()
    names = ["Document Writer.py", "app/main.js", "app/lib/util.js", "helper/server.py", "vendor/python/readme.txt"]
    names = names[: rng.choice((2, 3, 5))]
    contents = {n: ("content of " + n + "\n").encode() * rng.choice((1, 3, 50)) for n in names}
    files = {n: {"size": len(c), "sha256": hashlib.sha256(c).hexdigest()} for n, c in contents.items()}
    version = rng.choice(("2026.10.27.64", "2026.10.20.60", "2026.11.01.65", "2026.10.20.80", "2026.12.05.90", "1.2.3", "a.b.c.d"))
    manifest = {"helperVersion": version, "release": "R63", "files": files}
    if rng.random() < 0.7:
        manifest["helperBuild"] = (
            rng.choice((64, 64, 63, -1, "x", True)) if rng.random() < 0.4 else int(version.split(".")[-1]) if version[-1].isdigit() else 0
        )
    damage = rng.choice(
        ("none",) * 6
        + (
            "size",
            "checksum",
            "missing",
            "extra",
            "stale-name",
            "link",
            "bad-path",
            "self",
            "empty",
            "toobig",
            "notdict",
            "nomanifest",
            "badjson",
            "pin",
            "pin-legacy",
            "datadir",
            "datafile",
            "dirlink",
            "badsize",
            "keyerror",
        )
    )
    if damage == "size":
        files[names[0]]["size"] += 1
    elif damage == "badsize":
        files[names[0]]["size"] = rng.choice(("12", -1, 200 * 1024 * 1024, True))
    elif damage == "checksum":
        files[names[0]]["sha256"] = "0" * 64
    elif damage == "missing":
        files["app/gone.js"] = {"size": 1, "sha256": "0" * 64}
    elif damage == "bad-path":
        files[rng.choice(("../x", "a\\b", "c:x", "/abs", "a//b", "dot.", "sp "))] = {"size": 1, "sha256": "0" * 64}
    elif damage == "self":
        files["runtime-manifest.json"] = {"size": 1, "sha256": "0" * 64}
    elif damage == "empty":
        manifest["files"] = {}
    elif damage == "notdict":
        manifest["files"] = ["a"]
    elif damage == "keyerror":
        del manifest["release"]
    for name, data in contents.items():
        path = share / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data)
    raw = json.dumps(manifest).encode()
    if damage == "toobig":
        raw += b" " * (2 * 1024 * 1024 + 1)
    elif damage == "badjson":
        raw = b"{not json"
    if damage != "nomanifest":
        (share / "runtime-manifest.json").write_bytes(raw)
    if damage == "extra":
        (share / "stray.txt").write_text("x")
    elif damage == "stale-name":
        (share / rng.choice(("runtime-manifest.sig", "release_trust.py"))).write_text("x")
    elif damage == "link":
        os.symlink(share / names[0], share / "alias.py")
    elif damage == "dirlink":
        os.symlink(share / "app", share / "app-link") if (share / "app").exists() else None
    elif damage == "datadir":
        (share / "Case JSON Files").mkdir()
        (share / "Case JSON Files" / "case.json").write_text("{}")
    elif damage == "datafile":
        (share / "integrity-settings.json").write_text("{}")
    if damage in ("pin", "pin-legacy") or rng.random() < 0.25:
        old = rng.choice(("2026.10.27.64", "2026.10.28.70", "2026.10.01.10", "2026.12.01.10", "bad"))
        pin = {"helperVersion": old, "release": "R62"}
        if damage != "pin-legacy" and old[-1:].isdigit():
            pin["helperBuild"] = int(old.split(".")[-1])
        (local / "verified-install.json").write_text(json.dumps(pin))
    if rng.random() < 0.05:
        (local / "verified-install.json").write_text("{broken")
    return share, local, staging, damage


class VerifiedUpdateRules(unittest.TestCase):
    def test_staging_matches_the_retained_module(self):
        families = set()
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            for index in range(1500):
                outcomes = []
                for module in (REFERENCE, vars(current)):
                    wipe(root)
                    rng = random.Random(index)
                    share, local, staging, damage = build(root, rng)
                    try:
                        result = ("result", module["stage_update"](share, staging, local))
                    except Exception as error:
                        result = ("error", type(error).__name__, str(error).replace(temporary, "ROOT"))
                    text = json.dumps(result, default=str, sort_keys=True).replace(temporary, "ROOT")
                    trees = {k: tree(root / k) for k in ("staging", "local")}
                    trees = json.loads(
                        json.dumps(trees, default=lambda v: v.decode("latin-1") if isinstance(v, bytes) else str(v)).replace(temporary, "ROOT")
                    )
                    outcomes.append((text, trees))
                self.assertEqual(outcomes[1], outcomes[0], (index, damage))
                parsed = json.loads(outcomes[0][0])
                families.add(parsed[0] if parsed[0] == "result" else damage + ":" + parsed[2][100:140])
        self.assertIn("result", families)
        damages = {f.split(":")[0] for f in families}
        for damage in (
            "size",
            "checksum",
            "missing",
            "extra",
            "stale-name",
            "link",
            "bad-path",
            "self",
            "empty",
            "toobig",
            "pin",
            "pin-legacy",
            "datadir",
            "nomanifest",
        ):
            self.assertIn(damage, damages)

    def test_network_share_diagnostic_matches(self):
        outcomes = []
        for module in (REFERENCE, vars(current)):
            with tempfile.TemporaryDirectory() as temporary:
                root = Path(temporary)
                for share in ("//no-such-server/share", "\\\\no-such-server\\share", str(root / "missing")):
                    try:
                        module["stage_update"](share, root / "staging", root / "local")
                    except Exception as error:
                        outcomes.append((type(error).__name__, str(error).replace(temporary, "ROOT")))
                    (root / "local").mkdir(exist_ok=True)
                    outcomes.append(
                        (root / "local" / "update-diagnostic.txt").exists()
                        and (root / "local" / "update-diagnostic.txt").read_text().replace(temporary, "ROOT")
                    )
        half = len(outcomes) // 2
        self.assertEqual(outcomes[half:], outcomes[:half])
        self.assertTrue(any("UNC" in str(item) for item in outcomes[:half]))


if __name__ == "__main__":
    unittest.main()
