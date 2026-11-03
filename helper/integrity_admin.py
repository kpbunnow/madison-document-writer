"""Explicit offline administrator recovery; no inspector HTTP route exists."""

import argparse
import copy
import json
from pathlib import Path
import case_integrity as integrity
import case_store


def recover(folder, name, administrator, reason, confirmed=False):
    if not confirmed or len(administrator.strip()) < 2 or len(reason.strip()) < 15:
        raise ValueError("Named administrator, detailed reason and explicit confirmation are required")
    root = Path(folder)
    name = case_store.safe_json_name(name)
    initial = json.loads((root / name).read_bytes())
    number = initial["case"]["number"]
    with case_store.file_lock(root, "case:" + case_store.case_number_key(number)):
        target = root / name
        if integrity.reconcile_publication(root, number, allow_recovery=True):
            result = json.loads(target.read_bytes())
            integrity.anchor_after_save(root, force=True)
            preserved = root / "_integrity" / "quarantine" / result["integrity"]["genesis"]["administrativeRecovery"]["quarantineFile"]
            return {"ok": True, "resumed": True, "quarantineFile": str(preserved), "integrity": integrity.require_valid(result, root)}
        raw = target.read_bytes()
        old = json.loads(raw)
        if integrity.verify_record(old, root)["valid"]:
            raise ValueError("This record is valid; recovery is unnecessary")
        anchor, _ = integrity.anchor_evidence(old, root, integrity.protected_folder(root))
        quarantine = root / "_integrity" / "quarantine"
        quarantine.mkdir(parents=True, exist_ok=True)
        digest = integrity.hash_bytes(raw)
        preserved = quarantine / (name + "." + digest + ".quarantined")
        if not preserved.exists():
            case_store.atomic_write(preserved, raw)
        restored = copy.deepcopy(old)
        restored.pop("integrity", None)
        restored["schema"] = 5
        case_store.validate_case(restored, legacy=True)
        note = {
            "administrator": administrator.strip(),
            "reason": reason.strip(),
            "quarantineFile": preserved.name,
            "priorFileSha256": digest,
            "priorAnchoredCommitHash": anchor["commitHash"] if anchor else "",
        }
        restored["events"].append(
            {"id": "admin_recovery_" + digest[:20], "type": "record.recovered", "at": integrity.stamp(), "by": administrator.strip(), "payload": note}
        )
        current = copy.deepcopy(restored)
        current["schema"] = 4
        result = integrity.commit_record(current, restored)
        genesis = result["integrity"]["genesis"]
        genesis["administrativeRecovery"] = note
        genesis["hash"] = integrity.hash_bytes(integrity.canonical({k: v for k, v in genesis.items() if k != "hash"}))
        result["integrity"]["entries"] = []
        result["integrity"]["commits"] = []
        result["integrity"]["headHash"] = genesis["hash"]
        result = integrity.commit_record(result, result)
        integrity.publish_record(root, target, result, raw, recovery=True)
        integrity.anchor_after_save(root, force=True)
        return {"ok": True, "quarantineFile": str(preserved), "integrity": integrity.require_valid(result, root)}


def approve_restart(folder, number, administrator, reason, confirmed=False):
    """Approve a new history for one case whose file is gone for good but whose number the registry still retains.

    The case file must be absent. Nothing is deleted or rewritten here: the approval is bound to the registry entries
    and anchored commit seen now, and the next save of that case from Document Writer consumes it, starting a new
    history whose first record names the administrator, the reason and the prior anchored commit."""
    if not confirmed or len(administrator.strip()) < 2 or len(reason.strip()) < 15:
        raise ValueError("Named administrator, detailed reason and explicit confirmation are required")
    root = Path(folder)
    key = case_store.case_number_key(number, strict=True)
    with case_store.file_lock(root, "case:" + key):
        if any(case_store.case_file_key(p) == key for p in root.glob("*.json")):
            raise ValueError("A case file for this number exists on the share; restore or recover that file instead of restarting the case")
        if integrity.intent_path(root, number).exists():
            raise ValueError("Complete the pending integrity transaction for this case first")
        context = integrity.VerificationContext(root, integrity.protected_folder(root))
        entries = context.by_number.get(number.casefold(), [])
        if not entries:
            raise ValueError("The registry has no entry for this case number, so no restart is needed")
        anchored = context.anchors.get(number.casefold())
        approval = {
            "format": integrity.RESTART_FORMAT,
            "caseNumber": number,
            "administrator": administrator.strip(),
            "reason": reason.strip(),
            "approvedAt": integrity.stamp(),
            "registryEntries": copy.deepcopy(entries),
            "priorAnchoredCommitHash": anchored["commitHash"] if anchored else "",
        }
        target = integrity.restart_path(root, number)
        target.parent.mkdir(parents=True, exist_ok=True)
        case_store.atomic_write(target, case_store.encoded(approval))
        return {"ok": True, "approval": str(target), "caseNumber": number, "anchored": bool(anchored)}


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Recover an unverified record after administrator review (prior bytes are preserved), "
        "or approve a restart of a case whose file is gone (--restart-missing CASE-NUMBER; no file argument)."
    )
    parser.add_argument("folder")
    parser.add_argument("file", nargs="?")
    parser.add_argument("--restart-missing", metavar="CASE_NUMBER")
    parser.add_argument("--administrator", required=True)
    parser.add_argument("--reason", required=True)
    parser.add_argument("--confirm-recovery", action="store_true")
    args = parser.parse_args()
    if args.restart_missing:
        print(json.dumps(approve_restart(args.folder, args.restart_missing, args.administrator, args.reason, args.confirm_recovery), indent=2))
    elif args.file:
        print(json.dumps(recover(args.folder, args.file, args.administrator, args.reason, args.confirm_recovery), indent=2))
    else:
        parser.error("give a case file to recover, or --restart-missing with a case number")
