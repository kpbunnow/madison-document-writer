/* Case folder and summary owner: permission, original bytes and refusal/partial-result behavior. */
const assert = require("assert/strict"),
  fs = require("fs"),
  path = require("path"),
  acorn = require("acorn"),
  esbuild = require("esbuild");
const root = path.resolve(__dirname, "../.."),
  dir = path.join(root, "app/modules"),
  parse = (n) => acorn.parse(fs.readFileSync(path.join(dir, n + ".js"), "utf8"), { ecmaVersion: 2022, sourceType: "module" });
function walk(n, f) {
  if (!n || typeof n !== "object") return;
  if (Array.isArray(n)) return n.forEach((x) => walk(x, f));
  f(n);
  Object.values(n).forEach((x) => walk(x, f));
}
const fields = ["toast", "grantCaseFolder", "summarize", "writeIndexFile", "render", "recordIntegrity", "loadCaseFile"],
  used = new Set();
walk(parse("case_folder_workflow"), (n) => {
  if (n.type === "MemberExpression" && n.object.name === "services") {
    assert.equal(n.computed, false);
    used.add(n.property.name);
  }
});
assert.deepEqual([...used].sort(), fields.slice().sort());
const entries = parse("app_core").body.flatMap((n) => (n.declaration || n).declarations || []),
  e = entries.find((n) => n.id.name === "caseFolderWorkflow");
assert.equal(e.init.callee.name, "createCaseFolderWorkflow");
assert.deepEqual(new Set(e.init.arguments[0].properties.map((p) => p.key.name)), used);
assert.ok(entries.indexOf(e) > entries.findIndex((n) => n.id.name === "addressParser"));
assert.ok(entries.indexOf(e) < entries.findIndex((n) => n.id.name === "recipientWorkflow"));
for (const p of e.init.arguments[0].properties)
  if (p.kind === "get") assert.equal(p.value.body.body[0].argument.name, p.key.name);
  else assert.equal(p.value.body.callee.name, p.key.name);
