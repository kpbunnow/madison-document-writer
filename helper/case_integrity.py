"""Helper-owned commit-order hashes and independently retained daily digest anchors."""

import copy
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
from reporting_reads import ordered_reads
import sys

sys.path.insert(0, str(Path(__file__).with_name("vendor") / "python"))
import rfc8785

SETTINGS = Path(__file__).with_name("integrity-settings.json")
ZERO = "0" * 64


GENESIS_CONFLICT = (
    "This case's migration history conflicts with the evidence the program retained for it, so it was not saved. "
    "Your work is kept on this device. Ask an administrator to review the case before saving again."
)


def canonical(value):
    return rfc8785.dumps(value)


def hash_bytes(raw):
    return hashlib.sha256(raw).hexdigest()


def hashed(previous, value):
    return hash_bytes(previous.encode("ascii") + canonical(value))


def stamp():
    return datetime.now(timezone.utc).isoformat()


def body(record):
    return {k: v for k, v in record.items() if k != "integrity"}


def protected_folder(folder):
    try:
        configured = json.loads(SETTINGS.read_text(encoding="utf-8"))["anchorFolder"]
        path = Path(configured)
        if not path.is_absolute() or path.resolve() == Path(folder).resolve() or Path(folder).resolve() in path.resolve().parents:
            return None
        return path if path.is_dir() else None
    except (OSError, ValueError, KeyError, TypeError):
        return None


def commit_record(current, record):
    result = copy.deepcopy(record)
    result["schema"] = 5
    prior = copy.deepcopy(current.get("integrity")) if current and current.get("schema") == 5 else None
    if prior is None:
        old = current.get("events", []) if current else []
        genesis = {
            "sourceSchema": current.get("schema", 1) if current else 5,
            "committedAt": stamp(),
            "eventIds": [e["id"] for e in old],
            "historyHash": hash_bytes(canonical(old)),
            "notice": "History as found; integrity is proven from migration forward.",
        }
        genesis["hash"] = hash_bytes(canonical(genesis))
        prior = {"genesis": genesis, "entries": [], "commits": []}
    known = set(prior["genesis"]["eventIds"]) | {x["eventId"] for x in prior["entries"]}
    head = prior["entries"][-1]["hash"] if prior["entries"] else prior["genesis"]["hash"]
    for event in result.get("events", []):
        if event["id"] not in known:
            entry = {"eventId": event["id"], "seq": len(prior["entries"]) + 1, "prevHash": head, "hash": hashed(head, event), "committedAt": stamp()}
            prior["entries"].append(entry)
            head = entry["hash"]
            known.add(event["id"])
    context = {
        "headHash": head,
        "rootHash": hash_bytes(canonical(body(result))),
        "eventOrder": [e["id"] for e in result["events"]],
        "commitTimes": [x["committedAt"] for x in prior["entries"]],
        "committedAt": stamp(),
    }
    previous = prior["commits"][-1]["hash"] if prior["commits"] else ZERO
    if not prior["commits"] or prior["commits"][-1]["context"]["rootHash"] != context["rootHash"]:
        prior["commits"].append({"prevHash": previous, "context": context, "hash": hashed(previous, context)})
    prior["headHash"] = head
    result["integrity"] = prior
    return result


def registry(folder):
    path = Path(folder) / "_integrity" / "migrated.json"
    if not path.exists():
        return {"format": "madison-migration-registry", "entries": []}
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except (ValueError, OSError) as error:
        raise ValueError("Migration registry is damaged; contact an administrator") from error
    if (
        not isinstance(value, dict)
        or value.get("format") != "madison-migration-registry"
        or not isinstance(value.get("entries"), list)
        or any(
            not isinstance(e, dict) or not all(isinstance(e.get(k), str) and e[k] for k in ("caseNumber", "fileName", "genesisHash", "migratedAt"))
            for e in value.get("entries", [])
        )
    ):
        raise ValueError("Migration registry is damaged; contact an administrator")
    return value


