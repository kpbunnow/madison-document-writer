"""Weights and Measures order language (MGO Chapter 22), checked against the real bundled library and manifest.

The Chapter 22 text is supplied as a retained source; every Weights and Measures entry cites sections that exist in it;
the entries are drafts that a notice cannot issue until division review is recorded; a recorded review makes them
issuable; and the retained library is unchanged."""

import json
from pathlib import Path
import re
import tempfile
import unittest

import case_store
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

    def test_entries_are_division_review_drafts_with_fill_ins(self):
        found = entries()
        self.assertEqual(len(found), 23)
        self.assertEqual([c["name"] for c in library()][-1], "Weights and Measures")
        self.assertEqual(len({i["catalogId"] for _, i in found}), len(found))
        for key, item in found:
            with self.subTest(key=key):
                self.assertRegex(item["catalogId"], r"^WM\d{2}$")
                self.assertEqual((item["p"], item["provenance"]), ("draft", "draft"))
                self.assertNotIn("approval", item)
                self.assertIn("( )", item["a"])
                self.assertTrue(item["s"] and all(s.startswith("22.") for s in item["s"]))
                self.assertEqual(set(item["citationManualSections"]), set(item["s"]))
                self.assertIn("division review is required before selection", item["guidance"])

    def test_manifest_marks_every_entry_draft(self):
        manifest = json.loads((ROOT / "app/assets/catalog_manifest.json").read_text(encoding="utf-8"))["items"]
        for key, item in entries():
            self.assertEqual(manifest[key], {"draft": True, "ordinances": item["s"]})

    def test_notice_is_refused_until_division_review_then_issues(self):
        manifest_file = ROOT / "app/assets/catalog_manifest.json"
        with tempfile.TemporaryDirectory() as folder:
            reviews = Path(folder) / "reviews.json"
            for key, _ in entries():
                with self.subTest(key=key), self.assertRaisesRegex(ValueError, "needs division review"):
                    case_store.validate_catalog_publication(None, notice(key), reviews, manifest_file)
            key = entries()[4][0]
            review = {"key": key, "status": "approved", "id": "review-wm", "version": 1}
            reviews.write_text(json.dumps({"format": "madison-catalog-review", "events": [review]}), encoding="utf-8")
            case_store.validate_catalog_publication(None, notice(key, catalogReviewId="review-wm", catalogVersion=1), reviews, manifest_file)
            with self.assertRaisesRegex(ValueError, "needs division review"):
                case_store.validate_catalog_publication(None, notice(entries()[5][0]), reviews, manifest_file)

    def test_retained_library_is_unchanged(self):
        retained = [c for c in library() if c["code"] != CODE]
        identity = json.loads((ROOT / "tests/fixtures/reference/r32-library-identity.json").read_text(encoding="utf-8"))
        keys = {json.dumps([c["code"], g["code"], i["o"]], separators=(",", ":")) for c in retained for g in c["groups"] for i in g["items"]}
        self.assertEqual(keys, set(identity))
        self.assertFalse(any(re.match(r"^22\.", s) for c in retained for g in c["groups"] for i in g["items"] for s in i.get("s", [])))


if __name__ == "__main__":
    unittest.main()
