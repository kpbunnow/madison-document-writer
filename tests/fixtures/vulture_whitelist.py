"""Intentional cache-key and framework-signature parameters."""


class _Framework:
    version_hash = None
    fmt = None


_Framework.version_hash
_Framework.fmt

# Python's import machinery reads this process-wide flag; application code never does.
_Framework.dont_write_bytecode
# HTMLParser dispatches these callbacks by name when feed() parses document markup.
_Framework.handle_data
_Framework.handle_endtag
_Framework.handle_starttag
# BaseHTTPRequestHandler invokes request/log callbacks through framework dispatch.
_Framework.log_message
_Framework.do_POST
# ThreadingMixIn reads the class policy dynamically to manage request threads.
_Framework.daemon_threads
# print(), logging and library code read these file-object members from sys.stdout/sys.stderr; under
# pythonw.exe desktop_launch._LogStream stands in for those streams.
_Framework.encoding
_Framework.isatty
# The logging module reads this process-wide flag when a handler fails; the windowless launcher clears it.
_Framework.raiseExceptions
