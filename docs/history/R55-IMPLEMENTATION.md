# R55 implementation record

Branch: develop/r55-consolidation-corrections. Baseline: 8613bbb.
User authorization: implement the uploaded consolidation development handoff.

D1–D2: implemented deployment-byte evidence, staged copy checks, explicit source
inventory and synthetic real-packager refusal/exclusion tests.
D3–D6: reconciled import/security guidance, retained acceptance IDs and holds,
prepared R55/build 56, preserved the R54 review/screenshots in history, and added
reproducible manual regeneration from Markdown.
D7: active fixtures retained; ownership and move criteria documented.
D8: history retained in source distributions/fingerprints and excluded from deployment.
D9: retrospective consolidation record retained with honest provenance.
D10: obsolete generator/evidence path pointers corrected.

Optional startup redesign, broad suite renaming and remote branch cleanup are deferred.
No City approval is inferred. No release packaging, publication or deployment is performed.

## Actual validation

Targeted checks passed: six release-input tests (including real synthetic ZIP packaging),
two documentation checks (including PDF text where pdftotext is installed), the existing
release-evidence test and seven layout/setup contracts. Ruff pyflakes passed and the
R55 production build succeeded.

The final full-gate outcome is retained in build/verification/latest/verification.json,
build/test-results/results.json and the checkpoint commit verification notes. These
exact-byte records, rather than a self-modifying source document, establish whether
the final candidate passed. A checkpoint is not release or City approval.

## Post-PR #16 corrections

Branch: fix/post-r55-corrections. Baseline: 66b344c. User authorization: implement the
post-PR #16 correction handoff; the release owner confirmed no R55 package was
distributed, so R55/build 56 is retained.

D1: explicit UTF-8 for helper and tool text and text subprocesses (audit_utf8_io).
D2: one per-name lock and no-replace publication for every filing-folder PDF write
(audit_pdf_publication).
D3: complete staged-file verification and archives from approved hashed sets
(audit_release_inputs).
D4: staged, validated, journaled manual publication with a source digest; PDF
inspection required (audit_manual_publication, audit_r55_documentation).

Each new test fails against the previous code: implicit encodings and the CP1252
history/anchor failure, the overwritten direct filing, the planted `.env` in the
source and aggregate ZIPs, and mixed manual editions after a PDF failure.
The regenerated PDF edition was printed with Chromium 141 through DW_BROWSER because
the pinned browser download is blocked here; regenerate it with the pinned browser
before release. Gate outcomes are recorded in build/verification/latest/ and the
pull request, not in this file. No packaging, publication, deployment or City
approval is performed or implied.

## Post-PR #17 corrections

Branch: fix/reporting-projection-and-policy-utf8. Baseline: dfe0687. User authorization:
implement the remaining-corrections handoff; the projection was chosen by the user
(helper-side Python mirror of summarize(), not a browser recomputation).

D1: helper/case_projection.py and build/generated/projection_tables.json (deployed);
read_index validation with a "mismatched" coverage category and per-process memo of
matching byte pairs; save_summary refusal; Reports coverage, data screen and export
metadata (audit_case_projection, audit_report_projection, audit_report_mismatch).
D2: explicit UTF-8 in policy/ and the encoding audit extended to it (audit_utf8_io).

Reproductions against the previous code: the altered anchored summary was accepted
with valid: true, anchored: true and no warning; the provenance check failed under
simulated CP1252 with "Schedule differs from division table/review provenance:
app/assets/deposits.js". Existing fixtures that wrote placeholder version-6 summaries
now write real projections; their assertions are unchanged.

Projection cost: about 0.07 ms for a minimal case and 2.5 ms for the largest generated
case (12 KB), once per changed summary/case pair per helper process. The manual PDF
was again printed with Chromium 141 through DW_BROWSER. Gate outcomes are recorded in
build/verification/latest/ and the pull request, not in this file. No packaging,
publication, deployment or City approval is performed or implied.

## Post-PR #18 correction

Branch: fix/projection-type-comparison. Baseline: e3f3828. case_projection compares
summary fields with the vendored RFC 8785 canonicalizer (same_json) instead of Python
equality; canonical() is removed. Reproduction against the previous helper: the
withdrawn notice's summary with noticeActive 0 was saved, read with no mismatch on an
anchored case, and counted one case in Cases by inspector instead of zero. Parity
assertions now compare canonical JSON text and check every corpus boolean's type.
No packaging, publication, deployment or City approval is performed or implied.

## Post-PR #19 correction

Branch: fix/reporting-metadata-validation. Baseline: e6a599f. read_index rejects a
non-text sourceFile and a case file that is not an object with a case object as
per-summary ValueErrors (unreadable coverage); no broader exception handling was added.
verify_record was probed with malformed events/integrity/schema types and already
reports them as invalid. Reproduction against the previous helper: integer, float,
true, non-empty array and object sourceFile values and non-object case files returned
HTTP 500 from /reporting/index; falsy non-text values were silently accepted.
No packaging, publication, deployment or City approval is performed or implied.
