"""Release metadata must be valid before build/sync, and a published identity cannot describe new content."""

import copy
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

from version_schema import validate_identity
from release_publication import check_publication

ROOT = Path(__file__).resolve().parents[2]
VALID = dict(
    release="2026-10-23 R62", helperVersion="2026.10.23.63", helperBuild=63, authoringVersion=16, caseSchema=5, summaryVersion=6, backupVersion=2
)


class ReleaseIdentity(unittest.TestCase):
    def test_current_and_invalid_metadata(self):
        self.assertEqual(validate_identity(dict(VALID)), VALID)
        changes = [
            dict(release="not-a-release"),
            dict(release="2026-02-30 R62"),
            dict(release="2026-10-23 R0"),
            dict(release="2026-10-24 R62"),
            dict(helperVersion="2026.99.99.63"),
            dict(helperVersion="2026.10.23.0", helperBuild=0),
            dict(helperVersion="2026.10.23.64"),
            dict(helperVersion="2026.10.23.063"),
            dict(helperBuild=True),
            dict(helperBuild=-1),
            *[{key: bad} for key in ("authoringVersion", "caseSchema", "summaryVersion", "backupVersion") for bad in (True, 0, -1, "5")],
        ]
        for change in changes:
            with self.subTest(change=change), self.assertRaises(ValueError):
                validate_identity({**VALID, **change})

    def test_sync_refuses_bad_identity_before_writing_consumers(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            for name in ("sync_version.py", "version_schema.py"):
                (root / name).write_bytes((ROOT / "tools" / name).read_bytes())
            # sync_version resolves its root one level above its tools folder.
            (root / "tools").mkdir()
            for name in ("sync_version.py", "version_schema.py"):
                (root / name).replace(root / "tools" / name)
            (root / "version.json").write_text(json.dumps({**VALID, "helperVersion": "2026.99.99.63"}), encoding="utf-8")
            for name in ("package.json", "package-lock.json"):
                (root / name).write_text("ORIGINAL CONSUMER", encoding="utf-8")
            run = subprocess.run([sys.executable, str(root / "tools/sync_version.py")], capture_output=True, encoding="utf-8")
            self.assertNotEqual(run.returncode, 0)
            for name in ("package.json", "package-lock.json"):
                self.assertEqual((root / name).read_text(encoding="utf-8"), "ORIGINAL CONSUMER")

    def manifest(self):
        return {**VALID, "files": {"program.py": {"size": 1, "sha256": "a" * 64}}}

    def test_exact_reinstall_and_explicit_first_publication(self):
        value = self.manifest()
        check_publication(copy.deepcopy(value), value)
        check_publication(value, None)

    def test_changed_content_and_protocol_metadata_cannot_reuse_identity(self):
        original = self.manifest()
        for change in ("file", "protocol"):
            candidate = copy.deepcopy(original)
            if change == "file":
                candidate["files"]["program.py"]["sha256"] = "b" * 64
            else:
                candidate["caseSchema"] += 1
            with self.subTest(change=change), self.assertRaisesRegex(ValueError, "immutable"):
                check_publication(candidate, original)

    def test_new_release_and_build_advance_independently_without_rollback(self):
        original = self.manifest()
        next_release = {**original, "release": "2026-10-24 R63", "helperVersion": "2026.10.24.64", "helperBuild": 64}
        check_publication(next_release, original)
        changes = [
            dict(release="2026-10-24 R62"),
            dict(helperVersion="2026.10.24.63", helperBuild=63),
            dict(release="2026-10-22 R63", helperVersion="2026.10.22.64"),
        ]
        for change in changes:
            with self.subTest(change=change), self.assertRaises(ValueError):
                check_publication({**next_release, **change}, original)

    def test_legacy_baseline_can_derive_counter_and_keep_its_original_dates(self):
        previous = {**self.manifest(), "release": "2026-10-22 R61", "helperVersion": "2026.10.23.62"}
        del previous["helperBuild"]
        candidate = {**self.manifest(), "release": "2026-10-24 R63", "helperVersion": "2026.10.24.64", "helperBuild": 64}
        check_publication(candidate, previous)
        with self.assertRaisesRegex(ValueError, "calendar dates"):
            check_publication({**candidate, "release": "2026-10-25 R63"}, previous)

    def test_missing_or_invalid_baseline_is_not_an_inferred_first_publication(self):
        for baseline in ({}, {**self.manifest(), "files": {}}, {**self.manifest(), "files": {"x": {"size": True, "sha256": "a" * 64}}}):
            with self.subTest(baseline=baseline), self.assertRaises(ValueError):
                check_publication(self.manifest(), baseline)
        run = subprocess.run([sys.executable, str(ROOT / "tools/package_release.py"), "--output", "unused"], capture_output=True, encoding="utf-8")
        self.assertEqual(run.returncode, 2)
        self.assertIn("--published-manifest", run.stderr)


if __name__ == "__main__":
    unittest.main()
