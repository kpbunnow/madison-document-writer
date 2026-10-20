"""R26 gates through the actual atomic store; no production records."""

import copy
import hashlib
import json
from pathlib import Path
import tempfile
import unittest
import case_store
from audit_workflow import initial, followup
import audit_authoring as authoring_fixtures

REVIEW = dict(
    scope="building",
    reviewer="QA reviewer",
    reviewRef="SYNTHETIC QA ONLY ordinance, wording and procedure approval",
    codeSource="https://example.invalid/synthetic-qa-code",
    codeRevision="SYNTHETIC QA code revision and amendment review",
    reviewDateLegal="2026-09-01",
    reviewed=True,
    authority="27.05(3)(b)4",
    signerName="QA Director",
    signerTitle="Director",
    delegation="SYNTHETIC QA authority record",
)


def special(kind="summaryAbatement", variant="junk"):
    base = initial()
    base["schema"] = 4
    value = followup(base, "r26", kind)
    snap = value["events"][-1]["payload"]["snapshot"]
    snap["authoringVersion"] = 4
    snap["special"] = {
        **REVIEW,
        "variant": variant,
        "findings": "Specific observed condition at north entry.",
        "work": "Remove the nuisance.",
        "summaryBasis": "Specific reviewed immediate danger.",
        "orderDue": "2026-09-15",
        "servicePlan": "Reviewed plan; actual service not yet recorded.",
        "remedyReviewed": True,
        "forestryRef": "QA tree assessment",
        "securingConditions": "Reviewed openings, animals and material removal.",
        "boarding": True,
        "boardingRef": "QA prior written boarding approval",
    }
    return value


def append_action(value, kind, facts, administrative=False):
    value = copy.deepcopy(value)
    head = sorted(e["id"] for e in value["events"] if case_store.record_event(e))
    base = value["events"][0]["payload"]["snapshot"]
    old = value["events"][-1]["payload"]["snapshot"]
    snap = copy.deepcopy(old)
    count = len(value["events"])
    snap.update(id="extra_" + str(count), type=kind, authoringVersion=4)
    snap["special"] = {**REVIEW, **facts}
    if administrative:
        old = next(
            e["payload"]["snapshot"]
            for e in reversed(value["events"])
            if e.get("payload", {}).get("snapshot", {}).get("type") not in case_store.SUPPLEMENTAL_TYPES and e.get("payload", {}).get("snapshot")
        )
        snap.update(
            administrativeAction=True,
            fromDocId=old["id"],
            inspDate=old.get("inspDate") or old["frozen"]["case"]["date"],
            inspTime=old.get("inspTime", ""),
        )
        snap.pop("fromReinspId", None)
        snap["items"] = [dict(copy.deepcopy(i), id="item_extra_" + str(count) + "_" + str(n), srcItemId=i["id"]) for n, i in enumerate(old["items"])]
    else:
        snap["fromDocId"] = base["id"]
        snap["items"] = [
            dict(copy.deepcopy(i), id="item_extra_" + str(count) + "_" + str(n), srcItemId=p["id"])
            for n, (i, p) in enumerate(zip(old["items"], base["items"]))
        ]
    event = {
        "id": "extra_event_" + str(count),
        "at": "2026-09-01T15:00:00." + str(count).zfill(3) + "Z",
        "by": "inspector_1",
        "type": kind + ".issued",
        "payload": {"snapshot": snap, "docId": snap["id"], "expectedHead": head, "lifecycle": 1},
    }
    value["events"].append(event)
    return value


