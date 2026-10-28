/* Actual history transport and matching retain source order, duplicate rules and service reads. */
const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path"),
  acorn = require("acorn"),
  esbuild = require("esbuild");
(async () => {
  const source = fs.readFileSync("app/modules/citation_pricing.js", "utf8"),
    factory = acorn
      .parse(source, { ecmaVersion: 2022, sourceType: "module" })
      .body.find((n) => n.declaration?.id?.name === "initCitationPricing").declaration,
    fn = factory.body.body.find((n) => n.id?.name === "priorOffenses");
  async function compile(contents) {
    const b = await esbuild.build({
      stdin: { contents: contents + '\nexport {WriterState} from "./state.js";', resolveDir: path.resolve("app/modules") },
      bundle: true,
      write: false,
      format: "cjs",
      define: { __TEST_BUILD__: "true" },
      plugins: [
        {
          name: "data",
          setup(b) {
            b.onResolve({ filter: /\/data\// }, (a) => ({ path: path.resolve("build/generated/modules/data", path.basename(a.path)) }));
          },
        },
      ],
    });
    const box = { exports: {} },
      context = { remote: [], calls: [] };
    new Function("document", "fetch", "module", "exports", b.outputFiles[0].text)(
      { addEventListener: () => {}, querySelector: () => null },
      async (url, options) => {
        context.calls.push(["fetch", url, options.cache]);
        return { ok: true, status: 200, json: async () => ({ ok: true, history: structuredClone(context.remote) }) };
      },
      box,
      box.exports,
    );
    return { api: box.exports, context };
  }
  const [current, legacy] = await Promise.all([
    compile(source),
    compile(source.slice(0, fn.start) + fs.readFileSync("tests/fixtures/citation_prior_history_reference.txt", "utf8") + source.slice(fn.end)),
  ]);
  let seed = 20261110,
    checked = 0;
  const random = (n) => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return Math.floor((seed / 4294967296) * n);
    },
    pick = (a) => a[random(a.length)];
  function baseCase(number = "QA-PRIOR") {
    return {
      id: number,
      number,
      owner: "SYNTHETIC OWNER",
      ownerAddr: ["101 TEST ST", "MADISON WI 53703"],
      address: "101 TEST ST",
      parcel: "070913125237",
      date: "2026-10-01",
      time: "09:00",
    };
  }
  function record(number = "QA-PRIOR") {
    const k = baseCase(number);
    return {
      case: k,
      document: {
        id: number,
        type: "citation",
        draft: false,
        inspDate: "2026-10-01",
        inspTime: "09:00",
        items: [{ id: "a", cite: true }],
        cits: { a: { ord: "27.05(2)(c)", scheduleEntryId: "match", num: "QA-1", issued: "2026-10-01", violDate: "2026-10-01" } },
        frozen: { case: k },
      },
    };
  }
  function fixture(window) {
    return {
      entry: { id: "match", window },
      respondent: baseCase("QA-CURRENT"),
      remote: [record()],
      local: [record("QA-LOCAL")],
      staged: [],
      date: "2026-10-27",
      excludeId: "",
      throwAt: 0,
    };
  }
  async function run(composed, input) {
    const x = structuredClone(input),
      { api, context } = composed,
      s = api.WriterState;
    context.calls = [];
    context.remote = x.remote;
    Object.assign(s, { HELPER: { ok: true }, CASEDIR: { helper: true }, DOCS: [], CASES: [], state: {}, EVENTS: {} });
    const reads = [];
    function observed(value, label) {
      return new Proxy(value, {
        get(o, k) {
          if (typeof k !== "symbol") reads.push(label + "." + k);
          return o[k];
        },
      });
    }
    let lookups = 0;
    const services = new Proxy(
      {
        lookupForf(...args) {
          context.calls.push(["lookup", ...args]);
          if (++lookups === x.throwAt) throw new Error("lookup interrupted");
          return args[2] ? { id: args[2], window: x.entry?.window } : null;
        },
      },
      {
        get(o, k) {
          reads.push("service." + k);
          return o[k];
        },
      },
    );
    const owner = api.initCitationPricing(services);
    assert.deepEqual(reads, [], "construction must retain lazy services");
    assert.equal(await owner.loadShared({ id: "loader", draft: false }, true), true);
    s.DOCS = x.local.map((r, n) => {
      r.document.frozen.case = observed(r.case, "case" + n);
      return observed(r.document, "doc" + n);
    });
    let result, error;
    try {
      result = owner.priorOffenses({
        ordinanceEntry: x.entry ? observed(x.entry, "entry") : null,
        respondent: observed(x.respondent, "respondent"),
        violationDate: x.date,
        excludeId: x.excludeId,
        staged: x.staged,
      });
    } catch (e) {
      error = [e.name, e.message];
    }
    return { result, error, reads, calls: structuredClone(context.calls) };
  }
  async function compare(x) {
    assert.deepEqual(await run(current, x), await run(legacy, x), "scenario " + checked++);
  }
  const windows = ["site", "respondent", { months: 12 }, { years: 5 }, { kind: "site-season", startMonthDay: "07-01" }];
  for (const window of windows)
    for (const date of ["2026-06-30", "2026-07-01", "2026-10-27"])
      for (const num of ["QA-1", "QA-2", ""]) {
        const x = fixture(window);
        x.date = date;
        x.local[0].document.cits.a.num = num;
        x.staged = [{ entryId: "match", number: "prepared", date: "2026-07-01" }];
        await compare(x);
      }
  for (let n = 0; n < 4000; n++) {
    const x = fixture(pick(windows));
    x.remote = Array.from({ length: random(4) }, (_, i) => record(i ? "QA-SHARED" + i : "QA-CURRENT"));
    x.local = Array.from({ length: random(4) }, (_, i) => record("QA-LOCAL" + i));
    for (const r of x.remote.concat(x.local)) {
      r.case.owner = pick(["SYNTHETIC OWNER", "OTHER OWNER", "", null]);
      r.case.parcel = pick(["070913125237", "070913125238", "", null]);
      r.case.address = pick(["101 TEST ST", "202 OTHER ST", ""]);
      r.case.ownerAddr = pick([["101 TEST ST", "MADISON WI 53703"], ["202 OTHER ST", "MADISON WI 53703"], []]);
      r.document.draft = random(5) === 0;
      r.document.void = random(8) === 0;
      r.document.superseded = random(8) === 0;
      r.document.type = pick(["citation", "citation", "notice"]);
      r.document.items[0].cite = !!random(2);
      r.document.items[0].withdrawn = random(4) === 0;
      r.document.cits.a.num = pick(["QA-1", "QA-2", "", null]);
      r.document.cits.a.scheduleEntryId = pick(["match", "other", ""]);
      r.document.cits.a.violDate = pick(["2026-07-01", "2026-06-30", "2025-10-01", "2027-01-01", "", null]);
      if (random(2)) r.document.items.push({ id: "b", cite: true });
      if (random(2)) r.document.cits.b = { ...r.document.cits.a };
      if (random(7) === 0) delete r.document.cits;
    }
    x.excludeId = pick(["", "QA-LOCAL0"]);
    x.date = pick(["2026-10-27", "2026-07-01", "2026-06-30"]);
    x.throwAt = random(5);
    if (random(2)) x.staged = [{ entryId: pick(["match", "other"]), date: pick(["2026-07-01", "2027-01-01"]), number: "prepared" }];
    if (random(17) === 0) x.entry = null;
    await compare(x);
  }
  console.log(
    "PASS prior citation history equivalence " +
      checked +
      " scenarios: shared/local order, matching, windows, duplicates, staged facts and interruptions",
  );
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
