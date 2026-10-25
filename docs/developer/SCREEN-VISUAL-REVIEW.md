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
