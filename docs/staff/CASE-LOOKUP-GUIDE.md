# Case lookup and import guide

Applies to the current release. Current operating instructions and SQL setup are below. See PROGRAM-MANUAL.html and the City acceptance record (Rnn-ACCEPTANCE-RECORD.md at the top of the release package).

## 4 Import a case or later inspection

**Direct lookup.** Open Import inspection, enter the complete case number and choose Find Accela inspection or press Enter. The Windows helper runs the supplied read-only SQL query with the signed-in Windows account. Inspectors do not enter SQL, passwords or server settings. The initial default server is sqlelam; IT can set the approved database and server in shared Case Lookup/settings.json.

Select an eligible unused inspection with an actual date and supported type. If several results qualify, choose explicitly. Completed, Scheduled, Pending, Assist and unlisted results cannot be imported. A result status is not proof that this program issued a document; shared records independently prevent inspection reuse.

The imported inspection's **Inspection Type** and **Inspection Status** decide the document; there is no “Choose next action” step.

- **Initial Inspection** starts a new case only (a case that already exists, including a snow case, is refused). Official Notice → Official Notice; Citation → Citation (at least one item marked for citation); No Occupancy → No Occupancy; Abatement Summary → Summary Abatement; Abatement Non-Summary → Non-Summary Abatement.
- **Reinspection** needs an existing case. CA Referral or City Attorney Referral → Referral for Prosecution (the case’s first referral); Compliance → Compliance Letter (every item Corrected); Citation → Citation (at least one item cited); Extension Processing → choose Extension, Best Interest Extension or Vacancy Extension; No Occupancy → No Occupancy. On a snow case, Citation records the next snow event.
- **CA Reinspection** needs an existing case that has been referred. Compliance → Compliance Letter; Non Compliance → Update for Case Referral.
- Completed and any other unlisted result cannot be imported: set the specific result in Accela and retrieve it again.
- If recorded results contradict the status (for example Compliance with an item not Corrected), the document cannot be issued. Correct the results, or correct the status in Accela and import the same inspection again; the open draft or worksheet is updated without losing your work.

**Review an existing case.** Check the case number, address, selected inspection and proposed property or owner changes. Expand source details if needed. Choose Continue existing case to open its retained draft, worksheet or latest effective issued source without importing the proposed changes. Choose Import later inspection only for an eligible unused physical inspection after the shared preflight succeeds. Existing unfinished work and reused observations must be resolved first.

**Excel alternative.** Open the SSRS Excel alternative and select the division's exported inspection report. Review the same identity and completed-inspection facts and confirm explicitly. CSV paste and manual case creation are not provided. Use the actual Inspection Time column; a missing time stays blank and a scheduled date does not substitute for an actual inspection date.

Record Category Snow Removal selects the snow workflow and preloads its 10.28 item. The new-case workflow selector is an additional deliberate choice, not a way to bypass missing or reused inspection facts. Existing case and file identities remain stable.

**Pause or retry.** Save draft & return to Workspace retains the lookup or review on this device. A retained review is a snapshot with its retrieval time; use Find Accela inspection again for fresh information. Cancel lookup suppresses its result. A failed or empty lookup preserves prior work. If the shared case changed, review the refreshed comparison and confirm again. A delayed earlier result must not replace the current case or reopen Import after navigation.

The source query has no permanent inspection ID. Matching uses case, type, actual date and normalized time, with conservative handling of missing historical time. Do not alter time to bypass a reuse warning. See CASE-LOOKUP-GUIDE.md for SQL setup and diagnostic codes.


## Connection and deployment

Install the entire `deploy` folder as described in `Start Document Writer - READ ME.md`, stop the running program (Exit Document Writer in Tools & settings; for an older version without it, close its command window or sign out of Windows), and double-click the Document Writer icon again. Confirm the build and helper versions match the install guide. The launcher requires `case_lookup.py`, `case_lookup.ps1` and `case_lookup.sql` in addition to the prior core runtime. Windows PowerShell 5.1 and the Windows .NET Framework System.Data provider are used; no additional Python/ODBC package is installed. City script-signing/application-control policies still apply. IT should approve or sign the delivered script through its normal process if required; the launcher does not bypass those policies.

