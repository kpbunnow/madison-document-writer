#!/usr/bin/env python3
"""
Madison Building Inspection - Document Writer, local helper

Serves the program on 127.0.0.1 and, when the program asks, turns a finished
document into a PDF and files it on the share.

Why this exists: a browser cannot write a PDF into a folder on its own. It can
hand us the finished page, though, and Chrome is already on the machine, so the
PDF is produced by running Chrome headless over that page. Nothing is installed
and nothing leaves the computer.

POST /save-pdf   {"filename": "...", "html": "<!doctype html>..."}
                 -> writes <share>/Documents To Be Mailed And Recorded/<filename>.pdf
POST /email      {"filename": "...", "html": "...", "subject": "...", "body": "..."}
                 -> writes the PDF, then opens a new Outlook message with it
                    attached, for the inspector to address and send

Reporting (read-only against the case record):
GET  /reporting/index      every summary in <case folder>/Reporting Index that
                           equals the projection of its verified case, plus which
                           case files have no summary, a stale one or one that
                           does not match the case
GET  /reporting/parcels    the parcel lookup cache
POST /reporting/parcels    {"ids": [...], "refresh": false}
                           -> looks up parcels not yet cached on the city's
                              parcel layer and caches the answer
GET  /reporting/areas      alder district and ZIP outlines, where available
"""

from runtime_paths import no_window, resource as _resource

import http.server, socketserver, json, os, stat, sys, subprocess, tempfile, shutil, threading, time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent / "vendor/site"))
import address_parser
from urllib.parse import quote, urlencode, urlsplit, parse_qs
import hashlib
import base64, re, uuid
import secrets
import hmac
import helper_session
import case_integrity
import case_projection
from reporting_reads import ordered_reads
import citation_pricing
import sys
import artifact_store
import render_security
import trusted_connections
import operations_helper
import workflow_helper
from helper_logging import logged, record
from datetime import datetime, timezone
from case_lookup import lookup as lookup_case, CaseLookupError
from case_store import (
    read_case,
    save_case,
    save_summary,
    file_lock,
    atomic_write,
    publish_new,
    case_number_key,
    case_file_key,
    citation_history,
    held_lock_kinds,
)

SESSION_TOKEN = secrets.token_urlsafe(32)
SESSION_BOOTSTRAP = secrets.token_urlsafe(32)
# Public correlation only, never an authentication credential. A delayed stop announcement from an old
# browser window must not disable pages connected to a newly started helper on the same origin.
HELPER_INSTANCE = secrets.token_hex(16)
STATIC_ROUTES = {
    "/",
    "/madison-document-writer.html",
    "/madison-reports.html",
    "/PROGRAM-MANUAL.html",
    "/PROGRAM-MANUAL.md",
    "/Program_Instruction_Manual.pdf",
    "/Program_Instruction_Manual.docx",
    "/favicon.ico",
}
# Public, secret-free application icon. Browsers request /favicon.ico on their own, so the frozen page
# templates need no link element; img-src 'self' in the application CSP already permits it.
FAVICON = "document-writer.ico"


def start_session(folder=None):
    global SESSION_BOOTSTRAP
    SESSION_BOOTSTRAP = helper_session.prepare(SESSION_TOKEN, folder)


PORT = int(os.environ.get("DW_PORT", "8777"))
# A document is a few hundred KB of HTML. Anything far past that is not one,
# and reading it would only tie up a thread and memory.
MAX_BODY = 32 * 1024 * 1024
# Chrome is the expensive part. Two at once is enough for one inspector and
# keeps a stuck render from spawning a renderer per request.
RENDERERS = threading.Semaphore(2)
HERE = Path(__file__).resolve().parent


def resource(name):
    """Keep explicit installed/test roots authoritative for immutable inputs."""
    current = HERE / name
    return current if current.is_file() else _resource(name)


OUTDIR_NAME = "Documents To Be Mailed And Recorded"
from runtime_identity import VERSION as HELPER_VERSION


def share_root():
    """Where the master copy lives, as remembered by the launcher."""
    f = HERE / "share.txt"
    if f.exists():
        p = f.read_text(encoding="utf-8", errors="ignore").strip()
        if p:
            return Path(p)
    return HERE


def out_dir():
    d = share_root() / OUTDIR_NAME
    try:
        d.mkdir(parents=True, exist_ok=True)
        return d
    except OSError:
        # share unreachable - fall back to a local outbox so nothing is lost
        d = HERE / OUTDIR_NAME
        d.mkdir(parents=True, exist_ok=True)
        return d


# ---------------------------------------------------------------- reporting
CASE_DIR_NAME = "Case JSON Files"
INDEX_DIR_NAME = "Reporting Index"
GIS_DIR_NAME = "Reporting GIS"
# The city's public parcel layer. Each parcel carries its alder district and
# building district; outSR=4326 returns latitude and longitude.
PARCEL_QUERY = "https://maps.cityofmadison.com/arcgis/rest/services/Public/OPEN_DATA2/MapServer/0/query"
# Alder district outlines, from the city's open-data hub. Not verified from
# the build machine: override in Reporting GIS/settings.json, or drop an
# alder-districts.geojson into Reporting GIS and it is used instead.
DISTRICTS_URL = "https://opendata.arcgis.com/datasets/81039877861c40a1857b2e7634951e04_10.geojson"
PARCEL_BATCH = 50
CACHE_LOCK = threading.Lock()


def case_dir():
    env = os.environ.get("DW_CASE_DIR")
    return Path(env) if env else share_root() / CASE_DIR_NAME


def gis_dir():
    d = share_root() / GIS_DIR_NAME
    d.mkdir(parents=True, exist_ok=True)
    return d


def settings():
    f = gis_dir() / "settings.json"
    try:
        return json.loads(f.read_text(encoding="utf-8")) if f.exists() else {}
    except (OSError, ValueError):
        return {}


def norm_parcel(p):
    d = re.sub(r"[\s-]", "", str(p or ""))
    return d if re.fullmatch(r"[0-9]{12}", d) else ""


PROJECTION_MATCHES, PROJECTION_LOCK = {}, threading.Lock()


def projection_mismatch(summary, summary_sha256, record_value):
    """Fields where a summary differs from the projection of its verified case.

    A match depends only on the exact summary bytes and case bytes (sourceRevision is
    already proven equal to the case hash), so matching pairs are remembered for this
    helper process. Integrity is still verified on every request."""
    key = (summary_sha256, summary.get("sourceRevision"))
    with PROJECTION_LOCK:
        if key in PROJECTION_MATCHES:
            return []
    try:
        fields = case_projection.mismatched_fields(summary, record_value)
    except Exception:  # summarize() could not have written any summary for this case
        return ["case could not be projected"]
    if not fields:
        with PROJECTION_LOCK:
            if len(PROJECTION_MATCHES) >= 20000:
                PROJECTION_MATCHES.clear()
            PROJECTION_MATCHES[key] = True
    return fields


