"""Replay the browser corpus, independent Hypothesis arithmetic and real storage."""

import copy
import json
import os
from pathlib import Path
import tempfile
from hypothesis import given, settings, seed, strategies as st
import citation_pricing as p
import case_store
from audit_r28_helper import pair

ROOT = Path(__file__).resolve().parents[2]
corpus = json.loads((ROOT / "build/test-results/property-corpus.json").read_text())
RUNS = 100000 if os.environ.get("DW_DEEP") == "1" else 500
for row in corpus["arithmetic"]:
    assert p.assessment_cents(row["base"], row["court"], at=row.get("date")) == row["answer"], row
for row in corpus["normalization"]:
    assert p.canonical_ordinance(row["noise"]) == row["answer"], row
for row in corpus["resolutions"]:
    base = p.base_cents(p.resolve(row["ord"]), row["tier"])
    assert ("priced" if base is not None else "needs-basis") == row["kind"], row
    if base is not None:
        assert f"{p.assessment_cents(base, p.court_cents(row['date']))['total'] / 100:.2f}" == row["amount"]
for row in corpus["validation"]:
    v = pair()["events"][-1]["payload"]["snapshot"]
    v.update(authoringVersion=6)
    v["cits"]["charged_item"].update(row["c"])
    try:
        case_store.validate_authoring(v, "2026-08-01T15:00:00Z")
        verdict = True
    except ValueError:
        verdict = False
    assert verdict == row["verdict"], row


@seed(31011026)
@settings(max_examples=RUNS, deadline=None, database=None)
@given(st.integers(1, 100000000), st.integers(1500, 4800), st.integers(1, 1000000))
def properties(base, court, delta):
    v = p.assessment_cents(base, court)
    assert v["penalty"] == (base * 26 + 50) // 100
    assert v["jail"] == max(1000, (base + 50) // 100)
    assert v["total"] == sum(v[k] for k in ("base", "penalty", "jail", "crimeLab", "court"))
    assert p.assessment_cents(base + delta, court)["total"] >= v["total"]


properties()
# Every gate uses 500 actual helper merge/save/read round trips, independent of deep budget.
with tempfile.TemporaryDirectory() as folder:
    root = Path(folder)
    for n, row in enumerate(corpus["arithmetic"][:500]):
        v = pair()
        v["case"]["number"] = "QA-PROP-" + str(n)
        for event in v["events"]:
            event["payload"]["snapshot"]["frozen"]["case"] = copy.deepcopy(v["case"])
        snap = v["events"][-1]["payload"]["snapshot"]
        snap["authoringVersion"] = 6
        c = snap["cits"]["charged_item"]
        c.update(
            depositMode="base",
            base=f"{row['base'] / 100:.2f}",
            cc=f"{row['court'] / 100:.2f}",
            amount=f"{row['answer']['total'] / 100:.2f}",
            depositSource="Synthetic approved property test base.",
            assessments=row["answer"],
        )
        name = "101 TEST - " + v["case"]["number"] + ".json"
        saved = case_store.save_case(root, name, v)
        restored = case_store.read_case(root, name)["file"]
        assert restored["events"][-1]["payload"]["snapshot"]["cits"]["charged_item"]["amount"] == c["amount"]
        case_store.validate_authoring(snap, "2026-08-01T15:00:00Z")
print("PASS browser/helper differential corpus, Hypothesis", RUNS, "and 500 real helper round trips")