def register_migration(folder, record, file_name, reconstructed=False, recovery=False):
    from case_store import file_lock, atomic_write

    with file_lock(Path(folder), "integrity-registry"):
        value = registry(folder)
        number = record["case"]["number"]
        retained = [x for x in value["entries"] if x["caseNumber"].casefold() == number.casefold()]
        if retained and retained[-1]["genesisHash"] == record["integrity"]["genesis"]["hash"]:
            return
        if retained and not recovery:
            raise ValueError(GENESIS_CONFLICT)
        value["entries"].append(
            {
                "caseNumber": number,
                "fileName": file_name,
                "genesisHash": record["integrity"]["genesis"]["hash"],
                "migratedAt": stamp(),
                "reconstructed": reconstructed,
                "administrativeRecovery": recovery,
            }
        )
        path = Path(folder) / "_integrity" / "migrated.json"
        path.parent.mkdir(exist_ok=True)
        atomic_write(path, json.dumps(value, ensure_ascii=False, separators=(",", ":")).encode())


def has_modern_evidence(value):
    if isinstance(value, dict):
        if any(k in value for k in ("integrity", "pricedOn", "policyVersionHash")):
            return True
        if isinstance(value.get("authoringVersion"), (int, float)) and value["authoringVersion"] >= 7:
            return True
        return any(has_modern_evidence(v) for v in value.values())
    return isinstance(value, list) and any(has_modern_evidence(v) for v in value)


class VerificationContext:
    """One operation's retained evidence; never cached across requests or saves."""

    def __init__(self, folder, external=None, *, summary_workers=1):
        self.folder = Path(folder)
        self.value = registry(folder)
        self.by_number = {}
        for entry in self.value["entries"]:
            self.by_number.setdefault(entry["caseNumber"].casefold(), []).append(entry)
        self.anchors, self.known = {}, {e["caseNumber"].casefold() for e in self.value["entries"]}
        external = external or protected_folder(folder)
        seen = set()
        for path in sorted(Path(external).glob("*.sha256"), reverse=True) if external else []:
            receipt = json.loads(path.read_text(encoding="utf-8"))
            name = receipt["digestFile"]
            if Path(name).name != name:
                raise ValueError("Invalid digest filename")
            if name in seen:
                continue
            seen.add(name)
            raw = (self.folder / "_integrity" / name).read_bytes()
            if hash_bytes(raw) != receipt["sha256"]:
                raise ValueError("Protected daily digest changed")
            digest = json.loads(raw)
            for entry in reversed(digest["entries"]):
                if "registryHash" in entry:
                    prefix = self.value["entries"][: entry["registryLength"]]
                    if hash_bytes(canonical(prefix)) != entry["registryHash"]:
                        raise ValueError("Anchored migration registry changed")
                for number, head in entry["heads"].items():
                    self.anchors.setdefault(number.casefold(), head)
                    self.known.add(number.casefold())
        for path in (self.folder / "_integrity").glob("*.json"):
            if path.name in ("migrated.json", "anchor-status.json"):
                continue
            digest = json.loads(path.read_text(encoding="utf-8"))
            for entry in digest.get("entries", []):
                self.known.update(n.casefold() for n in entry.get("heads", {}))

        def read_summary(path):
            try:
                return json.loads(path.read_text(encoding="utf-8"))
            except (OSError, ValueError):
                return None

        for summary in ordered_reads(sorted((self.folder / "Reporting Index").glob("*.json")), read_summary, summary_workers):
            if not isinstance(summary, dict):
                continue
            meta = summary.get("integrity")
            case = summary.get("case")
            if isinstance(meta, dict) and meta.get("headHash") and isinstance(case, dict) and isinstance(case.get("number"), str):
                self.known.add(case["number"].casefold())
        self.pending = {}
        for path in (self.folder / "_integrity" / "transactions").glob("*.json"):
            intent = read_intent(path)
            self.pending[intent["record"]["case"]["number"].casefold()] = intent

    def retained(self, record):
        number = record["case"]["number"].casefold()
        entries = self.by_number.get(number, [])
        pending = self.pending.get(number)
        if pending:
            root = hash_bytes(canonical(record))
            if root == pending["recordHash"]:
                genesis = pending["record"]["integrity"]["genesis"]["hash"]
                if not entries or entries[-1]["genesisHash"] != genesis:
                    entries = entries + [{"genesisHash": genesis, "administrativeRecovery": pending["recovery"]}]
            elif root == pending["previousRecordHash"]:
                # Registry-first interruption is distinguishable from a downgrade.
                genesis = pending["record"]["integrity"]["genesis"]["hash"]
                entries = [e for e in entries if e["genesisHash"] != genesis]
        return entries


def anchor_evidence(record, folder, external=None, context=None):
    if not folder:
        return None, False
    context = context or VerificationContext(folder, external)
    number = record.get("case", {}).get("number", "").casefold()
    pending = context.pending.get(number)
    previous = pending and hash_bytes(canonical(record)) == pending["previousRecordHash"]
    return context.anchors.get(number), bool(context.retained(record)) or (number in context.known and not previous)


