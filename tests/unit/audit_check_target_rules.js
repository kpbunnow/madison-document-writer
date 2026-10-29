/* Retained check routing protects message precedence, targets, lazy case/date reads and alias behavior. */
const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path"),
  acorn = require("acorn"),
  esbuild = require("esbuild");
(async () => {
  const source = fs.readFileSync("app/modules/reinspection.js", "utf8"),
    factory = acorn
      .parse(source, { ecmaVersion: 2022, sourceType: "module" })
      .body.find((n) => n.declaration?.id?.name === "createReinspection").declaration,
    fn = factory.body.body.find((n) => n.id?.name === "attachCheckTargets"),
    reference = fs.readFileSync("tests/fixtures/check_targets_reference.txt", "utf8");
  async function compile(contents) {
    const b = await esbuild.build({
      stdin: {
        contents: contents + '\nexport {WriterState} from "./state.js";export {validISO} from "./calendar.js";',
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
    new Function("today", "module", "exports", b.outputFiles[0].text)(new Date("2026-10-29T12:00:00Z"), box, box.exports);
    return box.exports;
  }
  const [current, legacy] = await Promise.all([compile(source), compile(source.slice(0, fn.start) + reference + source.slice(fn.end))]);
  function run(api, input) {
    const x = structuredClone(input),
      calls = [];
    let n = 0;
    api.WriterState.CASES = [x.k];
    api.WriterState.DOCS = [x.d];
    api.WriterState.EVENTS = {};
    const service = new Proxy(
        {
          inspection: new Proxy(
            {
              validISO(v) {
                calls.push(["validISO", v]);
                if (++n === x.fail) throw Error("interrupted date");
                return api.validISO(v);
              },
            },
            {
              get(t, k) {
                calls.push("inspection:" + String(k));
                return t[k];
              },
            },
          ),
        },
        {
          get(t, k) {
            calls.push("get:" + String(k));
            return t[k];
          },
        },
      ),
      owner = api.createReinspection(service);
    assert.deepEqual(calls, []);
    let result, error, same;
    try {
      result = owner.attachCheckTargets(x.d, x.c);
      same = result === x.c;
    } catch (e) {
      error = [e.name, e.message];
    }
    return { result, error, same, calls, input: x };
  }
  let seed = 20261129,
    checked = 0;
  const random = (n) => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return Math.floor((seed / 4294967296) * n);
    },
    pick = (a) => a[random(a.length)];
  const messages = [
    "Parcel",
    "Registered agent",
    "Mailing block",
    "Case number",
    "Signing inspector",
    "Explain the error",
    "Amendment instructions",
    "Original action date",
    "Mailing date",
    "Inspection result date",
    "Inspection date",
    "Three distinct due dates",
    "Duplicate items only once",
    "Citation court date",
    "Officer badge",
    "Unique citation number",
    "Citation issue dates",
    "Deposit",
    "Citation",
    "Withdrawn item needs a reason",
    "Compliance dates",
    "Unknown record conflict",
    "Parcel registered agent",
    "Inspection date deposit",
    "Case number signing",
  ];
  function fixture() {
    return {
      k: { id: "case", number: "CB2026-100-00001", address: "100 MAIN ST", date: "2026-01-01" },
      d: {
        id: "draft",
        caseId: "case",
        type: "notice",
        draft: true,
        authoringVersion: 16,
        items: [{ id: "one", no: "1", cite: true, due: "2026-11-10" }],
        cits: { one: { depositMode: "base", amount: "", base: "100", cc: "48", num: "", ord: "27.05" } },
      },
      c: { ok: false, t: "Deposit" },
      fail: 0,
    };
  }
  const selectors = new Set();
  function compare(x) {
    const a = run(current, x),
      b = run(legacy, x);
    assert.deepEqual(a, b, "case " + checked++);
    for (const t of a.result?.targets || []) selectors.add(t.selector);
  }
  for (const t of messages)
    for (const count of [0, 1, 3]) {
      const x = fixture();
      x.c.t = t;
      x.d.items = Array.from({ length: count }, (_, i) => ({ ...x.d.items[0], id: "item" + i, no: String(i + 1) }));
      compare(x);
    }
  for (let i = 0; i < 4000; i++) {
    const x = fixture();
    x.c.t = pick([...messages, null, 17]);
    x.c.ok = random(8) === 0;
    if (random(5) === 0) x.c.targets = [{ selector: "#existing", label: "Existing" }];
    x.fail = random(4);
    x.k.number = pick(["bad", "", x.k.number]);
    x.k.address = pick(["", x.k.address]);
    x.k.date = pick(["2026-01-01", "bad", ""]);
    x.d.fromReinspId = pick([null, "visit"]);
    if (random(3) === 0) x.d.correction = { case: { ...x.k, address: "Correction address" } };
    if (random(3) === 0) x.d.frozen = { case: { ...x.k, number: "bad" } };
    if (random(2)) x.d.inspDate = "2026-10-28";
    x.d.type = pick(["notice", "citation", "extension", "compliance"]);
    x.d.items = Array.from({ length: random(5) }, (_, j) => ({
      id: pick(["item" + j, 'quote"' + j]),
      no: String(j + 1),
      cite: !!random(2),
      done: !!random(2),
      withdrawn: !!random(2),
      withdrawalReason: pick(["", "Reason recorded"]),
      doneOn: pick(["", "bad", "2026-10-28", "2027-01-01"]),
      due: "2026-11-10",
    }));
    x.d.cits = Object.fromEntries(
      x.d.items.map((it) => [
        it.id,
        { depositMode: pick(["schedule", "base", "total", ""]), num: pick(["", "QA"]), amount: pick(["", "197"]), ord: pick(["", "27.05"]) },
      ]),
    );
    compare(x);
  }
  assert.ok(selectors.size >= 20, "exercise actual target routes");
  console.log(
    "PASS check target equivalence " +
      checked +
      " inputs: ordered routing, selectors, original/correction case facts, aliasing and service interruptions",
  );
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
