"""What a person sees when the helper cannot do something.

Messages the program wrote on purpose (a ValueError or a crafted OSError saying what to do) are shown as written.
Parser and Python errors, and system errors that name a file path, are not: they say nothing useful to staff and
can expose where files live, so they become one plain sentence. Nothing here changes a status code."""

import json

UNEXPECTED = "The helper could not process this request. Nothing was changed. Ask an administrator to check the helper."
UNREADABLE = "The request or file could not be read. Nothing was changed."
UNREACHABLE = "A file or folder could not be reached. Check that the shared case folder is connected, then try again."


def public_message(error):
    if isinstance(error, (json.JSONDecodeError, UnicodeError)):
        return UNREADABLE
    if isinstance(error, OSError):
        # A system error carries an errno and usually a path; one the program raised itself carries only its message.
        return UNREACHABLE if error.errno is not None else (str(error) or UNREACHABLE)
    if isinstance(error, ValueError):
        return str(error) or UNREADABLE
    return UNEXPECTED
