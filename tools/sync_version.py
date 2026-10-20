"""Regenerate checked npm identity consumers from version.json."""

from pathlib import Path
import json

ROOT = Path(__file__).resolve().parents[1]
v = json.loads((ROOT / "version.json").read_text())
for name in ["package.json", "package-lock.json"]:
    p = ROOT / name
    value = json.loads(p.read_text())
    value["version"] = v["helperVersion"]
    if name == "package-lock.json":
        value["packages"][""]["version"] = v["helperVersion"]
    p.write_text(json.dumps(value, indent=2) + "\n")
