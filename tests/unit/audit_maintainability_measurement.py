"""Diagnostic maintainability tooling (plan Phase 0): the Radon compatibility copy is accepted only when it is
AST- and line-equivalent; the hotspot inventory reports only a function's own effects; distributions and scopes
count exactly. No analysis package is needed: Radon is imported only inside measure()."""

import ast
import unittest

import hotspot_inventory
import maintainability_py
import measure_maintainability

SEP = chr(0x2028)


class CompatibilityCopy(unittest.TestCase):
    def test_no_separator_means_no_copy(self):
        self.assertIsNone(maintainability_py.compatible_text('x = "plain"\n'))

    def test_separator_in_string_is_escaped_equivalently(self):
        text = 'SPACE = "a' + SEP + 'b"\nother = 1\n'
        copy = maintainability_py.compatible_text(text)
        self.assertNotIn(SEP, copy)
        self.assertEqual(ast.dump(ast.parse(copy)), ast.dump(ast.parse(text)))
        self.assertEqual(copy.count("\n"), text.count("\n"))

    def test_separator_in_comment_changes_nothing_semantic(self):
        # A comment is not in the AST, so the escaped comment is still equivalent and accepted.
        text = "# note" + SEP + "\nvalue = 2\n"
        self.assertEqual(ast.dump(ast.parse(maintainability_py.compatible_text(text))), ast.dump(ast.parse(text)))

    def test_inequivalent_copy_is_refused(self):
        # In a raw byte string an escape is not decoded, so the copy would change the value: refused.
        text = 'value = r"a' + SEP + 'b"\n'
        with self.assertRaises(ValueError):
            maintainability_py.compatible_text(text)


class Inventory(unittest.TestCase):
    def describe(self, source):
        return hotspot_inventory.describe(ast.parse(source).body[0])

    def test_own_effects_only(self):
        row = self.describe(
            "def outer(path):\n"
            "    data = path.read_text()\n"
            "    name = data.replace('a', 'b')\n"
            "    with file_lock(path):\n"
            "        atomic_write(path, name)\n"
            "    def inner():\n"
            "        os.replace(a, b)\n"
            "    if not name:\n"
            "        raise ValueError('refused')\n"
        )
        self.assertEqual(row["effects"], {"fileRead": ["read_text"], "fileWrite": ["atomic_write"], "lock": ["file_lock"], "lockScope": True})
        self.assertEqual(row["refusals"], 1)

    def test_os_replace_is_a_write(self):
        self.assertEqual(self.describe("def f():\n    os.replace(a, b)\n")["effects"], {"fileWrite": ["os.replace"]})


class Summaries(unittest.TestCase):
    def test_distribution_buckets_and_thresholds(self):
        d = measure_maintainability.distribution([1, 5, 6, 10, 11, 15, 16, 20, 21, 52], 20)
        self.assertEqual(d["buckets"], {"1-5": 2, "6-10": 2, "11-15": 2, "16-20": 2, "21+": 2})
        self.assertEqual((d["above10"], d["above15"], d["above20"], d["max"], d["count"]), (6, 4, 2, 52, 10))

    def test_size_weighted_summary(self):
        rows = [{"mi": 0, "sloc": 900}, {"mi": 100, "sloc": 100}]
        self.assertEqual(measure_maintainability.file_summary(rows, "mi", "sloc"), {"files": 2, "mean": 50, "median": 50, "sizeWeighted": 10})

    def test_scope_commit_limits_files(self):
        measure_maintainability.SCOPE_AT = "HEAD"
        try:
            kept = measure_maintainability.in_scope(["tools/build.py", "tools/not-a-tracked-file.py"])
        finally:
            measure_maintainability.SCOPE_AT = None
        self.assertEqual(kept, ["tools/build.py"])


if __name__ == "__main__":
    unittest.main()
