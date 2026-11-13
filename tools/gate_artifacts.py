"""Select a complete same-run producer pair through authenticated GitHub metadata.

The assembler independently checks every sealed file, source/runtime input and pinned toolchain afterwards.
No caller-supplied attempt number alone authorizes reuse.
"""

import hashlib
import io
import json
import re
import shutil
import stat
import zipfile
from http.client import HTTPException
from pathlib import Path, PurePosixPath
from urllib.error import HTTPError
from urllib.parse import urlsplit
from urllib.request import HTTPRedirectHandler, Request, build_opener

MAX_ARCHIVE = 512 * 1024 * 1024


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, _req, _fp, _code, _msg, _headers, _newurl):
        return None


class GitHubEvidence:
    def __init__(self, repository, token):
        if not re.fullmatch(r"[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+", repository) or any(p in {".", ".."} for p in repository.split("/")):
            raise ValueError("Invalid GitHub repository")
        if not token:
            raise ValueError("Authenticated GitHub Actions read access is required")
        self.base, self.token = "https://api.github.com/repos/" + repository, token
        self.opener = build_opener(NoRedirect())

    def request(self, path):
        if not path.startswith("/actions/") or ".." in path or "#" in path:
            raise ValueError("Invalid GitHub Actions API path")
        return Request(
            self.base + path,
            headers={"Authorization": "Bearer " + self.token, "Accept": "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28"},
        )

    def get(self, path):
        with self.opener.open(self.request(path), timeout=60) as response:
            raw = response.read(32 * 1024 * 1024 + 1)
        if len(raw) > 32 * 1024 * 1024:
            raise ValueError("GitHub metadata response exceeds its bound")
        return json.loads(raw)

    def archive(self, artifact_id):
        try:
            with self.opener.open(self.request("/actions/artifacts/" + str(artifact_id) + "/zip"), timeout=60):
                raise ValueError("Expected the GitHub artifact redirect")
        except HTTPError as error:
            try:
                if error.code != 302:
                    raise ValueError("GitHub artifact redirect unavailable") from None
                location = error.headers.get("Location", "")
            finally:
                error.close()
        target = urlsplit(location)
        if (
            target.scheme != "https"
            or not target.hostname
            or not target.hostname.endswith(".blob.core.windows.net")
            or target.username
            or target.password
            or target.port
            or target.fragment
        ):
            raise ValueError("Unexpected GitHub artifact storage destination")
        # No authorization header is sent to the signed storage URL; redirects are refused.
        try:
            with self.opener.open(Request(location), timeout=60) as response:
                data = response.read(MAX_ARCHIVE + 1)
        except OSError, ValueError, HTTPException:
            raise ValueError("GitHub artifact storage read failed") from None
        if len(data) > MAX_ARCHIVE:
            raise ValueError("GitHub artifact ZIP exceeds its bound")
        return data


def pages(api, path, field):
    rows = []
    for page in range(1, 11):
        result = api.get(path + ("&" if "?" in path else "?") + "per_page=100&page=" + str(page))
        batch = result[field]
        if not isinstance(batch, list) or len(batch) > 100:
            raise ValueError("Malformed GitHub metadata page")
        rows.extend(batch)
        if len(rows) == result["total_count"]:
            return rows
        if len(batch) < 100:
            raise ValueError("Incomplete GitHub metadata pagination")
    raise ValueError("GitHub evidence inventory exceeds pagination bound")


def require_jobs(jobs, run, producer, head):
    for job in jobs:
        if (
            job["run_id"] != int(run)
            or job["run_attempt"] != producer
            or job["head_sha"] != head
            or job["status"] != "completed"
            or job["conclusion"] != "success"
        ):
            raise ValueError("Missing, skipped, failed or mismatched producer job; rerun all jobs")


