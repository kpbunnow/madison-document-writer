"""R33 corruption, library identity and measured row regressions."""

import copy
import json
from pathlib import Path
import tempfile
import unittest
import case_store
import case_integrity
from audit_r28_helper import pair

ROOT = Path(__file__).resolve().parents[2]


class R33Core(unittest.TestCase):
    def test_registry_json_shapes_fail_closed(self):
        for value in ([], 0, "x", None, {"format": "other"}):
            with self.subTest(value=value), tempfile.TemporaryDirectory() as folder:
                root = Path(folder)
                record = pair()
                record["schema"] = 5
                name = "101 TEST - " + record["case"]["number"] + ".json"
                saved = case_store.save_case(root, name, record)["file"]
                (root / "_integrity/migrated.json").write_text(json.dumps(value))
                result = case_store.read_case(root, name)["integrity"]
                self.assertFalse(result["valid"])
                self.assertEqual(result["label"], "Migration registry is damaged; contact an administrator")
                with self.assertRaisesRegex(ValueError, "Migration registry is damaged"):
                    case_store.save_case(root, name, copy.deepcopy(saved))
                self.assertIn("Migration registry is damaged", case_integrity.anchor_health(root))

    def test_reviewed_library_sections_preserve_identity(self):
        def items(root):
            lib = json.loads((root / "app/assets/library.js").read_text().split("=", 1)[1].rsplit(";", 1)[0])
            return {json.dumps([c["code"], g["code"], i["o"]], separators=(",", ":")): i for c in lib for g in c["groups"] for i in g["items"]}

        current = items(ROOT)
        old = json.loads((ROOT / "tests/fixtures/reference/r32-library-identity.json").read_text())
        self.assertEqual(set(current), set(old))
        for key, sections in [
            (["ENF_PM_PROPMAINT", "OTHER", 748], ["27.05(3)(a)"]),
            (["ENF_PM_PROPMAINT", "ROW", 820], ["27.05(3)(a)"]),
            (["ENF_PM_PROPMAINT", "ROW", 880], ["27.05(3)(a)"]),
            (["ENF_CONST_NOPERMIT", "NOPERMIT", 55], ["29.07(1)"]),
            (["ENF_ORDER_CATALOG", "PERMITS_AND_APPROVALS", 106], ["29.07(1)"]),
            (["ENF_ZONE", "LAWNPARKING", 10], ["28.141(8)(a)"]),
            (["ENF_ORDER_CATALOG", "ELECTRICAL_AND_LIGHTING", 38], ["29.36(3)"]),
        ]:
            self.assertEqual(current[json.dumps(key, separators=(",", ":"))]["s"], sections)

    def test_helper_refuses_wrong_building_size_row(self):
        import citation_pricing as pricing

        snap = copy.deepcopy(pair()["events"][-1]["payload"]["snapshot"])
        snap["authoringVersion"] = 9
        snap["frozen"]["case"].update(owner="SYNTHETIC SIZE OWNER", ownerAddr=["101 TEST LN", "MADISON WI 53703"])
        item = snap["items"][0]
        item["sections"] = ["29.40(4)(b)"]
        c = snap["cits"][item["id"]]
        rows = [e for e in pricing.policy_at(c["issued"])["entries"] if e["ordinance"] == "29.40(4)(b)"]
        small = next(e for e in rows if e["sizeBand"] == "small")
        large = next(e for e in rows if e["sizeBand"] == "large")
        c.update(
            ord="29.40(4)(b)",
            scheduleEntryId=small["id"],
            measurements={"area": 200000, "days": 400},
            base="10000.00",
            amount="12761.00",
            pricedOn=c["issued"],
            policyVersionHash=pricing.policy()["versionHash"],
        )
        with self.assertRaisesRegex(ValueError, "matching building-size"):
            pricing.validate_pricing(snap, [])
        c["scheduleEntryId"] = large["id"]
        pricing.validate_pricing(snap, [])

    def test_chapter_audit_rejects_an_invented_paragraph(self):
        from library_ordinances import audit

        lib = json.loads((ROOT / "app/assets/library.js").read_text().split("=", 1)[1].rsplit(";", 1)[0])
        audit(ROOT, lib)
        lib[0]["groups"][0]["items"][0]["s"] = ["27.05(99)(z)"]
        with self.assertRaisesRegex(ValueError, "absent"):
            audit(ROOT, lib)


if __name__ == "__main__":
    unittest.main()
