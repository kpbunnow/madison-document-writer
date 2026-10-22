"""Regenerate the Document Writer icon from its editable SVG source.

    python3 tools/build_icon.py           write app/assets/document-writer.ico and its record
    python3 tools/build_icon.py --check   re-render and confirm the committed bytes are reproduced

The SVG is rasterized by the pinned Playwright Chromium (tools/rasterize_icon.cjs; DW_BROWSER selects another
compatible Chromium). Shapes with class="detail" are hidden at 16 and 32 px so the small sizes stay bold.
The ICO holds PNG-compressed 16, 32, 48 and 256 px images (supported by Windows Vista and later). The
outputs are committed build inputs; app/assets/document-writer-icon.json records the SVG digest they came from.
"""

import argparse
import base64
import hashlib
import json
from pathlib import Path
import struct
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "app/assets/document-writer-icon.svg"
ICON = ROOT / "app/assets/document-writer.ico"
RECORD = ROOT / "app/assets/document-writer-icon.json"
SIZES = (16, 32, 48, 256)
DETAIL_FROM = 48  # smallest size that keeps the decorative detail


def variant(svg, size):
    """The SVG at one pixel size, without decorative detail below DETAIL_FROM."""
    svg = svg.replace('width="256" height="256"', 'width="%d" height="%d"' % (size, size), 1)
    if size < DETAIL_FROM:
        svg = svg.replace("<title>", "<style>.detail{display:none}</style><title>", 1)
    return svg


def png_size(data):
    if data[:8] != b"\x89PNG\r\n\x1a\n" or data[12:16] != b"IHDR":
        raise ValueError("Not a PNG image")
    return struct.unpack(">II", data[16:24])


def pack_ico(images):
    """Write an ICO container whose entries are PNG images, smallest first."""
    header = struct.pack("<HHH", 0, 1, len(images))
    offset = len(header) + 16 * len(images)
    entries, payload = b"", b""
    for data in images:
        width, height = png_size(data)
        if width != height or not 1 <= width <= 256:
            raise ValueError("Icon images must be square and at most 256 px")
        entries += struct.pack("<BBBBHHII", width % 256, height % 256, 0, 0, 1, 32, len(data), offset + len(payload))
        payload += data
    return header + entries + payload


def read_ico(data):
    """Return {size: png bytes} for an ICO written by pack_ico (used by the tests)."""
    reserved, kind, count = struct.unpack("<HHH", data[:6])
    if reserved != 0 or kind != 1:
        raise ValueError("Not an icon file")
    images = {}
    for index in range(count):
        width, height, _, _, planes, bits, length, offset = struct.unpack("<BBBBHHII", data[6 + 16 * index : 22 + 16 * index])
        png = data[offset : offset + length]
        if png_size(png) != (width or 256, height or 256) or planes != 1 or bits != 32:
            raise ValueError("Icon entry does not match its image")
        images[width or 256] = png
    return images


def rasterize(svg):
    jobs = [{"size": size, "svg": variant(svg, size)} for size in SIZES]
    run = subprocess.run(
        ["node", str(ROOT / "tools/rasterize_icon.cjs")],
        input=json.dumps(jobs),
        cwd=ROOT,
        capture_output=True,
        check=True,
        text=True,
        encoding="utf-8",
    )
    value = json.loads(run.stdout)
    return value["browser"], [base64.b64decode(item["png"]) for item in value["results"]]


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--check", action="store_true", help="Re-render and compare with the committed icon")
    args = parser.parse_args(argv)
    svg = SOURCE.read_text(encoding="utf-8")
    browser, images = rasterize(svg)
    icon = pack_ico(images)
    if sorted(read_ico(icon)) != sorted(SIZES):
        raise SystemExit("The icon container does not hold every required size")
    record = {
        "source": SOURCE.name,
        "sourceSha256": hashlib.sha256(SOURCE.read_bytes()).hexdigest(),
        "renderer": "Chromium " + browser,
        "sizes": list(SIZES),
        "icon": ICON.name,
        "iconSha256": hashlib.sha256(icon).hexdigest(),
    }
    if args.check:
        same = ICON.read_bytes() == icon and json.loads(RECORD.read_text(encoding="utf-8")) == record
        print("Icon reproduced exactly." if same else "Icon differs from the committed output.")
        return 0 if same else 1
    ICON.write_bytes(icon)
    RECORD.write_text(json.dumps(record, indent=2) + "\n", encoding="utf-8")
    print("Wrote %s (%d bytes) from %s" % (ICON.relative_to(ROOT), len(icon), SOURCE.relative_to(ROOT)))
    return 0


if __name__ == "__main__":
    sys.exit(main())
