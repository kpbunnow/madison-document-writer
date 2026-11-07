# R75 accessibility follow-up (development, no release)

Baseline: main `791228d` (PR #457), release identity unchanged (R75, helper 2026.11.06.76). This follows `R75-ACCESSIBILITY-REVIEW.md`. It is development evidence, not a WCAG conformance statement and not City acceptance.

Toolchain used for this pass (a cloud Linux machine, **not** the pinned CI toolchain): Python 3.14.6, Node 22.22.0, Chromium 141.0.7390.37. GitHub's Full gate on the exact PR head remains the authority; the pinned Chromium/Playwright differ and may paint slightly differently.

## 1. Remaining axe manual-review items (Workstream 1)

The production browser audit still records zero automated violations over 297 checkpoints and the same manual-review totals as before: `color-contrast` 96 and `label-content-name-mismatch` 126 rule/checkpoint occurrences (1,369 and 704 nodes). `aria-prohibited-attr` stays at zero.

Method: `DW_AXE_DETAIL=1` (new, off by default; `tests/browser/audit_browser.js`, `tests/browser/axe_measure.cjs`) records every node axe could not decide and, for contrast, measures the painted result in the real page: the element's text is made transparent, the pixels under each text line are captured, and the text color (with ancestor opacity) is composited over every pixel. A screenshot is kept for every failure. This is evidence capture only; it asserts nothing and suppresses nothing.

Axe's reasons for the 1,369 contrast nodes: element partially obscured 1,118, non-BMP character 90, short text 75, background gradient 34, element obscuring another 32, background overlap 13, equal ratio 7. 1,313 distinct selector/checkpoint pairs were measured (976 pass, 66 edge-pixel only, 210 below minimum before triage); 61 pairs were outside the viewport and were not measured.

### Contrast disposition

| Group | Result | Disposition |
| --- | --- | --- |
| Row controls: reorder grip, Move up/down, Location heading, Remove (Writer editor) | Real. Revealed on row hover at opacity .6 (2.75:1) and .75 on narrow screens (3.77:1) on white paper | **Fixed.** Enabled controls show at full opacity (6.8:1); disabled ones stay dim (exempt, and the cue) |
| Reports count link on its shaded bar, dark and system-dark theme | Real. #a4d5ff on the bar measured 4.31:1 | **Fixed.** #cde8ff, 5.3:1. Light theme measured 6.9:1 and was already fine |
| Reports link underline, first measurement 4.07:1 | Measurement error (the decoration was sampled as background) | Corrected in the tool; light theme passes |
| Setup/health table caption and column headers on the dark panel | Painted text (145,157,168) on (18,49,75) = 4.85:1 | Pass, with little margin; the computed `color` differs from the painted color, cause not isolated. Re-check at City |
| Rail Theme control, saved-work hint, queued-save summary, deposit table cell, proof-detail list, citation labels, Workspace rail item | Pixel check of the saved screenshots: 5.2 to 21:1 | Pass; the low figures came from other text or native-control paint inside the sampled box |
| `.blank` fill-in line | Transparent text by design (paper form blank) | Not applicable |
| Leaflet zoom `−` glyph (`aria-hidden`) | Third-party control | Not applicable to this code; retained |
| 30 decorative `→` arrows (`aria-hidden="true"`) | All measure as passing | Decorative, hidden from assistive technology, redundant with the control text |

Not resolved: the 61 off-screen pairs, the unexplained color difference above, and the shortcomings of single-pass pixel sampling (anti-aliasing, native `select` paint). Windows high contrast, other monitors and real backgrounds still need City review.

### Label in name (126 checkpoint occurrences, 704 nodes)

All nodes are symbol-only controls (message dismiss ×, Remove ×, ↑, ↓, location-heading ⎷, reorder ⠖, Remove copy ×, third-party map zoom +/−). Their visible text is a symbol, not a text label, so WCAG 2.5.3 does not apply, and each has a descriptive accessible name that starts with the action ("Dismiss message: …", "Move item 2 up", "Remove item 1"). Retained; the glyphs were not wrapped in `aria-hidden` merely to quiet axe. Voice-control and screen-reader confirmation stays with City acceptance.

## 2. Regression coverage added

`tests/browser/browser_accessibility.js`: enabled row controls of the hovered row (and all on narrow widths) must measure 4.5:1 on white at 1280, 683 and 320 px; the Reports count link must keep 4.5:1 on its bar in light, dark, high, system-dark and system-light. Both checks were run against the unfixed CSS and fail (1280 px row controls at opacity .6; Reports dark at 4.31:1) and pass with the fix.

CSS changed only inside the appended screen block of `ui-refresh.css`; the stylesheet's frozen prefix and official document/print styles are untouched. Before/after evidence: the saved failure screenshots, and the 4.31 / 2.75 / 3.77 figures above.

## 3. Windows, assistive-technology and responsive acceptance (Workstream 2)

Not run: this environment has no Windows desktop, NVDA/JAWS, Narrator, or the City's supported browser. Nothing below is a pass.

| Area | State |
| --- | --- |
| Keyboard, focus, skip links, modals, Escape, focus after save, visibility above fixed bars | Automated coverage exists and passes; **pending** screen-reader and real-device walk-through (owner: City staff + IT) |
| Names, roles, reading order, tables, expanded state, filter/preview group names | axe zero violations; **pending** AT confirmation |
| Announcements (validation, save pending/success/failure, lookup progress/cancel, publication, warning history) | **pending** (timing, duplicates, missed-message recovery need a screen reader) |
| 200% text, 200%/400% zoom, 320 px reflow, WCAG text spacing | Chromium 141 automated checks pass (320 px, 200% root text, spacing override); **pending** real Windows scaling and 400% zoom |
| Themes, forced colors, reduced motion, non-color indicators | Automated theme and forced-color focus checks pass; **pending** Windows high contrast on real monitors |
| Targets (2.5.8), drag alternatives (2.5.7) | 24 px minimums and button alternatives covered; **pending** touch precision on a real touch device |
| Reports table alternatives, drill-down, exports, saved views | Covered by existing browser suites; **pending** AT |
| Help, errors, confirmation | Covered by existing suites; **pending** staff review |

WCAG 2.2 A/AA matrix: the criterion table in `R75-ACCESSIBILITY-REVIEW.md` stands. Every row there is "engineering evidence, City acceptance pending"; none is declared "pass" for conformance.

## 4. Generated PDFs (Workstream 3)

Audited with the program's real renderer command (`--headless=new --print-to-pdf`, `helper/server.py`), on the five-page synthetic citation from the browser audit:

- Text is selectable; fonts are embedded with Unicode maps.
- Tagged PDF: yes. Document title is the case number. Language: `en`.
- Structure is shallow: of about 600 structure elements, roughly 414 are `NonStruct`, 147 `Div`, 10 `P`, one `Table` with `TH`/`TD`, one `Figure`; **no heading elements**. The Figure's alternative text was not checked.
- The Playwright-generated copies in the evidence folder are untagged; they come from the test harness, not the production path, so they do not represent delivered PDFs.

Not done: reading-order review in a PDF reader, screen-reader navigation, all document families, continuation pages, corrections and historical reprints. Any improvement (heading roles, figure alternatives, outline) would touch official-document markup and issued bytes. **Proposal only, no change made:** an owner/legal-reviewed rendering boundary that keeps every existing issued PDF and golden byte-identical and applies only to newly issued documents, after which structure would be re-audited. Required before that: owner decision, compatibility review against the approved-print parity and integrity rules.

## 5. Interface simplification decisions (Workstream 4)

No functional removal. Decision record:

| Topic | Decision | Reason |
| --- | --- | --- |
| Saved work & connection panel, labels in Tools/Workspace/failure messages | Retain as is; **awaiting staff observation** before any label change | A canonical panel with contextual entry points already exists; no task-completion evidence yet that the duplicate card labels confuse |
| Editor Save/return, Review and Issue in header, editor and bottom mobile bar | Retain; **awaiting owner/staff testing** (desktop vs narrow vs scrolled vs virtual keyboard) | Different scroll positions justify repeated entry points; no observed failure |
| Four primary destinations; advanced administrator/recovery tools collapsed | Retain | Discoverability, recovery access |

## 6. City follow-up from the verification notes (Workstream 5)

Not reproducible or verifiable here; all remain open under their owners and are unchanged in the living acceptance record: persistent "Device save not yet confirmed" (needs the real browser/profile and storage state), the one skipped unclean-startup prompt (needs the trigger matrix with real browser state; `startSession` behavior is unit-covered), citation level UI (LVL-1), live SQL/import/open-case items (SQL-2 and OCL items), Python/install/native delivery items (PY-1), and CC presentation (retained as intended; no change). No acceptance entry was changed by this pass.
