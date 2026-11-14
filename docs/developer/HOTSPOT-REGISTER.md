# Maintained hotspot register

Measured at Phase 6 starting main `dd584ce02f1375031da7935d6015e82d1f3778a0`, 2026-11-14. [Receipt](maintainability/phase6-structure-2026-11-14.json); [reproduction](MAINTENANCE-MEASUREMENTS.md). This replaces the October register as navigation, preserving that snapshot in history. Include extracted leaves in every census; do not measure only shrinking coordinators.

| Family / file under helper | SLOC | MI | AST functions | Highest available complete-series Radon function |
| --- | ---: | ---: | ---: | --- |
| case_integrity.py | 486 | 5.95 | 32 | VerificationContext.__init__ 18 |
| integrity_verification.py | 82 | 44.67 | 7 | committed_context 13 |
| case_store.py | 1713 | 0 | 122 | _validate_publication_identity 24 |
| cash_validation.py | 71 | 44.17 | 10 | legacy_scheduled_base 13 |
| issuance_validation.py | 54 | 41.51 | 7 | _validate_initial_notice_group 11 |
| server.py | 1540 | 0 | 103 | _validated_catalog_review_request 24 |
| parcel_history.py | 34 | 47.97 | 4 | requests / merge_results 8 |
| index_validation.py | 33 | 61.56 | 3 | summary_casefile 12 |
| case_projection.py | 749 | 0 | 71 | date_ms / Facts.__init__ 16 |
| projection_values.py | 116 | 32.22 | 21 | truthy / jstr 9 |
| citation_pricing.py | 441 | 0 | 42 | _validate_pricing_selection 25 |

SLOC/MI and AST function counts have different denominators. A function can delegate effects not visible in its direct-call AST. `hotspot_inventory.py` is a navigation aid, not an interprocedural proof of purity or lock coverage. Radon complete/CLI and Ruff must remain distinct series.

## Operation, effect and test map

| Operation | Coordinator authority and effect order | Extracted calculations / representative required tests |
| --- | --- | --- |
| Verify/read case | `case_integrity.verify_record`, `VerificationContext`: request-local evidence, anchors/registry, ordered entry/head validation and last-good result. Verification does not publish. | `integrity_verification`; `audit_integrity_verification_phases.py`, `audit_r31_integrity.py`, `audit_integrity_shape_rules.py`, `audit_reporting_inputs.py` |
| Merge/save/issue | `case_store.save_case` and `_save_case`: lock, current head, merge/authoring validation, committed publication/receipt and recoverable side effects. Never infer success from an uncertain response. | `cash_validation`, `issuance_validation`; `audit_case_save_phases.py`, `audit_issuance_group_rules.py`, `audit_store_validation_phases.py`, `audit_authoring.py` |
| Reports/index request | `server.read_index`: fresh inventory/context, bounded ordered reads, consuming-thread verification, per-case exclusion. Summary must match the verified source. No case edits to repair an index. | `index_validation`; `audit_index_validation_phases.py`, `audit_server_reporting.py`, `audit_report_metadata.py`, `audit_report_facts.js` |
| Parcel history | Server retains request/read/verification authority; fallback/live request ordering remains in its coordinator. | `parcel_history`; `audit_calculation_phases.py` and `audit_r34.py` |
| Replay/project | `case_projection.project` applies real case history and immutable identities, then produces reporting facts; no publication. Browser owner is `case_projection.js`. | `projection_values`; `audit_case_projection.py`, `audit_case_projection_phases.py`, `audit_calculation_phases.py`, `audit_policy_mirrors.py` |
| Determine citation | `citation_pricing.validate_pricing`: approved dated policy, prior/staged history, declared basis, mandatory hold and unchanged-correction exceptions. No money normalization of issued facts. | Resolution/history phases; `audit_citation_pricing_rules.py`, `audit_r32_pricing.py`, `audit_violator_pricing.py`, `audit_policy_mirrors.py` |

## Remaining work and reopening rules

Pricing/projection maxima, server catalog review, publication identity and low module MI remain material debt. The developer-tool maximum is now `tools/gate_artifacts.py:select` (32), outside the five runtime families but not outside the measurement scope; `tools/build.py:render_deploy_guide` is 28 and `tools/gate_stages.py:read_stage` 25. They need evidence-preserving changes, not a metric exception.

Reopen a hotspot when its rule changes, a reproduction reveals wrong refusal/effect order, or a small maintenance task cannot be localized. Retain original reference and interruption assertions before changing a coordinator. Keep locks, file writes, network and caller responsibilities explicit; do not introduce broad parameter bags or move a live read earlier just to shorten a function. Each new leaf must remain in runtime manifest, source inventory, high-risk coverage group, dependency checks and this register where applicable.
