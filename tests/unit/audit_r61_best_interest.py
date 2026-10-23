"""R61 Best Interest helper rules: explicit safety confirmation, no fabricated review."""

from copy import deepcopy
import unittest

import case_store
import case_projection


class BestInterestRules(unittest.TestCase):
    def fixture(self):
        return {
            "type": "bestInterestExtension",
            "authoringVersion": 15,
            "mailed": "2026-10-23",
            "inspDate": "2026-10-22",
            "items": [
                {"id": "a", "no": "1", "due": "2026-11-12"},
                {"id": "b", "no": "2", "due": "2026-11-20"},
            ],
            "special": {
                "reason": "The contractor repair plan supports additional time.",
                "noSafety": True,
                "affected": ["1"],
                "originalDues": {"1": "2026-10-01", "2": "2026-11-20"},
            },
        }

    def validate(self, snap):
        case_store.validate_special_fields(snap, "2026-10-23T15:00:00Z")

    def test_new_format_needs_reason_and_explicit_safety_confirmation(self):
        snap = self.fixture()
        saved = deepcopy(snap)
        self.validate(snap)
        self.assertEqual(snap, saved, "validation never fabricates review or signer facts")
        for value in (False, None, "true", 1):
            snap = self.fixture()
            snap["special"]["noSafety"] = value
            with self.assertRaisesRegex(ValueError, "exclude reviewed safety"):
                self.validate(snap)
        for value in ("", " ", None, "◯"):
            snap = self.fixture()
            snap["special"]["reason"] = value
            with self.assertRaisesRegex(ValueError, "reason"):
                self.validate(snap)

    def test_deadlines_and_item_scope_remain_enforced(self):
        for mutate, message in (
            (lambda s: s["items"][0].update(due="2026-10-23"), "later future"),
            (lambda s: s["items"][1].update(due="2026-11-27"), "Unselected"),
            (lambda s: s["items"][0].update(done=True), "outstanding"),
            (lambda s: s["items"][0].update(withdrawn=True), "outstanding"),
            (lambda s: s["special"].update(affected=["1", "1"]), "affected"),
            (lambda s: s["special"].update(affected=[]), "affected"),
        ):
            snap = self.fixture()
            mutate(snap)
            with self.assertRaisesRegex(ValueError, message):
                self.validate(snap)

    def test_legacy_classification_preserves_known_display_alias(self):
        library, _ = case_projection.tables()
        for category in library["library"]:
            for group in category["groups"]:
                for entry in group["items"]:
                    if "27.05(2)(g)2" not in entry.get("s", []):
                        continue
                    item = {"title": entry["t"], "sections": entry["s"]}
                    current = case_projection.violation_type(item)
                    if current["how"] != "matched":
                        continue
                    item["sections"] = ["27.05(2)(g)2." if section == "27.05(2)(g)2" else section for section in entry["s"]]
                    self.assertEqual(case_projection.violation_type(item), current)
                    return
        self.fail("No unique normalized catalog entry exercised")

    def test_other_families_and_old_versions_keep_review_requirements(self):
        for kind, version in (("bestInterestExtension", 14), ("bestInterestExtension", 13), ("vacancyExtension", 15), ("noOccupancy", 15)):
            snap = self.fixture()
            snap.update(type=kind, authoringVersion=version)
            with self.assertRaisesRegex(ValueError, "reviewer"):
                self.validate(snap)


if __name__ == "__main__":
    unittest.main()
