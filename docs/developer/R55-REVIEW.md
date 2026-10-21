# R55 consolidation corrections

Development baseline: main `8613bbb70d2c3cd1faf086a7050002b0ec4330f2`.
Identity: 2026-10-21 R55, helper 2026.10.21.56, helperBuild 56.
Authoring 12, case schema 5, summary 6 and workspace backup 2 are unchanged.

## Changes

Verification binds every deployment input, generated helper configuration and identity,
installation guide and release document to its exact tested bytes. Packaging checks
those inputs before and after assembly and retains the independent installer verifier.
Source archives use an explicit reviewed inventory, reject unowned maintained inputs
and links, and omit local environments, credentials and operational files.

Current inspection guidance uses the R53 type/status rules: Completed is refused.
The main manual includes that matrix; its HTML, Word and PDF editions are regenerated
from Markdown. Current security wording describes manifests, independent package
verification and deployment-folder permissions without implying a signing key.
Acceptance wording and package links are corrected without closing approvals.

This candidate also carries the post-R54 snow focus fix, renderer extraction,
approved-language data extraction, narrower exports and centralized helper route guards.
The retrospective consolidation record and fixture index preserve provenance.

## Post-PR #16 corrections

Baseline: main `66b344c`. The R55 package had not been distributed, so the
identity is retained (release owner confirmation). Four reproduced defects are corrected:

1. Explicit UTF-8: helper and tool text no longer depends on the Windows code page.
   A valid Unicode case previously failed citation-history review and anchoring under
   CP1252 and was reported as changed outside the program. Stored bytes,
   canonicalization and refusal of altered or malformed records are unchanged.
2. PDF publication: outbox transfer and direct filing share one per-name lock and a
   publication that never replaces a name, so a concurrent filing can no longer be
   silently overwritten. Conflicts keep the outbox copy.
3. Staged inventory: packaging verifies every staged file with no exclusions and
   archives only approved, re-hashed file sets; a planted `.env` is refused.
4. Manual generation: editions are staged, validated and replaced together, and each
   carries a source digest checked by the gate; PDF inspection is required.

New acceptance item C10 (native Windows Unicode case) and an extended P3 are open.

## Post-PR #17 corrections

Baseline: main `dfe0687`. Identity retained (no R55 package distributed; release owner
to reconfirm before packaging). Formats unchanged.

1. Reports summaries: the verified case is the authority for reportable facts. The
   helper projects each case with helper/case_projection.py, an exact mirror of the
   Writer's summarize() checked against the real function over generated and captured
   cases, and excludes a summary whose fields differ, even with a valid, anchored case
   and an unchanged sourceRevision. Reports explains the exclusion and the rebuild;
   the helper refuses to write such a summary. Case bytes and history are untouched.
2. Policy tooling reads and writes UTF-8 explicitly, so the deposit provenance check
   passes on Windows code pages. Approved policy data is unchanged.

## Post-PR #18 correction

Baseline: main `e3f3828`. Summary fields are compared as RFC 8785 canonical JSON on both
the write (save_summary) and read (read_index) paths. Python equality had accepted
`noticeActive: 0` for a withdrawn notice's `false`, which Reports (`!== false`) counts as
active; that summary is now refused and excluded. Numeric equivalence (197 and 197.0)
and key-order independence are kept; non-finite or out-of-range numbers never match.
Case-history canonicalization is unchanged.

## Retained R54 extension decisions

The R54 review and screenshots remain in source under docs/history/R54-REVIEW.md
and docs/history/r54-images/. These decisions remain in force:

1. Best Interest and Vacancy Extensions retain their supervisory signer after the table.
2. Show the new due date; keep previous dates in the record.
3. Conditional vacancy labels do not replace stored repair dates.
4. List all items, including unextended and corrected items, with regular ordering and rulings.
5. Reuse regular Extension CC handling.

The regular Extension is unchanged. Authoring-11 and earlier special extensions and
corrections retain their historical rendering. Approved wording, frozen fixtures,
all four court copies, integrity checks and the mandatory-appearance hold remain protected.
Native side-by-side extension printing remains acceptance item P7.

## Verification and acceptance

Run the complete pinned-browser gate for the final tree. Actual outcomes are recorded
in docs/developer/R55-IMPLEMENTATION.md and exact evidence under build/verification/latest/.
The pre-development baseline passed 132 suites, 269 axe checks and 69 print variants;
those results do not establish verification of this changed candidate.

City Windows, permissions/SMB/SQL, Outlook, native printing, staff/accessibility,
performance and L1–L5 decisions remain open. This development review does not authorize
packaging, publication, deployment or acceptance signoff.
