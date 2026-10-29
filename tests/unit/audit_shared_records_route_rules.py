"""Shared-record POST routing against the retained handler: request-size and body checks, every route's call and
arguments, the probe file, and the status and message of each failure, with a stand-in request object."""

import io
import json
from pathlib import Path
import random
import tempfile
import unittest
from unittest.mock import patch

import server
from retained_wording import with_current_wording

ROOT = Path(__file__).resolve().parents[2]
NAMESPACE = server.__dict__.copy()
exec(
    compile((ROOT / "tests/fixtures/post_shared_records_reference.txt").read_text(encoding="utf-8"), "post_shared_records_reference", "exec"),
    NAMESPACE,
)
LEGACY = NAMESPACE["_post_shared_records"]
ROUTES = [
    "/cases/save",
    "/cases/summary",
    "/cases/probe",
    "/draft-backups/write",
    "/draft-backups/read",
    "/catalog/review",
    "/artifact/status",
    "/outbox/sync",
    "/other",
]


class Handler:
    def __init__(self, length, body):
        self.headers = {} if length is None else {"Content-Length": length}
        self.rfile = io.BytesIO(body)
        self.sent = []

    def _json(self, status, payload):
        self.sent.append((status, payload))
        return ("json", status)


def scenario(rng):
    shape = rng.choice(
        ("object", "object", "object", "list", "text", "empty", "huge", "bad-length", "nolength", "error-value", "error-type", "error-other")
    )
    data = {
        "name": rng.choice(("a.json", None)),
        "file": {"k": 1},
        "baseRevision": rng.choice(("r1", None)),
        "baseCase": rng.choice(({"c": 1}, None)),
        "idempotencyEvent": rng.choice(("e1", None)),
        "revision": "r2",
        "summary": {"s": 1},
        "items": [1, 2],
    }
    for key in rng.sample(list(data), rng.choice((0, 0, 2))):
        data.pop(key)
    body = {"object": json.dumps(data), "list": "[1]", "text": "not json", "empty": "", "huge": "{}"}.get(shape, json.dumps(data)).encode("utf-8")
    length = None if shape == "nolength" else "x" if shape == "bad-length" else str(len(body)) if shape != "huge" else str(10**9)
    return shape, rng.choice(ROUTES), length, body


class SharedRecordsRoute(unittest.TestCase):
    def test_routes_match_the_retained_handler(self):
        rng = random.Random(20261210)
        reached, statuses = set(), set()
        for index in range(3000):
            shape, route, length, body = scenario(rng)
            outcomes, trails = [], []
            for function, target in (
                (LEGACY, NAMESPACE),
                (server.Handler._post_shared_records if hasattr(server, "Handler") else None, server.__dict__),
            ):
                if function is None:
                    function = getattr(server, self.handler_name())._post_shared_records
                trail = []

                def recorder(name):
                    def call(*args, **kwargs):
                        trail.append((name, args, kwargs))
                        if shape == "error-value":
                            raise ValueError("bad " + name)
                        if shape == "error-type":
                            raise TypeError("typed " + name)
                        if shape == "error-other":
                            raise RuntimeError("down " + name)
                        return {"ok": True, "via": name}

                    return call

                names = ("save_case", "save_summary", "backup_write", "backup_read", "catalog_review", "artifact_status", "sync_outbox")
                with tempfile.TemporaryDirectory() as temporary:
                    folder = Path(temporary)
                    patches = {name: recorder(name) for name in names}
                    patches.update(case_dir=lambda: folder, catalog_path=lambda: "CATALOG", resource=lambda name: "RES:" + name)
                    with patch.dict(target, patches), patch.object(server, "case_dir", lambda: folder):
                        handler = Handler(length, body)
                        try:
                            result = ("result", function(handler, route))
                        except Exception as error:
                            result = ("raised", type(error).__name__, str(error))
                        probe_left = sorted(p.name for p in folder.iterdir())
                outcomes.append((result, handler.sent, probe_left))
                trails.append([(n, [str(a).replace(str(folder), "ROOT") for a in args], kw) for n, args, kw in trail])
            self.assertEqual(outcomes[1], with_current_wording(outcomes[0]), (index, shape, route))
            self.assertEqual(trails[1], trails[0], (index, shape, route))
            reached.add(route if outcomes[0][1] and outcomes[0][1][0][0] == 200 else None)
            statuses.add(outcomes[0][1][0][0] if outcomes[0][1] else None)
        self.assertTrue({200, 400, 413, 503} <= statuses, statuses)
        self.assertGreaterEqual(len(reached - {None}), 8)

    def handler_name(self):
        for name, value in vars(server).items():
            if isinstance(value, type) and "_post_shared_records" in vars(value):
                return name
        raise AssertionError("handler class not found")


if __name__ == "__main__":
    unittest.main()
