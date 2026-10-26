/* Workspace tasks are read-only presentation of live records and existing policy/artifact facts. */
const assert = require("assert/strict"),
  fs = require("fs"),
  path = require("path"),
  acorn = require("acorn"),
  esbuild = require("esbuild");
const root = path.resolve(__dirname, "../.."),
  directory = path.join(root, "app/modules");
const parse = (n) => acorn.parse(fs.readFileSync(path.join(directory, n + ".js"), "utf8"), { ecmaVersion: 2022, sourceType: "module" });
function walk(n, visit) {
  if (!n || typeof n !== "object") return;
  if (Array.isArray(n)) return n.forEach((c) => walk(c, visit));
  visit(n);
  Object.values(n).forEach((c) => walk(c, visit));
}
const required = new Set();
walk(parse("workspace_tasks"), (n) => {
  if (n.type === "MemberExpression" && n.object.name === "services") {
    assert.equal(n.computed, false);
    required.add(n.property.name);
  }
});
assert.deepEqual([...required].sort(), ["depositComplete", "fmtDate", "hasSetupWork"]);
const declarations = parse("app_core").body.flatMap((n) => (n.declaration || n).declarations || []),
  entry = declarations.find((n) => n.id.name === "workspaceTaskPresentation");
assert.equal(entry.init.callee.name, "createWorkspaceTasks");
assert.ok(declarations.indexOf(entry) > declarations.findIndex((n) => n.id.name === "deadlineAssignment"));
assert.ok(declarations.indexOf(entry) < declarations.findIndex((n) => n.id.name === "documentRenderer"));
assert.equal(entry.init.arguments.length, 1);
assert.deepEqual(new Set(entry.init.arguments[0].properties.map((p) => p.key.name)), required);
for (const p of entry.init.arguments[0].properties) {
  assert.equal(p.type, "Property");
  assert.equal(p.value.type, "ArrowFunctionExpression");
  assert.equal(p.value.body.type, "CallExpression");
  assert.equal(p.value.body.callee.name, p.key.name);
}
function freeze(value) {
  if (value && typeof value === "object") {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
}
(async () => {
  const built = await esbuild.build({
    stdin: { contents: "export {createWorkspaceTasks} from './workspace_tasks.js'; export {WriterState} from './state.js';", resolveDir: directory },
    bundle: true,
    format: "cjs",
    write: false,
    plugins: [
      {
        name: "data",
        setup(b) {
          b.onResolve({ filter: /\/data\// }, (a) => ({ path: path.join(root, "build/generated/modules/data", path.basename(a.path)) }));
        },
      },
    ],
  });
  const box = { exports: {} };
  new Function("module", "exports", built.outputFiles[0].text)(box, box.exports);
  const { createWorkspaceTasks, WriterState: state } = box.exports;
  assert.deepEqual(state, {});
  createWorkspaceTasks(new Proxy({}, { get: (_, k) => assert.fail("premature dependency: " + String(k)) }));
  assert.deepEqual(state, {}, "loading/construction starts no Writer/DOM/services or record reads");
  let setup = true,
    checked = [];
  const { workspaceTasks } = createWorkspaceTasks({
    fmtDate: (v) => "date " + v,
    hasSetupWork: () => setup,
    depositComplete: (d) => {
      checked.push(d.id);
      return !d.needsDeposit;
    },
  });
  const a = { id: "a", number: "CASE A", address: "1 SYNTHETIC ST" },
    b = { id: "b", number: "CASE B", address: "2 SYNTHETIC ST" },
    c = { id: "c", number: "CASE C", address: "3 SYNTHETIC ST" };
  const issued = (id, extra = {}) => ({
    id,
    caseId: "a",
    type: "citation",
    draft: false,
    filedAt: "2026-10-26",
    filedArtifact: { filename: id + ".pdf", sha256: "a".repeat(64) },
    ...extra,
  });
  const draft = { id: "draft", caseId: "a", type: "notice", draft: true, needsDeposit: true, pendingAmendment: true };
  state.CASES = freeze([a, b, c]);
  state.DOCS = freeze([
    draft,
    issued("unfiled", { filedAt: null }),
    issued("local"),
    issued("stale"),
    issued("conflict"),
    issued("superseded", { superseded: true }),
    issued("void", { void: true }),
    { id: "included", caseId: "a", type: "notice", draft: false, authoringVersion: 11, issuanceGroup: { citationId: "local" } },
    issued("closed-unfiled", { caseId: "b", type: "legacy-family", filedAt: null }),
    { id: "other-draft", caseId: "b", draft: true },
  ]);
  state.ARTIFACT_LOCATIONS = freeze({ local: ["local"], stale: ["local"], conflict: ["shared conflict"] });
  state.ARTIFACT_VERIFY = freeze({ local: "verified", stale: "unavailable", conflict: "verified" });
  state.ARTIFACT_IDENTITY = freeze({});
  state.RECORD_ATTEMPTS = freeze({ 'rec"<': { cid: "a" }, "closed-record": { cid: "b" }, unseen: { cid: "unlisted" } });
  state.PENDING = freeze([{ cid: "unknown", name: "Fallback filename", at: "2026-10-26T10:00:00Z" }]);
  const rows = freeze([
      { k: a, st: { draft, due: "2026-10-25", late: true } },
      { k: b, st: { closed: true } },
      { k: c, st: { visit: { id: "visit" }, label: "Continue inspection", due: "2026-10-30", soon: true } },
    ]),
    before = JSON.stringify(state),
    tasks = workspaceTasks(rows);
  assert.deepEqual(
    tasks.map((t) => t.key),
    ["deposit", "open", "drafts", "overdue", "soon", "imports", "confirm", "pending", "filing", "outbox", "artifacts"],
  );
  assert.deepEqual(
    tasks.map((t) => t.count),
    [1, 2, 2, 1, 1, 1, 3, 1, 2, 2, 2],
  );
  assert.deepEqual(
    tasks.map((t) => t.unit),
    ["documents", "cases", "cases", "cases", "cases", "imports", "operations", "operations", "documents", "documents", "documents"],
  );
  assert.ok(tasks.every((t) => t.count === t.items.length));
  assert.deepEqual(checked, ["draft", "other-draft"], "deposit readiness stays delegated to the existing calculation");
  const group = (key) => tasks.find((t) => t.key === key);
  assert.deepEqual(
    group("deposit").items.map((i) => i.action),
    ['data-open="draft"'],
  );
  assert.ok(group("open").items[0].label.includes("Next due date 2026-10-25"));
  assert.equal(group("drafts").items[1].action, 'data-reinsp="c"');
  assert.ok(group("confirm").items[0].action.includes("rec&quot;&lt;"));
  assert.ok(group("pending").items[0].label.includes("Fallback filename"));
  assert.ok(
    group("filing").items.some((i) => i.label.includes("legacy-family")),
    "unknown historical document types retain their label fallback",
  );
  assert.ok(group("outbox").items.some((i) => i.label.includes("last verified; refresh unavailable")));
  assert.ok(group("artifacts").items.some((i) => i.label.includes("artifact conflict")));
  assert.ok(group("artifacts").items.some((i) => i.label.includes("last verified location; refresh unavailable")));
  assert.equal(JSON.stringify(state), before, "read-only tasks do not rewrite records, attempts, queues or artifact state");
  setup = false;
  assert.equal(workspaceTasks(rows).find((t) => t.key === "imports").count, 0);
  state.DOCS = freeze([]);
  state.RECORD_ATTEMPTS = freeze({});
  state.PENDING = freeze([]);
  checked = [];
  const replaced = workspaceTasks(rows);
  for (const key of ["deposit", "confirm", "pending", "filing", "outbox", "artifacts"])
    assert.equal(replaced.find((t) => t.key === key).count, 0, key + " observes replaced workspace references");
  assert.deepEqual(checked, []);
  assert.equal(replaced.find((t) => t.key === "open").count, 2, "caller-supplied row/status snapshot remains authoritative for case groups");
  console.log(JSON.stringify({ passed: true, boundedDependencies: 3, truthfulReadOnlyTasks: true, liveWorkspaceReplacement: true }));
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
