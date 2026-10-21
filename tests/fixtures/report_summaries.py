"""Valid Reporting Index summaries for synthetic cases: the projection the Writer's summarize() writes."""

import case_projection


def report_summary(record, **metadata):
    return {**case_projection.plain(case_projection.project(record)), **metadata}
