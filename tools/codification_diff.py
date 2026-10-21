"""Compare a fresh Municode DOCX deposit table; write review-only proposals."""

import argparse
from datetime import date
from decimal import Decimal
import json
from pathlib import Path
import re
import xml.etree.ElementTree as ET
from zipfile import ZipFile
import citation_pricing

NS = {"w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main"}
ROOT = Path(__file__).resolve().parents[1]


def table_rows(path):
    with ZipFile(path) as archive:
        document = ET.fromstring(archive.read("word/document.xml"))
    for table in document.findall(".//w:tbl", NS):
        rows = []
        for row in table.findall("w:tr", NS):
            cells = []
            for cell in row.findall("w:tc", NS):
                cells.append("\n".join("".join(p.itertext()) for p in cell.findall("w:p", NS)).strip())
            if len(cells) == 3:
                rows.append(cells)
        if rows and "Offense" in rows[0][0] and "Deposit" in rows[0][2]:
            return rows
    raise ValueError("The DOCX has no recognized three-column deposit table")


def normalized(row):
    return tuple(re.sub(r"\s+", " ", cell).strip() for cell in row)


def propose_export(path, effective_dates, codification):
    if not str(codification).strip():
        raise ValueError("Record the actual codification version")
    baseline = json.loads((ROOT / "policy/sources/r30-schedule-table.json").read_text(encoding="utf-8"))
    before = {normalized(row) for row in baseline[1:]}
    after = table_rows(path)
    new = {normalized(row) for row in after[1:]}
    proposals = []
    for description, raw_ordinance, raw in after[1:]:
        if normalized([description, raw_ordinance, raw]) in before:
            continue
        ordinance = citation_pricing.canonical_ordinance(raw_ordinance)
        authority = effective_dates.get(ordinance) or effective_dates.get(raw_ordinance) or {}
        effective = authority.get("effectiveDate")
        enactment = authority.get("ordinance", "")
        if effective:
            date.fromisoformat(effective)
            if not enactment.strip():
                raise ValueError("Each effective date requires its enactment ordinance number")
        matches = [e for e in citation_pricing.policy()["entries"] if e["ordinance"] == ordinance]
        amounts = [int(Decimal(a.replace(",", "")) * 100) for a in re.findall(r"\$\s*([\d,]+(?:\.\d{1,2})?)", raw)]
        proposals.append(
            {
                "id": matches[0]["id"] if len(matches) == 1 else None,
                "ordinance": ordinance or raw_ordinance,
                "description": description,
                "version": {
                    "from": effective,
                    "to": None,
                    "rawText": raw,
                    "tiers": [{"ordinal": n + 1, "amountCents": amount} for n, amount in enumerate(amounts)],
                    "window": None,
                    "countBasis": None,
                    "status": "manual-only",
                    "review": None,
                    "source": {"rowText": raw, "ordinance": enactment, "codification": codification, "export": Path(path).name},
                },
                "requires": [
                    "Review identity and charge",
                    "Confirm effective date and enactment",
                    "Close previous range",
                    "Review raw tiers, window and count basis",
                    "Named reviewer and review date",
                    "Readable YAML tests",
                ],
            }
        )
    return {
        "status": "proposal-only",
        "comparisonBaseline": "R30 retained Municode export",
        "export": Path(path).name,
        "proposals": proposals,
        "removedRowsRequiringReview": [list(row) for row in sorted(before - new)],
        "runtimeChanged": False,
    }


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("export", type=Path)
    parser.add_argument("--effective-dates", type=Path, required=True)
    parser.add_argument("--codification", required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    args.output.write_text(
        json.dumps(propose_export(args.export, json.loads(args.effective_dates.read_text(encoding="utf-8")), args.codification), indent=2) + "\n",
        encoding="utf-8",
    )
