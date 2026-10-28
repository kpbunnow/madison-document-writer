/* Exercise actual loading/projection before comparing the retained success notification. */
const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path"),
  acorn = require("acorn"),
  esbuild = require("esbuild");
(async () => {
  const source = fs.readFileSync("app/modules/case_loading.js", "utf8"),
    factory = acorn
      .parse(source, { ecmaVersion: 2022, sourceType: "module" })
      .body.find((n) => n.declaration?.id?.name === "createCaseLoading").declaration,
    fn = factory.body.body.find((n) => n.id?.name === "loadCaseFile");
  async function compile(contents) {
    const b = await esbuild.build({
      stdin: {
        contents: contents + '\nexport {WriterState} from "./state.js";export {INSPECTORS} from "./data/inspectors.js";',
        resolveDir: path.resolve("app/modules"),
      },
      bundle: true,
      write: false,
      format: "cjs",
      plugins: [
        {
          name: "data",
          setup(b) {
            b.onResolve({ filter: /\/data\// }, (a) => ({ path: path.resolve("build/generated/modules/data", path.basename(a.path)) }));
          },
        },
      ],
    });
    const box = { exports: {} };
    new Function("module", "exports", b.outputFiles[0].text)(box, box.exports);
    return box.exports;
  }
  const [current, legacy] = await Promise.all([
    compile(source),
    compile(source.slice(0, fn.start) + fs.readFileSync("tests/fixtures/case_loading_reference.txt", "utf8") + source.slice(fn.end)),
  ]);
  function run(api, documents, visits, repeat, saved, fail) {
    const s = api.WriterState,
      calls = [],
      actor = api.INSPECTORS.find((i) => i.name).id,
      k = { id: "case", number: "BLD2026-00001", address: "SYNTHETIC<&", owner: "Original", inspectorId: actor, date: "2026-10-20" };
    Object.assign(s, {
      CASES: [structuredClone(k)],
      EVENTS: { case: [] },
      DOCS: [],
      REINSP: [],
      SAVE_CHECKPOINTS: {},
      seq: 1,
      DIRTY: true,
      state: { screen: "write" },
    });
    const events = [];
    for (let n = 0; n < documents; n++) {
      const id = "document" + n;
      events.push({
        id: "issued" + n,
        at: "2026-10-20T12:00:00Z",
        by: actor,
        type: "notice.issued",
        payload: {
          docId: id,
          snapshot: {
            id,
            caseId: "case",
            type: "notice",
            authoringVersion: 9,
            mailed: "2026-10-20",
            inspectorId: actor,
            items: [],
            frozen: { case: k, inspector: { id: actor, name: "Frozen inspector" }, body: "Retained" },
          },
        },
      });
    }
    for (let n = 0; n < visits; n++)
      events.push({
        id: "visited" + n,
        at: "2026-10-21T12:00:00Z",
        by: actor,
        type: "reinspection.recorded",
        payload: { reinspection: { id: "visit" + n, caseId: "case", sourceDocId: "document0", date: "2026-10-21", results: {} } },
      });
    const file = JSON.stringify({ format: "madison-case-file", schema: 4, case: k, inspectors: [], events });
    const services = new Proxy(
      {},
      {
        get(_, key) {
          calls.push("get:" + key);
          return (...args) => {
            calls.push([key, ...args]);
            if (key === fail) throw new Error("interrupted " + key);
          };
        },
      },
    );
    const owner = api.createCaseLoading(services);
    assert.deepEqual(calls, []);
    let value, error;
    try {
      value = owner.loadCaseFile(file, saved);
      if (repeat) value = owner.loadCaseFile(file, saved);
    } catch (e) {
      error = [e.name, e.message];
    }
    const state = structuredClone(s);
    for (const c of state.CASES) delete c.savedAt;
    return { value: value?.id, error, calls, state };
  }
  let checked = 0;
  for (const documents of [0, 1, 2, 5])
    for (const visits of [0, 1, 2, 5])
      for (const repeat of [false, true])
        for (const saved of [false, true])
          for (const fail of [null, "render", "saveDrafts", "refreshArtifactLocations", "toast"]) {
            assert.deepEqual(
              run(current, documents, visits, repeat, saved, fail),
              run(legacy, documents, visits, repeat, saved, fail),
              "scenario " + checked++,
            );
          }
  console.log(
    "PASS case load status equivalence " + checked + " scenarios: projection counts, pluralization, retries, save dispatch and interruptions",
  );
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
