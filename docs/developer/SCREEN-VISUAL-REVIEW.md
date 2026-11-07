# Screen PNG difference review — October 25, 2026

Technical review of the Phase 8 PNG evidence is complete. No confirmed CSS/content/layout regression was identified. The observed changes are tiny rounded-edge antialiasing differences and blinking input carets. Exact PNG equality still fails and is not claimed. This record does not supply native Windows/City, accessibility or staff acceptance.

## Evidence reviewed

The original before source is PR #54 head `0343b4f0c36f7c43dc64704713325f74fc0676b9`, merged unchanged as `8ba102a14797263160437408d2d14c307845b1e8`. Phase 8 preserved all surviving CSS rules and all 576 computed-style/geometry comparisons matched; 54 image comparisons differed. The original same-CSS control reproduced 53 of those 54 cases. These remain historical results, not a new all-576 replay.

The 54 failures had only 47 retained image pairs because the original comparison tool used one filename per snapshot: a forced-color failure could overwrite that snapshot's normal-mode failure images. The original report retains hashes for all checks, but seven separate mode-specific image pairs cannot be recovered from those files. This was an evidence-tool defect, not a program CSS defect. Failure filenames now include the media mode, and report rows record their artifact prefix.

All 47 retained before/after pairs were inspected using bounding-box crops, difference images and contact sheets. Each pair differed in 5–85 pixels. Forty-one pairs change at most one or two RGB levels at rounded borders/outlines (including banner/dialog edges); six show a vertical caret in a focused input. No changed wording, missing content, shifted layout or resized control was identified. Rectangle-only classification is insufficient: rounded banner corners and focus outlines extend beyond native control boxes.

## Fresh affected-state replay and same-CSS control

The same 47 captured synthetic DOM snapshots were replayed in normal and forced-color modes, using the retained pre-cleanup pages and the current post-cleanup CSS. Application JavaScript is not executed in this replay. No application stylesheet or screen reference changed in the Reports increment. The second run used the identical before CSS on both sides. Runs were serial on Chromium 145.0.7632.6.

| Check | Before/after CSS | Identical before CSS control |
| --- | ---: | ---: |
| Screen/media combinations | 94 | 94 |
| Computed-style/geometry differences | 0 | 0 |
| Exact PNG mismatches | 50 | 52 |

All 50 before/after mismatch cases also failed the same-CSS control. Forty-nine had identical paired image hashes in both runs. The control's two additional failures and the changing caret result demonstrate capture variability; they are not a pixel-parity pass. Every failed row's separate before/after image was verified against its report hash, and all 94 artifact prefixes were unique in each run.

No tolerance, masking, print golden update, screen-reference replacement or assertion relaxation was used. Both replay commands exit unsuccessfully because exact PNG comparison remains strict. The review recommends retaining the application styles and treating these particular differences as browser paint/caret variability, with native/staff acceptance still open. A future mismatch that changes geometry, content or a larger image region needs a fresh investigation; this is not a blanket exemption for PNG failures.

CSS caret hiding is requested by the replay, but native forced-color caret painting is not reliably frozen. Shared animations/transitions are frozen. A same-CSS control and manual image inspection remain necessary before attributing a difference to paint variability.

## Reproduction and retained local evidence

Use the workflow in [SCREEN-SHELL.md](SCREEN-SHELL.md), with the original 47 affected snapshots and retained pre-cleanup pages. Run `tools/compare_screen_shell.cjs` once with pre/post CSS, then again with the same before directory on both sides. Keep browser work serial. Snapshots, pages and screenshots are synthetic local evidence outside maintained source; they are not shipped with the program or attached automatically to GitHub.

- Original comparison report SHA-256: `a6a14a015dc4b20d15a398d94f9c3dd42b3016016d335cb698248922e50dd119`.
- Fresh replay report SHA-256: `fa62f5939cde49a074eeeb60ff94a5d1b0c681af0745cbf23a4f7875686cae0e`.
- Fresh control report SHA-256: `3f3fd7b981b96af188455592328937693c1aa804cd33e4296a5f4e96ca7219df`.
- Local original evidence: `/tmp/screen-shell-phase8/comparison-complete/`.
- Local fresh evidence/contact sheets: `/tmp/reports-boundary/visual/` (`replay`, `control`, `compare-0.png` through `compare-3.png`).

