"""Diagnostic Python maintainability measurement, run with the isolated analysis interpreter
(tools/analysis-requirements.txt) by tools/measure_maintainability.py. Read-only; never gate or release evidence.

Radon's maintainability-index and raw-metrics passes split source text with str.splitlines(), which also breaks
on U+2028, U+2029 and the other Unicode line separators. A string literal holding those characters (the
ECMAScript whitespace table, which moved from helper/case_projection.py to helper/projection_values.py in Phase 2)
then fails to parse. Only for those passes, such a file is analysed as a copy in which each raw separator is
replaced by its escape sequence; the copy is accepted only if its AST is identical to the original's and it has the
same LF line count. Production source is never rewritten.
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


def functions(blocks, file, out, owner="", closure=False, seen=None):
    """Count each source function once, preferring its qualified class owner over Radon's bare duplicate."""
    seen = set() if seen is None else seen
    for block in sorted(blocks, key=lambda b: type(b).__name__ != "Class"):
        if type(block).__name__ == "Class":
            functions(block.methods, file, out, owner + block.name + ".", closure, seen)
            continue
        location = (file, block.lineno, block.col_offset, block.name)
        if location in seen:
            continue
        seen.add(location)
        name = owner + block.name
        out.append({"file": file, "name": name, "line": block.lineno, "complexity": block.complexity, "closure": closure})
        functions(getattr(block, "closures", []), file, out, name + ".", True, seen)


def file_statistics(text):
    """Keep the original strict assessment's three MI variants separate; mi remains the default alias."""
    from radon.metrics import mi_compute, mi_parameters
    from radon.raw import analyze

    volume, complexity, lloc, comments = mi_parameters(text, count_multi=True)
    _, _, _, regular = mi_parameters(text, count_multi=False)
    raw = analyze(text)
    return {
        "mi": round(mi_compute(volume, complexity, lloc, comments), 2),
        "miCodeOnly": round(mi_compute(volume, complexity, lloc, 0), 2),
        "miRegularComments": round(mi_compute(volume, complexity, lloc, regular), 2),
        "halsteadVolume": volume,
        "moduleComplexity": complexity,
        "lloc": lloc,
        "sloc": raw.sloc,
        "loc": raw.loc,
        "comments": raw.comments,
        "multilineStringLines": raw.multi,
    }


def measure(root, files):
    # Radon exists only in the isolated analysis environment; the rest of this module imports anywhere.
    from radon.complexity import cc_visit

    result = {"files": [], "functions": [], "compatibility": []}
    for file in files:
        text = (root / file).read_text(encoding="utf-8")
        functions(cc_visit(text), file, result["functions"])
        try:
            statistics = file_statistics(text)
        except SyntaxError:
            copy = compatible_text(text)
            if copy is None:
                raise
            statistics = file_statistics(copy)
            result["compatibility"].append({"file": file, "treatment": "escaped Unicode line separators; AST and LF count verified"})
        result["files"].append({"file": file, **statistics})
    return result


if __name__ == "__main__":
    root = Path(sys.argv[1])
    print(json.dumps(measure(root, sys.argv[2:])))
