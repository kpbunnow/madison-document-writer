"""A gate-only rerun needs authenticated same-run/head/producer-attempt evidence and safe ZIP bytes."""

import copy
import hashlib
import io
import re
import tempfile
import unittest
import zipfile
from pathlib import Path
from unittest.mock import patch

from gate_artifacts import GitHubEvidence, assemble_github, pages, select, unpack

HEAD = "a" * 40
REPO = "owner/repository"


class API:
    def __init__(self):
        self.info = {
            "id": 123,
            "run_attempt": 2,
            "head_sha": HEAD,
            "path": ".github/workflows/verify.yml",
            "workflow_id": 456,
            "repository": {"id": 1, "full_name": REPO},
            "head_repository": {"id": 1},
        }
        self.jobs = {
            2: [],
            1: [
                {"id": n, "name": name, "run_id": 123, "run_attempt": 1, "head_sha": HEAD, "status": "completed", "conclusion": "success"}
                for n, name in enumerate(["regression checks", "browser checks"], 1)
            ],
        }
        self.artifacts = [
            {
                "id": n,
                "name": "stage-" + stage + "-123-1",
                "expired": False,
                "size_in_bytes": 100,
                "digest": "sha256:" + "b" * 64,
                "workflow_run": {"id": 123, "head_sha": HEAD, "repository_id": 1, "head_repository_id": 1},
            }
            for n, stage in enumerate(["regression", "browser"], 1)
        ]

    def get(self, path):
        if path == "/actions/runs/123":
            return copy.deepcopy(self.info)
        if "/artifacts?" in path:
            return {"artifacts": copy.deepcopy(self.artifacts), "total_count": len(self.artifacts)}
        match = re.fullmatch(r"/actions/runs/123/attempts/(\d+)/jobs\?per_page=100&page=1", path)
        if match:
            jobs = copy.deepcopy(self.jobs.get(int(match[1]), []))
            return {"jobs": jobs, "total_count": len(jobs)}
        raise AssertionError("Unexpected endpoint: " + path)


def archive(files):
    stream = io.BytesIO()
    with zipfile.ZipFile(stream, "w") as target:
        for name, text in files:
            target.writestr(name, text)
    raw = stream.getvalue()
    return raw, {"digest": "sha256:" + hashlib.sha256(raw).hexdigest(), "size_in_bytes": len(raw)}


