/* Retained editing comparisons pin field dispatch, pricing effects, errors and partial mutations. */
const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path"),
  esbuild = require("esbuild");
(async () => {
  async function compile(contents) {
    const b = await esbuild.build({
      stdin: {
        contents: contents + '\nexport {WriterState} from "./state.js"; export {feeLines} from "./citation_charges.js";',
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
    compile(fs.readFileSync("app/modules/citation_workflow.js", "utf8")),
    compile(fs.readFileSync("tests/fixtures/citation_workflow_reference.txt", "utf8")),
  ]);
  function run(api, input) {
    const x = structuredClone(input),
      calls = [];
    let count = 0;
    function effect(key, args) {
      calls.push([key, structuredClone(args)]);
      if (++count === x.fail) throw new Error("interrupted:" + key);
    }
    const values = {
      citationPricing: {
        refresh(d) {
          effect("refresh", [d]);
          if (x.mutate) d.cits.item.depositSource = "Revised approved source";
        },
      },
      changeCharge(d, id, value) {
        effect("changeCharge", [d, id, value]);
        const c = d.cits[id] || d.depositRequests[id];
        c.ord = value;
        return x.changed;
      },
      applyDeposit(d, id, ord) {
        effect("applyDeposit", [d, id, ord]);
        d.cits[id].amount = "245.00";
      },
      feeLines(...args) {
        effect("feeLines", args);
        return api.feeLines(...args);
      },
      citationPricingDate(c, d) {
        effect("citationPricingDate", [c, d]);
        return "2026-10-25";
      },
    };
    const services = new Proxy(values, {
      get(t, k) {
        calls.push("get:" + k);
        return t[k];
      },
    });
    const owner = api.createCitationWorkflow(services);
    assert.deepEqual(calls, [], "construction remains inert");
    let result, error;
    try {
      result = owner.editCitation(x.d, x.id, x.field, x.value, x.phase);
    } catch (e) {
      error = [e.name, e.message];
    }
    return { result, error, d: x.d, calls };
  }
  let seed = 20261119,
    checked = 0;
  const random = (n) => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return Math.floor((seed / 4294967296) * n);
    },
    pick = (a) => a[random(a.length)];
  const fields = [
    "ord",
    "ordOther",
    "courtDate",
    "issued",
    "violDate",
    "courtTime",
    "violTime",
    "tierOverride",
    "tierOverrideSource",
    "amount",
    "desc",
    "depositMode",
    "base",
    "cc",
    "depositSource",
    "scheduleEntryId",
    "unknown",
  ];
  function fixture() {
    return {
      d: {
        id: "draft",
        authoringVersion: 16,
        cits: {
          item: {
            ord: "27.05(2)(c)",
            amount: "197.00",
            base: "100.00",
            cc: "48.00",
            depositMode: "base",
            depositSource: "Approved court authority",
            resolvedVia: "schedule",
            pricedOn: "2026-10-25",
            issued: "2026-10-25",
            reconfirmDeposit: true,
          },
        },
        depositRequests: {},
        correction: { reviewed: true },
      },
      id: "item",
      field: "amount",
      value: "200",
      phase: "commit",
      fail: 0,
      mutate: false,
      changed: true,
    };
  }
  function compare(x) {
    assert.deepEqual(run(current, x), run(legacy, x), "scenario " + checked++);
  }
  for (const field of fields)
    for (const value of ["", "bad", "100.00", "0", "schedule", "base", "total", "Approved documented basis", null])
      for (const phase of ["input", "commit"]) {
        const x = fixture();
        Object.assign(x, { field, value, phase });
        compare(x);
      }
  for (let n = 0; n < 5000; n++) {
    const x = fixture(),
      c = x.d.cits.item;
    Object.assign(x, {
      field: pick(fields),
      value: pick([
        "",
        " ",
        "bad",
        "-1",
        "0",
        "100.00",
        "250",
        "10/26/2026",
        "9:30 AM",
        "schedule",
        "base",
        "total",
        "Approved documented basis",
        null,
        0,
        10,
      ]),
      phase: pick(["input", "commit", undefined]),
      fail: random(5),
      mutate: !!random(2),
      changed: !!random(2),
    });
    c.depositMode = pick(["schedule", "base", "total", ""]);
    c.base = pick(["100", "bad", "0", null]);
    c.cc = pick(["48", "bad", null]);
    c.amount = pick(["197", "bad", "0"]);
    c.depositSource = pick(["Approved court authority", "", null]);
    c.resolvedVia = pick(["schedule", "approved-base", "", null]);
    if (random(2)) c.ordEditingFrom = "27.04";
    if (random(2)) c.depositEditInvalid = true;
    if (random(2)) delete x.d.correction;
    if (random(5) === 0) {
      x.d.depositRequests.item = c;
      delete x.d.cits.item;
    }
    if (random(15) === 0) x.id = "missing";
    compare(x);
  }
  console.log("PASS citation editing equivalence " + checked + " inputs: fields, phases, real fees, lazy services and interruptions");
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
