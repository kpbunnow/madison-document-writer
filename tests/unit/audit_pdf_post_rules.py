"""PDF filing and email posts against the retained handler: length and body checks, the operation, verified and reused
archives, rendering, outbox fallback, the Outlook draft and the status and message of every failure."""

import io
import json
from pathlib import Path
import random
import tempfile
import unittest
from unittest.mock import patch

import server

ROOT = Path(__file__).resolve().parents[2]
NAMESPACE = server.__dict__.copy()
exec(compile((ROOT / "tests/fixtures/pdf_post_reference.txt").read_text(encoding="utf-8"), "pdf_post_reference", "exec"), NAMESPACE)
LEGACY = NAMESPACE["_pdf"]


class Handler(server.Handler):
    """A request stand-in that keeps the real handler's helper methods."""

    def __init__(self, length, body):
        self.headers = {} if length is None else {"Content-Length": length}
        self.rfile = io.BytesIO(body)
        self.sent = []

    def _json(self, status, payload):
        self.sent.append((status, payload))
        return ("json", status)


def scenario(rng):
    shape = rng.choice(("object", "object", "object", "object", "list", "text", "nolength", "negative", "huge", "html-list", "zero"))
    data = {}
    if rng.random() < 0.8:
        data["filename"] = rng.choice(("Notice ABC.pdf", "x/../y.pdf", "", None))
    data["html"] = rng.choice(("<p>doc</p>", "  ", "", "<b>x</b>"))
    for key, values in (
        ("operation", ({"caseId": "c"}, True)),
        ("sha256", ("abc", "")),
        ("docId", ("doc1", None)),
        ("reuse", (True, False)),
        ("subject", ("Subject", "")),
        ("body", ("Body", "")),
        ("to", ("a@example.test", "")),
    ):
        if rng.random() < 0.3:
            data[key] = rng.choice(values)
    if shape == "html-list":
        data["html"] = ["x"]
    raw = json.dumps(data) if shape in ("object", "html-list", "negative", "huge", "nolength", "zero") else ("[1]" if shape == "list" else "bad json")
    body = raw.encode("utf-8")
    length = (
        "0"
        if shape == "zero"
        else None
        if shape == "nolength"
        else "-5"
        if shape == "negative"
        else str(10**9)
        if shape == "huge"
        else str(len(body))
    )
    return shape, rng.random() < 0.4, length, body, rng


class PdfPost(unittest.TestCase):
    def test_posts_match_the_retained_handler(self):
        rng = random.Random(20261211)
        statuses, paths = set(), set()
        for index in range(3000):
            shape, email, length, body, _ = scenario(rng)
            mode = rng.choice(("ok", "ok", "render-error", "outbox", "outbox-fail", "verified-error", "mail-error", "operation-error"))
            local_share = rng.random() < 0.5
            out_is_local = rng.random() < 0.3
            outcomes, trails = [], []
            for function, target in ((LEGACY, NAMESPACE), (server.Handler._pdf, server.__dict__)):
                trail = []
                with tempfile.TemporaryDirectory() as temporary:
                    root = Path(temporary)
                    (root / "out").mkdir()
                    (root / "local").mkdir()
                    attempts = {"n": 0}

                    def log(name, result=None, error=None):
                        def call(*args, **kwargs):
                            trail.append((name, [str(a).replace(temporary, "ROOT") for a in args], sorted(kwargs)))
                            if error:
                                raise error
                            return result

                        return call

                    def make_pdf(html, rendered):
                        trail.append(("make_pdf", html, Path(rendered).name))
                        if mode == "render-error":
                            raise RuntimeError("render failed")
                        Path(rendered).write_bytes(b"%PDF " + html.encode("utf-8"))

                    def file_pdf_bytes(target_path, raw):
                        attempts["n"] += 1
                        trail.append(("file_pdf_bytes", str(target_path).replace(temporary, "ROOT"), raw))
                        if mode == "outbox" and attempts["n"] == 1 or mode == "outbox-fail":
                            raise OSError("share unavailable")
                        Path(target_path).parent.mkdir(parents=True, exist_ok=True)
                        Path(target_path).write_bytes(raw)
                        return str(target_path)

                    def verified(name, sha, doc):
                        trail.append(("verified_artifact", name, sha, doc))
                        if mode == "verified-error":
                            raise ValueError("artifact does not verify")
                        archived = root / "out" / name
                        archived.write_bytes(b"%PDF archived")
                        return archived, b"%PDF archived"

                    class Store:
                        @staticmethod
                        def file_operation(module, data, name, html):
                            trail.append(("file_operation", sorted(data), name, html))
                            if mode == "operation-error":
                                raise TypeError("bad operation")
                            return {"ok": True, "operation": True}

                    patches = {
                        "out_dir": lambda: root / "local" / server.OUTDIR_NAME if out_is_local else root / "out",
                        "make_pdf": make_pdf,
                        "file_pdf_bytes": file_pdf_bytes,
                        "verified_artifact": verified,
                        "open_in_outlook": log("open_in_outlook", "outlook", RuntimeError("no outlook") if mode == "mail-error" else None),
                        "record": log("record"),
                        "share_root": lambda: root / "out" if local_share else root / "local",
                        "HERE": root / "local",
                        "artifact_store": Store,
                    }
                    with patch.dict(target, patches):
                        handler = Handler(length, body)
                        try:
                            result = ("result", function(handler, email))
                        except Exception as error:
                            result = ("raised", type(error).__name__, str(error))
                    normalised = json.loads(json.dumps(handler.sent).replace(temporary, "ROOT"))
                    outcomes.append((result, normalised, sorted(str(p.relative_to(root)) for p in root.rglob("*") if p.is_file())))
                    trails.append(trail)
            self.assertEqual(outcomes[1], outcomes[0], (index, shape, email, mode))
            self.assertEqual(trails[1], trails[0], (index, shape, email, mode))
            if outcomes[0][1]:
                statuses.add(outcomes[0][1][0][0])
                if outcomes[0][1][0][0] == 200:
                    paths.add((email, "operation" if "operation" in outcomes[0][1][0][1] else "file", mode))
        self.assertTrue({200, 400, 411, 413, 500} <= statuses, statuses)
        self.assertGreaterEqual(len(paths), 6)


if __name__ == "__main__":
    unittest.main()
