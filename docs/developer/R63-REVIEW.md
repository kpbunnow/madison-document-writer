# R63 release review

Release 2026-10-24 R63, helper 2026.10.24.64 (build 64), authoring 16; case schema 5, summary 6 and workspace backup 2 unchanged. R63 is the first package since R61 (2026-10-23 R61, helper 2026.10.23.62, build 62). The intermediate label 2026-10-23 R62 (build 63) was a development identity and was never packaged. This review is release evidence, not City acceptance.

## Contents since R61

- **R62 Development 3** (PR #34; see R62-REVIEW.md): import status table with No Fee statuses and hidden rows; authoring-16 Best Interest and Vacancy Extensions covering every uncorrected item; notes under the violation on new referral, referral-update and compliance documents; referred cases limited to Update for Case Referral and Compliance Letter.
- **Consolidation phases 1–7** (PRs #35–#37, #39–#42): imported addresses escaped once in screen titles and the deploy-ZIP name corrected in staff instructions; faster test teardown, projection capture reuse and a fast development tier; verified dead code removed; one referred-case rule; modules and tests organized by feature; documentation rewritten by feature. Rendered documents were compared against main at every phase and unchanged.
- **Import status validation** (PR #38): statuses and case numbers spelled like inherited object properties are ordinary text.
- **Post-consolidation corrections** (PR #43): Writer restores saved drafts before editing, saving or navigation, and shows a reload/retry screen when a required storage read fails; shared report views accept all eleven report types; release identity validation and immutable-publication checks; pinned CI and the PR template.
- **Merge policy** (PR #44): the free-plan merge policy is followed by hand.

## Identity and publication

- version.json, package.json and package-lock.json carry the R63 identity; tools/version_schema.py validates it (matching release/helper dates, helperBuild 64).
- The publication baseline is the retained R61 deployment manifest (SHA-256 fd898f109343896ceb77b13abc7724d4c4d4c82638db50baa3f7f3b396340933, inside the R61 deploy ZIP whose published SHA-256 is 006f0310d9935185329788fc3873e456de38bd1a79b47e8f4493d52cfa466492). R63 advances the release number (61 → 63) and helperBuild (62 → 64) without calendar rollback.
- Authoring, case schema, summary and backup versions are unchanged, so no data migration is needed. Documents issued under R61 keep their formats.

## Rollback

Retain the complete R61 package. Before rolling back from R63, finish or discard unfinished drafts and corrections: R61 cannot render authoring-16 Best Interest or Vacancy Extensions or authoring-16 history-note placement, so rely on retained original PDFs for documents issued under R63. A runtime rollback does not reverse issued records.

## Acceptance

R63 adds S63-1 and S63-2 (ACCEPTANCE-RECORD.md). S60–S62 and all carried City, native, staff, legal and seasonal items remain OPEN. Automated verification records technical evidence only.