## Original retained pairs

The table identifies the saved pair by the media mode whose image hashes matched the original report. It does not imply that overwritten mode images were inspected.

| Snapshot | Screen | Forced colors | Changed pixels | Maximum RGB delta | Inspection |
| --- | --- | --- | ---: | ---: | --- |
| 023 | review | none | 63 | 1 | Rounded-edge antialiasing |
| 024 | correction-review | none | 25 | 1 | Rounded-edge antialiasing |
| 028 | reports | none | 16 | 2 | Rounded-edge antialiasing |
| 029 | reports-dark | none | 13 | 2 | Rounded-edge antialiasing |
| 031 | reports-system-dark | active | 8 | 1 | Rounded-edge antialiasing |
| 032 | reports-openCases | none | 37 | 2 | Rounded-edge antialiasing |
| 033 | reports-byInspector | none | 40 | 2 | Rounded-edge antialiasing |
| 034 | reports-openViolations | none | 16 | 2 | Rounded-edge antialiasing |
| 035 | reports-allCases | none | 40 | 2 | Rounded-edge antialiasing |
| 036 | reports-allViolations | none | 40 | 2 | Rounded-edge antialiasing |
| 037 | reports-daysToCompliance | none | 40 | 2 | Rounded-edge antialiasing |
| 038 | reports-repeatOwners | none | 40 | 2 | Rounded-edge antialiasing |
| 039 | reports-citations | none | 40 | 2 | Rounded-edge antialiasing |
| 040 | reports-overriddenDeposits | none | 40 | 2 | Rounded-edge antialiasing |
| 041 | reports-referrals | none | 40 | 2 | Rounded-edge antialiasing |
| 042 | reports-documentActions | none | 40 | 2 | Rounded-edge antialiasing |
| 053 | required-deposit-step | none | 19 | 1 | Rounded-edge antialiasing |
| 075 | conflict-review | active | 16 | 255 | Input caret |
| 086 | csv-openCases | none | 27 | 2 | Rounded-edge antialiasing |
| 087 | csv-byInspector | none | 40 | 2 | Rounded-edge antialiasing |
| 088 | csv-openViolations | none | 27 | 2 | Rounded-edge antialiasing |
| 089 | csv-allCases | none | 40 | 2 | Rounded-edge antialiasing |
| 090 | csv-allViolations | none | 40 | 2 | Rounded-edge antialiasing |
| 091 | csv-daysToCompliance | none | 40 | 2 | Rounded-edge antialiasing |
| 092 | csv-repeatOwners | none | 40 | 2 | Rounded-edge antialiasing |
| 093 | csv-citations | none | 40 | 2 | Rounded-edge antialiasing |
| 094 | csv-overriddenDeposits | none | 40 | 2 | Rounded-edge antialiasing |
| 095 | csv-referrals | none | 40 | 2 | Rounded-edge antialiasing |
| 096 | csv-documentActions | none | 40 | 2 | Rounded-edge antialiasing |
| 097 | shared-report-views | active | 5 | 2 | Rounded-edge antialiasing |
| 126 | r33-overridden-deposits | none | 40 | 2 | Rounded-edge antialiasing |
| 129 | r32-measurement-dialog | none | 17 | 1 | Rounded-edge antialiasing |
| 135 | r31-address-preview | none | 78 | 1 | Rounded-edge antialiasing |
| 197 | r48-common-reports-system-dark | active | 18 | 1 | Rounded-edge antialiasing |
| 202 | r48-applied-filters | none | 85 | 2 | Rounded-edge antialiasing |
| 203 | r48-applied-filters-dark | none | 72 | 2 | Rounded-edge antialiasing |
| 205 | r48-applied-filters-system-dark | active | 33 | 1 | Rounded-edge antialiasing |
| 207 | r48-map-table-alternative | active | 5 | 2 | Rounded-edge antialiasing |
| 217 | r48-deposit-phone | active | 14 | 255 | Input caret |
| 218 | r48-reports-phone | none | 7 | 1 | Rounded-edge antialiasing |
| 219 | r47-admin-review | none | 11 | 2 | Rounded-edge antialiasing |
| 220 | r47-admin-review-dark | none | 10 | 1 | Rounded-edge antialiasing |
| 222 | r47-admin-review-dark | none | 10 | 1 | Rounded-edge antialiasing |
| 227 | r47-all-language | active | 16 | 255 | Input caret |
| 228 | r47-all-language | active | 16 | 255 | Input caret |
| 229 | r47-all-language-high | active | 16 | 255 | Input caret |
| 230 | r47-all-language-system-dark | active | 16 | 255 | Input caret |

