"R39: the lookup query is the division's live SSRS report query, which sources Record Category from r.RECORD_TYPE_CATEGORY."

import tempfile
import unittest
import xml.etree.ElementTree as ET
from pathlib import Path
from unittest.mock import patch

import case_lookup as lookup

RDL = lookup.HERE.parent / "tests/fixtures/reference/Document-Generator-Import.rdl"


class R39(unittest.TestCase):
    def report(self):
        return ET.parse(RDL).getroot()

    def test_query_is_the_live_report_query(self):
        sql = next(e.text for e in self.report().iter() if e.tag.endswith("}CommandText"))
        self.assertEqual((lookup.HERE / "case_lookup.sql").read_text().strip(), sql.strip())
        self.assertIn("r.RECORD_TYPE_CATEGORY         AS RecordCategory,", sql)

    def test_report_field_and_last_visible_column(self):
        root = self.report()
        fields = {e.get("Name"): next((x.text for x in e if x.tag.endswith("}DataField")), None) for e in root.iter() if e.tag.endswith("}Field")}
        self.assertEqual(fields.get("RecordCategory"), "RecordCategory")
        values = [e.text for e in root.iter() if e.tag.endswith("}Value") and e.text]
        headers = [v for v in values if not v.startswith("=")]
        self.assertEqual(headers[-1], "Record Category")  # the Excel export's last column, read by the R36 report import
        self.assertEqual([v for v in values if v.startswith("=Fields!")][-1], "=Fields!RecordCategory.Value")

    def test_lookup_returns_record_category(self):
        row = dict.fromkeys(lookup.FIELDS, "")
        row.update(CaseNumber="CB2026-005-00048", SiteAddress="2714 WILLARD AVE", OwnerName="TEST OWNER", RecordCategory="Snow Removal")
        with (
            tempfile.TemporaryDirectory() as folder,
            patch.object(lookup, "run_query", return_value={"ok": True, "rows": [row], "database": "CityData"}),
        ):
            answer = lookup.lookup(Path(folder), "CB2026-005-00048")
        self.assertEqual(answer["rows"][0]["RecordCategory"], "Snow Removal")


if __name__ == "__main__":
    unittest.main()