def intent_path(folder, number):
    return Path(folder) / "_integrity" / "transactions" / (hash_bytes(number.casefold().encode()) + ".json")


def read_intent(path):
    value = json.loads(Path(path).read_text(encoding="utf-8"))
    from case_store import safe_json_name, case_file_key, case_number_key

    if value.get("format") != "madison-integrity-transaction" or not isinstance(value.get("recovery"), bool):
        raise ValueError("Pending integrity transaction is damaged; contact an administrator")
    safe_json_name(value["fileName"])
    number = case_number_key(value["record"]["case"]["number"])
    if Path(path).name != intent_path(Path(path).parent.parent.parent, number).name or case_file_key(value["fileName"]) != number:
        raise ValueError("Pending integrity transaction identity changed")
    for key in ("previousRevision", "previousRecordHash"):
        raw = value.get(key)
        if not isinstance(raw, str) or raw and (len(raw) != 64 or any(c not in "0123456789abcdef" for c in raw)):
            raise ValueError("Pending integrity transaction baseline is invalid")
    if hash_bytes(canonical(value["record"])) != value["recordHash"] or not verify_record(value["record"])["valid"]:
        raise ValueError("Pending integrity transaction is damaged; contact an administrator")
    return value


def reconcile_publication(folder, number, allow_recovery=False):
    """Caller owns the case lock. Complete only the exact durable planned write."""
    from case_store import atomic_write, encoded

    path = intent_path(folder, number)
    if not path.exists():
        return False
    intent = read_intent(path)
    if intent["recovery"] and not allow_recovery:
        raise ValueError("An administrator must resume the pending record recovery before saving")
    target = Path(folder) / intent["fileName"]
    raw = target.read_bytes() if target.exists() else None
    actual = hash_bytes(raw) if raw is not None else ""
    planned = encoded(intent["record"])
    if actual not in (intent["previousRevision"], hash_bytes(planned)):
        raise ValueError("Case changed during a pending integrity transaction; administrator review required")
    if actual != hash_bytes(planned):
        atomic_write(target, planned)
    register_migration(folder, intent["record"], target.name, recovery=intent["recovery"])
    path.unlink()
    return True


def publish_record(folder, target, record, previous=None, recovery=False):
    """Durable intent -> case -> registry -> completion; retries reuse the genesis."""
    from case_store import atomic_write, encoded

    retained = [e for e in registry(folder)["entries"] if e["caseNumber"].casefold() == record["case"]["number"].casefold()]
    if not recovery and retained:
        if retained[-1]["genesisHash"] != record["integrity"]["genesis"]["hash"]:
            raise ValueError(GENESIS_CONFLICT)
        atomic_write(target, encoded(record))
        return
    path = intent_path(folder, record["case"]["number"])
    path.parent.mkdir(parents=True, exist_ok=True)
    if path.exists():
        raise ValueError("Complete the pending integrity transaction before another save")
    value = {
        "format": "madison-integrity-transaction",
        "fileName": Path(target).name,
        "previousRevision": hash_bytes(previous) if previous is not None else "",
        "previousRecordHash": hash_bytes(canonical(json.loads(previous))) if previous is not None else "",
        "record": record,
        "recordHash": hash_bytes(canonical(record)),
        "recovery": recovery,
    }
    atomic_write(path, encoded(value))
    reconcile_publication(folder, record["case"]["number"], allow_recovery=recovery)


def reconstruct_registry(folder):
    """Only intact schema-5 files can bootstrap the upgrade registry."""
    root = Path(folder)
    if not root.is_dir():
        return
    for path in sorted(root.glob("*.json")):
        try:
            record = json.loads(path.read_text(encoding="utf-8"))
            if record.get("format") == "madison-case-file" and record.get("schema") == 5 and verify_record(record)["valid"]:
                register_migration(root, record, path.name, reconstructed=True)
        except (OSError, ValueError, KeyError, TypeError):
            continue  # reads expose failures; never repair corrupt files


