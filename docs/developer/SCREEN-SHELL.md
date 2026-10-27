# Screen-shell and CSS contract

The owner authorized consolidation Phase 8 on October 25, 2026: “Complete the screen-shell/CSS development.” This supersedes the earlier deferral. The scope is current screen-reference bookkeeping and unused screen CSS, with no intentional visible redesign. It does not authorize changes to approved-print-style.css, print/document goldens, legal wording or release trust.

## Reference and provenance

`tests/fixtures/screen_shell_reference.json` pins the complete Writer and Reports shells. `tools/screen_shell_reference.py` normalizes only the embedded application payload and current release label. Every remaining byte, including all screen CSS and bootstrap structure, is compared. It is a read-only checker; it has no reference-update option.

The before source is the verified PR #54 head `0343b4f0c36f7c43dc64704713325f74fc0676b9`, merged unchanged as `8ba102a14797263160437408d2d14c307845b1e8`. The reference records its clean-source verification digest, toolchain, before-shell hashes, frozen print-style hash and the passing legacy shell check. The old R50/R51 fixture and every historical print/document reference remain unchanged. The former per-release CSS reversal chain is superseded by this current screen contract; historical explanations remain in the R51 review.

`tests/fixtures/screen_shell_css.json` records removed classes, retained dynamic classes, selector decisions, source hashes and the semantic contract of surviving rules. The latter preserves selector/group/declaration order while ignoring only the approved unused selectors, empty groups and legacy spinner animation. Mixed selector lists keep their active branches.

## Candidate decisions

The old text inventory missed `case-view` and `queue-primary`: their names span adjacent literals after a dynamic expression. Both occur on Workspace screens and retain their styles. `tools/screen_css_usage.cjs` now reconstructs those literal runs and tests these false-positive cases. Other runtime/library families remain untouched.

The cleanup removes the other 31 reviewed class families from writer.css, reports.css, accessibility.css and screen-only ui-refresh.css rules. The obsolete toast `spin` keyframes and media groups made empty by removal are also removed. Approved print CSS is untouched even where it shares a class name. Source scanning, runtime class observations, surviving-rule contracts and before/after rendering are complementary evidence; absence in one scan alone is not proof.

## Browser evidence and future work

`tests/browser/screen_css.cjs` records candidate-class observations at every accessibility checkpoint. A removed class appearing in a running screen fails the browser gate. With `DW_SCREEN_SNAPSHOTS` set, it also captures synthetic UI DOM, form values, focus, viewport, theme and media state. These captures belong outside source; they contain no production records.

To review a screen cleanup:

1. Verify clean before-source and retain its production pages, stylesheets and verification record outside the checkout.
2. Run the normal browser audit with the pinned Python environment and `DW_SCREEN_SNAPSHOTS` pointing outside source. Keep browser runs serial; the helper needs the same installed dependencies as the full gate.
3. Review source references and dynamic names, then make the scoped CSS change. Retain active or uncertain classes.
4. Build the candidate and compare the captures with `tools/compare_screen_shell.cjs --before <before-pages> --after build/dist --snapshots <captures> --output <outside-source-evidence>`. Select the pinned Chromium with DW_BROWSER.
5. Review the exact reference/decision diff and record the actual comparison result. Reference changes require an explained screen change in the PR; never regenerate print goldens or silently strip styles to obtain a pass.
6. Run targeted local checks before PR submission and require the full GitHub gate on the current committed PR head before merge. Follow the development standard's review/merge policy, including asynchronous post-merge main verification.

The comparison tool replays identical captured DOM under before and after CSS, preserving form/focus/media state and checking all-element geometry, selected computed/pseudo styles and viewport PNG bytes. It repeats captures in forced colors. Shared animations/transitions are frozen and CSS caret hiding is requested to compare deterministic states; native forced-color caret painting can still vary; networking is disabled. Both sides use the same stylesheet repaint path. Failure artifacts include the media mode so normal and forced-color images cannot overwrite each other. See SCREEN-VISUAL-REVIEW.md for the technical review of the original differences. Exact PNG differences are saved for inspection and make the comparison command exit unsuccessfully, even if computed styles and geometry match; native form-control rasterization can vary and must be disclosed with a same-CSS control rather than hidden by a tolerance. This tests captured screen styles, not application execution inside the replay. The actual browser workflows separately cover keyboard navigation, focus, dialogs, responsiveness, themes, reduced motion and PDFs. Native City/Windows, staff, legal and accessibility acceptance remain separate.

Run `python tools/screen_shell_reference.py` to check a production build. `audit_screen_shell.py`, `audit_screen_css.js` and the current-shell assertion in `audit_r51_layout.py` protect this contract. Application JavaScript changes continue to be tested through behavior, projection, security, browser and exact-print checks, rather than a whole-bundle hash.
