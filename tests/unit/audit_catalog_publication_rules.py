"""Catalog phase extraction preserves file access, approval freshness and first refusals."""

import copy
import json
from pathlib import Path
import random
import tempfile
import unittest
from unittest.mock import patch

import case_store

ROOT = Path(__file__).resolve().parents[2]
NAMESPACE = case_store.__dict__.copy()
exec(
    compile((ROOT / "tests/fixtures/catalog_publication_reference.txt").read_text(encoding="utf-8"), "catalog_publication_reference", "exec"),
    NAMESPACE,
)
LEGACY = NAMESPACE["validate_catalog_publication"]


def outcome(check, args):
    try:
        return ("result", check(*args))
    except Exception as error:
        return ("error", type(error).__name__, str(error))


class CatalogPublicationRules(unittest.TestCase):
    def test_file_order_and_generated_selection_refusals(self):
        rng = random.Random(20261028)
        calls, outcomes = [], set()

        class TracedPath:
            def __init__(self, value):
                calls.append(("path", str(value)))
                self.path = Path(value)

            def exists(self):
                calls.append(("exists", str(self.path)))
                return self.path.exists()

            def read_text(self, **kwargs):
                calls.append(("read", str(self.path), kwargs))
                return self.path.read_text(**kwargs)

        NAMESPACE["Path"] = TracedPath
        with tempfile.TemporaryDirectory() as folder, patch.object(case_store, "Path", TracedPath):
            catalog, manifest = Path(folder) / "reviews.json", Path(folder) / "manifest.json"
            review = dict(key="entry", status="approved", id="approval", version="v1")
            item = dict(libraryKey="entry", catalogReviewId="approval", catalogVersion="v1")
            manifest_options = (
                {"format": "madison-catalog-manifest", "items": {"entry": {"ordinances": ["27.05"], "draft": False}}},
                {"format": "madison-catalog-manifest", "items": {"entry": {"draft": True}}},
                {"format": "madison-catalog-manifest", "items": {}},
                {"format": "bad", "items": {}},
                {"format": "madison-catalog-manifest", "items": []},
                "{broken",
            )
            review_options = (
                {"format": "madison-catalog-review", "events": [review]},
                {"format": "madison-catalog-review", "events": [review, dict(review, status="retired")]},
                {"format": "madison-catalog-review", "events": [dict(review, replaces="entry", key="replacement")]},
                {"format": "madison-catalog-review", "events": []},
                {"format": "madison-catalog-review", "events": [None]},
                {"format": "bad", "events": []},
                {"format": "madison-catalog-review", "events": {}},
                "{broken",
            )
            for index in range(3000):
                manifest_value = manifest_options[0] if index % 3 == 0 else rng.choice(manifest_options)
                reviews = review_options[0] if index % 3 == 0 else rng.choice(review_options)
                manifest_text = manifest_value if isinstance(manifest_value, str) else json.dumps(manifest_value)
                catalog_text = reviews if isinstance(reviews, str) else json.dumps(reviews)
                manifest.write_text(manifest_text, encoding="utf-8")
                catalog.write_text(catalog_text, encoding="utf-8")
                incoming = {"events": [{"id": "notice", "type": "notice.issued", "payload": {"snapshot": {"items": [copy.deepcopy(item)]}}}]}
                selected = incoming["events"][0]["payload"]["snapshot"]["items"][0]
                if index % 3:
                    for _ in range(rng.randrange(1, 4)):
                        selected[rng.choice(("libraryKey", "catalogReviewId", "catalogVersion"))] = rng.choice(
                            (None, "", "missing", "approval", "v1", False)
                        )
                if index % 7 == 0:
                    incoming["events"][0]["type"] = "notice.corrected"
                if index % 11 == 0:
                    catalog.unlink()
                if index % 13 == 0:
                    manifest.unlink()
                current = copy.deepcopy(incoming) if index % 5 == 0 else None
                before, after = copy.deepcopy((current, incoming)), copy.deepcopy((current, incoming))
                calls.clear()
                expected = outcome(LEGACY, (*before, catalog, manifest))
                trace = calls[:]
                calls.clear()
                with self.subTest(index=index):
                    self.assertEqual(outcome(case_store.validate_catalog_publication, (*after, catalog, manifest)), expected)
                    self.assertEqual(calls, trace)
                    self.assertEqual(after, before)
                    if current or incoming["events"][0]["type"] != "notice.issued":
                        self.assertEqual(calls, [], "inherited history and corrections do not read catalog files")
                    if catalog.exists():
                        self.assertEqual(catalog.read_text(encoding="utf-8"), catalog_text)
                    if manifest.exists():
                        self.assertEqual(manifest.read_text(encoding="utf-8"), manifest_text)
                outcomes.add(expected)
        self.assertIn(("result", None), outcomes)
        self.assertGreaterEqual(len(outcomes), 8, "corpus must include validation, JSON and missing-file refusals")

    def test_bundled_language_approved_by_the_owner_can_be_issued_and_the_rest_cannot(self):
        """Owner decision 2026-10-31: every bundled draft entry that has a section is selectable, and the seven that
        have none stay refused. Checked against the real bundled manifest and library, not a fixture."""
        manifest_file = ROOT / "app/assets/catalog_manifest.json"
        library = json.loads((ROOT / "app/assets/library.js").read_text(encoding="utf-8").split("=", 1)[1].rsplit(";", 1)[0])
        manifest = json.loads(manifest_file.read_text(encoding="utf-8"))["items"]
        refused, accepted = [], 0
        with tempfile.TemporaryDirectory() as folder:
            reviews = Path(folder) / "reviews.json"
            for category in library:
                for group in category["groups"]:
                    for entry in group["items"]:
                        key = json.dumps([category["code"], group["code"], entry["o"]], separators=(",", ":"))
                        notice = {"id": "n", "type": "notice.issued", "payload": {"snapshot": {"items": [{"libraryKey": key}]}}}
                        try:
                            case_store.validate_catalog_publication(None, {"events": [notice]}, reviews, manifest_file)
                            accepted += 1
                        except ValueError as error:
                            self.assertIn("division review", str(error))
                            refused.append(key)
        self.assertEqual(accepted + len(refused), 250)
        self.assertEqual(len(refused), 7)
        self.assertTrue(all(manifest[key]["draft"] or not manifest[key]["ordinances"] for key in refused))
        self.assertEqual(sum(1 for v in manifest.values() if v["draft"]), 7)
        self.assertIn('["ENF_HSE","SMOKEDETECT",10]', manifest)
        self.assertNotIn('["ENF_HSE","SMOKEDETECT",10]', refused)
        self.assertIn('["ENF_HSE","SMOKEDETECT",20]', refused)


if __name__ == "__main__":
    unittest.main()
