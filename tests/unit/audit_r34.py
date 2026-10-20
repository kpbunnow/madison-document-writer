"R34/R35: snow cover format 10, multiple citations per snow case, property matching and the generated install guide."

import copy
import os
import json
import re
import tempfile
import unittest
from pathlib import Path
from unittest import mock

import case_store
import citation_pricing as pricing
import snow_rules
from audit_r33_snow import snow_snapshot
from audit_r28_helper import pair

ROOT = Path(__file__).resolve().parents[2]


def v10(at="2026-01-05", tier=1, number_suffix="", inspection_time="11:46"):
    snap = snow_snapshot(at)
    snap["authoringVersion"] = 10
    snap["inspTime"] = inspection_time
    snap["frozen"]["case"]["time"] = inspection_time
    item = snap["items"][0]
    cit = snap["cits"][item["id"]]
    base = pricing.base_cents(pricing.resolve("10.28", at=at), tier)
    lines = pricing.assessment_cents(base, pricing.court_cents(at), at=at)
    cit.update(
        tier=pricing.tier_label(tier),
        base=str(base / 100),
        amount=f"{lines['total'] / 100:.2f}",
        assessments=lines,
        violTime=inspection_time,
        siteMatch=pricing.site_basis(snap["frozen"]["case"]),
    )
    if number_suffix:
        cit["num"] = cit["num"][: -len(number_suffix)] + number_suffix
    snap["snowInspectionId"] = snap["inspDate"] + "T" + snap["inspTime"]
    snap["frozen"]["snowLetter"] = snow_rules.read_letter()
    snap["frozen"]["snowCoverFormat"] = 10
    snap["frozen"]["snowCloseOnFiling"] = True
    snap["frozen"]["court"] = {"room": "RM#203,", "caseNumberLabel": "Building Inspection Case Number"}
    snap["frozen"]["body"] = snow_rules.cover_html(snap, snap["frozen"]["snowLetter"])
    cit["comment"] = snow_rules.comment(snap)
    return snap


def record_with(*snaps):
    record = copy.deepcopy(pair())
    record["schema"] = 5
    record["case"] = copy.deepcopy(snaps[0]["frozen"]["case"])
    events, head = [], []
    for n, snap in enumerate(snaps):
        event_id = "snow_issue_34_%d" % n
        events.append(
            {
                "id": event_id,
                "at": snap["mailed"] + "T17:50:00Z",
                "by": snap["frozen"]["inspector"]["id"],
                "type": "citation.issued",
                "payload": {"docId": snap["id"], "snapshot": snap, "expectedHead": head, "lifecycle": 1},
            }
        )
        head = [event_id]
    record["events"] = events
    return record


def second_inspection(first_at="2026-01-05", at="2026-01-06"):
    second = v10(at, tier=2, number_suffix="7", inspection_time="12:30")
    second["id"] = "second-snow-citation"
    second["snow"]["snowfallDate"] = first_at
    second["frozen"]["body"] = snow_rules.cover_html(second, second["frozen"]["snowLetter"])
    second["cits"][second["items"][0]["id"]]["comment"] = snow_rules.comment(second)
    return second


def save(record):
    with tempfile.TemporaryDirectory() as folder:
        root = Path(folder)
        return case_store.save_case(root, "101 TEST - " + record["case"]["number"] + ".json", record)


