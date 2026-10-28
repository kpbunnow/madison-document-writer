/* Follow-up drafting preserves refusal order, registered draft aliases and partial effects. */
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
    fn = factory.body.body.find((n) => n.id?.name === "docFromReinspection"),
    reference = fs.readFileSync("tests/fixtures/followup_draft_reference.txt", "utf8");
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
    new Function("today", "module", "exports", b.outputFiles[0].text)(new Date("2026-10-28T12:00:00Z"), box, box.exports);
    return box.exports;
  }
  const [current, legacy] = await Promise.all([compile(source), compile(source.slice(0, fn.start) + reference + source.slice(fn.end))]);
  let seed = 20261103,
    checked = 0;
  const random = (n) => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return Math.floor((seed / 4294967296) * n);
    },
    pick = (a) => a[random(a.length)];
  function fixture() {
    return {
      type: "extension",
      src: {
        id: "src",
        caseId: "case",
        type: "notice",
        draft: false,
        mailed: "2026-01-01",
        items: [
          { id: "one", no: 1, title: "Repair wall", sections: ["27.05(2)(c)"], due: "2026-11-01" },
          { id: "two", no: "2", title: "Repair stair", sections: ["27.01"], due: "2026-11-01" },
        ],
      },
      r: {
        id: "visit",
        caseId: "case",
        sourceDocId: "src",
        draft: true,
        date: "2026-10-25",
        time: "09:00",
        inspectorId: "i4",
        results: { one: { oc: "none", due: "2026-11-01", cite: true, note: " observed " }, two: { oc: "none", due: "2026-11-01", cite: true } },
      },
      flags: {},
    };
  }
  function run(api, input, failAt) {
    const data = structuredClone(input),
      { r, src, flags } = data,
      s = api.WriterState,
      calls = [],
      registered = [];
    let serial = 0,
      effects = 0;
    Object.assign(s, {
      CASES: [{ id: "case", number: "QA-FOLLOWUP", address: "101 TEST ST", date: "2026-01-01", inspectorId: "i4" }],
      DOCS: flags.missingSource ? [] : [src],
      REINSP: [r],
      EVENTS: {},
      DIRTY: false,
      state: { screen: "reinspect", reinspId: r.id },
    });
    if (flags.linked)
      s.DOCS.push({
        id: "linked",
        caseId: "case",
        type: flags.linkedSupplemental ? "noOccupancy" : "extension",
        draft: flags.linkedDraft,
        items: [],
        special: {},
      });
    if (flags.referred) s.DOCS.push({ id: "referral", caseId: "case", type: "referral", draft: false, items: [] });
    function service(at) {
      return new Proxy(
        {},
        {
          get(_, key) {
            const name = at + "." + String(key);
            calls.push("get:" + name);
            if (["ui", "inspection", "authoring", "newDocuments", "depositStep"].includes(key)) return service(name);
            if (key === "eligibility" && flags.noEligibility) return undefined;
            return (...args) => {
              calls.push("call:" + name);
              if (++effects === failAt) throw Error("interrupted service");
              switch (key) {
                case "eligibility":
                  return flags.unavailable ? "Unavailable" : null;
                case "worksheetFaults":
                  return flags.faults ? ["First fault", "Second fault"] : [];
                case "validISO":
                  return api.validISO(args[0]);
                case "uid":
                  return args[0] + ++serial;
                case "itemHistory":
                  return [{ on: "2026-01-01", oc: "initial" }];
                case "itemInspectionHistory":
                  return [{ on: "2026-01-01", oc: "initial", no: args[1].no }];
                case "citationNumber":
                  return "CIT-" + ++serial;
                case "nextCourtDate":
                  return "2026-12-01";
                case "fmtDate":
                  return String(args[0] || "");
                case "applyDeposit":
                  registered.push(args[0]);
                  args[0].cits[args[1]].amount = "197.00";
                  break;
                case "toast":
                  calls.push(args[0]);
              }
            };
          },
        },
      );
    }
    const owner = api.createReinspection(service("services"));
    assert.deepEqual(calls, [], "inert construction");
    let value, error;
    try {
      value = owner.docFromReinspection(r, data.type);
    } catch (e) {
      error = [e.name, e.message];
    }
    return {
      value,
      error,
      calls,
      state: structuredClone(s),
      r,
      source: src,
      registered: registered.map((d) => ({ id: d.id, retained: s.DOCS.includes(d), value: structuredClone(d) })),
    };
  }
  function compare(input, failAt) {
    assert.deepEqual(run(current, input, failAt), run(legacy, input, failAt), "scenario " + checked++);
  }
  for (const type of ["extension", "citation", "referral", "referralUpdate", "compliance"]) {
    const x = fixture();
    x.type = type;
    if (type === "compliance") Object.values(x.r.results).forEach((r) => (r.oc = "corrected"));
    const drafted = run(current, x);
    assert.equal(drafted.error, undefined, type);
    assert.equal(drafted.state.state.screen, "write", type);
    assert.equal(drafted.state.DIRTY, true, type);
    assert.equal(drafted.state.DOCS[0].type, type);
    assert.equal(drafted.r.docId, drafted.state.DOCS[0].id);
    if (type === "citation") {
      assert.equal(drafted.registered.length, 2);
      assert.ok(drafted.registered.every((d) => d.retained));
    }
    compare(x);
    for (let failAt = 1; failAt <= 20; failAt++) compare(x, failAt);
  }
  for (let n = 0; n < 2500; n++) {
    const x = fixture();
    x.type = pick(["extension", "citation", "referral", "referralUpdate", "compliance", "unknown"]);
    for (const result of Object.values(x.r.results)) {
      result.oc = pick(["none", "corrected", "progress", "withdrawn", ""]);
      result.cite = !!random(2);
      result.on = pick(["", "2026-10-24"]);
      result.carried = random(8) === 0;
    }
    x.r.docId = pick([undefined, "lost", "linked"]);
    x.r.draft = !!random(2);
    x.r.recordedAt = pick([undefined, "2026-10-25"]);
    x.r.date = pick(["2026-10-25", "2027-01-01", "bad"]);
    x.src.void = random(10) === 0;
    x.src.superseded = random(10) === 0;
    x.flags = {
      linked: random(3) === 0,
      linkedDraft: !!random(2),
      linkedSupplemental: !!random(2),
      referred: random(5) === 0,
      missingSource: random(10) === 0,
      unavailable: random(8) === 0,
      faults: random(8) === 0,
      noEligibility: random(5) === 0,
    };
    compare(x);
  }
  console.log("PASS follow-up draft equivalence " + checked + " scenarios: guards, partial effects, document registration and service order");
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
