"""Read-only search and optional operational aids; never rewrite issued records."""

from helper_logging import logged
import hashlib
import json
from pathlib import Path
import re
from case_store import atomic_write, case_number_key, file_lock, validate_case

REPORTS = {
    "openCases",
    "byInspector",
    "openViolations",
    "allCases",
    "allViolations",
    "daysToCompliance",
    "repeatOwners",
    "citations",
    "referrals",
    "overriddenDeposits",
    "documentActions",
}
FILTERS = {"from", "to", "asOf", "areaType", "boundary", "areas", "inspector", "vtype", "ord", "status", "owner"}


def _case_search_terms(record, case):
    text = [case.get(k, "") for k in ("number", "address", "owner", "parcel")]
    for event in record["events"]:
        snap = event.get("payload", {}).get("snapshot", {})
        if isinstance(snap, dict):
            frozen = snap.get("frozen", {}).get("case", {})
            text.extend(frozen.get(k, "") for k in ("address", "owner"))
            text.extend(c.get("num", "") for c in snap.get("cits", {}).values() if isinstance(c, dict))
    return text


@logged("search")
def search_cases(folder, query):
    if not Path(folder).is_dir():
        raise OSError("Shared case folder unavailable")
    if not isinstance(query, str) or not 2 <= len(query.strip()) <= 200:
        raise ValueError("Search needs 2–200 characters")
    query = query.strip().casefold()
    files = sorted(p for p in Path(folder).glob("*.json") if not p.name.startswith("_"))
    hits, unreadable, numbers = [], 0, {}
    for path in files[:5000]:
        try:
            if path.stat().st_size > 32 * 1024 * 1024:
                raise ValueError("Oversize record")
            record = json.loads(path.read_bytes())
            validate_case(record, legacy=True)
            case = record["case"]
            number = case_number_key(case["number"])
            if not path.stem.casefold().endswith(" - " + number):
                raise ValueError("Identity mismatch")
            numbers[number] = numbers.get(number, 0) + 1
            text = _case_search_terms(record, case)
            if query in " ".join(map(str, text)).casefold():
                hits.append(
                    {
                        "number": case["number"],
                        "address": case.get("address", ""),
                        "owner": case.get("owner", ""),
                        "eventCount": len(record["events"]),
                    }
                )
        except (OSError, ValueError, TypeError, KeyError, AttributeError):
            unreadable += 1
    for hit in hits:
        hit["duplicate"] = numbers.get(case_number_key(hit["number"]), 0) > 1
    return {"ok": True, "hits": hits[:100], "unreadable": unreadable, "partial": len(files) > 5000 or len(hits) > 100}


def validate_view(view):
    if not isinstance(view, dict) or set(view) != {"format", "version", "id", "name", "report", "filters", "view", "dateMode"}:
        raise ValueError("Invalid shared view")
    if view["format"] != "madison-report-view" or view["version"] != 1 or not re.fullmatch(r"[A-Za-z0-9-]{1,80}", str(view["id"])):
        raise ValueError("Invalid view identity")
    if (
        not isinstance(view["name"], str)
        or not 1 <= len(view["name"].strip()) <= 80
        or view["report"] not in REPORTS
        or view["view"] not in {"table", "map"}
        or view["dateMode"] not in {"fixed", "month", "year", "all", "today"}
    ):
        raise ValueError("Invalid view settings")
    filters = view["filters"]
    if not isinstance(filters, dict) or set(filters) - FILTERS:
        raise ValueError("Invalid filters")
    for key, value in filters.items():
        if key == "areas":
            if not isinstance(value, list) or len(value) > 100 or any(not isinstance(v, str) or len(v) > 40 for v in value):
                raise ValueError("Invalid areas")
        elif not isinstance(value, str) or len(value) > 300:
            raise ValueError("Invalid filter value")
    return view


def views_folder(folder):
    return Path(folder) / "Reporting Index" / "Views"


def shared_views(folder):
    if not Path(folder).is_dir():
        raise OSError("Shared case folder unavailable")
    target = views_folder(folder)
    views = []
    for path in sorted(target.glob("*.json"))[:200]:
        try:
            if path.stat().st_size > 16384:
                continue
            views.append(validate_view(json.loads(path.read_bytes())))
        except (OSError, ValueError, TypeError):
            continue
    return {"ok": True, "views": views}