class R26StoreTests(unittest.TestCase):
    def save(self, value):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            return case_store.save_case(root, "101 TEST LANE - QA-LIFE.json", value)["file"]

    def test_all_abatement_variants_without_ordinary_dates(self):
        for kind in ("summaryAbatement", "nonSummaryAbatement"):
            for variant in ("junk", "sidewalk", "tree", *(["secure"] if kind == "summaryAbatement" else [])):
                with self.subTest(kind=kind, variant=variant):
                    self.assertEqual(len(self.save(special(kind, variant))["events"]), 3)

    def test_missing_required_fields_cannot_bypass_ui(self):
        for key in (
            "reviewer",
            "authority",
            "reviewRef",
            "codeSource",
            "codeRevision",
            "signerName",
            "signerTitle",
            "delegation",
            "summaryBasis",
            "work",
            "findings",
        ):
            value = special()
            value["events"][-1]["payload"]["snapshot"]["special"].pop(key)
            with self.subTest(key=key), self.assertRaises(ValueError):
                self.save(value)
        for key, change in [("reviewed", False), ("reviewDateLegal", "2026-09-02"), ("variant", "unknown"), ("work", "Remove ( )")]:
            value = special()
            value["events"][-1]["payload"]["snapshot"]["special"][key] = change
            with self.subTest(key=key), self.assertRaises(ValueError):
                self.save(value)

    def test_administrative_actions_preserve_supplemental_inspection_compliance(self):
        base = initial()
        base["schema"] = 4
        base["events"][0]["payload"]["snapshot"]["items"].append(dict(base["events"][0]["payload"]["snapshot"]["items"][0], id="item_2", no="2"))
        value = followup(base, "carry", "summaryAbatement")
        visit = value["events"][-2]["payload"]["reinspection"]
        visit["results"]["item_1"].update(oc="corrected", on=visit["date"])
        order = value["events"][-1]["payload"]["snapshot"]
        order.update(authoringVersion=4, special=special()["events"][-1]["payload"]["snapshot"]["special"])
        order["items"][0].update(done=True, doneOn=visit["date"])
        self.save(value)
        facts = dict(
            affected=["2"],
            originalDues={"1": "2026-10-30", "2": "2026-10-30"},
            noSafety=True,
            safetyBasis="Reviewed no safety items",
            noticeRef="QA original notice",
            reason="Reviewed benefit",
            intentions="Owner plan",
            supervisor="QA supervisor",
            stage="administrative",
        )
        action = append_action(value, "bestInterestExtension", facts, True)
        snap = action["events"][-1]["payload"]["snapshot"]
        snap.update(factualVisitId=visit["id"], inspectorId=visit["inspectorId"], inspDate=visit["date"], inspTime=visit["time"])
        snap["items"][0].update(done=True, doneOn=visit["date"])
        snap["items"][1]["due"] = "2026-11-15"
        self.save(action)
        snap["items"][0].update(done=False, doneOn="")
        with self.assertRaisesRegex(ValueError, "preserve recorded compliance"):
            self.save(action)

    def test_requires_schema_and_atomic_lifecycle(self):
        for mutate in ("schema", "lifecycle", "authoringVersion"):
            value = special()
            if mutate == "schema":
                value["schema"] = 3
            elif mutate == "lifecycle":
                value["events"][-1]["payload"].pop("lifecycle")
            else:
                value["events"][-1]["payload"]["snapshot"]["authoringVersion"] = 0
            with self.subTest(mutate=mutate), self.assertRaises(ValueError):
                self.save(value)

    def test_one_visit_multiple_orders_and_one_primary(self):
        value = special()
        value = append_action(
            value,
            "noOccupancy",
            dict(
                mode="restrict",
                scope="unit",
                unit="A-2",
                posting="posted",
                postedDate="2026-09-01",
                effective="2026-09-01",
                findings="Unsafe habitation.",
                releaseConditions="Correct defects and obtain written approval.",
            ),
        )
        value = append_action(value, "extension", {})
        self.assertEqual(sum(e["type"] == "reinspection.recorded" for e in self.save(value)["events"]), 1)
        invalid = append_action(
            value,
            "bestInterestExtension",
            dict(
                affected=["1"],
                originalDues={"1": "2026-10-30"},
                noSafety=True,
                safetyBasis="Reviewed no safety items",
                noticeRef="QA original notice",
                reason="Documented City and owner benefit",
                intentions="Repair plan",
                supervisor="QA supervisor",
                stage="administrative",
            ),
        )
        invalid["events"][-1]["payload"]["snapshot"]["items"][0]["due"] = "2026-11-15"
        with self.assertRaises(ValueError):
            self.save(invalid)

    def test_supplemental_action_cannot_replace_deadlines_or_drop_items(self):
        for mutate in ("due", "items"):
            value = special()
            snap = value["events"][-1]["payload"]["snapshot"]
            if mutate == "due":
                snap["items"][0]["due"] = "2027-01-01"
            else:
                snap["items"] = []
            with self.subTest(mutate=mutate), self.assertRaises(ValueError):
                self.save(value)

    def test_initial_emergency_with_no_fake_items_or_visit(self):
        value = special()
        snap = value["events"][-1]["payload"]["snapshot"]
        snap.update(initialAction=True, items=[], mailed="2026-08-01")
        snap.pop("fromReinspId")
        snap.pop("fromDocId")
        snap.pop("inspDate")
        snap["special"]["reviewDateLegal"] = "2026-08-01"
        ev = value["events"][-1]
        ev["at"] = "2026-08-01T15:00:00Z"
        ev["payload"]["expectedHead"] = []
        value["events"] = [ev]
        self.assertEqual(len(self.save(value)["events"]), 1)

    def test_no_occupancy_requires_truthful_posting_and_explicit_scoped_release(self):
        value = special()
        value = append_action(
            value,
            "noOccupancy",
            dict(
                mode="restrict",
                scope="unit",
                unit="A",
                posting="pending",
                prePostingRef="QA pre-posting procedure",
                effective="2026-09-01",
                findings="Unsafe habitation.",
                releaseConditions="Reviewed release conditions.",
            ),
        )
        self.save(value)
        old = value["events"][-1]["payload"]["snapshot"]["id"]
        facts = dict(
            mode="release",
            scope="unit",
            unit="A",
            releases=old,
            effective="2026-09-01",
            releaseInspection="2026-09-01",
            releaseFacts="QA reinspection and corrected conditions",
            placardRemoved=True,
            removalDate="2026-09-01",
            releaseFormRef="QA approved written release procedure",
            releaseVisitId="visit_r26",
        )
        released = append_action(value, "noOccupancy", facts, True)
        self.save(released)
        for key, change in [("unit", "B"), ("releases", "missing"), ("placardRemoved", False), ("releaseInspection", "2026-08-01")]:
            wrong = copy.deepcopy(released)
            wrong["events"][-1]["payload"]["snapshot"]["special"][key] = change
            with self.subTest(key=key), self.assertRaises(ValueError):
                self.save(wrong)

    def test_extensions_preserve_unselected_items_and_review_dates(self):
        for kind in ("bestInterestExtension", "vacancyExtension"):
            value = special(kind)
            s = value["events"][-1]["payload"]["snapshot"]
            s["items"][0]["due"] = "2026-11-15"
            s["special"] = {
                **REVIEW,
                "affected": ["1"],
                "originalDues": {"1": "2026-10-30"},
                "noSafety": True,
                "safetyBasis": "Reviewed nonurgent repairs only",
                "noticeRef": "QA original notice",
                "reason": "Reviewed benefit",
                "intentions": "Owner repair plan",
                "supervisor": "QA supervisor",
                "stage": "administrative",
                "vacancyFacts": "Vacancy verified",
                "requestRef": "QA request",
                "conditions": "Stay vacant and maintain exterior",
                "reviewDate": "2026-10-15",
                "deadlineMode": "dated",
                "expiryMode": "review",
                "expiryPolicyRef": "QA review policy",
                "transferClause": "QA reviewed applicable transfer and disclosure conditions",
            }
            self.save(value)
            s["special"]["noSafety"] = False
            with self.assertRaises(ValueError):
                self.save(value)

    def test_referral_guard_only_scoped_reviewed_exception(self):
        base = followup(initial(), "ref", "referral")
        base["schema"] = 4
        value = append_action(base, "summaryAbatement", special()["events"][-1]["payload"]["snapshot"]["special"], True)
        with self.assertRaises(ValueError):
            self.save(value)
        s = value["events"][-1]["payload"]["snapshot"]["special"]
        s.update(emergencyApproved=True, referralCoordination="QA approved City Attorney coordination")
        self.save(value)

    def test_service_evidence_separate_and_correctable(self):
        value = special("nonSummaryAbatement")
        head = [e["id"] for e in value["events"]]
        did = value["events"][-1]["payload"]["snapshot"]["id"]
        event = {
            "id": "service_1",
            "at": "2026-09-01T16:00:00Z",
            "by": "inspector_1",
            "type": "document.served",
            "payload": {
                "docId": did,
                "method": "service",
                "date": "2026-09-01",
                "reference": "QA completed service record",
                "expectedHead": head,
                "lifecycle": 1,
            },
        }
        value["events"].append(event)
        self.save(value)
        event["payload"]["date"] = "2026-09-02"
        with self.assertRaises(ValueError):
            self.save(value)

    def test_external_release_inspection_is_real_scoped_and_counted_once(self):
        value = special()
        value = append_action(
            value,
            "noOccupancy",
            dict(
                mode="restrict",
                scope="building",
                posting="posted",
                postedDate="2026-09-01",
                effective="2026-09-01",
                findings="Unsafe habitation.",
                releaseConditions="Reviewed release conditions.",
            ),
        )
        restriction = value["events"][-1]["payload"]["snapshot"]["id"]
        facts = dict(
            mode="release",
            scope="building",
            releases=restriction,
            effective="2026-09-02",
            releaseInspection="2026-09-02",
            releaseFacts="Verified external reinspection confirms all conditions",
            placardRemoved=True,
            removalDate="2026-09-02",
            releaseFormRef="Approved written release form",
            releaseVisitId="external",
            verifiedReleaseVisitId="release_visit",
            releaseInspectionRef="QA verified external inspection record",
            releaseInspectorId="inspector_1",
        )
        released = append_action(value, "noOccupancy", facts, True)
        action = released["events"].pop()
        head = [e["id"] for e in released["events"]]
        visit = dict(
            id="release_visit",
            caseId=value["case"]["id"],
            sourceDocId=restriction,
            purpose="occupancyRelease",
            date="2026-09-02",
            inspectorId="inspector_1",
            inspectionReference=facts["releaseInspectionRef"],
            scope="building",
            unit="",
            results={},
        )
        ev = dict(
            id="release_visit_event",
            at="2026-09-02T15:00:00Z",
            by="inspector_1",
            type="reinspection.recorded",
            payload=dict(reinspection=visit, expectedHead=head, lifecycle=1),
        )
        released["events"].append(ev)
        action["at"] = "2026-09-02T15:00:00.001Z"
        action["payload"]["expectedHead"] = head + [ev["id"]]
        action["payload"]["snapshot"]["mailed"] = "2026-09-02"
        released["events"].append(action)
        saved = self.save(released)
        self.assertEqual(sum(e["type"] == "reinspection.recorded" for e in saved["events"]), 2)
        visit["scope"] = "unit"
        with self.assertRaises(ValueError):
            self.save(released)

    def test_schema_downgrade_and_stale_second_action_keep_first_record(self):
        value = special()
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            name = "101 TEST LANE - QA-LIFE.json"
            first = case_store.save_case(root, name, value)
            old = copy.deepcopy(value)
            old["schema"] = 3
            with self.assertRaisesRegex(ValueError, "newer schema"):
                case_store.save_case(root, name, old, first["revision"], value["case"])
            second = append_action(value, "nonSummaryAbatement", special("nonSummaryAbatement")["events"][-1]["payload"]["snapshot"]["special"])
            second["events"][-1]["payload"]["expectedHead"] = []
            with self.assertRaises(ValueError):
                case_store.save_case(root, name, second, first["revision"], value["case"])
            self.assertEqual(case_store.read_case(root, name)["file"]["events"], value["events"])

    def test_correction_cannot_convert_restriction_into_an_extension(self):
        value = special()
        value = append_action(
            value,
            "noOccupancy",
            dict(
                mode="restrict",
                scope="building",
                posting="posted",
                postedDate="2026-09-01",
                effective="2026-09-01",
                findings="Unsafe habitation.",
                releaseConditions="Reviewed release conditions.",
            ),
        )
        original = value["events"][-1]
        snap = copy.deepcopy(original["payload"]["snapshot"])
        old = snap["id"]
        snap.update(
            id="wrong_correction",
            type="extension",
            revision=dict(number=1, rootId=old, targetId=old, externalReference="QA division amendment instructions"),
        )
        ev = dict(
            id="wrong_correction_event",
            at="2026-09-01T17:00:00Z",
            by="inspector_1",
            type="correction.issued",
            payload=dict(
                docId=snap["id"],
                snapshot=snap,
                replaces=old,
                baseEventId=original["id"],
                expectedHead=[e["id"] for e in value["events"]],
                reason="Synthetic attempted type conversion",
                changes=[{"field": "type"}],
                reviewedAt="2026-09-01T17:00:00Z",
            ),
        )
        value["events"].append(ev)
        with self.assertRaisesRegex(ValueError, "cannot change document type"):
            self.save(value)

    def test_historical_chicago_evening_citation_remains_saveable(self):
        value = authoring_fixtures.AuthoringStoreTests().citation()
        value["events"][-1]["at"] = "2026-09-02T02:00:00Z"
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            name = "101 TEST LANE - QA-LIFE.json"
            raw = json.dumps(value).encode()
            (root / name).write_bytes(raw)
            incoming = copy.deepcopy(value)
            incoming["case"]["owner"] = "UPDATED OWNER"
            result = case_store.save_case(root, name, incoming, hashlib.sha256(raw).hexdigest(), value["case"])
            self.assertEqual(result["file"]["events"], value["events"])


if __name__ == "__main__":
    unittest.main(verbosity=2)
