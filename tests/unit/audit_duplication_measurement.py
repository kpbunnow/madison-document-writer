"""Clone diagnostics preserve literal/indentation semantics, thresholds and collision checks; no scoring shortcuts."""

import json
import subprocess
import unittest
from unittest.mock import patch
import measure_duplication as measure


class DuplicationMeasurement(unittest.TestCase):
    def test_python_comments_whitespace_and_literal_change(self):
        first = 'def one(value):\n    # comment\n    if value:\n        return "kept"\n    return None\n'
        second = first.replace("# comment", "# another comment").replace("    ", "  ")
        values = {"a.py": measure.python_tokens(first), "b.py": measure.python_tokens(second)}
        rows = measure.detect(values, 8, 2)
        self.assertEqual(len(rows), 1)
        self.assertEqual(len(rows[0]["locations"]), 2)
        self.assertEqual(rows[0]["tokens"], len(values["a.py"]))
        changed = {**values, "b.py": measure.python_tokens(second.replace('"kept"', '"different"'))}
        self.assertTrue(all(row["tokens"] < rows[0]["tokens"] for row in measure.detect(changed, 8, 2)))
        self.assertNotEqual(measure.python_tokens("if a:\n b()\n c()\n"), measure.python_tokens("if a:\n b()\nc()\n"))

    def test_collisions_overlap_thresholds_and_language_separation(self):
        values = {"a.py": [["a", 1, 1], ["b", 2, 2]], "b.py": [["different", 1, 1], ["tokens", 2, 2]]}
        with patch.object(measure, "windows", side_effect=lambda *_: iter([(0, 42)])):
            self.assertEqual(measure.detect(values, 2, 1), [])
        same = [["x", 1, 1], ["y", 2, 2]]
        self.assertEqual(measure.detect({"a.py": same, "b.js": same}, 2, 1), [])
        self.assertEqual(measure.detect({"a.py": same, "b.py": same}, 2, 3), [])
        self.assertEqual(measure.detect({"a.py": same * 2}, 3, 1), [])
        with self.assertRaises(ValueError):
            measure.detect({}, 1, 1)
        self.assertEqual(measure.detect({}, 2, 1), [])

    def test_js_tokenization_preserves_literals_and_ignores_comments(self):
        result = subprocess.run(
            [
                "node",
                "-e",
                'const t=require("./tools/duplication_tokens.cjs").tokens;console.log(JSON.stringify([t("const x = 1; // comment"),t("const x=1;"),t("const x=2;")]));',
            ],
            capture_output=True,
            encoding="utf-8",
            check=True,
        )
        a, b, c = json.loads(result.stdout)
        self.assertEqual([x[0] for x in a], [x[0] for x in b])
        self.assertNotEqual([x[0] for x in a], [x[0] for x in c])
        self.assertTrue(all(x[1] >= 1 and x[2] >= x[1] for x in a))

    def test_scan_scope_is_explicit_and_excludes_oracles(self):
        files = measure.scan_files()
        self.assertIn("app/modules/citation_policy.js", files)
        self.assertIn("helper/case_store.py", files)
        self.assertTrue(all("/vendor/" not in p and not p.startswith(("build/", "tests/")) for p in files))
        self.assertEqual(files, sorted(set(files)))


if __name__ == "__main__":
    unittest.main()
