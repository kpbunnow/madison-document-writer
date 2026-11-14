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
