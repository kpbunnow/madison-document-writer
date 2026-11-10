# Live-data import through SSRS — development plan

Status: written 2026-11-10 against main `4240722` (R75 identity) and implemented the same day on owner direction (section 8).
Where the implementation differs from the first draft, section 9 says so.

## 1. Goal

Keep the Import inspection screen working exactly as it does now: the inspector list, each inspector's open cases with the
Due column, Find Case Inspections, the import window and every import rule. Change only where the live data comes from.
Instead of the helper querying the `sqlelam` / `AccelaReporting` views directly over SQL, it renders two published
SSRS reports as the signed-in Windows user and reads their XML output:

| Need today | Today (SQL file run by `case_lookup.ps1`) | Proposed SSRS report |
| --- | --- | --- |
| One case's details and inspections | `case_lookup.sql` | `/Prod/Local/Building Inspection/Enforcement/DocumenGeneratorImport` (parameter `CaseNumber`) |
| Inspector list with open-case counts | `inspector_list.sql` | `/Prod/Local/Building Inspection/Enforcement/OpenEnforcementCases_BI` (counted by the helper) |
| One inspector's open cases | `inspector_cases.sql` | same report, filtered by the helper |
| Full names for user IDs | `inspector_names.sql` | name column of the same report (no separate query) |

Render URLs (web service, not the portal):

```
https://entreports.cityofmadison.com/ReportServer?/Prod/Local/Building+Inspection/Enforcement/DocumenGeneratorImport&rs:Command=Render&rs:Format=XML&CaseNumber=<encoded>
https://entreports.cityofmadison.com/ReportServer?/Prod/Local/Building+Inspection/Enforcement/OpenEnforcementCases_BI&rs:Command=Render&rs:Format=XML
```

## 2. Design principle: change the helper's source, keep its contract

The page never talks to SSRS. The helper's existing routes (`/case-lookup`, `/inspector-cases/list`,
`/inspector-cases/cases`, `/inspector-cases/names`) keep their request and response shapes, so `accela_import.js`,
`accela_report.js`, `open_case_list.js` and every import rule stay as they are. Only these change:

- **New `helper/ssrs_fetch.ps1`** (Windows PowerShell 5.1): `Invoke-WebRequest -UseDefaultCredentials -UseBasicParsing
  -MaximumRedirection 0`, TLS 1.2 forced on, URL and timeout passed through environment variables, output
  `OK:<base64>` or `ERR:<http code>:<category>`. No string is pasted into the script. Started with `CREATE_NO_WINDOW`,
  the way `case_lookup.ps1` is started today.
- **New `helper/ssrs_reports.py`**: builds the two URLs from fixed report paths plus a validated, URL-encoded case
  number; runs the fetch; caps the response size; rejects HTML (a sign-in or error page); strips a BOM; parses with
  `xml.etree` without entity expansion or DTDs (`defusedxml` is not available, so refuse any `<!DOCTYPE`); checks that
  the root namespace and `Name` equal the expected report name; reads `<Details>` rows; maps attributes to the field
  names the helper already returns. Missing attributes are SSRS's way of writing NULL and become `None`.
- **`case_lookup.py` and `inspector_cases.py`**: keep validation, exclusions, caching, the one-at-a-time locks, the
  verified Due dates and the plain-language messages; replace the call to `run_script(...)` with the SSRS reader when
  the source is `ssrs`. Their `source` block becomes `{"kind": "ssrs", "server": host, "report": path,
  "retrievedAt": ...}`.
- **Fields the report does not print.** `DocumenGeneratorImport` has no column for `InspectionScheduledDate`,
  `HistoricDistrict` or `IndividualLandmark`, so they are absent from its XML. The helper derives the two Yes/No flags
  from `ZoningDistrict` with the same rules as `case_lookup.sql` (one shared table, tested against the SQL text), and
  sends `InspectionScheduledDate` as `None` (the page does not use it). Alternatively the report gains those columns
  (owner choice, question 4).
- **App**: wherever it checks `source.kind === "sql"` (`accela_import.js`, five places) it accepts `"ssrs"` too, and
  the Source and import details line names the report instead of the database. Saved case records keep their existing
  `accela.source`; no case schema, authoring, summary or backup version changes.
- **Release trust**: `trusted-connections.json` gains `"ssrsHosts": ["entreports.cityofmadison.com"]`, checked like
  `gisHosts`; the shared `Case Lookup/settings.json` may name the source (`"source": "ssrs"` or `"sql"`) but never a
  host or report path outside the released list. This changes release trust and needs explicit owner approval.

## 3. Behavior to preserve (each one gets a test)

- Case-number validation, one lookup at a time (429), the 45-second page timeout and Cancel lookup.
- Rejection when the report returns another case, more than one case, conflicting values, a landmark/historic flag
  without a name, or more than 1,000 rows.
- Inspector list cached for 30 minutes, Refresh buttons bypass it, empty answers cached too, only fully checked
  answers kept; the built-in and administrator exclusions applied to the list and to case requests.
- Open-case rules (a status containing Close or Compliance, or No Violation, Void, Withdrawn, is not open; CB cases
  only; trimmed user ID) — now owned by the report. The helper checks the report's rows still meet them and refuses the
  list if they do not, so a report edit cannot silently change who sees what.
