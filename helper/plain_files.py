"""Case-folder entries must be plain files. A link or reparse point could make the helper read or write outside the
folder, so listing skips them and reading or writing refuses them."""

import os
from pathlib import Path
import re
import stat

REPARSE_POINT = 0x400  # FILE_ATTRIBUTE_REPARSE_POINT: links, junctions and similar redirections on Windows
LINKED_MESSAGE = "That case file is a link or is not a regular file, so it was not used. Ask an administrator to review the case folder."

# Control characters (other than ordinary whitespace) and bidirectional formatting: they fail on Windows or make a
# file name display as something it is not.
UNSAFE_NAME_CHARS = re.compile("[\x00-\x08\x0e-\x1f\x7f\u061c\u200e\u200f\u202a-\u202e\u2066-\u2069]")


def is_plain_file(path):
    if not isinstance(path, (str, os.PathLike)):
        return True  # not a filesystem entry (a test double); nothing to inspect
    try:
        info = os.lstat(path)
    except OSError:
        return False
    return stat.S_ISREG(info.st_mode) and not getattr(info, "st_file_attributes", 0) & REPARSE_POINT


def plain_json_files(folder, pattern="*.json"):
    source = folder if hasattr(folder, "glob") else Path(folder)
    return [p for p in source.glob(pattern) if is_plain_file(p)]


def require_plain_file(path):
    """Refuse an existing entry that is not a plain file; a missing one is left for the caller's own error."""
    if os.path.lexists(path) and not is_plain_file(path):
        raise ValueError(LINKED_MESSAGE)
