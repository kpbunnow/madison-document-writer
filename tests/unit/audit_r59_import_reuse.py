#!/usr/bin/env python3
"""R59: the shared store refuses a new document that reuses an imported inspection already recorded in its case."""

import copy
import tempfile
import unittest
from pathlib import Path

import audit_workflow as workflow
import case_store

NAME = "101 TEST LANE - QA-LIFE.json"


def key(date, time="10:00", kind="reinspection"):
    return {"type": kind, "date": date, "time": time}


def imported(value, visit=None, document=None):
    """Attach import identities to the latest visit and document of a workflow.followup() value."""
    if visit is not None:
        value["events"][-2]["payload"]["reinspection"]["importInspection"] = visit
    if document is not None:
        value["events"][-1]["payload"]["snapshot"]["importInspection"] = document
    return value


def notice_citation_pair(group, identity):
    """An initial Official Notice and its companion citation saved in one request."""
    value = workflow.initial()
    notice = value["events"][0]
    notice["payload"]["snapshot"]["importInspection"] = identity
    snap = copy.deepcopy(notice["payload"]["snapshot"])
    snap.update(id="initial_citation", type="citation", fromDocId="notice_1", importInspection=identity)
    snap["items"] = [dict(snap["items"][0], id="cite_item", srcItemId="item_1", cite=True)]
    snap["cits"] = {"cite_item": {"num": "QA-CIT-INITIAL", "issued": snap["mailed"]}}
    if group:
        group = {"id": notice["id"], "noticeId": "notice_1", "citationId": "initial_citation"}
        notice["payload"]["snapshot"]["issuanceGroup"] = group
        snap["issuanceGroup"] = group
    value["events"].append(
        {
            "id": "issued_initial_citation",
            "at": "2026-08-01T15:00:00.001Z",
            "by": "inspector_1",
            "type": "citation.issued",
            "payload": {"docId": snap["id"], "snapshot": snap, "fromDocId": "notice_1", "expectedHead": [notice["id"]], "lifecycle": 1},
        }
    )
    return value


class ImportReuseStoreTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        self.base = workflow.initial()
        self.base["events"][0]["payload"]["snapshot"]["importInspection"] = key("2026-08-01", "", "initial")
        self.first = case_store.save_case(self.root, NAME, self.base)

    def tearDown(self):
        self.temp.cleanup()

    def save(self, value, previous=None):
        previous = previous or self.first
        return case_store.save_case(self.root, NAME, value, previous["revision"], previous["file"]["case"], value["events"][-1]["id"])

    def refused(self, value, previous=None, message="already been used"):
        before = case_store.read_case(self.root, NAME)["file"]["events"]
        with self.assertRaisesRegex(ValueError, message):
            self.save(value, previous)
        self.assertEqual(case_store.read_case(self.root, NAME)["file"]["events"], before)

    def committed_visit(self, identity=None):
        value = imported(workflow.followup(self.base, "a"), identity or key("2026-09-01"), identity or key("2026-09-01"))
        return value, self.save(value)

    def test_document_written_from_its_imported_visit_commits(self):
        _, saved = self.committed_visit()
        self.assertEqual(len(saved["file"]["events"]), 3)

    def test_reuse_refused_for_notice_citation_and_extension_documents(self):
        first, saved = self.committed_visit()
        for kind in ("extension", "citation"):
            with self.subTest(kind=kind):
                # A later visit with its own identity cannot issue a document that names the earlier inspection.
                self.refused(imported(workflow.followup(first, "b", kind), key("2026-09-02"), key("2026-09-01")), saved)
                # A legacy visit without an identity is keyed by its date and time, so it cannot carry it either.
                self.refused(imported(workflow.followup(first, "c", kind), None, key("2026-09-01")), saved)

    def test_second_notice_keeps_the_original_notice_rule(self):
        # A citation written directly from the notice is covered by test_initial_issuance_group_shares_its_inspection.
        notice = copy.deepcopy(self.base)
        event = copy.deepcopy(notice["events"][0])
        event.update(id="second_notice", at="2026-09-01T15:00:00Z")
        event["payload"].update(docId="notice_2", expectedHead=["issued_1"])
        event["payload"]["snapshot"]["id"] = "notice_2"
        notice["events"].append(event)
        self.refused(notice, None, "original notice already")

    def test_same_request_duplicate_is_refused(self):
        first = imported(workflow.followup(self.base, "a"), key("2026-09-01"), key("2026-09-01"))
        both = imported(workflow.followup(first, "b"), key("2026-09-02"), key("2026-09-01", ""))
        self.refused(both)

    def test_different_inspections_commit(self):
        first = imported(workflow.followup(self.base, "a"), key("2026-09-01"), key("2026-09-01"))
        both = imported(workflow.followup(first, "b", "citation"), key("2026-09-02"), key("2026-09-02"))
        self.assertEqual(len(self.save(both)["file"]["events"]), 5)

    def test_same_date_with_a_different_known_time_is_a_different_inspection(self):
        first, saved = self.committed_visit(key("2026-09-01", "09:00"))
        second = imported(workflow.followup(first, "b"), key("2026-09-01", "11:00"), key("2026-09-01", "11:00"))
        later = self.save(second, saved)
        self.assertEqual(len(later["file"]["events"]), 5)
        self.refused(imported(workflow.followup(second, "c"), key("2026-09-03", "11:00"), key("2026-09-01", "09:00")), later)

    def test_legacy_cases_without_import_identity_are_unaffected(self):
        legacy = workflow.initial()
        with tempfile.TemporaryDirectory() as folder:
            first = workflow.followup(legacy, "a")
            saved = case_store.save_case(Path(folder), NAME, workflow.followup(first, "b", "citation"))
            self.assertEqual(len(saved["file"]["events"]), 5)

    def test_initial_issuance_group_shares_its_inspection(self):
        identity = key("2026-08-01", "", "initial")
        with tempfile.TemporaryDirectory() as folder:
            saved = case_store.save_case(Path(folder), NAME, notice_citation_pair(True, identity))
            self.assertEqual(len(saved["file"]["events"]), 2)
        with tempfile.TemporaryDirectory() as folder, self.assertRaisesRegex(ValueError, "already been used"):
            case_store.save_case(Path(folder), NAME, notice_citation_pair(False, identity))

    def test_copied_initial_group_cannot_exempt_an_unrelated_followup(self):
        identity = key("2026-08-01", "", "initial")
        base = notice_citation_pair(True, identity)
        candidate = imported(workflow.followup(base, "unrelated"), key("2026-09-01"), identity)
        # The follow-up copied the companion citation's group. It is not that named citation.
        self.assertEqual(candidate["events"][-1]["payload"]["snapshot"]["issuanceGroup"], base["events"][0]["payload"]["snapshot"]["issuanceGroup"])
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            first = case_store.save_case(root, NAME, base)
            with self.assertRaisesRegex(ValueError, "already been used"):
                case_store.save_case(root, NAME, candidate, first["revision"], first["file"]["case"], candidate["events"][-1]["id"])
            self.assertEqual(case_store.read_case(root, NAME)["file"]["events"], base["events"])

    def test_arbitrary_matching_groups_do_not_exempt_document_reuse(self):
        first = imported(workflow.followup(self.base, "a"), key("2026-09-01"), key("2026-09-01"))
        first["events"][-1]["payload"]["snapshot"]["issuanceGroup"] = {"id": "unrelated-group"}
        saved = self.save(first)
        candidate = imported(workflow.followup(first, "b"), key("2026-09-02"), key("2026-09-01"))
        self.refused(candidate, saved)

    def test_ca_reinspection_visit_identity_is_accepted_and_not_reused(self):
        # A CA Reinspection import opens a worksheet keyed by its own type (inspectionIdentity uses row.typeKey).
        ca = key("2026-09-01", "10:00", "caReinspection")
        first, saved = self.committed_visit(ca)
        self.assertEqual(saved["file"]["events"][-2]["payload"]["reinspection"]["importInspection"], ca)
        # The same CA Reinspection cannot be recorded again by a later visit or named by a later document.
        self.refused(imported(workflow.followup(first, "b"), key("2026-09-01", "", "caReinspection"), key("2026-09-02")), saved)
        self.refused(imported(workflow.followup(first, "c", "citation"), key("2026-09-03"), ca), saved)
        # A Reinspection on the same date is a different inspection type and is not reuse.
        other = imported(workflow.followup(first, "d"), key("2026-09-01", "10:00"), key("2026-09-01", "10:00"))
        self.assertEqual(len(self.save(other, saved)["file"]["events"]), 5)

    def test_visit_identity_shape(self):
        for bad in (
            {"type": "initial", "date": "2026-09-01"},
            {"type": "caReinspection", "date": "09/01/2026"},
            {"type": "other", "date": "2026-09-01"},
        ):
            with self.subTest(identity=bad):
                self.refused(imported(workflow.followup(self.base, "a"), bad, None), None, "Invalid imported inspection identity")

    def test_exemptions_and_identity_shape(self):
        documents = {"doc_a": ({"id": "doc_a", "fromReinspId": "visit_a", "importInspection": key("2026-09-01")}, "issued_a")}
        visits = [{"id": "visit_a", "date": "2026-09-01", "time": "10:00", "importInspection": key("2026-09-01")}]

        def event(kind="noOccupancy.issued", **snap):
            return {"type": kind, "payload": {"snapshot": {"id": "new", **snap}}}

        # Another document written from the same visit, and any correction, keep that visit's identity.
        case_store.validate_document_import(event(fromReinspId="visit_a", importInspection=key("2026-09-01")), documents, visits)
        case_store.validate_document_import(event("correction.issued", importInspection=key("2026-09-01")), documents, visits)
        case_store.validate_document_import(event(), documents, visits)
        with self.assertRaisesRegex(ValueError, "already been used"):
            case_store.validate_document_import(event(fromReinspId="visit_b", importInspection=key("2026-09-01", "")), documents, visits)
        with self.assertRaisesRegex(ValueError, "Invalid imported inspection"):
            case_store.validate_document_import(event(importInspection={"type": "reinspection", "date": "09/01/2026"}), documents, visits)
        # A CA Reinspection identity is checked the same way as a Reinspection identity.
        ca = {"id": "visit_c", "date": "2026-09-05", "time": "", "importInspection": key("2026-09-05", "", "caReinspection")}
        case_store.validate_document_import(
            event(fromReinspId="visit_c", importInspection=key("2026-09-05", "", "caReinspection")), documents, [*visits, ca]
        )
        with self.assertRaisesRegex(ValueError, "already been used"):
            case_store.validate_document_import(event(importInspection=key("2026-09-05", "08:00", "caReinspection")), documents, [*visits, ca])


if __name__ == "__main__":
    unittest.main(verbosity=2)
