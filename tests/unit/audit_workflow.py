#!/usr/bin/env python3
"""Lifecycle gates against the actual file store, including racing atomic batches."""

import concurrent.futures
import copy
import tempfile
import unittest
from pathlib import Path
import case_store


def initial():
    k = {"id": "case_a", "number": "QA-LIFE", "address": "101 TEST LANE", "date": "2026-08-01", "owner": "SYNTHETIC OWNER"}
    item = {"id": "item_1", "no": "1", "sections": ["27.05(2)(c)"], "due": "2026-10-30", "done": False, "doneOn": ""}
    snap = {
        "id": "notice_1",
        "caseId": k["id"],
        "type": "notice",
        "mailed": "2026-08-01",
        "items": [item],
        "frozen": {"case": copy.deepcopy(k), "inspector": {"id": "inspector_1", "name": "QA INSPECTOR"}},
    }
    event = {
        "id": "issued_1",
        "at": "2026-08-01T15:00:00Z",
        "by": "inspector_1",
        "type": "notice.issued",
        "payload": {"docId": snap["id"], "snapshot": snap, "expectedHead": [], "lifecycle": 1},
    }
    return {"format": "madison-case-file", "schema": 3, "case": k, "inspectors": [], "events": [event]}


def followup(base, suffix="a", kind="extension", outcome="progress"):
    value = copy.deepcopy(base)
    src = base["events"][-1]["payload"]["snapshot"]
    rid = "visit_" + suffix
    did = "doc_" + suffix
    date = "2026-09-" + str((len(base["events"]) + 1) // 2).zfill(2)
    head = [e["id"] for e in base["events"] if case_store.record_event(e)]
    results = {
        i["id"]: {
            "oc": "corrected" if i.get("done") else outcome,
            "on": i.get("doneOn") or date,
            "carried": bool(i.get("done")),
            "due": "2026-10-30",
            "note": "Synthetic inspection note",
        }
        for i in src["items"]
    }
    visit = {
        "id": rid,
        "caseId": value["case"]["id"],
        "sourceDocId": src["id"],
        "date": date,
        "time": "10:00",
        "inspectorId": "inspector_1",
        "docId": did,
        "results": results,
    }
    event = {
        "id": "visit_event_" + suffix,
        "at": date + "T15:00:00Z",
        "by": "inspector_1",
        "type": "reinspection.recorded",
        "payload": {"reinspection": visit, "reinspId": rid, "sourceDocId": src["id"], "expectedHead": head, "lifecycle": 1},
    }
    snap = copy.deepcopy(src)
    snap.update(id=did, type=kind, mailed=date, inspDate=visit["date"], inspTime=visit["time"], fromDocId=src["id"], fromReinspId=rid)
    for n, (i, prior) in enumerate(zip(snap["items"], src["items"])):
        i.update(
            id="item_" + suffix + "_" + str(n),
            srcItemId=prior["id"],
            done=results[prior["id"]]["oc"] == "corrected",
            doneOn=results[prior["id"]]["on"] if results[prior["id"]]["oc"] == "corrected" else "",
        )
    if kind == "citation":
        snap["items"][0]["cite"] = True
        snap["cits"] = {snap["items"][0]["id"]: {"num": "QA-CIT-" + suffix, "issued": date}}
    action = {
        "id": "issued_" + suffix,
        "at": date + "T15:00:00.001Z",
        "by": "inspector_1",
        "type": kind + ".issued",
        "payload": {
            "docId": did,
            "snapshot": snap,
            "fromReinspId": rid,
            "fromDocId": src["id"],
            "expectedHead": sorted(head + [event["id"]]),
            "lifecycle": 1,
        },
    }
    value["events"] += [event, action]
    return value


class LifecycleStoreTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        self.name = "101 TEST LANE - QA-LIFE.json"
        self.base = initial()
        self.first = case_store.save_case(self.root, self.name, self.base)

    def tearDown(self):
        self.temp.cleanup()

    def save(self, value):
        return case_store.save_case(self.root, self.name, value, self.first["revision"], self.base["case"], value["events"][-1]["id"])

    def unchanged_after_rejection(self, value, message):
        with self.assertRaisesRegex(ValueError, message):
            self.save(value)
        self.assertEqual(case_store.read_case(self.root, self.name)["file"]["events"], self.base["events"])

    def test_all_five_followup_types_commit(self):
        for kind in ("extension", "citation", "referral", "compliance"):
            with self.subTest(kind=kind), tempfile.TemporaryDirectory() as folder:
                value = followup(self.base, kind, kind, "corrected" if kind == "compliance" else "noaccess")
                saved = case_store.save_case(Path(folder), self.name, value)
                self.assertEqual(len(saved["file"]["events"]), 3)
        referred = followup(self.base, "referral", "referral")
        updated = followup(referred, "update", "referralUpdate")
        self.assertEqual(len(self.save(updated)["file"]["events"]), 5)

    def test_racing_visits_and_documents_have_exactly_one_winner(self):
        left, right = followup(self.base, "left"), followup(self.base, "right")

        def attempt(value):
            try:
                return self.save(value)["ok"]
            except ValueError:
                return False

        with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
            results = list(pool.map(attempt, [left, right]))
        self.assertEqual(sorted(results), [False, True])
        saved = case_store.read_case(self.root, self.name)["file"]
        self.assertEqual(len(saved["events"]), 3)
        self.assertEqual(sum(e["type"] == "reinspection.recorded" for e in saved["events"]), 1)

    def test_lost_response_retry_keeps_one_batch_and_later_owner(self):
        value = followup(self.base)
        saved = self.save(value)
        later = copy.deepcopy(saved["file"])
        later["case"]["owner"] = "LATER REVIEWED OWNER"
        case_store.save_case(self.root, self.name, later, saved["revision"], saved["file"]["case"])
        for _ in range(3):
            result = self.save(value)
            self.assertTrue(result["alreadyCommitted"])
            self.assertEqual(len(result["file"]["events"]), 3)
            self.assertEqual(result["file"]["case"]["owner"], "LATER REVIEWED OWNER")

    def test_visit_is_not_committed_when_its_document_is_invalid(self):
        value = followup(self.base)
        value["events"][-1]["payload"]["snapshot"]["items"][0]["no"] = "2"
        self.unchanged_after_rejection(value, "numbering")

    def test_incomplete_outcomes_are_refused(self):
        value = followup(self.base)
        value["events"][-2]["payload"]["reinspection"]["results"] = {}
        self.unchanged_after_rejection(value, "outcome for every")

    def test_result_cannot_follow_visit_date(self):
        value = followup(self.base)
        value["events"][-2]["payload"]["reinspection"]["results"]["item_1"]["on"] = "2026-09-02"
        self.unchanged_after_rejection(value, "result date")

    def test_document_cannot_disagree_with_visit(self):
        value = followup(self.base)
        value["events"][-1]["payload"]["snapshot"]["items"][0].update(done=True, doneOn="2026-09-01")
        self.unchanged_after_rejection(value, "outcomes disagree")

    def test_mailing_and_due_date_bounds(self):
        for key, value, pattern in [("mailed", "2026-08-31", "mailing date"), ("due", "2026-09-01", "future due")]:
            candidate = followup(self.base)
            snap = candidate["events"][-1]["payload"]["snapshot"]
            if key == "mailed":
                snap[key] = value
            else:
                snap["items"][0][key] = value
            self.unchanged_after_rejection(candidate, pattern)

    def test_closed_case_cannot_gain_a_visit(self):
        closed = followup(self.base, "closed", "compliance", "corrected")
        candidate = followup(closed, "extra")
        self.unchanged_after_rejection(candidate, "current open case")

    def test_referred_case_cannot_return_to_extension(self):
        referred = followup(self.base, "ref", "referral")
        candidate = followup(referred, "extra", "extension")
        self.unchanged_after_rejection(candidate, "referral workflow")

    def test_prior_compliance_cannot_be_reopened_by_a_visit(self):
        mixed = followup(self.base, "mixed", "extension", "corrected")
        candidate = followup(mixed, "extra")
        result = candidate["events"][-2]["payload"]["reinspection"]["results"]["item_mixed_0"]
        result.update(oc="none", carried=False)
        self.unchanged_after_rejection(candidate, "Prior compliance")

    def test_incomplete_review_head_is_refused_on_import(self):
        candidate = followup(self.base)
        candidate["events"][-1]["payload"]["expectedHead"] = []
        with tempfile.TemporaryDirectory() as folder:
            with self.assertRaisesRegex(ValueError, "complete reviewed"):
                case_store.save_case(Path(folder), self.name, candidate)

    def test_second_original_notice_is_refused(self):
        candidate = copy.deepcopy(self.base)
        event = copy.deepcopy(candidate["events"][0])
        event.update(id="second_notice", at="2026-09-01T15:00:00Z")
        event["payload"].update(docId="notice_2", expectedHead=["issued_1"])
        event["payload"]["snapshot"]["id"] = "notice_2"
        candidate["events"].append(event)
        self.unchanged_after_rejection(candidate, "original notice already")

    def test_new_citation_number_cannot_repeat_earlier_action(self):
        cited = followup(self.base, "first", "citation")
        candidate = followup(cited, "second", "citation")
        snap = candidate["events"][-1]["payload"]["snapshot"]
        next(iter(snap["cits"].values()))["num"] = "QA-CIT-first"
        self.unchanged_after_rejection(candidate, "distinct citation")


if __name__ == "__main__":
    unittest.main(verbosity=2)
