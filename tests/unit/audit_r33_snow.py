"""Snow timing, required facts, seasonal pricing and immutable letter content."""

import copy
from datetime import date
import unittest
import tempfile
import json
from pathlib import Path
import case_store
import citation_pricing as pricing
from audit_r28_helper import pair


def snow_snapshot(at="2026-01-05"):
    snap = copy.deepcopy(pair()["events"][-1]["payload"]["snapshot"])
    snap["authoringVersion"] = 9
    snap["caseType"] = "snow-10.28"
    snap["type"] = "citation"
    snap["mailed"] = at
    snap["inspDate"] = at
    snap["inspTime"] = "11:46"
    snap.pop("issuanceGroup", None)
    snap.pop("fromDocId", None)
    snap.pop("fromReinspId", None)
    snap["frozen"]["case"].update(caseType="snow-10.28", date=at, time="11:46")
    snap["snow"] = {"snowfallDate": "2026-01-01", "inches": 0.8, "condition": "snow covered", "photographed": True, "cornerNotCleared": False}
    item = snap["items"][0]
    item.update(
        sections=["10.28"],
        libraryKey='["ENF_PM_PROPMAINT","SNOW",1]',
        text="Failure to remove snow and or ice from public sidewalk",
        due=None,
        dueExempt="snow-10.28",
        cite=True,
    )
    cit = snap["cits"][item["id"]]
    base = pricing.base_cents(pricing.resolve("10.28", at=at), 1)
    cost = pricing.court_cents(at)
    lines = pricing.assessment_cents(base, cost, at=at)
    cit.update(
        ord="10.28",
        issued=at,
        violDate=at,
        violTime="11:46",
        pricedOn=at,
        policyVersionHash=pricing.policy()["versionHash"],
        base=str(base / 100),
        cc=str(cost / 100),
        amount=f"{lines['total'] / 100:.2f}",
        assessments=lines,
        depositMode="schedule",
        tier="1st",
        desc="SNOW & ICE REMOVAL FROM SIDEWALK VIOLATION",
        courtDate="2026-12-30",
    )
    return snap


