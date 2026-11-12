/* Issued history is linked directly, read-only and newest first; drafts retain their existing editor route. */
const assert = require("node:assert/strict");
const { JSDOM } = require("jsdom");
const { compile, listenerTarget } = require("../fixtures/equivalence_harness.cjs");
(async () => {
  const {
    WriterState: s,
    orderedCaseDocuments,
    workspaceDocumentsSummary,
    workspaceDraftDocuments,
    createWorkspaceEvents,
  } = await compile(
    [
      'export {orderedCaseDocuments,workspaceDocumentsSummary,workspaceDraftDocuments} from "./workspace_documents.js";',
      'export {createWorkspaceEvents} from "./workspace_events.js";',
    ].join("\n"),
  );
  const k = { id: 'case<&"', address: "<img src=x onerror=alert(1)>", number: 'CASE<&"' };
  const issued = {
    id: 'issued<&"',
    caseId: k.id,
    type: "notice",
    draft: false,
    mailed: "2026-11-05",
    filedAt: "2026-11-05",
    filedArtifact: { filename: "original.pdf", sha256: "a".repeat(64) },
  };
  const docs = [
    { ...issued, id: "old", mailed: "2026-11-01", superseded: true },
    { ...issued, id: "withdrawn", mailed: "2026-11-06", void: true },
    issued,
    { ...issued, id: "draft", created: "2026-11-07", mailed: "", draft: true },
    { ...issued, id: "revision", mailed: "2026-11-04", revision: { number: 2 } },
  ];
  Object.assign(s, {
    DOCS: docs,
    CASES: [k],
    state: { docId: "old", modal: null },
    ARTIFACT_LOCATIONS: {},
    ARTIFACT_VERIFY: {},
    ARTIFACT_IDENTITY: {},
  });
  const before = JSON.stringify(s),
    parse = (text) => new JSDOM(text).window.document;
  let document = parse(workspaceDocumentsSummary(k, docs));
  assert.deepEqual(
    [...document.querySelectorAll("[data-open]")].map((e) => e.dataset.open),
    ["withdrawn", issued.id, "revision", "old"],
  );
  assert.deepEqual(
    [...document.querySelectorAll(".case-document-date")].map((e) => e.textContent),
    ["11/06/2026", "11/05/2026", "11/04/2026", "11/01/2026"],
  );
  for (const label of ["Withdrawn", "Replaced", "Revision 2"]) assert.ok(document.body.textContent.includes(label));
  // A status stays with its own date, so it cannot wrap onto a line of its own (review of PR 474).
  assert.deepEqual(
    [...document.querySelectorAll(".case-document-state")].map((e) => [e.parentElement.className, e.previousElementSibling?.className]),
    [...document.querySelectorAll(".case-document-state")].map(() => ["case-document-meta", "case-document-date"]),
  );
  for (const button of document.querySelectorAll("[data-open]")) {
    assert.equal(button.textContent, "Official Notice");
    assert.ok(button.getAttribute("aria-label").startsWith("Official Notice, issued "));
  }
  assert.equal(document.querySelector("ul").getAttribute("aria-label"), "Issued documents for " + k.address + ", " + k.number);
  assert.equal(document.querySelector("img,script,[data-case-pdf],[data-case-documents]"), null);
  for (const removed of ["View issued PDF", "Open record", "All documents", "Check PDF"]) assert.ok(!document.body.textContent.includes(removed));
  assert.deepEqual(
    orderedCaseDocuments(docs).map((d) => d.id),
    ["draft", "withdrawn", issued.id, "revision", "old"],
  );
  assert.equal(JSON.stringify(s), before, "presentation cannot mutate records, receipts or editor selection");
  document = parse(workspaceDraftDocuments(docs));
  assert.ok(document.body.textContent.includes("In progress") && document.body.textContent.includes("Draft"));
  assert.deepEqual(
    [...document.querySelectorAll("[data-open]")].map((e) => e.dataset.open),
    ["draft"],
  );
  const backdated = { ...issued, id: "backdated", mailed: "2026-10-01", issuedAt: "2026-11-06T16:00:00Z" };
  const correction = {
    ...issued,
    id: "correction",
    mailed: "2026-09-01",
    issuedAt: "2026-11-05T16:00:00Z",
    revision: { number: 3, at: "2026-11-07T16:00:00Z" },
  };
  document = parse(workspaceDocumentsSummary(k, [issued, backdated, correction]));
  assert.deepEqual(
    [...document.querySelectorAll("[data-open]")].map((e) => e.dataset.open),
    ["correction", "backdated", issued.id],
    "backdated mailing cannot hide newer issuance/revisions",
  );
  assert.equal(document.querySelector(".case-document-date").textContent, "11/07/2026");
  document = parse(workspaceDocumentsSummary(k, [{ ...issued, issuedAt: "2026-11-06T02:00:00Z" }]));
  assert.equal(document.querySelector(".case-document-date").textContent, "11/05/2026", "issued date uses the City day, not the UTC day");
  for (const location of [undefined, ["shared"], ["local"], ["conflict"], []])
    for (const verify of [undefined, "invalid", "unavailable", "incomplete"]) {
      s.ARTIFACT_LOCATIONS[issued.id] = location;
      s.ARTIFACT_VERIFY[issued.id] = verify;
      document = parse(workspaceDocumentsSummary(k, [issued]));
      assert.equal(document.querySelector("[data-open]").dataset.open, issued.id, "record access is independent of PDF location");
      assert.equal(document.querySelector("[data-case-pdf]"), null);
    }
  const notice = { ...issued, id: "notice", authoringVersion: 11, issuanceGroup: { citationId: "packet" } };
  const packet = { ...issued, id: "packet", type: "citation" };
  document = parse(workspaceDocumentsSummary(k, [notice, packet]));
  assert.deepEqual(
    [...document.querySelectorAll("[data-open]")].map((e) => e.dataset.open),
    ["notice", "packet"],
    "each document name opens its own record; packet PDF authority stays in the editor",
  );
  document = parse(workspaceDocumentsSummary(k, [{ ...issued, pendingAmendment: { key: "pending" } }]));
  assert.ok(document.body.textContent.includes("Save confirmation needed"));
  assert.equal(document.querySelector("[data-open]").dataset.open, issued.id);
  assert.ok(parse(workspaceDocumentsSummary(k, [])).body.textContent.includes("No issued documents"));
  assert.ok(parse(workspaceDocumentsSummary(k, [docs[3]])).body.textContent.includes("No issued documents"));
  assert.equal(workspaceDraftDocuments([issued]), "");
  const target = listenerTarget(),
    calls = [];
  createWorkspaceEvents({
    ui: { captureWork: () => calls.push("capture") },
    events: { editorEvents: { openDocument: (t) => calls.push(["record", t.dataset.open]) } },
  }).registerWorkspaceClicks(target);
  for (const id of [issued.id, "old", "withdrawn", "draft"]) {
    const t = { dataset: { open: id }, id: "", hasAttribute: (key) => key === "data-open" };
    await target.listeners.click({ target: { closest: () => t } });
    assert.deepEqual(calls.slice(-2), ["capture", ["record", id]]);
    assert.equal(s.state.docId, "old", "existing editor/preflight owner controls selection");
  }
  console.log(
    "PASS compact issued/draft links: complete descending history, City dates, backdated revisions, labels, escaping, read-only state, PDF-location independence and existing record dispatch",
  );
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
