"""Durable PDF operations against the retained module on real folders: operation validation, first filing, replay from
the shared receipt, cached retry when the share is gone, tampered or conflicting files, and the exact files and
messages each leaves behind."""

import base64
import copy
import hashlib
import json
from pathlib import Path
import random
import shutil
import tempfile
import unittest

import artifact_store as current

ROOT = Path(__file__).resolve().parents[2]
REFERENCE = {"__name__": "artifact_store_reference"}
exec(compile((ROOT / "tests/fixtures/artifact_store_reference.txt").read_text(encoding="utf-8"), "artifact_store_reference", "exec"), REFERENCE)

VERSION = "a" * 64
DOC = "doc-12345678"
NAME = "Case - " + "12345678" + ".pdf"


class FakeServer:
    OUTDIR_NAME = "PDF Outbox"

    def __init__(self, root, trace, fail, at_local=False):
        self.root, self.trace, self.fail, self.at_local = root, trace, fail, at_local
        self.HERE = root / "local"
        self.HERE.mkdir(exist_ok=True)

    def share_root(self):
        return self.HERE if self.at_local else self.root / "share"

    def file_pdf_bytes(self, target, raw):
        self.trace.append(("file", str(target).replace(str(self.root), "ROOT")))
        if self.fail == "share" and "share" in target.parts or self.fail == "both":
            raise OSError("unavailable")
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(raw)
        return str(target)

    def make_pdf(self, html, rendered):
        self.trace.append(("make", html))
        if self.fail == "render":
            raise RuntimeError("renderer failed")
        rendered.write_bytes((b"%PDF-" if self.fail != "notpdf" else b"junk") + html.encode("utf-8"))


def request(rng):
    operation = {"caseId": "c1", "caseNumber": "BLD2026-00001", "docId": DOC, "version": VERSION}
    shape = rng.choice(("ok", "ok", "ok", "ok", "extra", "missing", "empty", "long", "badversion", "notdict"))
    if shape == "extra":
        operation["more"] = "x"
    elif shape == "missing":
        del operation["caseNumber"]
    elif shape == "empty":
        operation["caseId"] = ""
    elif shape == "long":
        operation["caseId"] = "x" * 121
    elif shape == "badversion":
        operation["version"] = "xyz"
    elif shape == "notdict":
        operation = ["x"]
    name = rng.choice((NAME, NAME, NAME, "Other - 99999999.pdf", "x.pdf"))
    html = rng.choice(("<p>one</p>", "<p>one</p>", "<p>two</p>\r\n<p>x</p>"))
    return {"operation": operation}, name, html, shape


def wipe(root):
    for child in list(root.iterdir()):
        if child.is_dir() and not child.is_symlink():
            shutil.rmtree(child)
        else:
            child.unlink()


def tree(root):
    return {str(p.relative_to(root)): p.read_bytes() for p in sorted(root.rglob("*")) if p.is_file() and not p.name.endswith(".lock")}


def clear_share(root):
    share = root / "share"
    if share.is_dir():
        shutil.rmtree(share)
    elif share.exists():
        share.unlink()


def disturb(root, kind, note):
    try:
        _disturb(root, kind)
    except OSError:
        pass  # an earlier disturbance left the share unusable; both sides see the same state
    note.append(kind)


