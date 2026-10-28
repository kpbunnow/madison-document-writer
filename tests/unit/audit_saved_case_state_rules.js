/* Status/refusal precedence and live context reads against retained saved-case classification. */
const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path"),
  acorn = require("acorn"),
  esbuild = require("esbuild");
(async () => {
  const source = fs.readFileSync("app/modules/saved_work.js", "utf8"),
    node = acorn.parse(source, { ecmaVersion: 2022, sourceType: "module" }).body.find((n) => n.declaration?.id?.name === "savedCaseState");
  async function compile(contents) {
    const b = await esbuild.build({ stdin: { contents, resolveDir: path.resolve("app/modules") }, bundle: true, write: false, format: "cjs" });
    const box = { exports: {} };
    new Function("module", "exports", b.outputFiles[0].text)(box, box.exports);
    return box.exports;
  }
  const [current, legacy] = await Promise.all([
    compile(source),
    compile(source.slice(0, node.start) + fs.readFileSync("tests/fixtures/saved_case_state_reference.txt", "utf8") + source.slice(node.end)),
  ]);
  function run(api, input) {
    const x = structuredClone(input),
      reads = [];
    let calls = 0;
    const observed = (o, label) =>
      new Proxy(o, {
        get(v, k) {
          if (typeof k !== "symbol") reads.push(label + "." + k);
          return v[k];
        },
      });
    const k = observed({ id: "case", number: "QA-1" }, "case"),
      methods = {
        caseState: () => observed(x.st, "state"),
        caseFileName: () => "case.json",
        docsFor: () => x.docs.map((d, i) => observed(d, "doc" + i)),
        deliveredByCitation: (d) => d.delivered,
        pdfTransferState: (d) => d.transfer,
        caseUnsaved: () => x.unsaved,
        summaryName: () => "summary.json",
      };
    const R = observed(
      {
        ...methods,
        recordIntegrity: observed(
          {
            status() {
              reads.push("call:proof");
              return observed(x.proof, "proof");
            },
          },
          "integrity",
        ),
        CASEDIR: x.folder ? observed({ helper: x.helper }, "folder") : null,
        NEEDGRANT: x.needGrant,
        PENDING: x.pending,
        PREFLIGHT_CONFLICT: x.conflict ? { cid: "case" } : null,
        LOCAL_SAVE: observed(x.local, "local"),
        draftTimer: x.timer,
        COMMITTED: new Set(x.committed ? ["summary.json"] : []),
      },
      "context",
    );
    for (const key of Object.keys(methods)) {
      const fn = methods[key];
      methods[key] = (...args) => {
        reads.push("call:" + key);
        if (++calls === x.throwAt) throw new Error("interrupted " + key);
        return fn(...args);
      };
    }
    // Assign through the underlying target so every public context method uses the same invocation recorder.
    for (const [key, fn] of Object.entries(methods)) R[key] = fn;
    let result, error;
    try {
      result = api.savedCaseState(R, k, x.available);
    } catch (e) {
      error = [e.name, e.message];
    }
    return { result, error, reads };
  }
  let seed = 20261112,
    checked = 0;
  const random = (n) => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return Math.floor((seed / 4294967296) * n);
    },
    pick = (a) => a[random(a.length)];
  function fixture() {
    return {
      st: {},
      proof: { valid: true },
      folder: true,
      helper: true,
      needGrant: false,
      pending: [],
      conflict: false,
      local: { ok: true, saving: false, at: "saved" },
      timer: null,
      docs: [],
      unsaved: false,
      committed: true,
      available: undefined,
      throwAt: 0,
    };
  }
  function compare(x) {
    assert.deepEqual(run(current, x), run(legacy, x), "scenario " + checked++);
  }
  compare(fixture());
  for (const available of [undefined, false, true])
    for (let bits = 0; bits < 32; bits++) {
      compare({
        ...fixture(),
        available,
        folder: !!(bits & 1),
        helper: !!(bits & 2),
        committed: !!(bits & 4),
        unsaved: !!(bits & 8),
        needGrant: !!(bits & 16),
      });
    }
  for (const key of ["pendingRecord", "pendingDoc", "draft", "visit", "pendingSync"]) compare({ ...fixture(), st: { [key]: true } });
  for (const transfer of ["shared", "local outbox", "missing"])
    for (const filedAt of ["", "2026-10-28"]) compare({ ...fixture(), docs: [{ id: "issued", filedAt, transfer }] });
  for (let n = 0; n < 5000; n++) {
    const x = fixture();
    for (const key of ["pendingRecord", "pendingDoc", "draft", "visit", "pendingSync"]) if (random(8) === 0) x.st[key] = true;
    x.proof = { valid: random(7) ? true : false, pendingTransaction: random(8) === 0 };
    for (const key of ["folder", "helper", "needGrant", "conflict", "unsaved", "committed"]) x[key] = random(3) !== 0;
    x.local = { ok: !!random(2), saving: !!random(2), at: random(2) ? "saved" : "" };
    x.timer = random(4) ? null : 1;
    x.available = pick([undefined, false, true]);
    x.pending = pick([[], [{ cid: "case" }], [{ name: "case.json" }], [{ cid: "other", name: "other.json" }]]);
    x.docs = Array.from({ length: random(4) }, (_, i) => ({
      id: "doc" + i,
      draft: random(6) === 0,
      void: random(6) === 0,
      superseded: random(6) === 0,
      delivered: random(4) === 0,
      filedAt: pick(["", "2026-10-28"]),
      transfer: pick(["shared", "local outbox", "missing"]),
    }));
    x.throwAt = random(6);
    compare(x);
  }
  console.log(
    "PASS saved-case state equivalence " + checked + " scenarios: refusal precedence, PDF/queue/connection states, lazy reads and interruptions",
  );
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
