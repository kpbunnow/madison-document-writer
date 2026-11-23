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

    def test_actual_browser_frozen_mailing_passes_helper(self):
        cases = [
            {"owner": w + "SYNTHETIC OWNER" + w, "ownerAddr": [w + "100 TEST ST" + w, w + "100 TEST ST" + w, "MADISON WI 53703"]}
            for w in ["", "\ufeff", "\u0085", "\x1c", "\u00a0"]
        ]
        lines = browser({"frozenMailing": cases})["frozenMailing"]
        for case, frozen in zip(cases, lines):
            self.assertIsNotNone(frozen)
            snap = {"frozen": {"case": case, "ownerMailingLines": frozen}}
            store._validate_owner_mailing_lines(snap)
            corrupted = copy.deepcopy(snap)
            corrupted["frozen"]["ownerMailingLines"] = frozen[:-1]
            with self.assertRaises(ValueError):
                store._validate_owner_mailing_lines(corrupted)
        # Older issued ownerCopyLines retained adjacent-only cleanup, not today's full street deduplication.
        old = {
            "owner": "\ufeffSYNTHETIC OWNER",
            "ownerAddr": ["\ufeff100 TEST ST", "100 TEST ST", "MADISON WI 53703"],
            "ccList": [{"kind": "Violator", "name": "SYNTHETIC"}],
        }
        store._validate_owner_copy_lines({"frozen": {"case": old, "ownerCopyLines": ["SYNTHETIC OWNER", "100 TEST ST", "MADISON WI 53703"]}})

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
            if (entry.get("rule") or {}).get("kind") == "mandatory":
                self.assertTrue(got.get("mandatoryAppearance"), req)
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
            elif (base := pricing.base_cents(entry, req["tier"], req["measurements"])) is not None:
                self.assertEqual(got.get("kind"), "priced", req)
                self.assertFalse(got.get("mandatoryAppearance"), req)
                lines = pricing.assessment_cents(base, pricing.court_cents(req["date"]), at=req["date"])
                self.assertEqual(got["assessments"], lines, req)
                checked += 1
            else:
                self.assertIn(got.get("kind"), ["needs-basis", "needs-measurement"], req)
                self.assertFalse(got.get("mandatoryAppearance"), req)
        self.assertEqual(len(requests), len(actual))
        self.assertGreater(checked, 1000)
        self.assertGreater(mandatory, 0)
        with self.assertRaises(ValueError):
            server.validate_draft_deposits({"cits": {"i": {"ord": "27.05(2)(c)", "mandatoryAppearance": True, "amount": ""}}})

    def test_ordinance_tier_money_and_window_text_parse_identically(self):
        # Found by differential fuzzing: the runtimes' \\s and \\d classes differ (U+0085, U+FEFF, U+001C-U+001F, non-ASCII
        # digits), so a pasted ordinance, tier or amount could be accepted by one runtime and refused by the other.
        rng = random.Random(8817)
        spaces = ["", " ", "\t", "\n", "\u00a0", "\u2003", "\u3000", "\ufeff", "\u0085", "\x1c", "\x1f", "\u200b", "\u2028"]
        prefixes = ["", "MGO ", "M.G.O.", "Sec. ", "Section", "\u00a7 ", "MGO MGO "]
        ordinances = sorted({e["ordinance"] for e in pricing.policy()["entries"]})
        texts = ["27.05(2)(c)", "27.05\u0085(2)(c)", "\ufeff27.05(2)(c)", "SPS 321.125", "\u0662\u0667.05(2)(c)", "２７.05(2)(c)"]
        for _ in range(1500):
            o = rng.choice(ordinances)
            if rng.random() < 0.3:
                o = o.replace("(", rng.choice(spaces) + "(")
            texts.append(rng.choice(spaces) + rng.choice(prefixes) + rng.choice([o, o.upper(), o.rstrip(".")]) + rng.choice(spaces))
        tiers = [1, 2, 0, -1, 2.7, "2", " 2", "+3", "-2", "02", "3rd", "\u0662", "\ufeff2", "\u00852", "\x1c2", "\u20032", "x", None, True]
        money = ["0", "5", "5.5", "5.50", "5.505", "05", "1,000", "1e3", "-1", " 1", "1\u0661\u0660", "\u0661", "1\uff10", 5, 1.5, True]
        day = "2026-11-14"
        windows = [
            {"prior": prior, "violation": violation, "window": window}
            for prior in ["2026-02-28", "2026-02-30", "2026-13-01", "2025-11-14", "2025-11-13", "bad"]
            for violation in [day, "2026-02-30", "2026-13-01"]
            for window in ["permanent", {"years": 1}, {"months": 18}, {"kind": "site-season"}]
        ]
        actual = browser({"ordinances": texts, "tiers": tiers, "cents": money, "windows": windows})
        self.assertEqual([pricing.canonical_ordinance(t) for t in texts], actual["ordinances"])
        self.assertEqual(pricing.canonical_ordinance("\ufeff27.05\u0085(2)(C)"), "27.05(2)(c)")
        self.assertEqual(pricing.canonical_ordinance("\u0662\u0667.05(2)(c)"), "")
        self.assertEqual([pricing.ordinal(t) for t in tiers], actual["tiers"])
        self.assertEqual([pricing.cents(v) for v in money], actual["cents"])
        self.assertIsNone(pricing.cents("1\u0661\u0660"))
        self.assertEqual([pricing.within_window(w["prior"], w["violation"], w["window"]) for w in windows], actual["windows"])

    def test_schedule_and_window_boundaries_agree_across_runtimes(self):
        # Generated mutation testing showed the browser's boundary comparisons were not checked against the helper's.
        at = "2026-11-14"
        rows = {e["id"]: e for e in pricing.policy_at(at)["entries"]}
        measured = [
            (o, i, m)
            for o, i, values in [
                ("10.185(6)(a)2.", "mgo-row-173-10.185(6)(a)2.", [{"percent": v} for v in [0, 0.99, 1, 10, 10.01, 20, 20.01, 100, 100.01]]),
                ("10.185(6)(b)", "mgo-row-174-10.185(6)(b)", [{"tons": v} for v in [0, 0.99, 1, 2, 2.01, -1]]),
                ("8.14(2)(c)2.", "mgo-row-34-8.14(2)(c)2.", [{"fee": v} for v in [0, 20, 20.03, 20.05, 50, 50.05, 500]]),
                ("10.101(7)(b)", "mgo-row-165-10.101(7)(b)", [{"diameter": v} for v in [0, 1, 10, 10.5]]),
                ("23.24(3)", "mgo-row-364-23.24(3)", [{"diameter": v} for v in [1, 3, 4, 12]]),
                (
                    "10.05(11)(d)1.",
                    "mgo-row-149-10.05(11)(d)1.",
                    [
                        {"removed": False},
                        {"removed": False, "diameter": 0},
                        {"removed": True, "diameter": 10},
                        {"removed": True},
                        {"removed": True, "diameter": 10.5},
                    ],
                ),
                (
                    "29.40(4)(b)",
                    "mgo-row-498-29.40(4)(b)",
                    [{"area": a, "days": d} for a in [99999.99, 100000] for d in [364, 365, 364.5]],
                ),
            ]
            for m in values
        ]
        requests = [{"ordinance": o, "entryId": i, "date": at, "tier": 1, "measurements": m} for o, i, m in measured]
        fees = pricing.fees_at(at)
        # Half-cent rounding edges for both percentages, including bases large enough that 1% jail exceeds its minimum.
        edges = [*range(1, 400), *range(fees["jailMinimumCents"], fees["jailMinimumCents"] + 400)]
        bases = sorted(
            {
                b
                for p in (fees["penaltyPercent"], fees["jailPercent"])
                for k in edges
                for b in [(100 * k + 50) // p, (100 * k + 49) // p, (100 * k + 51) // p]
                if b > 0
            }
        )
        assessments = [{"base": b, "court": pricing.court_cents(at), "date": at} for b in bases]
        windows = [
            {"prior": prior, "violation": violation, "window": window}
            for prior, violation, window in [
                ("2026-07-01", "2026-07-01", {"kind": "site-season", "startMonthDay": "07-01"}),
                ("2026-06-30", "2026-07-01", {"kind": "site-season", "startMonthDay": "07-01"}),
                ("2025-07-01", "2026-06-30", {"kind": "site-season"}),
                ("2025-06-30", "2026-06-30", {"kind": "site-season"}),
                ("2025-03-31", "2026-03-31", {"months": 12}),
                ("2025-03-30", "2026-03-31", {"months": 12}),
                ("2023-02-28", "2024-02-29", {"years": 1}),
                ("2023-02-27", "2024-02-29", {"years": 1}),
                ("2025-02-28", "2026-08-31", {"months": 18}),
                ("2025-02-27", "2026-08-31", {"months": 18}),
                ("2026-12-01", "2026-11-30", {"years": 5}),
                ("0001-01-01", "2026-11-30", "permanent"),
                ("0000-12-31", "2026-11-30", "permanent"),
            ]
        ]
        lines = ["100 Test Street", "MADISON WI 53703"]
        parsed = {"accepted": True, "acceptedLines": lines, "ownerKey": "STANDARDIZED|53703"}
        respondents = [
            {"ownerAddr": lines},
            {"ownerAddr": lines, "ownerAddressParsed": parsed},
            {"ownerAddr": ["1 A ST", "MADISON WI 53703"], "ownerAddressParsed": parsed},
            {"ownerAddr": ["MADISON WI 53703"]},
            {"ownerAddr": ["100 TEST ST", "MADISON WI"]},
            {"ownerAddr": ["C/O AGENT", "P.O. Box 12", "MADISON WI 53703-1234"]},
            {"ownerAddr": ["100 TEST ST #4", "", "MADISON WI 53703 "]},
            {},
        ]
        sites = [
            [{"address": "100 Test Street, Madison"}, {"address": "100 TEST ST"}],
            [{"address": "ONE MAIN"}, {"address": " one main "}],
            [{"address": "100 TEST ST"}, {"address": "102 TEST ST"}],
            [{"address": ""}, {"address": ""}],
            [{"address": "100 TEST ST"}, {"address": "ONE MAIN"}],
            [{"parcel": "070900000001", "address": "100 TEST ST"}, {"address": "100 Test Street"}],
            [{"parcel": "070900000001", "address": "100 TEST ST"}, {"parcel": "070900000002", "address": "100 TEST ST"}],
        ]
        actual = browser({"pricing": requests, "assessments": assessments, "windows": windows, "respondents": respondents, "sites": sites})
        for request, got in zip(requests, actual["pricing"]):
            base = pricing.base_cents(rows[request["entryId"]], 1, request["measurements"])
            if request["entryId"].endswith("29.40(4)(b)") and request["measurements"]["area"] >= 100000:
                base = pricing.base_cents(rows["mgo-row-497-29.40(4)(b)"], 1, request["measurements"])
            with self.subTest(request=request):
                self.assertEqual((got.get("assessments") or {}).get("base"), base)
        self.assertEqual([pricing.assessment_cents(a["base"], a["court"], at=at) for a in assessments], actual["assessments"])
        self.assertEqual([pricing.within_window(w["prior"], w["violation"], w["window"]) for w in windows], actual["windows"])
        self.assertEqual([pricing.respondent_key(k) for k in respondents], actual["respondents"])
        self.assertEqual([pricing.same_site(*pair) for pair in sites], actual["sites"])

    def test_due_conflicts_name_their_dates_and_items_and_sorting_is_stable(self):
        rng = random.Random(2311)
        notices = []
        for _ in range(300):
            notices.append(
                [
                    {
                        "id": str(i),
                        "due": (datetime.date(2026, 12, 1) + datetime.timedelta(days=rng.randrange(30))).isoformat(),
                        "group": rng.choice(["", "", "Kitchen"]),
                    }
                    for i in range(rng.randint(0, 8))
                ]
            )
        actual = browser({"dueConflicts": notices, "dueOrder": notices})
        for items, conflicts, order in zip(notices, actual["dueConflicts"], actual["dueOrder"]):
            dates = sorted({i["due"] for i in items})
            expected = [
                [[a, b], [i["id"] for i in items if i["due"] == a] + [i["id"] for i in items if i["due"] == b]]
                for a, b in zip(dates, dates[1:])
                if (datetime.date.fromisoformat(b) - datetime.date.fromisoformat(a)).days < 7
            ]
            self.assertEqual(conflicts, expected, items)
            runs, start = [], 0
            while start < len(items):
                end = start
                while end < len(items) and items[end]["group"].strip() == items[start]["group"].strip():
                    end += 1
                runs += sorted(items[start:end], key=lambda i: i["due"])  # Python's sort is stable: equal dates keep their order
                start = end
            self.assertEqual(order, [i["id"] for i in runs], items)

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
