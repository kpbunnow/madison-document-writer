"""Malformed metadata in one cached summary excludes that summary; the reporting index still answers."""

import copy, hashlib, json, subprocess, tempfile, threading, unittest, urllib.error, urllib.request
from pathlib import Path
from unittest.mock import patch
import case_store as store
import server
from audit_report_projection import life
from report_summaries import report_summary

ROOT = Path(__file__).resolve().parents[2]
NUMBERS = ("QA-META-A", "QA-META-B")
# Every JSON type that is not a file name, truthy and falsy.
DAMAGED = [17, 0, 1.5, True, False, [], ["101 TEST - QA-META-A.json"], {}, {"name": "101 TEST - QA-META-A.json"}]


class ReportMetadata(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        self.names = {}
        for number in NUMBERS:
            name = "101 TEST - " + number + ".json"
            saved = store.save_case(self.root, name, json.loads(json.dumps(life()).replace("QA-LIFE", number)))
            store.save_summary(self.root, name, saved["revision"], report_summary(saved["file"]))
            self.names[number] = name
        self.damaged = self.root / "Reporting Index" / "qa-meta-a.json"
        self.healthy = json.loads(self.damaged.read_bytes())
        server.PROJECTION_MATCHES.clear()
        self.http = server.Server(("127.0.0.1", 0), server.Handler)
        self.port, server.PORT = server.PORT, self.http.server_address[1]
        self.thread = threading.Thread(target=self.http.serve_forever, daemon=True)
        self.thread.start()
        self.folder = patch.object(server, "case_dir", return_value=self.root)
        self.folder.start()

    def tearDown(self):
        self.folder.stop()
        self.http.shutdown()
        self.http.server_close()
        self.thread.join()
        server.PORT = self.port
        self.temp.cleanup()

    def index(self, readers=4):
        """GET /reporting/index through the real handler, with the given number of readers."""
        request = urllib.request.Request("http://127.0.0.1:%d/reporting/index" % server.PORT, headers={"X-DocWriter-Token": server.SESSION_TOKEN})
        with patch.object(server.read_index, "__defaults__", (readers,)):
            try:
                with urllib.request.urlopen(request) as response:
                    return response.status, json.loads(response.read())
            except urllib.error.HTTPError as error:
                return error.code, json.loads(error.read())

    def files(self):
        return {p.relative_to(self.root).as_posix(): p.read_bytes() for p in sorted(self.root.rglob("*")) if p.is_file() and ".locks" not in p.parts}

    def summary(self, **changes):
        value = copy.deepcopy(self.healthy)
        value.update(changes)
        self.damaged.write_text(json.dumps(value), encoding="utf-8")

    def numbers(self, index):
        return sorted(s["case"]["number"] for s in index["summaries"])

    def report(self, index):
        path, output = self.root.parent / (self.root.name + "-index.json"), self.root.parent / (self.root.name + "-report.json")
        path.write_text(json.dumps(index), encoding="utf-8")
        try:
            subprocess.run(
                ["node", "tests/fixtures/report_output.cjs", str(path), "allCases", str(output)],
                cwd=ROOT,
                capture_output=True,
                timeout=60,
                check=True,
            )
            return json.loads(output.read_bytes())
        finally:
            path.unlink(missing_ok=True)
            output.unlink(missing_ok=True)

    def test_healthy_baseline(self):
        status, index = self.index()
        self.assertEqual((status, self.numbers(index), index["unreadable"]), (200, list(NUMBERS), []))

    def test_damaged_source_file_excludes_only_that_summary(self):
        for value in DAMAGED:
            with self.subTest(sourceFile=value):
                self.summary(sourceFile=value)
                before = self.files()
                results = {readers: self.index(readers) for readers in (1, 4)}
                for readers, (status, index) in results.items():
                    with self.subTest(readers=readers):
                        self.assertEqual(status, 200)
                        self.assertEqual(self.numbers(index), ["QA-META-B"])
                        self.assertEqual(index["unreadable"], ["qa-meta-a.json (summary source file is not a file name)"])
                        # Without a usable summary the case is reported as missing coverage, as for other unreadable summaries.
                        self.assertEqual(index["missing"], [self.names["QA-META-A"]])
                        self.assertEqual((index["stale"], index["mismatched"]), ([], []))
                results[1][1].pop("readAt")
                results[4][1].pop("readAt")
                self.assertEqual(results[1][1], results[4][1])
                self.assertEqual(self.files(), before, "reading must not repair or write anything")
        report = self.report(results[4][1])
        self.assertIn("1 unreadable/duplicate summary entry", report["coverage"])
        output = json.dumps({k: report[k] for k in ("rows", "sheets", "page")})
        self.assertIn("QA-META-B", output)
        self.assertNotIn("QA-META-A", output)

    def test_existing_source_file_rules(self):
        accepted = {
            "exact name": self.names["QA-META-A"],
            "different letter case": self.names["QA-META-A"].upper(),
            "empty": "",
            "null": None,
        }
        for label, value in accepted.items():
            with self.subTest(accepted=label):
                self.summary(sourceFile=value)
                status, index = self.index()
                self.assertEqual((status, self.numbers(index), index["unreadable"]), (200, list(NUMBERS), []))
        with self.subTest(accepted="absent"):
            value = copy.deepcopy(self.healthy)
            value.pop("sourceFile")
            self.damaged.write_text(json.dumps(value), encoding="utf-8")
            self.assertEqual(self.numbers(self.index()[1]), list(NUMBERS))
        with self.subTest(excluded="different case file"):
            self.summary(sourceFile=self.names["QA-META-B"])
            status, index = self.index()
            self.assertEqual((status, self.numbers(index)), (200, ["QA-META-B"]))
            self.assertEqual(index["unreadable"], ["qa-meta-a.json (summary points to a different case file)"])
        with self.subTest(passed_through="earlier summary format without sourceFile"):
            value = copy.deepcopy(self.healthy)
            value.pop("sourceFile")
            value["summaryVersion"] = 5
            self.damaged.write_text(json.dumps(value), encoding="utf-8")
            status, index = self.index()
            self.assertEqual((status, self.numbers(index)), (200, list(NUMBERS)))
            self.assertEqual(sorted(s["summaryVersion"] for s in index["summaries"]), [5, 6])

    def test_case_file_that_is_not_a_case_record(self):
        case_path = self.root / self.names["QA-META-A"]
        for label, body in {
            "array": [1, 2],
            "string": "not a case",
            "case not an object": {"format": "madison-case-file", "case": ["QA-META-A"]},
        }.items():
            with self.subTest(case_file=label):
                raw = json.dumps(body).encode()
                case_path.write_bytes(raw)
                self.summary(sourceRevision=hashlib.sha256(raw).hexdigest())
                for readers in (1, 4):
                    status, index = self.index(readers)
                    self.assertEqual((status, self.numbers(index)), (200, ["QA-META-B"]))
                    self.assertEqual(index["unreadable"], ["qa-meta-a.json (case file is not a case record)"])

    def test_other_exclusions_remain(self):
        self.summary(sourceRevision="0" * 64)
        status, index = self.index()
        self.assertEqual((status, self.numbers(index), index["stale"]), (200, ["QA-META-B"], [self.names["QA-META-A"]]))
        altered = copy.deepcopy(self.healthy)
        altered["case"]["noticeActive"] = 0
        self.damaged.write_text(json.dumps(altered), encoding="utf-8")
        status, index = self.index()
        self.assertEqual((status, self.numbers(index), len(index["mismatched"])), (200, ["QA-META-B"], 1))
        self.summary()
        (self.root / "Reporting Index" / "copy.json").write_bytes(self.damaged.read_bytes())
        status, index = self.index()
        self.assertEqual((status, self.numbers(index)), (200, ["QA-META-B"]))
        self.assertTrue(any("duplicate summary" in u for u in index["unreadable"]))


if __name__ == "__main__":
    unittest.main()