## Import table maintenance review — 2026-11-03

The owner requested extraction of the open-case table's inline no-wrap/link styles and removal of retired spreadsheet styles. The before source is clean main `1a8c5335accc365815220b092cc35bea06189a56` (R71). Its normal production browser audit passed and captured 288 synthetic screens; local Node 24.19.0, Python 3.12.14 and Chromium 154.0.8037.57 were used.

The candidate moves identical declarations to `writer.css`, removes `.acc-drop` (including `.over`) and the inactive `.import-alternative > summary` selector, and retains the active selectors in that mixed group. A semantic comparison excluding only those retired selectors and the new table rules confirms every unrelated declaration and cascade position is unchanged. The CSS decision reference records the before/after hashes and common surviving-rule digest; the shell reference records the reviewed new hashes while retaining original provenance and payload/release-only normalization.

The normal/forced-color replay completed 576 checks with zero computed-style or geometry differences and 53 PNG mismatches. The same-CSS control replayed the 46 affected snapshots (92 checks), also with zero style/geometry differences and 50 PNG mismatches. These small native painting differences are disclosed; the broad replay is not claimed as exact PNG parity. A separate paired-markup replay removes the old inline declarations and applies the actual new classes in six captured-table variants (desktop/mobile, light/dark, disabled and focus). All 12 normal/forced-color checks have exact style, geometry and PNG parity.

The existing browser assertion for no-wrap cells remains unchanged. Screen-reference and stylesheet guards, the layout contract and open-case owner tests pass. Approved print CSS, historical print/document goldens, wording, release identities and legal/City/native acceptance are unchanged. Comparison evidence is retained outside source in the development workspace; the PR records actual outcomes and the combined GitHub gate.

## Open-case due date column review — 2026-11-03

The owner requested a Due column at the right of each inspector open-case bubble. The before source is clean main `59669f5879800d77a837cb7f1547e3e4ee4a5ced`. The change adds four `.open-case-list` rules to `writer.css` (row layout, main block, due column, due label) and changes the bubble markup; no existing rule is edited, removed or reordered, so the surviving-rule digest of the previous stylesheet is recorded unchanged in the CSS decision reference. The normal production browser audit passed and captured 288 synthetic screens; local Node 24.19.0, Python 3.12.14 and the pre-installed Chromium were used.

Only the captured open-case-list screen with bubbles (snapshot 285, three cases) differs, and it cannot replay exactly because the markup and CSS both changed deliberately: the replay tool stops there, and its evidence shows 52 changed elements — only the `.open-case` buttons and their `.open-case-main` / `.open-case-due` spans (row layout, the due column at the right edge, 96 px wide) plus the 21 px taller list and the resulting vertical shift of the content below it; no other element's computed style changed. The other 307 snapshots were replayed separately in normal and forced-color modes: the 268 snapshots without open-case markup (536 checks) and the 19 other snapshots that name the open-case list but show no bubbles (38 checks) have zero computed-style or geometry differences, with 55 and 1 PNG mismatches. A same-CSS control on the 46 snapshots behind the 55 mismatches (92 checks) shows the same kind of native painting difference (49 mismatches, zero style/geometry differences), so these are disclosed rather than claimed as exact PNG parity.