class R34(unittest.TestCase):
    def test_cover_format_10_structure_and_january_amounts(self):
        html = snow_rules.cover_html(v10(), snow_rules.read_letter())
        self.assertTrue(
            html.startswith(('<p class="snow-subject"><strong>Subject: Failure to Remove Snow and/or Ice from Public Sidewalk</strong></p>'))
        )
        self.assertIn("<strong>There are no warnings given for this Ordinance violation.</strong>", html)
        self.assertEqual(html.count('<p class="snow-para">'), 3)
        self.assertIn('<p class="snow-para snow-closing">', html)
        self.assertIn("<td><strong>If there is no sand, please call: Streets West: 266-4681</strong></td>", html)
        self.assertIn("<td><strong>or Streets East: 246-4532</strong></td>", html)
        self.assertEqual(html.count("<strong>"), 4)
        self.assertIn("$124.00", html)
        self.assertIn("$187.00", html)

    def test_authoring_9_and_r33_corrections_keep_the_old_cover(self):
        old = snow_snapshot()
        html = snow_rules.cover_html(old, snow_rules.read_letter())
        self.assertNotIn("snow-subject", html)
        self.assertNotIn("<strong>", html)
        correction = v10()
        correction["replaces"] = "r33-original"
        correction["frozen"].pop("snowCoverFormat")
        self.assertEqual(snow_rules.cover_format(correction), 9)
        correction["frozen"]["snowCoverFormat"] = 10
        self.assertEqual(snow_rules.cover_format(correction), 10)

    def test_helper_accepts_format_10_and_requires_it_for_new_citations(self):
        self.assertTrue(save(record_with(v10()))["ok"])
        for value in (None, 9):
            snap = v10()
            if value is None:
                snap["frozen"].pop("snowCoverFormat")
            else:
                snap["frozen"]["snowCoverFormat"] = value
            snap["frozen"]["body"] = snow_rules.cover_html(snap, snap["frozen"]["snowLetter"])
            with self.assertRaisesRegex(ValueError, "current cover format"):
                save(record_with(snap))

    def test_multiple_snow_citations_in_one_case(self):
        # R35: one snow case tracks the property through the season; each later snow event is cited in the same case.
        self.assertTrue(save(record_with(v10(), second_inspection()))["ok"])
        self.assertNotIn("snowOneCitationPerCase", pricing.policy())

    def test_r33_cases_with_two_snow_citations_still_validate(self):
        first = snow_snapshot()
        first["snowInspectionId"] = first["inspDate"] + "T" + first["inspTime"]
        first["frozen"].update(
            snowLetter=snow_rules.read_letter(),
            snowCloseOnFiling=True,
            court={"room": "RM#203,", "caseNumberLabel": "Building Inspection Case Number"},
        )
        first["frozen"]["body"] = snow_rules.cover_html(first, first["frozen"]["snowLetter"])
        first["cits"][first["items"][0]["id"]]["comment"] = snow_rules.comment(first)
        second = copy.deepcopy(first)
        second["id"] = "r33-second"
        second["inspDate"] = second["mailed"] = "2026-01-06"
        second["inspTime"] = "12:30"
        second["frozen"]["case"].update(date="2026-01-06", time="12:30")
        second["snowInspectionId"] = "2026-01-06T12:30"
        cit = second["cits"][second["items"][0]["id"]]
        cit["num"] = cit["num"][:-1] + "7"
        base = pricing.base_cents(pricing.resolve("10.28", at="2026-01-06"), 2)
        lines = pricing.assessment_cents(base, pricing.court_cents("2026-01-06"), at="2026-01-06")
        cit.update(
            issued="2026-01-06",
            violDate="2026-01-06",
            violTime="12:30",
            pricedOn="2026-01-06",
            tier="2nd",
            base=str(base / 100),
            amount=f"{lines['total'] / 100:.2f}",
            assessments=lines,
        )
        second["frozen"]["body"] = snow_rules.cover_html(second, second["frozen"]["snowLetter"])
        cit["comment"] = snow_rules.comment(second)
        self.assertTrue(save(record_with(first, second))["ok"])

    def test_site_match_is_recorded_and_checked(self):
        snap = v10()
        self.assertEqual(snap["cits"][snap["items"][0]["id"]]["siteMatch"], pricing.site_basis(snap["frozen"]["case"]))
        for value in (None, "unavailable"):
            bad = copy.deepcopy(snap)
            if value is None:
                bad["cits"][bad["items"][0]["id"]].pop("siteMatch")
            else:
                bad["cits"][bad["items"][0]["id"]]["siteMatch"] = value
            with self.assertRaisesRegex(ValueError, "how prior citations at this property were matched"):
                save(record_with(bad))

    def test_property_matching_without_parcel(self):
        self.assertEqual(pricing.property_key("2714 WILLARD AVE"), "2714 WILLARD AVE")
        self.assertEqual(pricing.property_key("2714 Willard Ave."), "2714 WILLARD AVE")
        self.assertEqual(pricing.property_key("2714 Willard Avenue, Madison WI 53704"), "2714 WILLARD AVE")
        self.assertEqual(pricing.property_key("LOT 5"), "")
        self.assertTrue(pricing.same_site({"address": "2714 WILLARD AVE"}, {"address": "2714 Willard Ave."}))
        self.assertTrue(pricing.same_site({"parcel": "070901234567", "address": "A"}, {"parcel": "0709-0123-4567", "address": "B"}))
        self.assertFalse(pricing.same_site({"parcel": "070901234567", "address": "1 A ST"}, {"parcel": "070901234568", "address": "1 A ST"}))
        self.assertTrue(pricing.same_site({"parcel": "070901234567", "address": "1 A ST"}, {"address": "1 A Street"}))
        self.assertEqual(pricing.site_basis({"parcel": "070901234567"}), "parcel")
        self.assertEqual(pricing.site_basis({"address": "2714 Willard Ave."}), "address")
        self.assertEqual(pricing.site_basis({"address": "UNKNOWN"}), "unavailable")
        entry = pricing.resolve("10.28", at="2026-01-06")
        prior = v10()
        prior["frozen"]["case"].update(parcel="", address="2714 WILLARD AVE")
        current = dict(prior["frozen"]["case"], address="2714 Willard Ave.", number="QA-OTHER")
        counted = pricing.prior_offenses(entry, current, "2026-01-06", [{"case": prior["frozen"]["case"], "document": prior}])
        self.assertEqual(len(counted), 1)

    def test_generated_install_guide(self):
        guide = (ROOT / "build/generated/DEPLOY.md").read_text()
        release = (ROOT / "build/generated/RELEASE").read_text().strip()
        helper = json.loads((ROOT / "version.json").read_text())["helperVersion"]
        self.assertIn("Release **" + release + "**", guide)
        self.assertIn("helper **" + helper + "**", guide)
        self.assertEqual(set(re.findall(r"\bR\d{2,3}\b", guide.replace("R51-ACCEPTANCE-RECORD.md", "City acceptance record"))), {release.split()[-1]})
        self.assertEqual(set(re.findall(r"\b20\d\d\.\d\d\.\d\d\.\d+\b", guide)), {helper})
        self.assertNotIn("{{", guide)
        self.assertIn("Python 3.10–3.14", guide)
        self.assertNotIn("snowOneCitationPerCase", guide)
        self.assertTrue((Path(os.environ["DW_REPO_ROOT"]) / "CHANGELOG.md").read_text().startswith("# Release changelog"))
        anchor = json.loads((ROOT / "app/assets/integrity-settings.example.json").read_text())["anchorFolder"]
        self.assertTrue(anchor.startswith("\\\\"))


if __name__ == "__main__":
    unittest.main()
