"""Diagnostic Python maintainability measurement, run with the isolated analysis interpreter
(tools/analysis-requirements.txt) by tools/measure_maintainability.py. Read-only; never gate or release evidence.

Radon's maintainability-index and raw-metrics passes split source text with str.splitlines(), which also breaks
on U+2028, U+2029 and the other Unicode line separators. A string literal holding those characters (the
ECMAScript whitespace table in helper/case_projection.py) then fails to parse. Only for those passes, such a file
is analysed as a copy in which each raw separator is replaced by its escape sequence; the copy is accepted only if
its AST is identical to the original's and it has the same LF line count. Production source is never rewritten.
"""

import ast
import json
import sys
from pathlib import Path

SEPARATORS = {chr(code) for code in (0x0B, 0x0C, 0x1C, 0x1D, 0x1E, 0x85, 0x2028, 0x2029)}


def compatible_text(text):
    """The source with raw line separators escaped, or None when no separator occurs."""
    if not any(ch in text for ch in SEPARATORS):
        return None
    copy = "".join("\\u%04x" % ord(ch) if ch in SEPARATORS else ch for ch in text)
    if ast.dump(ast.parse(copy)) != ast.dump(ast.parse(text)) or copy.count("\n") != text.count("\n"):
        raise ValueError("escaped copy is not equivalent")
    return copy


def functions(blocks, file, out, owner="", closure=False):
    """Every function, method and closure; closures are marked so radon's top-level counts stay comparable."""
    for block in blocks:
        if type(block).__name__ == "Class":
            functions(block.methods, file, out, block.name + ".")
            continue
        name = owner + block.name
        out.append({"file": file, "name": name, "line": block.lineno, "complexity": block.complexity, "closure": closure})
        functions(getattr(block, "closures", []), file, out, name + ".", True)


def measure(root, files):
    # Radon exists only in the isolated analysis environment; the rest of this module imports anywhere.
    from radon.complexity import cc_visit
    from radon.metrics import mi_visit
    from radon.raw import analyze

    result = {"files": [], "functions": [], "compatibility": []}
    for file in files:
        text = (root / file).read_text(encoding="utf-8")
        functions(cc_visit(text), file, result["functions"])
        try:
            mi, raw = mi_visit(text, True), analyze(text)
        except SyntaxError:
            copy = compatible_text(text)
            if copy is None:
                raise
            mi, raw = mi_visit(copy, True), analyze(copy)
            result["compatibility"].append({"file": file, "treatment": "escaped Unicode line separators; AST and LF count verified"})
        result["files"].append({"file": file, "mi": round(mi, 2), "sloc": raw.sloc, "loc": raw.loc, "comments": raw.comments})
    return result


if __name__ == "__main__":
    root = Path(sys.argv[1])
    print(json.dumps(measure(root, sys.argv[2:])))
