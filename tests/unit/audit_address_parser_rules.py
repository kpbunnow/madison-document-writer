"""Address phases retain real parser results, fallback, normalization order and tagged inputs."""

import copy
import json
from pathlib import Path
import random
import unittest
from unittest.mock import patch

import address_parser

ROOT = Path(__file__).resolve().parents[2]
NAMESPACE = address_parser.__dict__.copy()
exec(compile((ROOT / "tests/fixtures/address_parser_reference.txt").read_text(encoding="utf-8"), "address_parser_reference", "exec"), NAMESPACE)
LEGACY = NAMESPACE["parse_address"]


def outcome(check, raw):
    try:
        return ("result", check(raw))
    except Exception as error:
        return ("error", type(error).__name__, str(error))


class AddressParserRules(unittest.TestCase):
    def setUp(self):
        # Each comparison starts with the real bindings; mocked parser cases cannot leak into the corpus.
        for name in ("PARSER", "clean", "owner_key", "available"):
            NAMESPACE[name] = getattr(address_parser, name)

    def test_real_parser_corpus(self):
        for row in json.loads((ROOT / "tests/fixtures/address_corpus.json").read_text(encoding="utf-8")):
            with self.subTest(raw=row["raw"]):
                self.assertEqual(outcome(address_parser.parse_address, row["raw"]), outcome(LEGACY, row["raw"]))

    def test_generated_tagged_parts_fallback_and_call_order(self):
        rng = random.Random(20261028)
        calls, state = [], {}
        native_clean, native_owner, native_available = address_parser.clean, address_parser.owner_key, address_parser.available

        class RepeatedLabelError(ValueError):
            pass

        class Parser:
            @staticmethod
            def tag(raw):
                calls.append(("tag", raw))
                if state["error"] == "repeated":
                    raise RepeatedLabelError("synthetic repeated label")
                if state["error"] == "unexpected":
                    raise RuntimeError("synthetic tag failure")
                return copy.deepcopy(state["parts"]), state["kind"]

        Parser.RepeatedLabelError = RepeatedLabelError

        def clean(value):
            calls.append(("clean", copy.deepcopy(value)))
            return native_clean(value)

        def owner(parts):
            calls.append(("owner", copy.deepcopy(parts)))
            return native_owner(parts)

        def available():
            calls.append(("available",))
            return native_available()

        NAMESPACE.update(clean=clean, owner_key=owner, available=available)
        fields = (
            "StateName",
            "ZipCode",
            "PlaceName",
            "AddressNumber",
            "AddressNumberSuffix",
            "StreetNamePreDirectional",
            "StreetNamePostDirectional",
            "StreetNamePostType",
            "StreetName",
            "OccupancyType",
            "OccupancyIdentifier",
            "USPSBoxID",
            "Recipient",
        )
        values = (
            None,
            "",
            False,
            0,
            "Wisconsin",
            "WI",
            "53703",
            "53703-1234",
            "12",
            "#4",
            ".",
            "  ",
            "north",
            "street",
            "apartment",
            "QA recipient",
            {},
        )
        with (
            patch.object(address_parser, "clean", clean),
            patch.object(address_parser, "owner_key", owner),
            patch.object(address_parser, "available", available),
        ):
            for index in range(3000):
                parts = dict(
                    StateName="Wisconsin",
                    ZipCode="53703",
                    PlaceName="Madison",
                    AddressNumber="123",
                    StreetName="Main",
                    StreetNamePostType="Street",
                    OccupancyType="Apartment",
                    OccupancyIdentifier="#4",
                    USPSBoxID="100",
                )
                if index % 3:
                    for _ in range(rng.randrange(1, 5)):
                        parts[rng.choice(fields)] = copy.deepcopy(rng.choice(values))
                state.update(
                    parts=parts,
                    kind=rng.choice(("Street Address", "PO Box", "Intersection", "Ambiguous")),
                    error=rng.choice((None, None, None, "repeated", "unexpected")),
                )
                parser = None if index % 7 == 0 else Parser
                raw = rng.choice((None, "", False, [], " ", "123 Main Street, Madison WI 53703", "x" * 3000, "x" * 3001))
                before = copy.deepcopy(state)
                NAMESPACE["PARSER"] = parser
                with patch.object(address_parser, "PARSER", parser):
                    calls.clear()
                    expected = outcome(LEGACY, raw)
                    trace = calls[:]
                    calls.clear()
                    with self.subTest(index=index):
                        self.assertEqual(outcome(address_parser.parse_address, raw), expected)
                        self.assertEqual(calls, trace)
                        self.assertEqual(state, before)


if __name__ == "__main__":
    unittest.main()
