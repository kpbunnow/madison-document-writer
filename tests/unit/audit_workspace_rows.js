/* Reused presentation must always reflect current records, documents, proof, dates, actions and visit results. */
const assert = require("node:assert/strict"),
  { compile } = require("../fixtures/equivalence_harness.cjs");
(async () => {
  const api = await compile('export {createWorkspaceRows} from "./workspace_rows.js";');
  assert.deepEqual(api.WriterState, {});
  const renderer = api.createWorkspaceRows();
  assert.deepEqual(api.WriterState, {}, "row reuse does not initialize Writer");
  const k = { id: "case", number: "QA-CASE", address: "100 TEST ST", owner: "Owner", inspectorId: api.INSPECTORS[0].id };
  const d = { id: "doc", caseId: k.id, type: "notice", draft: false, mailed: "2026-11-13", items: [{ id: "one" }, { id: "two" }] };
  const row = {
    k,
    st: { restrictions: [], due: "2027-01-01", days: 20, closed: false, draft: null, visit: null },
    facts: [],
    proof: { valid: true, label: "Verified" },
    action: 'data-reinsp="case"',
    label: "Reinspect",
    reason: "Current task",
  };
  Object.assign(api.WriterState, { state: {}, DOCS: [d], CASES: [k] });
  const render = () => renderer.render(row, [d]);
  const initial = render();
  assert.equal(render(), initial);
  k.address = "200 NEW <ST>";
  assert.match(render(), /200 NEW &lt;ST&gt;/);
  row.proof.valid = false;
  row.proof.label = "Changed proof";
  assert.match(render(), /Changed proof/);
  assert.match(render(), /Review record problem/);
  row.action = 'data-sync-safety="case"';
  row.label = "Review shared changes";
  assert.match(render(), /data-sync-safety="case"/);
  assert.match(render(), /Review shared changes/);
  row.st.due = "2027-02-02";
  row.st.late = true;
  assert.match(render(), /02\/02\/2027/);
  assert.match(render(), /Past due/);
  d.type = "compliance";
  d.mailed = "2026-11-14";
  d.pendingAmendment = { kind: "pending" };
  assert.match(render(), /Compliance/);
  assert.match(render(), /11\/14\/2026/);
  assert.match(render(), /Save confirmation needed/);
  api.WriterState.state.issuedCase = k.id;
  assert.match(render(), /data-issued-highlight/);
  api.WriterState.state.issuedCase = "";
  assert.doesNotMatch(render(), /data-issued-highlight/);
  row.st.visit = { id: "visit", caseId: k.id, draft: true, sourceDocId: d.id, results: { one: { oc: "corrected" } } };
  assert.match(render(), /1 corrected, 1 still to result/);
  row.st.visit.results.two = { oc: "none" };
  assert.match(render(), /1 corrected, 0 still to result/);
  api.WriterState.DOCS = [{ ...d, items: [{ id: "other" }] }];
  assert.match(render(), /0 corrected, 1 still to result/, "visit counts read the current source, even after array replacement");
  const inspector = api.INSPECTORS[0],
    name = inspector.name;
  try {
    inspector.name = "Current inspector <&>";
    assert.match(render(), /Current inspector &lt;&amp;&gt;/);
  } finally {
    inspector.name = name;
  }
  row.facts.push({ key: "confirm", label: "Pending <save>", action: 'data-resumerecord="attempt"' });
  assert.match(render(), /Pending &lt;save&gt;/);
  assert.match(render(), /data-resumerecord="attempt"/);
  renderer.retain([]);
  k.transient = k;
  k.owner = "Updated despite transient cycle";
  assert.match(render(), /Updated despite transient cycle/, "unserializable cache inputs use fresh presentation");
  delete k.transient;
  renderer.retain([k]);
  assert.match(render(), /Updated despite transient cycle/);
  console.log(
    "PASS reused Workspace rows: current records, documents, source replacements, proof/actions, deadlines, staff facts, visit counts and uncached fallback",
  );
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