@logged("report-view")
def save_view(folder, view):
    validate_view(view)
    if not Path(folder).is_dir():
        raise OSError("Shared case folder unavailable")
    with file_lock(folder, "report-views"):
        target = views_folder(folder)
        target.mkdir(parents=True, exist_ok=True)
        path = target / (view["id"] + ".json")
        raw = json.dumps(view, sort_keys=True).encode()
        if path.exists() and path.read_bytes() != raw:
            raise ValueError("This shared view already exists; save a new view")
        atomic_write(path, raw)
    return {"ok": True, "view": view}


def outbox_files(server):
    target = server.HERE / server.OUTDIR_NAME
    if server.share_root() == server.HERE or not target.is_dir():
        return {"ok": True, "files": []}
    result = []
    for path in sorted(target.glob("*.pdf"))[:1000]:
        if path.is_symlink() or not path.is_file() or path.stat().st_size > server.MAX_BODY:
            continue
        raw = path.read_bytes()
        if not raw.startswith(b"%PDF-"):
            continue
        result.append({"name": path.name, "sha256": hashlib.sha256(raw).hexdigest(), "size": len(raw)})
    return {"ok": True, "files": result}


@logged("outbox")
def outbox_read(server, item):
    if not isinstance(item, dict) or set(item) != {"name", "sha256"} or not re.fullmatch("[a-f0-9]{64}", str(item["sha256"])):
        raise ValueError("Invalid PDF selection")
    name = item["name"]
    if (
        not isinstance(name, str)
        or Path(name).name != name
        or not name.endswith(".pdf")
        or name.startswith(".")
        or any(c in name for c in '\\/:*?"<>|')
    ):
        raise ValueError("Invalid PDF name")
    path = server.HERE / server.OUTDIR_NAME / name
    if path.is_symlink() or path.stat().st_size > server.MAX_BODY:
        raise ValueError("Invalid PDF file")
    raw = path.read_bytes()
    if not raw.startswith(b"%PDF-") or hashlib.sha256(raw).hexdigest() != item["sha256"]:
        raise ValueError("PDF changed; refresh the outbox before continuing")
    return path, raw


@logged("outbox")
def sync_selected(server, data):
    if not isinstance(data, dict) or set(data) != {"items"} or not isinstance(data["items"], list) or not 1 <= len(data["items"]) <= 200:
        raise ValueError("Select 1–200 PDFs")
    if server.share_root() == server.HERE:
        raise ValueError("No separate shared PDF folder is configured")
    dest = server.share_root() / server.OUTDIR_NAME
    dest.mkdir(parents=True, exist_ok=True)
    with file_lock(dest, "pdf-outbox"):
        verified = [outbox_read(server, item) for item in data["items"]]
        if len({p.name for p, _ in verified}) != len(verified):
            raise ValueError("Duplicate PDF selection")
        moved, conflicts = 0, []
        for path, raw in verified:
            target = dest / path.name
            try:
                # Same per-name lock and no-replace publication as direct filing.
                server.file_pdf_bytes(target, raw)
            except ValueError:
                conflicts.append(path.name)
                continue
            # Remove the local copy only once the shared copy reads back identical,
            # and preserve a local file changed while it was being filed.
            if target.read_bytes() == raw and path.read_bytes() == raw:
                path.unlink()
                moved += 1
            else:
                conflicts.append(path.name)
    return {"ok": True, "result": {"moved": moved, "conflicts": conflicts, "remaining": server.outbox_count()}}


@logged("email-draft")
def reminder_draft(server, data):
    if not isinstance(data, dict) or set(data) != {"to", "subject", "body"}:
        raise ValueError("Invalid reminder draft")
    if not isinstance(data["to"], str) or not re.fullmatch(r"[^\s@;,<>]+@[^\s@;,<>]+\.[^\s@;,<>]+", data["to"]) or len(data["to"]) > 254:
        raise ValueError("Enter one valid email recipient")
    if not isinstance(data["subject"], str) or not 1 <= len(data["subject"]) <= 200 or "\n" in data["subject"] or "\r" in data["subject"]:
        raise ValueError("Invalid subject")
    if not isinstance(data["body"], str) or not 1 <= len(data["body"]) <= 12000:
        raise ValueError("Invalid reminder text")
    if not server.find_outlook():
        raise ValueError("Outlook is unavailable on this computer")
    server.open_in_outlook(None, data["subject"], data["body"], data["to"])
    return {"ok": True}