def verify_record(record, folder=None, external=None, context=None):
    last = ""

    def failure(event, expected, actual):
        return {
            "valid": False,
            "eventId": event,
            "expected": str(expected),
            "actual": str(actual),
            "lastGoodCommitTime": last,
            "label": "This record was changed outside the program",
            "anchored": False,
        }

    try:
        external = external or (protected_folder(folder) if folder else None)
        context = context or (VerificationContext(folder, external) if folder else None)
        anchored_case, known = anchor_evidence(record, folder, external, context)
        if record.get("schema", record.get("version", 1)) < 5 or not record.get("integrity"):
            if known or has_modern_evidence(record) or record.get("schema", 0) >= 5:
                return {
                    **failure("migration", "retained schema 5 and integrity", "removed or downgraded"),
                    "label": "Integrity record removed from a migrated case",
                    "state": "downgraded",
                }
            return {"valid": True, "legacy": True, "anchored": False, "label": "Legacy: history as found; integrity begins on migration"}
        chain = record["integrity"]
        genesis = chain["genesis"]
        retained = context.retained(record) if context else []
        if retained and retained[-1]["genesisHash"] != genesis["hash"]:
            return failure("migration genesis", retained[-1]["genesisHash"], genesis["hash"])
        expected = hash_bytes(canonical({k: v for k, v in genesis.items() if k != "hash"}))
        if expected != genesis["hash"]:
            return failure("genesis", genesis["hash"], expected)
        events = {e["id"]: e for e in record["events"]}
        if len(events) != len(record["events"]):
            return failure("duplicate event", "unique identities", "duplicate identity")
        old = [events.get(identity) for identity in genesis["eventIds"]]
        actual = hash_bytes(canonical(old))
        if actual != genesis["historyHash"]:
            return failure(next((i for i in genesis["eventIds"] if i not in events), "genesis history"), genesis["historyHash"], actual)
        head = genesis["hash"]
        known = set(genesis["eventIds"])
        last = genesis["committedAt"]
        for seq, entry in enumerate(chain["entries"], 1):
            identity = entry["eventId"]
            actual = hashed(head, events.get(identity))
            if identity in known or entry["seq"] != seq or entry["prevHash"] != head or entry["hash"] != actual:
                return failure(identity, entry["hash"], actual)
            known.add(identity)
            head = actual
            last = entry["committedAt"]
        if known != set(events):
            return failure(next(iter(set(events) - known), "deleted event"), "one commit per event", "missing or surplus event")
        if chain["headHash"] != head:
            return failure("head", chain["headHash"], head)
        previous = ZERO
        for commit in chain["commits"]:
            actual = hashed(previous, commit["context"])
            if commit["prevHash"] != previous or commit["hash"] != actual:
                return failure("record commit", commit["hash"], actual)
            previous = actual
        commit_context = chain["commits"][-1]["context"]
        order = [e["id"] for e in record["events"]]
        if commit_context["eventOrder"] != order:
            index = next((i for i, (a, b) in enumerate(zip(commit_context["eventOrder"], order)) if a != b), 0)
            return failure(
                order[index] if order else "deleted event", hash_bytes(canonical(commit_context["eventOrder"])), hash_bytes(canonical(order))
            )
        if commit_context["headHash"] != head or commit_context["commitTimes"] != [x["committedAt"] for x in chain["entries"]]:
            return failure("commit metadata", commit_context["headHash"], head)
        actual = hash_bytes(canonical(body(record)))
        if actual != commit_context["rootHash"]:
            return failure("case details or inspectors", commit_context["rootHash"], actual)
        anchored = bool(anchored_case)
        if (
            anchored_case
            and anchored_case["commitHash"] not in {c["hash"] for c in chain["commits"]}
            and not (
                genesis.get("administrativeRecovery", {}).get("priorAnchoredCommitHash") == anchored_case["commitHash"]
                and folder
                and any(x.get("administrativeRecovery") and x.get("genesisHash") == genesis["hash"] for x in retained)
            )
        ):
            return failure("anchored head", anchored_case["commitHash"], previous)
        pending = bool(context and record["case"]["number"].casefold() in context.pending)
        return {
            "valid": True,
            "anchored": anchored,
            "pendingTransaction": pending,
            "label": "Verified chain; migration completion pending — retry saving"
            if pending
            else "Verified / anchored"
            if anchored
            else "Verified chain / not externally anchored",
            "headHash": head,
            "commitHash": previous,
            "lastGoodCommitTime": last,
            "migrationDate": genesis["committedAt"],
            "legacyHistoryAsFound": genesis["sourceSchema"] < 5,
        }
    except (KeyError, TypeError, ValueError, IndexError, OSError) as error:
        if str(error) == "Migration registry is damaged; contact an administrator":
            return {**failure("migration registry", "valid registry", str(error)), "label": str(error), "state": "registry-damaged"}
        return failure("integrity metadata", "complete verifiable chain", str(error) or type(error).__name__)