class R33Snow(unittest.TestCase):
    def test_required_facts_and_noon_deadline(self):
        import snow_rules

        snap = snow_snapshot()
        snow_rules.validate_snapshot(snap)
        snap["inspDate"] = "2026-01-02"
        snap["inspTime"] = "11:59"
        with self.assertRaisesRegex(ValueError, "until noon on 01/02/2026"):
            snow_rules.validate_snapshot(snap)
        snap["inspTime"] = "12:00"
        snow_rules.validate_snapshot(snap)
        snap["snow"]["photographed"] = False
        with self.assertRaisesRegex(ValueError, "photograph"):
            snow_rules.validate_snapshot(snap)

    def test_season_boundary_and_property_count(self):
        e = pricing.resolve("10.28", at="2026-10-12")
        self.assertEqual(e["window"]["kind"], "site-season")
        self.assertTrue(pricing.within_window("2025-07-01", "2026-06-30", e["window"]))
        self.assertFalse(pricing.within_window("2026-06-30", "2026-07-01", e["window"]))
        snap = snow_snapshot()
        case = snap["frozen"]["case"]
        other = copy.deepcopy(snap)
        other["frozen"]["case"]["owner"] = "A DIFFERENT OWNER"
        counted = pricing.prior_offenses(e, case, "2026-01-06", [{"case": other["frozen"]["case"], "document": other}])
        self.assertEqual(len(counted), 1)
        self.assertTrue(counted[0]["differentOwner"])
        self.assertEqual(pricing.prior_offenses(e, case, "2026-07-01", [{"case": other["frozen"]["case"], "document": other}]), [])
        next_season = pricing.resolve("10.28", at="2027-07-01")
        self.assertEqual(
            pricing.assessment_cents(pricing.base_cents(next_season, 1), pricing.court_cents("2027-07-01"), at="2027-07-01")["total"], 13400
        )

    def test_cover_amounts_and_comment(self):
        import snow_rules

        old = snow_snapshot()
        current = snow_snapshot("2026-10-12")
        for snap, first, later in [(old, "$124.00", "$187.00"), (current, "$134.00", "$197.00")]:
            html = snow_rules.cover_html(snap, snow_rules.read_letter())
            self.assertIn(first, html)
            self.assertIn(later, html)
            self.assertNotIn("reinspection", html.lower())
            self.assertIn("NewBridge", html)
        self.assertEqual(snow_rules.comment(old), "On 01/01/2026, 0.8 inches of snow fell. Inspection found the public sidewalk snow covered.")
        old["snow"]["inches"] = 1
        self.assertIn("1 inch of snow", snow_rules.comment(old))

    def test_real_helper_accepts_snow_without_notice_and_rejects_wrong_letter(self):
        import snow_rules

        record = copy.deepcopy(pair())
        record["schema"] = 5
        snap = snow_snapshot()
        snap["snowInspectionId"] = snap["inspDate"] + "T" + snap["inspTime"]
        snap["frozen"]["snowLetter"] = snow_rules.read_letter()
        snap["frozen"]["body"] = snow_rules.cover_html(snap, snap["frozen"]["snowLetter"])
        snap["frozen"]["snowCloseOnFiling"] = True
        snap["frozen"]["court"] = {"room": "RM#203,", "caseNumberLabel": "Building Inspection Case Number"}
        snap["cits"][snap["items"][0]["id"]]["comment"] = snow_rules.comment(snap)
        record["case"] = copy.deepcopy(snap["frozen"]["case"])
        record["events"] = [
            {
                "id": "snow_issue_33",
                "at": "2026-01-05T17:50:00Z",
                "by": snap["frozen"]["inspector"]["id"],
                "type": "citation.issued",
                "payload": {"docId": snap["id"], "snapshot": snap, "expectedHead": [], "lifecycle": 1},
            }
        ]
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            name = "101 TEST - " + record["case"]["number"] + ".json"
            result = case_store.save_case(root, name, record)
            self.assertTrue(result["ok"])
            self.assertTrue(__import__("case_integrity").verify_record(result["file"])["valid"])
            self.assertEqual(len(result["file"]["events"]), 1)
            bad = copy.deepcopy(record)
            bad["events"][0]["payload"]["snapshot"]["frozen"]["body"] = "Hardcoded incorrect snow letter."
            with tempfile.TemporaryDirectory() as other:
                with self.assertRaisesRegex(ValueError, "Snow cover wording"):
                    case_store.save_case(Path(other), name, bad)
            for mutation in ("mixed", "due", "case-type", "duplicate"):
                bad = copy.deepcopy(record)
                snapshot = bad["events"][0]["payload"]["snapshot"]
                if mutation == "mixed":
                    snapshot["items"].append({**snapshot["items"][0], "id": "extra", "no": "2"})
                elif mutation == "due":
                    snapshot["items"][0]["due"] = "2026-01-30"
                elif mutation == "case-type":
                    bad["case"].pop("caseType")
                else:
                    duplicate = copy.deepcopy(bad["events"][0])
                    duplicate["id"] = "duplicate-snow"
                    duplicate["payload"]["snapshot"]["id"] = "another-snow"
                    duplicate["payload"]["expectedHead"] = ["snow_issue_33"]
                    bad["events"].append(duplicate)
                with tempfile.TemporaryDirectory() as other:
                    with self.assertRaises(ValueError):
                        case_store.save_case(Path(other), name, bad)

            shared = root / "_administration/snow_letter.json"
            shared.parent.mkdir(exist_ok=True)
            letter = snow_rules.read_letter()
            letter["closing"] = "New administrator-reviewed content"
            shared.write_text(json.dumps(letter))
            # Existing issued bytes stay saveable after seasonal content changes.
            case_store.save_case(root, name, result["file"])


if __name__ == "__main__":
    unittest.main()
