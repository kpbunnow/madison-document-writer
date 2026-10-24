"""Canonical release metadata validation shared by build, synchronization and publication tools."""

from datetime import date
import re


def helper_parts(value):
    if not isinstance(value, str) or not re.fullmatch(r"\d{4}\.\d{2}\.\d{2}\.[1-9]\d*", value):
        raise ValueError("helperVersion must be YYYY.MM.DD.<positive helperBuild>")
    parts = tuple(int(p) for p in value.split("."))
    date(*parts[:3])
    return parts


def release_number(value):
    if not isinstance(value, str) or not re.fullmatch(r"\d{4}-\d{2}-\d{2} R[1-9]\d*", value):
        raise ValueError("release must be YYYY-MM-DD R<positive number>")
    date.fromisoformat(value.split()[0])
    return int(value.split(" R")[1])


def validate_identity(value, *, formats=True, legacy=False):
    if not isinstance(value, dict):
        raise ValueError("Release metadata must be an object")
    release_number(value.get("release"))
    parts = helper_parts(value.get("helperVersion"))
    build = value.get("helperBuild", parts[-1] if legacy else None)
    if type(build) is not int or build <= 0 or build != parts[-1]:
        raise ValueError("helperBuild must be a positive integer matching helperVersion")
    if not legacy and date(*parts[:3]).isoformat() != value["release"].split()[0]:
        raise ValueError("Release and helper calendar dates must agree")
    for key in ("authoringVersion", "caseSchema", "summaryVersion", "backupVersion"):
        if (formats or key in value) and (type(value.get(key)) is not int or value[key] <= 0):
            raise ValueError(key + " must be a positive integer")
    return value
