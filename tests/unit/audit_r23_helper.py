"""R23 verified defects: real HTTP, storage, calendar, GIS and PDF regressions."""

import copy
import datetime
import hashlib
import json
import os
from pathlib import Path
import tempfile
import threading
import unittest
import urllib.error
import urllib.request
from unittest.mock import patch
import case_store
import case_lookup
import server
from audit_helper import record
from audit_workflow import initial
import audit_authoring


class R23Tests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        self.case_folder = self.root / "cases"
        self.case_folder.mkdir()
        self.patches = [
            patch.object(server, "HERE", self.root),
            patch.object(server, "share_root", lambda: self.root / "share"),
            patch.object(server, "BACKUP_ROOT", self.root / "backups"),
            patch.dict(os.environ, {"DW_CASE_DIR": str(self.case_folder)}),
        ]
        for p in self.patches:
            p.start()
        self.http = server.Server(("127.0.0.1", 0), server.Handler)
        self.base = "http://127.0.0.1:" + str(self.http.server_address[1])
        self.thread = threading.Thread(target=self.http.serve_forever, daemon=True)
        self.thread.start()

    def tearDown(self):
        self.http.shutdown()
        self.http.server_close()
        for p in reversed(self.patches):
            p.stop()
        self.temp.cleanup()

    def request(self, path, data=None):
        request = urllib.request.Request(
            self.base + path,
            data=None if data is None else json.dumps(data).encode(),
            headers={"Content-Type": "application/json", "X-DocWriter-Token": server.SESSION_TOKEN},
        )
        try:
            with urllib.request.urlopen(request) as response:
                return response.status, json.loads(response.read())
        except urllib.error.HTTPError as error:
            return error.code, json.loads(error.read())

    def backup(self):
        ws, case = "a" * 32, "b" * 32
        return {
            "workspace": ws,
            "case": case,
            "backup": {
                "format": "madison-draft-recovery",
                "version": 1,
                "workspace": ws,
                "case": case,
                "number": "QA-001",
                "at": "2026-10-01T12:00:00Z",
            },
        }

    def test_backup_http_after_eight_and_retention_failure(self):
        data = self.backup()
        for n in range(30):
            data["backup"]["sequence"] = n
            status, result = self.request("/draft-backups/write", data)
            self.assertEqual(status, 200)
            self.assertIsInstance(result["at"], str)
            json.dumps(result)
        files = list(server.backup_location(data["workspace"], data["case"]).glob("*.json"))
        self.assertEqual(len(files), 24)
        self.assertEqual({json.loads(p.read_text())["sequence"] for p in sorted(files, reverse=True)[:8]}, set(range(22, 30)))
        with patch.object(Path, "glob", side_effect=OSError("retention share error")):
            self.assertEqual(self.request("/draft-backups/write", data)[0], 200)

    def test_backup_documented_daily_weekly_replacement_mix(self):
        data = self.backup()
        folder = server.backup_location(data["workspace"], data["case"])
        folder.mkdir(parents=True)
        days = [datetime.date(2026, 9, 30) - datetime.timedelta(days=n) for n in range(75)]
        for n, day in enumerate(days):
            value = copy.deepcopy(data["backup"])
            value["preReplacement"] = n in (5, 15, 25, 35)
            (folder / (day.strftime("%Y%m%d") + "T120000000000Z-seeded.json")).write_text(json.dumps(value))
        newest = sorted(folder.glob("*.json"), reverse=True)[:7]
        self.assertEqual(self.request("/draft-backups/write", data)[0], 200)
        retained = sorted(folder.glob("*.json"), reverse=True)
        self.assertLessEqual(len(retained), 24)
        self.assertTrue(all(p.exists() for p in newest))
        older = retained[8:]
        replacement = [p for p in older if json.loads(p.read_text()).get("preReplacement")]
        self.assertEqual(len(replacement), 2)
        self.assertEqual(len(older) - len(replacement), 14)
        self.assertFalse((folder / "20260718T120000000000Z-seeded.json").exists())

    def test_city_day_and_friday_monday_mailing(self):
        self.assertEqual(case_store.city_day("2026-10-03T00:01:00Z").isoformat(), "2026-10-02")
        self.assertEqual(case_store.city_day("2026-10-03T04:59:59Z").isoformat(), "2026-10-02")
        self.assertEqual(case_store.city_day("2026-10-03T05:00:00Z").isoformat(), "2026-10-03")
        self.assertEqual(case_store.city_day("2026-12-02T05:59:59Z").isoformat(), "2026-12-01")
        value = initial()
        snap = value["events"][0]["payload"]["snapshot"]
        snap["authoringVersion"] = 4
        snap["mailed"] = "2026-10-05"
        value["events"][0]["at"] = "2026-10-03T04:59:59Z"
        case_store.save_case(self.case_folder, "TEST - QA-LIFE.json", value)
        snap["mailed"] = "2026-10-08"
        with self.assertRaisesRegex(ValueError, "five days"):
            case_store.validate_history(value)
        snap["mailed"] = "2026-10-07"
        case_store.validate_history(value)

    def test_citation_future_mailing_and_issue_rejected(self):
        value = audit_authoring.AuthoringStoreTests().citation()
        event = value["events"][-1]
        snap = event["payload"]["snapshot"]
        snap["mailed"] = "2026-09-02"
        next(iter(snap["cits"].values()))["issued"] = "2026-09-02"
        with self.assertRaisesRegex(ValueError, "no later than today"):
            case_store.validate_history(value)
        snap["mailed"] = "2026-09-01"
        next(iter(snap["cits"].values()))["issued"] = "2026-09-01"
        case_store.validate_history(value)

    def test_unavailable_resolve_is_not_missing_and_mixed_case_resolves(self):
        with patch.dict(os.environ, {"DW_CASE_DIR": str(self.root / "absent")}):
            status, value = self.request("/cases/resolve?number=QA-001")
            self.assertEqual(status, 503)
            self.assertNotIn("missing", value)
            self.assertEqual(value["error"], "The shared case folder is unavailable")
        self.assertEqual(self.request("/cases/resolve?number=QA-001")[0], 404)
        case_store.save_case(self.case_folder, "TEST - QA-001.json", record())
        status, value = self.request("/cases/resolve?number=qa-001")
        self.assertEqual(status, 200)
        self.assertEqual(value["file"]["case"]["number"], "QA-001")

    def test_number_filename_casefold_address_and_summary_identity(self):
        for number in ["QA/001", "QA_001", "ab", "x" * 81]:
            candidate = record()
            candidate["events"] = []
            candidate["case"]["number"] = number
            with self.assertRaises(ValueError):
                case_store.save_case(self.case_folder, "TEST - QA-001.json", candidate)
            with self.assertRaises(case_lookup.CaseLookupError):
                case_lookup.case_number(number)
        with self.assertRaisesRegex(ValueError, "filename"):
            case_store.save_case(self.case_folder, "unrelated.json", record())
        first = case_store.save_case(self.case_folder, "TEST - QA-001.json", record())
        edited = record("second")
        edited["case"].update(number="qa-001", address="CORRECTED ADDRESS")
        saved = case_store.save_case(self.case_folder, "CORRECTED - qa-001.json", edited, first["revision"], first["file"]["case"])
        self.assertEqual(saved["name"], first["name"])
        self.assertEqual(len(list(self.case_folder.glob("*.json"))), 1)
        summary = {"format": "madison-case-summary", "case": {"number": "qa-001"}}
        case_store.save_summary(self.case_folder, saved["name"], saved["revision"], summary)
        index = server.read_index()
        self.assertEqual(len(index["summaries"]), 1)
        self.assertEqual(index["missing"], [])
        self.assertTrue((self.case_folder / "Reporting Index" / "qa-001.json").exists())

    def test_version_diagnostic_and_release_packaging_invariants(self):
        import launch

        source = Path(__file__).resolve().parents[2]
        self.assertEqual(launch.VERSION, server.HELPER_VERSION)
        self.assertEqual(json.loads((source / "package.json").read_text())["version"], server.HELPER_VERSION)
        # Maintenance helpers can advance without renaming the documented release.
        release = json.loads((source / "build/generated/runtime-manifest.json").read_text())["release"]
        self.assertEqual((source / "build/generated/RELEASE").read_text().strip(), release)
        for name in ["docs/developer/01-ARCHITECTURE.md", "docs/developer/04-PITFALLS.md"]:
            self.assertIn(release.split()[-1], (source / name).read_text().splitlines()[0])
        self.assertIn("calendar_policy.json", launch.REQUIRED)
        self.assertIn("city-timezone.tzif", launch.REQUIRED)
        for name in ["helper/case_lookup.ps1", "helper/case_lookup.py", "docs/staff/CASE-LOOKUP-GUIDE.md"]:
            text = (source / name).read_text()
            self.assertNotIn("MadisonDocumentWriter", text)
            self.assertIn("MadisonDocWriter", text)
        text = (source / "tools/package_release.py").read_text()
        self.assertIn("if not args.evidence:", text)
        self.assertIn("browser.get('runtimeHashes') != hashes", text.replace(chr(34), chr(39)))
        self.assertIn("CaseLookupError", (source / "helper/case_lookup.py").read_text())
        self.assertNotIn("class LookupError", (source / "helper/case_lookup.py").read_text())

    def test_windows_exclusive_port_policy(self):
        source = (Path(__file__).resolve().parents[2] / "helper/server.py").read_text()
        self.assertIn("allow_reuse_address = os.name != 'nt'", source.replace(chr(34), chr(39)))
        with self.assertRaises(OSError):
            duplicate = server.Server(self.http.server_address, server.Handler)
            duplicate.server_close()

    def test_artifact_unexpected_exception_returns_json_503(self):
        with patch.object(server, "verified_artifact", side_effect=PermissionError("PDF unavailable")):
            self.assertEqual(self.request("/artifact/read", {"filename": "test.pdf", "sha256": "a" * 64, "docId": "doc1"})[0], 503)

    def test_status_reachability_errors_are_flags(self):
        with (
            patch.object(server, "out_dir", side_effect=OSError("out unavailable")),
            patch.object(server, "case_dir", side_effect=OSError("case unavailable")),
        ):
            status, value = self.request("/dw-status")
            self.assertEqual(status, 200)
            self.assertTrue(value["ok"])
            self.assertFalse(value["outReachable"])
            self.assertFalse(value["caseReachable"])

    def test_vanished_summary_and_case_stat_are_skipped(self):
        saved = case_store.save_case(self.case_folder, "TEST - QA-001.json", record())
        case_store.save_summary(self.case_folder, saved["name"], saved["revision"], {"format": "madison-case-summary", "case": {"number": "QA-001"}})
        stat = Path.stat
        summary = self.case_folder / "Reporting Index" / "qa-001.json"
        case = self.case_folder / saved["name"]
        for vanished in [summary, case]:

            def disappearing(path, *args, **kwargs):
                if path == vanished:
                    raise FileNotFoundError("vanished")
                return stat(path, *args, **kwargs)

            with patch.object(Path, "stat", disappearing):
                self.assertTrue(server.read_index()["ok"])

    def test_event_type_nonempty_string(self):
        for value in [1, [], {}, True, None, "", "   "]:
            candidate = record()
            candidate["events"][0]["type"] = value
            with self.assertRaises(ValueError):
                case_store.validate_case(candidate)

    def test_readonly_shared_pdf_falls_back_and_checksum_is_immutable(self):
        shared = Path("/sys")  # Real read-only mount; even root cannot create .locks here.

        def render(command, **kwargs):
            target = next(x.split("=", 1)[1] for x in command if x.startswith("--print-to-pdf="))
            Path(target).write_bytes(b"%PDF-1.7\nimmutable test")
            return type("Run", (), {"returncode": 0, "stderr": b""})()

        data = {"filename": "test.pdf", "html": "<!doctype html><html><head></head><body><h1>test</h1></body></html>"}
        with (
            patch.object(server, "out_dir", lambda: shared),
            patch.object(server, "find_chrome", lambda: "chrome"),
            patch.object(server.subprocess, "run", render),
        ):
            status, value = self.request("/save-pdf", data)
            self.assertEqual(status, 200)
            self.assertTrue(value["local"])
            self.assertEqual(value["sha256"], hashlib.sha256(Path(value["path"]).read_bytes()).hexdigest())
            self.assertEqual(self.request("/save-pdf", data)[0], 200)
            target = Path(value["path"])
            target.write_bytes(b"%PDF-1.7\nexisting different copy")
            self.assertEqual(self.request("/save-pdf", data)[0], 400)
            self.assertEqual(target.read_bytes(), b"%PDF-1.7\nexisting different copy")

    def test_pdf_final_shared_write_error_surfaces_as_oserror(self):
        def render(command, **kwargs):
            path = next(x.split("=", 1)[1] for x in command if x.startswith("--print-to-pdf="))
            self.assertNotEqual(Path(path).parent, Path("/sys"))
            Path(path).write_bytes(b"%PDF-1.7\nlocal render")
            return type("Run", (), {"returncode": 0, "stderr": b""})()

        with patch.object(server, "find_chrome", lambda: "chrome"), patch.object(server.subprocess, "run", render):
            with self.assertRaises(OSError):
                server.make_pdf("<!doctype html><html><head></head><body><h1>test</h1></body></html>", Path("/sys/dw-readonly-test.pdf"))

    def test_partial_gis_keeps_success_and_missing_precedes_cached(self):
        ids = ["070822219103", "070822219104", "070822219105"]
        feature = lambda pid: {
            "features": [{"properties": {"Parcel": pid, "Address": "TEST", "AlderDistrict": 1, "BuildingDistrict": 2}, "geometry": None}]
        }
        with (
            patch.object(server, "PARCEL_BATCH", 1),
            patch.object(server, "fetch_json", side_effect=[feature(ids[0]), OSError("batch disconnected"), {"features": []}]),
        ):
            value = server.lookup_parcels(ids, True)
        self.assertFalse(value["ok"])
        self.assertTrue(value["partial"])
        self.assertIn(ids[0], value["parcels"])
        self.assertEqual(value["missing"], [ids[2]])
        self.assertNotIn(ids[1], server.read_cache()["missing"])
        with patch.object(server, "fetch_json", return_value={"features": []}):
            value = server.lookup_parcels([ids[0]], True)
        self.assertNotIn(ids[0], value["parcels"])
        self.assertEqual(value["missing"], [ids[0]])
        self.assertIn(ids[0], server.read_cache()["parcels"])  # Retain historical location evidence.

    def test_district_download_is_atomic_and_locked(self):
        geo = {"type": "FeatureCollection", "features": []}
        with (
            patch.object(server, "fetch_json", return_value=geo),
            patch.object(server, "atomic_write", wraps=server.atomic_write) as atomic,
            patch.object(server, "file_lock", wraps=server.file_lock) as lock,
        ):
            value = server.read_areas()
            self.assertEqual(value["districts"], geo)
            atomic.assert_called_once()
            lock.assert_called_once()
            self.assertEqual(server.read_areas()["districts"], geo)
            self.assertEqual(atomic.call_count, 1)


if __name__ == "__main__":
    unittest.main(verbosity=2)
