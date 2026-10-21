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
