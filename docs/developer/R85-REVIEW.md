# R85 release review

Release 2026-11-16 R85, helper 2026.11.16.86 (build 86), authoring 16; case schema 5, summary 6 and workspace backup 2 unchanged. R85 follows R84 (2026-11-16, helper build 85). This review is release evidence, not City acceptance.

## Contents since R84

- **Initial citation presentation** (PR #536):
  - **Workspace** lists the delivered citation once. A paired notice is hidden only while its citation packet is present.
  - **Drafts:** initial citation drafts render the issued citation heading and the approved initial-citation body.
  - **Layout:** a packet whose items are all undated citation-only freezes the optional `omitRepairDueDate` fact and omits the repair column. Corrections carry the source layout, and the helper refuses a correction that changes it.
  - **Validation:** the helper accepts the fact only for initial notices and citations whose items are all undated citation-only.
  - **Older packets:** earlier issued packets without the fact keep their column.

## Review before packaging

- **Change scope:** the runtime change touches the browser render, rules, sources and Workspace owners, plus `case_store.py` and `citation_disposition.py`. No helper module is added, and every helper module is declared in the runtime manifest.
- **Layout rule:** the layout decision reads the frozen fact first, then the correction record, then the draft state, so issued records never change layout after an update.
- **Wiring:** the editor's new display-type read uses `record.initialCitations`, which app_core already composes.
- **Result:** no defect was found.

## Identity and publication

- `version.json`, `package.json` and `package-lock.json` carry the R85 identity. `tools/version_schema.py` validates it (matching dates, helperBuild 86).
- Policy compatibility: `tools/policy-compatibility.json` was reviewed for the identity change.
  - Only the release and helper identity advance. Authoring, case schema, summary and backup formats are unchanged.
  - `omitRepairDueDate` is an optional frozen presentation fact within authoring 16.
  - The recorded identity is updated to R85.
- Publication baseline: R85 is packaged against the retained R84 deployment manifest with `--published-manifest`.

## Rollback

A PC on R85 cannot be rolled back, because downgrade protection pins build 86. Install R85 on every PC that shares the case folder and restart Document Writer once. A PC left on R84 is told to restart and cannot save to the shared folder.

## Acceptance

R85 adds S85-1 and S85-2. The three-copy MC-2000 print, external Accela closing, and the existing legal and mandatory-appearance holds stay with City acceptance. All other carried items remain OPEN. Automated verification records technical evidence only.
