"""Refuse changed published content under a reused release identity; no installer trust change."""

import re
from version_schema import helper_parts, release_number, validate_identity


def validate_manifest(value, *, legacy=False):
    validate_identity(value, formats=False, legacy=legacy)
    files = value.get("files")
    if not isinstance(files, dict) or not files:
        raise ValueError("A published deployment manifest must contain its file hashes")
    for name, metadata in files.items():
        if (
            not isinstance(name, str)
            or not name
            or not isinstance(metadata, dict)
            or type(metadata.get("size")) is not int
            or metadata["size"] < 0
            or not isinstance(metadata.get("sha256"), str)
            or not re.fullmatch(r"[0-9a-f]{64}", metadata["sha256"])
        ):
            raise ValueError("Invalid published file metadata")


def check_publication(candidate, published):
    """The release owner supplies the manifest retained from the last approved publication."""
    validate_manifest(candidate)
    if published is None:
        return  # Explicit first-publication declaration; never infer this from a missing file.
    validate_manifest(published, legacy=True)
    current = helper_parts(candidate["helperVersion"])
    previous = helper_parts(published["helperVersion"])
    same_identity = candidate["release"] == published["release"] and current == previous
    if same_identity:
        if candidate != published:
            raise ValueError("Published release identity is immutable; assign a new release and helper build for changed deployed bytes")
        return  # Exact reinstallation is allowed.
    if release_number(candidate["release"]) <= release_number(published["release"]):
        raise ValueError("A new publication must advance the release number")
    if current[-1] <= previous[-1] or current < previous:
        raise ValueError("A new publication must advance helperBuild without calendar-version rollback")
