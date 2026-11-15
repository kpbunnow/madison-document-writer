"""Diagnostic maintainability tooling (plan Phase 0): the Radon compatibility copy is accepted only when it is
AST- and line-equivalent; the hotspot inventory reports only a function's own effects; distributions and scopes
count exactly. No analysis package is needed: Radon is imported only inside measure()."""

import ast
import unittest
from types import SimpleNamespace
from unittest.mock import patch
import sys

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


class FunctionCensus(unittest.TestCase):
    def block(self, name, line, closures=()):
        return SimpleNamespace(name=name, lineno=line, col_offset=4, complexity=2, closures=list(closures))

    def test_bare_duplicates_do_not_erase_qualified_methods_or_closures(self):
        nested = self.block("nested", 3)
        method = self.block("decide", 2, [nested])
        owner = type("Class", (), {"name": "Owner", "methods": [method]})()
        other = self.block("standalone", 6)
        for blocks in [[method, owner, other], [owner, method, other]]:
            rows = []
            maintainability_py.functions(blocks, "synthetic.py", rows)
            self.assertEqual(
                [(r["name"], r["closure"]) for r in rows], [("Owner.decide", False), ("Owner.decide.nested", True), ("standalone", False)]
            )

    def test_same_names_at_distinct_locations_or_files_remain(self):
        first, second = self.block("same", 2), self.block("same", 5)
        owners = [type("Class", (), {"name": name, "methods": [method]})() for name, method in [("First", first), ("Second", second)]]
        rows = []
        maintainability_py.functions([first, second, *owners], "one.py", rows)
        maintainability_py.functions([first], "two.py", rows)
        self.assertEqual([(r["file"], r["name"]) for r in rows], [("one.py", "First.same"), ("one.py", "Second.same"), ("two.py", "same")])

    def test_mi_variants_keep_the_comment_term_separate(self):
        parameters = lambda text, count_multi: (50, 4, 20, 70 if count_multi else 30)
        compute_calls = []

        def compute(*values):
            compute_calls.append(values)
            return float(values[-1])

        metrics = SimpleNamespace(mi_parameters=parameters, mi_compute=compute)
        raw = SimpleNamespace(analyze=lambda text: SimpleNamespace(sloc=18, loc=25, comments=3, multi=7))
        with patch.dict(sys.modules, {"radon": SimpleNamespace(), "radon.metrics": metrics, "radon.raw": raw}):
            row = maintainability_py.file_statistics("synthetic source")
        self.assertEqual(compute_calls, [(50, 4, 20, 70), (50, 4, 20, 0), (50, 4, 20, 30)])
        self.assertEqual((row["mi"], row["miCodeOnly"], row["miRegularComments"], row["multilineStringLines"]), (70, 0, 30, 7))

    def test_group_variants_use_the_same_files_and_sloc_weights(self):
        rows = [
            {"file": "a", "sloc": 900, "mi": 50, "miCodeOnly": 0, "miRegularComments": 25},
            {"file": "b", "sloc": 100, "mi": 100, "miCodeOnly": 100, "miRegularComments": 100},
        ]
        group = measure_maintainability.python_group([], {"files": rows, "functions": []}, ["a", "b"])
        self.assertEqual(group["mi"], group["miVariants"]["default"])
        self.assertEqual([group["miVariants"][k]["sizeWeighted"] for k in ["default", "regularComments", "codeOnly"]], [55, 32.5, 10])
        self.assertEqual(group["miVariants"]["codeOnly"]["zero"], ["a"])


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
