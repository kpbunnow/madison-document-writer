"""Cross-runtime outcomes from the actual browser/helper owners; shared data is not shared validation."""

import copy
import datetime
import json
from pathlib import Path
import random
import subprocess
import unittest
import case_store as store
import citation_pricing as pricing
import server

ROOT = Path(__file__).resolve().parents[2]


def browser(value):
    result = subprocess.run(
        ["node", "tests/fixtures/policy_bridge.cjs"], input=json.dumps(value), cwd=ROOT, capture_output=True, encoding="utf-8", timeout=60
    )
    if result.returncode:
        raise AssertionError(result.stderr)
    return json.loads(result.stdout)


class PolicyMirrors(unittest.TestCase):
    def test_parcel_site_and_mailing_unicode_boundaries(self):
        whitespace = ["", " ", "\t", "\n", "\u00a0", "\u2003", "\ufeff", "\u0085", "\x1c"]
        parcels = [None, False, 0, "０７０８２２２１９１０３", "٠٧٠٨٢٢٢١٩١٠٣", "0708-222-1910-3"]
        parcels += ["070822" + w + "219103" for w in whitespace]
        sites = [[{"parcel": p, "address": "1 First ST"}, {"parcel": p, "address": "2 Other ST"}] for p in parcels]
        mailing = [[w + "7105 COLONY DR" + w, "7105 COLONY DR", "MADISON, WI 53717"] for w in whitespace]
        mailing += [["PO BOX 4", "Agent", "P.O. BOX 4", "MADISON WI 53703"], ["100 TEST ST", "2ND FLOOR", "Agent", "2ND FLOOR", "MADISON WI 53703"]]
        actual = browser({"parcels": parcels, "sites": sites, "mailing": mailing})
        self.assertEqual([[pricing.normalized_parcel(p), pricing.site_basis({"parcel": p})] for p in parcels], actual["parcels"])
        self.assertEqual([pricing.same_site(*pair) for pair in sites], actual["sites"])
        self.assertEqual([store._clean_owner_address(lines) for lines in mailing], actual["mailing"])

    def test_calendar_and_new_due_spacing(self):
        dates = ["2024-02-29", "2025-02-29", "2026-02-31", "1900-02-29", "2000-02-29", "2026-11-14", "bad", "", None]
        calendar = [
            {"type": kind, "at": at}
            for kind in ["notice", "citation", "extension"]
            for at in [
                "2026-01-01T01:00:00Z",
                "2026-03-08T07:59:59Z",
                "2026-03-08T08:00:00Z",
                "2026-11-01T06:59:59Z",
                "2026-11-01T07:00:00Z",
                "2026-12-31T23:59:59Z",
            ]
        ]
        rng = random.Random(5514)
        due = []
        for n in range(400):
            due.append(
                [
                    {
                        "id": str(i),
                        "due": (datetime.date(2026, 11, 1) + datetime.timedelta(days=rng.randrange(22))).isoformat(),
                        "done": i == 0 and n % 3 == 0,
                        "withdrawn": i == 1 and n % 5 == 0,
                    }
                    for i in range(3)
                ]
            )
        actual = browser({"dates": dates, "calendar": calendar, "due": due})
        self.assertEqual([store.calendar_date(d) for d in dates], actual["dates"])
        self.assertEqual(
            [[str(store.city_day(row["at"])), store.mailing_max_day(row["type"], row["at"]), store.mailing_message(row["type"])] for row in calendar],
            actual["calendar"],
        )
        results = []
        for items in due:
            try:
                store._validate_due_spacing(snap={"type": "notice"}, items=items, original=None)
                results.append(False)
            except ValueError:
                results.append(True)
        self.assertEqual(results, actual["due"])
        # Existing correction exceptions retain an unchanged close-spaced pair; changing a due date does not.
        items = [{"id": "a", "due": "2026-11-01"}, {"id": "b", "due": "2026-11-02"}]
        store._validate_due_spacing(snap={"type": "notice"}, items=items, original={"items": copy.deepcopy(items)})
        with self.assertRaises(ValueError):
            store._validate_due_spacing(snap={"type": "notice"}, items=items, original={"items": []})

    def test_historical_current_pricing_and_mandatory_hold(self):
        requests = []
        for at in ["2026-10-10", "2026-10-11", "2026-11-14"]:
            for entry in pricing.policy_at(at)["entries"]:
                measurements = {f["key"]: False if f.get("boolean") else f.get("min", 0) for f in entry.get("measurements", [])}
                for tier in [1, 2, 3]:
                    requests.append({"ordinance": entry["ordinance"], "entryId": entry["id"], "date": at, "tier": tier, "measurements": measurements})
        actual = browser({"pricing": requests})["pricing"]
        checked = mandatory = 0
        for req, got in zip(requests, actual):
            entry = pricing.resolve(req["ordinance"], entry_id=req["entryId"], at=req["date"])
            if got.get("mandatoryAppearance"):
                self.assertEqual((entry.get("rule") or {}).get("kind"), "mandatory")
                self.assertEqual(got["amount"], "")
                server.validate_draft_deposits(
                    {
                        "cits": {
                            "i": dict(ord=req["ordinance"], scheduleEntryId=req["entryId"], pricedOn=req["date"], mandatoryAppearance=True, amount="")
                        }
                    }
                )
                mandatory += 1
            elif got.get("kind") == "priced":
                base = pricing.base_cents(entry, req["tier"], req["measurements"])
                self.assertIsNotNone(base)
                lines = pricing.assessment_cents(base, pricing.court_cents(req["date"]), at=req["date"])
                self.assertEqual(got["assessments"], lines, req)
                checked += 1
        self.assertGreater(checked, 1000)
        self.assertGreater(mandatory, 0)
        with self.assertRaises(ValueError):
            server.validate_draft_deposits({"cits": {"i": {"ord": "27.05(2)(c)", "mandatoryAppearance": True, "amount": ""}}})

    def test_recovery_envelope_complements_restore_validation(self):
        backup = {
            "format": "madison-draft-recovery",
            "version": 1,
            "workspace": "synthetic",
            "case": "import",
            "bundle": {"cases": [], "docs": [], "reinsp": [], "events": {}, "work": {"recordForms": {}}, "pending": []},
            "pending": [],
        }
        rows = []
        for field, values in [("format", ["wrong"]), ("version", [0, 2]), ("workspace", ["other"]), ("case", ["other"])]:
            for value in values:
                altered = copy.deepcopy(backup)
                altered[field] = value
                rows.append(altered)
        rows.insert(0, backup)
        actual = browser({"recovery": [{"backup": b, "row": {"workspace": "synthetic", "case": "import"}} for b in rows]})["recovery"]
        for b, expected in zip(rows, actual):
            try:
                server._checked_backup({"workspace": "synthetic", "case": "import", "backup": b})
                accepted = True
            except ValueError:
                accepted = False
            self.assertEqual(accepted, expected)
        self.assertTrue(actual[0])
        self.assertFalse(any(actual[1:]))


if __name__ == "__main__":
    unittest.main()
