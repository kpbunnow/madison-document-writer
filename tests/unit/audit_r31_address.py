"""Synthetic mailing corpus, parser ambiguity and matching invariants."""

import json
from pathlib import Path
import unittest
from unittest.mock import patch
import address_parser as parser

if not parser.available():
    raise SystemExit("usaddress not installed: pip install -r requirements-dev.txt")


class AddressTests(unittest.TestCase):
    def test_equivalent_unit_addresses(self):
        keys = [
            parser.parse_address(s)["ownerKey"]
            for s in [
                "123 E Main St Apt 4, Madison WI 53703",
                "123 East Main Street #4, Madison WI 53703",
                "123 E. MAIN ST., UNIT 4, Madison WI 53703",
            ]
        ]
        self.assertTrue(keys[0])
        self.assertEqual(len(set(keys)), 1)

    def test_corpus(self):
        answers = []
        for row in json.loads(Path("tests/fixtures/address_corpus.json").read_text()):
            value = parser.parse_address(row["raw"])
            answers.append({**row, "result": value})
            self.assertEqual(value["type"], row["type"], row["raw"])
            if value["type"] != "ambiguous":
                self.assertTrue(value["ownerKey"])
                self.assertEqual(len(value["standardized"]), 2)
        Path("build/test-results/address-parser-corpus.json").write_text(json.dumps(answers, indent=2))

    def test_ambiguous_keeps_raw_and_no_guess(self):
        text = "123 Main St and 456 Other Rd, Madison WI 53703"
        value = parser.parse_address(text)
        self.assertEqual(value["type"], "ambiguous")
        self.assertEqual(value["raw"], text)
        self.assertEqual(value["standardized"], [])

    def test_unavailable_is_explicit(self):
        with patch.object(parser, "PARSER", None):
            self.assertEqual(parser.parse_address("123 Main St Madison WI 53703")["warning"], "address parser unavailable")


if __name__ == "__main__":
    unittest.main()
