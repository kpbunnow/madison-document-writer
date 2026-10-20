"""Bounded read-only I/O. Inputs and yielded results stay in source order."""

from concurrent.futures import ThreadPoolExecutor

MAX_READERS = 4
BATCH_SIZE = 16


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
