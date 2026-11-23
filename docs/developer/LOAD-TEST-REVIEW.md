# Load and endurance review — 2026-11-23

Earlier performance checks used 50 to 3,000 cases. This review measured the local helper with 5,000 and 10,000
synthetic shared cases (20,000 where noted) to find what slows down before real volume gets there. Everything is
synthetic and local. The cases are built from two browser-issued templates:
- an Official Notice with its filing (60%);
- an initial-inspection citation with its notice and filing (40%).

Each case has its own number, address, owner, owner mailing address, parcel and citation number, so no citation counts
as a repeat offense of another. Records are sealed with the helper's own `commit_record` and registered. Every
Reporting Index summary is written through the helper's real `save_summary`, which verifies the case.

The machine was also running browser suites during the measurements, so absolute times are pessimistic. Before and
after were measured back to back, on identical folders, under the same load.

## What was measured

Over HTTP against a running helper (`/cases/list`, `/reporting/index`, `/citations/history`, `/cases/open`, a new
case save with its summary, and a new initial citation followed by its filing update). In the browser: Workspace
opening, the Open saved case list, Reports first load and two refreshes.

## Defects fixed

| Finding | Effect at 10,000 cases | Fix |
| --- | --- | --- |
| Every save and every case open built a verification context that read and parsed every Reporting Index summary. Only the downgrade check for a record with no registry entry uses them. | Opening one case took about 0.5 s. Each save spent most of its time re-reading summaries. | The summary-derived set of known case numbers is read the first time it is needed, once per operation. Verdicts are unchanged: the downgrade check still reads it. |
| Any save of a case that had ever had a priced citation re-read and re-verified every shared case, inside the case lock, to build the cross-case citation history. That history is only used to price citations that are new in the save. | A filing update, reinspection or note on a cited case took about 13 s, holding the lock. | The history is read only when the save adds a priced citation. Pricing validation already applied only to new events, so validation is unchanged. |

`tests/unit/audit_helper_scale_reads.py` pins both. It fails on main before this change and passes after it.

| Operation (median of runs) | 5,000 before | 5,000 after | 10,000 before | 10,000 after |
| --- | --- | --- | --- | --- |
| Open one case | 218 ms | 22 ms | 530 ms | 51 ms |
| New case save + summary | 370 + 479 ms | 158 + 94 ms | 689 + 1,006 ms | 294 + 156 ms |
| Filing update of a cited case | 7.4 s | 91 ms | 12.8 s | 166 ms |
| New initial citation | 7.7 s | 7.7 s | 13.2 s | 12.9 s |
| `/citations/history` | 6.5 s, 20 MB | 6.8 s, 20 MB | 13.6 s, 41 MB | 12.7 s, 41 MB |
| `/reporting/index` (warm) | 10.1 s, 16 MB | 9.8 s, 16 MB | 20.0 s, 32 MB | 17.5 s, 32 MB |
| `/cases/list` | 85 ms | 52 ms | 141 ms | 108 ms |

## Still slow, for an owner decision

These grow linearly with the number of shared cases and are not changed here:
- **New initial citation, and `/citations/history`.** These cost about 1.3 s per 1,000 cases.
  - 90% of the time is RFC 8785 canonical hashing in the vendored pure-Python `rfc8785`. It re-verifies every case's
    integrity chain on every request.
  - The verification context is deliberately "never cached across requests or saves", so a verdict cache is a design
    decision, not a performance tweak.
  - Options:
    - a reviewed verdict cache keyed by the exact case bytes and its registry and anchor evidence;
    - a faster canonical encoder, held to byte parity with the current one;
    - a citation index maintained at save time.
  - The browser also downloads the full history, about 10 KB per citation (41 MB at 10,000 cases with 4,000 citations), when it
    prices a citation.
- **Reports index.** It returns every summary in one response: about 3.2 KB per case, so 32 MB at 10,000 cases. The
  helper verifies each summary against its case. Paging or a compact summary would need a reporting format decision.

## 20,000 cases (after the fix)

| Operation | Median |
| --- | --- |
| Open one case | 112 ms |
| New case save + summary | 617 + 304 ms |
| Filing update of a cited case | 394 ms |
| New initial citation | 30.6 s |
| `/citations/history` | 27.4 s, 82 MB |
| `/reporting/index` (warm) | 43.4 s, 64 MB |
| `/cases/list` | 284 ms, 1.9 MB |

The remaining linear costs above roughly double again from 10,000 to 20,000 cases.

## In the browser

The production pages were timed against the same folders:
- **Workspace:** from opening the page to the drawn Workspace.
- **Open saved case:** the shared case list in its dialog.
- **Reports:** first load and two refreshes.

In this environment the City parcel layer cannot be reached.

| Cases | Workspace opens | Open saved case list | Reports first load | Reports refresh | Reports JS heap |
| --- | --- | --- | --- | --- | --- |
| 5,000 | 0.5–0.7 s | 0.3–0.4 s | 45–48 s | 39 s | 45 MB |
| 10,000 | 0.5 s | 0.5–0.7 s | 90–99 s | 79 s | 48 MB |
| 20,000 | 0.5–0.6 s | 1.2–1.4 s | 171–194 s | 153–155 s | 141–150 MB |

Workspace opening does not depend on the size of the share.

Reports time was mostly two things:
- **The index request:** about 10, 21 and 41 s at the three sizes.
- **Parcel lookups:** 33, 63 and 123 sequential batches of 500 parcels, each waiting about 3 s on the unreachable layer,
  and repeated on every refresh because failures are not cached.

The browser's own processing was under 2 s at 5,000 cases. After two unreachable batches in a row, Reports now stops
looking up parcels for that load and says how many were not looked up (PR #553). Parcels already cached are
unaffected. With the City layer reachable, the first lookup is limited by the City service and later loads use the
cache; that timing could not be measured here.
