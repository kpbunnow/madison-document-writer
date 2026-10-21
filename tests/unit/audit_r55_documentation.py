"""Current staff editions agree on identity and material inspection eligibility."""

from html import unescape
from html.parser import HTMLParser
from pathlib import Path
import json
import re
import shutil
import subprocess
import unittest
import xml.etree.ElementTree as ET
from zipfile import ZipFile

ROOT = Path(__file__).resolve().parents[2]
STAFF = ROOT / "docs/staff"
WARNING = "Completed, Scheduled, Pending, Assist and unlisted results cannot be imported."


class VisibleText(HTMLParser):
    def __init__(self, text):
        super().__init__()
        self.parts = []
        self.feed(text)

    def handle_data(self, data):
        self.parts.append(data)


def normalized(text):
    return re.sub(r"\s+", " ", unescape(text)).strip()


class Documentation(unittest.TestCase):
    def test_identity_and_eligibility_agree_across_current_editions(self):
        version = json.loads((ROOT / "version.json").read_text())
        editions = {
            "Markdown": (STAFF / "PROGRAM-MANUAL.md").read_text(),
            "HTML": " ".join(VisibleText((STAFF / "PROGRAM-MANUAL.html").read_text()).parts),
        }
        with ZipFile(STAFF / "Program_Instruction_Manual.docx") as archive:
            doc = ET.fromstring(archive.read("word/document.xml"))
            ns = {"w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main"}
            editions["Word"] = " ".join("".join(p.itertext()) for p in doc.findall(".//w:p", ns))
        if shutil.which("pdftotext"):
            editions["PDF"] = subprocess.check_output(["pdftotext", "-layout", str(STAFF / "Program_Instruction_Manual.pdf"), "-"], text=True)
        for name, text in editions.items():
            with self.subTest(edition=name):
                text = normalized(text)
                self.assertIn("Release " + version["release"], text)
                self.assertIn("Helper " + version["helperVersion"], text)
                self.assertIn(WARNING, text)
                self.assertNotIn("Completed, Official Notice, Citation and Compliance are eligible", text)
                for phrase in [
                    "Initial Inspection",
                    "CA Reinspection",
                    "Abatement Summary",
                    "Abatement Non-Summary",
                    "Extension Processing",
                    "Non Compliance",
                ]:
                    self.assertIn(phrase, text)
        lookup = (STAFF / "CASE-LOOKUP-GUIDE.md").read_text()
        self.assertIn(WARNING, lookup)
        self.assertIn("Completed and all unlisted results are refused.", (ROOT / "docs/developer/03-DOMAIN-RULES.md").read_text())

    def test_manual_keeps_anchors_and_current_security_explanations(self):
        html = (STAFF / "PROGRAM-MANUAL.html").read_text()
        for n in range(1, 23):
            self.assertEqual(html.count('id="chapter-' + str(n) + '"'), 1)
        self.assertNotIn("installed key", (ROOT / "docs/developer/01-ARCHITECTURE.md").read_text())
        self.assertNotIn("signed release", (ROOT / "helper/trusted_connections.py").read_text())
        acceptance = (ROOT / "docs/developer/ACCEPTANCE-RECORD.md").read_text()
        self.assertNotIn("Both R50 versions match", acceptance)
        for identity in ["L1", "L2", "L3", "L4", "L5", "P7", "S53"]:
            self.assertIn("| " + identity + " |", acceptance)


if __name__ == "__main__":
    unittest.main()
