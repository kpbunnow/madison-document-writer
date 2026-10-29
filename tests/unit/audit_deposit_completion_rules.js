/* Real policy computation pins completion decisions, source basis, draft mutation and date-call order. */
const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path"),
  esbuild = require("esbuild");
(async () => {
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
    new Function("document", "module", "exports", b.outputFiles[0].text)({ addEventListener() {} }, box, box.exports);
    return box.exports;
  }
  const [current, legacy] = await Promise.all([
    compile(fs.readFileSync("app/modules/deposit_step.js", "utf8")),
    compile(fs.readFileSync("tests/fixtures/deposit_step_reference.txt", "utf8")),
  ]);
  function run(api, input) {
    const x = structuredClone(input),
      calls = [];
    let n = 0;
    api.WriterState.DIRTY = false;
    const owner = api.initDepositStep(
      new Proxy(
        {},
        {
          get(_, key) {
            calls.push("get:" + key);
            return (c, d) => {
              calls.push(["call:" + key, structuredClone(c), structuredClone(d)]);
              if (++n === x.fail) throw new Error("date interrupted");
              if (x.mutate) c.depositSource = "Updated approved source";
              return x.date;
            };
          },
        },
      ),
    );
    assert.deepEqual(calls, []);
    let result, error;
    try {
      result = owner.complete(x.d, "item", x.values);
    } catch (e) {
      error = [e.name, e.message];
    }
    return { result, error, d: x.d, dirty: api.WriterState.DIRTY, calls };
  }
  let seed = 20261117,
    checked = 0;
  const random = (n) => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return Math.floor((seed / 4294967296) * n);
    },
    pick = (a) => a[random(a.length)];
  function fixture() {
    return {
      d: {
        id: "draft",
        authoringVersion: 16,
        items: [{ id: "item", sections: ["SPS321.125"] }],
        cits: {},
        depositRequests: {
          item: { ord: "SPS321.125", depositMode: "base", base: "100", amount: "197.00", cc: "48", depositSource: "Approved court basis", tier: 1 },
        },
      },
      values: {},
      date: "2026-10-11",
      fail: 0,
      mutate: false,
    };
  }
  function compare(x) {
    assert.deepEqual(run(current, x), run(legacy, x), "scenario " + checked++);
  }
  for (const mode of ["schedule", "base", "total", "invalid"])
    for (const source of ["", "short", "Approved court basis"])
      for (const amount of ["0", "100", "invalid"])
        compare({ ...fixture(), values: { depositMode: mode, depositSource: source, amount, base: amount } });
  for (let i = 0; i < 3000; i++) {
    const x = fixture(),
      c = x.d.depositRequests.item;
    c.ord = pick(["27.05(2)(c)", "SPS321.125", "23.45", "29.40(4)(b)", ""]);
    c.depositMode = pick(["schedule", "base", "total", "invalid"]);
    c.base = pick(["0", "100", "5000", "", null, "invalid"]);
    c.amount = pick(["0", "197.00", "", null, "invalid"]);
    c.depositSource = pick(["", "short", "Approved court basis"]);
    c.measurements = pick([{}, { area: 200000, days: 400 }, { diameter: 12, removed: true }]);
    c.ordEditingFrom = "old";
    if (random(3) === 0) x.values = { depositMode: pick(["base", "total"]), amount: "250.00", depositSource: "Approved override basis" };
    x.fail = random(4);
    x.mutate = !!random(2);
    x.d.authoringVersion = pick([6, 9, 16]);
    if (random(19) === 0) x.d.depositRequests = {};
    compare(x);
  }
  console.log(
    "PASS deposit completion equivalence " + checked + " inputs: actual policy, manual/scheduled/refused basis, mutation and service exceptions",
  );
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