def read_index(read_workers=4):
    """Every summary, and every case file whose summary is absent or older."""
    cd = case_dir()
    out = {
        "ok": True,
        "caseDir": str(cd),
        "summaries": [],
        "unreadable": [],
        "missing": [],
        "stale": [],
        "mismatched": [],
        "readAt": time.strftime("%Y-%m-%dT%H:%M:%S"),
    }
    if not cd.is_dir():
        out.update(ok=False, error="the case folder %s cannot be reached" % cd)
        return out
    by_number, files, seen, duplicates, mismatched = {}, {}, set(), set(), set()
    for path in sorted(cd.glob("*.json")):
        if not path.name.startswith("_"):
            files.setdefault(case_file_key(path), []).append(path)
    try:
        context = case_integrity.VerificationContext(cd, summary_workers=read_workers)
    except (OSError, ValueError, TypeError, KeyError) as error:
        out.update(ok=False, error="Retained integrity evidence could not be verified: " + str(error))
        return out
    idx = cd / INDEX_DIR_NAME

    def read_input(path):
        # Speculative reads only. Identity, duplicate, revision and chain checks
        # remain in their original order on this request's consuming thread.
        try:
            summary_raw = path.read_bytes()
            summary = json.loads(summary_raw)
        except (OSError, ValueError, TypeError, KeyError) as error:
            return path, None, None, error
        if isinstance(summary, dict):
            summary["__raw_sha256"] = hashlib.sha256(summary_raw).hexdigest()
        raw, error = None, None
        if isinstance(summary, dict) and isinstance(summary.get("case"), dict):
            try:
                matches = files.get(case_number_key(summary["case"].get("number")), [])
                if len(matches) == 1:
                    raw = matches[0].read_bytes()
            except (OSError, ValueError, TypeError, KeyError) as problem:
                error = problem
        return path, summary, raw, error

    for p, summary, raw, read_error in ordered_reads(sorted(idx.glob("*.json")), read_input, read_workers):
        try:
            if summary is None and read_error:
                raise read_error
            summary_sha256 = summary.pop("__raw_sha256", None) if isinstance(summary, dict) else None
            if not isinstance(summary, dict) or summary.get("format") != "madison-case-summary" or not isinstance(summary.get("case"), dict):
                raise ValueError("not a case summary")
            number = case_number_key(summary["case"].get("number"))
            if number in seen:
                duplicates.add(number)
                raise ValueError("duplicate summary; excluded from totals")
            seen.add(number)
            if number not in files or len(files[number]) != 1:
                raise ValueError("missing or duplicate case file; excluded from reports")
            casefile = files[number][0]
            # Optional metadata: absent, null or empty is accepted as before; anything but text is damage.
            source_file = summary.get("sourceFile")
            if source_file is not None and not isinstance(source_file, str):
                raise ValueError("summary source file is not a file name")
            if source_file and source_file.casefold() != casefile.name.casefold():
                raise ValueError("summary points to a different case file")
            if any(
                not isinstance(summary.get(key, []), list) or any(not isinstance(item, dict) for item in summary.get(key, []))
                for key in ("documents", "violations", "reinspections", "visits", "citations", "referrals")
            ):
                raise ValueError("invalid summary records")
            if read_error:
                raise read_error
            record_value = json.loads(raw)
            if not isinstance(record_value, dict) or not isinstance(record_value.get("case", {}), dict):
                raise ValueError("case file is not a case record")
            if case_number_key(record_value.get("case", {}).get("number")) != number:
                raise ValueError("case file identity mismatch")
            if summary.get("sourceRevision") != hashlib.sha256(raw).hexdigest():
                out["stale"].append(casefile.name)
                continue
            status = case_integrity.verify_record(record_value, cd, context=context)
            if not status["valid"]:
                raise ValueError(status["label"])
            # The verified case is the authority for reportable facts: a summary naming the
            # current revision is used only if it equals the projection of that case. Earlier
            # summary formats pass through to Reports, which excludes them as earlier-format.
            if case_projection.used_by_reports(summary):
                fields = projection_mismatch(summary, summary_sha256, record_value)
                if fields:
                    out["mismatched"].append("%s (%s; differs in %s)" % (p.name, casefile.name, ", ".join(fields)))
                    mismatched.add(casefile.name)
                    continue
            summary["integrity"] = status
            by_number[number] = summary
        except (OSError, ValueError, TypeError, KeyError) as error:
            out["unreadable"].append("%s (%s)" % (p.name, error))
    for number in duplicates:
        by_number.pop(number, None)
    out["summaries"] = list(by_number.values())
    excluded = set(out["stale"]) | mismatched
    for number, paths in files.items():
        if number not in by_number and not any(p.name in excluded for p in paths):
            out["missing"].extend(p.name for p in paths)
    return out


def fetch_json(url, timeout=25):
    return trusted_connections.fetch_json(url, timeout)


def ring_centroid(ring):
    """Area-weighted centroid of one ring of [lon, lat] points, and its area."""
    a = cx = cy = 0.0
    for i in range(len(ring) - 1):
        x0, y0 = ring[i][0], ring[i][1]
        x1, y1 = ring[i + 1][0], ring[i + 1][1]
        f = x0 * y1 - x1 * y0
        a += f
        cx += (x0 + x1) * f
        cy += (y0 + y1) * f
    if abs(a) < 1e-15:
        xs = [p[0] for p in ring]
        ys = [p[1] for p in ring]
        return (sum(xs) / len(xs), sum(ys) / len(ys)), 0.0
    return (cx / (3 * a), cy / (3 * a)), abs(a) / 2


def centroid(geom):
    """Centroid of a GeoJSON polygon or multipolygon; holes are ignored and a
    multipart parcel takes the centroid of its largest part."""
    if not geom:
        return None
    polys = [geom["coordinates"]] if geom.get("type") == "Polygon" else geom.get("coordinates") if geom.get("type") == "MultiPolygon" else []
    best = None
    for poly in polys:
        if not poly or len(poly[0]) < 3:
            continue
        c, a = ring_centroid(poly[0])
        if best is None or a > best[1]:
            best = (c, a)
    return {"lon": round(best[0][0], 7), "lat": round(best[0][1], 7)} if best else None


class ParcelResults(dict):
    def __init__(self):
        super().__init__()
        self.failed = []
        self.errors = []


def city_parcels(ids):
    """{parcel: record} for the ids the city layer knows. Raises on a network
    failure so the caller can say so rather than caching an absence."""
    found = ParcelResults()
    url = settings().get("parcelQueryUrl") or PARCEL_QUERY
    for i in range(0, len(ids), PARCEL_BATCH):
        chunk = ids[i : i + PARCEL_BATCH]
        q = urlencode(
            {
                "where": "Parcel IN (%s)" % ",".join("'%s'" % x for x in chunk),
                "outFields": "Parcel,Address,AlderDistrict,BuildingDistrict",
                "returnGeometry": "true",
                "outSR": "4326",
                "f": "geojson",
            }
        )
        try:
            data = fetch_json(url + "?" + q)
            if "error" in data:
                raise RuntimeError("the parcel layer answered: %s" % data["error"])
        except Exception as exc:
            found.failed.extend(chunk)
            found.errors.append(str(exc))
            continue
        for ft in data.get("features") or []:
            pr = ft.get("properties") or {}
            pid = norm_parcel(pr.get("Parcel"))
            if not pid:
                continue
            c = centroid(ft.get("geometry"))
            found[pid] = {
                "address": pr.get("Address") or "",
                "alder": pr.get("AlderDistrict"),
                "building": pr.get("BuildingDistrict"),
                "lat": c["lat"] if c else None,
                "lon": c["lon"] if c else None,
            }
    return found


def cache_path():
    return gis_dir() / "parcels.json"


def read_cache():
    try:
        c = json.loads(cache_path().read_text(encoding="utf-8"))
        if isinstance(c, dict) and c.get("format") == "madison-parcel-cache" and all(isinstance(c.get(k, {}), dict) for k in ("parcels", "missing")):
            c.setdefault("parcels", {})
            c.setdefault("missing", {})
            c["parcels"] = {
                pid: entry
                for pid, entry in c["parcels"].items()
                if isinstance(entry, dict) and isinstance(entry.get("history"), list) and all(isinstance(h, dict) for h in entry["history"])
            }
            return c
    except (OSError, ValueError):
        pass
    return {"format": "madison-parcel-cache", "parcels": {}, "missing": {}}


def write_cache(c):
    target = cache_path()
    atomic_write(target, json.dumps(c, indent=1).encode("utf-8"))


def lookup_parcels(ids, refresh=False):
    """The history of each parcel's district and location. An entry is added
    only when something changed, so the first entry is the parcel as it was
    first seen and the last is the parcel as it is now."""
    today = time.strftime("%Y-%m-%d")
    want = sorted({x for x in (norm_parcel(i) for i in ids or []) if x})
    bad = sorted({str(i) for i in ids or [] if not norm_parcel(i)})
    with CACHE_LOCK, file_lock(gis_dir(), "parcel-cache"):
        c = read_cache()
        need = (
            want
            if refresh
            else [x for x in want if (x not in c["parcels"] and x not in c["missing"]) or (x in c["missing"] and c["missing"][x] != today)]
        )
        error, got = "", None
        if need:
            try:
                got = city_parcels(need)
            except Exception as e:
                got, error = None, "the city parcel layer could not be reached (%s)" % e
            if got is not None:
                failed = set(getattr(got, "failed", []))
                if failed:
                    error = "The city parcel layer could not be reached for some batches: " + "; ".join(got.errors)
                for pid in need:
                    if pid in failed:
                        continue
                    if pid not in got:
                        c["missing"][pid] = today
                        continue
                    c["missing"].pop(pid, None)
                    rec = got[pid]
                    hist = c["parcels"].setdefault(pid, {"history": []})["history"]
                    last = hist[-1] if hist else None
                    if last and all(last.get(k) == rec[k] for k in ("alder", "building", "lat", "lon")):
                        last["checked"] = today
                    else:
                        hist.append(dict(rec, fetched=today, checked=today))
                write_cache(c)
        return {
            "ok": not error,
            "error": error,
            "invalid": bad,
            "partial": bool(error and got),
            "parcels": {x: c["parcels"][x] for x in want if x in c["parcels"] and x not in c["missing"]},
            "missing": [x for x in want if x in c["missing"]],
        }


