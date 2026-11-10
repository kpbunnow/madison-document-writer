"""Live Accela data from the division's two published SSRS reports, rendered as XML by the signed-in Windows user.

Each report is fetched by Windows PowerShell (ssrs_fetch.ps1) with the user's own Windows sign-in, so a person sees
exactly what they could open in the report portal and no credential is stored. The report server comes from the
verified release allowlist and the report paths are fixed here; the only value taken from a request is a case number or
an inspector name, which is validated by the caller and URL-encoded here. The XML is checked before anything is used:
an HTML page (a sign-in or error page), a document from another report, a document type declaration and an oversized
answer are all refused with a message that says what to do.
"""

import base64
import json
import os
from pathlib import Path
import re
import subprocess
from urllib.parse import quote, urlencode
import xml.etree.ElementTree as ET

import trusted_connections

HERE = Path(__file__).resolve().parent
HOST = "entreports.cityofmadison.com"
FOLDER = "/Prod/Local/Building Inspection/Enforcement/"
CASE_REPORT = "DocumenGeneratorImport"
OPEN_CASES_REPORT = "OpenEnforcementCases_BI"
MAX_BYTES = 20 * 1024 * 1024
DIAGNOSTIC = r" Full local details: %LOCALAPPDATA%\MadisonDocWriter\case-lookup-diagnostic.txt."


class ReportError(Exception):
    def __init__(self, message, status=503):
        super().__init__(message)
        self.status = status


def report_path(report):
    return FOLDER + report


def report_url(report, params=()):
    """The web-service render URL (ReportServer, not the Reports portal) for one fixed report as XML."""
    host = trusted_connections.approved_ssrs(HOST)
    query = "&".join(["rs:Command=Render", "rs:Format=XML"] + ([urlencode(list(params))] if params else []))
    return "https://" + host + "/ReportServer?" + quote(report_path(report), safe="/") + "&" + query


# What each failure means for the person at the screen. Server text never reaches the page.
HTTP_MESSAGES = {
    401: "The report server did not accept your Windows sign-in (SSRS_401). Check that you can open the report in the Reports portal, then retry.",
    403: "Your Windows account does not have permission to run the report (SSRS_403). Ask the report administrator for access.",
    404: "The report was not found on the report server (SSRS_404). It may have been moved or renamed; ask the report administrator.",
}
CATEGORY_MESSAGES = {
    "timeout": "The report server did not answer in time. Check the City network or VPN and retry; your work has been kept.",
    "network": "The report server could not be reached (SSRS_NETWORK). Connect to the City network or VPN and retry.",
    "tls": "The report server's certificate was not accepted (SSRS_TLS). Ask IT to check the server certificate.",
    "redirect": "The report server sent the request somewhere else (SSRS_REDIRECT). Ask IT to check the report server address.",
    "limit": "The report returned too much data (SSRS_LIMIT). Ask the report administrator to check the report.",
    "script_policy": "Windows blocked the report helper (SCRIPT_POLICY). Ask IT to approve the helper under City policy; do not bypass PowerShell policy.",
}


def _failure(answer):
    category, status = answer.get("category"), answer.get("httpStatus")
    code = answer.get("ssrsCode")
    if category == "http" and type(status) is int:
        message = HTTP_MESSAGES.get(status) or (
            "The report server could not run the report (SSRS_"
            + str(status)
            + (("_" + code) if isinstance(code, str) and re.fullmatch(r"rs[A-Za-z]{2,60}", code) else "")
            + "). Retry; if it continues, ask the report administrator."
        )
    else:
        message = CATEGORY_MESSAGES.get(category, "The report could not be retrieved (SSRS_FAILED). Check the City network or VPN and retry.")
    if isinstance(answer.get("diagnosticFile"), str) and answer["diagnosticFile"]:
        message += DIAGNOSTIC
    return ReportError(message)


