/* Display facts are read once per synchronous operation, and reread on the next operation. */
const assert = require("node:assert/strict");
const { compile } = require("../fixtures/equivalence_harness.cjs");
(async () => {
  const { createWorkspaceTasks, WriterState: state } = await compile('export {createWorkspaceTasks} from "./workspace_tasks.js";');
  const k = { id: "case", number: "CASE A", address: "1 SYNTHETIC ST" };
  const d = {
    id: "pdf",
    caseId: k.id,
    type: "citation",
    draft: false,
    filedAt: "2026-10-26",
    filedArtifact: { filename: "pdf.pdf", sha256: "a".repeat(64) },
  };
  state.CASES = [k];
  state.DOCS = [d];
  state.REINSP = [];
  state.RECORD_ATTEMPTS = {};
  state.PENDING = [];
  state.ARTIFACT_LOCATIONS = { pdf: ["local"] };
  state.ARTIFACT_VERIFY = { pdf: "verified" };
  let reads = 0;
  state.ARTIFACT_IDENTITY = new Proxy(
    {},
    {
      get: (_, id) => {
        assert.equal(id, "pdf");
        reads++;
        return undefined;
      },
    },
  );
  const { workspaceTasks } = createWorkspaceTasks({ fmtDate: (v) => v, hasSetupWork: () => false, depositComplete: () => true });
  const rows = [{ k, st: { closed: false } }];
  const first = workspaceTasks(rows);
  assert.equal(reads, 1, "local/outbox and problem filters share one display-state calculation");
  assert.equal(first.find((t) => t.key === "outbox").count, 1);
  assert.equal(first.find((t) => t.key === "artifacts").count, 0);
  state.ARTIFACT_LOCATIONS.pdf = ["shared conflict"];
  const next = workspaceTasks(rows);
  assert.equal(reads, 2, "next operation rereads the changed location");
  assert.equal(next.find((t) => t.key === "outbox").count, 0);
  assert.equal(next.find((t) => t.key === "artifacts").count, 1);
  assert.match(next.find((t) => t.key === "artifacts").items[0].label, /artifact conflict/);
  state.ARTIFACT_VERIFY.pdf = "invalid";
  const invalid = workspaceTasks(rows);
  assert.equal(reads, 3, "next operation rereads changed verification display facts");
  assert.match(invalid.find((t) => t.key === "artifacts").items[0].label, /invalid artifact identity/);
  console.log("PASS artifact display facts calculated once per operation; later location and verification changes remain live");
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
