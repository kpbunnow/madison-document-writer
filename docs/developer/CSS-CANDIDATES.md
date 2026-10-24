# Unused screen CSS candidates

Consolidation Phase 3 (D5) inventory, October 23, 2026. **Candidates only; nothing was deleted.** The stylesheets are embedded in the HTML shell, whose bytes `audit_r51_layout.py` protects, and the optional Phase 8 screen-shell cleanup that could remove them was declined. `approved-print-style.css` is frozen and was not scanned.

## Method

Every class selector in the three screen stylesheets (comments and `url()` removed) was searched for as a whole word in `app/` (the stylesheets themselves excluded), `helper/`, `tools/` and `policy/`, after joining adjacent split string literals (`"n-headmai" + "n"`), which the source uses for long strings. Names matching only under `tests/` are listed as candidates: tests and frozen references are not application consumers. Runtime and library families (`st-*`, `message-*`, `leaflet-*`) were skipped, and stems were checked for string-built names (`"acc-" + x`, `` `acc-${x}` ``).

A whole-word miss does not prove a class is dead: a name can still be assembled from parts the scan cannot see. Before Phase 8 deletes any of these, confirm each in the running screens.

## Candidates

| Stylesheet | Classes scanned | Candidates (all referenced only under `tests/`) |
| --- | --- | --- |
| `app/assets/writer.css` | 289 | `acc-h`, `acc-off`, `acc-on`, `acc-other`, `acc-scroll`, `chipstrip`, `cnt`, `docpanel`, `doctab`, `doctabs`, `draftlist`, `draftrow`, `fin-email`, `gitem-head`, `gitem-ord`, `r26-reason`, `spin`, `voidtag` |
| `app/assets/accessibility.css` | 73 | `docpanel`, `doctab`, `edsel`, `map-controls`, `map-legend`, `storage-row`, `walk-card` |
| `app/assets/reports.css` | 71 | `chips` |

Joining split literals cleared four names a plain search would have flagged: `n-headmain`, `cit-idbar`, `picker-search` and `more-filters` are in use.

## Frozen stylesheets (not in scope)

The October 23 code review also named `metric-grid`, `case-flag`, `case-flags`, `case-view`, `case-extra`, `editor-preview-frame`, `editor-initial-options`, `queue-primary` and `spacer`. They have no application reference, but they are defined only in `approved-print-style.css` and `ui-refresh.css`, which feed the frozen print and shell parity references. They remain unchanged. Any future owner-approved screen-shell baseline may cover screen-only rules; Phase 8 does not authorize edits to `approved-print-style.css` or frozen print references. Print-style changes require a separate output-change proposal.
