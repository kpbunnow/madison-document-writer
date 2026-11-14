"""Pure parcel-history updates for a single locked server operation. No file or network operations."""


def merge_results(c, need, got, failed, today):
    for pid in need:
        if pid in failed:
            continue
        if pid not in got:
            c["missing"][pid] = today
            continue
        c["missing"].pop(pid, None)
        rec = got[pid]
        hist = c["parcels"].setdefault(pid, {"history": []})["history"]
        last = hist[-1] if hist else None
        if last and all(last.get(k) == rec[k] for k in ("alder", "building", "lat", "lon")):
            last["checked"] = today
        else:
            hist.append(dict(rec, fetched=today, checked=today))


def requests(ids, normalize):
    want = sorted({x for x in (normalize(i) for i in ids or []) if x})
    bad = sorted({str(i) for i in ids or [] if not normalize(i)})
    return want, bad


def needed(c, want, refresh, today):
    return (
        want
        if refresh
        else [x for x in want if (x not in c["parcels"] and x not in c["missing"]) or (x in c["missing"] and c["missing"][x] != today)]
    )


def response(c, want, bad, error, got):
    return {
        "ok": not error,
        "error": error,
        "invalid": bad,
        "partial": bool(error and got),
        "parcels": {x: c["parcels"][x] for x in want if x in c["parcels"] and x not in c["missing"]},
        "missing": [x for x in want if x in c["missing"]],
    }