Defaults reproduce the RDL connection: server `sqlelam`, Windows integrated authentication, and no explicit database name. A blank database uses the Windows account's SQL default database. The user's expectation that this works for all inspectors has not been verified on the City network. For deterministic behavior across accounts, IT can set the explicit database containing `dbo.BI_ENF_RECORD` and `dbo.BI_ENF_INSPECTION`.

To override defaults, create `Case Lookup` beside the **shared** launcher and copy `case-lookup-settings.example.json` to `Case Lookup/settings.json`. Set `database` to the actual database name; `server` can be the approved hostname/instance. `enabled: false` disables direct lookup while retaining other import methods. These are the only accepted keys. No password or connection string belongs in this file. The file is read from the shared location each lookup, so updates apply to all PCs and deployment upgrades do not overwrite it. Malformed or unreadable configuration blocks lookup instead of silently switching databases.

Connections always use encrypted SQL transport. By default the helper validates the certificate chain and server name. The exceptional per-computer opt-in below skips that validation for users who accept the risk. If the certificate name requires a fully qualified server name, configure that approved name in the shared settings. The current Windows user requires SELECT permission on the two source objects. There are no INSERT, UPDATE or DELETE commands. Browser requests contain only the case number, never SQL, a server, or credentials.

Connect timeout is 8 seconds, query timeout 20 seconds and helper process limit 40 seconds. One lookup runs per helper. Results exceeding 1,000 rows or the size limits fail without partial import. Canceling a browser request suppresses its result; the bounded read-only SQL operation may finish before another lookup is accepted.

## Data mapping and traceability

The shipped `case_lookup.sql` is the exact SELECT extracted from the uploaded RDL. Its WHERE clause uses typed `@CaseNumber`; user input is never inserted into SQL or a command string. The original RDL is retained under `source/reference` for maintenance.

| SQL field | Import behavior |
|---|---|
| CaseNumber | Exact case identity, normalized to uppercase |
| SiteAddress | Street address plus separately retained city/state/ZIP |
| OwnerName / OwnerAddress | Current owner and mailing address |
| ParcelNumber | Text, preserving leading zeros; existing formatting rules apply |
| CaseDescription | Imported as supplied |
| HistoricDistrictName | District name, matching the report's displayed field |
| HistoricDistrict / IndividualLandmark | Consistency checks; a Yes flag with missing corresponding name blocks lookup import |
| Landmark | Retained for the existing landmark document checks |
| InspectionDate / InspectionTime | Completed inspection date and separate time; midnight date placeholders do not imply a time |
| InspectionScheduledDate | Never substituted for an actual inspection date |
| InspectionType / InspectionStatus / InspectorName | Existing eligibility and roster checks |
| DetailedDescription / ZoningDistrict | Not retained in the imported case, as directed by the division |

Accepted case metadata includes `accela.source`: retrieval timestamp, actual SQL database, configured server and query SHA-256. Issued documents retain their frozen source facts. Refresh does not backdate or rewrite an issued document; use the correction workflow for changes to issued evidence. This is a read-only database integration, not an Accela upload or filing confirmation.

## City-network acceptance

The supplied automated tests use synthetic SQL responses. Windows PowerShell execution, Windows authentication, SQL certificates, real schema types and City network access cannot be verified from the build environment.

Use a separate test deployment and an approved case number. Under at least two inspector accounts, confirm the same database/case is returned; compare property, owner, parcel, historic/landmark fields, completed inspection date/time/status and inspector against Report Builder. The resolved database is retained in the case JSON at `case.accela.source.database`; set the explicit shared database if accounts differ. Check a case with no inspections, several inspections, and an existing issued notice. Save/reopen a review, change a shared test record from another PC, and confirm the refreshed comparison appears. Check lost network access, retry and the Excel fallback. Keep test output out of operational case folders.

