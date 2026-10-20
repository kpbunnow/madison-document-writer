"""The parser-absent R19 route is deliberately independent of parser installation."""

import unittest
from unittest.mock import patch
import address_parser


class Fallback(unittest.TestCase):
    def test_unavailable_retains_raw(self):
        with patch.object(address_parser, "PARSER", None):
            raw = "123 Main St, Madison WI 53703"
            result = address_parser.parse_address(raw)
            self.assertEqual(result["raw"], raw)
            self.assertEqual(result["warning"], "address parser unavailable")


if __name__ == "__main__":
    unittest.main()
