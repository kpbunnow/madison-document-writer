# Guide for AI agents and automation

This describes how an automated agent can work with the Madison Building Inspection Document Writer today, what it must not do, and where the rough edges are. It describes the program as it is; it does not add an agent interface. Details were taken from the helper and app source and the project's own browser tests; if this guide and the code disagree, the code is right and this guide needs a fix.

## Ground rules

1. **Use synthetic data only** when developing, testing or demonstrating. Never point an agent at the City's shared case folder, real case numbers or real owner information.
2. **A person approves every irreversible step.** Issuing a document freezes it and issued copies cannot be edited. Treat Issue, Withdraw, Correct, Email, Save case to shared folder, Transfer PDFs, the administrator deposit override and Exit Document Writer as actions that need explicit human approval each time.
3. **Do not bypass the helper's protections.** Requests need the session token, a loopback Host and Origin, and same-origin Fetch-Site. Do not copy, log or forward the session token or the helper bootstrap value, and do not weaken the checks to make automation easier.
4. **Nothing here is City or native acceptance.** Automated runs do not replace the acceptance records in `docs/developer/ACCEPTANCE-RECORD.md`.
5. Follow `AGENTS.md` and `docs/developer/DEVELOPMENT-STANDARD.md` for any change to the code.

## Two ways the program runs

| | Staff use | Development and test use |
|---|---|---|
| Start | Installed desktop shortcut (`launch.py`) | The helper started directly, as `tests/browser/audit_browser.js` does |
| Session | The shortcut opens the app with a one-time token in the address | The test harness reads the private helper session file and supplies the bootstrap value |
| Data | The shared case folder | A temporary folder with synthetic cases |

An agent should use the development path only. The staff path depends on the trusted shortcut and the user's profile.

### Starting the helper for development
`helper/server.py` reads these environment variables:

- `DW_PORT` — port on 127.0.0.1 (default 8777).
- `DW_CASE_DIR` — folder for case JSON files. Point it at a temporary folder.
- `DW_OPEN_BROWSER` — set to `0` to keep it from opening a window.

Then wait for `GET /dw-status` to return 200 before driving the page. `tests/browser/audit_browser.js` shows a complete working start-up, including a headless Chromium launch (`DW_BROWSER` can name the browser binary), and is the reference to copy from. `docs/developer/CLOUD-DEVELOPMENT.md` covers installing dependencies.

## Driving the screen

The app is a single-page browser app. Controls are best found by stable attributes rather than visible text, because some labels repeat or change with state.

- Most buttons have an `id` (for example `#btn-save`, `#btn-email`, `#btn-correct`, `#btn-void`, `#btn-savecase`, `#btn-retryfiling`) or a `data-` attribute (for example `data-open`, `data-case-sync`, `data-outbox`, `data-safety-case` with `data-safety-action`, `data-admin-deposit`).
- The main action in the editor is `.editor-primary`; its `data-editor-command` says what it will do.
- Submit buttons live in forms that have ids (for example `#admin-deposit-form`, `#admin-snow-letter-form`, `#reminder-email`, `#global-search-form`); select them as `#form-id button[type=submit]`.
- **Collapsed sections hide controls.** Correct, Withdraw and Email sit inside the "Document actions" `<details class="editor-more">`; expand it before clicking them.
- **Labels that look alike mean different things.** In the Workspace queue the button that opens an issued document with an unfiled PDF is **Open document to file PDF**. **File issued PDF** is the button inside the document that actually files it (`#btn-retryfiling`, or the editor's primary action).
- There is no `data-testid` convention. Do not assume one exists.
- Some messages are temporary toasts (warnings and errors stay about 15 seconds) and others are banners with `role="alert"`; read banners and check again rather than relying on catching a toast.
- Dialogs use `role="dialog"`. The Review dialog lists checks that must be fixed before issuing, then advisories.
- Connecting a shared folder in a normal browser uses the system folder picker, which automation cannot operate. In the development harness the helper's own `DW_CASE_DIR` is used instead.

## The helper's web interface

All routes are JSON on `http://127.0.0.1:<port>` and, except `/dw-status`, need the session token header. Errors return `{"ok": false, "error": "<plain sentence>"}` with a 4xx code for bad input and 5xx for failures that may have committed a write. The Writer keeps the exact attempt for a deliberate retry after a 5xx, so do not repeat such a request blindly.

GET: `/dw-status`, `/locks/status`, `/cases/search`, `/cases/list`, `/cases/open`, `/cases/resolve`, `/outbox/list`, `/reporting/views`, `/citations/history`, `/draft-backups/list`, `/catalog/reviews`, `/administration/snow-letter`, and `/reporting/*` reads.

POST: `/session/bootstrap`, `/cases/save`, `/cases/summary`, `/cases/probe`, `/outbox/sync`, `/outbox/read`, `/outbox/batch-sync`, `/draft-backups/write`, `/draft-backups/read`, `/catalog/review`, `/artifact/status`, `/artifact/read`, `/save-pdf`, `/email`, `/email/reminder`, `/address/parse`, `/case-lookup`, `/locks/release`, `/setup/probe`, `/reporting/views`, `/reporting/parcels`, `/administration/deposit-override`, `/administration/snow-letter`, `/helper/shutdown`.

The authoritative table is `GET_ROUTES` and `POST_ROUTES` at the end of `helper/server.py`. `/dw-status` without a token returns only the version; with a token it adds folder, outbox, Chrome and Outlook readiness.

Calling these directly is for tests of the helper itself. Preparing or changing a case should go through the screen so the Writer's own validation and freezing rules apply.

## Known gaps

- No machine-readable "ready to issue" result; the Review dialog is the only source of the checks.
- No published case-record schema or demo case for outside use; see `docs/developer/03-DOMAIN-RULES.md` and the synthetic fixtures under `tests/fixtures/`.
- Errors have no codes, only sentences.
- No dry-run for issuing.
- Collapsed "Document actions" and a few repeated button labels still need the care described above.

These are open design questions for the owner; nothing in this guide changes the program's behavior.
