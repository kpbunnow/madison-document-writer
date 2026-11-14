"""Static inventory of the five helper hotspots (diagnostic only). For every function it lists the effects it
performs directly: refusals raised, file reads and writes, locks, network calls, and the helper functions that call it.
Read-only syntax inspection; nothing is imported or executed.

Usage: python tools/hotspot_inventory.py [metrics.json] > inventory.json
The optional metrics.json (from tools/measure_maintainability.py) adds the Radon complexity of each function.
"""

import ast
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
HOTSPOTS = ["helper/case_integrity.py", "helper/case_store.py", "helper/server.py", "helper/case_projection.py", "helper/citation_pricing.py"]
EFFECTS = {
    "fileRead": {"open", "read_bytes", "read_text", "read_plain_bytes", "plain_json_files", "iterdir", "glob", "stat", "exists", "is_dir"},
    "fileWrite": {"write_bytes", "write_text", "atomic_write", "create_only_write", "os.replace", "unlink", "mkdir", "rename", "rmtree"},
    "lock": {"file_lock", "acquire", "release"},
    "network": {"fetch_json", "urlopen", "request"},
}


def call_name(node):
    """`name` for a plain call, `module.name` when called on a module name (so os.replace is not str.replace)."""
    target = node.func
    if isinstance(target, ast.Attribute):
        return target.value.id + "." + target.attr if isinstance(target.value, ast.Name) and target.value.id == "os" else target.attr
    return target.id if isinstance(target, ast.Name) else ""


def own_nodes(function):
    """Nodes of this function, excluding nested function and class bodies (those are listed separately)."""
    stack = list(function.body)
    while stack:
        node = stack.pop()
        yield node
        if not isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef, ast.Lambda)):
            stack.extend(ast.iter_child_nodes(node))


def holds_lock(node):
    """A `with` statement whose context manager names a lock."""
    return isinstance(node, ast.With) and any("lock" in ast.unparse(item.context_expr).lower() for item in node.items)


def effects_of(function, calls):
    found = {kind: sorted(set(calls) & names) for kind, names in EFFECTS.items()}
    found = {kind: names for kind, names in found.items() if names}
    if any(holds_lock(n) for n in own_nodes(function)):
        found["lockScope"] = True
    return found


def describe(function):
    calls = [call_name(n) for n in own_nodes(function) if isinstance(n, ast.Call)]
    return {
        "line": function.lineno,
        "length": function.end_lineno - function.lineno + 1,
        "refusals": sum(isinstance(n, ast.Raise) for n in own_nodes(function)),
        "effects": effects_of(function, calls),
        "calls": sorted(set(calls)),
    }


def functions(tree, prefix=""):
    for node in tree.body if hasattr(tree, "body") else []:
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
            yield prefix + node.name, node
            yield from functions(node, prefix + node.name + ".")
        elif isinstance(node, ast.ClassDef):
            yield from functions(node, prefix + node.name + ".")


def inventory(metrics=None):
    complexity = {(f["file"], f["name"]): f["complexity"] for f in (metrics or {}).get("python", {}).get("functions", {}).get("complete", [])}
    trees = {str(p.relative_to(ROOT)): ast.parse(p.read_text(encoding="utf-8")) for p in sorted((ROOT / "helper").glob("*.py"))}
    callers = {}
    for file, tree in trees.items():
        for name, function in functions(tree):
            for called in describe(function)["calls"]:
                callers.setdefault(called, set()).add(file + ":" + name)
    out = {}
    for file in HOTSPOTS:
        rows = {}
        for name, function in functions(trees[file]):
            row = describe(function)
            row["complexity"] = complexity.get((file, name))
            row["callers"] = sorted(callers.get(name.split(".")[-1], set()) - {file + ":" + name})
            del row["calls"]
            rows[name] = row
        out[file] = rows
    return out


if __name__ == "__main__":
    metrics = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8")) if len(sys.argv) > 1 else None
    print(json.dumps(inventory(metrics), indent=1))
