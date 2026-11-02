"""Case-folder entries must be plain files. A link or reparse point could make the helper read or write outside the
folder, so listing skips them and reading or writing refuses them."""

import os
import errno
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


def _windows_read_fd(path):
    """Open the entry itself, refusing reparse points, and deny deletion until the read handle closes."""
    import ctypes
    from ctypes import wintypes
    import msvcrt

    kernel = ctypes.WinDLL("kernel32", use_last_error=True)
    kernel.CreateFileW.argtypes = [wintypes.LPCWSTR, wintypes.DWORD, wintypes.DWORD, ctypes.c_void_p, wintypes.DWORD, wintypes.DWORD, wintypes.HANDLE]
    kernel.CreateFileW.restype = wintypes.HANDLE
    kernel.GetFileInformationByHandleEx.argtypes = [wintypes.HANDLE, ctypes.c_int, ctypes.c_void_p, wintypes.DWORD]
    kernel.GetFileInformationByHandleEx.restype = wintypes.BOOL
    kernel.CloseHandle.argtypes = [wintypes.HANDLE]
    kernel.CloseHandle.restype = wintypes.BOOL
    # GENERIC_READ, FILE_SHARE_READ|WRITE (not DELETE), OPEN_EXISTING, OPEN_REPARSE_POINT|BACKUP_SEMANTICS.
    handle = kernel.CreateFileW(os.path.abspath(path), 0x80000000, 3, None, 3, 0x02200000, None)
    if handle == ctypes.c_void_p(-1).value:
        raise ctypes.WinError(ctypes.get_last_error())
    try:
        attributes = (wintypes.DWORD * 2)()  # FILE_ATTRIBUTE_TAG_INFO
        if not kernel.GetFileInformationByHandleEx(handle, 9, attributes, ctypes.sizeof(attributes)):
            raise ctypes.WinError(ctypes.get_last_error())
        if attributes[0] & (REPARSE_POINT | 0x10):  # FILE_ATTRIBUTE_DIRECTORY
            raise ValueError(LINKED_MESSAGE)
        return msvcrt.open_osfhandle(handle, os.O_RDONLY | os.O_BINARY)
    except BaseException:
        kernel.CloseHandle(handle)
        raise


def read_plain_bytes(path):
    """Validate and read the same open file, never following a final-component link between check and use."""
    if os.name == "nt":
        fd = _windows_read_fd(os.fspath(path))
    else:
        try:
            fd = os.open(path, os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK | getattr(os, "O_CLOEXEC", 0))
        except OSError as error:
            if error.errno == errno.ELOOP:
                raise ValueError(LINKED_MESSAGE) from None
            raise
    try:
        if not stat.S_ISREG(os.fstat(fd).st_mode):
            raise ValueError(LINKED_MESSAGE)
        # Keep ownership even if stream construction fails; fdopen does not always close a supplied descriptor.
        with os.fdopen(fd, "rb", closefd=False) as stream:
            return stream.read()
    finally:
        os.close(fd)
