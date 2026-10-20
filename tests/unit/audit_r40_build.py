"""Runtime inventory, qualified ownership and deterministic data products."""

import json
from pathlib import Path
import unittest
import launch
import server


class BuildContract(unittest.TestCase):
    def test_manifest_consumers_and_sources(self):
        manifest = json.loads(Path("build/generated/runtime-manifest.json").read_text())
        self.assertEqual(manifest["helperVersion"], launch.VERSION)
        self.assertEqual(launch.VERSION, server.HELPER_VERSION)
        self.assertEqual(manifest["release"], Path("build/generated/RELEASE").read_text().strip())
        self.assertEqual(tuple(manifest["required"]), launch.REQUIRED)
        self.assertEqual(set(manifest["required"] + manifest["optional"]), set(manifest["deploy"]))
        for source in manifest["deploy"].values():
            self.assertTrue(Path(source).is_file(), source)
        for name in ("library.js", "deposits.js", "inspectors.js"):
            self.assertTrue(Path("build/generated/modules/data", name).read_text().startswith(Path("app/assets", name).read_text() + "\nexport { "))
        for stem in ("app", "reports"):
            entry = Path("app/modules", stem + "_entry.js").read_text()
            self.assertLess(len(entry), 200)
            self.assertIn(stem + "_core.js", entry)
            core = Path("app/modules", stem + "_core.js").read_text()
            self.assertNotIn("$modules", core)
            self.assertNotIn("const $runtime=", core)
        self.assertIn("function render(", Path("app/modules/inspection_import.js").read_text())
        self.assertIn("function render(", Path("app/modules/reports_services.js").read_text())
        self.assertFalse(Path("generate_module_index.cjs").exists())


if __name__ == "__main__":
    unittest.main()