def read_areas():
    """Outline layers for shading. A file dropped into Reporting GIS always
    wins; the district outlines are otherwise downloaded once and kept."""
    g = gis_dir()
    out = {"ok": True, "districts": None, "zips": None, "notes": []}
    dfile = g / "alder-districts.geojson"
    if not dfile.exists():
        url = settings().get("districtsUrl") or DISTRICTS_URL
        try:
            data = fetch_json(url, timeout=40)
            if data.get("type") != "FeatureCollection":
                raise ValueError("the answer was not a GeoJSON feature collection")
            with file_lock(g, "alder-districts"):
                if not dfile.exists():
                    atomic_write(dfile, json.dumps(data).encode("utf-8"))
        except Exception as e:
            out["notes"].append("District outlines are not available (%s). Put an alder-districts.geojson in %s to shade districts." % (e, g))
    for key, name in (("districts", "alder-districts.geojson"), ("zips", "zip-codes.geojson")):
        f = g / name
        if f.exists():
            try:
                out[key] = json.loads(f.read_text(encoding="utf-8"))
                out[key + "Date"] = time.strftime("%Y-%m-%d", time.localtime(f.stat().st_mtime))
            except (OSError, ValueError) as e:
                out["notes"].append("%s could not be read (%s)" % (name, e))
    return out


def find_chrome():
    names = ["chrome.exe", "msedge.exe"]
    roots = [
        os.environ.get("ProgramFiles", r"C:\Program Files"),
        os.environ.get("ProgramFiles(x86)", r"C:\Program Files (x86)"),
        os.environ.get("LOCALAPPDATA", ""),
    ]
    subs = [
        r"Google\Chrome\Application",
        r"Microsoft\Edge\Application",
    ]
    for r in roots:
        for s in subs:
            for n in names:
                p = Path(r) / s / n
                if p.exists():
                    return str(p)
    if os.name != "nt":
        for n in ("google-chrome", "chromium", "chromium-browser"):
            p = shutil.which(n)
            if p:
                return p
    return None


def find_outlook():
    """Outlook's own /a switch attaches a file to a new message, which is the
    only reliable way to hand a browser-made PDF to the desktop client."""
    roots = [
        os.environ.get("ProgramFiles", r"C:\Program Files"),
        os.environ.get("ProgramFiles(x86)", r"C:\Program Files (x86)"),
    ]
    subs = [
        r"Microsoft Office\root\Office16",
        r"Microsoft Office\Office16",
        r"Microsoft Office\root\Office15",
        r"Microsoft Office\Office15",
    ]
    for r in roots:
        for sub in subs:
            p = Path(r) / sub / "OUTLOOK.EXE"
            if p.exists():
                return str(p)
    return None


@logged("email-draft")
def open_in_outlook(attachment: Path, subject: str, body: str, to: str = "") -> str:
    exe = find_outlook()
    mailto = "mailto:%s?subject=%s&body=%s" % (quote(to or "", safe="@;"), quote(subject or ""), quote(body or ""))
    if exe:
        subprocess.Popen(
            [exe, "/c", "ipm.note", "/m", mailto.removeprefix("mailto:")] + (["/a", str(attachment)] if attachment is not None else []),
            close_fds=True,
            creationflags=no_window(),
        )
        return "outlook"
    # no Outlook found: at least open the default mail client, unattached
    if os.name == "nt":
        os.startfile(mailto)  # noqa: S606
        return "default-client"
    raise RuntimeError("Outlook was not found on this computer")


@logged("pdf")
def make_pdf(html: str, target: Path) -> str:
    html = render_security.contained_html(html)
    chrome = find_chrome()
    if not chrome:
        raise RuntimeError("Chrome or Edge was not found, so the PDF could not be made")
    tmpdir = Path(tempfile.mkdtemp(prefix="dw-"))
    src = tmpdir / "doc.html"
    src.write_text(html, encoding="utf-8")
    # Chrome renders locally, so a disconnected share cannot masquerade as
    # renderer failure. The final atomic write surfaces storage OSError.
    part = tmpdir / (target.name + ".part-" + uuid.uuid4().hex)
    cmd = [
        chrome,
        "--headless=new",
        "--disable-gpu",
        "--disable-background-networking",
        "--disable-component-update",
        "--disable-extensions",
        "--disable-sync",
        "--host-resolver-rules=MAP * ~NOTFOUND",
        "--no-first-run",
        "--no-default-browser-check",
        "--user-data-dir=" + str(tmpdir / "profile"),
        "--no-pdf-header-footer",
        "--print-to-pdf-no-header",
        "--run-all-compositor-stages-before-draw",
        "--virtual-time-budget=6000",
        f"--print-to-pdf={part}",
        src.as_uri(),
    ]
    try:
        with RENDERERS:
            r = subprocess.run(cmd, capture_output=True, timeout=90, creationflags=no_window())
        why = (r.stderr or b"").decode("utf-8", "ignore")[-400:]
        if r.returncode != 0:
            raise RuntimeError(why or "the renderer exited with code %d" % r.returncode)
        if not part.exists() or part.stat().st_size == 0:
            raise RuntimeError(why or "Chrome produced no file")
        with part.open("rb") as fh:
            if fh.read(5) != b"%PDF-":
                raise RuntimeError("the renderer produced something that is not a PDF")
        # A historical issued PDF is immutable. Even a retry with newer
        # formatting cannot replace different bytes at the same name.
        file_pdf_bytes(target, part.read_bytes())
    finally:
        shutil.rmtree(tmpdir, ignore_errors=True)
        try:
            if part.exists():
                part.unlink()
        except OSError:
            pass
    return str(target)


PDF_CONFLICT = "An archived PDF already exists with different contents; it was not overwritten"


def archived_pdf_matches(target, raw):
    """False when the name is free; True for identical bytes; refuses links and different bytes."""
    try:
        info = target.lstat()
    except FileNotFoundError:
        return False
    if stat.S_ISLNK(info.st_mode) or getattr(info, "st_file_attributes", 0) & 0x400 or not stat.S_ISREG(info.st_mode):
        raise ValueError(PDF_CONFLICT)
    if target.read_bytes() != raw:
        raise ValueError(PDF_CONFLICT)
    return True


def file_pdf_bytes(target, raw):
    """The only way a PDF original reaches a filing folder: direct filing, outbox
    transfer and rendering all share this per-name lock and never replace bytes."""
    target = Path(target)
    target.parent.mkdir(parents=True, exist_ok=True)
    with file_lock(target.parent, "issued-pdf:" + target.name):
        if not archived_pdf_matches(target, raw):
            try:
                publish_new(target, raw)
            except FileExistsError:
                # Written meanwhile by something outside the program's locks.
                if not archived_pdf_matches(target, raw):
                    raise ValueError(PDF_CONFLICT) from None
    return str(target)


def safe_name(name: str) -> str:
    name = "".join(c for c in name if c not in '\\/:*?"<>|').strip()
    name = " ".join(name.split())
    if not name:
        name = "Document"
    stem = name[:-4] if name.lower().endswith(".pdf") else name
    stem = stem.rstrip(" .") or "Document"
    if len(stem) > 170:
        tag = re.search(r" - ([A-Za-z0-9]{8})$", stem)
        suffix = (" - " + tag[1]) if tag else ""
        stem = stem[: 145 - len(suffix)] + "-" + hashlib.sha256(stem.encode("utf-8")).hexdigest()[:20] + suffix
    if re.fullmatch(r"(?i)(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(?:\..*)?", stem):
        stem = "Document-" + stem
    return stem + ".pdf"


def artifact_candidates(name):
    # A filename is an identity, never a caller-supplied path. Both locations
    # are application-owned; unavailable SMB storage is handled by the outbox.
    if not isinstance(name, str) or name != safe_name(name) or not name.lower().endswith(".pdf"):
        raise ValueError("Invalid archived PDF name")
    return [share_root() / OUTDIR_NAME / name, HERE / OUTDIR_NAME / name]


def verified_artifact(name, checksum, doc_id):
    if not isinstance(checksum, str) or not re.fullmatch(r"[0-9a-f]{64}", checksum):
        raise ValueError("An archived checksum is required; this historical copy cannot be verified")
    if not isinstance(doc_id, str) or not re.fullmatch(r"[A-Za-z0-9_-]{2,100}", doc_id):
        raise ValueError("Invalid document identity")
    tag = re.sub(r"[^A-Za-z0-9]", "", doc_id)[-8:]
    if not tag or not name.endswith(" - " + tag + ".pdf"):
        raise ValueError("Archived PDF does not match this document identity")
    found = []
    for path in dict.fromkeys(artifact_candidates(name)):
        try:
            if not path.is_file():
                continue
            raw = path.read_bytes()
        except OSError:
            continue
        if not raw.startswith(b"%PDF-") or hashlib.sha256(raw).hexdigest() != checksum:
            raise ValueError("An archived PDF conflicts with this document's recorded checksum")
        found.append((path, raw))
    if not found:
        raise FileNotFoundError("The verified issued PDF is missing or shared storage is unavailable")
    return found[0]


