/* Independent domain owner: no Writer startup, DOM, storage or implicit dependencies. */
const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  esbuild = require("esbuild");
const source = fs.readFileSync("app/modules/citation_disposition.js", "utf8");
assert.ok(!/^import /m.test(source), "disposition stays a dependency-free leaf");
const built = esbuild.buildSync({ entryPoints: ["app/modules/citation_disposition.js"], bundle: true, write: false, format: "cjs" }),
  box = { exports: {} };
new Function("module", "exports", built.outputFiles[0].text)(box, box.exports);
const { CITATION_ONLY, citationOnlyItem, canChooseCitationOnly, citationOnlyClosed, citationOnlyFault } = box.exports;
const item = { id: "one", cite: true, due: "", dueExempt: CITATION_ONLY };
const draft = { type: "notice", draft: true, importRule: { cite: true }, importInspection: { type: "initial" }, items: [item] };
assert.ok(citationOnlyItem(item));
assert.ok(canChooseCitationOnly(draft, item));
assert.equal(citationOnlyFault(draft), "");
for (const patch of [
  { draft: false },
  { type: "citation" },
  { correction: {} },
  { pendingAmendment: {} },
  { fromReinspId: "visit" },
  { importRule: { cite: false } },
  { importInspection: { type: "reinspection" } },
])
  assert.equal(canChooseCitationOnly({ ...draft, ...patch }, item), false, JSON.stringify(patch));
for (const patch of [{ cite: false }, { done: true }, { withdrawn: true }]) assert.equal(canChooseCitationOnly(draft, { ...item, ...patch }), false);
for (const patch of [{ due: "2026-12-01" }, { done: true }, { cite: false }])
  assert.match(citationOnlyFault({ ...draft, items: [{ ...item, ...patch }] }), /blank due date/);
assert.match(citationOnlyFault({ ...draft, fromReinspId: "visit" }), /only on the initial/);
assert.match(citationOnlyFault({ ...draft, items: [item, { id: "other", cite: false }] }), /every remaining violation/);
const issued = { ...draft, draft: false, type: "citation", fromDocId: "notice", issuanceGroup: { noticeId: "notice", citationId: "citation" } };
assert.ok(citationOnlyClosed(issued));
assert.ok(citationOnlyClosed({ ...issued, id: "corrected-citation", revision: { originalIssued: "2026-08-01" } }));
for (const patch of [
  { draft: true },
  { void: {} },
  { superseded: {} },
  { type: "notice" },
  { fromDocId: "other" },
  { fromReinspId: "visit" },
  { issuanceGroup: {} },
  { importInspection: { type: "reinspection" } },
  { items: [] },
  { items: [{ ...item, due: "2026-12-01" }] },
  { items: [{ ...item, cite: false }] },
])
  assert.equal(citationOnlyClosed({ ...issued, ...patch }), false, JSON.stringify(patch));
assert.equal(citationOnlyItem({ ...item, dueExempt: "unknown" }), false);
console.log("PASS isolated initial-citation disposition eligibility, refusal and retained correction facts");