def require_valid(record, folder=None, context=None):
    result = verify_record(record, folder, context=context)
    if not result["valid"]:
        raise ValueError(
            result["label"]
            + " — event "
            + result["eventId"]
            + "; expected "
            + result["expected"]
            + "; actual "
            + result["actual"]
            + "; last good commit "
            + result["lastGoodCommitTime"]
        )
    return result


def anchor_daily(folder, external=None):
    folder = Path(folder)
    external = external or protected_folder(folder)
    if not external:
        return {"anchored": False, "reason": "IT-controlled anchor folder is not configured or available"}
    external = Path(external)
    from case_store import file_lock, atomic_write

    with file_lock(folder, "integrity-anchor"):
        context = VerificationContext(folder, external)
        if any(p["recovery"] for p in context.pending.values()):
            raise ValueError("Administrator must complete pending recovery before anchoring")
        heads = {}
        for path in sorted(folder.glob("*.json")):
            record = json.loads(path.read_text(encoding="utf-8"))
            if record.get("format") != "madison-case-file":
                continue
            status = require_valid(record, folder, context)
            if record.get("schema", 1) < 5:
                continue
            heads[record["case"]["number"]] = {
                "headHash": status["headHash"],
                "commitHash": status["commitHash"],
                "seq": len(record["integrity"]["entries"]),
            }
        migrated = registry(folder)["entries"]
        registry_hash = hash_bytes(canonical(migrated))
        # Immutable snapshots keep every prior receipt valid if publication fails.
        # A content-addressed digest also makes retries after a lost acknowledgment exact.
        day = datetime.now(timezone.utc).date().isoformat()
        destination = folder / "_integrity"
        destination.mkdir(exist_ok=True)
        digest = {
            "format": "madison-integrity-digest",
            "day": day,
            "entries": [{"heads": heads, "registryHash": registry_hash, "registryLength": len(migrated)}],
        }
        raw = canonical(digest)
        identity = hash_bytes(raw)
        target = destination / (day + "-" + identity + ".json")
        if target.exists():
            if target.read_bytes() != raw:
                raise ValueError("Retained digest changed")
        else:
            atomic_write(target, raw)
        expected = canonical({"digestFile": target.name, "sha256": identity})
        if any(json.loads(p.read_text(encoding="utf-8")).get("digestFile") == target.name for p in external.glob("*.sha256")):
            return {"anchored": True, "day": day, "entries": 1, "digestFile": target.name}
        # Timestamp sorts new receipt generations before older ones; UUID prevents collision.
        receipt = external / (datetime.now(timezone.utc).strftime("%Y-%m-%d-%H%M%S%f") + "-" + identity + ".sha256")
        atomic_write(receipt, expected)
        return {"anchored": True, "day": day, "entries": 1, "digestFile": target.name}


def anchor_after_save(folder):
    try:
        result = anchor_daily(folder)
    except ValueError:
        result = {"anchored": False, "reason": "Integrity anchoring needs administrator review; protected evidence was preserved"}
    except (OSError, RuntimeError):
        result = {"anchored": False, "reason": "Protected anchoring is pending; contact IT if it continues"}
    try:
        from case_store import atomic_write

        path = Path(folder) / "_integrity" / "anchor-status.json"
        path.parent.mkdir(exist_ok=True)
        status = {"format": "madison-anchor-status", "at": stamp(), **result}
        if "entries" in status:
            status["digestEntryCount"] = status.pop("entries")
        atomic_write(path, canonical(status))
    except OSError:
        pass  # a diagnostic write cannot undo an acknowledged case save
    return result


def anchor_health(folder):
    if folder:
        try:
            registry(folder)
        except (ValueError, OSError):
            return "Migration registry is damaged; contact an administrator"
    if not SETTINGS.exists():
        return "WARNING: no external anchor configured; the migration registry is on the same share. IT must choose a protected destination"
    if folder and protected_folder(folder):
        try:
            status = json.loads((Path(folder) / "_integrity/anchor-status.json").read_text(encoding="utf-8"))
            if not status.get("anchored"):
                return status.get("reason", "Anchoring needs administrator review")
        except (OSError, ValueError):
            pass
        return "Configured and reachable"
    return "Configured destination unavailable or invalid; not externally anchored"
