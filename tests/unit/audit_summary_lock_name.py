"""A summary write takes the same case lock as the case save and the administrator lock tools (2026-11-27 review cleanup,
synthetic). The summary used casefold() on the already-lowercased case number key; that only differs for letters such as
ß, but for such a legacy case number the summary and the save locked different files and did not exclude each other."""

import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import case_store
import operations_helper


class Stop(Exception):
    pass


class SummaryLockName(unittest.TestCase):
    def test_summary_and_case_save_share_one_lock(self):
        for number in ("CB2026-241-00001", "Legacy Straße 7"):
            with self.subTest(number=number), tempfile.TemporaryDirectory() as folder:
                keys = []

                def record(_folder, key, wait=5, keys=keys):
                    keys.append(key)
                    raise Stop

                summary = {"format": "madison-case-summary", "case": {"number": number}}
                with patch.object(case_store, "file_lock", record), self.assertRaises(Stop):
                    case_store.save_summary(folder, "x - " + number + ".json", "r", summary)
                expected = "case:" + case_store.case_number_key(number)
                self.assertEqual(keys, [expected])
                self.assertEqual(operations_helper.lock_path(Path(folder), number).name, operations_helper.lock_path(Path(folder), "", expected).name)


if __name__ == "__main__":
    unittest.main()
