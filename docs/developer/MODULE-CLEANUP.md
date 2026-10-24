# Broader module cleanup

Owner authorization: October 24, 2026, after PRs #43 and #44. This is a behavior-preserving module cleanup, separate from the still-deferred screen-shell/CSS baseline work in consolidation Phase 8. Current release and format identities stay unchanged until separately assigned.

## First increment: shared foundations

The first increment extracts shared declarations from app_core and the non-UI rules from new_documents. Callers import the actual owner directly; no compatibility barrel, universal registry, global getter table or duplicate rule implementation is introduced.

| Owner | Responsibility | Dependency direction |
| --- | --- | --- |
| document_types.js | Stable document/event IDs, metadata and approved wording references | Generated approved language and citation policy |
| document_rules.js | Explicit document/authoring predicates, item/date selection, restriction logic | Document metadata only |
| writer_queries.js | Current workspace lookups, frozen/correction source precedence, record-head queries | state, inspector data and document rules |
| presentation_format.js | HTML/selector escaping, fill-in markup and monetary text | No imports |
| record_values.js | Existing JSON snapshot copying and stable event ordering | No imports |
| calendar.js | Existing day arithmetic and time formatting helpers | Shared recordDay only |
| mailing_rules.js | Mailing facts, organization classification and state codes | No imports |

ESLint disallows direct DOM, browser-storage and network globals in these seven modules. These modules do not register listeners, initialize/restore workspace state, call the helper or render screens. Queries read WriterState at call time, so replacing arrays during restoration remains visible. eventsFor retains its established lazy per-case array creation; clearProhibitedCitations deliberately mutates only an eligible argument. They are not represented as immutable operations.

app_core retains service composition, state initialization and global listener/startup order. The schema consumer check now reads document_types, its new source owner, and still compares the same schema value against version.json. new_documents retains editing, authorization, context validation and UI actions.

The static module graph counts maintained top-level JavaScript imports/re-exports and literal dynamic imports, including the conditional test-fixture module; generated data/vendor modules are outside this graph. At the start there were 45 modules with cyclic components of 26 (Writer) and 5 (Reports). This increment has 52 modules, with components of 25 and 5: reviewed_library no longer depends on startup. More modules here means explicit ownership, not more runtime features.

`node tools/module_graph.cjs` prints the dependency inventory without evaluating the application. audit_module_boundaries checks the foundation import layers, keeps those layers outside UI cycles, caps the two retained cycles, exercises re-export/dynamic/self-cycle detection and loads the extracted public APIs without a DOM. It also checks live workspace replacement, frozen/correction precedence, referral identity and historical authoring cutoffs. Existing functional and print assertions remain authoritative.

## Following increments

Continue through focused, separately reviewable changes:

1. Extract global input/change/click handlers into feature-owned registration functions. Keep explicit registration at the original startup positions, preserve order/default-prevention/focus, and test that handlers register once. Avoid moving a listener merely to reduce a line count.
2. Separate remaining pure event migration/projection rules from UI/storage adapters. Keep frontend/helper parity, event identity, integrity and recovery boundaries, and frozen authoring readers.
3. Reduce the remaining Writer cycle through scoped service dependencies and lazy callbacks only where needed. Keep service composition explicit; never turn the former shared core into a new universal registry.
4. Address the Reports cycle independently, preserving verified projection inputs and table/export/print ordering. Remove proven-dead names only after checking test-build eval access and public exports.

Each increment updates the code map, source inventory, test index and this status. Narrow the graph guard as cycles are eliminated; never raise the cycle cap to accommodate accidental coupling. Existing filenames, stored keys/IDs, installed names and history remain compatibility contracts.

## Verification and merge

Run the complete gate on the final committed source and report actual regression/accessibility/print counts plus source/toolchain evidence in the PR. Preserve every historical assertion, frozen print reference, screen style and deadline. Keep measured browser work serial. Follow DEVELOPMENT-STANDARD.md's owner-approved free-plan merge policy; no automatic merge, release assignment, packaging or deployment is part of this increment. City/native/legal acceptance remains separate.
