"""Check structured logs exclude case data and rotate without blocking saves."""

import json
import logging
from logging.handlers import RotatingFileHandler
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
import helper_logging as helper


class LoggingTests(unittest.TestCase):
    def test_safe_fields_and_rotation(self):
        with tempfile.TemporaryDirectory() as directory:
            logger = logging.getLogger("qa-helper")
            logger.setLevel(logging.INFO)
            logger.propagate = False
            handler = RotatingFileHandler(Path(directory) / "helper.jsonl", maxBytes=300, backupCount=3)
            logger.addHandler(handler)
            with patch.object(helper, "_LOGGER", logger):
                for _ in range(20):
                    helper.record("case-save", "failed", 12, ValueError("PRIVATE OWNER ADDRESS CASE-123"))
                helper.record("PRIVATE CASE", "ok")
            handler.close()
            logger.removeHandler(handler)
            paths = list(Path(directory).glob("helper.jsonl*"))
            self.assertGreater(len(paths), 1)
            self.assertLessEqual(len(paths), 4)
            for path in paths:
                raw = path.read_text()
                self.assertNotIn("PRIVATE", raw)
                for line in raw.splitlines():
                    self.assertLessEqual(set(json.loads(line)), {"at", "operation", "status", "durationMs", "errorClass"})

    def test_logging_failure_does_not_block(self):
        class Broken:
            def info(self, event):
                raise OSError("unwritable")

        with patch.object(helper, "_LOGGER", Broken()):

            @helper.logged("case-save")
            def save():
                return {"ok": True}

            self.assertEqual(save(), {"ok": True})

    def test_a_case_save_and_its_failure_are_logged_as_case_save(self):
        """The case-save record belongs to save_case itself, so a refused save is logged as a failed case-save."""
        import case_store

        events = []
        with patch.object(helper, "record", lambda operation, status, *rest, **kw: events.append((operation, status))):
            with tempfile.TemporaryDirectory() as directory, self.assertRaises(ValueError):
                case_store.save_case(directory, "bad name.txt", {})
            case_store._has_priced_citation({"events": []})
        self.assertEqual(events, [("case-save", "start"), ("case-save", "failed")])


if __name__ == "__main__":
    unittest.main()
