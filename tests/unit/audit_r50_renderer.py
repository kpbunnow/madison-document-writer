import json
import unittest
from pathlib import Path
from unittest.mock import patch
import server
import render_security as security


class RendererSecurity(unittest.TestCase):
    def test_resources_and_obfuscations_are_refused(self):
        for body in [
            '<img src="https://example.invalid/">',
            '<link href="https://example.invalid/style.css">',
            '<iframe src="data:text/html,active"></iframe>',
            '<img src="file:///secret">',
            '<style>@import "https://example.invalid/x";</style>',
            "<style>x{background:url(//example.invalid)}</style>",
            "<style>x{background:u\\72l(\\68 ttps://example.invalid)}</style>",
            '<img src="&#102;ile:///secret">',
            '<img srcset="https://example.invalid/ 2x">',
        ]:
            with self.subTest(body=body), self.assertRaises(ValueError):
                security.contained_html("<html><head></head><body>" + body + "</body></html>")

    def test_helper_never_invokes_renderer_for_external_resources(self):
        with patch.object(server, "find_chrome", return_value="chrome"), patch.object(server.subprocess, "run") as run:
            with self.assertRaises(ValueError):
                server.make_pdf('<html><head></head><body><img src="https://example.invalid/leak"></body></html>', Path("unused.pdf"))
            run.assert_not_called()

    def test_all_approved_document_families_use_only_embedded_resources(self):
        baseline = json.loads(Path("tests/fixtures/reference/R49-print-golden.json").read_text())
        self.assertEqual(len(baseline["results"]), 69)
        for item in baseline["results"]:
            with self.subTest(family=item["type"], authoring=item["authoringVersion"], snow=item["snow"]):
                value = "<!doctype html><html><head><style>" + baseline["styles"] + "</style></head>" + item["body"] + "</html>"
                secured = security.contained_html(value)
                self.assertEqual(secured.split("</head>", 1)[1], value.split("</head>", 1)[1])

    def test_comment_does_not_hide_the_first_real_head_policy(self):
        value = "<!-- <head> -->\n<html><head></head><body>safe</body></html>"
        result = security.contained_html(value)
        self.assertTrue(result.startswith("<!-- <head> -->"))
        self.assertIn("<html><head><meta http-equiv=", result)

    def test_embedded_only_keeps_exact_body(self):
        value = (
            "<html><head><style>@font-face{src:url(data:font/woff2;base64,AA==)}<"
            '/style></head><body><img src="data:image/png;base64,AA=="><a href="#'
            'part">Local</a></body></html>'
        )
        out = security.contained_html(value)
        self.assertIn('<head><meta http-equiv="Content-Security-Policy"', out)
        self.assertEqual(value.split("<body>")[1], out.split("<body>")[1])


if __name__ == "__main__":
    unittest.main()
