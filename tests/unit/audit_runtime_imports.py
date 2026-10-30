"""The installed helper starts: every local helper module that a deployed Python file imports is itself deployed.

A module missing from tools/runtime-manifest.template.json passes every test that runs from the source tree and
only fails on an installed PC ("Document Writer's local helper did not start"). This test checks the deployment
map statically for every import (including imports inside functions) and then starts the helper's server module
from a folder holding only the deployed helper files."""

import ast
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[2]
TEMPLATE = json.loads((ROOT / "tools/runtime-manifest.template.json").read_text(encoding="utf-8"))
HELPER_MODULES = {p.stem for p in (ROOT / "helper").glob("*.py")}


def deployed_python():
    return {target: ROOT / source for target, source in TEMPLATE["deploy"].items() if target.endswith(".py")}


def local_imports(path):
    found = set()
    for node in ast.walk(ast.parse(path.read_text(encoding="utf-8"))):
        if isinstance(node, ast.Import):
            found |= {alias.name.split(".")[0] for alias in node.names}
        elif isinstance(node, ast.ImportFrom) and node.level == 0 and node.module:
            found.add(node.module.split(".")[0])
    return found & HELPER_MODULES


class RuntimeImports(unittest.TestCase):
    def test_every_imported_helper_module_is_deployed_and_required(self):
        deployed = deployed_python()
        required = set(TEMPLATE["required"])
        for target, path in sorted(deployed.items()):
            for module in sorted(local_imports(path)):
                with self.subTest(importer=target, module=module):
                    self.assertIn(module + ".py", deployed, target + " imports " + module + ", which the deployment does not carry")
        self.assertIn("open_cases.py", required)

    def test_deployment_map_names_existing_source_files(self):
        for target, source in TEMPLATE["deploy"].items():
            if source.startswith(("build/", "app/")):
                continue
            with self.subTest(target=target):
                self.assertTrue((ROOT / source).is_file(), source)

    def test_the_server_module_starts_from_the_deployed_files_alone(self):
        with tempfile.TemporaryDirectory() as folder:
            for target, relative in TEMPLATE["deploy"].items():
                source = ROOT / relative
                if source.is_file():  # generated or built inputs exist only after a build
                    (Path(folder) / target).parent.mkdir(parents=True, exist_ok=True)
                    (Path(folder) / target).write_bytes(source.read_bytes())
            # The vendored packages are deployed as a tree beside the helper files.
            shutil.copytree(ROOT / "helper/vendor", Path(folder) / "vendor", dirs_exist_ok=True, ignore=shutil.ignore_patterns("__pycache__"))
            result = subprocess.run(
                [sys.executable, "-B", "-c", "import server"],
                cwd=folder,
                env={"PATH": "", "PYTHONPATH": folder + os.pathsep + str(Path(folder) / "vendor/python"), "DW_PORT": "0", "DW_OPEN_BROWSER": "0"},
                capture_output=True,
                text=True,
                timeout=60,
            )
            self.assertEqual(result.returncode, 0, result.stderr[-1500:])


if __name__ == "__main__":
    unittest.main()
