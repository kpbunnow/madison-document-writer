# Reports and picker operation reads

The picker indexes current selected items once per render, retaining the first copy and the exact duplicate count. Each card obtains its retained edit from that map, then the existing deselected-item cache. The next render rebuilds it after in-place edits, array replacement or deselection. Catalog eligibility, effective wording, favorites, search and issuance authority still use their existing current owners. There is no cross-render policy cache.

Reports computes numeric-column flags and integer bar maxima together in one row pass. It eliminates repeated row/cell access and the spread of every row into Math.max (which also avoids argument-count limits for large results). Rendering, stable sorting, original drill indices, totals, formatting and export calculation remain in their existing owners. All 303 frozen owner comparisons, including ordered callback failures and exact workbook bytes, pass unchanged; 17 independent report facts remain unchanged.

## Matched diagnostic

Node 24.19.0, four alternating rounds, five warmups and 15 measured iterations per round: 60 samples per version/size, serial synthetic presentation-only work. Before source70cf504, after b38a305; exact picker/report output hashes match in every run. The clean harness/source controls and raw samples are retained outside source in result-read-measurement.json and profile_result_reads.cjs. These are module timings, excluding browser layout, City/SQL/network and Windows work.

| Draft items / report rows | Picker key reads before → after | Report row-array reads before → after | Picker median ms before → after | Report median ms before → after |
| ---: | ---: | ---: | ---: | ---: |
| 50 | 28,825 → 50 | 609 → 100 | 5.93 → 4.25 | 1.20 → 1.12 |
| 200 | 105,250 → 200 | 2,409 → 400 | 5.65 → 4.85 | 6.25 → 5.64 |
| 500 | 255,550 → 500 | 6,009 → 1,000 | 5.50 → 4.11 | 14.96 → 14.99 |

Each workload has 300 catalog results and ten report columns. Reduced picker selection reads are deterministic; timings are observations. Reports' largest workload is essentially unchanged, so no consistent report-time gain is claimed. The new regression independently checks full picker output/count/first-copy selection, edited/cache/current-policy changes and fresh report scales after replacing rows, alongside bounded reads. No threshold or existing assertion is relaxed. Further DOM/panel reuse requires its own measured focus/interaction review; this batch changes calculation overhead only.