def _disturb(root, kind):
    receipts = list((root / "share").rglob("_operations/*.json")) if (root / "share").is_dir() else []
    if kind == "drop-share":
        clear_share(root)
    elif kind == "tamper-receipt" and receipts:
        try:
            value = json.loads(receipts[0].read_bytes())
            value["sha256"] = "0" * 64
            receipts[0].write_bytes(json.dumps(value).encode())
        except ValueError:
            pass
    elif kind == "truncate-receipt" and receipts:
        receipts[0].write_bytes(b"{")
    elif kind == "drop-receipt" and receipts:
        receipts[0].unlink()
    elif kind == "bad-base64" and receipts:
        try:
            value = json.loads(receipts[0].read_bytes())
            value["pdf"] = "!!" + value["pdf"]
            receipts[0].write_bytes(json.dumps(value).encode())
        except ValueError:
            pass
    elif kind == "symlink" and receipts:
        try:
            raw = base64.b64decode(json.loads(receipts[0].read_bytes())["pdf"])
        except (ValueError, KeyError):
            raw = b"%PDF-same"
        (root / "elsewhere.pdf").write_bytes(raw)
        folder = root / "share" / FakeServer.OUTDIR_NAME
        folder.mkdir(parents=True, exist_ok=True)
        if (folder / NAME).exists() or (folder / NAME).is_symlink():
            (folder / NAME).unlink()
        (folder / NAME).symlink_to(root / "elsewhere.pdf")
    elif kind == "share-is-file":
        clear_share(root)
        (root / "share").write_bytes(b"not a folder")
    elif kind in ("dir-shared", "dir-local"):
        folder = root / ("share" if kind == "dir-shared" else "local") / FakeServer.OUTDIR_NAME
        folder.mkdir(parents=True, exist_ok=True)
        if not (folder / NAME).exists():
            (folder / NAME).mkdir()
    elif kind == "conflict-local":
        folder = root / "local" / FakeServer.OUTDIR_NAME
        folder.mkdir(parents=True, exist_ok=True)
        if not (folder / NAME).is_dir():
            (folder / NAME).write_bytes(b"%PDF-local-different")
    elif kind == "conflict-file":
        folder = root / "share" / FakeServer.OUTDIR_NAME
        folder.mkdir(parents=True, exist_ok=True)
        if not (folder / NAME).is_dir():
            (folder / NAME).write_bytes(b"%PDF-different")


KINDS = (
    "none",
    "none",
    "drop-share",
    "tamper-receipt",
    "conflict-file",
    "drop-receipt",
    "truncate-receipt",
    "bad-base64",
    "symlink",
    "symlink",
    "conflict-local",
    "dir-shared",
    "dir-local",
    "dir-local",
    "dir-local",
    "share-is-file",
    "share-is-file",
)


class ArtifactOperation(unittest.TestCase):
    def test_operations_match_the_retained_module(self):
        rng = random.Random(20261212)
        outcomes_seen = set()
        for index in range(1200):
            first = request(rng)
            steps = [
                (
                    first if rng.random() < 0.7 else request(rng),
                    rng.choice(("none", "none", "none", "share", "both", "render", "notpdf")),
                    rng.choice(KINDS),
                    rng.random() < 0.2,
                )
                for _ in range(rng.choice((2, 2, 3, 4)))
            ]
            results = []
            # Both sides run in the same folder path: candidate locations are checked through a set, whose order
            # follows the path text, so different folders could order a double conflict differently.
            with tempfile.TemporaryDirectory() as temporary:
                root = Path(temporary)
                for module in (REFERENCE, vars(current)):
                    function = module["file_operation"]
                    wipe(root)
                    (root / "share").mkdir()
                    trace, notes, rows = [], [], []
                    for (data, name, html, shape), fail, kind, at_local in steps:
                        server = FakeServer(root, trace, fail, at_local)
                        try:
                            rows.append(("result", function(server, copy.deepcopy(data), name, html)))
                        except Exception as error:
                            rows.append(("error", type(error).__name__, str(error)))
                        disturb(root, kind, notes)
                    scrub = lambda value: json.loads(json.dumps(value, default=str).replace(temporary, "ROOT"))
                    results.append((scrub(rows), trace, notes, tree(root)))
            self.assertEqual(results[1], results[0], index)
            for row in results[0][0]:
                outcomes_seen.add(row[0] if row[0] == "result" else row[1] + ":" + row[2][:28])
        self.assertIn("result", outcomes_seen)
        for family in (
            "Archived PDF changed",
            "Same-named PDF",
            "Shared PDF operation receipt",
            "PDF operation receipt chang",
            "Issued PDF operation has dif",
            "Renderer did not return",
            "Invalid issued PDF operation",
            "Artifact does not belong",
        ):
            self.assertTrue(any(family in seen for seen in outcomes_seen), family)


if __name__ == "__main__":
    unittest.main()