def artifact_status(items):
    if not isinstance(items, list) or len(items) > 200:
        raise ValueError("Invalid artifact status list")
    result = []
    for item in items:
        if not isinstance(item, dict) or set(item) != {"filename", "sha256", "docId"}:
            raise ValueError("Invalid artifact status identity")
        # Apply the same name, identity and checksum constraints as read.
        name, sha, docid = item["filename"], item["sha256"], item["docId"]
        if (
            not isinstance(sha, str)
            or not re.fullmatch(r"[0-9a-f]{64}", sha)
            or not isinstance(docid, str)
            or not re.fullmatch(r"[A-Za-z0-9_-]{2,100}", docid)
        ):
            raise ValueError("Invalid artifact status identity")
        tag = re.sub(r"[^A-Za-z0-9]", "", docid)[-8:]
        if not tag or not name.endswith(" - " + tag + ".pdf"):
            raise ValueError("Artifact does not belong to this document")
        paths = artifact_candidates(name)
        locations = []
        for label, path in zip(("shared", "local"), paths):
            try:
                if path.is_file():
                    locations.append(label if hashlib.sha256(path.read_bytes()).hexdigest() == sha else label + " conflict")
            except OSError:
                locations.append(label + " unavailable")
        result.append({"docId": docid, "locations": locations})
    return {"ok": True, "items": result}


def outbox_count():
    if share_root() == HERE:
        return 0
    local = HERE / OUTDIR_NAME
    return len(list(local.glob("*.pdf"))) if local.is_dir() else 0


# Draft recovery is private to this helper installation. It never enters the
# issued-case folder or reporting index. Names are opaque browser identities.
BACKUP_ROOT = HERE / "Draft Backups"
BACKUP_ID = re.compile(r"[a-f0-9]{32}")
BACKUP_KEEP = 24


def backup_location(workspace, case):
    if not isinstance(workspace, str) or not BACKUP_ID.fullmatch(workspace):
        raise ValueError("Invalid workspace identity")
    if not isinstance(case, str) or not BACKUP_ID.fullmatch(case):
        raise ValueError("Invalid backup case identity")
    return BACKUP_ROOT / workspace / case


def validate_draft_deposits(value):
    if isinstance(value, dict):
        for c in value.get("cits", {}).values() if isinstance(value.get("cits"), dict) else []:
            if not isinstance(c, dict) or citation_pricing.cents(c.get("amount")) is None or citation_pricing.cents(c.get("amount")) <= 0:
                raise ValueError("Citation needs deposit before saving its draft; retain it as a deposit request")
        for child in value.values():
            validate_draft_deposits(child)
    elif isinstance(value, list):
        for child in value:
            validate_draft_deposits(child)


def _checked_backup(data):
    if set(data) != {"workspace", "case", "backup"}:
        raise ValueError("Invalid draft backup request")
    payload = data["backup"]
    if not isinstance(payload, dict) or payload.get("format") != "madison-draft-recovery" or payload.get("version") != 1:
        raise ValueError("Unsupported draft backup format")
    if payload.get("workspace") != data["workspace"] or payload.get("case") != data["case"]:
        raise ValueError("Draft backup identity differs from its location")
    validate_draft_deposits(payload)
    return payload


def _backups_to_keep(files):
    """Newest eight, then older daily and weekly representatives, up to two pre-replacement snapshots, then newest to the limit."""
    keep = set(files[:8])
    daily = {old.name[:8] for old in files[:8]}
    weekly = {datetime.strptime(old.name[:8], "%Y%m%d").strftime("%Y-%W") for old in files[:8]}
    daily_added, weekly_added, replacement = 0, 0, []
    for old in files[8:]:
        try:
            snapshot = json.loads(old.read_text(encoding="utf-8"))
            day_stamp = datetime.strptime(old.name[:8], "%Y%m%d")
            day, week = old.name[:8], day_stamp.strftime("%Y-%W")
            if snapshot.get("preReplacement"):
                replacement.append(old)
            elif day not in daily and daily_added < 10:
                keep.add(old)
                daily.add(day)
                daily_added += 1
                weekly.add(week)
            elif week not in weekly and weekly_added < 4:
                keep.add(old)
                weekly.add(week)
                weekly_added += 1
                daily.add(day)
        except (OSError, ValueError, TypeError) as error:
            record("backup-retention", "failed", error=error)
            continue
    keep.update(replacement[:2])
    for old in files:
        if len(keep) >= BACKUP_KEEP:
            break
        keep.add(old)
    return keep


def _trim_backups(folder):
    try:
        files = sorted(folder.glob("*.json"), reverse=True)
        keep = _backups_to_keep(files)
        for old in files:
            if old not in keep:
                try:
                    old.unlink()
                except OSError as error:
                    record("backup-retention", "failed", error=error)
    except Exception as error:
        record("backup-retention", "failed", error=error)  # New snapshot stays available.


