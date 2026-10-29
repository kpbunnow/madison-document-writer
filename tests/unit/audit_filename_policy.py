"""File names built from case data never carry control characters or bidirectional formatting, which fail on
Windows or make a name display as something else; ordinary names are unchanged."""

import unittest

import case_store
import server

BAD = ["\x00", "\x01", "\x1f", "\x7f", "‎", "‏", "‪", "‫", "‬", "‭", "‮", "⁦", "⁧", "⁨", "⁩", "؜"]


class FilenamePolicy(unittest.TestCase):
    def test_pdf_names_drop_controls_and_bidirectional_marks(self):
        for bad in BAD:
            with self.subTest(char=repr(bad)):
                self.assertEqual(server.safe_name("a" + bad + "b.pdf"), "ab.pdf")
                self.assertEqual(server.safe_name(bad + bad), "Document.pdf")

    def test_case_names_with_those_characters_are_refused(self):
        for bad in BAD:
            with self.subTest(char=repr(bad)):
                with self.assertRaises(ValueError):
                    case_store.safe_json_name("a" + bad + "b.json")

    def test_ordinary_names_are_unchanged(self):
        self.assertEqual(server.safe_name("Notice - 12345678"), "Notice - 12345678.pdf")
        self.assertEqual(server.safe_name("Zoë – 雪 - 12345678.pdf"), "Zoë – 雪 - 12345678.pdf")
        self.assertEqual(case_store.safe_json_name("101 TEST LANE - QA-001.json"), "101 TEST LANE - QA-001.json")
        self.assertEqual(case_store.safe_json_name("Zoë 雪 - QA-002.json"), "Zoë 雪 - QA-002.json")

    def test_whitespace_is_a_space_in_pdf_names_and_refused_in_case_names(self):
        for white in ("\t", "\n", "\r", "\v", "\f"):
            self.assertEqual(server.safe_name("a" + white + "b.pdf"), "a b.pdf")
            with self.assertRaises(ValueError):
                case_store.safe_json_name("a" + white + "b.json")


if __name__ == "__main__":
    unittest.main()
