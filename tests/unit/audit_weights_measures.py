"""Weights and Measures order language (MGO Chapter 22), checked against the real bundled library and manifest.

The Chapter 22 text is supplied as a retained source; every Weights and Measures entry cites sections that exist in it;
the owner approved all 23 entries for selection on 2026-11-27, so a notice issues them without a catalog review; every
charge they cite is priced under the 22.21(2) deposit schedule row ($200 first, $500 second or subsequent); and the
retained library is unchanged."""

import json
from pathlib import Path
import re
import tempfile
import unittest

import case_store
import citation_pricing
import library_ordinances

ROOT = Path(__file__).resolve().parents[2]
CODE = "ENF_WEIGHTS_MEASURES"
SOURCE = ROOT / "policy/sources/r30-CHAPTER_22___CONSUMER_PROTECTION_AND_WEIGHTS_AND_MEASURES.txt"


def library():
    return json.loads((ROOT / "app/assets/library.js").read_text(encoding="utf-8").split("=", 1)[1].rsplit(";", 1)[0])


def checklist():
    return next(c for c in library() if c["code"] == CODE)


def entries():
    c = checklist()
    return [(json.dumps([CODE, g["code"], i["o"]], separators=(",", ":")), i) for g in c["groups"] for i in g["items"]]


def notice(key, **item):
    return {"events": [{"id": "n", "type": "notice.issued", "payload": {"snapshot": {"items": [{"libraryKey": key, **item}]}}}]}


class WeightsAndMeasures(unittest.TestCase):
    def test_chapter_source_is_clean_and_indexed(self):
        text = SOURCE.read_text(encoding="utf-8")
        self.assertTrue(text.startswith("CHAPTER 22 CONSUMER PROTECTION AND WEIGHTS AND MEASURES\n"))
        self.assertNotRegex(text, r"Created: 20|Page \d+ of \d+|Rev\. 28, Update 3|Code of Ordinances")
        index, _ = library_ordinances.chapter_index(SOURCE)
        for section in ["22.05(3)", "22.06(2)", "22.09", "22.11", "22.20(7)", "22.21(2)(a)", "22.21(2)(f)", "22.21(4)"]:
            self.assertIn(section, index)
        self.assertIn("seventy-two (72) hours", index["22.06(2)"])
        self.assertIn("NIST Handbook 44", index["22.09"])

    def test_every_section_is_confirmed_against_chapter_22(self):
        cited = {s for _, i in entries() for s in i["s"]}
        verdicts = {r["section"]: r for r in library_ordinances.audit(ROOT)}
        for section in cited:
            self.assertEqual(verdicts[section]["verdict"], "confirmed", section)
            self.assertEqual(verdicts[section]["source"], SOURCE.name)

    def test_entries_are_owner_approved_with_fill_ins(self):
        found = entries()
        self.assertEqual(len(found), 23)
        self.assertEqual([c["name"] for c in library()][-1], "Weights and Measures")
        self.assertEqual(len({i["catalogId"] for _, i in found}), len(found))
        for key, item in found:
            with self.subTest(key=key):
                self.assertRegex(item["catalogId"], r"^WM\d{2}$")
                self.assertEqual((item["p"], item["provenance"], item["status"]), ("export", "owner-approved", "Approved for selection"))
                self.assertIn("owner's direction on 2026-11-27", item["approval"])
                self.assertIn("( )", item["a"])
                self.assertTrue(item["s"] and all(s.startswith("22.") for s in item["s"]))
                self.assertEqual(set(item["citationManualSections"]), set(item["s"]))
                self.assertNotIn("division review", item["guidance"])

    def test_manifest_marks_every_entry_selectable(self):
        manifest = json.loads((ROOT / "app/assets/catalog_manifest.json").read_text(encoding="utf-8"))["items"]
        for key, item in entries():
            self.assertEqual(manifest[key], {"draft": False, "ordinances": item["s"]})

    def test_notice_issues_without_review_and_a_recorded_review_still_governs(self):
        manifest_file = ROOT / "app/assets/catalog_manifest.json"
        with tempfile.TemporaryDirectory() as folder:
            reviews = Path(folder) / "reviews.json"
            for key, _ in entries():
                with self.subTest(key=key):
                    case_store.validate_catalog_publication(None, notice(key), reviews, manifest_file)
            key = entries()[4][0]
            review = {"key": key, "status": "approved", "id": "review-wm", "version": 1}
            reviews.write_text(json.dumps({"format": "madison-catalog-review", "events": [review]}), encoding="utf-8")
            case_store.validate_catalog_publication(None, notice(key, catalogReviewId="review-wm", catalogVersion=1), reviews, manifest_file)
            with self.assertRaisesRegex(ValueError, "Catalog version changed"):
                case_store.validate_catalog_publication(None, notice(key), reviews, manifest_file)

    def test_every_charge_is_priced_under_22_21_2(self):
        policy = citation_pricing.policy()
        for key, item in entries():
            mapped = {m["chargedOrdinance"]: m for m in policy["itemMappings"][key]}
            self.assertEqual(set(mapped), set(item["s"]), key)
            for section in item["s"]:
                with self.subTest(key=key, section=section):
                    self.assertEqual((mapped[section]["scheduleOrdinance"], mapped[section]["status"]), ("22.21(2)", "calculated"))
                    entry = citation_pricing.resolve(section, key, at="2026-11-27")
                    self.assertTrue(citation_pricing.ready(entry))
                    self.assertEqual(entry["ordinance"], "22.21(2)")
                    self.assertEqual([citation_pricing.base_cents(entry, n) for n in (1, 2, 3)], [20000, 50000, 50000])

    def test_retained_library_is_unchanged(self):
        retained = [c for c in library() if c["code"] != CODE]
        identity = json.loads((ROOT / "tests/fixtures/reference/r32-library-identity.json").read_text(encoding="utf-8"))
        keys = {json.dumps([c["code"], g["code"], i["o"]], separators=(",", ":")) for c in retained for g in c["groups"] for i in g["items"]}
        self.assertEqual(keys, set(identity))
        self.assertFalse(any(re.match(r"^22\.", s) for c in retained for g in c["groups"] for i in g["items"] for s in i.get("s", [])))


if __name__ == "__main__":
    unittest.main()
