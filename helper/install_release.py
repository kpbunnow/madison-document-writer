"""Recoverable local runtime installation. Call only after checking no helper runs."""

import json
import os
from pathlib import Path
import shutil
import tempfile
import uuid


def atomic_json(path, value):
    fd, temporary = tempfile.mkstemp(prefix="._install-", dir=path.parent)
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as stream:
            json.dump(value, stream)
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(temporary, path)
    finally:
        Path(temporary).unlink(missing_ok=True)


def recover(local):
    local = Path(local)
    journal = local / "install-transaction.json"
    if not journal.exists():
        return False
    value = json.loads(journal.read_text())
    identity = value["id"]
    if len(identity) != 32 or any(c not in "0123456789abcdef" for c in identity):
        raise ValueError("Invalid installation recovery identity")
    backup = local / "_install-rollback" / identity
    for item in reversed(value["files"]):
        name = item["name"]
        relative = Path(name)
        if relative.is_absolute() or ".." in relative.parts:
            raise ValueError("Invalid installation recovery path")
        target = local / relative
        if item["existed"]:
            target.parent.mkdir(parents=True, exist_ok=True)
            # Keep the backup intact until the whole rollback completes.
            fd, temporary = tempfile.mkstemp(prefix="._restore-", dir=target.parent)
            os.close(fd)
            try:
                shutil.copyfile(backup / relative, temporary)
                os.replace(temporary, target)
            finally:
                Path(temporary).unlink(missing_ok=True)
        else:
            target.unlink(missing_ok=True)
    journal.unlink()
    shutil.rmtree(backup)
    return True


def install(staging, local, names):
    staging, local = Path(staging), Path(local)
    recover(local)
    files = sorted(set(names) | {p.relative_to(staging).as_posix() for p in (staging / "vendor").rglob("*") if p.is_file()})
    identity = uuid.uuid4().hex
    backup = local / "_install-rollback" / identity
    backup.mkdir(parents=True)
    entries = []
    for name in files:
        target = local / name
        existed = target.is_file()
        if existed:
            (backup / name).parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(target, backup / name)
        entries.append({"name": name, "existed": existed})
    journal = local / "install-transaction.json"
    atomic_json(journal, {"format": "madison-runtime-install", "id": identity, "files": entries})
    try:
        for name in files:
            target = local / name
            target.parent.mkdir(parents=True, exist_ok=True)
            os.replace(staging / name, target)
        journal.unlink()
        shutil.rmtree(backup)
    except Exception:
        recover(local)
        raise