def fetch(url, wait):
    """Bytes of one report render. Runs only on Windows, as the signed-in user, through the fixed PowerShell script."""
    if os.name != "nt":
        raise ReportError("The live report lookup runs on a City Windows computer.")
    exe = Path(os.environ.get("SystemRoot", r"C:\Windows")) / "System32/WindowsPowerShell/v1.0/powershell.exe"
    if not exe.is_file():
        raise ReportError("Windows PowerShell is unavailable. Ask IT to enable the approved report helper.")
    request = {"url": url, "timeoutSeconds": wait, "maxBytes": MAX_BYTES}
    try:
        run = subprocess.run(
            [str(exe), "-NoLogo", "-NoProfile", "-NonInteractive", "-File", str(HERE / "ssrs_fetch.ps1")],
            input=json.dumps(request),
            encoding="utf-8",
            capture_output=True,
            timeout=wait + 15,
            creationflags=subprocess.CREATE_NO_WINDOW,
        )
    except subprocess.TimeoutExpired:
        raise ReportError("The report server did not answer in time. Check the City network or VPN and retry; your work has been kept.")
    except OSError:
        raise ReportError("The Windows report helper could not start. Ask IT to check the installation and application policy.")
    if len(run.stdout) > MAX_BYTES * 2:
        raise ReportError(CATEGORY_MESSAGES["limit"])
    try:
        answer = json.loads(run.stdout.lstrip("\ufeff"))
    except ValueError:
        raise ReportError("The Windows report helper did not return data. Ask IT to check PowerShell script policy and the complete installation.")
    if not isinstance(answer, dict):
        raise ReportError("The report helper returned an invalid response.")
    if run.returncode or answer.get("ok") is not True:
        raise _failure(answer)
    try:
        body = base64.b64decode(answer.get("body") or "", validate=True)
    except ValueError, TypeError:
        raise ReportError("The report helper returned an invalid response.")
    if len(body) > MAX_BYTES:
        raise ReportError(CATEGORY_MESSAGES["limit"])
    return body


NOT_DATA = "The report server returned a web page instead of the report data (SSRS_NOT_XML). Check that you can open the report in the Reports portal, then retry."


def rows(raw, report, limit):
    """The detail rows of one report's XML export: a list of {column: text}. A column SSRS leaves out is a NULL value."""
    if not isinstance(raw, bytes) or len(raw) > MAX_BYTES:
        raise ReportError(CATEGORY_MESSAGES["limit"])
    text = raw[3:] if raw.startswith(b"\xef\xbb\xbf") else raw
    head = text.lstrip()[:512].lower()
    if not head.startswith(b"<") or b"<html" in head or b"<!doctype html" in head:
        raise ReportError(NOT_DATA)
    if re.search(rb"<!\s*(doctype|entity)", text, re.IGNORECASE):
        raise ReportError("The report answer contained a document type declaration and was refused (SSRS_DTD).")
    try:
        root = ET.fromstring(text)
    except ET.ParseError:
        raise ReportError(NOT_DATA) from None
    namespace = "{" + report + "}"
    if root.tag != namespace + "Report" or root.get("Name") != report:
        raise ReportError("The report server returned a different report (SSRS_WRONG_REPORT). Nothing was loaded; ask the report administrator.")
    found = []
    for element in root.iter(namespace + "Details"):
        if len(found) >= limit:
            raise ReportError(CATEGORY_MESSAGES["limit"])
        found.append({key: value for key, value in element.attrib.items() if "}" not in key})
    return found


def case_rows(case_number, wait=40):
    """Every row of the case lookup report for one validated case number."""
    return rows(fetch(report_url(CASE_REPORT, [("CaseNumber", case_number)]), wait), CASE_REPORT, 1000)


def open_case_rows(inspector=None, wait=90):
    """The open enforcement cases report: every inspector's cases, or one listed inspector's."""
    params = [("Inspector", inspector)] if inspector is not None else []
    return rows(fetch(report_url(OPEN_CASES_REPORT, params), wait), OPEN_CASES_REPORT, 20000)


def source(report):
    return {"kind": "ssrs", "server": HOST, "report": report_path(report)}
