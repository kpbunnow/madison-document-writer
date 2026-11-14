"""Index metadata and final exclusions. No file reads, trust verification or process caches.
Only the request-local seen/duplicate sets and result dictionaries supplied by the owner are updated."""


def _valid_summary_records(summary):
    return all(
        isinstance(summary.get(key, []), list) and all(isinstance(item, dict) for item in summary.get(key, []))
        for key in ("documents", "violations", "reinspections", "visits", "citations", "referrals")
    )


def summary_casefile(summary, files, seen, duplicates, number_key):
    if not isinstance(summary, dict) or summary.get("format") != "madison-case-summary" or not isinstance(summary.get("case"), dict):
        raise ValueError("not a case summary")
    number = number_key(summary["case"].get("number"))
    if number in seen:
        duplicates.add(number)
        raise ValueError("duplicate summary; excluded from totals")
    seen.add(number)
    if number not in files or len(files[number]) != 1:
        raise ValueError("missing or duplicate case file; excluded from reports")
    casefile = files[number][0]
    source_file = summary.get("sourceFile")
    if source_file is not None and not isinstance(source_file, str):
        raise ValueError("summary source file is not a file name")
    if source_file and source_file.casefold() != casefile.name.casefold():
        raise ValueError("summary points to a different case file")
    if not _valid_summary_records(summary):
        raise ValueError("invalid summary records")
    return number, casefile


def finish(out, by_number, duplicates, mismatched, files):
    for number in duplicates:
        by_number.pop(number, None)
    out["summaries"] = list(by_number.values())
    excluded = set(out["stale"]) | mismatched
    for number, paths in files.items():
        if number not in by_number and not any(p.name in excluded for p in paths):
            out["missing"].extend(p.name for p in paths)
    return out