The shell reference records the new Writer page hash with the previous one as before (Reports is unchanged); the CSS decision reference records the new stylesheet hash and surviving-rule digest. Approved print CSS, historical print/document goldens, release identities and legal/City/native acceptance are unchanged. Comparison evidence is retained outside source in the development workspace; the PR records actual outcomes and the combined GitHub gate.

## Playwright / Chromium maintenance review — 2026-11-05

This dependency-only change moves Playwright 1.58.2 / Chromium 145.0.7632.6 to Playwright 1.64.1 / Chromium 156.0.8078.4. Node 24.19.0 and Python 3.14.10 were used. No application stylesheet, shell reference, print golden, approved wording or release identity changes. Both versions passed the complete production browser audit (291 accessibility checkpoints and their workflows). All 69 historical print variants retained identical page counts and authored-content hashes.

The same 291 captured synthetic DOM states were replayed in normal and forced colors, 582 comparisons per browser. Cross-browser element geometry is identical in every comparison. Computed styles differ in all 582: the captured differences are the browser's default width of a `none` outline (0 to 3 px), select overflow (visible to clip), colors of zero-width table borders and unpainted option pseudo-elements, option text colors, and native input corner serialization. No application CSS was changed to override these browser defaults. The actual browser workflows separately pass focus, keyboard, themes, responsive layout and accessibility checks.

Decoded viewport pixels differ in 91 cross-browser comparisons. These are not all small antialiasing changes: the largest difference is the mobile deposit-schedule replay, where the old browser painted the lower page black despite its computed styles and the new browser paints the intended light surface with readable text. The adjacent mobile Reports replay changes a bottom surface, and forced-color numeric-input frames/focus outlines differ. The deposit, Reports and forced-color measurement screen pairs were inspected directly; their content, dimensions and controls remain intact. This is a technical dependency review, not staff or native Windows acceptance.

Same-CSS control runs have zero style/geometry differences in each browser, but 58 old-browser and 57 new-browser raw PNG differences. The original exact-image assertions remain unchanged and these diagnostic replay commands exit unsuccessfully; neither control nor cross-browser replay is claimed as exact PNG parity. All 582 mode-qualified captures and comparisons per browser, decoded-pixel counts/bounds, computed-style classifications, production audit results and print comparison are retained outside source under the maintenance evidence directory. No tolerance, reference regeneration or assertion bypass was introduced.

## R75 accessibility and readable typography — 2026-11-06

The owner explicitly requested WCAG 2.2 improvements and consistent, user-friendly screen fonts/sizing. Baseline main is `431c45b3dc9c20d83df80cbf5c172161fad562ab`; its complete production browser audit passed 292 accessibility checkpoints with pinned Node 24.19.0, Python 3.14.10, Playwright 1.64.1 and Chromium 156.0.8078.4. The candidate appends screen-only styles for relative typography, contrast focus rings, pointer targets and mobile wrapping/focus clearance. The previous 47,055 stylesheet bytes are unchanged (SHA-256 `ff7edd74419074db45e487741ea5a53a87460f121a02c6e16db058312d24a921`). Existing print CSS and historical goldens are unchanged.

The requested visual changes deliberately change geometry and pixels. The strict comparison stops on the first Workspace screen; it remains unchanged and this is not a parity pass. A separate diagnostic replay examines 12 representative desktop/mobile Writer/Reports DOM captures, with no body overflow or clipped measured screen controls. Before/after Workspace, recipients, mobile notice and Reports screenshots were reviewed; mobile navigation/section choices wrap visibly and paper retains its document styling. Actual production tests separately exercise keyboard focus, themes/forced colors, resizing/reflow, text spacing and dialog lifecycle. The current screen references record this explained change while retaining historical provenance. See [R75-ACCESSIBILITY-REVIEW.md](R75-ACCESSIBILITY-REVIEW.md) for the notes disposition, criterion coverage, verification and outstanding City/manual acceptance. Neither this review nor axe supplies a complete WCAG conformance claim.
