/* Retained editing comparisons pin field dispatch, pricing effects, errors and partial mutations. */
const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path"),
  esbuild = require("esbuild");
(async () => {
  async function compile(contents) {
    const b = await esbuild.build({
      stdin: {
        contents: contents + '\nexport {WriterState} from "./state.js"; ',
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
    new Function("document", "module", "exports", b.outputFiles[0].text)({ addEventListener() {} }, box, box.exports);
    return box.exports;
  }
  const [current, legacy] = await Promise.all([
    compile(fs.readFileSync("app/modules/language_catalog.js", "utf8")),
    compile(fs.readFileSync("tests/fixtures/language_catalog_reference.txt", "utf8")),
  ]);
  function run(api, input) {
    const x = structuredClone(input),
      calls = [];
    const owner = api.createLanguageCatalog({
      recordIntegrity: {
        status(k) {
          calls.push(structuredClone(k));
          return { valid: x.valid };
        },
      },
    });
    let result, error;
    try {
      result = owner.compareSharedCase(x.local, x.events, x.shared, x.checkpoint, x.unfinished);
    } catch (e) {
      error = [e.name, e.message];
    }
    return { result, error, input: x, calls };
  }
  let seed = 20261123,
    checked = 0;
  const random = (n) => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return Math.floor((seed / 4294967296) * n);
    },
    pick = (a) => a[random(a.length)];
  const kinds = new Set();
  function compare(x) {
    const a = run(current, x),
      b = run(legacy, x);
    assert.deepEqual(a, b, "scenario " + checked++);
    if (a.result) kinds.add(a.result.kind);
  }
  const event = (id) => ({ id, at: "2026-10-25T12:00:00Z", type: "case.updated", payload: { text: id } });
  for (let n = 0; n < 5000; n++) {
    const local = { id: "case", number: "CB2026-100-00001", owner: "Baseline", address: "100 Main St" },
      base = structuredClone(local),
      remote = structuredClone(local);
    for (const field of ["owner", "address", "parcel", "description"]) {
      local[field] = pick(["One", "Two", "Baseline", undefined]);
      remote[field] = pick(["One", "Two", "Baseline", undefined]);
      base[field] = pick(["One", "Two", "Baseline", undefined]);
    }
    const events = [event("one")],
      sharedEvents = structuredClone(events);
    if (random(6) === 0) sharedEvents.push(event("two"));
    if (random(9) === 0) sharedEvents.length = 0;
    if (random(9) === 0 && sharedEvents[0]) sharedEvents[0].payload.text = "Changed";
    const checkpoint = pick([null, { case: base, events: ["one"] }, { case: base, events: [] }]);
    compare({
      local,
      events,
      shared: { format: "madison-case-file", case: remote, events: sharedEvents },
      checkpoint,
      unfinished: !!random(2),
      valid: n % 10 !== 0,
    });
  }
  assert.ok(kinds.has("conflict") && kinds.has("history-conflict") && kinds.has("compatible"), "exercise merging beyond identity refusal");
  console.log("PASS shared comparison equivalence " + checked + " inputs; classifications: " + [...kinds].sort().join(", "));
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
