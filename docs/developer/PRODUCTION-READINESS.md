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
