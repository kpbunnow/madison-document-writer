# Maintainability architecture audit

Snapshot: October 29, 2026, through the recipient/citation owner, form and
regression continuation following merged batch #319. This supersedes the PR #92
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
| Maintained browser modules | 147 | Writer and Reports; generated/vendor modules excluded |
| Cycles | 0 | Every cycle is rejected; no universal runtime registry |
| Foundation / scoped owner boundaries | 25 / 108 | Exact permitted direct imports, not a behavioral-coupling score |
| Explicit service interfaces, including groups | 118 | No opaque spreads or computed interface keys |
| Largest declared input object | 25 fields | Nested groups counted separately; not total transitive dependencies |
| Root-state importers | 11 | Two cores, three other Reports modules, and six state boundaries |
| Owned Writer root-state fields | 70 | Six disjoint frozen accessor boundaries retain live replacement semantics |
| Core handwritten forwarders / getters | 19 / 8 | Down from measured763 /209; custom native/store/clock adapters remain explicit |
| Deferred composition declarations / resolvers | 98 / 945 | Stateless per-owner adapters; no shared lookup registry |
| JS complexity / nesting findings | 30 / 0 | Complexity >20; nesting >4 |
| Long JS function findings | 92 | 54 enclosing create/init factories and 38 non-factory functions |
| Python C901 findings | 15 | Maintained helper/tools/policy scope, excluding vendor/history |
| Whole-application evaluator files | 67 | Includes fixtures and genuine integration flows; not all are isolated tests |
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

## Remaining work and stopping decision

The numerical complexity, nesting, non-factory length and Python targets are met;
state direction and explicit interface limits are enforced. This does **not** make
M5/M6 complete. The following remain concrete follow-up work:

- Recipient/send/storage/final-confirmation overlays now use screen templates,
  with complete retained HTML and ordered failure comparisons. Inspect other
  remaining fragmented forms in their own feature owners before converting; do
  not mechanically convert historical narrative/print renderers.
- Continue migrating feature regressions that access private bundle bindings to
  their actual public owners. The R31/R32 deposit/pricing and R33 court regressions now compose real owners;
  continue recipient interaction and isolated overlay behavior. Keep real cross-owner lifecycle, startup, browser and print
  integration coverage; moving eval to a shared fixture is not a migration.
- Retire each remaining diagnostic field only after tracing folded JS/helper,
  Python and browser consumers and proving no lost assertions or production-byte
  change. The 67-file inventory is a baseline, not evidence that every file should
  disappear or that the48 hooks are unused.
- Refresh this audit and attach exact-head full-gate evidence after the remaining
  migrations. Do not revive the old blanket architecture-complete claim while
  those tracked migrations are open.

Further structural extraction should address these identified responsibilities or
an observed maintenance problem. Zero cycles does not justify decomposing every
large feature owner. City Windows/network-drive/Outlook/native printing, manual
accessibility, staff/legal and exact PNG-parity acceptance retain their existing
holds. R63/helper build64 and independent formats remain unchanged; no packaging
or deployment is authorized by this audit.
