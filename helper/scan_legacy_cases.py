"""Read-only case-number compatibility inventory for an administrator."""

import argparse
import json
from pathlib import Path
import re
from case_store import case_number_key


def scan(folder):
    rows = []
    for path in sorted(Path(folder).glob("*.json")):
        if path.name.startswith("_"):
            continue
        try:
            record = json.loads(path.read_text(encoding="utf-8"))
            number = record["case"]["number"]
            key = case_number_key(number)
            if not re.fullmatch(r"[A-Za-z0-9-]{3,80}", number):
                rows.append({"file": path.name, "number": number, "key": key, "issue": "Legacy spelling; preserved"})
            else:
                rows.append({"file": path.name, "number": number, "key": key, "issue": ""})
        except (OSError, ValueError, KeyError, TypeError):
            rows.append({"file": path.name, "number": "", "key": "", "issue": "Unreadable record or invalid number; review required"})
    counts = {}
    for row in rows:
        if row["key"]:
            counts[row["key"]] = counts.get(row["key"], 0) + 1
    for row in rows:
        if counts.get(row["key"], 0) > 1:
            row["issue"] = "Conflicting case-number keys; review before saving"
    return {
        "format": "madison-case-number-inventory",
        "version": 1,
        "readOnly": True,
        "scanned": len(rows),
        "issues": [row for row in rows if row["issue"]],
    }


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("folder", type=Path)
    args = parser.parse_args()
    if not args.folder.is_dir():
        parser.error("Case folder is not reachable")
    print(json.dumps(scan(args.folder), indent=2, ensure_ascii=False))
