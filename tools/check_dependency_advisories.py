"""Read-only dependency advisory and patch-level report; it never edits manifests or suppresses a finding.

Covers every hash-pinned Python manifest (bootstrap, development, helper runtime and analysis), the vendored Leaflet
library, and the Node and CPython patch levels pinned by CI. npm packages are audited separately with
`npm audit --package-lock-only`. Exit status: 0 no findings, 1 findings, 2 a source could not be checked. A source that
could not be checked is never reported as clean.
"""

import argparse
import json
import os
from pathlib import Path
import re
import sys
import urllib.error
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
PYTHON_MANIFESTS = (
    "requirements-bootstrap.txt",
    "requirements-dev.txt",
    "helper/requirements-runtime.txt",
    "tools/analysis-requirements.txt",
)
WORKFLOWS = ".github/workflows"
LEAFLET = "app/assets/leaflet.js"
PYPI = "https://pypi.org/pypi/{name}/{version}/json"
NODE_INDEX = "https://nodejs.org/dist/index.json"
PYTHON_VERSIONS = "https://raw.githubusercontent.com/actions/python-versions/main/versions-manifest.json"
NPM_BULK = "https://registry.npmjs.org/-/npm/v1/security/advisories/bulk"
DEPENDABOT = "https://api.github.com/repos/{repository}/dependabot/alerts?state=open&per_page=100"


class Unavailable(Exception):
    """A source could not be read; this is never treated as an empty result."""


def fetch_json(url, data=None, headers=None):
    request = urllib.request.Request(url, data=data, headers={"User-Agent": "dependency-advisory-check", **(headers or {})})
    try:
        with urllib.request.urlopen(request, timeout=60) as response:
            return json.load(response)
    except urllib.error.HTTPError as error:
        raise Unavailable(url + ": HTTP " + str(error.code)) from error
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as error:
        raise Unavailable(url + ": " + str(error)) from error


def python_pins(text):
    """Exact `name==version` requirements; hash and continuation lines are not requirements."""
    pins = []
    for line in text.splitlines():
        line = line.split("#", 1)[0].strip()
        if not line or line.startswith("--"):
            continue
        match = re.match(r"^([A-Za-z0-9][A-Za-z0-9._-]*)==([^\s;\\]+)", line)
        if not match:
            raise ValueError("Unpinned or unrecognized requirement: " + line)
        pins.append((match.group(1), match.group(2)))
    return pins


def python_findings(root, fetch):
    findings = []
    for manifest in PYTHON_MANIFESTS:
        for name, version in python_pins((root / manifest).read_text(encoding="utf-8")):
            data = fetch(PYPI.format(name=name, version=version))
            if data.get("info", {}).get("version") != version:
                raise Unavailable("PyPI returned another version for " + name + "==" + version)
            for vulnerability in data.get("vulnerabilities") or []:
                if vulnerability.get("withdrawn"):
                    continue
                findings.append(
                    {
                        "kind": "python-advisory",
                        "manifest": manifest,
                        "package": name,
                        "version": version,
                        "id": vulnerability.get("id"),
                        "aliases": vulnerability.get("aliases") or [],
                        "fixedIn": vulnerability.get("fixed_in") or [],
                    }
                )
    return findings


def workflow_pins(root, key):
    pins = set()
    for path in sorted((root / WORKFLOWS).glob("*.yml")):
        pins.update(re.findall(key + r":\s*'(\d+\.\d+\.\d+)'", path.read_text(encoding="utf-8")))
    return sorted(pins)


def version_key(version):
    return tuple(int(part) for part in version.lstrip("v").split("."))


def node_findings(pins, index):
    findings = []
    for pinned in pins:
        line = version_key(pinned)[0]
        newer = [
            entry["version"].lstrip("v")
            for entry in index
            if re.fullmatch(r"v\d+\.\d+\.\d+", entry.get("version", ""))
            and version_key(entry["version"])[0] == line
            and version_key(entry["version"]) > version_key(pinned)
            and entry.get("security")
        ]
        if newer:
            findings.append({"kind": "node-security-release", "pinned": pinned, "newerSecurityReleases": sorted(newer, key=version_key)})
    return findings


