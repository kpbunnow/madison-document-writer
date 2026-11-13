# {{RELEASE_NUMBER}} production readiness

Release {{RELEASE}} · Helper {{HELPER_VERSION}} · Authoring {{AUTHORING}}

Development and automated verification are not City acceptance. No live rollout
has been performed. Packaging and deployment require separate authorization.

Before packaging, run `python3 tools/verify_release.py` against the exact final
source and runtime, with measured browser tests serially. Inspect the actual
regression, browser, accessibility and PDF evidence. The existing packaging
procedure is `python3 tools/package_release.py --output <folder> --published-manifest <last-approved-deploy/runtime-manifest.json>`; its manifest
and installer verification remain required. This document supplies the required
package-level readiness record; it does not authorize packaging.

Before any pilot, complete U53, D53, S53, N53 and W53 and every carried-forward
open item in [{{RELEASE_NUMBER}}-ACCEPTANCE-RECORD.md]({{RELEASE_NUMBER}}-ACCEPTANCE-RECORD.md). In particular,
legal decisions L1–L5, the mandatory-appearance defendant-wording hold, City
Windows/NTFS/SMB/SQL, integrity and update permissions, Classic Outlook, native
printing (including historical snow citations), performance, manual accessibility
and staff acceptance remain OPEN. Approval fields remain blank until their
actual owners record evidence and signoff.

R56 Reports performance acceptance must include the summary-to-case projection check
on representative real case sizes (first load after a change pays it once per case).

R56 carries C10: a native Windows Unicode case on the default code page
(automated tests only simulate that encoding), and P3 now includes a direct filing of
the same name during an outbox transfer.

