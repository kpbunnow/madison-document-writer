# Workspace, editor and Reports controls

Owner-approved screen consolidation, November 22, 2026, from main
`bc4eed19635ccdbdb72b89d56b2993c179c40b16` (PR #544).

## Presentation ownership

- `workspace_rows.js` puts each case's drafts directly below its descending issued-document links. Case options
  retains secondary tasks and record diagnostics. Missing dates are described as unassigned; closed cases have no
  outstanding deadline. Document sorting, task precedence, proof checks and case removal safeguards are unchanged.
- `editor_screens.js` renders one responsive control area with the real Recipients, Violation Items, Review,
  next-issue, save/return and primary-action controls. It replaces the repeated header and mobile proxy buttons.
  `editor_events.js` retains review/command routing; ordinary primary actions keep their original IDs and handlers.
  The citation panel keeps history refresh while saving uses the shared control area. Modal save controls remain
  available within their own modal task.
- Task indicators describe existing required checks. They do not authorize issuance or claim that a task was
  reviewed. The complete Review dialog and final issuance validation retain their authority. Indicators update in
  place so a focused task button is not replaced.
- The control area sticks while scrolling and becomes ordinary flow content when an editing field has focus,
  avoiding field/virtual-keyboard obstruction. It is screen-only and contains the current device-save state.
- `reports_screens.js` groups report choice, dates and Refresh data. Report choices use existing `data-screen`
  navigation and its focus/state handling. Filters still update automatically; no Run step is added. Area and
  specialist scope share More filters; applied filters stay visible. Export/print and saved views remain beside
  the title. Report calculations, coverage warnings, sort and CSV/workbook/print scopes are unchanged.

## Verification and screen references

The full baseline production browser audit passed with 309 accessibility checkpoints and retained synthetic DOM
captures. Current application screen CSS changes are intentional: responsive control positioning, task indicators,
draft grouping, and the report chooser. `ui-refresh.css` and `reports.css` own those rules; the approved document
print stylesheet, legal wording and historical print/document references are unchanged.

Review the actual desktop and phone layouts alongside the retained baseline. The strict CSS replay uses the old
captured DOM and can therefore show retired controls under new CSS; it cannot establish execution equivalence for
changed markup. Intentional style/geometry differences are reviewed, not normalized or tolerated away. Current
shell and semantic reference revisions record only this explained screen change, retaining earlier provenance.

The strict replay completed 33 screen/media comparisons: the first 32 retain style/geometry parity, then it refuses
the picker capture because the editor toolbar behind the unchanged modal deliberately has new positioning, padding
and border geometry. Both retained images were reviewed. This is not a full replay or a pixel-parity pass. Actual
new-markup desktop/phone screens and the refreshed 25 manual media items are reviewed separately. All 69 historical
authored print variants retain their exact content, with overflow, clipping and missing-copy mutation detection.

Targeted tests retain save failure/refusal, single issuance, complete Review contents, focus return, next-issue
navigation, live save state, document ordering/proof changes, report sorting/export behavior and structural module
boundaries. Browser checks exercise the single controls at desktop/760/390/320px, sticky clearance, editing focus,
target sizes, overflow, issued-document menus, report selection and themes. The full required GitHub gate must pass
on the exact PR head before merge. Synthetic checks do not establish City or manual assistive-technology acceptance.
