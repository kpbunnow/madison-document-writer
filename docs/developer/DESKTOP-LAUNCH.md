# Desktop launch and safe shutdown

Post-R57 development (branch `develop/desktop-launch`). Release identity is unchanged: version.json still names R57 and helperBuild 58. Packaging this work for inspectors needs a new release identity authorized by the release owner, because installed launchers compare helperBuild and helper version before accepting an update and before reusing a running helper (see Release identity below).

Stage A added the console-free start; stage B added Exit Document Writer. Staff instructions are in docs/staff/DEPLOY.template.md (Starting, stopping and logs) and chapter 1 of the program manual.

## Process model

| Process | Started by | Window | Stops when |
| --- | --- | --- | --- |
| Desktop launcher (`pythonw.exe -B launch.py`) | The Document Writer desktop shortcut | None; dialogs only for problems | Writer has opened (or a dialog was dismissed) |
| Hidden helper (`python.exe -B server.py`) | The desktop launcher, detached with `CREATE_NO_WINDOW` and `CREATE_NEW_PROCESS_GROUP` (on POSIX test hosts, a new session) | None | Exit Document Writer, or Windows sign-out |
| Diagnostic launcher (`Start Document Writer.bat`) | IT | Console; the helper runs in it | Exit Document Writer, or closing the console |
| Writer and Reports | The launcher opens Writer as a Chrome/Edge `--app` window in the existing profile; Reports opens from Writer | Browser windows | Closing them never stops the helper |

The launcher first runs the trusted share hand-off and the manifest-checked update (`verified_update`/`install_release`), never under a running helper. If a helper already answers on 127.0.0.1:8777, `/dw-status` (public: version and readiness only) decides: the same version is reused and Writer is opened; any other answer shows a dialog (`OLDER_HELPER`, `PORT_IN_USE`). Otherwise the helper is started hidden, the launcher polls `/dw-status` for up to 45 seconds and opens the app window through `desktop_launch.open_app_window`, the one place that builds the authenticated address (token in the fragment, removed by the page at once). Every helper child process states its creation flags (`runtime_paths.no_window`).

## Shortcut

`desktop_launch.create_shortcut` writes `Desktop\Document Writer.lnk` through Windows PowerShell's `WScript.Shell`, with every value passed through environment variables (never parsed as code): target the installation's verified `pythonw.exe` (same folder and major.minor as the running Python, checked by running it once), arguments `-B "<local>\launch.py"`, working directory `<local>`, icon `<local>\document-writer.ico,0`. Opening an existing `Document Writer.lnk` and saving it migrates a stage-0 batch-file shortcut in place. Without a usable `pythonw.exe` the shortcut targets the batch launcher and the log says why. Taskbar and Start-menu pins and renamed copies are not touched.

## Logging

`logs\launcher.log` in the local installation (never the share): rotating, 1 MB x 4. It records launcher start, hand-off, update outcome, helper start state, browser choice and every dialog. It never records the session token, the authenticated address, credentials or case contents; the hidden helper's own output is discarded because request errors can name case files (IT sees it with the batch launcher). `launch.py --open-logs` opens the folder. The helper's case-free structured log (`helper.jsonl`) records `shutdown` `ok`/`conflict` events.

## Safe shutdown

**Route.** `POST /helper/shutdown`, registered in `server.POST_ROUTES`, so `do_POST` applies the token, Host, Origin and fetch-site checks and the JSON check before the handler (the session test iterates both route tables). There is no GET, static or token-less variant, and no other stop route. Body: `{}` or `{"force": true|false}`; anything else is 400.

**Refusal (409).** The handler takes `ACTIVITY_LOCK`, collects reasons and, only when there are none, sets `STOPPING` in the same critical section, so no request can start between the check and the decision. Reasons are readable sentences that never name a case or a file:

- every other POST still running (each POST is counted for the duration of its handler, labelled by route: case save/summary, PDF make/file, email, outbox transfer, recovery copy, catalog review, lock release, administrator decisions, Reports parcel lookup, or another request);
- every lock the helper process holds through `case_store.file_lock` (in-memory `HELD_LOCKS` by kind: case, issued-pdf, pdf-operation, pdf-outbox, citation-pricing, integrity records, others), which also covers the minute anchor thread;
- `install-transaction.json` in the installation (an update/rollback in progress).

`force` records that the user acknowledged client-side warnings; it never bypasses a server refusal. GET reads are not counted: interrupting a read changes nothing.

