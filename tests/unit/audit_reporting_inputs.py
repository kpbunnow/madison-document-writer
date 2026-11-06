"""Operation-local summary reuse preserves parsing, secure reads, fresh proofs and bounded input retention."""

from concurrent.futures import ThreadPoolExecutor
import hashlib
import json
from pathlib import Path
import tempfile
import threading
import time
import unittest
from unittest.mock import Mock, patch
import case_integrity as integrity
import inspector_cases
import reporting_reads
import server
from audit_r49_readiness import fixture
from plain_files import read_plain_bytes


class SummaryInputTests(unittest.TestCase):
    def test_damaged_context_still_distinguishes_orphan_and_never_saved(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            fixture(root, 1)
            (root / "_integrity/migrated.json").write_text("{damaged")
            (root / "Reporting Index/qa-orphan.json").write_text(json.dumps({"case": {"number": "QA-ORPHAN"}}))
            self.assertEqual(
                inspector_cases.due_dates(root, ["QA-0", "QA-ORPHAN", "QA-NEVER"]),
                {"QA-0": ("unknown", ""), "QA-ORPHAN": ("unknown", ""), "QA-NEVER": ("none", "")},
            )

    def test_due_reads_share_the_existing_four_reader_bound(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            fixture(root, 20)
            numbers = ["QA-" + str(n) for n in range(20)]
            with patch.object(inspector_cases, "SUMMARY_READERS", 1):
                serial = inspector_cases.due_dates(root, numbers)
            lock = threading.Lock()
            active, peak = 0, 0

            def read(path):
                nonlocal active, peak
                with lock:
                    active += 1
                    peak = max(peak, active)
                try:
                    time.sleep(0.003)
                    return read_plain_bytes(path)
                finally:
                    with lock:
                        active -= 1

            with patch.object(inspector_cases, "read_plain_bytes", read):
                parallel = inspector_cases.due_dates(root, numbers)
            self.assertEqual(parallel, serial)
            self.assertGreater(peak, 1)
            self.assertLessEqual(peak, 4)
            self.assertEqual(active, 0)

    def test_empty_inspector_result_never_scans_other_cases(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            with patch.object(Path, "glob", side_effect=AssertionError("empty list must not scan the share")):
                self.assertEqual(inspector_cases.due_dates(root, []), {})
                self.assertIsNone(inspector_cases.due_dates(root / "missing", []))

    def test_read_and_parse_once_and_release_consumed_input(self):
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / "summary.json"
            raw = b'{"case":{"number":"QA-1"},"value":false}'
            path.write_bytes(raw)
            reader = Mock(wraps=read_plain_bytes)
            inputs = reporting_reads.SummaryInputs(reader)
            loads = json.loads
            with patch.object(reporting_reads.json, "loads", wraps=loads) as parse:
                context = inputs.read_context(path)
                self.assertEqual(inputs.read(path), (raw, context))
                self.assertEqual(parse.call_count, 1)
            self.assertEqual(reader.call_count, 1)
            self.assertEqual(inputs.bytes, 0)
            self.assertEqual(inputs.values, {})
            path.write_bytes(b'{"value":"new request"}')
            fresh = reporting_reads.SummaryInputs(reader)
            self.assertEqual(fresh.read_context(path), {"value": "new request"})
            self.assertEqual(fresh.read(path)[1], {"value": "new request"})
            self.assertEqual(reader.call_count, 2)

    def test_bounded_retention_and_original_size_refusal(self):
        with tempfile.TemporaryDirectory() as folder:
            paths = [Path(folder) / (str(n) + ".json") for n in range(32)]
            for path in paths:
                path.write_bytes(b'{"value":1}')
            reader = Mock(wraps=read_plain_bytes)
            inputs = reporting_reads.SummaryInputs(reader, max_bytes=50)
            with ThreadPoolExecutor(max_workers=4) as pool:
                self.assertEqual(list(pool.map(inputs.read_context, paths)), [{"value": 1}] * len(paths))
            kept = len(inputs.values)
            self.assertLessEqual(inputs.bytes, 50)
            self.assertLess(kept, len(paths))
            self.assertEqual([inputs.read(p)[1] for p in paths], [{"value": 1}] * len(paths))
            self.assertEqual(reader.call_count, 2 * len(paths) - kept)
            self.assertEqual(inputs.bytes, 0)
            inputs.read_context(paths[0])
            with self.assertRaisesRegex(ValueError, "too large"):
                inputs.read(paths[0], max_bytes=2)
            self.assertEqual(inputs.bytes, 0)

    def test_empty_or_malformed_inputs_also_have_an_entry_bound(self):
        with tempfile.TemporaryDirectory() as folder:
            inputs = reporting_reads.SummaryInputs(read_plain_bytes, max_files=2)
            for n in range(8):
                path = Path(folder) / (str(n) + ".json")
                path.write_bytes(b"")
                self.assertIsNone(inputs.read_context(path))
            self.assertEqual(len(inputs.values), 2)
            self.assertEqual(inputs.bytes, 0)

    def test_context_utf8_and_consumer_bytes_parsing_stay_distinct(self):
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / "summary.json"
            for raw in [b'\xef\xbb\xbf{"value":true}', '{"value":"wide"}'.encode("utf-16"), b'{"value":']:
                with self.subTest(raw=raw):
                    path.write_bytes(raw)
                    inputs = reporting_reads.SummaryInputs(read_plain_bytes)
                    self.assertIsNone(inputs.read_context(path))
                    try:
                        expected = json.loads(raw)
                    except ValueError as error:
                        with self.assertRaises(type(error)) as got:
                            inputs.read(path)
                        self.assertEqual(str(got.exception), str(error))
                    else:
                        self.assertEqual(inputs.read(path), (raw, expected))

    def test_links_keep_downgrade_evidence_without_becoming_secure_inputs(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            idx = root / "Reporting Index"
            idx.mkdir()
            outside = root / "outside.json"
            outside.write_text(json.dumps({"case": {"number": "QA-LINK"}, "integrity": {"headHash": "retained"}}))
            link = idx / "qa-link.json"
            link.symlink_to(outside)
            inputs = reporting_reads.SummaryInputs(read_plain_bytes)
            before = integrity.VerificationContext(root)
            after = integrity.VerificationContext(root, summary_reader=inputs.read_context)
            self.assertEqual(after.known, before.known)
            self.assertIn("qa-link", after.known)
            self.assertNotIn(link, inputs.values)
            with self.assertRaisesRegex(ValueError, "link"):
                inputs.read(link)
            record = {"schema": 1, "case": {"number": "QA-LINK"}, "events": []}
            self.assertEqual(integrity.verify_record(record, root, context=after)["state"], "downgraded")

    def test_consumption_uses_only_the_original_securely_read_bytes(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            path, outside = root / "summary.json", root / "outside.json"
            path.write_bytes(b'{"original":true}')
            outside.write_bytes(b'{"outside":"must not become a secure input"}')
            inputs = reporting_reads.SummaryInputs(read_plain_bytes)
            inputs.read_context(path)
            path.unlink()
            path.symlink_to(outside)
            self.assertEqual(inputs.read(path), (b'{"original":true}', {"original": True}))
            fresh = reporting_reads.SummaryInputs(read_plain_bytes)
            fresh.read_context(path)
            with self.assertRaisesRegex(ValueError, "link"):
                fresh.read(path)

    def test_each_operation_reads_once_and_still_verifies_every_case(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            fixture(root, 4)
            original_glob, original_bytes = Path.glob, Path.read_bytes
            secure = read_plain_bytes
            for operation in ["reports", "due"]:
                counts = {"enumerations": 0, "summaries": 0, "cases": 0}

                def glob(path, pattern, *args, **kwargs):
                    if path == root / "Reporting Index":
                        counts["enumerations"] += 1
                    return original_glob(path, pattern, *args, **kwargs)

                def note(path):
                    if path.parent == root / "Reporting Index":
                        counts["summaries"] += 1
                    elif path.parent == root:
                        counts["cases"] += 1

                def read(path):
                    note(path)
                    return original_bytes(path)

                def plain(path):
                    note(Path(path))
                    return secure(path)

                with (
                    patch.object(Path, "glob", glob),
                    patch.object(Path, "read_bytes", read),
                    patch.object(server, "read_plain_bytes", plain),
                    patch.object(inspector_cases, "read_plain_bytes", plain),
                    patch.object(server, "case_dir", return_value=root),
                    patch.object(integrity, "protected_folder", wraps=integrity.protected_folder) as settings,
                    patch.object(integrity, "verify_record", wraps=integrity.verify_record) as proofs,
                ):
                    result = server.read_index() if operation == "reports" else inspector_cases.due_dates(root, ["QA-" + str(n) for n in range(4)])
                self.assertEqual(len(result["summaries"] if operation == "reports" else result), 4)
                self.assertEqual(counts, {"enumerations": 1, "summaries": 4, "cases": 4})
                self.assertEqual(settings.call_count, 1)
                self.assertEqual(proofs.call_count, 4)
            # A fresh request must reject changed case bytes even when the summary names the new revision.
            path = root / "TEST - QA-1.json"
            value = json.loads(path.read_bytes())
            value["case"]["owner"] = "Outside rewrite"
            raw = json.dumps(value).encode()
            path.write_bytes(raw)
            summary_path = root / "Reporting Index/qa-1.json"
            summary = json.loads(summary_path.read_bytes())
            summary["sourceRevision"] = hashlib.sha256(raw).hexdigest()
            summary_path.write_text(json.dumps(summary))
            with patch.object(server, "case_dir", return_value=root):
                refreshed = server.read_index()
            self.assertEqual(len(refreshed["summaries"]), 3)
            self.assertTrue(any("qa-1.json" in x for x in refreshed["unreadable"]))
            self.assertEqual(inspector_cases.due_dates(root, ["QA-1"]), {"QA-1": ("unknown", "")})


if __name__ == "__main__":
    unittest.main()
