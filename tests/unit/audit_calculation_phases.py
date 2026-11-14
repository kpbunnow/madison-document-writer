"""Pricing and projection calculations preserve historical and malformed-input semantics."""

import copy
import hashlib
import json
from pathlib import Path
import random
import types
import unittest
import citation_pricing as pricing
import case_projection as projection

ROOT = Path(__file__).resolve().parents[2]
PRICING_PATH = ROOT / "tests/fixtures/pricing_calculations_reference.py.txt"
PRICING_CODE = compile(PRICING_PATH.read_text(), str(PRICING_PATH), "exec")


def pricing_outcome(name, args, reference=False, stop=None):
    namespace = dict(vars(pricing))
    for key, fn in vars(pricing).items():
        if isinstance(fn, types.FunctionType) and fn.__module__ == "citation_pricing":
            clone = types.FunctionType(fn.__code__, namespace, fn.__name__, fn.__defaults__, fn.__closure__)
            clone.__kwdefaults__ = fn.__kwdefaults__
            namespace[key] = clone
    if reference:
        path = ROOT / "tests/fixtures/pricing_calculations_reference.py.txt"
        exec(PRICING_CODE, namespace)
    trace = []
    for key in ["policy", "policy_at", "canonical_ordinance", "same_site", "defendant_key", "within_window", "item_key"]:
        original = namespace[key]

        def tracked(*args, _key=key, _original=original, **kwargs):
            trace.append((_key, repr(args), repr(kwargs)))
            if len(trace) == stop:
                raise ValueError("synthetic pricing interruption")
            return _original(*args, **kwargs)

        namespace[key] = tracked
    data = copy.deepcopy(args)
    try:
        result = ("result", namespace[name](*data))
    except Exception as error:
        result = ("error", type(error).__name__, str(error))
    return result, trace, data == args


class CalculationPhases(unittest.TestCase):
    def test_original_provenance(self):
        for name, expected in [
            ("pricing_calculations_reference.py.txt", "3ff812105c526429291311dace143a8e3fdf8b9815f0e5f9582a8b5731fa079c"),
            ("projection_values_reference.py.txt", "036d5aa6c764762aac801baa81aeb50ae8fa95ed47c8b96025add300bd36c95e"),
        ]:
            self.assertEqual(hashlib.sha256((ROOT / "tests/fixtures" / name).read_bytes()).hexdigest(), expected)

    def test_resolve_historical_and_ordered_dependency_failures(self):
        for at in [None, "2026-10-10", "2026-10-11", "2026-11-14"]:
            policy = pricing.policy_at(at) if at else pricing.policy()
            for entry in policy["entries"]:
                for identity in ["", entry["id"], "missing"]:
                    args = (entry["ordinance"], "", identity, at)
                    expected = pricing_outcome("resolve", args, True)
                    self.assertEqual(pricing_outcome("resolve", args), expected)
                    for stop in range(1, len(expected[1]) + 1):
                        self.assertEqual(pricing_outcome("resolve", args, stop=stop), pricing_outcome("resolve", args, True, stop))
            for key, mappings in policy["itemMappings"].items():
                for mapping in mappings:
                    args = (mapping["chargedOrdinance"], key, "", at)
                    self.assertEqual(pricing_outcome("resolve", args), pricing_outcome("resolve", args, True))
        for value in [None, False, 0, "", "SPS 321.01", "27.05(2)", "1.01", "malformed", {}, []]:
            args = (value, "", "", None)
            self.assertEqual(pricing_outcome("resolve", args), pricing_outcome("resolve", args, True))

    def test_prior_history_windows_duplicates_staging_and_refusals(self):
        rng = random.Random(23055)
        entries = pricing.policy_at("2026-11-14")["entries"]
        respondent = {
            "owner": "Synthetic Owner",
            "ownerAddr": ["PO BOX 123", "MADISON WI 53703"],
            "parcel": "070822219103",
            "address": "1 Synthetic ST",
        }
        for n in range(1200):
            entry = copy.deepcopy(entries[n % len(entries)])
            case = dict(respondent, owner="Different" if n % 3 else "Synthetic Owner", number="QA-1")
            item = {"id": "i", "cite": bool(n % 5), "withdrawn": n % 7 == 0}
            cit = {
                "ord": entry["ordinance"],
                "scheduleEntryId": entry["id"],
                "num": "QA-C1",
                "issued": "2026-11-14",
                "violDate": rng.choice(["2025-11-13", "2025-11-14", "2026-11-14", "2026-11-15", "bad", None]),
            }
            record = {"case": case, "document": {"items": [item], "cits": {"i": cit}, "inspDate": "2026-11-14", "inspTime": "09:00"}}
            history = [record, copy.deepcopy(record)]
            if n % 11 == 0:
                rng.choice([case, cit, item]).pop(rng.choice(["owner", "id", "ord", "num", "address"]), None)
            staged = [{"entryId": entry["id"], "date": "2026-11-13"}]
            args = (entry, respondent, "2026-11-14", history, staged)
            expected = pricing_outcome("prior_offenses", args, True)
            self.assertEqual(pricing_outcome("prior_offenses", args), expected)
            for stop in range(1, len(expected[1]) + 1):
                self.assertEqual(pricing_outcome("prior_offenses", args, stop=stop), pricing_outcome("prior_offenses", args, True, stop))

    def test_projection_value_semantics_and_undefined_identity(self):
        namespace = dict(vars(projection))
        path = ROOT / "tests/fixtures/projection_values_reference.py.txt"
        exec(compile(path.read_text(), str(path), "exec"), namespace)
        values = [
            projection.UNDEF,
            None,
            False,
            True,
            0,
            1,
            -1,
            1.5,
            float("nan"),
            "",
            "0",
            "  x  ",
            "😀",
            [],
            {},
            [None, False],
            {"x": projection.UNDEF, "y": False},
        ]

        def result(fn, *args):
            try:
                value = fn(*args)
                return ("value", "<undefined>" if value is projection.UNDEF else json.dumps(value, ensure_ascii=True, allow_nan=True))
            except Exception as error:
                return ("error", type(error).__name__, str(error))

        for value in values:
            for name in ["truthy", "jstr", "join_part", "jtype", "trim", "jlen", "keys", "clone", "items", "plain", "stringify"]:
                self.assertEqual(result(getattr(projection, name), value), result(namespace[name], value))
            for other in values:
                for name in ["jeq", "jlt", "jand"]:
                    self.assertEqual(result(getattr(projection, name), value, other), result(namespace[name], value, other))


if __name__ == "__main__":
    unittest.main()