class GateArtifacts(unittest.TestCase):
    def test_complete_prior_pair_on_gate_only_rerun(self):
        api = API()
        before = copy.deepcopy(api.__dict__)
        result = select(api, REPO, "123", "2", HEAD)
        self.assertEqual(result["identity"], {"run": "123", "attempt": "1"})
        self.assertEqual(result["assemblyIdentity"], {"run": "123", "attempt": "2"})
        self.assertEqual(result["producerJobs"], {"regression checks": 1, "browser checks": 2})
        self.assertEqual(api.__dict__, before)
        api.info["run_attempt"] = 1
        self.assertEqual(select(api, REPO, "123", "1", HEAD)["identity"]["attempt"], "1")

    def test_source_run_workflow_and_assembly_attempt_are_bound(self):
        for field, value in [
            ("head_sha", "c" * 40),
            ("id", 999),
            ("run_attempt", 3),
            ("path", ".github/workflows/other.yml"),
            ("repository", {"full_name": "other/repo"}),
        ]:
            with self.subTest(field=field):
                api = API()
                api.info[field] = value
                with self.assertRaises(ValueError):
                    select(api, REPO, "123", "2", HEAD)

    def test_producer_failure_skip_duplicates_and_partial_attempt_never_mix(self):
        for field, value in [
            ("status", "in_progress"),
            ("conclusion", "failure"),
            ("conclusion", "skipped"),
            ("head_sha", "c" * 40),
            ("run_attempt", 2),
            ("run_id", 999),
        ]:
            with self.subTest(field=field, value=value):
                api = API()
                api.jobs[1][0][field] = value
                with self.assertRaises(ValueError):
                    select(api, REPO, "123", "2", HEAD)
        for kind in ["missing", "duplicate", "partial-new-attempt"]:
            api = API()
            if kind == "missing":
                api.jobs[1].pop()
            elif kind == "duplicate":
                api.jobs[1].append(copy.deepcopy(api.jobs[1][0]))
            else:
                api.jobs[2] = [{**api.jobs[1][0], "run_attempt": 2}]
            with self.subTest(kind=kind), self.assertRaises(ValueError):
                select(api, REPO, "123", "2", HEAD)

    def test_missing_expired_ambiguous_modified_artifact_metadata_fails(self):
        for change in ["missing", "duplicate", "expired", "digest", "run", "head", "repository", "size"]:
            api = API()
            if change == "missing":
                api.artifacts.pop()
            elif change == "duplicate":
                api.artifacts.append(copy.deepcopy(api.artifacts[0]))
            elif change in {"run", "head", "repository"}:
                field = {"run": "id", "head": "head_sha", "repository": "head_repository_id"}[change]
                api.artifacts[0]["workflow_run"][field] = "mismatch"
            else:
                field, value = {"expired": ("expired", True), "digest": ("digest", "missing"), "size": ("size_in_bytes", 0)}[change]
                api.artifacts[0][field] = value
            with self.subTest(change=change), self.assertRaises(ValueError):
                select(api, REPO, "123", "2", HEAD)

    def test_empty_attempts_cannot_supply_evidence(self):
        api = API()
        api.jobs = {}
        with self.assertRaisesRegex(ValueError, "No complete"):
            select(api, REPO, "123", "2", HEAD)

    def test_zip_digest_size_and_traversal_are_refused_before_writes(self):
        with tempfile.TemporaryDirectory() as folder:
            dest = Path(folder) / "stage"
            raw, metadata = archive([("verification/latest/proof.json", "{}")])
            for bad in [b"tampered", raw + b"extra"]:
                with self.assertRaises(ValueError):
                    unpack(bad, metadata, dest)
                self.assertFalse(dest.exists())
            for name in ["../outside", "/absolute", "a/../../outside", "a\\outside", "C:/outside", "a/./b"]:
                raw, metadata = archive([(name, "x")])
                with self.subTest(name=name), self.assertRaises(ValueError):
                    unpack(raw, metadata, dest)
                self.assertFalse(dest.exists())
            raw, metadata = archive([("verification/latest/proof.json", "{}")])
            unpack(raw, metadata, dest)
            self.assertEqual((dest / "verification/latest/proof.json").read_text(), "{}")
            with self.assertRaises(ValueError):
                unpack(raw, metadata, dest)

    def test_symlink_duplicate_and_oversized_expansion_fail(self):
        with tempfile.TemporaryDirectory() as folder:
            dest = Path(folder) / "stage"
            buffer = io.BytesIO()
            with zipfile.ZipFile(buffer, "w") as z:
                link = zipfile.ZipInfo("linked")
                link.external_attr = 0o120777 << 16
                z.writestr(link, "../outside")
            raw = buffer.getvalue()
            meta = {"digest": "sha256:" + hashlib.sha256(raw).hexdigest(), "size_in_bytes": len(raw)}
            with self.assertRaisesRegex(ValueError, "Unsafe"):
                unpack(raw, meta, dest)
            raw, meta = archive([("one", "x" * 1000)])
            with patch("gate_artifacts.MAX_ARCHIVE", 500), self.assertRaisesRegex(ValueError, "expanded"):
                unpack(raw, meta, dest)

    def test_zip_duplicate_names_are_refused(self):
        import warnings

        with tempfile.TemporaryDirectory() as folder, warnings.catch_warnings(record=True):
            raw, metadata = archive([("duplicate", "first"), ("duplicate", "second")])
            destination = Path(folder) / "stage"
            with self.assertRaisesRegex(ValueError, "duplicate"):
                unpack(raw, metadata, destination)
            self.assertFalse(destination.exists())

    def test_storage_redirect_never_receives_the_api_token(self):
        from urllib.error import HTTPError

        api = GitHubEvidence(REPO, "synthetic-secret")
        calls = []

        class Storage:
            def open(self, request, timeout):
                calls.append(request)
                if len(calls) == 1:
                    raise HTTPError(request.full_url, 302, "redirect", {"Location": "https://unit.blob.core.windows.net/test?sig=synthetic"}, None)
                return io.BytesIO(b"archive")

        api.open_binary = Storage().open
        self.assertEqual(api.archive(1), b"archive")
        self.assertEqual(calls[0].get_header("Authorization"), "Bearer synthetic-secret")
        self.assertIsNone(calls[1].get_header("Authorization"))
        self.assertIsNone(calls[1].get_header("X-github-api-version"))

    def test_metadata_binary_response_decodes_explicit_utf8(self):
        api = GitHubEvidence(REPO, "synthetic-secret")
        api.open_binary = lambda request, timeout: io.BytesIO('{"label":"José — synthetic metadata"}'.encode())
        self.assertEqual(api.get("/actions/runs/123"), {"label": "José — synthetic metadata"})
        api.open_binary = lambda request, timeout: io.BytesIO(b'{"label":"\xff"}')
        with self.assertRaises(UnicodeDecodeError):
            api.get("/actions/runs/123")

    def test_untrusted_storage_redirects_are_refused_before_fetch(self):
        from urllib.error import HTTPError

        for location in [
            "http://unit.blob.core.windows.net/x",
            "https://elsewhere.example/x",
            "https://unit.blob.core.windows.net.elsewhere.example/x",
            "https://user@unit.blob.core.windows.net/x",
        ]:
            api = GitHubEvidence(REPO, "synthetic-secret")

            class Redirect:
                def open(self, request, timeout, location=location):
                    raise HTTPError(request.full_url, 302, "redirect", {"Location": location}, None)

            api.open_binary = Redirect().open
            with self.subTest(location=location), self.assertRaisesRegex(ValueError, "destination"):
                api.archive(1)

    def test_api_credentials_and_entry_point_are_scoped(self):
        api = GitHubEvidence(REPO, "synthetic-secret")
        self.assertEqual(api.request("/actions/runs/123").get_header("Authorization"), "Bearer synthetic-secret")
        for path in ["https://elsewhere.example", "/../elsewhere", "/actions/../../secrets"]:
            with self.assertRaises(ValueError):
                api.request(path)
        with patch.dict("os.environ", {}, clear=True), self.assertRaises(ValueError):
            assemble_github(Path.cwd(), lambda *args: None)

    def test_incomplete_pagination_is_refused(self):
        class Incomplete:
            def get(self, path):
                return {"jobs": [], "total_count": 1}

        with self.assertRaises(ValueError):
            pages(Incomplete(), "/actions/jobs", "jobs")


if __name__ == "__main__":
    unittest.main()
