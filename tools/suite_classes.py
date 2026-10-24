"""Execution classes for regression suites (Consolidation Phase 6).

A suite that may launch Chromium runs alone, one at a time, so measured browser work stays serial. The rule is the
one tools/run_tests.py has always used (the suite's text mentions chromium, playwright or DW_BROWSER), applied to the
suite and, for JavaScript, to every local file it requires, transitively. Moving a browser launch into a shared helper
therefore keeps its suite serial; tests/unit/audit_suite_classes.py checks this."""

import re
from pathlib import Path

BROWSER = re.compile(r"chromium|playwright|DW_BROWSER")
REQUIRE = re.compile(r"""require\(\s*["'](\.{1,2}/[^"']+)["']\s*\)""")


def _resolve(base, request):
    target = (base.parent / request).resolve()
    for candidate in (target, target.with_name(target.name + ".js"), target.with_name(target.name + ".cjs"), target / "index.js"):
        if candidate.is_file():
            return candidate
    return None


def local_closure(suite):
    """The suite and, for JavaScript, every local module it requires (directly or through other local modules)."""
    suite = Path(suite).resolve()
    seen, pending = [], [suite]
    while pending:
        path = pending.pop()
        if path in seen:
            continue
        seen.append(path)
        if path.suffix not in (".js", ".cjs"):
            continue
        for request in REQUIRE.findall(path.read_text(encoding="utf-8")):
            found = _resolve(path, request)
            if found and found not in seen:
                pending.append(found)
    return seen


def uses_browser(suite):
    return any(BROWSER.search(path.read_text(encoding="utf-8")) for path in local_closure(suite))