@logged("backup")
def backup_write(data):
    payload = _checked_backup(data)
    folder = backup_location(data["workspace"], data["case"])
    raw = json.dumps(payload, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    if len(raw) > MAX_BODY:
        raise ValueError("Draft backup exceeds the size limit")
    folder.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S%fZ")
    name = stamp + "-" + hashlib.sha256(raw).hexdigest()[:12] + ".json"
    with file_lock(folder, "draft-backup"):
        atomic_write(folder / name, raw)
        _trim_backups(folder)
    return {"ok": True, "at": stamp, "name": name}


def backup_list():
    rows = []
    if BACKUP_ROOT.is_dir():
        for path in BACKUP_ROOT.glob("*/*/*.json"):
            if not BACKUP_ID.fullmatch(path.parent.name) or not BACKUP_ID.fullmatch(path.parent.parent.name):
                continue
            try:
                payload = json.loads(path.read_text(encoding="utf-8"))
                if payload.get("format") != "madison-draft-recovery":
                    continue
                rows.append(
                    {
                        "workspace": path.parent.parent.name,
                        "case": path.parent.name,
                        "name": path.name,
                        "at": payload.get("at", ""),
                        "number": payload.get("number", ""),
                        "included": payload.get("included", []),
                    }
                )
            except (OSError, ValueError, AttributeError):
                rows.append(
                    {"workspace": path.parent.parent.name, "case": path.parent.name, "name": path.name, "at": "", "error": "Unreadable backup"}
                )
    return {"ok": True, "backups": sorted(rows, key=lambda x: x["name"], reverse=True)[:500]}


def backup_read(data):
    if set(data) != {"workspace", "case", "name"}:
        raise ValueError("Invalid draft backup request")
    folder = backup_location(data["workspace"], data["case"])
    name = data["name"]
    if not isinstance(name, str) or not re.fullmatch(r"\d{8}T\d{12}Z-[a-f0-9]{12}\.json", name):
        raise ValueError("Invalid draft backup name")
    raw = (folder / name).read_bytes()
    if hashlib.sha256(raw).hexdigest()[:12] != name[-17:-5]:
        raise ValueError("Draft backup checksum does not match")
    return {"ok": True, "backup": json.loads(raw)}


def catalog_path():
    return share_root() / "Catalog Review" / "reviews.json"


def catalog_events():
    path = catalog_path()
    if share_root() != HERE and not share_root().is_dir():
        raise OSError("Shared catalog storage is unavailable")
    if not path.exists():
        return []
    value = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(value, dict) or value.get("format") != "madison-catalog-review" or not isinstance(value.get("events"), list):
        raise ValueError("Catalog review record is unreadable")
    return value["events"]


def _validated_catalog_review_request(data):
    if set(data) not in (
        {"key", "status", "reviewer", "wording", "ordinances", "source", "replaces"},
        {"key", "status", "reviewer", "wording", "ordinances", "source", "replaces", "expectedVersion"},
    ):
        raise ValueError("Invalid catalog review request")
    key, status = data["key"], data["status"]
    if not isinstance(key, str) or not re.fullmatch(r'\["[A-Za-z0-9_]+","[A-Za-z0-9_]+",\d+\]', key) or status not in ("approved", "retired"):
        raise ValueError("Invalid catalog identity or status")
    if data["replaces"] and (not re.fullmatch(r'\["[A-Za-z0-9_]+","[A-Za-z0-9_]+",\d+\]', data["replaces"]) or data["replaces"] == key):
        raise ValueError("Invalid replacement relationship")
    manifest = json.loads((resource("catalog_manifest.json")).read_text(encoding="utf-8"))
    if (
        manifest.get("format") != "madison-catalog-manifest"
        or key not in manifest.get("items", {})
        or data["replaces"]
        and data["replaces"] not in manifest["items"]
    ):
        raise ValueError("Catalog key or replacement is not in the bundled catalog")
    if not isinstance(data["ordinances"], list) or not all(isinstance(s, str) and 1 <= len(s.strip()) <= 100 for s in data["ordinances"]):
        raise ValueError("Invalid ordinance references")
    if any(not isinstance(data[n], str) or len(data[n].strip()) > 5000 for n in ("reviewer", "wording", "source", "replaces")):
        raise ValueError("Invalid catalog review fields")
    if not data["reviewer"].strip() or not data["source"].strip() or status == "approved" and (not data["wording"].strip() or not data["ordinances"]):
        raise ValueError("Reviewer, source, approved wording and ordinance references are required")
    return key, status


def catalog_review(data):
    key, status = _validated_catalog_review_request(data)
    path = catalog_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    with file_lock(path.parent, "catalog-review"):
        events = catalog_events()
        version = 1 + max((e.get("version", 0) for e in events if e.get("key") == key), default=0)
        if "expectedVersion" in data and data["expectedVersion"] != version - 1:
            raise ValueError("Catalog entry changed since this review form opened; compare versions before saving")
        if data["replaces"]:
            current = {e["key"]: e for e in events}
            chain = {x: e.get("replaces") for x, e in current.items() if e.get("status") == "approved"}
            chain[key] = data["replaces"]
            seen = {key}
            node = data["replaces"]
            while node:
                if node in seen:
                    raise ValueError("Catalog replacement relationship has a cycle")
                seen.add(node)
                node = chain.get(node)
        event = {
            "id": str(uuid.uuid4()),
            "key": key,
            "status": status,
            "version": version,
            "at": datetime.now(timezone.utc).isoformat(),
            **{k: v for k, v in data.items() if k != "expectedVersion"},
        }
        events.append(event)
        atomic_write(
            path, json.dumps({"format": "madison-catalog-review", "version": 1, "events": events}, ensure_ascii=False, indent=2).encode("utf-8")
        )
    return {"ok": True, "event": event, "events": events}


@logged("outbox")
def sync_outbox():
    if share_root() == HERE:
        return {"ok": True, "moved": 0, "remaining": 0}
    items = workflow_helper.outbox_files(sys.modules[__name__])["files"]
    moved, conflicts = 0, []
    for offset in range(0, len(items), 200):
        batch = [{"name": x["name"], "sha256": x["sha256"]} for x in items[offset : offset + 200]]
        result = workflow_helper.sync_selected(sys.modules[__name__], {"items": batch})["result"]
        moved += result["moved"]
        conflicts.extend(result["conflicts"])
    return {
        "ok": not conflicts,
        "moved": moved,
        "remaining": outbox_count(),
        "conflicts": conflicts,
        "error": "Different PDFs with the same name need review" if conflicts else "",
    }


# ---------------------------------------------------------------- safe shutdown (Exit Document Writer)
# Work this helper is doing right now, counted per kind. Memory only; no new persistence. A POST is counted
# for as long as its handler runs, so a save, PDF render/filing, outbox transfer or recovery copy in progress
# (from any Writer or Reports window) refuses /helper/shutdown. Labels never name a case or a file.
ACTIVITY_LOCK = threading.Lock()
ACTIVE_WORK = {}
STOPPING = threading.Event()
POST_ACTIVITY = {
    "/cases/save": "A case record is being saved to the shared folder.",
    "/cases/summary": "A case record is being saved to the shared folder.",
    "/save-pdf": "A PDF is being made or filed.",
    "/email": "An email is being prepared in Outlook.",
    "/outbox/sync": "PDFs are being transferred from the local outbox.",
    "/outbox/batch-sync": "PDFs are being transferred from the local outbox.",
    "/draft-backups/write": "A recovery copy is being written.",
    "/catalog/review": "A catalog review is being recorded.",
    "/locks/release": "A shared lock is being released by an administrator.",
    "/administration/deposit-override": "An administrator decision is being recorded.",
    "/administration/snow-letter": "An administrator decision is being recorded.",
    "/reporting/parcels": "Reports is looking up parcels.",
}
OTHER_ACTIVITY = "Another Writer or Reports window is waiting for the helper."
LOCK_ACTIVITY = {
    "case": "A case record is locked while it is being saved.",
    "issued-pdf": "An issued PDF is being filed.",
    "pdf-operation": "A PDF publication is in progress.",
    "pdf-outbox": "The local PDF outbox is being updated.",
    "citation-pricing": "Citation pricing is being recorded.",
    "integrity-registry": "Record integrity information is being updated.",
    "integrity-anchor": "Record integrity information is being updated.",
}
INSTALL_JOURNAL = "install-transaction.json"
STOPPED_MESSAGE = "Document Writer is stopping. To start again, double-click Document Writer on the desktop."


def begin_activity(label):
    """Count one piece of work; False once the helper has agreed to stop (nothing new may start)."""
    with ACTIVITY_LOCK:
        if STOPPING.is_set():
            return False
        ACTIVE_WORK[label] = ACTIVE_WORK.get(label, 0) + 1
        return True


def end_activity(label):
    with ACTIVITY_LOCK:
        ACTIVE_WORK[label] -= 1
        if ACTIVE_WORK[label] <= 0:
            del ACTIVE_WORK[label]


def run_anchor_once():
    """Register background integrity work before it can acquire a lock or write a diagnostic."""
    label = "Record integrity information is being updated."
    if not begin_activity(label):
        return False
    try:
        case_integrity.anchor_after_save(case_dir())
        return True
    finally:
        end_activity(label)


def active_work():
    """Readable reasons the helper must keep running. Caller holds ACTIVITY_LOCK."""
    reasons = list(dict.fromkeys(label for label, count in ACTIVE_WORK.items() if count))
    for kind in held_lock_kinds():
        reasons.append(LOCK_ACTIVITY.get(kind, "A shared-folder lock is held."))
    if (HERE / INSTALL_JOURNAL).exists():
        reasons.append("A program update is being installed.")
    return list(dict.fromkeys(reasons))


def agree_to_stop():
    """Refuse (reasons) or, atomically with the check, stop accepting new work ([])."""
    with ACTIVITY_LOCK:
        reasons = active_work()
        if not reasons:
            STOPPING.set()
        return reasons


def stop_serving(httpd, answered):
    """Separate thread: let the shutdown answer reach the page, then end serve_forever (the socket closes in main)."""
    answered.wait(5)
    httpd.shutdown()


class Handler(http.server.SimpleHTTPRequestHandler):
    timeout = 60  # a half-sent request must not hold a thread forever

    def __init__(self, *a, **kw):
        super().__init__(*a, directory=str(HERE), **kw)

    def end_headers(self):
        route = urlsplit(self.path).path
        if route in ("/", "/madison-document-writer.html", "/madison-reports.html"):
            name = "madison-document-writer.html" if route == "/" else route.lstrip("/")
            value = getattr(self, "app_csp", None) or render_security.app_policy(
                resource(name).read_text(encoding="utf-8"), route == "/madison-reports.html"
            )
            self.send_header("Content-Security-Policy", value)
        self.send_header("X-Content-Type-Options", "nosniff")
        # The program is replaced on the share from time to time. A cached copy
        # would leave an inspector looking at last week's build with no clue,
        # so nothing served here is allowed to be reused.
        self.send_header("Cache-Control", "no-store, must-revalidate")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()

    def log_message(self, fmt, *args):
        pass  # Request URLs can contain case numbers; never log them.

    def _json(self, code, payload):
        body = json.dumps(payload).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _has_secret(self, name, expected):
        value = self.headers.get(name, "")
        try:
            return hmac.compare_digest(value.encode("ascii"), expected.encode("ascii"))
        except (UnicodeError, TypeError):
            return False

    def _has_token(self):
        return self._has_secret("X-DocWriter-Token", SESSION_TOKEN)

    def _guard_read(self):
        """The read endpoints return the case record, so they too answer only
        to this machine's own page."""
        host = (self.headers.get("Host") or "").rsplit(":", 1)[0].strip("[]")
        if host not in ("127.0.0.1", "localhost", "::1"):
            return "this endpoint answers only to the local page"
        origin = self.headers.get("Origin")
        if origin and origin not in ("http://127.0.0.1:%d" % PORT, "http://localhost:%d" % PORT):
            return "the request came from another site"
        site = self.headers.get("Sec-Fetch-Site")
        if site and site not in ("same-origin", "none"):
            return "the request came from another site"
        route = urlsplit(self.path).path
        if route == "/session/bootstrap" and self.command == "POST":
            if not (self._has_token() or self._has_secret("X-DocWriter-Bootstrap", SESSION_BOOTSTRAP)):
                return "Forbidden"
        elif not (self.command in ("GET", "HEAD") and route in STATIC_ROUTES or self.command == "GET" and route == "/dw-status"):
            if not self._has_token():
                return "Forbidden"
        return None

    def do_HEAD(self):
        if self._guard_read() or urlsplit(self.path).path not in ("/", "/madison-document-writer.html", "/madison-reports.html"):
            self.send_error(403)
            return
        if urlsplit(self.path).path == "/":
            self.path = "/madison-document-writer.html"
        return super().do_HEAD()

    def do_GET(self):
        refused = self._guard_read()
        if refused:
            return self._json(403, {"ok": False, "error": refused})
        route = urlsplit(self.path).path
        handler = GET_ROUTES.get(route) or (Handler._get_reporting if self.path.startswith("/reporting/") else None)
        if handler:
            return handler(self, route)
        if route == "/favicon.ico":
            return self._favicon()
        if route == "/":
            self.path = "/madison-document-writer.html"
        elif route not in (
            "/madison-document-writer.html",
            "/madison-reports.html",
            "/PROGRAM-MANUAL.html",
            "/PROGRAM-MANUAL.md",
            "/Program_Instruction_Manual.pdf",
            "/Program_Instruction_Manual.docx",
        ):
            return self._json(404, {"ok": False, "error": "Not found"})
        if route in ("/", "/madison-document-writer.html", "/madison-reports.html"):
            name = "madison-document-writer.html" if route == "/" else route.lstrip("/")
            value = resource(name).read_text(encoding="utf-8")
            token = SESSION_TOKEN if self._has_token() else ""
            head = (
                '<meta name="docwriter-token" content="' + token + '">'
                '<meta name="docwriter-instance" content="' + HELPER_INSTANCE + '"><script>' + helper_session.BOOTSTRAP_SCRIPT + "</script>"
            )
            value = value.replace("<head>", "<head>" + head, 1)
            # Start only after authenticated bootstrap has completed. Nothing secret
            # is supplied to an unauthenticated page or written to the runtime file.
            value = re.sub(
                r"(<script>)(\s*\(function\(\)\{var B=.*?)(</script>)",
                lambda m: m[1]
                + "window.__DW_SESSION_READY__.then(function(){"
                + m[2]
                + "}).catch(function(error){document.getElementById('app').textContent=error.message;});"
                + m[3],
                value,
                count=1,
                flags=re.S,
            )
            self.app_csp = render_security.app_policy(value, route == "/madison-reports.html")
            raw = value.encode()
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(raw)))
            self.end_headers()
            self.wfile.write(raw)
            return
        return super().do_GET()

    def _favicon(self):
        try:
            raw = resource(FAVICON).read_bytes()
        except OSError:
            return self._json(404, {"ok": False, "error": "Not found"})
        self.send_response(200)
        self.send_header("Content-Type", "image/x-icon")
        self.send_header("Content-Length", str(len(raw)))
        self.end_headers()
        self.wfile.write(raw)

    def _administration_post(self, route):
        import admin_rules

        try:
            size = int(self.headers.get("Content-Length", "0"))
            if not 0 < size <= 65536:
                raise ValueError("Invalid request size")
            data = json.loads(self.rfile.read(size))
            if not isinstance(data, dict):
                raise ValueError("Expected JSON object")
            result = (
                admin_rules.authorize_override(case_dir(), data)
                if route.endswith("deposit-override")
                else admin_rules.update_letter(case_dir(), data)
            )
            return self._json(200, result)
        except (OSError, ValueError, TypeError, KeyError) as error:
            return self._json(400, {"ok": False, "error": str(error)})

    def do_POST(self):
        if self._guard_read():
            return self._json(403, {"ok": False, "error": "Forbidden"})
        route = urlsplit(self.path).path
        handler = POST_ROUTES.get(route)
        if handler:
            # Every API POST is JSON from this machine's own page; checked here so no route can skip it.
            refused = self._guard()
            if refused:
                return self._json(403, {"ok": False, "error": "Forbidden" if route == "/session/bootstrap" else refused})
            if handler is Handler._post_shutdown:
                return handler(self, route)
            label = POST_ACTIVITY.get(route, OTHER_ACTIVITY)
            if not begin_activity(label):
                return self._json(503, {"ok": False, "error": STOPPED_MESSAGE})
            try:
                return handler(self, route)
            finally:
                end_activity(label)
        return self._json(404, {"ok": False, "error": "unknown endpoint"})

    def _post_shutdown(self, route):
        """Exit Document Writer. Authenticated and guarded like every POST route (token, Host, Origin,
        fetch-site, JSON). Refused with the reasons while this helper is doing work it knows about; a client
        "force" only records that the user acknowledged client-side warnings and never overrides a refusal."""
        try:
            size = int(self.headers.get("Content-Length", "0"))
            if not 0 < size <= 256:
                raise ValueError("Invalid shutdown request")
            data = json.loads(self.rfile.read(size))
            if not isinstance(data, dict) or set(data) - {"force"} or type(data.get("force", False)) is not bool:
                raise ValueError("Invalid shutdown request")
        except (ValueError, TypeError):
            return self._json(400, {"ok": False, "error": "Invalid shutdown request"})
        reasons = agree_to_stop()
        if reasons:
            record("shutdown", "conflict")
            return self._json(
                409,
                {
                    "ok": False,
                    "error": "Document Writer is still working, so it was not stopped. Wait for this work to finish, then exit again.",
                    "reasons": reasons,
                },
            )
        record("shutdown", "ok")
        answered = threading.Event()
        threading.Thread(target=stop_serving, args=(self.server, answered), name="helper-shutdown", daemon=True).start()
        try:
            self._json(200, {"ok": True, "stopping": True})
        finally:
            answered.set()

    def _get_lock_status(self, route):
        try:
            return self._json(200, operations_helper.lock_status(case_dir(), parse_qs(urlsplit(self.path).query).get("number", [""])[0]))
        except (ValueError, TypeError) as error:
            return self._json(400, {"ok": False, "error": str(error)})
        except OSError:
            return self._json(503, {"ok": False, "error": "Shared case folder unavailable"})

    def _get_workflow_reads(self, route):
        try:
            if route == "/cases/search":
                result = workflow_helper.search_cases(case_dir(), parse_qs(urlsplit(self.path).query).get("q", [""])[0])
            elif route == "/outbox/list":
                result = workflow_helper.outbox_files(sys.modules[__name__])
            else:
                result = workflow_helper.shared_views(case_dir())
            return self._json(200, result)
        except (ValueError, TypeError) as error:
            return self._json(400, {"ok": False, "error": str(error)})
        except OSError:
            return self._json(503, {"ok": False, "error": "Shared folder unavailable"})

    def _get_snow_letter(self, route):
        import snow_rules

        refused = self._guard_read()
        if refused:
            return self._json(403, {"ok": False, "error": refused})
        try:
            return self._json(200, {"ok": True, "letter": snow_rules.validate_letter(snow_rules.read_letter(case_dir()))})
        except (OSError, ValueError, TypeError) as error:
            return self._json(400, {"ok": False, "error": str(error)})

    def _get_citation_history(self, route):
        try:
            return self._json(200, citation_history(case_dir()))
        except (ValueError, TypeError):
            return self._json(400, {"ok": False, "error": "Shared citation history is incomplete. Resolve unreadable or duplicate case records."})
        except OSError:
            return self._json(503, {"ok": False, "error": "Shared citation history unavailable"})

    def _get_case_list(self, route):
        try:
            cd = case_dir()
            if not cd.is_dir():
                raise OSError("The shared case folder is unavailable")
            files = [
                {"name": p.name, "size": p.stat().st_size, "mod": p.stat().st_mtime * 1000} for p in cd.glob("*.json") if not p.name.startswith("_")
            ]
            return self._json(200, {"ok": True, "files": sorted(files, key=lambda p: p["mod"], reverse=True)})
        except Exception as error:
            return self._json(503, {"ok": False, "error": str(error)})

    def _get_case_open(self, route):
        try:
            return self._json(200, read_case(case_dir(), parse_qs(urlsplit(self.path).query).get("name", [""])[0]))
        except FileNotFoundError:
            return self._json(404, {"ok": False, "missing": True, "error": "Case file not found"})
        except Exception as error:
            return self._json(400, {"ok": False, "error": str(error)})

    def _get_case_resolve(self, route):
        try:
            number = parse_qs(urlsplit(self.path).query).get("number", [""])[0]
            number_key = case_number_key(number)
            folder = case_dir()
            if not folder.is_dir():
                return self._json(503, {"ok": False, "error": "The shared case folder is unavailable"})
            names = [p.name for p in folder.glob("*.json") if case_file_key(p) == number_key]
            if not names:
                raise FileNotFoundError("Case file not found")
            if len(names) != 1:
                raise ValueError("Conflicting case files for this number")
            found = read_case(case_dir(), names[0])
            if case_number_key(found["file"]["case"]["number"]) != number_key:
                raise ValueError("Case number differs from its filename")
            return self._json(200, found)
        except FileNotFoundError as error:
            return self._json(404, {"ok": False, "missing": True, "error": str(error)})
        except OSError:
            return self._json(503, {"ok": False, "error": "The shared case folder is unavailable"})
        except Exception as error:
            return self._json(400, {"ok": False, "error": str(error)})

    def _get_reporting(self, route):
        try:
            if self.path.startswith("/reporting/index"):
                return self._json(200, read_index())
            if self.path.startswith("/reporting/parcels"):
                with CACHE_LOCK:
                    c = read_cache()
                return self._json(
                    200,
                    {"ok": True, "parcels": {p: v for p, v in c["parcels"].items() if p not in c["missing"]}, "missing": sorted(c["missing"])},
                )
            if self.path.startswith("/reporting/areas"):
                return self._json(200, read_areas())
        except Exception as e:
            return self._json(500, {"ok": False, "error": str(e)})
        return self._json(404, {"ok": False, "error": "unknown endpoint"})

    def _get_status(self, route):
        if not self._has_token():
            return self._json(200, {"ok": True, "version": HELPER_VERSION, "ready": True})
        status = {
            "ok": True,
            "version": HELPER_VERSION,
            "caseStore": True,
            "caseDir": "",
            "caseReachable": False,
            "out": "",
            "outReachable": False,
            "outLocal": False,
            "outbox": 0,
            "chrome": bool(find_chrome()),
            "outlook": bool(find_outlook()),
        }
        try:
            folder = case_dir()
            status.update(caseDir=str(folder), caseReachable=folder.is_dir())
        except (OSError, ValueError):
            pass
        try:
            dest = out_dir()
            status.update(
                out=str(dest), outReachable=dest.is_dir(), outLocal=dest == HERE / OUTDIR_NAME and share_root() != HERE, outbox=outbox_count()
            )
        except (OSError, ValueError):
            pass
        status.update(operations_helper.health(sys.modules[__name__]))
        return self._json(200, status)

    def _get_backup_list(self, route):
        try:
            return self._json(200, backup_list())
        except Exception as error:
            return self._json(503, {"ok": False, "error": str(error)})

    def _get_catalog_reviews(self, route):
        try:
            return self._json(200, {"ok": True, "events": catalog_events()})
        except Exception as error:
            return self._json(503, {"ok": False, "error": str(error)})

    def _post_session_bootstrap(self, route):
        try:
            size = int(self.headers.get("Content-Length", "0"))
            if not 0 < size <= 16 or json.loads(self.rfile.read(size)) != {}:
                raise ValueError("Invalid bootstrap request")
        except (ValueError, TypeError):
            return self._json(400, {"ok": False, "error": "Invalid bootstrap request"})
        return self._json(200, {"ok": True, "token": SESSION_TOKEN, "bootstrap": SESSION_BOOTSTRAP})

    def _post_lock_or_probe(self, route):
        try:
            size = int(self.headers.get("Content-Length", "0"))
            if not 0 < size <= 4096:
                raise ValueError("Invalid request size")
            data = json.loads(self.rfile.read(size))
            if not isinstance(data, dict):
                raise ValueError("Expected JSON object")
            if route == "/locks/release":
                result = operations_helper.release_lock(case_dir(), data)
            else:
                if data:
                    raise ValueError("No setup parameters expected")
                result = {
                    "ok": True,
                    "version": HELPER_VERSION,
                    "chrome": bool(find_chrome()),
                    "outlook": bool(find_outlook()),
                    **operations_helper.health(sys.modules[__name__], True),
                }
            return self._json(200, result)
        except (ValueError, TypeError, KeyError) as error:
            return self._json(400, {"ok": False, "error": str(error)})
        except (OSError, RuntimeError):
            return self._json(503, {"ok": False, "error": "Shared case folder unavailable; no lock released"})

    def _post_workflow(self, route):
        try:
            size = int(self.headers.get("Content-Length", "0"))
            if not 0 < size <= 32768:
                raise ValueError("Invalid request size")
            data = json.loads(self.rfile.read(size))
            if route == "/outbox/read":
                _, raw = workflow_helper.outbox_read(sys.modules[__name__], data)
                self.send_response(200)
                self.send_header("Content-Type", "application/pdf")
                self.send_header("Content-Length", str(len(raw)))
                self.end_headers()
                return self.wfile.write(raw)
            if route == "/outbox/batch-sync":
                result = workflow_helper.sync_selected(sys.modules[__name__], data)
            elif route == "/reporting/views":
                result = workflow_helper.save_view(case_dir(), data)
            else:
                result = workflow_helper.reminder_draft(sys.modules[__name__], data)
            return self._json(200, result)
        except (ValueError, TypeError, KeyError) as error:
            return self._json(400, {"ok": False, "error": str(error)})
        except (OSError, RuntimeError):
            return self._json(503, {"ok": False, "error": "Operation unavailable; local work kept"})

    def _post_address_parse(self, route):
        try:
            n = int(self.headers.get("Content-Length", "0"))
            if not 0 < n <= 12000:
                raise ValueError("Invalid address request size")
            data = json.loads(self.rfile.read(n).decode("utf-8"))
            if not isinstance(data, dict) or set(data) != {"raw"}:
                raise ValueError("Expected only a raw mailing address")
            return self._json(200, {"ok": True, **address_parser.parse_address(data["raw"])})
        except (ValueError, TypeError):
            return self._json(400, {"ok": False, "error": "Invalid local address parse request"})

    def _post_case_lookup(self, route):
        try:
            n = int(self.headers.get("Content-Length", "0"))
            if not 0 < n <= 2048:
                return self._json(413, {"ok": False, "error": "Invalid lookup request size"})
            data = json.loads(self.rfile.read(n).decode("utf-8"))
            if not isinstance(data, dict) or set(data) != {"caseNumber"}:
                raise ValueError("Expected only a caseNumber")
            return self._json(200, lookup_case(share_root(), data["caseNumber"]))
        except CaseLookupError as error:
            return self._json(error.status, {"ok": False, "error": str(error)})
        except (ValueError, TypeError):
            return self._json(400, {"ok": False, "error": "Invalid case lookup request"})
        except Exception:
            return self._json(503, {"ok": False, "error": "Case lookup is unavailable. Check the installation and retry; your work is kept."})

    def _post_shared_records(self, route):
        try:
            n = int(self.headers.get("Content-Length", "0"))
            if not 0 < n <= MAX_BODY:
                return self._json(413, {"ok": False, "error": "Invalid request size"})
            data = json.loads(self.rfile.read(n).decode("utf-8"))
            if not isinstance(data, dict):
                raise ValueError("Expected a JSON object")
            if route == "/cases/save":
                answer = save_case(
                    case_dir(),
                    data.get("name"),
                    data.get("file"),
                    data.get("baseRevision", ""),
                    data.get("baseCase"),
                    data.get("idempotencyEvent", ""),
                    catalog_path(),
                    resource("catalog_manifest.json"),
                )
            elif route == "/cases/summary":
                answer = save_summary(case_dir(), data.get("name"), data.get("revision"), data.get("summary"))
            elif route == "/cases/probe":
                with tempfile.NamedTemporaryFile(prefix="._dw-check-", dir=case_dir()) as probe:
                    probe.write(b"Madison Document Writer connection check")
                    probe.flush()
                    os.fsync(probe.fileno())
                answer = {"ok": True}
            elif route == "/draft-backups/write":
                answer = backup_write(data)
            elif route == "/draft-backups/read":
                answer = backup_read(data)
            elif route == "/catalog/review":
                answer = catalog_review(data)
            elif route == "/artifact/status":
                answer = artifact_status(data.get("items"))
            else:
                answer = sync_outbox()
            return self._json(200, answer)
        except (ValueError, TypeError) as error:
            return self._json(400, {"ok": False, "error": str(error)})
        except Exception as error:
            return self._json(503, {"ok": False, "error": str(error)})

    def _post_artifact_read(self, route):
        try:
            n = int(self.headers.get("Content-Length") or 0)
            if not 0 < n <= 4096:
                raise ValueError("Invalid artifact request size")
            data = json.loads(self.rfile.read(n).decode("utf-8"))
            if not isinstance(data, dict) or set(data) != {"filename", "sha256", "docId"}:
                raise ValueError("Invalid artifact request")
            path, raw = verified_artifact(data["filename"], data["sha256"], data["docId"])
            if len(raw) > MAX_BODY:
                raise ValueError("Archived PDF exceeds the response limit")
            return self._json(
                200,
                {"ok": True, "pdf": base64.b64encode(raw).decode("ascii"), "sha256": data["sha256"], "local": path.parent == HERE / OUTDIR_NAME},
            )
        except (ValueError, TypeError, KeyError) as error:
            return self._json(400, {"ok": False, "error": str(error)})
        except FileNotFoundError as error:
            return self._json(404, {"ok": False, "error": str(error)})
        except Exception as error:
            return self._json(503, {"ok": False, "error": str(error)})

    def _post_save_pdf(self, route):
        return self._pdf(email=False)

    def _post_email(self, route):
        return self._pdf(email=True)

    def _post_parcels(self, route):
        try:
            n = int(self.headers.get("Content-Length") or 0)
            if n <= 0 or n > 1024 * 1024:
                return self._json(413, {"ok": False, "error": "that request is not a parcel list"})
            data = json.loads(self.rfile.read(n).decode("utf-8"))
            ids = data.get("ids") or []
            if not isinstance(ids, list) or len(ids) > 5000:
                return self._json(400, {"ok": False, "error": "ids must be a list of parcels"})
            return self._json(200, lookup_parcels(ids, bool(data.get("refresh"))))
        except Exception as e:
            return self._json(500, {"ok": False, "error": str(e)})

    def _guard(self):
        """Only this machine's own page may drive the helper.

        These endpoints write files and open Outlook, so they are not for
        general callers. Requiring JSON also means any cross-origin attempt
        has to ask permission first, which nothing here ever answers.
        """
        host = (self.headers.get("Host") or "").rsplit(":", 1)[0].strip("[]")
        if host not in ("127.0.0.1", "localhost", "::1"):
            return "this endpoint answers only to the local page"
        allowed = ("http://127.0.0.1:%d" % PORT, "http://localhost:%d" % PORT)
        origin = self.headers.get("Origin")
        if origin and origin not in allowed:
            return "the request came from another site"
        site = self.headers.get("Sec-Fetch-Site")
        if site and site not in ("same-origin", "none"):
            return "the request came from another site"
        ctype = (self.headers.get("Content-Type") or "").split(";")[0].strip().lower()
        if ctype != "application/json":
            return "expected application/json"
        return None

    def _pdf(self, email=False):
        try:
            raw = self.headers.get("Content-Length")
            if raw is None or not raw.strip().isdigit():
                return self._json(411, {"ok": False, "error": "a length is required"})
            n = int(raw)
            if n <= 0 or n > MAX_BODY:
                return self._json(413, {"ok": False, "error": "that document is too large to accept"})
            data = json.loads(self.rfile.read(n).decode("utf-8"))
            if not isinstance(data, dict):
                raise ValueError("Expected a JSON object")
            name = safe_name(str(data.get("filename") or "Document"))
            html = data.get("html") or ""
            if not isinstance(html, str):
                raise ValueError("Expected document HTML")
            if not email and "operation" in data:
                if not html.strip():
                    raise ValueError("no document was supplied")
                return self._json(200, artifact_store.file_operation(sys.modules[__name__], data, name, html))
            target = out_dir() / name
            if email and data.get("sha256"):
                target, _ = verified_artifact(name, data["sha256"], data.get("docId"))
                path = str(target)
            elif email and data.get("reuse"):
                raise ValueError("The archived issued PDF must be verified before repeat distribution")
            else:
                if not html.strip():
                    raise ValueError("no document was supplied")
                with tempfile.TemporaryDirectory(prefix="dw-rendered-") as temporary:
                    rendered = Path(temporary) / name
                    # Renderer/startup errors propagate; only filing can use outbox.
                    make_pdf(html, rendered)
                    pdf_bytes = rendered.read_bytes()
                    try:
                        path = file_pdf_bytes(target, pdf_bytes)
                    except OSError:
                        local = HERE / OUTDIR_NAME
                        if target.parent == local:
                            raise
                        target = local / name
                        path = file_pdf_bytes(target, pdf_bytes)
            record("pdf", "ok")
            if not email:
                return self._json(
                    200,
                    {
                        "ok": True,
                        "path": path,
                        "name": name,
                        "local": target.parent == HERE / OUTDIR_NAME and share_root() != HERE,
                        "sha256": hashlib.sha256(Path(path).read_bytes()).hexdigest(),
                    },
                )
            how = open_in_outlook(Path(path), data.get("subject") or name, data.get("body") or "", data.get("to") or "")
            record("email-draft", "ok")
            return self._json(200, {"ok": True, "path": path, "name": name, "via": how})
        except Exception as e:
            record("email-draft" if email else "pdf", "failed", error=e)
            return self._json(400 if isinstance(e, (ValueError, TypeError)) else 500, {"ok": False, "error": str(e)})