def python_runtime_findings(pins, manifest):
    findings = []
    for pinned in pins:
        series = version_key(pinned)[:2]
        newer = [
            entry["version"]
            for entry in manifest
            if entry.get("stable")
            and re.fullmatch(r"\d+\.\d+\.\d+", entry.get("version", ""))
            and version_key(entry["version"])[:2] == series
            and version_key(entry["version"]) > version_key(pinned)
        ]
        if newer:
            findings.append({"kind": "cpython-maintenance-release", "pinned": pinned, "newerReleases": sorted(newer, key=version_key)})
    return findings


def leaflet_findings(root, fetch):
    match = re.search(r"Leaflet (\d+\.\d+\.\d+)", (root / LEAFLET).read_text(encoding="utf-8")[:400])
    if not match:
        raise ValueError(LEAFLET + " does not declare its Leaflet version")
    version = match.group(1)
    advisories = fetch(NPM_BULK, json.dumps({"leaflet": [version]}).encode(), {"Content-Type": "application/json"})
    return [
        {"kind": "vendored-advisory", "file": LEAFLET, "package": "leaflet", "version": version, "id": item.get("url"), "title": item.get("title")}
        for item in advisories.get("leaflet", [])
    ]


def dependabot_status(fetch, repository, token):
    """Open Dependabot alerts, or an explicit statement that they could not be read."""
    if not repository or not token:
        return {"available": False, "reason": "no repository token was provided"}
    try:
        alerts = fetch(DEPENDABOT.format(repository=repository), None, {"Authorization": "Bearer " + token, "Accept": "application/vnd.github+json"})
    except Unavailable as error:
        return {"available": False, "reason": str(error)}
    return {
        "available": True,
        "openAlerts": [
            {
                "package": a["dependency"]["package"]["name"],
                "manifest": a["dependency"].get("manifest_path"),
                "advisory": a["security_advisory"]["ghsa_id"],
            }
            for a in alerts
        ],
    }


def report(root, fetch, repository=None, token=None):
    findings, unavailable = [], []
    for label, check in (
        ("PyPI advisories", lambda: python_findings(root, fetch)),
        ("Node release index", lambda: node_findings(workflow_pins(root, "node-version"), fetch(NODE_INDEX))),
        ("CPython release manifest", lambda: python_runtime_findings(workflow_pins(root, "python-version"), fetch(PYTHON_VERSIONS))),
        ("vendored Leaflet advisories", lambda: leaflet_findings(root, fetch)),
    ):
        try:
            findings.extend(check())
        except Unavailable as error:
            unavailable.append(label + ": " + str(error))
    dependabot = dependabot_status(fetch, repository, token)
    findings.extend({"kind": "dependabot-alert", **alert} for alert in dependabot.get("openAlerts", []))
    return {"findings": findings, "unavailable": unavailable, "dependabot": dependabot}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, help="also write the JSON report here")
    args = parser.parse_args()
    result = report(ROOT, fetch_json, os.environ.get("GITHUB_REPOSITORY"), os.environ.get("GITHUB_TOKEN"))
    text = json.dumps(result, indent=2)
    if args.output:
        args.output.write_text(text + "\n", encoding="utf-8")
    print(text)
    # In GitHub Actions the prefixes become run annotations, so the notes stay visible without opening the log.
    marks = ("::warning::", "::error::", "::error::") if os.environ.get("GITHUB_ACTIONS") == "true" else ("", "", "")
    if not result["dependabot"]["available"]:
        print(marks[0] + "Dependabot alerts were not read (" + result["dependabot"]["reason"] + "); this is not an empty alert list.")
    for item in result["unavailable"]:
        print(marks[1] + "NOT CHECKED: " + item)
    for item in result["findings"]:
        print(marks[2] + "FINDING: " + json.dumps(item, sort_keys=True))
    sys.exit(1 if result["findings"] else 2 if result["unavailable"] else 0)


if __name__ == "__main__":
    main()
