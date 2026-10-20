"""Check maintained JavaScript, CSS, HTML and Python, excluding generated/vendor data."""

from pathlib import Path
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]
subprocess.run(
    [
        "node",
        str(ROOT / "node_modules/prettier/bin/prettier.cjs"),
        "--check",
        "--no-error-on-unmatched-pattern",
        "app/**/*.{js,css,html}",
        "helper/*.js",
        "tests/**/*.{js,cjs}",
        "tools/*.{js,cjs,mjs}",
        "*.mjs",
    ],
    cwd=ROOT,
    check=True,
)
subprocess.run([sys.executable, "-m", "ruff", "format", "--check", "helper", "tools", "policy", "tests"], cwd=ROOT, check=True)
