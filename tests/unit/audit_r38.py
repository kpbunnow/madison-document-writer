"R38: restore the working lookup query and report SQL error 207 as a query mismatch, not a connection failure."

import json
import subprocess
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

import case_lookup as lookup


class R38(unittest.TestCase):
    def test_query_does_not_name_the_unverified_column(self):
        import re

        sql = (lookup.HERE / "case_lookup.sql").read_text()
        self.assertIsNone(re.search(r"\bRECORD_CATEGORY\b", sql))  # R37's unverified name; R39 uses the live report's RECORD_TYPE_CATEGORY

    def test_error_207_is_reported_as_a_query_mismatch(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            fake_os = SimpleNamespace(name="nt", environ={"SystemRoot": str(root)})
            exe = root / "System32/WindowsPowerShell/v1.0/powershell.exe"
            exe.parent.mkdir(parents=True)
            exe.touch()
            answer = {
                "ok": False,
                "category": "sql",
                "number": 207,
                "state": 1,
                "exceptionType": "SqlException",
                "hresult": -2146232060,
                "operation": "execute_read_only_query",
            }
            with (
                patch.object(lookup, "os", fake_os),
                patch.object(subprocess, "CREATE_NO_WINDOW", 0, create=True),
                patch.object(subprocess, "run") as run,
            ):
                run.return_value = SimpleNamespace(returncode=1, stdout=json.dumps(answer))
                with self.assertRaises(lookup.CaseLookupError) as err:
                    lookup.run_query(lookup.DEFAULTS, "CB2026-005-00048")
            message = str(err.exception)
            self.assertIn("SQL_QUERY_207", message)
            self.assertIn("not a connection problem", message)
            self.assertNotIn("SQL connection failed", message)
            self.assertIn("Excel import remains available", message)


if __name__ == "__main__":
    unittest.main()
