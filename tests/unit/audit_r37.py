"R37/R38: when a lookup row carries Record Category, the helper passes it through (the R38 query does not select it yet)."

import tempfile
import unittest
import xml.etree.ElementTree as ET
from pathlib import Path
from unittest.mock import patch

import case_lookup as lookup


class RecordCategory(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        self.row = dict.fromkeys(lookup.FIELDS, "")
        self.row.update(CaseNumber="CB2026-005-00048", SiteAddress="2714 WILLARD AVE", OwnerName="TEST OWNER")

    def tearDown(self):
        self.temp.cleanup()

    def answer(self, row):
        with patch.object(lookup, "run_query", return_value={"ok": True, "rows": [row], "database": "CityData"}):
            return lookup.lookup(self.root, "CB2026-005-00048")

    def test_snow_removal_category_passes_through(self):
        self.assertEqual(self.answer(dict(self.row, RecordCategory="Snow Removal"))["rows"][0]["RecordCategory"], "Snow Removal")

    def test_missing_or_blank_category_is_tolerated(self):
        for row in (dict(self.row), dict(self.row, RecordCategory=None), dict(self.row, RecordCategory="")):
            self.assertNotIn("RecordCategory", self.answer(row)["rows"][0])

    def test_non_text_category_is_rejected(self):
        with self.assertRaisesRegex(lookup.CaseLookupError, "invalid field value"):
            self.answer(dict(self.row, RecordCategory=7))


if __name__ == "__main__":
    unittest.main()
