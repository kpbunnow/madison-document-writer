# Large Workspace opening performance

The November 6, 2026 profile identified repeated full-document filtering as the main browser CPU cost when restoring and presenting a large retained Workspace. The 3,000-case fixture contains 12,000 documents after replay, including 3,000 private drafts, three issued snapshots per case and 600 draft worksheets. `docsFor` dominated the sampled CPU time.

The Workspace now groups documents once per synchronous screen calculation and shares ordered per-case arrays with case status, worksheet lookup, task presentation and row rendering. Standalone operations still read the current workspace. No grouping survives a render or await. Document objects retain their references; bucket arrays are copied for callers. Filtering, order, labels, actions and all cases remain visible as before.

Startup sequencing, mandatory reads, integrity checks, shared case resolution, PDF checks, pending-save flushing and session-clear decisions are unchanged. No data is treated as absent, hidden or verified to improve timing. There is no persistent cache, lazy integrity check or delayed readiness requirement.

## Initial measurements

Three serial trials per size used Node 24.19.0 and pinned Playwright 1.64.1 / Chromium 156.0.8078.4 on the same Linux executor. These are medians in milliseconds, comparing main `53cf620` with the optimized working tree:

| Cases | Opening before | Opening after | Workspace refresh before | Workspace refresh after |
| --- | ---: | ---: | ---: | ---: |
| 100 | 195 | 163 | 28 | 16 |
| 1,000 | 1,150 | 575 | 653 | 125 |
| 3,000 | 6,703 | 1,489 | 4,886 | 514 |

Opening includes navigation/reload, actual IndexedDB restoration, event replay and startup until Writer reports ready. Refresh measures the synchronous production render; the harness also waits for two animation frames. One trial at the largest size includes CPU sampling in both versions. Timings vary with machine load and are observations, not guaranteed service levels. The synthetic helper is unavailable to isolate browser work; these numbers do not measure City SQL, shared storage, network latency or native Windows performance.

The deterministic regression independently counts document identity reads at 500 cases/2,000 documents: the original main performs **12,000,000**, versus **4,500** in the optimized screen calculation. It also checks document order, live replacement and mutation, pending-save priority and failure isolation. It does not claim every Workspace operation is linear: other live queries and DOM creation still have costs.

## Repeat the profile

Build production output with the frozen dependencies, then run serially:

```sh
python3 tools/build.py
node tools/profile_workspace_opening.cjs candidate
```

The diagnostic creates only isolated browser profiles and synthetic IndexedDB workspaces, serves the existing production HTML on loopback, and writes JSON timings plus a Chromium CPU profile under `build/workspace-profile/`. It checks restored case/document/worksheet counts, displayed row count, retained draft text and browser errors. The JSON records the Git commit/clean state, production HTML hash, Node and Chromium versions. This is profiling evidence, never Full-gate or release approval.

Optional environment variables:

- `PROFILE_SIZES=100,1000,3000`: positive case counts, at most 10,000 per fixture.
- `DW_PROFILE_OUTPUT`: an output folder outside source or under ignored `build/`.
- `DW_PROFILE_HTML`: an existing control HTML build to compare with the candidate under identical browser settings. Its content hash is recorded separately from the checked-out source identity.

Keep measured browser runs serial. Retain raw trials and CPU profiles; compare identical fixture sizes and toolchains. Do not replace this workload with operational City records.

## Verification boundaries

The existing exact Workspace HTML and case-status parity suites remain unchanged. A real production-browser startup scenario restores 1,000 cases/4,000 documents from IndexedDB, checks that durable bytes remain unchanged, filters to a case and opens its private draft. Earlier startup scenarios retain the real helper, readiness/save barrier, failed-read refusal, reload/retry and accessibility checks.

The complete exact-head GitHub Full gate, PR format and applicable native recovery checks remain required before merge. Release/format identities, issued history, approved wording, frozen screen/print references, dependency locks and City acceptance remain unchanged. No release packaging or deployment is part of this work.
