"""Case, integrity and tool text is UTF-8 regardless of the Windows default encoding."""

import ast, builtins, contextlib, io, json, tempfile, unittest
from pathlib import Path
from unittest.mock import patch
import case_store, case_integrity as integrity
from audit_r28_helper import pair

ROOT = Path(__file__).resolve().parents[2]
OWNER = "José — SYNTHETIC OWNER"
LOW_LEVEL_OPEN = {"os", "webbrowser"}


@contextlib.contextmanager
def cp1252_default():
    """Simulate Windows with UTF-8 mode disabled: unspecified text encodings become CP1252."""
    original = io.open

    def legacy(file, mode="r", buffering=-1, encoding=None, *args, **kwargs):
        if "b" not in mode and encoding in (None, "locale"):
            encoding = "cp1252"
        return original(file, mode, buffering, encoding, *args, **kwargs)

    def no_utf8_mode(encoding, stacklevel=2):
        return "locale" if encoding is None else encoding

    with patch.object(io, "open", legacy), patch.object(builtins, "open", legacy), patch.object(io, "text_encoding", no_utf8_mode):
        yield


def implicit_encodings(path):
    found = []
    for node in ast.walk(ast.parse(path.read_bytes())):
        if not isinstance(node, ast.Call):
            continue
        func = node.func
        name = func.attr if isinstance(func, ast.Attribute) else getattr(func, "id", None)
        receiver = ast.unparse(func.value) if isinstance(func, ast.Attribute) else ""
        keywords = {k.arg: k.value for k in node.keywords}
        if "encoding" in keywords:
            continue
        if name in ("read_text", "write_text"):
            found.append((node.lineno, name))
        elif name in ("open", "fdopen") and receiver not in LOW_LEVEL_OPEN and not isinstance(func.value if receiver else None, ast.Call):
            index = 0 if receiver and name == "open" else 1
            mode = keywords.get("mode") or (node.args[index] if len(node.args) > index else None)
            if not (isinstance(mode, ast.Constant) and "b" in mode.value):
                found.append((node.lineno, name))
        elif name in ("run", "check_output", "Popen") and ("text" in keywords or "universal_newlines" in keywords):
            found.append((node.lineno, "subprocess text"))
    return found


class Utf8Io(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.external = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        value = pair()
        value["schema"] = 5
        value["case"]["owner"] = OWNER
        self.name = "101 TEST - " + value["case"]["number"] + ".json"
        case_store.save_case(self.root, self.name, value)
        self.raw = (self.root / self.name).read_bytes()
        self.registry = (self.root / "_integrity/migrated.json").read_bytes()
        self.assertIn(OWNER.encode("utf-8"), self.raw)

    def tearDown(self):
        self.temp.cleanup()
        self.external.cleanup()

    def test_simulation_reproduces_the_windows_default(self):
        with cp1252_default():
            self.assertNotIn(OWNER, (self.root / self.name).read_text())
            self.assertIn(OWNER, (self.root / self.name).read_text(encoding="utf-8"))

    def test_unicode_case_passes_history_anchoring_and_reconstruction(self):
        with cp1252_default():
            case_store.citation_history(self.root)
            integrity.anchor_daily(self.root, Path(self.external.name))
            self.assertTrue(case_store.read_case(self.root, self.name)["integrity"]["valid"])
            (self.root / "_integrity/migrated.json").unlink()
            integrity.reconstruct_registry(self.root)
        entries = integrity.registry(self.root)["entries"]
        self.assertEqual([e["fileName"] for e in entries], [self.name])
        self.assertTrue(entries[0]["reconstructed"])
        self.assertEqual((self.root / self.name).read_bytes(), self.raw)

    def test_altered_truncated_and_invalid_utf8_records_are_still_refused(self):
        altered = self.raw.replace(OWNER.encode("utf-8"), "Josà — SYNTHETIC OWNER".encode("utf-8"))
        invalid = self.raw.replace("é".encode("utf-8"), b"\xe9")
        for label, raw in [("altered", altered), ("truncated", self.raw[:-20]), ("invalid UTF-8", invalid)]:
            with self.subTest(record=label), cp1252_default():
                (self.root / self.name).write_bytes(raw)
                (self.root / "_integrity/migrated.json").write_bytes(self.registry)
                with self.assertRaises(ValueError):
                    case_store.citation_history(self.root)
                with self.assertRaises(ValueError):
                    integrity.anchor_daily(self.root, Path(self.external.name))
                (self.root / "_integrity/migrated.json").unlink(missing_ok=True)
                integrity.reconstruct_registry(self.root)
                self.assertEqual(integrity.registry(self.root)["entries"], [])

    def test_helper_tools_and_policy_state_every_text_encoding(self):
        for path in sorted([*ROOT.glob("helper/*.py"), *ROOT.glob("tools/*.py"), *ROOT.glob("policy/**/*.py")]):
            with self.subTest(file=path.relative_to(ROOT).as_posix()):
                self.assertEqual(implicit_encodings(path), [])

    def test_policy_provenance_compilation_and_ordinances_under_cp1252(self):
        import runpy, sys
        import compiler, library_ordinances, regenerate_deposits

        expected = (compiler.compile_policy(ROOT), library_ordinances.audit(ROOT))
        with cp1252_default():
            # The build's own provenance check, exactly as tools/build.py runs it; it exits on any difference.
            with patch.object(sys, "argv", ["regenerate_deposits.py", "--check"]):
                runpy.run_path(str(ROOT / "policy/regenerate_deposits.py"), run_name="__main__")
            data, _ = regenerate_deposits.regenerate()
            self.assertEqual((compiler.compile_policy(ROOT), library_ordinances.audit(ROOT)), expected)
        # Generated output stays UTF-8, and the schedule does exercise non-ASCII text.
        self.assertEqual((ROOT / "app/assets/deposits.js").read_bytes(), data.encode("utf-8"))
        self.assertTrue(any(ord(c) > 127 for c in data))

    def test_policy_reads_reject_invalid_utf8(self):
        import compiler

        path = self.root / "policy.json"
        path.write_bytes(b'{"label": "Jos\xe9"}')
        with cp1252_default(), self.assertRaises(ValueError):
            compiler.read(path)

    def test_maintained_manual_source_is_not_cp1252_safe(self):
        # Guards the premise of the explicit manual encoding: the source contains UTF-8 text.
        raw = (ROOT / "docs/staff/PROGRAM-MANUAL.md").read_bytes()
        raw.decode("utf-8")
        with self.assertRaises(UnicodeDecodeError):
            raw.decode("cp1252")


if __name__ == "__main__":
    unittest.main()
