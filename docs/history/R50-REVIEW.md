# R50 implementation review

R50 uses the verified R49 package as its baseline. It corrects the inspection-result import regression and implements the supplied security, error-handling and repository findings. Case schema 5, summary 6, authoring 11 and backup 2 are retained. No legal approval, City acceptance or live rollout is implied.

## Findings and verification

| ID | Final change | Named verification |
| --- | --- | --- |
| S1 | Ed25519 signed full-file manifests; stage/hash/size checks; exact file-set verification; local release pin and downgrade refusal; trusted first-installation procedure | audit_r50_updates; RFC 8032 vector, independent signer, changed code/HTML/SQL, additions/omissions, forged/unsigned/downgraded refusal and valid install |
| S2 | Random per-start session token on non-static routes; private profile bootstrap and origin/port scope; public HTML discloses no token; reload recovers after restart | audit_r50_session; audit_r50_session_browser; all API routes, bad token/origin/Host, real restart and retained unfinished work |
| S3 | Embedded-only HTML/CSS resource validation, first-head PDF CSP, network resolver blocking and fresh renderer profile | audit_r50_renderer; audit_r50_documents; external image/style/frame/file and obfuscated resources refused before rendering; 69 retained document variants |
| S4 | Signed GIS and SQL allowlists; HTTPS-only GIS with bounded reads and approved redirects; local-only anchor configuration | audit_r50_connections; file/HTTP/off-list/redirect/size refusals, SQL with/without TLS workaround, share-only anchor ignored |
| S5 | SHA-256 script CSP for both applications, self-only connections with Reports City GIS exception, no objects/base override/framing by other pages | audit_browser; securitypolicyviolation collection must remain empty |
| S6 | Production ignores renderer executable/sandbox environment overrides; Playwright comes from pinned project dependencies | audit_r50_low_security; production source and planted executable refusal |
| S7 | Windows reserved device names, extensions and trailing dot/space case names refused | audit_r50_low_security |
| S8 | Outlook resolves from known installed paths or Windows App Paths only | audit_r50_low_security; planted PATH executable never used |
| S9 | Browser-cache review status explicitly labeled while refreshing or unavailable; existing selection and publication validation retained | audit_r50_cached_reviews; browser_r47 |
| S10 | Historical development/continuation prompts and layout studies archived outside all shipped source and deployment; history is non-authoritative | audit_r50_repository; package inventory |
| B1 | Serialization failures stop before writing; report parse failures identify HTTP status; sort errors use default order with an accessible notice; benign catches documented | audit_r50_errors; audit_r50_report_errors; ESLint no-empty on maintained code |
| B2 | Removed unused snow description/season helper; legacy pricing adapter lives only in test support | Vulture confidence 80; retained pricing suites |
| B3 | Shared administrative-basis validation and generated runtime identity remove inline imports in pricing and operations | Pyflakes; Vulture; administrative/pricing regression suites |
| B4 | Direct ES module imports/exports replace numbered bridge factories and universal getter registry; explicit shared state and narrow proof/presentation interfaces | audit_r40_build; audit_r50_repository; complete browser/regression/print comparisons |
| B5 | Intentional cache-key and framework-signature parameters are documented in the Vulture whitelist | Vulture confidence 80 |
| A1 | Maintained browser, helper, policy, test, tool and document folders replace the crowded source root | audit_r50_repository |
| A2 | Policy sources live at policy rather than source/source/policy | audit_r50_repository; policy compiler suites |
| A3 | Historical archives and generated verification folders are excluded from source; evidence delivered separately | audit_r50_repository; package inventory |
| A4 | Deployment includes runtime, offline dependencies, licenses and staff guidance; developer reviews/roadmaps are not installed | audit_r50_repository; signed deployment inventory |
| A5 | Developer start/architecture/domain/pitfall/testing guides describe current behavior; concise release history lives in CHANGELOG | documentation review; package inventory |
| A6 | Generated bundles/data/test projections live under build and are excluded from maintained-source packaging | audit_r50_repository; pre/post-move runtime hashes |
| A7 | Pinned Prettier and Ruff format maintained code; a dedicated format-only commit preserves literal values and approved print CSS | tools/check_format.py; exact print comparisons; complete gate |
| A8 | version.json owns release identity; generated/checked npm, helper, manifest and RELEASE consumers must agree | audit_r50_repository; build mismatch refusal |
| I1 | SQL and Excel use the defined Completed, Official Notice, Citation and Compliance result eligibility table; actual source status stays intact | audit_r50_import; audit_import retained SSRS fixture; browser_r50_import |
| I2 | Reuse the fixed Chicago calendar formatter instead of constructing it for every report date; date outputs remain unchanged | audit_r50_calendar covers 2,400 instants across DST; browser_r48 retains the two-second loaded-transition limit |
| I3 | Preserve the Excel alternative and its keyboard focus through same-screen refreshes, with independent state after navigation | audit_r50_import_repaint; browser_r45 reopens real workbooks after deliberate redraws |
| I4 | Keep the active corrective-action node and caret through passive editor redraws; new model text, locks, dialogs and navigation still refresh | audit_r50_editor_repaint fails before the fix; audit_browser forces a redraw before typing and returning to the retained follow-up draft |

