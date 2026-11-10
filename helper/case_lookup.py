"""Read-only live case lookup from the division's SSRS case report, run as the signed-in Windows user.

The report (DocumenGeneratorImport) is rendered as XML through ssrs_reports; no SQL, credential or report address is
taken from a request or from the writable share. Its columns become the same fields the import has always used.
"""

import datetime
import json
from pathlib import Path
import re
import threading
from helper_logging import logged
import ssrs_reports

HERE = Path(__file__).resolve().parent
LIMIT = 5 * 1024 * 1024
LOOKUPS = threading.BoundedSemaphore(1)
DEFAULTS = {"enabled": True}
# Settings an earlier release used for its direct SQL connection. They are accepted so an existing shared settings file
# keeps working, and ignored: the report server comes only from the verified release.
RETIRED_SETTINGS = ("server", "database")
FIELDS = (
    "CaseNumber SiteAddress ParcelNumber OwnerName OwnerAddress CaseDescription "
    "DetailedDescription ZoningDistrict HistoricDistrict HistoricDistrictName "
    "IndividualLandmark Landmark InspectionDate InspectionScheduledDate "
    "InspectionType InspectionStatus InspectionTime InspectorName"
).split()
# The report query's historic-district rules (Document-Generator-Import.rdl): zoning code fragment to district name.
HISTORIC_DISTRICTS = (
    ("HIS-MH", "Mansion Hill"),
    ("HIS-TL", "Third Lake Ridge"),
    ("HIS-UH", "University Heights"),
    ("HIS-MB", "Marquette Bungalows"),
    ("HIS-FS", "First Settlement"),
)
LANDMARK_ZONING = "HIS-L"


class CaseLookupError(Exception):
    def __init__(self, message, status=503):
        super().__init__(message)
        self.status = status


def _read_shared_settings(root):
    path = root / "Case Lookup" / "settings.json"
    try:
        return path.read_text(encoding="utf-8-sig")
    except FileNotFoundError:
        return "{}"
    except OSError:
        raise CaseLookupError("Case Lookup/settings.json cannot be read. Ask IT to check access.")


def _checked_settings(raw):
    try:
        data = json.loads(raw)
        if not isinstance(data, dict) or set(data) - set(DEFAULTS) - set(RETIRED_SETTINGS):
            raise ValueError()
        if any(not isinstance(data[key], str) or len(data[key]) > 128 for key in RETIRED_SETTINGS if key in data):
            raise ValueError()
        cfg = dict(DEFAULTS, **{key: value for key, value in data.items() if key in DEFAULTS})
        if type(cfg["enabled"]) is not bool:
            raise ValueError()
    except ValueError, TypeError:
        raise CaseLookupError("Case Lookup/settings.json is invalid. Use the supplied example; the only setting is enabled (true or false).")
    return cfg


def settings(root):
    root = Path(root)
    if not root.is_dir():
        raise CaseLookupError("The shared program folder is unavailable. Reconnect to the City network and retry.")
    cfg = _checked_settings(_read_shared_settings(root))
    try:
        cfg["server"] = ssrs_reports.trusted_connections.approved_ssrs(ssrs_reports.HOST)
    except ValueError as error:
        raise CaseLookupError(str(error)) from None
    if not cfg["enabled"]:
        raise CaseLookupError("Direct case lookup is disabled by the administrator.")
    return cfg


def case_number(value):
    if not isinstance(value, str):
        raise CaseLookupError("Enter a case number.", 400)
    value = value.strip().upper()
    if not re.fullmatch(r"[A-Z0-9-]{3,80}", value):
        raise CaseLookupError("Enter a complete case number using letters, numbers and hyphens (3–80 characters).", 400)
    return value


def zoning_flags(zoning):
    """HistoricDistrict, HistoricDistrictName and IndividualLandmark from a zoning district, as the report query sets them."""
    code = (zoning or "").upper()
    name = next((district for fragment, district in HISTORIC_DISTRICTS if fragment in code), None)
    return ("Yes" if name else "No"), name, ("Yes" if LANDMARK_ZONING in code else "No")


def report_row(columns):
    """One report row as the lookup fields. A column the report leaves out is NULL (None)."""
    row = {field: columns.get(field) for field in FIELDS}
    historic, district, landmark = zoning_flags(columns.get("ZoningDistrict"))
    row["HistoricDistrict"] = historic
    row["HistoricDistrictName"] = columns.get("HistoricDistrictName") or district
    row["IndividualLandmark"] = landmark
    row["InspectionScheduledDate"] = None  # not printed by the report and not used by the import
    if columns.get("RecordCategory"):
        row["RecordCategory"] = columns["RecordCategory"]
    return row


def run_query(cfg, number):
    """The report's rows for one case number, as lookup fields."""
    try:
        found = ssrs_reports.case_rows(number)
    except ssrs_reports.ReportError as error:
        raise CaseLookupError(str(error), error.status) from None
    return {"ok": True, "rows": [report_row(columns) for columns in found]}


@logged("lookup")
def lookup(root, value):
    number = case_number(value)
    cfg = settings(root)
    if not LOOKUPS.acquire(blocking=False):
        raise CaseLookupError("A case lookup is already running. Wait for it to finish and retry.", 429)
    try:
        answer = run_query(cfg, number)
        rows = answer.get("rows")
        if not isinstance(rows, list) or len(rows) > 1000:
            raise CaseLookupError("The lookup returned an invalid or oversized row list.")
        clean = []
        for row in rows:
            if not isinstance(row, dict) or any(f not in row for f in FIELDS):
                raise CaseLookupError("The case report returned unexpected columns. Ask the report administrator to check the report.")
            if any(v is not None and not isinstance(v, str) for v in row.values()):
                raise CaseLookupError("The case report returned an invalid field value.")
            if not isinstance(row["CaseNumber"], str) or case_number(row["CaseNumber"]) != number:
                raise CaseLookupError("The report returned a different case number. Nothing was imported.")
            clean.append(
                {
                    **{f: row[f] for f in FIELDS},
                    **({"CaseType": row.get("CaseType") or row.get("CaseTypeName")} if row.get("CaseType") or row.get("CaseTypeName") else {}),
                    # R37: Record Category ("Snow Removal" advances a snow case); optional so a lookup never fails on it.
                    **({"RecordCategory": row.get("RecordCategory")} if row.get("RecordCategory") else {}),
                }
            )
        if len(json.dumps(clean).encode("utf-8")) > LIMIT:
            raise CaseLookupError("The case response is too large. Nothing was imported.")
        return {
            "ok": True,
            "caseNumber": number,
            "rows": clean,
            "source": {
                **ssrs_reports.source(ssrs_reports.CASE_REPORT),
                "retrievedAt": datetime.datetime.now(datetime.timezone.utc).isoformat(),
            },
        }
    finally:
        LOOKUPS.release()
