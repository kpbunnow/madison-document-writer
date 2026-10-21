# Fixture ownership

Committed fixtures are maintained source, not disposable caches. They ship only in
source distributions and never in inspector deployment folders.

| Inputs | Owner and active consumers |
| --- | --- |
| reference/R49-print-golden.json | Frozen historical print body/style and renderer security; audit_r50_documents.js and audit_r50_renderer.py |
| reference/R51-authored-print-golden.json | Exact authored print content, pagination and court copies; audit_r50_documents.js |
| reference/R50-Frozen-Print-Style.json, R51-R50-parity.json | Approved print stylesheet and normalized shell parity; repository/layout regressions |
| reference/R53-extension-rendering.json | Regular/historical special extension rendering; R54 regressions |
| reference/Document-Generator-Import.rdl | Fixed SQL/query provenance; audit_lookup.py and audit_r39.py |
| reference/r45-import-fixtures/, r50-import-fixtures/ | Synthetic workbook bytes; import/browser regressions |
| reference/*-print-fixture-payload.js | Test drivers for authored print baselines; retain with their baseline consumers |
| reference/new-documents/, Order-Language-Library-Source.xlsx | Original division templates/source provenance; preserve originals and hashes pending a separate consumer/provenance inventory |
| Other reference JSON/text and fixture helpers | Retained compatibility/provenance and test infrastructure; direct filename searches alone cannot prove absence of dynamic consumers |

R55 intentionally moves no fixtures. A later move must inventory direct and dynamic
consumers, provenance references and hashes, preserve content exactly, update references
and pass the full gate. Confirmed inert historical output may move to docs/history/;
original templates/workbooks may move to docs/sources/ after that audit. Never regenerate
an approved golden file or assertion to accommodate housekeeping.
