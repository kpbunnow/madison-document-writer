# Maintainability architecture audit

Snapshot: October 29, 2026, at the conclusion of the batch B1–B11 maintainability
plan (merged through #339). This supersedes the PR #92
measurement snapshot. It reviews the resumed maintainability work; it does not
claim completion of every remaining screen/test migration, release approval or
native acceptance. The exact final integration head must pass GitHub Full gate
and PR format before merge.

## Measured structure

Reproduce with `node tools/module_graph.cjs`, `node tools/service_interfaces.cjs`,
`node tools/test_seams.cjs` and `node tools/complexity_report.cjs --report`.
`audit_module_boundaries.js`, `audit_scoped_architecture.js` and
`audit_test_seams.js` enforce the corresponding boundaries and ratchets.

| Measurement | Current source | Meaning and limit |
| --- | ---: | --- |
| Maintained browser modules | 149 | Writer and Reports; generated/vendor modules excluded |
| Cycles | 0 | Every cycle is rejected; no universal runtime registry |
| Foundation / scoped owner boundaries | 25 / 108 | Exact permitted direct imports, not a behavioral-coupling score |
| Explicit service interfaces, including groups | 118 | No opaque spreads or computed interface keys |
| Largest declared input object | 25 fields | Nested groups counted separately; not total transitive dependencies |
| Root-state importers | 11 | Two cores, three other Reports modules, and six state boundaries |
| Owned Writer root-state fields | 70 | Six disjoint frozen accessor boundaries retain live replacement semantics |
| Core handwritten forwarders / getters | 19 / 8 | Down from measured763 /209; custom native/store/clock adapters remain explicit |
| Deferred composition declarations / resolvers | 98 / 945 | Stateless per-owner adapters; no shared lookup registry |
| JS complexity / nesting findings | 3 / 0 | Complexity >20; nesting >4; all three are the frozen print renderers (D1) |
| Long JS function findings | 48 | 44 enclosing create/init factories (capped by the ratchet) and 4 frozen print renderers (D1) |
| Python C901 findings | 5 | Maintained helper/tools/policy scope, excluding vendor/history |
| Whole-application evaluator files | 67 | 60 classified integration with a reason, 7 migratable with an owner; a new unclassified file fails the gate |
| Split string literals in screen modules | 0 | Ratcheted per file by `tools/markup-baseline.json`; 131 print/issued and 60 approved-wording sites are listed, not ratcheted |
| Retained test hook fields | 48 | No hook is removed merely because a text search finds no consumer |

Counts are structural evidence, not a quality score. Baselines only decrease after
reviewed, measured improvement. Historical assertions, deadlines and frozen
references are not rewritten to satisfy them.

## Ownership and interfaces

Core remains the composition, state initialization and registration root. Writer
services use bounded workspace/editor/startup/catalog/recovery/import state
accessors. Reports retains its read-only model, catalog, presentation, services,
filter/navigation/return and spreadsheet owners. The map configuration is separate
from the retained workbook/report metadata inventory; `audit_report_facts.js`
continues to verify the original declarations unchanged.

| Reviewed interface | Fields | Decision |
| --- | ---: | --- |
| Language catalog; editor event actions group | 25 each | Retain coherent guarded feature actions; no blanket state bag |
| Repaint coordinator; Reports screens | 24 each | Preserve ordered transaction and explicit fact/spreadsheet subgroups |
| Document renderer; reinspection events | 23 each | Keep frozen render inputs separate from mutable workflow effects |
| Safety events | 22 | Delegate save/publication authority; preserve first-match routing |
| New documents; import workflow; workflow events; workspace case group | 21 each | Preserve feature-specific sequencing and named lazy leaves |
| Document delivery | 20 | Authenticated immutable receipt/PDF authority remains in helper owners |
| Editor screen groups | 8 UI /5 editing /19 record | Explicit responsibility groups replace the earlier flat32-field surface |

A25-field limit does not prove independence. Reviewed responsibilities still span
multiple effects, particularly creation/import/repaint/delivery. Splitting them
solely to improve field counts would obscure ordering. Retain call-time getters
where startup/restoration or callbacks replace data or services. Do not collapse
scoped interfaces into a universal fixture or production registry.

## Startup, failures and security authority

`audit_event_registration.js` retains all60 listener checkpoints and capture
phases. `audit_writer_startup.js` checks lock lifetime, required restoration,
readiness settlement and failures at original stages. `audit_repaint_keepers.js`,
`audit_screen_dependencies.js` and editor regressions cover focus/caret, active
editing, stopped/locked/restoring/failed barriers and ordered enhancement.

The resumed batch preserves early refusal and partial effects: ordinary merges
retain source ancestry, Reports filter changes read live state, map facts do not
expand metadata ownership, and helper-stop observation stays at its startup
checkpoint. New screen templates retain complete supported HTML and ordered
service access. `raw` marks existing escaped values, owned renderer fragments or
fixed tokens; it is not an input-sanitization substitute.

Helper validation, verified projections, integrity, publication locks, immutable
original PDFs, receipt binding and held-write readiness retain their owners.
Screen tests cannot establish durable persistence or City/native acceptance.
No release identity, trusted connection, vendored dependency, stored format,
approved print style or historical print reference changes in this batch.

## Regression review and delivery evidence

Corrected integration #311 records exact #297–#305 and #307–#310 source SHAs,
baseline main and dependency closure. Failed #306 is excluded. The first #311
head passed317 of318 regression suites; usability phase1 failed because it still
imported the diagnostic fixture removed in #309. Correction
`2d15668266c49a24131b7a8d4947b67c39551e14` changes only that source reader. All
original usability assertions and `audit_report_facts` pass locally. The new
combined Full gate must pass; the failed head is not passing evidence.

Writer checkpoints #312–#315 and the subsequent overlay checkpoint add2048 chooser,512 complete frame,4096 detail-form and3072 overlay
comparisons against retained original owners, preserving HTML, state and callback
failure order. The migrated shell-escaping suite retains all10 original assertion
ASTs and composes real shell/case-action/editor owners without startup. Existing
R26/R46/R54/R62, usability, special-rule and editor checks remain unchanged.
Six unconsumed test-build retention properties are subsequently retired after
folded JS/helper, Python and browser review. Names inside retained owner fixtures
are private definitions/calls, not core diagnostic consumers. Reports production HTML is byte-identical. Writer bundle changes are limited to
removed unused plain-object aliases and incidental bundler binding names, verified
by normalized production AST comparison; public owner methods remain. The test-hook baseline decreases54 to48. Local JSDOM/owner results
do not replace pinned-Chromium CI evidence.

The next recipient/citation continuation moves unchanged line formatters into the
existing address owner, retains all 19 R31, 22 R32 and 15 R33 assertion ASTs in
focused real-owner compositions, and adds 8,192 line-format plus 4,096 deposit-form
and 4,096 citation-review comparisons. Exact frozen legacy citation faces and the
3,872-case Python price corpus remain unchanged. The form conversion removes one
non-factory length finding; citation review falls from 316 to 155 lines. The
initial-citation narrative and all non-presentation methods remain unchanged.
Exact-head Full gate/PR format are required for this new delivery batch.

## Behavior-preserving method

Every refactor in batches B1–B11 followed one method. A frozen copy of the original function or module is kept in `tests/fixtures/*_reference.txt` (or the retained `.cjs` snapshot). A comparison compiles current and retained code, drives seeded scenarios, and compares results, thrown errors, the order of every peer read and call, and state or DOM effects, including refusal on each interrupted read or call. The comparison lands in its own commit and must pass on the unchanged source before the refactor commit. Deliberate mutations then prove the comparison has teeth; a surviving mutant must be explained as equivalent or the scenarios strengthened (several were, including empty tables and oversized paragraphs in pagination and dropped issued fields in `startCorrection`). No assertion, golden, hash or deadline was edited to pass.

## Exception register

Each accepted finding, why it stays, and the condition for reopening it.

| Finding | Count | Reason accepted | Reopen when |
| --- | ---: | --- | --- |
| Print renderers in `document_render.js` (`noticeHTML`, `citationFaces` and their inner functions): length 446/270/242/228, complexity 55/55/75 | 4 length, 3 complexity | D1: issued-document bytes are protected by frozen references and approved-print parity; splitting risks historical rendering for no behavior gain | The owner approves a print-renderer change with byte-parity evidence, or a new document family is added |
| Enclosing `create…`/`init…` factories over 80 lines | 44 | D3: factories are composition roots whose size is declared interface, not logic; only `createAccelaImport` and `initNewDocuments` were split. The per-function baseline stops any factory growing | A factory gains logic, or the owner asks for further shrinking (see the factory discussion in the batch B11 PR) |
| Python functions over complexity 10: `read_index` 30, `launch.main` 24, `verify_record` 20, `CaseIntegrity.__init__` 19, `file_lock` 13 | 5 | Security-sensitive helper code (integrity, locking, launch) where each branch is a refusal; further splitting needs equivalence seams of the B8 kind | Any of them changes behavior, or the owner authorizes the same method for them |
| Whole-application evaluators | 60 integration, 7 migratable | They create, edit and issue documents or drive startup, storage and screens across owners; rewriting them would change assertions | A test is rewritten for another reason, or the owner funds a migration |
| Retained test hook fields | 48 | Read by the integration evaluators above (for example `noticeHTML`, `citAmount`, `editorReadiness`); retiring one needs every consumer traced and no lost assertion | The last consumer of a field migrates |

## Maintainability contract

New and changed code keeps these rules; the gate enforces the first three.

1. Complexity, nesting, function-length and Python complexity may not rise above `tools/complexity-baseline.json`; lower it when a function improves.
2. Screen modules may not gain split string literals (`tools/markup-baseline.json`). Use a template or one literal.
3. A new whole-application evaluator needs a class and reason in `tests/fixtures/test-seam-baseline.json`; prefer a real-owner composition with explicit test services.
4. Refactoring a function that renders markup, builds a record, orders effects or reads peers first needs a retained-original comparison in its own commit, as above.
5. Keep factories as composition: put logic in module-level functions that take explicit services, ordered tables or named phases. Keep the original variable names in places where engine error messages embed them.
6. Do not change identities, goldens, print references or the screen-shell reference to satisfy a metric.

## Remaining work and stopping decision

Batches B1–B11 are complete. Numerical complexity and nesting targets are met outside the recorded exceptions, and Python complexity is down from 13 to 5. State direction, owner boundaries and interface limits are enforced. Functionality development may resume under the contract above.

The register records what is deliberately left. Items that need an owner decision rather than more behavior-preserving work are the shrinking of the factories and the evaluator and hook migrations. The screen split literals were converted afterwards (see the plan's template-conversion entry).

City Windows, network-drive, Outlook and native-printing acceptance, manual accessibility checks, staff and legal review and exact PNG-parity acceptance retain their existing documented owners. Automated tests do not establish them.

R63/helper build 64 and independent formats remain unchanged; no packaging or deployment is authorized by this audit.