(async () => {
  const built = await esbuild.build({
    stdin: {
      contents: "export {createCaseFolderWorkflow} from './case_folder_workflow.js';export {WriterState} from './state.js';",
      resolveDir: dir,
    },
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
  const { createCaseFolderWorkflow, WriterState: s } = box.exports;
  assert.deepEqual(s, {});
  createCaseFolderWorkflow(new Proxy({}, { get: (_, k) => assert.fail("construction reads " + String(k)) }));
  assert.deepEqual(s, {});
  let calls = [],
    writeResult = { ok: true },
    grant = false,
    verifyError = false,
    projectError = false,
    projectionInput;
  const workflow = createCaseFolderWorkflow({
    toast: (m) => calls.push(["toast", m]),
    grantCaseFolder: async (quiet) => {
      calls.push(["grant", quiet]);
      if (grant) s.NEEDGRANT = false;
    },
    summarize: (file) => {
      calls.push(["summarize", file]);
      projectionInput = file;
      if (projectError || file.case.id === "projection-fail") throw Error("projection refusal");
      return { number: file.case.number, source: "verified by existing projection owner" };
    },
    writeIndexFile: async (name, body) => {
      calls.push(["write", name, body]);
      return name === "bi-failed.json" ? { ok: false, why: "write refusal" } : writeResult;
    },
    render: () => calls.push(["render", s.state.reindex]),
    get recordIntegrity() {
      return {
        verify: async (record) => {
          calls.push(["verify", record]);
          if (verifyError) throw Error("unverified");
        },
      };
    },
    loadCaseFile: (raw) => calls.push(["load", raw]),
  });
  const file = (id = "c", number = "BI-123") => ({ format: "madison-case-file", schema: 4, case: { id, number }, events: [], inspectors: [] });
  s.CASES = [{ id: "c", number: "BI-123", address: "123 Main St" }];
  s.EVENTS = { c: [] };
  s.SAVE_CHECKPOINTS = {};
  s.state = {};
  s.NEEDGRANT = false;
  s.CASEDIR = null;
  assert.deepEqual(await workflow.listCaseFolder(), []);
  assert.equal(await workflow.rebuildIndex(), null);
  assert.match(calls.pop()[1], /Link the case folder/);
  const makeDir = (files, failIteration = false) => ({
    async *entries() {
      for (const [name, raw, mod = 1, kind = "file"] of files) {
        yield [
          name,
          {
            kind,
            async getFile() {
              if (raw instanceof Error) throw raw;
              return { size: String(raw).length, lastModified: mod, text: async () => raw };
            },
          },
        ];
      }
      if (failIteration) throw Error("partial listing");
    },
    async getFileHandle(name) {
      const row = files.find((r) => r[0] === name);
      if (!row) throw Error("missing");
      return {
        async getFile() {
          if (row[1] instanceof Error) throw row[1];
          return { text: async () => row[1] };
        },
      };
    },
  });
  s.CASEDIR = makeDir([
    ["old.json", "{}", 1],
    ["new.JSON", "{}", 9],
    ["broken.json", Error("metadata unavailable")],
    ["ignore.txt", "", 99],
    ["subdir.json", "", 99, "directory"],
  ]);
  let listing = await workflow.listCaseFolder();
  assert.deepEqual(
    listing.map((x) => x.name),
    ["new.JSON", "old.json", "broken.json"],
  );
  assert.equal(listing.at(-1).size, 0);
  assert.equal(listing.at(-1).mod, 0);
  s.NEEDGRANT = true;
  assert.deepEqual(await workflow.listCaseFolder(), []);
  assert.equal(await workflow.rebuildIndex(), null);
  assert.ok(calls.some((c) => c[0] === "grant" && c[1] === true));
  s.NEEDGRANT = false;
  s.CASEDIR = makeDir([["retained.json", "{}", 2]], true);
  listing = await workflow.listCaseFolder();
  assert.equal(listing[0].name, "retained.json");
  assert.equal(s.state.folderError, "partial listing");
  calls = [];
  s.CASEDIR = makeDir([["s5.json", JSON.stringify({ ...file(), schema: 5 })]]);
  await workflow.openFromFolder("s5.json");
  assert.deepEqual(
    calls.map((c) => c[0]),
    ["verify", "load"],
  );
  const raw = calls[1][1];
  assert.equal(raw, JSON.stringify({ ...file(), schema: 5 }));
  verifyError = true;
  calls = [];
  await workflow.openFromFolder("s5.json");
  assert.deepEqual(
    calls.map((c) => c[0]),
    ["verify", "toast"],
  );
  verifyError = false;
  s.CASEDIR = makeDir([
    ["legacy.json", JSON.stringify(file())],
    ["bad.json", "not json"],
  ]);
  calls = [];
  await workflow.openFromFolder("legacy.json");
  assert.deepEqual(
    calls.map((c) => c[0]),
    ["load"],
  );
  calls = [];
  await workflow.openFromFolder("bad.json");
  assert.deepEqual(
    calls.map((c) => c[0]),
    ["toast"],
  );
  await workflow.openFromFolder("missing.json");
  assert.match(calls.at(-1)[1], /Could not open missing/);
  calls = [];
  const saved = file();
  assert.equal(await workflow.writeSummary("c", saved), true);
  assert.equal(projectionInput, saved);
  assert.equal(calls[1][0], "write");
  assert.equal(calls[1][1], "bi-123.json");
  assert.equal(s.LASTINDEX.ok, true);
  assert.ok(Number.isFinite(Date.parse(s.LASTINDEX.at)));
  calls = [];
  writeResult = { ok: false, why: "no folder" };
  assert.equal(await workflow.writeSummary("c", saved), false);
  assert.equal(s.LASTINDEX.why, "no folder");
  projectError = true;
  calls = [];
  assert.equal(await workflow.writeSummary("c", saved), false);
  assert.ok(!calls.some((c) => c[0] === "write"));
  assert.match(s.LASTINDEX.why, /projection refusal/);
  projectError = false;
  writeResult = { ok: true };
  assert.equal(await workflow.writeSummary("c"), true);
  assert.equal(projectionInput.case.id, "c");
  assert.equal(projectionInput.format, "madison-case-file");
  s.CASES = [{ id: "c", number: "" }];
  calls = [];
  assert.equal(await workflow.writeSummary("c", saved), false);
  assert.deepEqual(
    calls.map((c) => c[0]),
    ["toast"],
  );
  s.CASES = [{ id: "c", number: "BI-123" }];
  // Real migration/shape checks surround delegated projection and index writes; case handles have no write API.
  const files = [
    ["_ignored.json", "not json", 100],
    ["valid.json", JSON.stringify(file()), 9],
    ["failed.json", JSON.stringify(file("failed", "BI-FAILED")), 8],
    ["projection.json", JSON.stringify(file("projection-fail")), 7],
    ["shape.json", JSON.stringify({ schema: 4, format: "wrong", case: { id: "bad", number: "bad" } }), 6],
    ["parse.json", "bad json", 5],
    ["unreadable.json", Error("read refusal"), 4],
  ];
  s.CASEDIR = makeDir(files);
  s.NEEDGRANT = true;
  grant = true;
  calls = [];
  const out = await workflow.rebuildIndex();
  assert.equal(out.total, 6);
  assert.equal(out.written, 1);
  assert.equal(out.failed.length, 1);
  assert.equal(out.refused.length, 4);
  assert.equal(s.state.reindex, out);
  assert.equal(s.LASTINDEX.ok, false);
  assert.match(s.LASTINDEX.why, /1 could not be written/);
  assert.deepEqual(
    calls.filter((c) => c[0] === "write").map((c) => c[1]),
    ["bi-123.json", "bi-failed.json"],
  );
  assert.equal(calls.filter((c) => c[0] === "render").length, 2);
  assert.match(calls.at(-1)[1], /1 of 6 case files, 4 refused, 1 not written/);
  assert.ok(!calls.some((c) => c[0] === "summarize" && c[1].format === "wrong"));
  s.CASEDIR = makeDir([["all-refused.json", "bad"]]);
  calls = [];
  const refused = await workflow.rebuildIndex();
  assert.equal(refused.written, 0);
  assert.equal(refused.refused.length, 1);
  assert.equal(s.LASTINDEX.ok, true, "original status reflects failed index writes separately from refusals");
  console.log(
    JSON.stringify({
      passed: true,
      inputs: 7,
      inertConstruction: true,
      permissionAndPartialListing: true,
      verificationBeforeLoad: true,
      summaryDelegationAndFailures: true,
      rebuildRefusalAndWriteCounts: true,
    }),
  );
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