## Optional per-computer certificate workaround

The preferred fix is for the PC to trust the SQL server's certificate authority. If you cannot have the certificate chain fixed and accept the security tradeoff, R10 provides a per-user opt-in that keeps the connection encrypted but skips certificate validation. It affects only the current Windows profile, not other inspectors.

1. Open `%LOCALAPPDATA%\MadisonDocWriter` in File Explorer. Create the folder if needed.
2. Create `case-lookup-local-settings.json` containing exactly:

```json
{
  "trustServerCertificate": true
}
```

3. Stop Document Writer with Exit Document Writer in Tools & settings, double-click the Document Writer icon to start it again, then retry the lookup.

This setting makes the client accept the certificate presented by the server without verifying its issuer or identity. A fake server on the network could impersonate SQL Server and receive the connection attempt, including Windows integrated authentication. Use it only if you accept that risk and only on a trusted network. To restore normal certificate validation, delete `case-lookup-local-settings.json`, then stop Document Writer (Exit Document Writer) and start it again from the desktop icon. Do not add this setting to the shared `Case Lookup/settings.json`; the program rejects it there.

| Displayed error | What IT should check |
|---|---|
| `TLS_CERTIFICATE` | The SQL certificate chain or name did not validate. The preferred fix is a trusted chain and matching server name; the optional per-computer setting above bypasses validation if you accept that risk. |
| `SQL_NETWORK` | City network/VPN, DNS, firewall route and SQL service availability for the approved server. |
| `WINDOWS_AUTH` | The signed-in Windows account and its SELECT access to both source objects. |
| Missing tables/database message | Set the approved database name in the shared `Case Lookup/settings.json`; do not guess the database. |
| `SQL_CONNECT_<number>_STATE_<state>` | Give IT the complete diagnostic code and approximate time so they can match it to SQL/client logs. |
| `SQL_CONNECT_TYPE_<type>_HR_<hresult>_WIN32_<number>` | Give IT the full code and approximate time. The exception type/HRESULT/native code helps identify a PowerShell, .NET, network or Windows-level failure. |
| `SQL_CONNECT_..._OP_<operation>_ARG_<name>` | The operation/argument labels narrow down the helper call. After one failed lookup, give IT the full code and the local file `%LOCALAPPDATA%\MadisonDocWriter\case-lookup-diagnostic.txt`. It contains full provider messages and stack details and may include server, database, account or local path names; review it and send it only to IT. The next failed lookup replaces this file. |
| `SCRIPT_POLICY` | Ask IT to approve the delivered helper under City policy. Do not bypass PowerShell policy. |
| `HELPER_RUNTIME` | Ask IT to confirm the complete deployment and Windows PowerShell/.NET SQL support. |
| Script/helper returned no data | Confirm the complete deployment is installed and PowerShell is permitted by City policy. |

The SSRS Excel report import remains available while direct lookup is unavailable. The optional profile setting keeps encryption but skips validating the SQL server's identity.

## Inspection identity and retained provenance

The source query supplies no stable inspection ID. Within a case, the importer matches inspection type, actual date and normalized time; it never uses mutable status or owner details as identity. An initial inspection belongs to the case's single original notice. Imported drafts, worksheets and issued snapshots retain `importInspection` as additive metadata. Historical documents/visits without that metadata use their stored inspection date/time; missing historical time conservatively blocks same-day reuse. Two known, different times remain distinct visits. Do not change an inspection's time to work around a duplicate block; open the existing record and use correction when appropriate.

Closed cases, existing drafts, pending issue confirmations, unreadable shared files and conflicting records do not start a new worksheet. Direct lookup and helper-backed Excel import recheck shared history before confirmation. Failed checks leave existing work intact. The shared helper also rejects reuse of a retained imported inspection when publishing a visit.

## Approved server configuration

The SQL server must also appear in the trusted-connections.json allowlist. A certificate workaround does not authorize another server. Ask the release owner to make any required allowlist change in a new release; inspectors must not alter it or bypass the refusal.
