"""Verify library paragraph identities against the supplied MGO chapter exports."""

import argparse
import hashlib
import json
from pathlib import Path
import re


def chapter_index(path):
    text = path.read_text(encoding="utf-8")
    index = {}
    active = []
    section = ""
    levels = {}
    parsed = re.sub(r"^(\([a-z]+\))\s*(?=\d+\.\s)", r"\1\n", text, flags=re.M)
    for line in parsed.splitlines():
        heading = re.match(r"^(\d+\.\d+)\s", line)
        if heading:
            section = heading[1]
            levels = {}
            active = [section]
            index.setdefault(section, [])
        elif section:
            token = re.match(r"^\((\d+|[a-z]{1,3})\)(?:\s|$)|^(\d+)\.(?:\s|$)|^([a-z])\.(?:\s|$)", line)
            if token:
                value = next(x for x in token.groups() if x is not None)
                level = 0 if token[1] and value.isdigit() else 1 if token[1] else 2 if token[2] else 3
                levels = {k: v for k, v in levels.items() if k < level}
                levels[level] = "(" + value + ")" if token[1] else value + "."
                active = [section] + [section + "".join(levels[k] for k in sorted(levels) if k <= n) for n in sorted(levels)]
                for key in active:
                    index.setdefault(key, [])
        for key in active:
            index[key].append(line)
    return {key: "\n".join(lines) for key, lines in index.items()}, hashlib.sha256(text.encode()).hexdigest()


def audit(root, library=None):
    root = Path(root)
    library = library or json.loads((root / "app/assets/library.js").read_text(encoding="utf-8").split("=", 1)[1].rsplit(";", 1)[0])
    chapters = {}
    for path in sorted((root / "policy/sources").glob("r30-CHAPTER_*.txt")):
        match = re.search(r"CHAPTER_(\d+)_", path.name)
        if match:
            chapters[match[1]] = (path, *chapter_index(path))
    result = []
    for section in sorted({s for c in library for g in c["groups"] for i in g["items"] for s in i.get("s", [])}):
        match = re.match(r"^(\d+)\.", section)
        if not match or match[1] not in chapters:
            result.append({"section": section, "verdict": "unverified", "reason": "Chapter text was not supplied; citation left unchanged."})
            continue
        path, index, digest = chapters[match[1]]
        # Display references may omit the terminal subdivision punctuation; the retained source does not.
        source_section = section + "." if re.search(r"\)\d+$", section) else section
        if source_section not in index:
            raise ValueError("Library section absent from supplied chapter text: " + section)
        result.append(
            {"section": section, "verdict": "confirmed", "source": path.name, "sourceSha256": digest, "chapterText": index[source_section][:1800]}
        )
    return result


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", type=Path, default=Path(__file__).resolve().parents[1])
    args = parser.parse_args()
    try:
        result = audit(args.root)
    except ValueError as error:
        raise SystemExit(str(error))
    print("PASS library chapter existence:", len(result), "distinct current sections")
