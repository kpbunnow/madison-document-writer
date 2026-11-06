# Long-session stability

Reviewed from main `5cc3dae0e0ac14b6dafcd93880e5bdecc72934d0`. This work exercises private synthetic drafts and browser lifecycles; it does not publish documents or establish City, Outlook, native printing or physical power-loss acceptance.

## Confirmed faults and corrections

- Opening a verified archived PDF allocated a blob URL before opening its viewer. If `window.open` threw, control skipped the normal five-minute cleanup and retained those bytes until the Writer page closed. The failure path now revokes the allocated URL immediately. Successful viewer/download handoffs retain their original lifetime, artifact identity and reconstructed-copy confirmation.
- Outbox printing opens every selected viewer synchronously to preserve the user gesture before reading PDFs. A failed read closed only the current viewer, abandoning the remaining blank tabs; a later popup-opening exception also abandoned earlier blanks before reading began. Both failure paths now close every unused viewer, attempting the rest even if one close is refused. Successfully handed-off earlier PDFs remain open.
- A refused outbox viewer navigation or download could similarly skip the URL cleanup timer. Allocated but unhanded bytes are now revoked on failure. Successfully handed-off PDFs keep the original two-minute lifetime and once-only load/print behavior.

The new regression assertions fail the original archived-viewer and multi-PDF read-failure paths. Tests also cover opening a later viewer throwing, navigation failure after URL allocation, partial success followed by failure, and 200 repeated archived-viewer refusals with one release per allocation. Existing success/download, synchronous popup, original-byte identity, layout and timer assertions remain intact. No retained fixture is changed.

Two private helpers (`issuedArtifact` and `selectedOutbox`) move unchanged outside their constructors; AST comparison against the baseline confirms identical bodies and dependencies. Constructor complexity limits are tightened, not relaxed.

## Repeated production workflow

`tests/browser/browser_long_session.js` is part of the full production-browser gate. A fresh context restores the real IndexedDB and then seeds two synthetic cases, each with one editable draft (six/twelve items). The helper is disconnected deliberately to isolate browser lifetimes and avoid operational writes.

For **120 cycles** the suite activates the real Workspace document action, edits a contenteditable item through the delegated input handler, checks exactly one dirty/change increment, generates a fresh print-layout preview, opens/closes Review, and returns to Workspace through its real navigation/save barrier. Current edited text must appear in every preview. The preview's iframe must be removed before each cycle returns.

Every 20 cycles, Chromium collects garbage twice and reports live DOM documents/nodes, event listeners and used JavaScript heap. Test-only wrappers count pending timers, intervals and blob URLs without storing callbacks or nodes in their tracking sets. The suite checks:

- No preview iframe, open dialog, unexpected pending save or blob URL remains.
- Both drafts and cases remain present; each edit dispatches once.
- After warmup, DOM nodes remain within 100, listeners within 12, DOM documents within one and retained heap within 4 MiB of the warm sample. The margins allow browser/runtime initialization; these are regression bounds, not proof of leak absence.
- Pending timers remain within three of the warm sample and the app interval count stays constant.
- A final real device save and reload restore both latest edited texts. The restored Workspace receives an accessibility audit.

Only the isolated test context is instrumented. Application timers, auto-save delays, alert durations, browser download lifetimes and printing instructions are unchanged. A deliberate accumulating document-input/window-listener mutation fails the listener bound, confirming the regression detects that class of leak.

For a longer diagnostic, set `DW_SESSION_CYCLES` to 120–2,000 when invoking this browser suite with the existing suite arguments. Default CI coverage is always 120 cycles and retains the existing per-suite deadline. Extended diagnostics should run serially outside measured browser jobs. Evidence is written as `long-session-results.json` under the browser output folder and included in the full gate artifact. Do not use a diagnostic alone as merge or release approval.

A local **600-cycle** production run passed on pinned Chromium 156.0.8078.4. From cycle 20 to 600, post-GC DOM documents stayed at two, nodes fell from 1,564 to 1,554 and listeners fell from 104 to 96. Pending timers fell from two to one; the single app interval stayed constant. Frames, open dialogs, blob URLs and pending shared saves were zero at every sample. Used JavaScript heap moved from 4,679,776 to 5,779,648 bytes (about 1.05 MiB growth, within the stated bound); it is not claimed to be perfectly flat. Both final edits survived a real device save/reload, with no page errors and a passing restored-Workspace axe check. These are synthetic Linux Chromium observations, not a full workday or native City viewer measurement.

## Lifecycle inventory and limits

Feature registration uses a per-target WeakMap guard; constructor-owned listeners are installed at startup rather than on each render. Screen and overlay content is replaced; local element listeners are collectible with those nodes. Accessibility has one body observer and one app-lifetime banner interval; message history is capped at 200 and removed messages drop their callbacks/timers. Draft autosave replaces its previous timer. Print-layout frames use `finally` removal. These owners are covered by existing registration, accessibility, editor, pagination, printing and storage suites as well as the repeated production workflow.

Active workspace/history and integrity snapshots intentionally retain data needed for editing, recovery and verification; this change does not evict authority or private work to make a memory number smaller. Successful print/download blob URLs deliberately retain their existing finite lifetimes. A large burst can therefore use temporary memory until cleanup; this review does not claim zero memory use or native viewer/plugin stability.

Current release/helper identity, independently versioned stored formats, approved legal/print content, issued history, locks, dependency pins and publication trust remain unchanged. Full exact-head GitHub checks still govern merge. No release is assigned, packaged or deployed.
