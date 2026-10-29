"""Durable PDF operations, bound to the frozen issuance and exact print source.

A shared receipt (including original renderer bytes) precedes final PDF filing.
No new original is rendered without shared coordination. Cached receipts permit
same-device retry while disconnected, and cannot create a competing original.
"""

import base64
import hashlib
import json
from pathlib import Path
import re
import tempfile
from case_store import atomic_write, encoded, file_lock
from case_integrity import canonical


def _checked_operation(operation, name):
    if (
        not isinstance(operation, dict)
        or set(operation) != {"caseId", "caseNumber", "docId", "version"}
        or any(not isinstance(v, str) or not v or len(v) > 120 for v in operation.values())
        or not re.fullmatch("[a-f0-9]{64}", operation["version"])
    ):
        raise ValueError("Invalid issued PDF operation")
    tag = re.sub("[^A-Za-z0-9]", "", operation["docId"])[-8:]
    if not tag or not name.endswith(" - " + tag + ".pdf"):
        raise ValueError("Artifact does not belong to this document")


def _read_receipt(path, binding):
    value = json.loads(path.read_bytes())
    if value.get("format") != "madison-pdf-operation" or value.get("binding") != binding:
        raise ValueError("Issued PDF operation has different source or identity; original preserved")
    raw = base64.b64decode(value["pdf"], validate=True)
    if not raw.startswith(b"%PDF-") or hashlib.sha256(raw).hexdigest() != value.get("sha256"):
        raise ValueError("PDF operation receipt changed; administrator review required")
    return value, raw


def _finish(op, value, raw):
    server, name, shared, local = op["server"], op["name"], op["shared"], op["local"]
    # Existing bytes in either approved location must agree before any write.
    for candidate in {shared / name, local / name}:
        try:
            if candidate.is_symlink() or candidate.exists() and candidate.read_bytes() != raw:
                raise ValueError("Archived PDF changed; original was not overwritten")
        except OSError:
            if candidate.parent == local:
                raise
    target = shared / name
    try:
        path = server.file_pdf_bytes(target, raw)
    except OSError:
        target = local / name
        path = server.file_pdf_bytes(target, raw)
    return {
        "ok": True,
        "path": path,
        "name": name,
        "local": target.parent == local and shared != local,
        "sha256": value["sha256"],
        "operationId": op["identity"],
    }


def _new_receipt(op, html, receipt):
    """The first filing of an operation: render once, then record the original bytes before anything is filed."""
    server, name = op["server"], op["name"]
    if (op["shared"] / name).exists() or (op["local"] / name).exists():
        raise ValueError("Same-named PDF has no matching operation receipt; original preserved")
    with tempfile.TemporaryDirectory(prefix="dw-rendered-") as temporary:
        rendered = Path(temporary) / name
        server.make_pdf(html, rendered)
        raw = rendered.read_bytes()
    if not raw.startswith(b"%PDF-"):
        raise ValueError("Renderer did not return a PDF")
    value = {
        "format": "madison-pdf-operation",
        "binding": op["binding"],
        "sha256": hashlib.sha256(raw).hexdigest(),
        "pdf": base64.b64encode(raw).decode("ascii"),
    }
    receipt.parent.mkdir(exist_ok=True)
    atomic_write(receipt, encoded(value))
    return value, raw


def file_operation(server, data, name, html):
    operation = data["operation"]
    _checked_operation(operation, name)
    identity = hashlib.sha256(canonical(operation)).hexdigest()
    source = hashlib.sha256(html.replace("\r\n", "\n").encode()).hexdigest()
    binding = {"operation": operation, "filename": name, "sourceHash": source}
    shared = server.share_root() / server.OUTDIR_NAME
    local = server.HERE / server.OUTDIR_NAME
    cache = server.HERE / "_artifact-operations" / (identity + ".json")
    op = {"server": server, "name": name, "identity": identity, "binding": binding, "shared": shared, "local": local}

    try:
        shared.mkdir(parents=True, exist_ok=True)
        lock = file_lock(shared, "pdf-operation:" + identity)
        with lock:
            receipt = shared / "_operations" / (identity + ".json")
            if receipt.exists():
                value, raw = _read_receipt(receipt, binding)
            elif cache.exists():
                # A cached receipt was only created after a durable shared claim.
                # Losing the shared claim is not permission to rebaseline it.
                raise ValueError("Shared PDF operation receipt is missing; administrator review required")
            else:
                value, raw = _new_receipt(op, html, receipt)
            cache.parent.mkdir(parents=True, exist_ok=True)
            atomic_write(cache, encoded(value))
            return _finish(op, value, raw)
    except OSError:
        if not cache.exists():
            raise OSError(("Shared PDF coordination is unavailable. Keep this document and retry filing when the share returns."))
        value, raw = _read_receipt(cache, binding)
        return _finish(op, value, raw)
