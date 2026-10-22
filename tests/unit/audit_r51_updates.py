"""Separate helper build counter and downgrade protection."""

import hashlib
import json
from pathlib import Path
import tempfile
import unittest
import verified_update


class UpdateCounter(unittest.TestCase):
    def test_legacy_pin_and_counter_migrate_without_calendar_downgrade(self):
        for pin in [{"helperVersion": "2026.10.17.51"}, {"helperVersion": "2026.10.18.52", "helperBuild": 52}]:
            for build in [50, 51, 52, 53]:
                with self.subTest(pin=pin, build=build), tempfile.TemporaryDirectory() as folder:
                    root = Path(folder)
                    share, stage, local = [root / name for name in ["share", "stage", "local"]]
                    for p in [share, stage, local]:
                        p.mkdir()
                    (local / "verified-install.json").write_text(json.dumps(pin))
                    data = b"unchanged runtime"
                    (share / "server.py").write_bytes(data)
                    manifest = {
                        "helperVersion": "2099.12.31." + str(build),
                        "helperBuild": build,
                        "release": "2099-12-31 R51",
                        "files": {"server.py": {"size": len(data), "sha256": hashlib.sha256(data).hexdigest()}},
                    }
                    raw = json.dumps(manifest).encode()
                    (share / "runtime-manifest.json").write_bytes(raw)
                    if build < pin.get("helperBuild", 51):
                        with self.assertRaisesRegex(ValueError, "Downgrade"):
                            verified_update.stage_update(share, stage, local)
                    else:
                        verified_update.stage_update(share, stage, local)
                        self.assertEqual(json.loads((stage / "verified-install.json").read_text())["helperBuild"], build)


if __name__ == "__main__":
    unittest.main()