## Inspection import correction

R49 already defines Official Notice, Citation and Compliance as selectable inspection results, but its later selection and planning paths require the literal Completed value. This makes valid rows disappear and blocks confirmation. The retained SSRS export fixture reproduces the defect: its initial Official Notice result was previously made usable only by changing the test source to Completed.

R50 removes that workaround and uses one eligibility predicate across SQL conversion, Excel selection, confirmation, choice display and direct advance. The actual result is visible in the review. Scheduled/Pending/Assist/unknown rows, missing dates, unsupported types, future dates, reused inspections, unfinished work and shared-record conflicts remain protected. Multiple results require a deliberate choice. Blank times stay blank, and Snow Removal keeps its established route. Native City SQL must still be checked under the City's acceptance record.

## Compatibility and security boundaries

The installed Windows names/layout, existing transaction/lock/recovery owners, integrity chain, protected-anchor requirements, publication/pricing/catalog checks and mandatory-appearance hold remain. Exact prepared PDF originals are retained on retry; no new renderer output is substituted for an issued original.

The 69-variant fixed-frame comparison covers all supported retained authoring versions and court copies. The renderer's security meta changes the generated HTML head; fresh PDF containers can include changing metadata. Exact fixed-body/style/layout comparisons and original-byte retry checks do not assert that independent fresh PDF renders have identical container bytes.

The helper token protects its HTTP boundary and other-account bootstrap access. It does not protect against compromise of the same signed-in Windows account. Signed updates depend on independent first-install trust, protected owner key custody and deployment permissions. City Windows ACL, SMB, SQL, Outlook and printer verification remains external acceptance.

## Release evidence and operation

The matching verification summary records exact suite/accessibility counts, production hashes, print checks and archive/checksum results. Evidence is separate from deployment and maintained source. Historical prompts, generated bundles as editable source, developer dependencies, operational case data, signing secrets and browser screenshots are excluded from the delivered source/deploy archives.

Use the detailed R50 manual and generated deployment guide. Carry forward the City's R49-ACCEPTANCE-RECORD with added signed-update, deployment-permission, allowlist and local-anchor tests. New mandatory-appearance issuance remains held until actual approved instructions are integrated. No approval fields have been fabricated.

## 17 October startup correction

The delivered 16 October launcher imported sibling Python modules before verifying the exact signed file set. On a writable deployment Python created unsigned __pycache__ files, causing its own inventory check to refuse first installation. The 17 October launcher sets sys.dont_write_bytecode before sibling imports; both batch Python paths use -B and an inherited PYTHONDONTWRITEBYTECODE=1. No inventory exclusions or signature checks are relaxed. Fresh complete extraction is required when the failed folder already contains generated caches. The R50 manual is retained; the generated installation guide documents recovery. The startup regression exercises actual launcher imports, first/repeated installation with a test signature and default interpreter cache settings, and preservation of local settings/unfinished-work sentinels. Native Windows batch execution remains a City acceptance check.

## Orders archive compatibility correction

User-supplied diagnostics showed the complete corrected release identity, no missing/changed program files in the reported checks, and many unexpected files in the existing top-level Orders archive. There was no installed verification pin; the stored source matched the selected deployment. Recognize Orders alongside the established operational data roots without scanning, installing or executing its contents. Restrict the exemption to the top level; retain exact inventory and signed byte checks for application and vendor files. Failed checks report grouped affected locations and precise changed-file names. Preserve existing document paths and local settings. A synthetic archive fixture reproduces the refusal before the correction and checks first/repeated installation, untouched archive bytes, no local archive copy, and continued rejection of added program code. Full City Windows acceptance remains external.

The browser health check now consumes the generated helperVersion directly from the signed build identity rather than deriving it from the release label. Maintenance helper versions can therefore advance while the documented release remains R50. The existing browser assertion still requires a real program/helper Match; it is not removed or relaxed. The legacy packaging test compares the complete helper/package version and checks guide headers against the release label independently.
