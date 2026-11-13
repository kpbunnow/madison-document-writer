# Screen CSS cleanup decisions

The owner authorized Phase 8 on October 25, 2026. The current cleanup removes 31 unused screen class families and 6,020 stylesheet bytes. Approved print CSS and historical print/document references remain unchanged. See [SCREEN-SHELL.md](SCREEN-SHELL.md) for provenance, validation and the future reference-review workflow.

## Removed classes

`acc-h`, `acc-off`, `acc-on`, `acc-other`, `acc-scroll`, `chipstrip`, `cnt`, `docpanel`, `doctab`, `doctabs`, `draftlist`, `draftrow`, `fin-email`, `gitem-head`, `gitem-ord`, `r26-reason`, `spin`, `voidtag`, `edsel`, `map-controls`, `map-legend`, `storage-row`, `walk-card`, `chips`, `metric-grid`, `case-flag`, `case-flags`, `case-extra`, `editor-preview-frame`, `editor-initial-options`, `spacer`.

The four affected files are writer.css, reports.css, accessibility.css and ui-refresh.css. Mixed selector lists retain their active branches and declaration order. Empty media groups and the obsolete toast spinner keyframes are removed. The machine-readable per-file decisions and hashes are in `tests/fixtures/screen_shell_css.json`.

## Retained classes and inventory correction

`case-view` and `queue-primary` were active Workspace classes at the original Phase8 review. The previous text inventory incorrectly marked them unused because their names span adjacent literals following dynamic expressions. Both source reconstruction and runtime observation confirmed their use then. The later owner-approved redesign retired case-view; its rules are removed by the November13 improvement-plan review, while queue-primary remains active. The new source scanner has regression cases for this pattern.

Runtime/library families (`st-*`, `message-*`, `leaflet-*`) and uncertain dynamic stems remain outside the removal decision. Rules in approved-print-style.css remain untouched even when they share a removed screen class name.

## Evidence and future changes

The before source passed the full gate and the legacy screen-shell assertion. The complete browser workflow captured 288 synthetic UI checkpoints; none used the 31 removed classes. The surviving CSS rule contract is unchanged, preserving group, selector and declaration order. Current-shell and source/runtime class guards now protect the decision. Before/after comparison and the final full gate are documented in the development PR; pixel differences must be reported rather than hidden by tolerance or reference updates.

A source search alone does not prove that CSS is unused. Before a future removal, reconstruct split literals, inspect dynamic stems, observe the running screens and compare surviving rules and rendering. Keep active or uncertain rules. Screen reference changes require an explained review; print changes require a separate output-change proposal.

## Improvement-plan follow-up, November13

Current source reconstruction and306 live captures confirm six further retired families: case-view, queue-summary, queue-summary-button, queue-reason, queue-secondary and queue-filter-note. Remove their17 dead screen rules, preserve the active branch of the mixed queue-primary selector and remove the newly empty media group. This reduces ui-refresh.css by1,775 bytes with identical surviving-rule semantics. Keep active queue-detail-task, queue-support and all case-document families. See SCREEN-CSS-MAINTENANCE.md for complete comparison evidence and ordinary-edit review guidance.
