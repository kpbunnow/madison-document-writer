"""Read-only current screen-shell reference check; never changes or regenerates a reference."""

import argparse
import hashlib
import json
from pathlib import Path
import re

PAYLOAD = re.compile(r'var B="([A-Za-z0-9+/=]+)"')
PAGES = ("madison-document-writer.html", "madison-reports.html")


def normalized_shell(text, release):
    matches = list(PAYLOAD.finditer(text))
    if len(matches) != 1:
        raise ValueError("Expected exactly one embedded application payload")
    if not release:
        raise ValueError("Expected a release identity for normalization")
    match = matches[0]
    return (text[: match.start(1)] + "PAYLOAD" + text[match.end(1) :]).replace(release, "@RELEASE@")


def shell_sha256(text, release):
    return hashlib.sha256(normalized_shell(text, release).encode("utf-8")).hexdigest()


def assert_screen_shell_reference(root, production):
    root, production = Path(root), Path(production)
    reference = json.loads((root / "tests/fixtures/screen_shell_reference.json").read_text(encoding="utf-8"))
    release = json.loads((root / "version.json").read_text(encoding="utf-8"))["release"]
    if reference.get("schemaVersion") != 1 or set(reference["files"]) != set(PAGES):
        raise ValueError("Invalid current screen-shell reference")
    for name in PAGES:
        actual = shell_sha256((production / name).read_text(encoding="utf-8"), release)
        if actual != reference["files"][name]["normalizedShellSha256"]:
            raise ValueError(name + ": screen shell differs from the reviewed reference; review the screen change explicitly")
    return reference


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--build-dir", type=Path, default=Path(__file__).resolve().parents[1] / "build/dist")
    args = parser.parse_args()
    root = Path(__file__).resolve().parents[1]
    assert_screen_shell_reference(root, args.build_dir)
    print("PASS current Writer and Reports screen-shell reference")


if __name__ == "__main__":
    main()