# Every API route and the Handler method that answers it. do_GET/do_POST apply the shared guards first;
# a mistyped method name fails at import.
GET_ROUTES = {
    "/locks/status": Handler._get_lock_status,
    "/cases/search": Handler._get_workflow_reads,
    "/outbox/list": Handler._get_workflow_reads,
    "/reporting/views": Handler._get_workflow_reads,
    "/administration/snow-letter": Handler._get_snow_letter,
    "/citations/history": Handler._get_citation_history,
    "/cases/list": Handler._get_case_list,
    "/cases/open": Handler._get_case_open,
    "/cases/resolve": Handler._get_case_resolve,
    "/dw-status": Handler._get_status,
    "/draft-backups/list": Handler._get_backup_list,
    "/catalog/reviews": Handler._get_catalog_reviews,
}
POST_ROUTES = {
    "/session/bootstrap": Handler._post_session_bootstrap,
    "/administration/deposit-override": Handler._administration_post,
    "/administration/snow-letter": Handler._administration_post,
    "/locks/release": Handler._post_lock_or_probe,
    "/setup/probe": Handler._post_lock_or_probe,
    "/outbox/read": Handler._post_workflow,
    "/outbox/batch-sync": Handler._post_workflow,
    "/reporting/views": Handler._post_workflow,
    "/email/reminder": Handler._post_workflow,
    "/address/parse": Handler._post_address_parse,
    "/case-lookup": Handler._post_case_lookup,
    "/cases/save": Handler._post_shared_records,
    "/cases/summary": Handler._post_shared_records,
    "/cases/probe": Handler._post_shared_records,
    "/outbox/sync": Handler._post_shared_records,
    "/draft-backups/write": Handler._post_shared_records,
    "/draft-backups/read": Handler._post_shared_records,
    "/catalog/review": Handler._post_shared_records,
    "/artifact/status": Handler._post_shared_records,
    "/artifact/read": Handler._post_artifact_read,
    "/save-pdf": Handler._post_save_pdf,
    "/email": Handler._post_email,
    "/reporting/parcels": Handler._post_parcels,
    "/helper/shutdown": Handler._post_shutdown,
}


