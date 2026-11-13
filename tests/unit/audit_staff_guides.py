"""Guide generation preserves selected/manual-only material and fails closed on drift or invalid inputs."""

import json
import tempfile
import unittest
from pathlib import Path

import staff_guides


class StaffGuides(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.staff = Path(self.tmp.name)
        self.manual = "<!-- guide:procedure:start -->\n## Procedure\n\nUnique procedure text.\n<!-- guide:procedure:end -->\n"
        self.manifest = {
            "format": "document-writer-staff-guides",
            "version": 1,
            "guides": [
                {"file": "TEST-GUIDE.md", "intro": "# Test", "sections": ["procedure"]},
                {"file": "OTHER-GUIDE.md", "intro": "# Other", "sections": ["procedure"]},
            ],
        }
        self.save()

    def save(self):
        (self.staff / "PROGRAM-MANUAL.md").write_text(self.manual, encoding="utf-8")
        (self.staff / "guide-sections.json").write_text(json.dumps(self.manifest), encoding="utf-8")

    def test_current_guide_set_and_unique_support_material(self):
        self.assertEqual(staff_guides.check(), 9)
        outputs = staff_guides.generate()
        lookup = outputs["CASE-LOOKUP-GUIDE.md"]
        for phrase in [
            "Workspace includes the Open cases by inspector",
            "SSRS_TLS",
            "SSRS_DTD",
            "CaseNumber",
            "Inspection identity",
            "four fixed staff exclusions",
            "ssrsHosts",
        ]:
            self.assertIn(phrase, lookup)
        self.assertNotIn("Document Writer opens on Import inspection", lookup)
        self.assertIn("Fix next issue", outputs["NOTICE-AND-CITATION-GUIDE.md"])
        self.assertIn("Group due dates on reinspection", outputs["REINSPECTION-GUIDE.md"])

    def test_write_is_deterministic_check_is_read_only(self):
        with self.assertRaisesRegex(ValueError, "drift"):
            staff_guides.check(self.staff)
        staff_guides.write(self.staff)
        before = {p.name: p.read_bytes() for p in self.staff.iterdir()}
        self.assertEqual(staff_guides.check(self.staff), 2)
        self.assertEqual(before, {p.name: p.read_bytes() for p in self.staff.iterdir()})
        staff_guides.write(self.staff)
        self.assertEqual(before, {p.name: p.read_bytes() for p in self.staff.iterdir()})

    def test_manual_and_output_drift_fail_without_repair(self):
        staff_guides.write(self.staff)
        self.manual = self.manual.replace("Unique", "Updated unique")
        self.save()
        with self.assertRaisesRegex(ValueError, "drift"):
            staff_guides.check(self.staff)
        self.assertNotIn("Updated", (self.staff / "TEST-GUIDE.md").read_text())
        staff_guides.write(self.staff)
        (self.staff / "TEST-GUIDE.md").write_text("edited output")
        with self.assertRaisesRegex(ValueError, "drift"):
            staff_guides.check(self.staff)

    def test_malformed_duplicate_unclosed_nested_empty_markers(self):
        for text in [
            self.manual + self.manual,
            self.manual.replace(":end", ":start"),
            self.manual.replace("procedure:end", "other:end"),
            self.manual.replace("guide:procedure:start", "guide:../bad:start"),
            "<!-- guide:empty:start --><!-- guide:empty:end -->",
        ]:
            with self.subTest(text=text), self.assertRaises(ValueError):
                staff_guides.sections(text)

    def test_missing_reference_and_duplicate_outputs_fail_before_writes(self):
        for change in ["missing", "duplicate"]:
            with self.subTest(change=change):
                manifest = json.loads(json.dumps(self.manifest))
                if change == "missing":
                    manifest["guides"][1]["sections"] = ["missing"]
                else:
                    manifest["guides"][1]["file"] = "TEST-GUIDE.md"
                (self.staff / "guide-sections.json").write_text(json.dumps(manifest))
                with self.assertRaises((KeyError, ValueError)):
                    staff_guides.write(self.staff)
                self.assertFalse((self.staff / "TEST-GUIDE.md").exists())

    def test_paths_and_symlinks_are_refused(self):
        for name in ["../OUTSIDE-GUIDE.md", "/tmp/OUTSIDE-GUIDE.md", "PROGRAM-MANUAL.md", "SUB/TEST-GUIDE.md"]:
            with self.subTest(name=name):
                self.manifest["guides"][0]["file"] = name
                self.save()
                with self.assertRaises(ValueError):
                    staff_guides.write(self.staff)
        self.manifest["guides"][0]["file"] = "TEST-GUIDE.md"
        self.save()
        (self.staff / "TEST-GUIDE.md").symlink_to(self.staff / "PROGRAM-MANUAL.md")
        with self.assertRaises(ValueError):
            staff_guides.write(self.staff)

    def test_caught_publication_failure_restores_previous_set(self):
        import os

        staff_guides.write(self.staff)
        before = {p.name: p.read_bytes() for p in self.staff.iterdir()}
        self.manual = self.manual.replace("Unique", "Changed")
        self.save()
        count = 0

        def fail_second(source, destination):
            nonlocal count
            count += 1
            if count == 2:
                raise OSError("injected replacement failure")
            os.replace(source, destination)

        with self.assertRaisesRegex(OSError, "injected"):
            staff_guides.write(self.staff, replace=fail_second)
        for name in ["TEST-GUIDE.md", "OTHER-GUIDE.md"]:
            self.assertEqual((self.staff / name).read_bytes(), before[name])
        self.assertFalse(list(self.staff.glob(".guide-staging-*")))


if __name__ == "__main__":
    unittest.main()
