/* Exact saved-work panel output and lazy read/escape/renderer ordering from the retained function. */
const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path"),
  acorn = require("acorn"),
  esbuild = require("esbuild");
(async () => {
  const source = fs.readFileSync("app/modules/saved_work.js", "utf8"),
    node = acorn.parse(source, { ecmaVersion: 2022, sourceType: "module" }).body.find((n) => n.declaration?.id?.name === "savedWorkHTML");
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
  const [current, legacy] = await Promise.all([
    compile(source),
    compile(source.slice(0, node.start) + fs.readFileSync("tests/fixtures/saved_work_html_reference.txt", "utf8") + source.slice(node.end)),
  ]);
  function run(api, input) {
    const x = structuredClone(input),
      calls = [];
    let sequence = 0;
    const methods = {
      esc: (value) => api.esc(value),
      caseState: (k) => x.states[k.id],
      docsFor: (id) => x.docs[id] || [],
      deliveredByCitation: (d) => d.delivered,
      pdfTransferState: (d) => d.transfer,
      caseFileName: (k) => k.number + ".json",
      caseUnsaved: (k) => x.unsaved.includes(k.id),
      summaryName: (k) => k.id + ".json",
      kase: (id) => x.cases.find((k) => k.id === id) || {},
      recoveryStatusHTML: () => "<p>Recovery status</p>",
    };
    const target = {
      CASES: x.cases,
      CASEDIR: x.folder ? { helper: x.helper } : null,
      NEEDGRANT: x.needGrant,
      PENDING: x.pending,
      PREFLIGHT_CONFLICT: x.conflict ? { cid: x.conflict } : null,
      LOCAL_SAVE: x.local,
      draftTimer: x.timer,
      COMMITTED: new Set(x.committed),
      CATALOG_AT: x.catalog,
      recordIntegrity: { status: (k) => x.proofs[k.id] },
    };
    for (const [key, fn] of Object.entries(methods))
      target[key] = (...args) => {
        calls.push(["call:" + key, ...structuredClone(args)]);
        if (++sequence === x.throwAt) throw new Error("interrupted " + key);
        return fn(...args);
      };
    const R = new Proxy(target, {
      get(o, k) {
        calls.push("get:" + k);
        return o[k];
      },
    });
    let html, error;
    try {
      html = api.savedWorkHTML(R, x.cid, x.health);
    } catch (e) {
      error = [e.name, e.message];
    }
    return { html, error, calls };
  }
  let seed = 20261113,
    checked = 0;
  const random = (n) => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return Math.floor((seed / 4294967296) * n);
    },
    pick = (a) => a[random(a.length)];
  function fixture(count = 2) {
    const cases = Array.from({ length: count }, (_, n) => ({ id: "case" + n, number: "QA-" + n + "<&>", address: "1 TEST <&> ST" }));
    return {
      cases,
      states: Object.fromEntries(cases.map((k) => [k.id, {}])),
      proofs: Object.fromEntries(cases.map((k) => [k.id, { valid: true }])),
      docs: {},
      unsaved: [],
      folder: true,
      helper: true,
      needGrant: false,
      pending: [],
      conflict: null,
      local: { ok: true, saving: false, at: "saved" },
      timer: null,
      committed: cases.map((k) => k.id + ".json"),
      catalog: "2026-10-28<&>",
      cid: "",
      health: { ok: true, outbox: 0 },
      throwAt: 0,
    };
  }
  function compare(x) {
    assert.deepEqual(run(current, x), run(legacy, x), "scenario " + checked++);
  }
  for (const count of [0, 1, 5, 6, 9]) for (const outbox of [0, 1, 2, null]) compare({ ...fixture(count), health: { outbox } });
  for (let n = 0; n < 3000; n++) {
    const x = fixture(random(11));
    x.folder = !!random(2);
    x.helper = !!random(2);
    x.needGrant = !!random(2);
    x.health = pick([{}, { checking: true }, { error: "offline <&>" }, { ok: false }, { caseReachable: false }, { ok: true, outbox: random(4) }]);
    x.local = { ok: !!random(2), saving: !!random(2), at: pick(["", "saved"]) };
    x.timer = random(4) ? null : 1;
    x.cid = pick(["", "case0", "missing"]);
    x.pending = pick([[], [{ cid: "case0", name: "queued<&>.json" }], [{ cid: "outside", name: "outside.json" }]]);
    x.throwAt = random(2) ? 0 : random(35) + 1;
    for (const k of x.cases) {
      x.states[k.id] = pick([{}, { draft: true }, { visit: true }, { pendingRecord: true }, { pendingDoc: true }, { pendingSync: true }]);
      x.proofs[k.id] = pick([{ valid: true }, { valid: false }, { valid: true, pendingTransaction: true }]);
      if (random(2)) x.unsaved.push(k.id);
      if (random(2)) x.docs[k.id] = [{ id: "issued", filedAt: pick(["", "filed"]), transfer: pick(["shared", "local outbox", "missing"]) }];
    }
    compare(x);
  }
  console.log(
    "PASS saved-work HTML equivalence " +
      checked +
      " scenarios: priority order, case limits, queues, health, recovery, escaping and interrupted renderers",
  );
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
