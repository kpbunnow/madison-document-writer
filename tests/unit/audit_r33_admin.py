"""Administrator authorization is required for exceptional determined deposits."""

import copy
from pathlib import Path
import tempfile
import unittest
import citation_pricing
from audit_r28_helper import pair


class R33Administration(unittest.TestCase):
    def test_override_requires_named_confirmed_administration_and_receipt(self):
        import admin_rules

        snap = copy.deepcopy(pair()["events"][-1]["payload"]["snapshot"])
        snap["authoringVersion"] = 9
        c = snap["cits"]["charged_item"]
        c.update(pricedOn=c["issued"], policyVersionHash=citation_pricing.policy()["versionHash"])
        request = {
            "caseNumber": snap["frozen"]["case"]["number"],
            "citationNumber": c["num"],
            "ordinance": c["ord"],
            "pricingDate": c["issued"],
            "tier": c.get("tier", "1st"),
            "mode": "total",
            "amount": "245.67",
            "administrator": "Synthetic Administrator",
            "reason": "Court instruction supplies an exceptional approved cash deposit.",
            "sourceReference": "Court order QA-33",
            "confirmed": True,
        }
        with tempfile.TemporaryDirectory() as folder:
            for key, value in [("administrator", ""), ("reason", "too short"), ("sourceReference", ""), ("confirmed", False)]:
                bad = {**request, key: value}
                with self.assertRaises(ValueError):
                    admin_rules.authorize_override(Path(folder), bad)
            result = admin_rules.authorize_override(Path(folder), request)
            c.update(depositMode="total", amount="245.67", depositSource=request["reason"], overrideBasis=result["overrideBasis"])
            c.pop("assessments", None)
            admin_rules.verify_override(Path(folder), snap, c)
            citation_pricing.validate_pricing(snap, [])
            bad = copy.deepcopy(c)
            bad["amount"] = "246.67"
            with self.assertRaises(ValueError):
                admin_rules.verify_override(Path(folder), snap, bad)
            with tempfile.TemporaryDirectory() as other:
                with self.assertRaises(ValueError):
                    admin_rules.verify_override(Path(other), snap, c)


if __name__ == "__main__":
    unittest.main()
