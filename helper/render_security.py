"""Closed-resource renderer input and hash-based application CSP."""

import base64
import hashlib
from html import unescape
from html.parser import HTMLParser
import re

PDF_POLICY = "default-src 'none'; img-src data:; font-src data:; style-src 'unsafe-inline'"


def css_plain(value):
    value = re.sub(r"\\(?:\r\n|\n|\r|\f)", "", value)
    value = re.sub(r"/\*.*?\*/", "", value, flags=re.S)
    return re.sub(r"\\([0-9a-fA-F]{1,6})\s?|\\(.)", lambda m: chr(int(m[1], 16)) if m[1] else m[2], value)


def resource(value):
    value = unescape(value).strip()
    if not value.lower().startswith("data:") and not value.startswith("#"):
        raise ValueError("The PDF contains an external or local resource reference. Use only embedded document resources.")


class Resources(HTMLParser):
    def __init__(self, value):
        super().__init__(convert_charrefs=True)
        self.styles = []
        self.in_style = False
        self.head_end = None
        self.lines = value.splitlines(keepends=True)

    def handle_data(self, data):
        if self.in_style:
            self.styles.append(data)

    def handle_endtag(self, tag):
        if tag == "style":
            self.in_style = False

    def handle_starttag(self, tag, attrs):
        if tag == "head" and self.head_end is None:
            line, column = self.getpos()
            self.head_end = sum(map(len, self.lines[: line - 1])) + column + len(self.get_starttag_text())
        if tag == "style":
            self.in_style = True
        if tag in {"iframe", "frame", "object", "embed", "script", "base"}:
            raise ValueError("The PDF contains an unsupported active element.")
        for key, value in attrs:
            if key == "style" and value is not None:
                self.styles.append(value)
            if key in {"src", "href", "xlink:href", "poster", "action", "formaction", "background", "data"} and value is not None:
                resource(value)
            if key == "srcset":
                raise ValueError("The PDF contains an unsupported resource set.")
            if key.lower().startswith("on"):
                raise ValueError("The PDF contains an unsupported active handler.")
            if key == "http-equiv" and (value or "").lower() == "refresh":
                raise ValueError("The PDF contains an unsupported refresh.")


def contained_html(value):
    parser = Resources(value)
    parser.feed(value)
    parser.close()
    plain = css_plain("\n".join(parser.styles))
    for match in re.finditer(r"url\s*\(\s*([\'\"]?)(.*?)\1\s*\)", plain, re.I | re.S):
        resource(match[2])
    for match in re.finditer(r"@import\s+(?:url\s*\()?\s*[\'\"]?([^\'\"\s;)]+)", plain, re.I):
        resource(match[1])
    meta = '<meta http-equiv="Content-Security-Policy" content="' + PDF_POLICY + '">'
    # Insert first in head; all original printable body/style bytes remain unchanged.
    if parser.head_end is None:
        raise ValueError("The PDF document has no supported head element.")
    return value[: parser.head_end] + meta + value[parser.head_end :]


def app_policy(value, reports=False):
    scripts = re.findall(r"<script\b[^>]*>(.*?)</script\s*>", value, re.I | re.S)
    payload = re.search(r'var B="([A-Za-z0-9+/=]+)"', value)
    if payload:
        scripts.append(base64.b64decode(payload[1]).decode("utf-8"))
    hashes = ["'sha256-" + base64.b64encode(hashlib.sha256(s.encode()).digest()).decode() + "'" for s in scripts]
    gis = " https://maps.cityofmadison.com" if reports else ""
    return (
        "default-src 'self'; script-src 'self' "
        + " ".join(hashes)
        + "; connect-src 'self'"
        + gis
        + "; img-src 'self' data: blob:"
        + gis
        + (
            "; font-src 'self' data:; style-src 'self' 'unsafe-inline'; object-sr"
            "c 'none'; frame-src 'self' blob:; frame-ancestors 'none'; base-uri '"
            "none'"
        )
    )
