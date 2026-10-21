"""Manual editions are generated in staging and replaced together, or not at all."""

import json, os, re, shutil, tempfile, unittest, zipfile
from html import escape
from pathlib import Path
from unittest.mock import patch
import build_manual as manual

ROOT = Path(__file__).resolve().parents[2]
IDENTITY = {k: json.loads((ROOT / "version.json").read_bytes())[k] for k in ("release", "helperVersion")}
PDF_HEADER = b"%PDF-1.7\n/StructTreeRoot synthetic tagged print\n"


def pandoc(arguments, source):
    """Synthetic stand-in for pandoc: just enough HTML and Word structure to validate."""
    if "--to=html5" in arguments:
        lines = []
        for line in source.splitlines():
            heading = re.match(r"^## (.+) \{#(chapter-\d+)\}$", line)
            lines.append('<h2 id="' + heading[2] + '">' + escape(heading[1]) + "</h2>" if heading else "<p>" + escape(line) + "</p>")
        return "\n".join(lines).encode("utf-8")
    output = next(a.removeprefix("--output=") for a in arguments if a.startswith("--output="))
    body = "".join("<w:p><w:r><w:t>" + escape(line) + "</w:t></w:r></w:p>" for line in source.splitlines())
    with zipfile.ZipFile(output, "w") as z:
        z.writestr("word/document.xml", '<w:document xmlns:w="' + manual.WORD["w"] + '"><w:body>' + body + "</w:body></w:document>")
    return b""


def printer(html, pdf):
    pdf.write_bytes(PDF_HEADER + " ".join(manual.VisibleText(html.read_text(encoding="utf-8")).parts).encode("utf-8"))


def read_pdf(path):
    return path.read_bytes().removeprefix(PDF_HEADER).decode("utf-8")


class ManualPublication(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.staff = Path(self.temp.name) / "staff"
        self.staff.mkdir()
        for name in ["PROGRAM-MANUAL.md", "manual-style.css", "Program_Instruction_Manual.docx"]:
            shutil.copyfile(ROOT / "docs/staff" / name, self.staff / name)
        self.build()
        self.maintained = self.snapshot()

    def tearDown(self):
        self.temp.cleanup()

    def build(self, **overrides):
        options = {"expected": IDENTITY, "pandoc": pandoc, "printer": printer, "read_pdf": read_pdf, **overrides}
        return manual.build(self.staff, **options)

    def snapshot(self):
        return {name: ((self.staff / name).read_bytes(), (self.staff / name).stat().st_mtime_ns) for name in manual.EDITIONS}

    def edit_source(self):
        path = self.staff / "PROGRAM-MANUAL.md"
        path.write_text(path.read_text(encoding="utf-8").replace("This manual explains", "This revised manual explains", 1), encoding="utf-8")

    def assert_unchanged_and_clean(self):
        self.assertEqual(self.snapshot(), self.maintained)
        self.assertEqual([p.name for p in self.staff.iterdir() if p.name.startswith(".")], [])

    def test_successful_build_produces_matching_editions(self):
        self.edit_source()
        digest = self.build()
        self.assertEqual(digest, manual.source_digest(self.staff))
        manual.check_editions(self.staff, digest, IDENTITY, read_pdf)
        html = (self.staff / "PROGRAM-MANUAL.html").read_text(encoding="utf-8")
        self.assertIn('<html lang="en">', html)
        self.assertEqual([html.count('id="chapter-' + str(n) + '"') for n in range(1, 23)], [1] * 22)
        self.assertEqual([p.name for p in self.staff.iterdir() if p.name.startswith(".")], [])

    def test_pdf_failure_leaves_every_maintained_edition_unchanged(self):
        self.edit_source()

        def fail(html, pdf):
            raise RuntimeError("synthetic PDF generation failure")

        with self.assertRaisesRegex(RuntimeError, "synthetic PDF"):
            self.build(printer=fail)
        self.assert_unchanged_and_clean()

    def test_invalid_output_is_never_published(self):
        self.edit_source()
        cases = {
            "untagged PDF": {"printer": lambda html, pdf: pdf.write_bytes(b"%PDF-1.7 untagged")},
            "wrong identity": {"expected": {**IDENTITY, "helperVersion": "2026.10.21.99"}},
            "Word without digest": {"pandoc": lambda a, s: pandoc(a, s if "--to=html5" in a else s.rsplit("Manual source digest", 1)[0])},
        }
        for label, override in cases.items():
            with self.subTest(case=label), self.assertRaises(ValueError):
                self.build(**override)
            self.assert_unchanged_and_clean()

    def test_failure_while_replacing_restores_the_previous_set(self):
        self.edit_source()
        real, moves = os.replace, []

        def interrupted(source, target):
            if Path(source).parent.name.startswith(".manual-staging-"):
                moves.append(Path(target).name)
                if len(moves) == 2:
                    raise OSError("synthetic interruption while replacing")
            return real(source, target)

        with patch.object(os, "replace", interrupted), self.assertRaisesRegex(OSError, "synthetic"):
            self.build()
        self.assertEqual(moves, list(manual.EDITIONS[:2]))
        self.assertEqual({n: v[0] for n, v in self.snapshot().items()}, {n: v[0] for n, v in self.maintained.items()})
        self.assertEqual([p.name for p in self.staff.iterdir() if p.name.startswith(".")], [])

    def test_crash_recovery_completes_or_rolls_back(self):
        backup = self.staff / manual.BACKUP
        for state in ("replacing", "replaced"):
            with self.subTest(state=state):
                backup.mkdir()
                for name in manual.EDITIONS:
                    shutil.copyfile(self.staff / name, backup / name)
                    (self.staff / name).write_bytes(b"NEW " + name.encode())
                (self.staff / manual.JOURNAL).write_text(json.dumps({"state": state, "previous": list(manual.EDITIONS)}), encoding="utf-8")
                manual.recover(self.staff)
                current = {n: (self.staff / n).read_bytes() for n in manual.EDITIONS}
                if state == "replacing":
                    self.assertEqual(current, {n: v[0] for n, v in self.maintained.items()})
                else:
                    self.assertEqual(current, {n: b"NEW " + n.encode() for n in manual.EDITIONS})
                    for name, (raw, _) in self.maintained.items():
                        (self.staff / name).write_bytes(raw)
                self.assertFalse(backup.exists() or (self.staff / manual.JOURNAL).exists())

    def test_same_release_stale_pdf_is_detected(self):
        self.edit_source()
        digest = manual.source_digest(self.staff)
        staging = Path(self.temp.name) / "partial"
        staging.mkdir()
        manual.render(self.staff, staging, digest, pandoc, printer)
        for name in manual.EDITIONS[:2]:
            shutil.copyfile(staging / name, self.staff / name)
        with self.assertRaisesRegex(ValueError, "PDF edition lacks 'Manual source digest " + digest):
            manual.check_editions(self.staff, digest, IDENTITY, read_pdf)

    def test_pdf_inspection_is_required(self):
        with patch.object(shutil, "which", return_value=None), self.assertRaisesRegex(RuntimeError, "pdftotext"):
            manual.pdf_text(self.staff / "Program_Instruction_Manual.pdf")


if __name__ == "__main__":
    unittest.main()
