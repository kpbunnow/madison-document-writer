# Recent development review

Review baseline: main `c6c07c3874f052b1c73aa024f8a741c15952ed8a` (2026-11-23), including PRs #545–#554. Baseline GitHub Full gate and CodeQL passed. This review covers the recent GUI, request/parsing parity, recovery, helper read-scaling, Reports outage, media and load-test changes. It is development evidence, not release or City acceptance.

## Confirmed defects and corrections

| Finding | Trigger and consequence | Correction and regression evidence |
| --- | --- | --- |
| High: incomplete integrity evidence | Concurrent downgrade checks shared a lazy inventory marked complete before its reads finished. A second check could accept a stripped legacy record. A reader exception also left the inventory permanently marked complete. | A per-operation lock protects staged inventory publication; completion is recorded only after successful traversal. Two controlled regressions failed before the correction and pass afterward, including retry after interruption. Ordinary registered-case opens still read zero summaries. |
| Medium: overflowing JSON numbers | `parse_constant` refused literal NaN/Infinity but JSON exponents such as `1e309` and 400-digit integers became nonfinite when interpreted as browser numbers. Recovery serialization also allowed nonfinite values supplied by internal callers. | Request parsing rejects overflowing numbers while preserving finite integer/float types and strings. Backup serialization refuses nonfinite data before directory/file creation. Unit tests cover nested overflow, maximum finite values and no-write refusal; a real authenticated browser/helper test checks HTTP 400 and no backup created. |
| Medium: ambiguous and stale recovery selection | Distinct files with equal payload timestamps both appeared selected. Imported rows have no row timestamp, so the wrong source appeared selected. Reopening the list could allow an earlier selection to reappear. | Selection tracks the actual ephemeral source row. List/selection sequence guards discard superseded reads, errors and focus work. Independent selection tests cover reopen, superseded lists and import during loading; native browser checks cover two equal-date files, import, exactly one selected row, focus and selection without restoration. |
| Low: remaining ordinance parser disagreement | Python's Unicode case-insensitive SPS substitution accepted `ſPS321.12`; JavaScript rejected it. | SPS normalization now uses ASCII case folding, matching the browser. Both ordinary case variants remain supported; direct expectations and browser/helper parity include the confusable prefix. |

## Verification and preserved contracts

Focused local checks passed for request shapes, nonfinite JSON, helper read scaling, integrity verification phases, Reporting inputs, inspector cases, server reporting, citation pricing rules/boundaries, eight browser/helper policy mirror tests, recovery controller/export/markup, report facts/outage behavior, event registration and module boundaries. The retained recovery markup fixture remains unchanged: its comparison view adapts only the selection predicate, with independent collision/import expectations and all 6,000 scenarios retained. R32's 3,872 pricing combinations remain covered.

The new production browser scenario uses synthetic private drafts and the actual authenticated helper. It checks light/dark/high/system themes with axe. Full required GitHub checks on the final reviewed head remain the merge condition; the PR records their exact links/results. Targeted local checks do not replace that gate.

No release identities, persistent formats, dependency locks, print language, issued history or frozen references change. Selected-row identity exists only in live dialog state. The recovery owner delegates listing through the same lazy services; its measured function size decreases from 163 to 152 lines and the existing ratchet is tightened accordingly. Registered-case fast paths retain their read-count assertions. No release is packaged or deployed.

The Linux browser checks do not establish native Windows, City integration or human accessibility acceptance. Existing Windows recovery checks and operational acceptance remain separate requirements. No additional confirmed defect was identified in the reviewed Reports outage behavior, browser timing changes, media or load-result documentation.