- Due column from verified case summaries only; unknown stays "Not confirmed".
- Plain-language failures that say what to do, with no server text shown to staff:
  401 → the Windows account was not accepted (can you open the report in the browser?);
  403 → no permission on the report folder (ask the report administrator);
  404 → report moved or renamed;
  0 / timeout → off the City network, VPN or server down;
  HTML or wrong namespace → the report returned something other than its data.
- A local diagnostic file under `%LOCALAPPDATA%\MadisonDocWriter\` keeps the full PowerShell error, as today.

## 4. Work plan (one focused PR each, merged after Full gate and PR format pass on the exact head)

1. **Contract fixtures.** Add synthetic XML samples for both reports (fake names, `example.com`, `555-01xx`): normal
   case, snow case, case with no inspections, NULL values, landmark, several inspections, empty open-case list, wrong
   namespace, HTML sign-in page, BOM, oversized. Built from the real column names the owner supplies (question 3).
2. **Fetch layer.** `ssrs_fetch.ps1` + Python wrapper, mocked `subprocess.run` tests for `OK`, `ERR:401/403/404/500`,
   `ERR:0`, timeout, missing PowerShell, junk output, oversize. Never run against the real server in CI.
3. **Report readers.** `ssrs_reports.py` parsing, namespace check, NULL handling, flag derivation, user-ID filtering
   and counting, rule check. Property tests: the SSRS reader and the existing SQL row checks produce the same helper
   JSON for the same synthetic data.
4. **Switch.** `settings.json` `source` key (default decided in question 1), allowlist entry, `source` block, app
   accepts `"ssrs"`, Source and import details text. Existing browser import suites run unchanged against a mocked
   helper returning SSRS-sourced JSON.
5. **Docs and acceptance.** `CASE-LOOKUP-GUIDE.md`, the program manual, the install guide (no SQL client or
   certificate setting needed for SSRS), the acceptance record (new SSRS items, SQL-2/S50D/OCL items rewritten).
6. **Retire SQL (later, separate decision).** After City acceptance passes, remove `case_lookup.ps1`, the four `.sql`
   files, the SQL allowlist and the certificate workaround, or keep them as a fallback.

## 5. What only a person on a City PC can verify

The real fetch as an inspector and as a supervisor; the time for each report (cold and warm); row counts compared with
the browser view of each report; a 401/403 account; off-network behavior; a proxy on the City PC; no flashing console
window; a snow case; a case with a landmark; that a case closed in Accela leaves the list (and how long it takes).

## 6. Risks

- **Report changes outside the release.** Anyone with edit rights on the report folder can change columns or rules.
  Mitigated by the namespace/column/rule checks above, which fail loudly; still needs an agreed owner for the reports.
- **Report caching.** If either report is set to cached or snapshot execution, the program shows stale data. The report
  should run live (question 6).
- **Credentials behind the report.** If the report's data source uses stored credentials, any staff member who can
  run the report sees all of its data; if it uses each user's Windows login, SSRS needs Kerberos delegation and may hit
  the same permission problems as direct SQL (question 2).
- **XML hides NULL vs. missing column.** Absent attributes look the same as a deleted column. Option: fetch the report's
  XML schema once (`rc:Schema=true`) and check the required attributes exist.

## 7. Versioning

Helper behavior changes; no case schema, authoring, summary or backup change. Release identity only when the owner
assigns one.

## 8. Owner answers (2026-11-10)

1. Switch over at once; no duplicate SQL path. The owner deploys and tests personally.
2. Live data is needed for inspectors' work. Use each person's own Windows login; staff are on the City network directly or over VPN.
3. The open-cases report definition was supplied (`tests/fixtures/reference/OpenEnforcementCases_BI.rdl`).
4. Work out the three fields the case report does not print in the program.
5. XML exports of both reports were supplied. They hold real data and are not committed; synthetic fixtures with the same
   structure are in `tests/fixtures/ssrs/`.
6. Both reports run live (no cache or snapshot).
7. The owner owns the reports.

## 9. As implemented

- The SQL lookup, its four queries, the SQL allowlist entry and the per-user certificate workaround are removed;
  `trusted-connections.json` lists `ssrsHosts` instead of `sqlServers`. Shared settings accept only `enabled`; the earlier
  `server` and `database` keys are accepted and ignored so an existing file keeps working.
- The open-case report has no user-ID column, so an inspector is identified by the name the report prints
  (`AssignedInspector`). The list renders the report once for everyone and counts distinct cases per name; one inspector's
  cases are rendered with the report's `Inspector` parameter using that exact name, and a name not on the current list is
  refused. `/inspector-cases/names` returns no names (the report already has them).
- The report owns the open-case rule; the helper does not re-check statuses (owner answer 7).
- The fetch uses `Invoke-WebRequest -UseDefaultCredentials -UseBasicParsing -MaximumRedirection 0` with TLS 1.2, reads
  the raw bytes, and returns base64 JSON; failures carry only an allowlisted category, HTTP status and SSRS `rs…` code.
- The setup panel's labels still read "SQL lookup configuration", "SQL Windows support" and "SQL connection"; they are
  guarded by retained-module equivalence tests and are left for a separate change.