**Success (200).** The helper answers `{"ok": true, "stopping": true}`, then a separate thread calls `shutdown()` once the answer has been written; `serve_forever` returns, leaving the `with Server(...)` block closes the listening socket, the process prints "Document Writer has stopped." and exits normally (daemon threads end with it). After `STOPPING`, any new POST is refused with 503. No process is killed and no browser is closed; the session file is left for the next start, which replaces the token.

**Writer.** Tools & settings → Saved work & connection → Exit Document Writer (`desktop_exit.js`). Not in the rail: the five Writer destinations are unchanged and the action is deliberate. The flow saves drafts (`saveDrafts`), reviews existing state (`exitReview`), shows the dialog, and on confirmation saves again, writes the recovery copy, then calls the route.

- Blocking (no Exit button; Check again): a publication in flight (`state.publicationBusy`, `AMENDMENT_BUSY`), a PDF filing or email request in flight (`FILING_ACTIVE`), device saving failed or unfinished.
- Unresolved (Exit after an acknowledgement checkbox): retained publication attempts awaiting confirmation (`pendingAmendment`/`RECORD_ATTEMPTS`/`pendingTransaction`), shared-change conflicts, issued PDFs not filed, case changes not in the shared folder, queued shared saves (`PENDING`), PDFs in the local outbox (`HELPER.outbox`). They are described as staying on this device and not having reached the shared folder, never as saved.
- After 200: `helperStop.stopped` is set, `authFetch` refuses every later helper call, `render` no longer repaints, the stopped state replaces the page and a `madison-helper-stopped-v1` BroadcastChannel message tells other Writer and Reports windows of the same profile, which show the same state (a Writer window saves its device drafts first). A 409 shows the helper's reasons; no answer says it may already have stopped.
- Closing or reloading a window sends nothing (no unload/pagehide/beacon request); `beforeunload` only warns about unsaved device work.

**Launcher.** The launcher never stops a running helper. R57 and earlier helpers have no shutdown route, and a later helper's route requires its session token, which the launcher does not send; adding a token-less call would let any local program stop the helper. `OLDER_HELPER` therefore explains every way out: Exit Document Writer when the running version offers it, closing the batch launcher's console, or Windows sign-out (or IT).

## Release identity

`launch.py` compares the running helper's `/dw-status` version with its own `VERSION`, and `verified_update` refuses a manifest whose helperBuild or helper version is older than the installed pin (an equal identity is accepted). With identity unchanged, a PC still running an R57 helper reuses it as compatible (same version), so it is never reported as an older version and the update is not applied until that helper stops; PCs, logs and acceptance evidence also cannot tell the two builds apart. A release containing this work must carry a new helperBuild and helper version, authorized by the release owner; until then this work is development only.

## Security notes

- Exit is an authenticated, Host/Origin/fetch-site/JSON-guarded POST; a public page, another site or another local program without the session token gets 403.
- No token, authenticated address or case content in launcher logs, dialogs, the console or refusal reasons.
- No process killing: no taskkill, terminate or signal anywhere in helper code; only the helper ends its own serve loop. Browsers are never closed.
- No new persistence: activity and held-lock counts are in memory only.

## Windows verification checklist

Automated tests run on Linux with simulated Windows calls and a real helper process. Record these on City Windows PCs (acceptance items L58-1 to L58-9):

1. Fresh install from the batch launcher: icon created with the Document Writer icon; later starts from the icon show no console window at any point (launcher, helper, pip, PowerShell, PDF rendering, Outlook).
2. Upgrade with an existing batch-file shortcut: the shortcut is migrated in place; pins keep the batch launcher.
3. Chrome-only, Edge-only and neither installed: app window in the existing profile with existing drafts and site data; default-browser fallback.
4. Shared folder on a network path, disconnected at start: Writer opens with the installed version and queues shared saves.
5. Startup dialogs: older helper, port in use, helper did not start, no browser, damaged installation; `--open-logs`; log contents free of tokens.
6. Exit Document Writer with Writer and Reports open: both show the stopped state; the helper process ends; port 8777 closes; drafts and queued items survive the next start.
7. Exit refused during issuance, PDF filing, outbox transfer and an update; allowed with acknowledgment when only queued or offline items remain.
8. Sign-out stops a hidden helper; closing all windows does not.
9. Icon rendering at 100–200% scaling in the desktop, taskbar, app window and Alt+Tab.
