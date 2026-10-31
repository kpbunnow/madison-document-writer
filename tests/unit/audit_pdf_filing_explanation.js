/* File issued PDF explains itself when the helper found no Chrome or Edge. The retry button asks for the explanation;
   issuing a document (which files the PDF automatically) never adds a second message, and nothing is requested from
   the helper without a browser. With a browser the request path is unchanged (covered against the retained module in
   audit_pdf_filing_rules.js). */
const assert = require("node:assert/strict"),
  { compile, recorder } = require("../fixtures/equivalence_harness.cjs");

(async () => {
  const api = await compile('export {createDocumentDelivery} from "./document_delivery.js";');
  const doc = { id: "doc", caseId: "case", draft: false };
  const job = { docId: "doc", html: "<p>x</p>", name: "doc.pdf" };
  const run = async (helper, explain) => {
    api.WriterState.HELPER = helper;
    const calls = [];
    const services = recorder(calls, { toast: (...args) => calls.push(["toast", ...args]) }, {}, 0);
    const delivery = api.createDocumentDelivery(services);
    const result = await delivery.filePdf(doc, job, explain);
    return { result, toasts: calls.filter((c) => Array.isArray(c) && c[0] === "toast"), calls };
  };
  const needed =
    /^PDF filing needs Chrome or Microsoft Edge on this computer, and the helper did not find one\. Ask IT to install it, then use File issued PDF again\.$/;
  for (const helper of [{ chrome: false }, {}, null, undefined]) {
    const asked = await run(helper, true);
    assert.equal(asked.result, false);
    assert.equal(asked.toasts.length, 1, "one explanation for " + JSON.stringify(helper));
    assert.match(asked.toasts[0][1], needed);
    assert.deepEqual(asked.toasts[0][2], { severity: "warning" });
    const silent = await run(helper, undefined);
    assert.equal(silent.result, false);
    assert.deepEqual(silent.toasts, [], "automatic filing at issue adds no second message");
    assert.ok(!silent.calls.some((c) => typeof c === "string" && c.startsWith("helper")), "no helper request without a browser");
  }
  // No document: nothing to explain.
  api.WriterState.HELPER = { chrome: false };
  const none = await api.createDocumentDelivery(recorder([], {}, {}, 0)).filePdf(null, job, true);
  assert.equal(none, false);
  console.log("PASS File issued PDF explains a missing Chrome or Edge only when asked");
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
