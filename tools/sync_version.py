"""Regenerate checked npm identity consumers from version.json."""

from pathlib import Path
import json
from version_schema import validate_identity

ROOT = Path(__file__).resolve().parents[1]
v = json.loads((ROOT / "version.json").read_text(encoding="utf-8"))
validate_identity(v)
for name in ["package.json", "package-lock.json"]:
    p = ROOT / name
    value = json.loads(p.read_text(encoding="utf-8"))
    value["version"] = v["helperVersion"]
    if name == "package-lock.json":
        value["packages"][""]["version"] = v["helperVersion"]
    p.write_text(json.dumps(value, indent=2) + "\n", encoding="utf-8")
