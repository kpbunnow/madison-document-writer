"""Damaged shared catalog histories fail clearly before browser refresh or a new review can consume them."""

import copy
import http.client
import json
from pathlib import Path
import tempfile
import threading
import unittest
from unittest.mock import patch

import server

REVIEW = dict(
    id="review1",
    key='["SYNTHETIC","GROUP",1]',
    status="approved",
    version=1,
    at="2026-11-27T12:00:00Z",
    reviewer="Synthetic reviewer",
    source="Synthetic source",
    wording="Reviewed action",
    ordinances=["27.01"],
    replaces="",
)


class CatalogHistoryDamage(unittest.TestCase):
    def test_bad_entries_refuse_the_http_read_and_preserve_original_bytes(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            path = root / "Catalog Review" / "reviews.json"
            path.parent.mkdir()
            listener = server.Server(("127.0.0.1", 0), server.Handler)
            thread = threading.Thread(target=listener.serve_forever, daemon=True)
            thread.start()
            try:
                with patch.object(server, "share_root", return_value=root), patch.object(server, "PORT", listener.server_address[1]):
                    for bad in (
                        None,
                        "text",
                        [],
                        dict(REVIEW, ordinances=None),
                        dict(REVIEW, version=True),
                        dict(REVIEW, at=42),
                        dict(REVIEW, reviewer=""),
                        dict(REVIEW, wording=""),
                        dict(REVIEW, ordinances=[]),
                    ):
                        raw = json.dumps(dict(format="madison-catalog-review", version=1, events=[REVIEW, bad])).encode()
                        path.write_bytes(raw)
                        connection = http.client.HTTPConnection("127.0.0.1", server.PORT, timeout=10)
                        try:
                            connection.request("GET", "/catalog/reviews", headers={"X-DocWriter-Token": server.SESSION_TOKEN})
                            response = connection.getresponse()
                            answer = json.loads(response.read())
                            self.assertEqual(response.status, 503, (bad, answer))
                            self.assertFalse(answer["ok"])
                            self.assertIn("unreadable", answer["error"])
                            self.assertEqual(path.read_bytes(), raw)
                        finally:
                            connection.close()
            finally:
                listener.shutdown()
                listener.server_close()
                thread.join(timeout=2)

    def test_deep_or_nonfinite_history_is_unusable_without_repair(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            path = root / "reviews.json"
            for raw in (
                b"[" * 200000 + b"0" + b"]" * 200000,
                json.dumps(dict(format="madison-catalog-review", events=[dict(REVIEW, extra=float("nan"))])).encode(),
            ):
                path.write_bytes(raw)
                with patch.object(server, "share_root", return_value=root), patch.object(server, "catalog_path", return_value=path):
                    with self.assertRaisesRegex(ValueError, "unreadable"):
                        server.catalog_events()
                self.assertEqual(path.read_bytes(), raw)

    def test_new_review_cannot_append_to_a_damaged_retained_history(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            path = root / "reviews.json"
            manifest = root / "catalog_manifest.json"
            manifest.write_text(json.dumps({"format": "madison-catalog-manifest", "items": {REVIEW["key"]: {}}}))
            raw = json.dumps(dict(format="madison-catalog-review", events=[REVIEW, None])).encode()
            path.write_bytes(raw)
            data = {k: REVIEW[k] for k in ("key", "status", "reviewer", "wording", "ordinances", "source", "replaces")}
            with (
                patch.object(server, "share_root", return_value=root),
                patch.object(server, "catalog_path", return_value=path),
                patch.object(server, "resource", return_value=manifest),
            ):
                with self.assertRaisesRegex(ValueError, "unreadable"):
                    server.catalog_review(data)
            self.assertEqual(path.read_bytes(), raw)

    def test_valid_approval_and_retirement_history_is_retained_exactly(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            path = root / "reviews.json"
            events = [copy.deepcopy(REVIEW), dict(REVIEW, id="review2", version=2, status="retired", wording="", ordinances=[])]
            raw = json.dumps(dict(format="madison-catalog-review", version=1, events=events)).encode()
            path.write_bytes(raw)
            with patch.object(server, "share_root", return_value=root), patch.object(server, "catalog_path", return_value=path):
                self.assertEqual(server.catalog_events(), events)
            self.assertEqual(path.read_bytes(), raw)


if __name__ == "__main__":
    unittest.main()
