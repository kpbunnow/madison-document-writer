# R67 current pitfalls

Grouped by area. Release-by-release history is in CHANGELOG.md and docs/history/.

## Documents and historical formats

- Every document renders in the authoring version it was issued with. Keep authoring-11 and earlier special extensions and their corrections on the historical renderer. Do not downgrade or upgrade a draft's authoring version during pricing refresh, publication or correction: authoring-15 Best Interest drafts and authoring-13 Vacancy drafts keep their formats, and only new drafts and explicit adoption use authoring 16. New scoped orders keep authoring 13.
- Conditional vacancy labels are presentation, not replacement repair dates, and exist only for authoring-12 and earlier reprints; never create a conditional Vacancy Extension.
- Compliance history is a presentation capability, not referral status. Use isReferredCase for the live referred-case rule; correction checks that exclude their own source keep their own predicate.
- Do not re-add a stylesheet rule for authoring-16 history notes: the approved print style hides it-note on corrected rows, so those notes carry an explicit display.
- Never change a charge, date, time or wording merely to bypass a refusal. Keep the mandatory wording hold and immutable historical sources.

## Inspection import

- Import eligibility must use the defined result table, not a literal Completed-only comparison. Never treat a status label as proof of prior program issuance or allow an unknown result silently.
- A used inspection is hidden only after the shared record is merged; the plan clears a selection that becomes hidden.

## Records, integrity and recovery

- Never skip integrity/history/publication checks, regenerate genesis, overwrite protected anchors or publish a migration registry ahead of a recoverable case write.
- Write anchor receipts only with `create_only_write` (create new, write once, no temporary file). The protected anchor folder may let the account add files but not rename, replace or delete them, so `atomic_write` (temporary file, then rename) fails there and leaves an unremovable temporary file. A receipt that cannot be parsed fails verification closed with a message that IT must remove it.
- Write anchor receipts only with `create_only_write` (create new, write once, no temporary file). The protected anchor folder may let the account add files but not rename, replace or delete them, so `atomic_write` (temporary file, then rename) fails there and leaves an unremovable temporary file. A receipt that cannot be parsed fails verification closed with a message that IT must remove it.
- Never infer orphaned-lock ownership from age. Recovery requires the inspected token, verified stopped ownership, named administrator and reason.
- Never claim a pending browser write is saved, treat unknown outbox/health as zero, silently overwrite a conflict or replace current typed work with a delayed response.
- summarizeRecord() in case_projection.js (called by the case_summary_adapter.js summarize adapter) and helper/case_projection.py are one projection in two languages. Change them together, with the mirrored tables; audit_case_projection compares them over generated and captured real cases. Never accept a cached summary field the projection of the verified case does not reproduce, and never repair a summary by editing the case. Compare summary values as canonical JSON (case_projection.same_json, RFC 8785), never with Python ==, which treats false as 0 and true as 1 where Reports does not.

## PDFs and filing

- Never regenerate a PDF original after a lost acknowledgement when a retained operation receipt exists. Verify case/document/version/source and exact bytes.
- File PDF originals only through server.file_pdf_bytes. It holds the per-name "issued-pdf" lock, compares bytes and publishes with publish_new, which never replaces a name. Never add another lock key, an existence check outside that lock or a replacing write for a filing folder; remove an outbox copy only after the shared copy reads back identical.

## Security and connections

- Never trust shared configuration to select a new outbound host, SQL server or integrity anchor. Change the allowlist in trusted-connections.json in a new release built by the release owner.
- Never obtain a session token from a public page or include it in logs, reports or shared files. Keep user-profile bootstrap access private; reload through the original profile after restart.

## Installation and packaging

- Never run a shared launcher as the root of trust for its own first installation. Check the initial deploy ZIP SHA-256 against the release owner’s independently published digest, then use the locally installed verified shortcut.
- The manifest catches mistakes and damaged copies, not someone who can rewrite both the files and the manifest. Never weaken the deployment folder’s NTFS permissions (release owner write, inspectors read).
- Never put generated source, developer dependencies, historical development prompts or operational records in deployment packages.
- Archive only an approved path-to-SHA-256 set through release_inputs.archive. Never traverse a staging folder for archive content or verify it through an excluding fingerprint.
- Regenerate manual editions only with tools/build_manual.py, which stages, validates and replaces all three together. Never hand-edit or copy a single edition; every edition carries the current source digest.

## Encoding

- Name UTF-8 for every helper and tool text read or write and every text subprocess. The Windows default code page is not UTF-8; audit_utf8_io refuses implicit encodings. Keep strict decoding: never accept BOM, UTF-16 or replacement characters in case or integrity data.
- Policy scripts follow the same explicit UTF-8 rule as helper/ and tools/; audit_utf8_io scans all three.

## Testing

- Never run concurrent Chromium jobs during a measured browser performance gate. JSDOM cannot prove layout, SQL text equality cannot prove City connectivity, and mocked Outlook cannot prove native delivery.
- Keep each feature-suite scenario self-contained: it runs in its own process (tests/fixtures/scenarios.cjs), so it cannot rely on state from another scenario. A browser launch in a shared helper is still found by tools/suite_classes.py; keep its rule when moving browser calls.