def select(api, repository, run, attempt, head):
    if not re.fullmatch(r"[1-9][0-9]*", str(run)) or not re.fullmatch(r"[1-9][0-9]*", str(attempt)) or not re.fullmatch(r"[0-9a-f]{40}", head):
        raise ValueError("Identified GitHub run, attempt and source head required")
    info = api.get("/actions/runs/" + str(run))
    if (
        info["id"] != int(run)
        or info["run_attempt"] != int(attempt)
        or info["head_sha"] != head
        or info["repository"]["full_name"] != repository
        or info["path"] != ".github/workflows/verify.yml"
    ):
        raise ValueError("GitHub run does not match this reviewed source/workflow")
    artifacts = pages(api, "/actions/runs/" + str(run) + "/artifacts", "artifacts")
    for producer in range(int(attempt), max(0, int(attempt) - 20), -1):
        jobs = pages(api, "/actions/runs/" + str(run) + "/attempts/" + str(producer) + "/jobs", "jobs")
        selected = [j for j in jobs if j["name"] in {"regression checks", "browser checks"}]
        if not selected:
            continue  # A gate-only attempt has no producer jobs of its own.
        if len(selected) != 2 or {j["name"] for j in selected} != {"regression checks", "browser checks"}:
            raise ValueError("Both complete producers must come from one attempt; rerun all jobs")
        require_jobs(selected, run, producer, head)
        pair = {}
        for stage in ("regression", "browser"):
            name = "stage-" + stage + "-" + str(run) + "-" + str(producer)
            found = [a for a in artifacts if a["name"] == name]
            if len(found) != 1:
                raise ValueError("Missing or ambiguous producer artifact; rerun all jobs")
            artifact = found[0]
            source = artifact["workflow_run"]
            if (
                artifact["expired"] is not False
                or type(artifact["id"]) is not int
                or artifact["id"] <= 0
                or not 0 < artifact["size_in_bytes"] <= MAX_ARCHIVE
                or not re.fullmatch(r"sha256:[0-9a-f]{64}", artifact.get("digest", ""))
                or source["id"] != int(run)
                or source["head_sha"] != head
                or source["repository_id"] != info["repository"]["id"]
                or source["head_repository_id"] != info["head_repository"]["id"]
            ):
                raise ValueError("Expired or mismatched producer artifact metadata")
            pair[stage] = {key: artifact[key] for key in ("id", "name", "digest", "size_in_bytes")}
        return {
            "identity": {"run": str(run), "attempt": str(producer)},
            "assemblyIdentity": {"run": str(run), "attempt": str(attempt)},
            "sourceCommit": head,
            "workflowId": info["workflow_id"],
            "producerJobs": {j["name"]: j["id"] for j in selected},
            "artifacts": pair,
        }
    raise ValueError("No complete producer pair found; rerun all jobs")


def unpack(data, artifact, destination):
    if len(data) != artifact["size_in_bytes"] or "sha256:" + hashlib.sha256(data).hexdigest() != artifact["digest"]:
        raise ValueError("Artifact ZIP differs from authenticated GitHub digest/size")
    destination = Path(destination)
    if destination.exists():
        raise ValueError("Artifact destination must be a fresh staging directory")
    with zipfile.ZipFile(io.BytesIO(data)) as archive:
        entries, names, total = archive.infolist(), set(), 0
        if not entries or len(entries) > 10000:
            raise ValueError("Artifact ZIP file count is invalid")
        for entry in entries:
            path = PurePosixPath(entry.filename)
            mode = entry.external_attr >> 16
            if (
                path.is_absolute()
                or "\\" in entry.filename
                or ":" in entry.filename
                or any(p in {".", ".."} for p in path.parts)
                or path.as_posix() != entry.filename.rstrip("/")
                or str(path) in names
                or stat.S_ISLNK(mode)
                or stat.S_IFMT(mode) not in {0, stat.S_IFREG, stat.S_IFDIR}
            ):
                raise ValueError("Unsafe or duplicate artifact ZIP path")
            names.add(str(path))
            total += entry.file_size
            if total > MAX_ARCHIVE:
                raise ValueError("Artifact expanded payload exceeds its bound")
        destination.mkdir(parents=True)
        try:
            for entry in entries:
                target = destination / entry.filename
                if entry.is_dir():
                    target.mkdir(parents=True, exist_ok=True)
                else:
                    target.parent.mkdir(parents=True, exist_ok=True)
                    with archive.open(entry) as source, target.open("xb") as output:
                        shutil.copyfileobj(source, output)
        except BaseException:
            shutil.rmtree(destination)
            raise


def assemble_github(root, runner):
    """Resolve/download only authenticated same-run evidence, then use all original assembly checks."""
    import os
    import subprocess
    import tempfile

    from gate_stages import assemble, run_identity

    if os.environ.get("GITHUB_ACTIONS") != "true" or os.environ.get("GITHUB_JOB") != "full-gate":
        raise ValueError("GitHub evidence reuse is restricted to the Full gate job")
    current, repository = run_identity(), os.environ["GITHUB_REPOSITORY"]
    head = subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=root, encoding="utf-8").strip()
    api = GitHubEvidence(repository, os.environ.get("GITHUB_TOKEN"))
    selection = select(api, repository, current["run"], current["attempt"], head)
    build = root / "build"
    if build.is_symlink() or build.resolve().parent != root.resolve():
        raise ValueError("Gate staging must remain in this checkout")
    build.mkdir(exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="ci-producers-", dir=build) as temporary:
        folders = []
        for stage in ("regression", "browser"):
            artifact = selection["artifacts"][stage]
            destination = Path(temporary) / stage
            unpack(api.archive(artifact["id"]), artifact, destination)
            folders.append(destination)
        assemble(root, runner, *folders, producer_selection=selection)
