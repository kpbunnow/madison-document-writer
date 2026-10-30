/* Queue actions and derived flags retain priority, live service reads, identities and sorting. */
const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path"),
  esbuild = require("esbuild");
(async () => {
  async function compile(contents) {
    const b = await esbuild.build({
      stdin: { contents: contents + '\nexport {esc} from "./presentation_format.js";', resolveDir: path.resolve("app/modules") },
      bundle: true,
      write: false,
      format: "cjs",
    });
    const box = { exports: {} };
    new Function("module", "exports", b.outputFiles[0].text)(box, box.exports);
    return box.exports;
  }
  // The one intentional change: the queue button opens the document, so it no longer shares the editor's "File issued PDF" label.
  function retainedOriginal() {
    const source = fs.readFileSync("tests/fixtures/workspace_queue_reference.txt", "utf8"),
      old = 'label = "File issued PDF";';
    assert.equal(source.split(old).length, 2, "retained original carries the old queue label exactly once");
    return source.replace(old, 'label = "Open document to file PDF";');
  }
  const [current, legacy] = await Promise.all([compile(fs.readFileSync("app/modules/workspace_queue.js", "utf8")), compile(retainedOriginal())]);
  function run(api, input) {
    const x = structuredClone(input),
      calls = [];
    let count = 0;
    const read = (o, label) =>
        new Proxy(o, {
          get(v, k) {
            if (typeof k !== "symbol") calls.push(label + "." + k);
            return v[k];
          },
        }),
      effect =
        (name, fn) =>
        (...args) => {
          calls.push([name, ...structuredClone(args)]);
          if (++count === x.fail) throw new Error("interrupted " + name);
          return fn(...args);
        };
    const rows = x.rows.map(({ k, st }, i) => ({ k: read(k, "case" + i), st: read(st, "state" + i) }));
    const R = read(
      {
        recordIntegrity: read({ status: effect("proof", (k) => read(x.proofs[k.id], "proof" + k.id)) }, "integrity"),
        PREFLIGHT_CONFLICT: x.conflict ? { cid: x.conflict } : null,
        esc: effect("esc", api.esc),
        CASEDIR: x.folder ? {} : null,
        NEEDGRANT: x.needGrant,
        docsFor: effect("docs", (id) => x.docs[id] || []),
        pdfTransferState: effect("transfer", (d) => d.transfer),
        ARTIFACT_LOCATIONS: x.locations,
        snow: read({ isCase: effect("snow", (k) => !!k.snow) }, "snow"),
        caseNumberAllowed: effect("allowed", (k) => !x.invalid.includes(k.id)),
      },
      "context",
    );
    let value, error, aliases;
    try {
      value = api.workspaceQueue(rows, x.tasks, R);
      aliases = value.map((row) => ({ k: rows.some((r) => row.k === r.k), st: rows.some((r) => row.st === r.st) }));
    } catch (e) {
      error = [e.name, e.message];
    }
    return { value, error, aliases, calls };
  }
  let seed = 20261115,
    checked = 0;
  const random = (n) => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return Math.floor((seed / 4294967296) * n);
    },
    pick = (a) => a[random(a.length)];
  function fixture() {
    return {
      rows: [
        {
          k: { id: "case0", date: "2026-01-01", snow: false },
          st: { current: { id: "issued", items: [{ id: "item" }] }, restrictions: [], due: "2026-01-01" },
        },
      ],
      proofs: { case0: { valid: true } },
      tasks: [],
      docs: {},
      locations: {},
      invalid: [],
      conflict: null,
      folder: true,
      needGrant: false,
      fail: 0,
    };
  }
  function compare(x) {
    assert.deepEqual(run(current, x), run(legacy, x), "scenario " + checked++);
  }
  compare(fixture());
  for (const key of ["deposit", "confirm", "pending", "filing", "outbox", "artifacts"]) {
    const x = fixture();
    x.tasks = [{ key, items: [{ cid: "case0", action: 'data-open="issued"' }] }];
    compare(x);
  }
  for (let n = 0; n < 5000; n++) {
    const x = fixture();
    x.rows = Array.from({ length: random(5) }, (_, i) => {
      const id = "case" + i,
        st = {
          current: random(4) ? { id: "issued" + i, items: random(4) ? [{ id: "item" }] : [] } : null,
          restrictions: random(7) ? [] : ["restriction"],
          due: pick(["2026-01-01", "2026-02-01", ""]),
        };
      for (const key of ["closed", "late", "soon", "attention"]) st[key] = !!random(2);
      if (random(5) === 0) st.pendingRecord = { recordKey: "record" };
      if (random(5) === 0) st.pendingDoc = { id: "pending" };
      if (random(5) === 0)
        st.draft = {
          id: "draft",
          correction: !!random(2),
          items: [{ id: "i", cite: !!random(2), withdrawn: !!random(2) }],
          cits: { i: { mandatoryAppearance: !!random(2) } },
        };
      if (random(5) === 0) st.visit = { draft: !!random(2) };
      st.pendingSync = random(5) === 0;
      x.proofs[id] = { valid: random(5) !== 0, pendingTransaction: random(7) === 0 };
      x.docs[id] = [{ id: "pdf" + i, transfer: pick(["local outbox", "last verified location; refresh unavailable", "shared"]) }];
      x.locations["pdf" + i] = ["local"];
      if (random(5) === 0) x.invalid.push(id);
      return { k: { id, date: pick(["2026-01-01", "2025-12-01"]), snow: !!random(2) }, st };
    });
    for (const key of ["deposit", "confirm", "pending", "filing", "outbox", "artifacts"])
      if (random(3) === 0) x.tasks.push({ key, items: x.rows.map(({ k }) => ({ cid: k.id, action: 'data-open="issued"' })) });
    x.conflict = pick([null, "case0"]);
    x.folder = !!random(2);
    x.needGrant = !!random(2);
    x.fail = random(3) ? 0 : random(20) + 1;
    compare(x);
  }
  console.log(
    "PASS workspace queue equivalence " +
      checked +
      " scenarios: action priority, derived flags, aliases, task association, sorting and interrupted services",
  );
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
