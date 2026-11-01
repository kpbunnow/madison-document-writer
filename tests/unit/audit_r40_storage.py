"""R40 durable failure boundaries, retained anchors, global lock recovery and revisions."""

import copy
import hashlib
import json
import os
from pathlib import Path
import socket
import subprocess
import sys
import tempfile
import time
import unittest
from unittest.mock import patch
import case_integrity as integrity
import case_store as store
import operations_helper as operations
import server
from audit_helper import record
from audit_r28_helper import pair
from report_summaries import report_summary


class DurableStorage(unittest.TestCase):
    def test_migration_failure_boundaries_survive_fresh_process(self):
        for legacy in (False, True):
            for boundary in ("intent", "case-before", "case-after", "registry-before", "registry-after", "completion"):
                with self.subTest(legacy=legacy, boundary=boundary), tempfile.TemporaryDirectory() as folder:
                    root = Path(folder)
                    value = record()
                    value["schema"] = 4 if legacy else 5
                    name = "101 TEST - QA-001.json"
                    target = root / name
                    if legacy:
                        store.save_case(root, name, value)
                        value["schema"] = 5
                    real = store.atomic_write
                    unlink = Path.unlink
                    fired = False

                    def fail(path, raw):
                        nonlocal fired
                        path = Path(path)
                        match = (
                            boundary == "intent"
                            and path.parent.name == "transactions"
                            or boundary.startswith("case-")
                            and path == target
                            or boundary.startswith("registry-")
                            and path.name == "migrated.json"
                        )
                        if match and not fired:
                            fired = True
                            if boundary.endswith("after"):
                                real(path, raw)
                            raise OSError("synthetic interrupted " + boundary)
                        return real(path, raw)

                    def fail_completion(path, *args, **kwargs):
                        nonlocal fired
                        if boundary == "completion" and path.parent.name == "transactions" and not fired:
                            fired = True
                            raise OSError("synthetic completion failure")
                        return unlink(path, *args, **kwargs)

                    with patch.object(store, "atomic_write", side_effect=fail), patch.object(Path, "unlink", fail_completion):
                        with self.assertRaises(OSError):
                            store.save_case(root, name, value)
                    self.assertTrue(fired)
                    if target.exists():
                        self.assertTrue(store.read_case(root, name)["integrity"]["valid"])
                    intents = list((root / "_integrity/transactions").glob("*.json"))
                    planned = json.loads(intents[0].read_bytes())["record"]["integrity"]["genesis"]["hash"] if intents else None
                    (root / "incoming.txt").write_text(json.dumps(value))
                    program = (
                        "import json,sys;from pathlib import Path;import case_store as s;r=Pa"
                        "th(sys.argv[1]);v=json.loads((r/'incoming.txt').read_text());x=s.sav"
                        "e_case(r,sys.argv[2],v);assert s.read_case(r,sys.argv[2])['integrity"
                        "']['valid'];print(x['file']['integrity']['genesis']['hash'])"
                    )
                    result = subprocess.run([sys.executable, "-c", program, str(root), name], capture_output=True, text=True, timeout=20)
                    self.assertEqual(result.returncode, 0, result.stderr)
                    if planned:
                        self.assertEqual(result.stdout.strip(), planned)
                    self.assertEqual(len(integrity.registry(root)["entries"]), 1)
                    self.assertEqual(list((root / "_integrity/transactions").glob("*.json")), [])

    def test_inverse_order_and_administrative_resume(self):
        import integrity_admin

        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            name = "101 TEST - QA-001.json"
            value = record()
            value["schema"] = 4
            store.save_case(root, name, value)
            value["schema"] = 5
            real = store.atomic_write

            def before_case(path, raw):
                if Path(path) == root / name:
                    raise OSError("synthetic case replace failure")
                return real(path, raw)

            with patch.object(store, "atomic_write", side_effect=before_case):
                with self.assertRaises(OSError):
                    store.save_case(root, name, value)
            intent = json.loads(next((root / "_integrity/transactions").glob("*.json")).read_bytes())
            integrity.register_migration(root, intent["record"], name)
            self.assertTrue(store.read_case(root, name)["integrity"]["valid"], "registry-first interruption is a pending migration, not a downgrade")
            saved = store.save_case(root, name, value)
            self.assertTrue(store.read_case(root, name)["integrity"]["valid"])
            bad = copy.deepcopy(saved["file"])
            bad["case"]["owner"] = "External change"
            (root / name).write_bytes(store.encoded(bad))

            def before_registry(path, raw):
                if Path(path).name == "migrated.json":
                    raise OSError("synthetic recovery registry failure")
                return real(path, raw)

            with patch.object(store, "atomic_write", side_effect=before_registry):
                with self.assertRaises(OSError):
                    integrity_admin.recover(
                        root, name, "Synthetic administrator", "Reviewed original evidence and verified this explicit recovery.", True
                    )
            with self.assertRaisesRegex(ValueError, "administrator must resume"):
                store.save_case(root, name, value)
            recovered = integrity_admin.recover(
                root, name, "Synthetic administrator", "Resume the same explicit reviewed recovery after interruption.", True
            )
            self.assertTrue(recovered["resumed"])
            self.assertTrue(Path(recovered["quarantineFile"]).is_file())
            self.assertTrue(store.read_case(root, name)["integrity"]["valid"])
            self.assertEqual(len(integrity.registry(root)["entries"]), 2)

    def test_anchoring_cannot_launder_recomputed_commit(self):
        with tempfile.TemporaryDirectory() as folder, tempfile.TemporaryDirectory() as ext:
            root = Path(folder)
            external = Path(ext)
            value = record()
            value["schema"] = 5
            with patch.object(integrity, "protected_folder", return_value=external):
                saved = store.save_case(root, "101 TEST - QA-001.json", value)["file"]
                status = json.loads((root / "_integrity/anchor-status.json").read_bytes())
                self.assertNotIn("entries", status, "non-digest metadata must remain readable by older integrity scanners")
                before = {p.name: p.read_bytes() for p in external.glob("*.sha256")}
                altered = copy.deepcopy(saved)
                altered["case"]["owner"] = "Recomputed external rewrite"
                altered["integrity"]["commits"] = []
                altered = integrity.commit_record(altered, altered)
                (root / "101 TEST - QA-001.json").write_bytes(store.encoded(altered))
                self.assertFalse(integrity.verify_record(altered, root)["valid"])
                for _ in range(3):
                    with self.assertRaisesRegex(ValueError, "anchored head"):
                        integrity.anchor_daily(root, external)
                self.assertEqual(before, {p.name: p.read_bytes() for p in external.glob("*.sha256")})
                self.assertFalse(store.read_case(root, "101 TEST - QA-001.json")["integrity"]["valid"])

    def test_failed_receipt_preserves_prior_trusted_snapshot(self):
        with tempfile.TemporaryDirectory() as folder, tempfile.TemporaryDirectory() as ext:
            root = Path(folder)
            external = Path(ext)
            value = record()
            value["schema"] = 5
            name = "101 TEST - QA-001.json"
            saved = store.save_case(root, name, value)
            integrity.anchor_daily(root, external)
            before = {p.name: p.read_bytes() for p in external.glob("*.sha256")}
            newer = copy.deepcopy(saved["file"])
            newer["case"]["owner"] = "Valid append"
            updated = store.save_case(root, name, newer, saved["revision"], saved["file"]["case"])["file"]
            with patch.object(store, "create_only_write", side_effect=OSError("receipt unavailable")):
                with self.assertRaises(OSError):
                    integrity.anchor_daily(root, external)
            self.assertEqual(before, {p.name: p.read_bytes() for p in external.glob("*.sha256")})
            self.assertTrue(integrity.verify_record(updated, root, external)["valid"])
            integrity.anchor_daily(root, external)
            self.assertTrue(integrity.verify_record(updated, root, external)["anchored"])

    def test_anchor_folder_that_allows_only_creating_files(self):
        """A protected anchor folder may let the account add files but not rename, replace or delete them (acceptance
        item C6). The receipt must be created in place with no temporary file, and a receipt left incomplete is
        reported in plain words rather than as a parser error."""
        with tempfile.TemporaryDirectory() as folder, tempfile.TemporaryDirectory() as ext:
            root, external = Path(folder), Path(ext)
            value = record()
            value["schema"] = 5
            saved = store.save_case(root, "101 TEST - QA-001.json", value)

            def inside(*paths):
                return any(external in Path(str(p)).parents for p in paths)

            def refuse(real):
                def guarded(*args, **kwargs):
                    if inside(*[a for a in args if isinstance(a, (str, os.PathLike))]):
                        raise PermissionError(1, "Operation not permitted")
                    return real(*args, **kwargs)

                return guarded

            real_unlink = Path.unlink

            def unlink(self, *args, **kwargs):
                if inside(self):
                    raise PermissionError(1, "Operation not permitted")
                return real_unlink(self, *args, **kwargs)

            with (
                patch.object(os, "replace", refuse(os.replace)),
                patch.object(os, "rename", refuse(os.rename)),
                patch.object(os, "link", refuse(os.link)),
                patch.object(Path, "unlink", unlink),
            ):
                self.assertTrue(integrity.anchor_daily(root, external)["anchored"])
            names = [p.name for p in external.iterdir()]
            self.assertEqual(len(names), 1)
            self.assertTrue(names[0].endswith(".sha256"), "no temporary file is left in the anchor folder")
            self.assertTrue(integrity.verify_record(saved["file"], root, external)["anchored"])
            with self.assertRaises(FileExistsError):
                store.create_only_write(external / names[0], b"{}")
            (external / "2999-01-01-000000000000-x.sha256").write_bytes(b'{"digestFile"')
            with self.assertRaisesRegex(ValueError, "incomplete or damaged; IT must remove it"):
                integrity.VerificationContext(root, external)

    def test_automatic_anchoring_runs_once_per_city_day(self):
        """Saves and the helper clock anchor at most once a City day; an explicit or administrator anchor still runs."""
        with tempfile.TemporaryDirectory() as folder, tempfile.TemporaryDirectory() as ext:
            root, external = Path(folder), Path(ext)
            value = record()
            value["schema"] = 5
            name = "101 TEST - QA-001.json"
            with patch.object(integrity, "protected_folder", return_value=external):
                saved = store.save_case(root, name, value)
                self.assertEqual(len(list(external.glob("*.sha256"))), 1, "the first save of the day anchors")
                newer = copy.deepcopy(saved["file"])
                newer["case"]["owner"] = "Second save the same day"
                updated = store.save_case(root, name, newer, saved["revision"], saved["file"]["case"])
                self.assertEqual(len(list(external.glob("*.sha256"))), 1, "later saves that day do not anchor again")
                self.assertTrue(integrity.anchor_after_save(root)["skipped"])
                self.assertTrue(store.read_case(root, name)["integrity"]["valid"])
                # The next City day anchors again, including the change made after the first anchor.
                with patch.object(
                    store, "city_day", side_effect=lambda at=None: store.datetime.date(2999, 1, 1) if at is None else store.datetime.date(2000, 1, 1)
                ):
                    self.assertTrue(integrity.anchor_after_save(root)["anchored"])
                self.assertEqual(len(list(external.glob("*.sha256"))), 2)
                status = integrity.verify_record(updated["file"], root, external)
                self.assertTrue(status["anchored"])
                self.assertEqual(integrity.VerificationContext(root, external).anchors["qa-001"]["commitHash"], status["commitHash"])
                # Administrator recovery forces an anchor whatever the day.
                self.assertNotIn("skipped", integrity.anchor_after_save(root, force=True))

    def test_complete_digest_carries_anchors_so_only_the_newest_receipt_is_read(self):
        with tempfile.TemporaryDirectory() as folder, tempfile.TemporaryDirectory() as ext:
            root, external = Path(folder), Path(ext)
            first, second = record(), copy.deepcopy(record())
            first["schema"] = second["schema"] = 5
            second["case"].update(number="QA-002", id="case_b")
            for event in second["events"]:
                event["id"] = event["id"] + "_b"
                for part in (event["payload"], event["payload"].get("snapshot", {})):
                    if part.get("caseId") == first["case"]["id"]:
                        part["caseId"] = "case_b"
            a = store.save_case(root, "101 TEST - QA-001.json", first)["file"]
            store.save_case(root, "102 TEST - QA-002.json", second)
            integrity.anchor_daily(root, external)
            # QA-001 leaves the folder; the next digest still anchors it.
            moved = (root / "101 TEST - QA-001.json").read_bytes()
            (root / "101 TEST - QA-001.json").unlink()
            integrity.anchor_daily(root, external)
            newest = max(external.glob("*.sha256"))
            digest = json.loads((root / "_integrity" / json.loads(newest.read_text())["digestFile"]).read_bytes())
            self.assertTrue(digest["complete"])
            self.assertIn("qa-001", digest["entries"][0]["heads"])
            self.assertTrue({"qa-001", "qa-002"} <= set(digest["known"]))
            # Only the newest receipt is needed: the older receipt and its digest are no longer read.
            for older in sorted(external.glob("*.sha256"))[:-1]:
                stale = root / "_integrity" / json.loads(older.read_text())["digestFile"]
                if stale.name != json.loads(newest.read_text())["digestFile"]:
                    stale.write_text("{}")
            context = integrity.VerificationContext(root, external)
            self.assertEqual(context.anchors["qa-001"]["commitHash"], integrity.verify_record(a)["commitHash"])
            # A rewritten QA-001 brought back later is still caught by the carried anchor.
            (root / "101 TEST - QA-001.json").write_bytes(moved)
            rewritten = copy.deepcopy(first)
            rewritten["case"]["owner"] = "Whole file rewrite"
            rewritten = integrity.commit_record(None, rewritten)
            self.assertFalse(integrity.verify_record(rewritten, root, external)["valid"])
            self.assertTrue(integrity.verify_record(a, root, external)["valid"])
            # Tampering with the newest digest is still refused.
            (root / "_integrity" / json.loads(newest.read_text())["digestFile"]).write_text("{}")
            self.assertFalse(integrity.verify_record(a, root, external)["valid"])

    def test_global_recovery_and_metadata_failure(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            (root / ".locks").mkdir()
            for key in operations.GLOBAL_LOCKS:
                path = operations.lock_path(root, resource=key)
                path.write_text(json.dumps({"pid": 99999999, "host": socket.gethostname(), "at": time.time() - 60, "owner": "orphan"}))
                status = operations.lock_status(root, "QA-001")
                self.assertEqual(status["resource"], key)
                data = {
                    "number": "QA-001",
                    "resource": key,
                    "token": status["token"],
                    "administrator": "Synthetic Admin",
                    "reason": "Verified owning helper has stopped on the owning host.",
                    "confirmed": True,
                }
                with self.assertRaisesRegex(ValueError, "changed"):
                    operations.release_lock(root, {**data, "token": "changed"})
                self.assertTrue(operations.release_lock(root, data)["released"])
                with store.file_lock(root, "case:qa-001", wait=0.01):
                    pass
            with patch.object(store.os, "fsync", side_effect=OSError("metadata fsync failed")):
                with self.assertRaises(OSError):
                    with store.file_lock(root, "case:qa-001"):
                        pass
            self.assertEqual(list((root / ".locks").glob("*.lock")), [])
            path = operations.lock_path(root, resource="lock-administration")
            path.write_text(json.dumps({"pid": os.getpid(), "host": socket.gethostname(), "at": time.time() - 3600, "owner": "active"}))
            status = operations.lock_status(root, "QA-001")
            with self.assertRaisesRegex(ValueError, "still running"):
                operations.release_lock(root, {**data, "resource": "lock-administration", "token": status["token"]})

    def test_new_mandatory_block_preserves_legacy_validation(self):
        value = pair()
        value["events"][-1]["payload"]["snapshot"]["cits"]["charged_item"]["mandatoryAppearance"] = True
        with self.assertRaisesRegex(ValueError, "division-approved defendant instructions"):
            store.validate_history(value)
        store.validate_history(value, {e["id"] for e in value["events"]})

    def test_exact_reporting_revision_and_duplicate_exclusion(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            value = record()
            value["schema"] = 5
            name = "101 TEST - QA-001.json"
            saved = store.save_case(root, name, value)
            summary = report_summary(saved["file"])
            store.save_summary(root, name, saved["revision"], summary)
            with patch.object(server, "case_dir", return_value=root):
                self.assertEqual(len(server.read_index()["summaries"]), 1)
                changed = copy.deepcopy(saved["file"])
                changed["case"]["owner"] = "Owner B"
                next_save = store.save_case(root, name, changed, saved["revision"], saved["file"]["case"])
                os.utime(root / "Reporting Index/qa-001.json", (time.time() + 100, time.time() + 100))
                index = server.read_index()
                self.assertEqual(index["summaries"], [])
                self.assertEqual(index["stale"], [name])
                summary = report_summary(next_save["file"])
                store.save_summary(root, name, next_save["revision"], summary)
                self.assertEqual(server.read_index()["summaries"][0]["case"]["owner"], "Owner B")
                data = json.loads((root / "Reporting Index/qa-001.json").read_bytes())
                data.pop("sourceRevision")
                (root / "Reporting Index/qa-001.json").write_text(json.dumps(data))
                self.assertEqual(server.read_index()["stale"], [name])
                store.save_summary(root, name, next_save["revision"], summary)
                (root / "Reporting Index/duplicate.json").write_bytes((root / "Reporting Index/qa-001.json").read_bytes())
                self.assertEqual(server.read_index()["summaries"], [])

    def test_linear_read_counts(self):
        measurements = []
        for count in (80, 600, 3000):
            with tempfile.TemporaryDirectory() as folder:
                root = Path(folder)
                idx = root / "Reporting Index"
                idx.mkdir()
                entries = []
                for n in range(count):
                    value = record()
                    value["schema"] = 5
                    value["case"]["number"] = "QA-" + str(n)
                    value["case"]["id"] = "case_" + str(n)
                    value = integrity.commit_record(None, value)
                    name = "TEST - " + value["case"]["number"] + ".json"
                    raw = store.encoded(value)
                    (root / name).write_bytes(raw)
                    entries.append(
                        {
                            "caseNumber": value["case"]["number"],
                            "fileName": name,
                            "genesisHash": value["integrity"]["genesis"]["hash"],
                            "migratedAt": "synthetic",
                        }
                    )
                    (idx / (value["case"]["number"] + ".json")).write_text(
                        json.dumps(
                            {
                                "format": "madison-case-summary",
                                "case": value["case"],
                                "sourceFile": name,
                                "sourceRevision": hashlib.sha256(raw).hexdigest(),
                                "integrity": {"headHash": value["integrity"]["headHash"]},
                            }
                        )
                    )
                (root / "_integrity").mkdir()
                (root / "_integrity/migrated.json").write_text(json.dumps({"format": "madison-migration-registry", "entries": entries}))
                reads = 0
                real_text = Path.read_text
                real_bytes = Path.read_bytes

                def text(path, *args, **kwargs):
                    nonlocal reads
                    if path.parent == idx:
                        reads += 1
                    return real_text(path, *args, **kwargs)

                def byte_read(path, *args, **kwargs):
                    nonlocal reads
                    if path.parent == idx:
                        reads += 1
                    return real_bytes(path, *args, **kwargs)

                with (
                    patch.object(Path, "read_text", text),
                    patch.object(Path, "read_bytes", byte_read),
                    patch.object(server, "case_dir", return_value=root),
                ):
                    result = server.read_index()
                self.assertEqual(len(result["summaries"]), count)
                self.assertLessEqual(reads, 2 * count + 2)
                measurements.append({"cases": count, "summaryReads": reads, "currentSummaries": len(result["summaries"])})
        Path("build/test-results/r40-scaling.json").write_text(json.dumps(measurements, indent=2) + "\n")


if __name__ == "__main__":
    unittest.main()
