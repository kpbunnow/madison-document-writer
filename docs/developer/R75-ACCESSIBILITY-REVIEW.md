# R75 accessibility and verification-notes review

Reviewed baseline: main `431c45b3dc9c20d83df80cbf5c172161fad562ab` (R75, PR #456). The owner requested an assessment of the November 6 verification notes, WCAG 2.2 improvements, consistent readable screen typography and recommendations for simplifying the program. This is development under the existing release identity, not a release or City acceptance decision.

## Disposition of the supplied notes

The supplied `r75-verification-findings-2026-11-06.md` describes a synthetic Linux rig. Its successful tests support those scenarios; they do not replace the living City acceptance record.

| Observation | Review and action |
| --- | --- |
| Unparenthesized multi-exception syntax | Valid PEP 758 on Python 3.14; the current build/launcher/CI already require that interpreter. No syntax repair. City Python installation/upgrade remains PY-1. Frozen dependency installation remains required; the rig's ad hoc package installation is not a replacement development procedure. |
| PO Box Violator/Copy acceptance, registered-agent street-only refusal, recipient retention | Matches current recipient policy and retained regression coverage. No address-policy change needed. The rig's successful PDF is useful synthetic evidence; City acceptance remains separate. |
| Citation levels | Helper pricing/override evidence is consistent with the current rules. The City should still exercise First/Second/Third and Automatic on a real imported draft, including clearing the override. Do not expose pricing changes in corrections or remove legal holds. |
| Import window, typed-number retention and Exit | Current implementation matches the described behavior. Live SQL, one-inspection selection and failed connection handling still need the City environment. |
| Seven-day date spacing | Existing browser/helper checks and reported refusal agree. Retain historical/correction exceptions and unchanged outstanding deadlines. |
| No-Chrome filing refusal and retry | Valid evidence for the missing-browser route. It does **not** by itself prove cleanup after an already allocated PDF or a failed viewer handoff. Keep the separate publication/long-session regressions. |
| Correct/Withdraw unavailable explanation | Current derived state explains the inspection dependency and restores actions after discarding an unfinished worksheet. No change needed. |
| Exit clearing, reload retention and later unclean restart | Matches existing session-close rules. R75 also catches startup-clear failures and preserves work with a named warning. One skipped startup dialog in the rig was not isolated; it is not a reproduced defect. Further City testing should record the helper instance, prior open marker and retained-work state, without collecting session secrets. |
| CC capitalization/punctuation | Accepted recipient lines are intentionally retained; mailing-block normalization is separate. No global rewrite of historical CC text or renderer is appropriate. A future change should be confined to newly accepted addresses and explicitly reviewed for legal/history compatibility. |
| No correction-reason character count | Improved: all limited textareas receive a visible, accessible `used / limit characters` description. Native maxlength, validation, stored data and labels remain unchanged. Programmatically over-limit text is identified, never silently truncated. |
| OCL-7 pick during lookup | Current acceptance record already specifies cancellation/replacement. Added a visible sentence explaining that choosing another case cancels the running lookup and starts the new one. No network behavior change. |
| Correction draft thought lost, then found | The report corrects its initial conclusion. Workspace's Continue correction remains the recovery route; do not discard autosaved corrections. |
| Save in the corrective-action dialog | Explicit Save commits; Escape cancels. No implicit-save behavior change. |
| Device save not yet confirmed | A persistent warning deserves a City reproduction with the actual browser storage state and an independently confirmed save/reload. The notes alone do not establish whether the save was refused, pending or unconfirmed. Do not suppress an honest durability warning. |

## Implemented screen improvements

- A shared Segoe UI / Arial / sans-serif family and relative scale for Writer and Reports screen chrome: body and form controls 1rem (normally 16px), labels/buttons/table text and hints .875rem (14px), secondary metadata .8125rem (13px), badges .75rem (12px), headings 1–1.5rem. Case identifiers, breadcrumbs, quick-date labels and keyboard hints also use the relative secondary scale. All scale with the user's root font size. Document/paper typography and intentional monospace identifiers remain purpose-specific.
- Defined the missing `--focus` variable: previously a focused editor heading computed no outline; pale button rings had insufficient contrast on light surfaces. Dark/light/paper contexts now receive contrasting rings, and forced colors use the operating system's Highlight color.
- Extended minimum 24px checkbox/radio targets to utility/overlay controls. Existing due-date checkboxes were already 24px; no improvement to their original size is claimed.
- Wrapped mobile navigation into visible choices and the editor section menu onto multiple rows. No destination or command is removed. Added focus scroll clearance and bottom space for the fixed mobile action bar.
- Added character counts through the existing accessibility observer, with one local input listener per field and weak ownership. Moving/reusing a field restores its connected description without duplicating listeners. Closing dialogs allows their fields and listeners to be collected. Existing enhancement ordering and 172 native DOM comparisons remain intact.

These changes deliberately increase text size and alter screen layout. They are not a CSS/PNG parity cleanup. Current screen-shell and stylesheet decision references are updated with explicit before/after provenance; historical print/document references, approved print CSS, identities, records, security and legal wording are unchanged.

- Gave the named Reports applied-filters and initial-citation-preview containers a group role through the existing screen accessibility observer. Generic divs previously carried names that assistive technology could ignore. Frozen markup templates remain unchanged; both roles are checked in the real observer regression, and Reports is checked in Chromium.

## WCAG 2.2 AA review coverage and limits

This is an accessibility engineering review, not a declaration of complete WCAG conformance. Automated rules cover only part of each criterion. The City still needs assistive-technology and actual staff workflow acceptance, including imported/issued documents, native PDF delivery and Windows display settings.

| Area / criteria | Evidence and remaining acceptance |
| --- | --- |
| Semantics, labels, tables and instructions (1.1.1, 1.3.1–3, 2.4.2, 2.4.6, 2.5.3, 3.3.2, 4.1.2) | Existing production axe checkpoints, semantic table/caption/label regressions and new counter accessible-description tests. Human review of meaningful reading order, names and PDF alternatives remains necessary. |
| Color/contrast and non-color indicators (1.4.1, 1.4.3, 1.4.11) | Existing light/dark/high/system themes and new measured focus-ring contrast. Color is supplemented by labels/state text. City should inspect Windows high contrast, magnification and representative monitors. |
| Text size, reflow and spacing (1.4.4, 1.4.10, 1.4.12) | Existing R59 screen/role checks retained with the explicitly requested relative scale; new 320px Writer/Reports reflow, 200% root-text size and WCAG spacing overrides. Scrolling data tables and two-dimensional official documents retain their appropriate exceptions. This is not proof of every record, locale or custom font configuration. |
| Keyboard, shortcuts, focus order/visibility/obscuration (2.1.1–2, 2.1.4, 2.4.1, 2.4.3, 2.4.7, 2.4.11) | Existing modal Escape/focus-return, skip links, shortcuts and editor checks; new theme/forced-color rings, heading destination focus and 32 native Tab steps above the mobile bar. Test full staff workflows with NVDA/JAWS or the City's supported screen reader. |
| Timing, motion and pointer interaction (2.2.1–2, 2.3.1, 2.5.1–2, 2.5.7–8) | Retain paused notification timers, message history, reduced motion, click/keyboard alternatives to drag/reorder and control targets. New utility/overlay checkbox sizing complements existing main controls. Human testing should check touch precision and overlays at Windows scaling levels. |
| Predictability, help, errors and confirmation (3.2.1–4, 3.2.6, 3.3.1, 3.3.3–4, 3.3.7, 4.1.3) | Stable navigation, Tools help/history, named validation messages, retained imported information, review/confirmation and issuance/refusal checks remain. Character counts add limit feedback; they are not per-keystroke live alerts. Lookup cancellation is now explained. Screen-reader announcement timing and legal-action confirmation still need City acceptance. |
| Media, orientation, authentication (1.2, 1.3.4, 2.5.4, 3.3.8) | Core screens have no audiovisual content, motion-only controls or user cognitive authentication challenge. Both narrow/wide layouts are supported. Reassess applicability if these features are introduced; loopback security remains enforced. |

## Before/after and regression evidence

The clean R75 baseline passed the complete production browser audit with 292 axe checkpoints. Pinned local tools: Node 24.19.0, Python 3.14.10, Playwright 1.64.1 / Chromium 156.0.8078.4. Synthetic evidence lives outside maintained source under `scratch/work/accessibility-review/`.

The 12-state diagnostic replay covers Workspace, editor, correction review, recipients, Reports/data/open cases, administrator review, mobile Tools/saved work/notice/citation and the open-case list. No document-body horizontal overflow or clipped measured screen controls was found at captured viewports. Representative before/after screenshots were inspected. Body text changed 14px to 16px; heading focus changed from no outline to a solid contrasting ring. The stock strict comparison correctly stops at the first changed Workspace screen (geometry and pixels differ). It was not relaxed, and its result is not reported as parity. The stylesheet's original 47,055-byte prefix still hashes to `ff7edd74419074db45e487741ea5a53a87460f121a02c6e16db058312d24a921`; all new CSS is inside an appended screen-only block.

Focused checks passed: unchanged accessibility enhancement equivalence (172 comparisons), open-case behavior, new character-count unit checks, existing typography workflow and the new production accessibility workflow. Its initial isolated run retained exactly 120 DOM listeners before and after 20 closed counter dialogs (2 documents / 1,731 nodes on each side); the regression enforces collection with a small bound. Full-gate results belong to the exact reviewed PR head, not this baseline or an earlier local build. The PR records final outcomes and any failures.

The initial candidate's axe output included 293 manual-review rule occurrences: label-content-name-mismatch (126), color-contrast (96) and aria-prohibited-attr (71). These are rule/checkpoint occurrences, not 293 confirmed defects. A seven-state captured-DOM follow-up retained full node details outside source. Sampled name mismatches are icon-only × dismissal controls with explicit descriptive names; decorative arrows have no textual contrast content; some one-character report links and overlapping/shaded backgrounds cannot be assessed automatically. The named generic-div warning exposed the group-role issue corrected above. Remaining contrast/announcement interpretation still requires human/City review; zero automated violations must not be read as zero manual-review items.

## Simplification recommendations

1. Keep the four primary destinations. Wrapped mobile choices make them discoverable without adding a menu or removing a task.
2. Keep one canonical Saved work & connection panel, reached through contextual links. A future small usability PR could shorten duplicate card/group labels in Tools after staff testing; removing contextual recovery links would make failures harder to resolve.
3. Staff-test the editor's repeated Save/return, Review and Issue entry points. A consistent primary-action hierarchy may be clearer, but the bottom mobile actions and top actions serve different scroll positions. Do not remove them based only on source duplication.
4. Keep advanced recovery/administrator controls collapsed and separate from normal work. Do not remove backups, record history, correction/withdrawal reasons, legal holds or save warnings to reduce visible complexity.
5. Keep shared typography tokens and the small character-count component rather than per-screen copies. Future screen additions should use the same roles and join the production axe/keyboard tests.

No functional removal is proposed for immediate delivery. The remaining simplification decisions benefit from the City's active acceptance sessions and observed task completion, rather than speculative replacement of working workflows.
