"""Reviewed data changes must need no runtime edits and invalid trees fail closed."""

import copy
import json
from pathlib import Path
import tempfile
import unittest
from compiler import compile_policy
import citation_pricing as p


class PolicyTests(unittest.TestCase):
    def test_boundaries_and_basis(self):
        self.assertEqual(p.policy_at("2026-07-15")["fees"]["courtRates"][-1]["cents"], 3800)
        self.assertEqual(p.court_cents("2026-08-01"), 4800)
        self.assertTrue(p.policy()["versionHash"])

    def test_invalid_ranges_sources_and_raw_text(self):
        import shutil

        for mutation in ("gap", "overlap", "source", "tier", "ledger"):
            with self.subTest(mutation=mutation), tempfile.TemporaryDirectory() as folder:
                root = Path(folder)
                shutil.copytree("policy", root / "policy")
                shutil.copytree("tests/fixtures/reference", root / "tests/fixtures/reference")
                (root / "app/assets").mkdir(parents=True, exist_ok=True)
                shutil.copyfile("app/assets/library.js", root / "app/assets/library.js")
                shutil.copyfile("app/assets/deposits.js", root / "app/assets/deposits.js")
                target = root / "policy/surcharges.json"
                d = json.loads(target.read_text())
                rows = d["court"]
                if mutation == "gap":
                    rows[1]["from"] = "2026-08-01"
                elif mutation == "overlap":
                    rows[1]["from"] = "2026-07-29"
                elif mutation == "source":
                    rows[1]["source"] = {}
                elif mutation == "ledger":
                    rows[0]["cents"] = 3700
                else:
                    target = root / "policy/schedule/27.json"
                    d = json.loads(target.read_text())
                    next(e for e in d if e["versions"][0]["status"] == "verified")["versions"][0]["tiers"][0]["amountCents"] += 1
                target.write_text(json.dumps(d))
                with self.assertRaises(ValueError):
                    compile_policy(root)

    def test_future_value_is_only_a_data_edit(self):
        import shutil

        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            shutil.copytree("policy", root / "policy")
            (root / "app/assets").mkdir(parents=True, exist_ok=True)
            shutil.copyfile("app/assets/library.js", root / "app/assets/library.js")
            shutil.copyfile("app/assets/deposits.js", root / "app/assets/deposits.js")
            shutil.copytree("tests/fixtures/reference", root / "tests/fixtures/reference")
            target = root / "policy/surcharges.json"
            d = json.loads(target.read_text())
            d["court"][-1]["to"] = "2026-12-31"
            v = copy.deepcopy(d["court"][-1])
            v.update(**{"from": "2027-01-01", "to": None, "cents": 5000})
            v["source"]["ordinance"] = "SYNTHETIC TEST ORD"
            v["review"] = {"reviewer": "Synthetic test reviewer", "date": "2026-10-11"}
            d["court"].append(v)
            target.write_text(json.dumps(d))
            (root / "policy/tests/future.yaml").write_text('- {ordinance: "27.05(2)(c)", tier: 1st, date: "2027-01-01", base: 10000, total: 19900}\n')
            compiled = compile_policy(root)
            self.assertEqual(compiled["parameters"]["court"][-1]["cents"], 5000)

    def test_docx_diff_is_review_only(self):
        from zipfile import ZipFile
        import xml.etree.ElementTree as ET
        from codification_diff import propose_export, NS

        before = Path("build/generated/citation_policy.json").read_bytes()
        rows = copy.deepcopy(json.loads(Path("tests/fixtures/reference/r30-schedule-table.json").read_text()))
        rows[1][2] = "$60"
        w = "{" + NS["w"] + "}"
        document = ET.Element(w + "document")
        table = ET.SubElement(document, w + "tbl")
        for row in rows:
            tr = ET.SubElement(table, w + "tr")
            for cell in row:
                tc = ET.SubElement(tr, w + "tc")
                para = ET.SubElement(tc, w + "p")
                run = ET.SubElement(para, w + "r")
                ET.SubElement(run, w + "t").text = cell
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / "synthetic.docx"
            with ZipFile(path, "w") as z:
                z.writestr("word/document.xml", ET.tostring(document))
            result = propose_export(path, {"3.16(8)(d)": {"effectiveDate": "2027-01-01", "ordinance": "SYNTHETIC TEST ORD"}}, "Synthetic test export")
        self.assertEqual(len(result["proposals"]), 1)
        version = result["proposals"][0]["version"]
        self.assertEqual(version["from"], "2027-01-01")
        self.assertEqual(version["status"], "manual-only")
        self.assertIsNone(version["review"])
        self.assertFalse(result["runtimeChanged"])
        self.assertEqual(Path("build/generated/citation_policy.json").read_bytes(), before)

    def test_correction_keeps_historical_basis(self):
        from audit_r28_helper import pair
        import case_store

        for priced_on, cost, total in [("2026-07-15", 38, "187.00"), ("2026-08-01", 48, "197.00")]:
            snap = pair()["events"][-1]["payload"]["snapshot"]
            snap.update(authoringVersion=7, inspDate="2026-07-01", inspTime="10:00", mailed="2026-10-11")
            snap["frozen"]["case"]["date"] = "2026-07-01"
            c = snap["cits"]["charged_item"]
            c.update(issued="2026-10-11", violDate="2026-07-01", cc=str(cost), amount=total, pricedOn=priced_on, policyVersionHash="1" * 64)
            original = copy.deepcopy(snap)
            original["cits"]["charged_item"]["issued"] = priced_on
            case_store.validate_authoring(snap, "2026-10-11T15:00:00Z", original=original)
            del c["pricedOn"]
            with self.assertRaises(ValueError):
                case_store.validate_authoring(snap, "2026-10-11T15:00:00Z", original=original)


if __name__ == "__main__":
    unittest.main()
