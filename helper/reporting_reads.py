"""Bounded read-only I/O. Inputs and yielded results stay in source order."""

from concurrent.futures import ThreadPoolExecutor
import json
import threading

MAX_READERS = 4
BATCH_SIZE = 16
SUMMARY_INPUT_BYTES = 16 * 1024 * 1024
SUMMARY_INPUT_FILES = 4096


class SummaryInputs:
    """One request's already-read summary inputs, never case bytes or verification verdicts.

    At most 16 MiB of raw input and 4,096 entries are retained, plus parsed values. Other inputs use ordinary reads.
    The caller supplies its existing reader: secure open-case reads must never consume an ordinary-path read.
    Context parsing retains strict UTF-8 semantics; consumption retains json.loads(bytes), including BOM handling.
    """

    def __init__(self, reader, max_bytes=SUMMARY_INPUT_BYTES, max_files=SUMMARY_INPUT_FILES):
        self.reader, self.max_bytes, self.max_files = reader, max_bytes, max_files
        self.values, self.bytes = {}, 0
        self.lock = threading.Lock()

    def read_context(self, path):
        try:
            raw = self.reader(path)
        except OSError, ValueError:
            # A secure read may refuse a link that the old evidence-only scan could read. Keep that downgrade
            # evidence, but never cache it for the secure consumer: its own read must still refuse the entry.
            try:
                return json.loads(path.read_text(encoding="utf-8"))
            except OSError, ValueError:
                return None
        try:
            value, parsed = json.loads(raw.decode("utf-8")), True
        except ValueError:
            value, parsed = None, False
        with self.lock:
            if path not in self.values and len(self.values) < self.max_files and self.bytes + len(raw) <= self.max_bytes:
                self.values[path] = (raw, parsed, value)
                self.bytes += len(raw)
        return value

    def read(self, path, max_bytes=None):
        with self.lock:
            kept = self.values.pop(path, None)
            if kept is not None:
                self.bytes -= len(kept[0])
        raw, parsed, value = kept if kept is not None else (self.reader(path), False, None)
        if max_bytes is not None and len(raw) > max_bytes:
            raise ValueError("too large")
        return raw, value if parsed else json.loads(raw)


def ordered_reads(paths, reader, workers=1):
    """At most four readers and sixteen pending inputs, local to this call.

    Readers must be read-only and return any expected file errors as data.
    Validation and shared result mutation remain on the consuming thread.
    No executor, case bytes or verification result survives the request.
    """
    if not isinstance(workers, int) or not 1 <= workers <= MAX_READERS:
        raise ValueError("Reporting read workers must be between 1 and 4")
    if workers == 1:
        for path in paths:
            yield reader(path)
        return
    iterator = iter(paths)
    with ThreadPoolExecutor(max_workers=workers, thread_name_prefix="report-read") as pool:
        while True:
            batch = []
            for _ in range(BATCH_SIZE):
                try:
                    batch.append(next(iterator))
                except StopIteration:
                    break
            if not batch:
                return
            yield from pool.map(reader, batch)
