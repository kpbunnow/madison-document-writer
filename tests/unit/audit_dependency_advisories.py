"""Dependency advisory monitoring covers every manifest and never reports an unreadable source as clean (synthetic, offline)."""

import json
from pathlib import Path
import re
import tempfile
import unittest

import check_dependency_advisories as advisories

ROOT = Path(__file__).resolve().parents[2]
WORKFLOW = "      - uses: x\n        with:\n          node-version: '24.22.3'\n          python-version: '3.14.10'\n"


def fake_tree(folder):
    for manifest in advisories.PYTHON_MANIFESTS:
        (folder / manifest).parent.mkdir(parents=True, exist_ok=True)
    (folder / "requirements-bootstrap.txt").write_text("# comment\npip==26.3 \\\n    --hash=sha256:" + "a" * 64 + "\n", encoding="utf-8")
    (folder / "requirements-dev.txt").write_text("ruff==0.17.6 --hash=sha256:" + "b" * 64 + "\n", encoding="utf-8")
    (folder / "helper/requirements-runtime.txt").write_text("usaddress==0.5.16 \\\n  --hash=sha256:" + "c" * 64 + "\n", encoding="utf-8")
    (folder / "tools/analysis-requirements.txt").write_text("radon==6.0.1 --hash=sha256:" + "d" * 64 + "\n", encoding="utf-8")
    (folder / ".github/workflows").mkdir(parents=True)
    (folder / ".github/workflows/verify.yml").write_text(WORKFLOW, encoding="utf-8")
    (folder / "app/assets").mkdir(parents=True)
    (folder / "app/assets/leaflet.js").write_text("/* @preserve\n * Leaflet 1.9.4, a JS library\n */\n", encoding="utf-8")


class Responses:
    """Synthetic upstream answers; an unknown URL fails loudly instead of returning an empty result."""

    def __init__(self, **overrides):
        self.calls = []
        self.overrides = overrides

    def __call__(self, url, data=None, headers=None):
        self.calls.append(url)
        for key, value in self.overrides.items():
            if key in url:
                if isinstance(value, Exception):
                    raise value
                return value
        if url.startswith("https://pypi.org/pypi/"):
            name, version = url.split("/")[4:6]
            return {"info": {"version": version}, "vulnerabilities": []}
        if url == advisories.NODE_INDEX:
            return [
                {"version": "v26.0.0-alpha", "security": True},
                {"version": "v24.22.3", "security": True},
                {"version": "v22.30.0", "security": True},
            ]
        if url == advisories.PYTHON_VERSIONS:
            return [{"version": "3.14.10", "stable": True}, {"version": "3.15.0", "stable": True}, {"version": "3.14.11rc1", "stable": False}]
        if url == advisories.NPM_BULK:
            assert json.loads(data) == {"leaflet": ["1.9.4"]}
            return {}
        if "dependabot/alerts" in url:
            return []
        raise AssertionError("unexpected URL " + url)


class DependencyAdvisories(unittest.TestCase):
    def setUp(self):
        self.folder = Path(tempfile.mkdtemp())
        fake_tree(self.folder)

    def test_every_python_manifest_is_queried_by_exact_version(self):
        fetch = Responses()
        result = advisories.report(self.folder, fetch, "owner/repo", "token")
        self.assertEqual(result, {"findings": [], "unavailable": [], "dependabot": {"available": True, "openAlerts": []}})
        for pin in ["pip/26.3", "ruff/0.17.6", "usaddress/0.5.16", "radon/6.0.1"]:
            self.assertIn("https://pypi.org/pypi/" + pin + "/json", fetch.calls)

    def test_the_real_manifests_are_all_covered_and_exactly_pinned(self):
        for manifest in advisories.PYTHON_MANIFESTS:
            self.assertTrue(advisories.python_pins((ROOT / manifest).read_text(encoding="utf-8")), manifest)
        dependabot = (ROOT / ".github/dependabot.yml").read_text(encoding="utf-8")
        for directory in ["/", "/helper", "/tools"]:
            self.assertRegex(dependabot, r"(?m)^\s+- " + re.escape(directory) + r"$", directory + " must be monitored")
        self.assertEqual(advisories.workflow_pins(ROOT, "node-version"), ["24.22.3"])
        with self.assertRaises(ValueError):
            advisories.python_pins("requests>=2\n")

    def test_advisories_and_newer_security_releases_are_findings(self):
        vulnerable = {"info": {"version": "0.17.6"}, "vulnerabilities": [{"id": "GHSA-x", "aliases": ["CVE-1"], "fixed_in": ["0.17.7"]}]}
        withdrawn = {"info": {"version": "6.0.1"}, "vulnerabilities": [{"id": "GHSA-y", "withdrawn": "2026-01-01"}]}
        fetch = Responses(
            **{
                "ruff/0.17.6": vulnerable,
                "radon/6.0.1": withdrawn,
                "nodejs.org": [{"version": "v24.22.4", "security": True}, {"version": "v24.23.0", "security": False}],
                "python-versions": [{"version": "3.14.11", "stable": True}],
                "advisories/bulk": {"leaflet": [{"url": "https://github.com/advisories/GHSA-z", "title": "XSS"}]},
                "dependabot": [
                    {
                        "dependency": {"package": {"name": "pip"}, "manifest_path": "requirements-bootstrap.txt"},
                        "security_advisory": {"ghsa_id": "GHSA-w"},
                    }
                ],
            }
        )
        kinds = [f["kind"] for f in advisories.report(self.folder, fetch, "owner/repo", "token")["findings"]]
        self.assertEqual(kinds, ["python-advisory", "node-security-release", "cpython-maintenance-release", "vendored-advisory", "dependabot-alert"])

    def test_unreadable_sources_are_reported_not_treated_as_clean(self):
        fetch = Responses(**{"nodejs.org": advisories.Unavailable("HTTP 403"), "dependabot": advisories.Unavailable("HTTP 403")})
        result = advisories.report(self.folder, fetch, "owner/repo", "token")
        self.assertEqual(result["unavailable"], ["Node release index: HTTP 403"])
        self.assertEqual(result["dependabot"], {"available": False, "reason": "HTTP 403"})
        self.assertNotIn("openAlerts", result["dependabot"])
        self.assertFalse(advisories.report(self.folder, Responses(), None, None)["dependabot"]["available"])

    def test_pypi_must_answer_for_the_pinned_version(self):
        fetch = Responses(**{"ruff/0.17.6": {"info": {"version": "0.17.7"}, "vulnerabilities": []}})
        self.assertEqual(advisories.report(self.folder, fetch)["unavailable"], ["PyPI advisories: PyPI returned another version for ruff==0.17.6"])


if __name__ == "__main__":
    unittest.main()
