/* Complete review-card HTML, state and ordered peer reads/effects/errors against the retained presentation. */
const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path"),
  acorn = require("acorn"),
  esbuild = require("esbuild");
(async () => {
  const source = fs.readFileSync("app/modules/citation_workflow.js", "utf8"),
    tree = acorn.parse(source, { ecmaVersion: 2022, sourceType: "module" }),
    fn = tree.body
      .find((n) => n.declaration?.id?.name === "createCitationWorkflow")
      .declaration.body.body.find((n) => n.id?.name === "citationReview"),
    reference = fs.readFileSync("tests/fixtures/citation_review_reference.txt", "utf8");
  async function load(contents) {
    const b = await esbuild.build({
      stdin: {
        contents:
          contents +
          '\nexport {WriterState} from "./state.js";export {feeLines,chargeChoices,choosesCharge} from "./citation_charges.js";export {resolveCitationAmount} from "./citation_policy.js";',
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
  const [current, old] = await Promise.all([load(source), load(source.slice(0, fn.start) + reference + source.slice(fn.end))]);
  function run(api, x) {
    const calls = [];
    let count = 0;
    const price = api.resolveCitationAmount({ ordinance: "27.05(2)(c)", tier: 1, date: "2026-10-11" }),
      c = {
        ...price,
        ord: x.ord,
        num: "B90000000001",
        tier: "1st",
        issued: "2026-10-11",
        pricedOn: "2026-10-11",
        depositMode: x.mode,
        desc: "Description <&>",
        comment: "Comment <&>",
        courtDate: "2026-11-04",
        courtTime: "09:00",
        mandatoryAppearance: x.held,
        reconfirmDeposit: x.reconfirm,
        measurements: x.measurements ? { area: 200, days: 3, removed: false, custom: "Value <&>" } : undefined,
        overrideBasis: x.override ? { id: "override" } : null,
        historicalDeposit: x.retained,
      };
    const item = {
      id: 'item <&> "id"',
      no: "1 <&>",
      title: "Title <&>",
      sections: x.multiple ? ["27.05(2)(c)", "29.40(4)(b)"] : ["27.05(2)(c)"],
      cite: true,
    };
    const d = {
      id: "doc <&>",
      caseId: "case",
      type: x.type,
      draft: true,
      mailed: "2026-10-11",
      items: [item, { id: "withdrawn", no: "2", cite: true, withdrawn: true }, { id: "not-cited", no: "3", cite: false }],
      cits: x.request || x.missing ? {} : { [item.id]: c },
      depositRequests: x.request ? { [item.id]: { ...c, reason: "Completion reason <&>" } } : {},
      correction: x.correction ? { targetId: "issued" } : null,
    };
    Object.assign(api.WriterState, { CASES: [{ id: "case", date: "2026-10-11", time: "10:00" }], DOCS: [d], REINSP: [], EVENTS: {} });
    const effect =
      (name, fn) =>
      (...a) => {
        calls.push([name, structuredClone(a)]);
        if (++count === x.fail) throw Error("interrupted:" + name);
        return fn(...a);
      };
    const values = {
      today: new Date("2026-10-29T12:00:00Z"),
      isLocked: effect("locked", () => x.locked),
      initialCitations: {
        enabled: effect("initial", () => x.initial),
        preview: effect("preview", (a) => ({ ...a, type: "citation", initialPreview: true })),
      },
      citationPricing: {
        refresh: effect("refresh", (a) => {
          if (x.mutate && a.cits[item.id]) a.cits[item.id].comment += "!";
        }),
        ensureShared: effect("shared", () => false),
        determined: effect("determined", () => x.determined),
        unchangedCorrection: effect("unchanged", () => null),
        hint: effect("hint", () => "Pricing <&> hint"),
      },
      snow: { is: effect("snow", () => x.snow) },
      chargeChoices: effect("choices", api.chargeChoices),
      choosesCharge: effect("multiple", api.choosesCharge),
      feeLines: effect("fees", api.feeLines),
      fmtDate: effect("date", (v) => v),
      depositStep: { form: effect("form", () => "<form>Actual owned completion fragment</form>") },
      administration: { overrideFault: effect("override", () => (x.overrideFault ? "Override <&> fault" : "")) },
    };
    const services = new Proxy(values, {
      get(t, k) {
        calls.push(["get", String(k)]);
        if (++count === x.fail) throw Error("interrupted:get:" + String(k));
        assert.ok(k in t, "unknown adapter " + String(k));
        return t[k];
      },
    });
    const owner = api.createCitationWorkflow(services);
    assert.equal(calls.length, 0);
    let value,
      error = null;
    try {
      value = owner.citationReview(d);
    } catch (e) {
      error = [e.name, e.message];
    }
    return { value, error, calls, d };
  }
  let count = 0,
    ready = 0,
    held = 0,
    request = 0,
    preview = 0;
  for (let n = 0; n < 4096; n++) {
    const x = {
      type: n % 17 ? "citation" : "notice",
      ord: ["27.05(2)(c)", "29.40(4)(b)", "SPS321.125", ""][n % 4],
      mode: ["schedule", "base", "total"][Math.floor(n / 4) % 3],
      multiple: !!(n & 16),
      initial: !!(n & 32),
      determined: !!(n & 64),
      snow: !!(n & 128),
      correction: !!(n & 256),
      measurements: !!(n & 512),
      request: n % 7 === 0,
      missing: n % 23 === 0,
      held: n % 11 === 0,
      reconfirm: n % 13 === 0,
      locked: n % 19 === 0,
      override: n % 29 === 0,
      overrideFault: n % 31 === 0,
      retained: n % 37 === 0,
      mutate: n % 41 === 0,
      fail: n % 43 === 0 ? (n % 35) + 1 : 0,
    };
    const a = run(current, x);
    assert.deepEqual(a, run(old, x), "review:" + n);
    if (a.value) {
      if (a.value.includes("Deposit ready")) ready++;
      if (a.value.includes("Wording approval required")) held++;
      if (a.value.includes("Completion required")) request++;
      if (a.value.includes("Initial-inspection citations")) preview++;
    }
    count++;
  }
  assert.ok(ready > 100 && held > 100 && request > 100 && preview > 100, "all status/preview branches render");
  assert.equal(count, 4096);
  console.log("PASS citation review templates " + count + " exact HTML/state/ordered-effect/error comparisons");
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