R56 additionally requires S56: staff review of the simplified editor (single
Recipients button, no parcel field or initial-action panel, Cite only for a Citation
import) and P7 now includes authoring-13 dated Best Interest and Vacancy Extensions.
R57 (the usability follow-up) adds S56B: staff review of the renamed actions, views,
searches, readiness summary and deadline selection, and real-device review of narrow-screen,
mobile and virtual-keyboard behaviour. The requester accepted S56B on 2026-10-22 (PR #26);
the other acceptance items remain open.

R58 adds the desktop launch and Exit Document Writer. Native Windows items L58-1 to L58-9
(installation and upgrade, shortcut migration, no console windows, Chrome/Edge app windows,
network and offline start, safe exit, icon rendering and staff review) remain open and must be
recorded on City PCs; automated Linux tests simulate Windows calls only.

R59 changes the Writer workflow (import selection, charged-ordinance select, Violation Items,
Review dialog, Issue returning to Workspace, 15-second messages) and screen typography; documents
and print are unchanged. Staff and native items S59-1 to S59-6 remain open; the charged-ordinance
select needs division/legal review with real multi-ordinance items (S59-3).

R54 additionally requires P7: native side-by-side review of regular, Best Interest
and Vacancy Extensions, including one-page, multi-page, conditional vacancy and
historical corrections. The five confirmed layout defaults and supervisory
signer exception are documented in [the current release review]({{RELEASE_NUMBER}}-REVIEW.md); these decisions
do not close any existing acceptance hold. Authoring-11 and earlier rendering,
frozen fixtures, approved language and the regular Extension remain protected.

R60 adds S60-1 through S60-6 for Workspace entry, dialog accessibility, scoped reinspection dates, complete citation packets, physical address alignment and referral history semantics. These remain OPEN; automated verification does not supply staff or native acceptance.

R62 Development 3 adds S62-1 through S62-5. All remain OPEN; automated verification does not supply staff, City Attorney or native acceptance.

R61 Development 2 adds S61-1 through S61-5. All remain OPEN. The retained Best Interest safety checkbox applies to authoring-15 drafts and historical R61-format acceptance; current authoring-16 Best Interest has no safety checkbox (S62-2). Implementation is merged, but this is not deployment approval.

R63 is the first release package since R61. It adds S63-1 and S63-2 for startup restoration and the two newly shareable report views. All remain OPEN. It is published against the retained R61 deployment manifest; packaging is not deployment approval.

R64 adds S64-1 through S64-4 for case-folder links, plain error wording, the Reports date and the clarified controls. All remain OPEN; automated verification does not supply City, native or staff acceptance. R64 is a release candidate, not a deployment approval.

R65 adds S65-1 through S65-3 for open cases by inspector and the Reinspection Notice (wording approval, print, mailing and filing). All remain OPEN. R65 is a release candidate, not a deployment approval.

R66 replaces R65, which could not start on an installed PC, and adds S66-1 (installed start). S65-1 through S65-3 carry to R66 unchanged. R66 is a release candidate, not a deployment approval.

R67 replaces R64 to R66 (R66 was never published) and adds S67-1 (installed start and newest-release enforcement) with the Violator and order-language items SVIO-2, SVIO-4, OL-1 and OL-2. S65-1 through S65-3 and S66-1 carry to R67 unchanged. R67 is a release candidate, not a deployment approval.

R68 upgrades R67 (confirmed working on City PCs) and adds S68-1 (installed update) with the open-case list checks OCL-1 to OCL-8. SVIO-2, SVIO-4 per PC, OL-2, S65-1 through S65-3 and the carried City items remain OPEN. R68 is a release candidate, not a deployment approval.

R69 upgrades R68 and adds S69-1 (installed update) and S69-2 (opens on Import inspection) with the open-case list checks OCL-1 to OCL-10 (OCL-10: no Excel card). SVIO-2, SVIO-4 per PC, OL-2, S65-1 through S65-3 and the carried City items remain OPEN. R69 is a release candidate, not a deployment approval.

R70 upgrades R69 and adds S70-1 (installed update) with the import-list checks OCL-11 to OCL-14 (full inspector names, no wrapping, documents open at the top, no shared-record search). OCL-1 to OCL-10, S69-2, SVIO-2, OL-2, S65-1 through S65-3 and the carried City items remain OPEN. R70 is a release candidate, not a deployment approval.

R71 upgrades R70 and adds S71-1 (installed update), SORT-1 (Sort by due date) and RESTART-1 (a deleted case file restarts its history). OCL-1 to OCL-14, S69-2, SVIO-2, OL-2, S65-1 through S65-3 and the carried City items remain OPEN. R71 is a release candidate, not a deployment approval.

R72 upgrades R71 and adds S72-1 (installed update), OCL-15 to OCL-17 (bubbles, excluded staff, Due column). SORT-1, RESTART-1, S71-1, OCL-1 to OCL-14, S69-2, SVIO-2, OL-2, S65-1 through S65-3 and the carried City items remain OPEN. R72 is a release candidate, not a deployment approval.

R73 upgrades R72 and adds S73-1 (installed update), PO-1 (PO Box recipients), LVL-1 (citation violation levels) and DISC-1 (recipients after a draft discard). S72-1, OCL-15 to OCL-17, SORT-1, RESTART-1, S71-1, OCL-1 to OCL-14, S69-2, SVIO-2, OL-2, S65-1 through S65-3 and the carried City items remain OPEN. R73 is a release candidate, not a deployment approval.

R74 upgrades R73 and adds S74-1 (installed update), OCL-18 (import window), CLR-1 and CLR-2 (workspace cleared on close). S73-1, PO-1, LVL-1, DISC-1, S72-1, OCL-15 to OCL-17, SORT-1, RESTART-1, OCL-1 to OCL-14, S69-2, S65-3, SVIO-2, OL-2, D53 and the carried City items remain OPEN. R74 is a release candidate, not a deployment approval.

Pending next assigned release: Python 3.14 is the minimum for the program and development; bundled address-parser wheels support Windows x64 CPython 3.14 only. IT must install 64-bit Python 3.14 and its py launcher on every PC before rollout. PY-1 remains OPEN and must prove startup/parser availability on 3.14 and refusal on older-only PCs. Preserve R74 identities during development; a newly assigned release and helper build are required before packaging changed deployment bytes.

Pending next assigned release: all four fixed case-database queries follow the configured connection database; missing or blank settings select AccelaReporting explicitly. Cached inspector lists/names are bound to validated connection settings, and new requests revalidate configuration before cache use. SQL-2 remains OPEN for actual City database/account evidence. No new trusted server or authentication mode is introduced.

R75 upgrades R74 and adds S75-1 (installed update), PY-1 (Python 3.14 on every PC) and SQL-2 (all four queries follow the configured database). S74-1, OCL-18, CLR-1, CLR-2 and the carried City items remain OPEN. R75 is a release candidate, not a deployment approval; IT must install Python 3.14 on every PC first.

R76 upgrades R75 and replaces the direct SQL lookup with the live SSRS reports (SSRS-1 to SSRS-7, superseding SQL-2) and adds S76-1 (installed update). PY-1 and the carried City items remain OPEN. R76 is a release candidate, not a deployment approval.

R77 upgrades R76 and adds the order-language search, grouping and repeated-entry changes (S77-2) and the installed update check (S77-1, superseding S76-1). SSRS-1 to SSRS-7, PY-1 and the carried City items remain OPEN. R77 is a release candidate, not a deployment approval.

R78 upgrades R77 with the document-first Workspace, Violation Categories picker, compact editor header, owner-CC cleanup, DFI registered-agent link and search highlighting (S78-2, S78-3) and the installed update check (S78-1, superseding S77-1). SSRS-1 to SSRS-7, PY-1 and the carried City items remain OPEN. R78 is a release candidate, not a deployment approval.

R79 upgrades R78 with the inline issued-document list in Workspace and the simplified import review (S79-2) and the installed update check (S79-1, superseding S78-1). SSRS-1 to SSRS-7, PY-1 and the carried City items remain OPEN. R79 is a release candidate, not a deployment approval.

R80 upgrades R79 with the Workspace case-number lookup, the continuation-only import panel, grouped success messages, preview reuse and the Reports handoff highlight (S80-2) and the installed update check (S80-1, superseding S79-1). SSRS-1 to SSRS-7, PY-1 and the carried City items remain OPEN. R80 is a release candidate, not a deployment approval.

R81 upgrades R80 with the remembered-inspector Workspace list, Find a case, Mark the rest, Fix next issue, order-language Favorites and Recently used, heading-only item defaults and faster Workspace refreshes (S81-2) and the installed update check (S81-1, superseding S80-1). SSRS-1 to SSRS-7, PY-1 and the carried City items remain OPEN. R81 is a release candidate, not a deployment approval.
