/* Case document presentation is read-only; PDF routes retain the existing receipt-verified reader. */
const assert = require("node:assert/strict");
const { JSDOM } = require("jsdom");
const { compile, listenerTarget } = require("../fixtures/equivalence_harness.cjs");
(async () => {
  const {
    WriterState: s,
    orderedCaseDocuments,
    workspaceDocumentsSummary,
    workspaceDocumentsPanel,
    createWorkspaceEvents,
  } = await compile(
    [
      'export {orderedCaseDocuments,workspaceDocumentsSummary,workspaceDocumentsPanel} from "./workspace_documents.js";',
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
    ARTIFACT_LOCATIONS: { [issued.id]: ["shared"] },
    ARTIFACT_VERIFY: {},
    ARTIFACT_IDENTITY: {},
  });
  const before = JSON.stringify(docs);
  const parse = (text) => new JSDOM(text).window.document;
  let document = parse(workspaceDocumentsSummary(k, docs));
  assert.equal(document.querySelector("strong").textContent, "Official Notice");
  assert.equal(document.querySelector("[data-case-pdf]").dataset.casePdf, issued.id);
  assert.equal(document.querySelector("[data-open]").dataset.open, issued.id);
  assert.equal(document.querySelector("[data-case-documents]").dataset.caseDocuments, k.id);
  assert.ok(document.body.textContent.includes("All documents (5)") && document.body.textContent.includes("1 draft"));
  assert.deepEqual(
    orderedCaseDocuments(docs).map((d) => d.id),
    ["draft", "withdrawn", issued.id, "revision", "old"],
  );
  const backdated = { ...issued, id: "backdated", mailed: "2026-10-01", issuedAt: "2026-11-06T16:00:00Z" };
  const correction = {
    ...issued,
    id: "correction",
    mailed: "2026-09-01",
    issuedAt: "2026-11-05T16:00:00Z",
    revision: { number: 3, at: "2026-11-07T16:00:00Z" },
  };
  assert.deepEqual(
    orderedCaseDocuments([issued, backdated, correction]).map((d) => d.id),
    ["correction", "backdated", issued.id],
    "backdated mailing cannot hide newer issuance or corrections",
  );
  const corrected = parse(workspaceDocumentsSummary(k, [issued, backdated, correction]));
  assert.equal(corrected.querySelector("[data-open]").dataset.open, "correction");
  assert.equal(corrected.querySelector(".case-document-date").textContent, "Issued 11/07/2026");
  document = parse(workspaceDocumentsPanel(k, docs));
  assert.equal(document.querySelector("[role=dialog]").getAttribute("aria-modal"), "true");
  assert.equal(document.querySelector(".modal-h p").textContent, k.address + " · " + k.number);
  assert.equal(document.querySelectorAll("img,script").length, 0);
  assert.deepEqual(
    [...document.querySelectorAll("[data-open]")].map((e) => e.dataset.open),
    ["draft", "withdrawn", issued.id, "revision", "old"],
  );
  for (const label of ["In progress", "Issued documents", "Draft", "Withdrawn", "Replaced", "Revision 2"])
    assert.ok(document.body.textContent.includes(label), label);
  assert.equal(JSON.stringify(docs), before, "rendering cannot mutate history or receipts");
  for (const [verify, locations, identity, button, note] of [
    [undefined, ["shared"], undefined, "View issued PDF", null],
    [undefined, ["local"], undefined, "View issued PDF", null],
    [undefined, undefined, undefined, "Check PDF", "location unverified"],
    ["unavailable", ["shared"], undefined, "Check PDF", "last verified"],
    ["invalid", ["shared"], undefined, null, "invalid artifact identity"],
    [undefined, ["shared conflict"], undefined, null, "artifact conflict"],
    [undefined, [], undefined, null, "missing or unavailable"],
    [undefined, ["shared"], "stale", "Check PDF", "location unverified"],
  ]) {
    s.ARTIFACT_VERIFY[issued.id] = verify;
    s.ARTIFACT_LOCATIONS[issued.id] = locations;
    s.ARTIFACT_IDENTITY[issued.id] = identity;
    document = parse(workspaceDocumentsSummary(k, [issued]));
    assert.equal(document.querySelector("[data-case-pdf]")?.textContent || null, button);
    if (note) assert.ok(document.body.textContent.includes(note));
  }
  for (const change of [{ draft: true }, { pendingAmendment: { key: "pending" } }, { filedArtifact: null }]) {
    document = parse(workspaceDocumentsPanel(k, [{ ...issued, ...change }]));
    assert.equal(document.querySelector("[data-case-pdf]"), null);
    assert.ok(document.querySelector("[data-open]"));
  }
  const packet = { ...issued, id: "packet", type: "citation", mailed: "2026-11-06" };
  const notice = { ...issued, id: "notice", authoringVersion: 11, issuanceGroup: { citationId: "packet" } };
  document = parse(workspaceDocumentsSummary(k, [notice, packet]));
  assert.equal(document.querySelector("[data-case-pdf]").dataset.casePdf, "packet");
  document = parse(workspaceDocumentsPanel(k, [notice, packet]));
  assert.equal(document.querySelector('[data-open="notice"]').closest(".case-document").querySelector("[data-case-pdf]").dataset.casePdf, "packet");
  document = parse(workspaceDocumentsPanel(k, [notice]));
  assert.equal(document.querySelector("[data-case-pdf]"), null, "missing packet must never fall back to notice PDF");
  assert.ok(parse(workspaceDocumentsPanel(k, [])).body.textContent.includes("No documents have been issued"));
  assert.ok(parse(workspaceDocumentsPanel(null, [])).body.textContent.includes("Case not available"));
  const target = listenerTarget(),
    calls = [];
  const events = createWorkspaceEvents({
    ui: { captureWork: () => {}, render: () => calls.push("render") },
    events: {
      editorEvents: {
        openOriginal: (d) => calls.push(["original", d.id]),
        openDocument: (t) => calls.push(["record", t.dataset.open, s.state.modal]),
      },
    },
  });
  events.registerWorkspaceClicks(target);
  const click = async (dataset) => {
    const t = {
      dataset,
      id: "",
      hasAttribute: (key) => Object.keys(dataset).some((k) => "data-" + k.replace(/[A-Z]/g, (c) => "-" + c.toLowerCase()) === key),
    };
    await target.listeners.click({ target: { closest: () => t } });
  };
  await click({ caseDocuments: k.id });
  assert.equal(s.state.modal, "case-documents");
  assert.equal(s.state.documentsCaseId, k.id);
  await click({ caseDocuments: "missing" });
  assert.equal(calls.length, 1, "unknown cases do not open a panel");
  await click({ casePdf: issued.id });
  assert.deepEqual(calls.at(-1), ["original", issued.id]);
  assert.equal(s.state.docId, "old", "PDF access must use the chosen document without changing active editor");
  const count = calls.length;
  await click({ casePdf: "missing" });
  await click({ casePdf: "draft" });
  issued.pendingAmendment = { key: "pending" };
  await click({ casePdf: issued.id });
  delete issued.pendingAmendment;
  assert.equal(calls.length, count, "missing, draft and pending records cannot open issued PDF");
  await click({ open: issued.id });
  assert.deepEqual(calls.at(-1), ["record", issued.id, null], "open record closes the document panel before existing preflight route");
  assert.equal(s.state.docId, "old");
  console.log(
    "PASS case document history, current/draft/withdrawn/revision ordering, escaping, read-only presentation, PDF location states/packets and delegated access",
  );
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
