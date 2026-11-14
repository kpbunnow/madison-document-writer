"""Pure phases of case-history verification. case_integrity retains evidence/context acquisition and verdict
ordering. Hash operations and failure construction are supplied explicitly; this module performs no I/O or writes."""


def legacy_verdict(record, known, modern_evidence, failure):
    if known or modern_evidence(record) or record.get("schema", 0) >= 5:
        return {
            **failure("migration", "retained schema 5 and integrity", "removed or downgraded"),
            "label": "Integrity record removed from a migrated case",
            "state": "downgraded",
        }
    return {"valid": True, "legacy": True, "anchored": False, "label": "Legacy: history as found; integrity begins on migration"}


def genesis_events(record, genesis, retained, failure, *, hash_bytes, canonical):
    if retained and retained[-1]["genesisHash"] != genesis["hash"]:
        return None, failure("migration genesis", retained[-1]["genesisHash"], genesis["hash"])
    expected = hash_bytes(canonical({k: v for k, v in genesis.items() if k != "hash"}))
    if expected != genesis["hash"]:
        return None, failure("genesis", genesis["hash"], expected)
    events = {e["id"]: e for e in record["events"]}
    if len(events) != len(record["events"]):
        return None, failure("duplicate event", "unique identities", "duplicate identity")
    old = [events.get(identity) for identity in genesis["eventIds"]]
    actual = hash_bytes(canonical(old))
    if actual != genesis["historyHash"]:
        return None, failure(next((i for i in genesis["eventIds"] if i not in events), "genesis history"), genesis["historyHash"], actual)
    return events, None


def invalid_entry(identity, known, entry, seq, head, actual):
    return identity in known or entry["seq"] != seq or entry["prevHash"] != head or entry["hash"] != actual


def event_head_verdict(events, known, chain, head, failure):
    if known != set(events):
        return failure(next(iter(set(events) - known), "deleted event"), "one commit per event", "missing or surplus event")
    if chain["headHash"] != head:
        return failure("head", chain["headHash"], head)
    return None


def committed_context(record, chain, head, failure, *, zero, hashed, hash_bytes, canonical, body):
    previous = zero
    for commit in chain["commits"]:
        actual = hashed(previous, commit["context"])
        if commit["prevHash"] != previous or commit["hash"] != actual:
            return None, failure("record commit", commit["hash"], actual)
        previous = actual
    commit_context = chain["commits"][-1]["context"]
    order = [e["id"] for e in record["events"]]
    if commit_context["eventOrder"] != order:
        index = next((i for i, (a, b) in enumerate(zip(commit_context["eventOrder"], order)) if a != b), 0)
        return None, failure(
            order[index] if order else "deleted event", hash_bytes(canonical(commit_context["eventOrder"])), hash_bytes(canonical(order))
        )
    if commit_context["headHash"] != head or commit_context["commitTimes"] != [x["committedAt"] for x in chain["entries"]]:
        return None, failure("commit metadata", commit_context["headHash"], head)
    actual = hash_bytes(canonical(body(record)))
    if actual != commit_context["rootHash"]:
        return None, failure("case details or inspectors", commit_context["rootHash"], actual)
    return previous, None


def anchor_mismatch(anchored_case, chain, genesis, folder, retained):
    return (
        anchored_case
        and anchored_case["commitHash"] not in {c["hash"] for c in chain["commits"]}
        and not (
            genesis.get("administrativeRecovery", {}).get("priorAnchoredCommitHash") == anchored_case["commitHash"]
            and folder
            and any(x.get("administrativeRecovery") and x.get("genesisHash") == genesis["hash"] for x in retained)
        )
    )


def verified_verdict(record, genesis, context, anchored, head, previous, last):
    pending = bool(context and record["case"]["number"].casefold() in context.pending)
    restarted = genesis.get("administrativeRecovery", {}).get("automatic") is True
    base = (
        "Verified chain; migration completion pending — retry saving"
        if pending
        else "Verified / anchored"
        if anchored
        else "Verified chain / not externally anchored"
    )
    return {
        "valid": True,
        "anchored": anchored,
        "pendingTransaction": pending,
        "historyRestarted": restarted,
        "label": base + ("; history restarted " + genesis["committedAt"][:10] + " because the case file was missing" if restarted else ""),
        "headHash": head,
        "commitHash": previous,
        "lastGoodCommitTime": last,
        "migrationDate": genesis["committedAt"],
        "legacyHistoryAsFound": genesis["sourceSchema"] < 5,
    }
