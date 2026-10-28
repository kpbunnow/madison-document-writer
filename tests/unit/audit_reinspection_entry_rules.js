/* Starting a worksheet preserves correction/draft priority and live imported-visit updates. */
const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path"),
  acorn = require("acorn"),
  esbuild = require("esbuild");
(async () => {
  const source = fs.readFileSync("app/modules/reinspection_entry.js", "utf8"),
    factory = acorn
      .parse(source, { ecmaVersion: 2022, sourceType: "module" })
      .body.find((n) => n.declaration?.id?.name === "createReinspectionEntry").declaration,
    fn = factory.body.body.find((n) => n.id?.name === "startReinspection"),
    reference = fs.readFileSync("tests/fixtures/reinspection_entry_reference.txt", "utf8");
  async function compile(contents) {
    const b = await esbuild.build({
      stdin: { contents: contents + '\nexport {WriterState} from "./state.js";', resolveDir: path.resolve("app/modules") },
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
  const [current, legacy] = await Promise.all([compile(source), compile(source.slice(0, fn.start) + reference + source.slice(fn.end))]);
  let seed = 20261104,
    checked = 0;
  const random = (n) => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return Math.floor((seed / 4294967296) * n);
    },
    pick = (a) => a[random(a.length)];
  function fixture() {
    return {
      flags: {},
      drafts: [],
      src: {
        id: "src",
        type: "notice",
        items: [
          { id: "one", done: false },
          { id: "two", done: true, doneOn: "2026-01-01" },
        ],
      },
      open: null,
      row: undefined,
    };
  }
  function run(api, input, failAt) {
    const data = structuredClone(input),
      { flags, src, open, row } = data,
      s = api.WriterState,
      calls = [];
    let effects = 0;
    Object.assign(s, {
      CASES: [{ id: "case", number: "QA-ENTRY", inspectorId: "i4" }],
      DOCS: data.drafts,
      REINSP: open ? [open] : [],
      EVENTS: {},
      WORK: { walk: { active: true } },
      DIRTY: false,
      state: { screen: "cases" },
    });
    function services(at) {
      return new Proxy(
        {},
        {
          get(_, key) {
            const name = at + "." + String(key);
            calls.push("get:" + name);
            if (key === "snow" || key === "recordIntegrity" || key === "newDocuments") return services(name);
            if (key === "today") return new Date("2026-10-28T12:00:00Z");
            return (...args) => {
              calls.push(["call:" + name, ...args.map((x) => (x && typeof x === "object" ? x.id || "object" : x))]);
              if (++effects === failAt) throw Error("interrupted service");
              switch (key) {
                case "isCase":
                  return flags.snow;
                case "blocked":
                  return flags.blocked;
                case "clearWalk":
                  if (flags.clearDrafts) s.DOCS = [];
                  break;
                case "unissuedVisitFor":
                  return flags.unissued ? open : null;
                case "sourceDocFor":
                  return flags.noSource ? null : src;
                case "uid":
                  return "visit-new";
                case "continuingItems":
                  return src.items;
              }
            };
          },
        },
      );
    }
    const owner = api.createReinspectionEntry(services("services"));
    assert.deepEqual(calls, [], "inert construction");
    let value, error;
    try {
      value = owner.startReinspection("case", row);
    } catch (e) {
      error = [e.name, e.message];
    }
    return { value, error, calls, state: structuredClone(s), data, retained: open ? s.REINSP.includes(open) : null };
  }
  function compare(input, failAt) {
    assert.deepEqual(run(current, input, failAt), run(legacy, input, failAt), "scenario " + checked++);
  }
  const created = run(current, fixture());
  assert.equal(created.error, undefined);
  assert.equal(created.state.REINSP.length, 1);
  assert.equal(created.state.state.screen, "reinspect");
  assert.equal(created.state.REINSP[0].results.two.carried, true);
  compare(fixture());
  for (let n = 0; n < 3000; n++) {
    const x = fixture();
    x.flags = { snow: random(10) === 0, blocked: random(10) === 0, clearDrafts: random(5) === 0, unissued: !!random(2), noSource: random(8) === 0 };
    if (random(3) === 0) x.drafts = [{ id: "draft", caseId: "case", draft: true, correction: random(2) ? {} : null }];
    if (random(2))
      x.open = {
        id: "open",
        caseId: "case",
        draft: !!random(2),
        date: "2026-10-20",
        time: "08:00",
        inspectorId: "i4",
        results: { one: { on: pick(["", "2026-10-20", "2026-10-19"]), carried: !!random(2), manualDate: !!random(2) } },
      };
    if (random(2))
      x.row = { date: pick(["2026-10-24", "2026-10-25"]), time: pick([undefined, "09:00"]), inspectorId: pick([undefined, "i5"]), id: "imported" };
    x.src.type = pick(["notice", "citation", "compliance"]);
    if (random(6) === 0) x.src.items = [];
    for (const it of x.src.items) {
      it.withdrawn = random(4) === 0;
      it.done = !!random(2);
    }
    compare(x);
    if (n < 100) for (const failAt of [1, 3, 5, 8, 12]) compare(x, failAt);
  }
  console.log("PASS reinspection entry equivalence " + checked + " scenarios: guards, imported dates, carried results and live effect order");
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