class Server(socketserver.ThreadingTCPServer):
    allow_reuse_address = os.name != "nt"
    daemon_threads = True


if __name__ == "__main__":
    od = out_dir()
    print()
    print("  Document Writer running at http://127.0.0.1:%d" % PORT)
    print("  Finished documents are filed in:")
    print("    %s" % od)
    if not find_chrome():
        print()
        print("  NOTE: Chrome/Edge was not found, so PDFs cannot be produced.")
        print("        Finalizing will fall back to the print dialog.")
    if not find_outlook():
        print()
        print("  NOTE: Outlook was not found. Emailing a document will fall back")
        print("        to your default mail program, without the attachment.")
    print()
    print("  Leave this window open while you work. To stop the program, use Exit Document Writer")
    print("  in Tools & settings (closing this window also stops it).")
    print()
    case_integrity.reconstruct_registry(case_dir())
    with Server(("127.0.0.1", PORT), Handler) as httpd:
        start_session()
        if os.environ.get("DW_OPEN_BROWSER") == "1":
            # Diagnostic (console) launches open Writer once the port is bound and the session is written.
            # Desktop launches leave this unset: the launcher waits for /dw-status and opens the window itself.
            from desktop_launch import NO_BROWSER, open_app_window

            if not open_app_window():
                print("  " + NO_BROWSER)

        def anchor_clock():
            while not STOPPING.is_set():
                try:
                    if not run_anchor_once():
                        return
                except (OSError, ValueError):
                    pass
                if STOPPING.wait(60):
                    return

        threading.Thread(target=anchor_clock, daemon=True).start()
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            pass
    # serve_forever returns after Exit Document Writer; leaving the with-block closed the listening socket.
    print("  Document Writer has stopped.")
