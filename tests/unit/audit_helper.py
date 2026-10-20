#!/usr/bin/env python3
"""Real filesystem/HTTP regressions; OS integrations use controlled substitutes."""

import concurrent.futures
import copy
import json
from pathlib import Path
import tempfile
import threading
import unittest
import urllib.error
import urllib.request
from unittest.mock import patch

import case_store
import server


def record(event="first", case_id="case_a"):
    return {
        "format": "madison-case-file",
        "schema": 3,
        "case": {"id": case_id, "number": "QA-001", "address": "101 TEST LANE", "owner": "SYNTHETIC OWNER"},
        "inspectors": [],
        "events": [{"id": event, "at": "2026-09-19T01:00:00Z", "by": "", "type": "case.opened", "payload": {}}],
    }


class StoreTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        self.name = "101 TEST LANE - QA-001.json"

    def tearDown(self):
        self.temp.cleanup()

    def test_parallel_saves_keep_every_event(self):
        def save(n):
            return case_store.save_case(self.root, self.name, record("event_" + str(n)))

        with concurrent.futures.ThreadPoolExecutor(max_workers=12) as pool:
            list(pool.map(save, range(24)))
        result = case_store.read_case(self.root, self.name)
        self.assertEqual(len(result["file"]["events"]), 24)
        self.assertTrue((self.root / "_recovery" / (self.name + ".bak")).exists())
        self.assertEqual(list((self.root / ".locks").glob("*")), [])

    def test_disjoint_metadata_changes_merge(self):
        initial = record()
        first = case_store.save_case(self.root, self.name, initial)
        left = record("left")
        left["case"]["owner"] = "NEW OWNER"
        case_store.save_case(self.root, self.name, left, first["revision"], initial["case"])
        right = record("right")
        right["case"]["address"] = "CORRECTED ADDRESS"
        saved = case_store.save_case(self.root, self.name, right, first["revision"], initial["case"])
        self.assertEqual(saved["file"]["case"]["owner"], "NEW OWNER")
        self.assertEqual(saved["file"]["case"]["address"], "CORRECTED ADDRESS")
        self.assertEqual(len(saved["file"]["events"]), 3)

    def test_same_metadata_field_conflict_fails_closed(self):
        initial = record()
        first = case_store.save_case(self.root, self.name, initial)
        left = record("left")
        left["case"]["owner"] = "FIRST EDIT"
        case_store.save_case(self.root, self.name, left, first["revision"], initial["case"])
        right = record("right")
        right["case"]["owner"] = "SECOND EDIT"
        with self.assertRaisesRegex(ValueError, "Both copies changed owner"):
            case_store.save_case(self.root, self.name, right, first["revision"], initial["case"])
        self.assertEqual(case_store.read_case(self.root, self.name)["file"]["case"]["owner"], "FIRST EDIT")

    def test_unreadable_file_is_preserved(self):
        (self.root / self.name).write_text("{corrupt")
        with self.assertRaises(ValueError):
            case_store.save_case(self.root, self.name, record())
        self.assertEqual((self.root / self.name).read_text(), "{corrupt")

    def test_conflicting_event_is_not_discarded(self):
        case_store.save_case(self.root, self.name, record())
        bad = record()
        bad["events"][0]["payload"] = {"changed": True}
        with self.assertRaisesRegex(ValueError, "Conflicting"):
            case_store.save_case(self.root, self.name, bad)
        self.assertEqual(case_store.read_case(self.root, self.name)["file"]["events"][0]["payload"], {})

    def test_case_ids_remap_without_duplicate_events(self):
        case_store.save_case(self.root, self.name, record())
        newer = record("second", "case_b")
        newer["events"][0]["payload"] = {"caseId": "case_b"}
        result = case_store.save_case(self.root, self.name, newer)
        self.assertEqual(result["file"]["case"]["id"], "case_a")
        self.assertEqual(result["file"]["events"][1]["payload"]["caseId"], "case_a")

    def test_summary_cannot_get_ahead_of_case(self):
        saved = case_store.save_case(self.root, self.name, record())
        summary = {"format": "madison-case-summary", "case": {"number": "QA-001"}, "summaryVersion": 2}
        self.assertTrue(case_store.save_summary(self.root, self.name, saved["revision"], summary)["ok"])
        case_store.save_case(self.root, self.name, record("new"))
        self.assertFalse(case_store.save_summary(self.root, self.name, saved["revision"], summary)["ok"])

    def test_changed_address_uses_existing_case_file(self):
        case_store.save_case(self.root, self.name, record())
        result = case_store.save_case(self.root, "102 TEST LANE - QA-001.json", record("second"))
        self.assertEqual(result["name"], self.name)
        self.assertEqual(len(list(self.root.glob("*.json"))), 1)

    def test_legacy_replacement_requires_revision(self):
        (self.root / self.name).write_text(json.dumps({"format": "madison-case-file", "schema": 1, "case": record()["case"]}))
        with self.assertRaises(ValueError):
            case_store.save_case(self.root, self.name, record())
        read = case_store.read_case(self.root, self.name)
        self.assertTrue(case_store.save_case(self.root, self.name, record(), read["revision"])["ok"])

    def test_path_guard_and_draft_guard(self):
        for bad in ["../x.json", "a/b.json", "C:x.json", "x.pdf"]:
            with self.assertRaises(ValueError):
                case_store.save_case(self.root, bad, record())
        bad = record()
        bad["events"][0].update(type="notice.issued", payload={"snapshot": {"draft": True}})
        with self.assertRaises(ValueError):
            case_store.save_case(self.root, self.name, bad)

    def correction_fixture(self, event_id="revision_a"):
        base = record()
        item = {"id": "item1", "no": "1", "sections": ["27.05(2)(c)"], "text": "Original text"}
        snap = {
            "id": "notice1",
            "caseId": "case_a",
            "type": "notice",
            "status": "Final",
            "items": [item],
            "frozen": {"case": copy.deepcopy(base["case"])},
        }
        base["events"] = [{"id": "issued1", "at": "2026-01-01T12:00:00Z", "by": "inspector1", "type": "notice.issued", "payload": {"snapshot": snap}}]
        revised = copy.deepcopy(base)
        new_snap = copy.deepcopy(snap)
        new_snap["id"] = "doc_" + event_id
        new_snap["items"][0]["text"] = "Corrected text"
        new_snap["revision"] = {"targetId": "notice1", "rootId": "notice1", "number": 1, "originalIssued": "2026-01-01"}
        revised["events"].append(
            {
                "id": event_id,
                "at": "2026-02-01T12:00:00Z",
                "by": "inspector1",
                "type": "correction.issued",
                "payload": {
                    "docId": new_snap["id"],
                    "snapshot": new_snap,
                    "replaces": "notice1",
                    "baseEventId": "issued1",
                    "reason": "Correct a transcription error.",
                    "changes": [{"path": "item.1.text", "before": "Original text", "after": "Corrected text"}],
                    "expectedHead": ["issued1"],
                    "reviewedAt": "2026-02-01T12:00:00Z",
                },
            }
        )
        return base, revised

    def test_concurrent_corrections_have_one_winner(self):
        base, left = self.correction_fixture("revision_a")
        _, right = self.correction_fixture("revision_b")
        first = case_store.save_case(self.root, self.name, base)

        def save(rec):
            try:
                return case_store.save_case(self.root, self.name, rec, first["revision"], base["case"])["ok"]
            except ValueError:
                return False

        with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
            outcomes = list(pool.map(save, [left, right]))
        self.assertEqual(sorted(outcomes), [False, True])
        final = case_store.read_case(self.root, self.name)["file"]
        self.assertEqual(len(final["events"]), 2)
        self.assertEqual(final["events"][0], base["events"][0])

    def test_correction_retry_after_lost_response_is_idempotent(self):
        base, revision = self.correction_fixture()
        first = case_store.save_case(self.root, self.name, base)
        for _ in range(3):
            case_store.save_case(self.root, self.name, revision, first["revision"], base["case"])
        self.assertEqual(len(case_store.read_case(self.root, self.name)["file"]["events"]), 2)

    def test_retry_does_not_overwrite_later_owner_update(self):
        base, revision = self.correction_fixture()
        first = case_store.save_case(self.root, self.name, base)
        saved = case_store.save_case(self.root, self.name, revision, first["revision"], base["case"])
        later = copy.deepcopy(saved["file"])
        later["case"]["owner"] = "LATER OWNER UPDATE"
        case_store.save_case(self.root, self.name, later, saved["revision"], saved["file"]["case"])
        retry = case_store.save_case(self.root, self.name, revision, first["revision"], base["case"], "revision_a")
        self.assertTrue(retry["alreadyCommitted"])
        self.assertEqual(retry["file"]["case"]["owner"], "LATER OWNER UPDATE")
        self.assertEqual(len(retry["file"]["events"]), 2)

    def test_correction_cannot_erase_item_identity(self):
        base, revision = self.correction_fixture()
        revision["events"][-1]["payload"]["snapshot"]["items"][0]["no"] = "2"
        case_store.save_case(self.root, self.name, base)
        with self.assertRaisesRegex(ValueError, "identity"):
            case_store.save_case(self.root, self.name, revision)
        self.assertEqual(case_store.read_case(self.root, self.name)["file"]["events"], base["events"])

    def test_correction_after_intervening_visit_is_refused(self):
        base, revision = self.correction_fixture()
        case_store.save_case(self.root, self.name, base)
        current = copy.deepcopy(base)
        current["events"].append(
            {
                "id": "visit1",
                "at": "2026-01-20T12:00:00Z",
                "by": "inspector2",
                "type": "reinspection.recorded",
                "payload": {"reinspection": {"id": "visit_record", "sourceDocId": "notice1", "results": {}}},
            }
        )
        case_store.save_case(self.root, self.name, current)
        with self.assertRaisesRegex(ValueError, "changed on another"):
            case_store.save_case(self.root, self.name, revision)

    def test_schema_two_read_is_upgraded_without_discarding_history(self):
        base, revision = self.correction_fixture()
        base["schema"] = 2
        (self.root / self.name).write_text(json.dumps(base))
        result = case_store.save_case(self.root, self.name, revision)
        self.assertEqual(result["file"]["schema"], 3)
        self.assertEqual(len(result["file"]["events"]), 2)
        with self.assertRaisesRegex(ValueError, "schema-3"):
            case_store.save_case(self.root, self.name, base)

    def test_independent_note_does_not_invalidate_correction(self):
        base, revision = self.correction_fixture()
        case_store.save_case(self.root, self.name, base)
        noted = copy.deepcopy(base)
        noted["events"].append(
            {
                "id": "note1",
                "at": "2026-01-20T12:00:00Z",
                "by": "inspector2",
                "type": "document.annotated",
                "payload": {"docId": "notice1", "text": "A detailed record annotation."},
            }
        )
        case_store.save_case(self.root, self.name, noted)
        result = case_store.save_case(self.root, self.name, revision)
        self.assertEqual(len(result["file"]["events"]), 3)

    def test_unique_windows_pdf_names(self):
        a = server.safe_name("A" * 220 + "ONE.pdf")
        b = server.safe_name("A" * 220 + "TWO.pdf")
        self.assertNotEqual(a, b)
        self.assertTrue(a.endswith(".pdf"))
        self.assertLess(len(a), 181)
        self.assertEqual(server.safe_name("CON.pdf"), "Document-CON.pdf")

    def test_pdf_renderer_uses_unique_temp_and_profile(self):
        commands = []

        def renderer(cmd, **kw):
            commands.append(cmd)
            target = next(x.split("=", 1)[1] for x in cmd if x.startswith("--print-to-pdf="))
            Path(target).write_bytes(b"%PDF-1.7\nfixture")
            return type("Result", (), {"returncode": 0, "stderr": b""})()

        with patch.object(server, "find_chrome", lambda: "chrome"), patch.object(server.subprocess, "run", renderer):
            for _ in range(2):
                server.make_pdf("<!doctype html><html><head></head><body><h1>test</h1></body></html>", self.root / "same.pdf")
        targets = [next(x for x in c if x.startswith("--print-to-pdf=")) for c in commands]
        self.assertNotEqual(*targets)
        self.assertTrue(all(any(x.startswith("--user-data-dir=") for x in c) for c in commands))
        self.assertEqual(list(self.root.glob("*.part-*")), [])

    def test_outbox_preserves_conflicts(self):
        shared = self.root / "share"
        local = self.root / "local"
        shared.mkdir()
        local.mkdir()
        a = local / server.OUTDIR_NAME
        a.mkdir()
        b = shared / server.OUTDIR_NAME
        b.mkdir()
        (a / "same.pdf").write_bytes(b"%PDF-local")
        (b / "same.pdf").write_bytes(b"%PDF-shared")
        (a / "new.pdf").write_bytes(b"%PDF-new")
        with patch.object(server, "HERE", local), patch.object(server, "share_root", lambda: shared):
            result = server.sync_outbox()
        self.assertEqual(result["moved"], 1)
        self.assertFalse(result["ok"])
        self.assertTrue((a / "same.pdf").exists())
        self.assertEqual((b / "same.pdf").read_bytes(), b"%PDF-shared")

    def test_parcel_identical_ascii_rules(self):
        self.assertEqual(server.norm_parcel("0708-222-1910-3"), "070822219103")
        self.assertEqual(server.norm_parcel("\t070822219103\n"), "070822219103")
        self.assertEqual(server.norm_parcel("０７０８２２２１９１０３"), "")


class HTTPTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temp = tempfile.TemporaryDirectory()
        cls.root = Path(cls.temp.name)
        (cls.root / server.CASE_DIR_NAME).mkdir()
        cls.patch = patch.object(server, "share_root", lambda: cls.root)
        cls.patch.start()
        cls.http = server.Server(("127.0.0.1", 0), server.Handler)
        server.PORT = cls.http.server_address[1]
        cls.base = "http://127.0.0.1:" + str(server.PORT)
        cls.thread = threading.Thread(target=cls.http.serve_forever, daemon=True)
        cls.thread.start()

    @classmethod
    def tearDownClass(cls):
        cls.http.shutdown()
        cls.http.server_close()
        cls.patch.stop()
        cls.temp.cleanup()

    def request(self, path, body=None, headers=None):
        data = None if body is None else json.dumps(body).encode()
        h = {"Content-Type": "application/json", "X-DocWriter-Token": server.SESSION_TOKEN}
        h.update({"X-DocWriter-Token": server.SESSION_TOKEN})
        h.update(headers or {})
        req = urllib.request.Request(self.base + path, data=data, headers=h)
        try:
            with urllib.request.urlopen(req) as response:
                return response.status, json.loads(response.read())
        except urllib.error.HTTPError as error:
            return error.code, json.loads(error.read())

    def test_endpoints_and_static_privacy(self):
        for path in ["/server.py", "/share.txt", "/case_store.py", "/Reporting GIS/parcels.json".replace(" ", "%20")]:
            self.assertEqual(self.request(path)[0], 404)
        self.assertEqual(self.request("/dw-status", headers={"Origin": "https://example.com"})[0], 403)
        status, info = self.request("/dw-status")
        self.assertEqual(status, 200)
        self.assertTrue(info["caseStore"])

    def test_real_save_open_list_summary(self):
        status, saved = self.request("/cases/save", {"name": "101 TEST LANE - QA-001.json", "file": record()})
        self.assertEqual(status, 200)
        status, listed = self.request("/cases/list")
        self.assertEqual(len(listed["files"]), 1)
        self.assertEqual(self.request("/cases/open?name=101%20TEST%20LANE%20-%20QA-001.json")[1]["file"]["case"]["number"], "QA-001")
        self.assertEqual(
            self.request(
                "/cases/summary",
                {"name": saved["name"], "revision": saved["revision"], "summary": {"format": "madison-case-summary", "case": {"number": "QA-001"}}},
            )[0],
            200,
        )

    def test_invalid_payloads(self):
        self.assertEqual(self.request("/cases/save", [])[0], 400)
        self.assertEqual(self.request("/save-pdf", [])[0], 400)
        self.assertEqual(self.request("/cases/save", {}, headers={"Origin": "https://example.com"})[0], 403)


if __name__ == "__main__":
    unittest.main(verbosity=2)
