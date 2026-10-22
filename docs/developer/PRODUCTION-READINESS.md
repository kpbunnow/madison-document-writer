# {{RELEASE_NUMBER}} production readiness

Release {{RELEASE}} · Helper {{HELPER_VERSION}} · Authoring {{AUTHORING}}

Development and automated verification are not City acceptance. No live rollout
has been performed. Packaging and deployment require separate authorization.

Before packaging, run `python3 tools/verify_release.py` against the exact final
source and runtime, with measured browser tests serially. Inspect the actual
regression, browser, accessibility and PDF evidence. The existing packaging
procedure is `python3 tools/package_release.py --output <folder>`; its manifest
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

R54 additionally requires P7: native side-by-side review of regular, Best Interest
and Vacancy Extensions, including one-page, multi-page, conditional vacancy and
historical corrections. The five confirmed layout defaults and supervisory
signer exception are documented in [the current release review]({{RELEASE_NUMBER}}-REVIEW.md); these decisions
do not close any existing acceptance hold. Authoring-11 and earlier rendering,
frozen fixtures, approved language and the regular Extension remain protected.
