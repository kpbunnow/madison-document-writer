"""The actual downgrade attack is refused on read and every ordinary save."""

import copy, json, tempfile, unittest
from pathlib import Path
from unittest.mock import patch
import case_store, case_integrity as integrity
from audit_r28_helper import pair


class Downgrade(unittest.TestCase):
    def test_attack_without_and_with_anchor(self):
        for anchored in (False, True):
            for mutation in ("all", "schema", "integrity", "missing-schema"):
                with (
                    self.subTest(anchor=anchored, mutation=mutation),
                    tempfile.TemporaryDirectory() as folder,
                    tempfile.TemporaryDirectory() as external,
                ):
                    root = Path(folder)
                    v = pair()
                    v["schema"] = 5
                    name = "101 TEST - " + v["case"]["number"] + ".json"
                    result = case_store.save_case(root, name, v)
                    saved = result["file"]
                    if anchored:
                        integrity.anchor_daily(root, Path(external))
                    bad = copy.deepcopy(saved)
                    if mutation in ("all", "schema"):
                        bad["schema"] = 4
                    if mutation in ("all", "integrity"):
                        bad.pop("integrity")
                    if mutation == "missing-schema":
                        bad.pop("schema")
                    if mutation == "all":
                        bad["events"][0]["payload"]["snapshot"]["items"][0]["text"] = "altered"
                    (root / name).write_text(json.dumps(bad))
                    with patch.object(integrity, "protected_folder", return_value=Path(external) if anchored else None):
                        s = case_store.read_case(root, name)["integrity"]
                        self.assertFalse(s["valid"])
                        self.assertIn("removed", s["label"])
                        with self.assertRaises(ValueError):
                            case_store.save_case(root, name, bad)

    def test_registry_anchor_removal_and_administration(self):
        import integrity_admin

        for anchored in (False, True):
            with tempfile.TemporaryDirectory() as folder, tempfile.TemporaryDirectory() as external:
                root = Path(folder)
                v = pair()
                v["schema"] = 5
                name = "101 TEST - " + v["case"]["number"] + ".json"
                with patch.object(integrity, "protected_folder", return_value=Path(external) if anchored else None):
                    case_store.save_case(root, name, v)
                    raw = (root / name).read_bytes()
                    bad = json.loads(raw)
                    bad["events"][0]["payload"]["snapshot"]["items"][0]["text"] = "altered"
                    (root / name).write_text(json.dumps(bad))
                    with self.assertRaises(ValueError):
                        integrity_admin.recover(root, name, "Admin", "Verified prior bytes after independent review.", False)
                    recovered = integrity_admin.recover(root, name, "Synthetic administrator", "Verified prior bytes after independent review.", True)
                    self.assertTrue(recovered["integrity"]["valid"])
                    self.assertTrue(Path(recovered["quarantineFile"]).exists())
                    self.assertTrue(case_store.read_case(root, name)["integrity"]["valid"])
                    if anchored:
                        registry = root / "_integrity/migrated.json"
                        stored = json.loads(registry.read_text())
                        stored["entries"].pop(0)
                        registry.write_text(json.dumps(stored))
                        self.assertFalse(case_store.read_case(root, name)["integrity"]["valid"])

    def test_recomputed_genesis_against_registry(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            v = pair()
            v["schema"] = 5
            name = "101 TEST - " + v["case"]["number"] + ".json"
            case_store.save_case(root, name, v)
            altered = copy.deepcopy(v)
            altered["case"]["owner"] = "Replaced owner"
            rewritten = integrity.commit_record(None, altered)
            self.assertFalse(integrity.verify_record(rewritten, root)["valid"])

    def test_legacy_and_reconstructed_upgrade(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            v = pair()
            v["schema"] = 4
            name = "101 TEST - " + v["case"]["number"] + ".json"
            case_store.save_case(root, name, v)
            v["schema"] = 5
            saved = case_store.save_case(root, name, v)
            self.assertTrue(integrity.verify_record(saved["file"], root)["valid"])
            (root / "_integrity/migrated.json").unlink()
            integrity.reconstruct_registry(root)
            self.assertTrue(integrity.registry(root)["entries"][0]["reconstructed"])
            self.assertEqual(len(integrity.registry(root)["entries"]), 1)


if __name__ == "__main__":
    unittest.main()
