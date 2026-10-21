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
