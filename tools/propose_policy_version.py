"""Create a review-only proposed version from a codification diff/export row."""

import argparse
import copy
from datetime import date
import json
from pathlib import Path


def propose(existing, candidate, effective, ordinance_number):
    date.fromisoformat(effective)
    if not ordinance_number.strip():
        raise ValueError("An actual ordinance enactment number is required")
    result = copy.deepcopy(existing)
    v = copy.deepcopy(candidate)
    v.update(**{"from": effective, "to": None, "status": "manual-only", "review": None})
    v["source"] = {**v.get("source", {}), "ordinance": ordinance_number, "rowText": v.get("rawText", "")}
    result["versions"].append(v)
    return {
        "status": "proposal-only",
        "requires": ("Review effective date, prior-range closure, legal text, reviewer name/date and YAML examples. No runtime change."),
        "entry": result,
    }


if __name__ == "__main__":
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("existing", type=Path)
    p.add_argument("candidate", type=Path)
    p.add_argument("--effective", required=True)
    p.add_argument("--ordinance", required=True)
    p.add_argument("--output", type=Path, required=True)
    a = p.parse_args()
    a.output.write_text(
        json.dumps(
            propose(
                json.loads(a.existing.read_text(encoding="utf-8")), json.loads(a.candidate.read_text(encoding="utf-8")), a.effective, a.ordinance
            ),
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )
