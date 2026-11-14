"""Exact lexical clone candidates, not semantic equivalence or a maintainability score.

Usage: python tools/measure_duplication.py --out /outside/checkout/clones.json
Retains identifiers, literals and Python indentation/logical-newline tokens. Excludes comments/spacing,
vendor/generated files, frozen references, test scenarios, CSS/HTML/SQL and cross-language equivalence.
Thresholds and every scanned input hash are recorded; overlapping candidates are not added as a percentage.
"""

import argparse
from collections import defaultdict
import hashlib
import io
import itertools
import json
from pathlib import Path
import subprocess
import tokenize

from measure_coverage import source_state, source_inputs, verify_source

ROOT = Path(__file__).resolve().parents[1]
PATTERNS = ("app/modules/*.js", "app/assets/shared.js", "helper/*.py", "tools/*.py", "tools/*.cjs", "tools/*.js", "policy/*.py")
MASK = (1 << 64) - 1
BASE = 257


def python_tokens(source):
    ignored = {tokenize.ENCODING, tokenize.COMMENT, tokenize.NL, tokenize.ENDMARKER}
    return [
        [str(t.type) + ":" + ("" if t.type in {tokenize.INDENT, tokenize.DEDENT, tokenize.NEWLINE} else t.string), t.start[0], t.end[0]]
        for t in tokenize.generate_tokens(io.StringIO(source).readline)
        if t.type not in ignored
    ]


def scan_files():
    return sorted({p.relative_to(ROOT).as_posix() for pattern in PATTERNS for p in ROOT.glob(pattern) if p.is_file()})


def token_inputs(files):
    js = [p for p in files if p.endswith((".js", ".cjs"))]
    process = subprocess.run(
        ["node", "tools/duplication_tokens.cjs"], cwd=ROOT, input=json.dumps(js), capture_output=True, encoding="utf-8", check=True
    )
    values = json.loads(process.stdout)
    values.update({p: python_tokens((ROOT / p).read_text(encoding="utf-8")) for p in files if p.endswith(".py")})
    return values


def windows(ids, size):
    if len(ids) < size:
        return
    power, value = pow(BASE, size - 1, 1 << 64), 0
    for item in ids[:size]:
        value = (value * BASE + item) & MASK
    yield 0, value
    for start in range(1, len(ids) - size + 1):
        value = ((value - ids[start - 1] * power) * BASE + ids[start + size - 1]) & MASK
        yield start, value


def indexed_windows(values, min_tokens):
    intern, sequences, buckets = {}, {}, defaultdict(list)
    for name in sorted(values):
        ids = []
        for value, _, _ in values[name]:
            intern.setdefault(value, len(intern) + 1)
            ids.append(intern[value])
        sequences[name] = ids
        for start, digest in windows(ids, min_tokens):
            buckets[(Path(name).suffix == ".py", digest)].append((name, start))
    return sequences, buckets


def matching_spans(sequences, pair, min_tokens):
    (a, left), (b, right) = pair
    if a == b and abs(right - left) < min_tokens:
        return None  # Overlapping windows are not copies.
    aa, bb = sequences[a], sequences[b]
    if aa[left : left + min_tokens] != bb[right : right + min_tokens]:
        return None  # Hash collisions are never evidence.
    if left and right and aa[left - 1] == bb[right - 1]:
        return None  # Keep maximal matches only.
    length = min_tokens
    while left + length < len(aa) and right + length < len(bb) and aa[left + length] == bb[right + length]:
        if a == b and left + length >= right:
            break
        length += 1
    return [(name, start, start + length - 1) for name, start in [(a, left), (b, right)]]


def detect(values, min_tokens=80, min_lines=8):
    if min_tokens < 2 or min_lines < 1:
        raise ValueError("Clone thresholds must be at least two tokens and one line")
    sequences, buckets = indexed_windows(values, min_tokens)
    groups = {}
    for bucket in buckets.values():
        for pair in itertools.combinations(bucket, 2):
            spans = matching_spans(sequences, pair, min_tokens)
            if not spans or any(values[name][end][2] - values[name][start][1] + 1 < min_lines for name, start, end in spans):
                continue
            a, left, end = spans[0]
            content = [t[0] for t in values[a][left : end + 1]]
            digest = hashlib.sha256(json.dumps(content, ensure_ascii=True, separators=(",", ":")).encode()).hexdigest()
            group = groups.setdefault(digest, {"id": digest, "tokens": len(content), "locations": set()})
            for name, start, end in spans:
                group["locations"].add((name, values[name][start][1], values[name][end][2]))
    return [
        {**g, "locations": [{"file": p, "start": a, "end": b} for p, a, b in sorted(g["locations"])]}
        for g in sorted(groups.values(), key=lambda g: (-g["tokens"], g["id"]))
    ]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--out", required=True)
    parser.add_argument("--min-tokens", type=int, default=80)
    parser.add_argument("--min-lines", type=int, default=8)
    args = parser.parse_args()
    before, inputs = source_state(), source_inputs()
    files = scan_files()
    values = token_inputs(files)
    result = {
        "method": __doc__,
        "source": verify_source(before, inputs),
        "patterns": PATTERNS,
        "thresholds": {"tokens": args.min_tokens, "lines": args.min_lines},
        "files": {p: {"sha256": hashlib.sha256((ROOT / p).read_bytes()).hexdigest(), "tokens": len(values[p])} for p in files},
        "toolchain": {
            "python": subprocess.check_output(["python3", "--version"], text=True).strip(),
            "node": subprocess.check_output(["node", "--version"], text=True).strip(),
            "acorn": subprocess.check_output(["node", "-p", "require('acorn/package.json').version"], text=True).strip(),
        },
        "candidates": detect(values, args.min_tokens, args.min_lines),
    }
    # Recheck after detection as well as token acquisition.
    verify_source(before, inputs)
    Path(args.out).write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"files": len(files), "tokens": sum(len(v) for v in values.values()), "candidates": len(result["candidates"])}))


if __name__ == "__main__":
    main()
