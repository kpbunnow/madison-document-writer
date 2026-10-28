/* Compare scoped action dispatch, draft family caches, DOM effects and service order. */
const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path"),
  acorn = require("acorn"),
  esbuild = require("esbuild"),
  { JSDOM } = require("jsdom");
(async () => {
  const source = fs.readFileSync("app/modules/new_documents.js", "utf8"),
    factory = acorn
      .parse(source, { ecmaVersion: 2022, sourceType: "module" })
      .body.find((n) => n.declaration?.id?.name === "initNewDocuments").declaration,
    fn = factory.body.body.find((n) => n.id?.name === "editEvent"),
    reference = fs.readFileSync("tests/fixtures/scoped_edit_reference.txt", "utf8");
  async function compile(contents) {
    const built = await esbuild.build({
      stdin: { contents: contents + '\nexport {WriterState} from "./state.js";', resolveDir: path.resolve("app/modules") },
      bundle: true,
      write: false,
      format: "cjs",
      plugins: [
        {
          name: "data",
          setup(build) {
            build.onResolve({ filter: /\/data\// }, (args) => ({ path: path.resolve("build/generated/modules/data", path.basename(args.path)) }));
          },
        },
      ],
    });
    return (document) => {
      const box = { exports: {} };
      new Function("document", "today", "module", "exports", built.outputFiles[0].text)(document, new Date("2026-10-28T12:00:00Z"), box, box.exports);
      return box.exports;
    };
  }
  const [current, legacy] = await Promise.all([compile(source), compile(source.slice(0, fn.start) + reference + source.slice(fn.end))]);
  const dom = new JSDOM(
    '<div id="r26-details"><details open></details></div><input data-special="reviewed" type="checkbox" checked><input data-special="noSafety" type="checkbox" checked>',
  );
  let seed = 20261101,
    checked = 0;
  const random = (n) => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return Math.floor((seed / 4294967296) * n);
    },
    pick = (values) => values[random(values.length)];
  function run(compose, input) {
    const document = dom.window.document;
    document.body.innerHTML =
      '<div id="r26-details"><details open></details></div><input data-special="reviewed" type="checkbox" checked><input data-special="noSafety" type="checkbox" checked>';
    const api = compose(document),
      state = api.WriterState,
      calls = [],
      d = structuredClone(input.d),
      r = { id: "visit", caseId: "case", actionGroup: "time", results: {} };
    Object.assign(state, {
      DOCS: input.missing ? [] : [d],
      REINSP: input.noVisit ? [] : [r],
      CASES: [
        {
          id: "case",
          address: "101 TEST ST",
          owner: "TEST OWNER",
          ownerAddr: ["101 TEST ST", "MADISON WI 53703"],
          inspectorId: "i4",
          date: "2026-01-01",
        },
      ],
      WORK: { currentAction: { group: "", type: "" }, recordForms: {} },
      state: { docId: d.id, reinspId: r.id },
    });
    const services = new Proxy(
      {},
      {
        get(_, key) {
          calls.push("get:" + key);
          return (...args) => {
            calls.push("call:" + key);
            if (key === "isLocked") return input.locked;
            if (key === "inspAt") return { date: "2026-01-01", time: "09:00" };
            if (key === "fmtDate") return args[0] || "";
          };
        },
      },
    );
    const owner = api.initNewDocuments(services);
    assert.deepEqual(calls, [], "inert construction");
    const el = document.createElement("input");
    Object.assign(el.dataset, input.dataset);
    el.value = input.value;
    el.type = input.checkbox ? "checkbox" : "text";
    el.checked = input.checked;
    document.body.append(el);
    let result, error;
    try {
      result = owner.editEvent({ target: el, type: input.event });
    } catch (e) {
      error = [e.name, e.message];
    }
    return {
      result,
      error,
      state: structuredClone(state),
      calls,
      html: document.body.innerHTML,
      reviewed: document.querySelector('[data-special="reviewed"]').checked,
      noSafety: document.querySelector('[data-special="noSafety"]').checked,
    };
  }
  const datasets = [
    { caseActionGroup: "time" },
    { caseActionType: "vacancyExtension" },
    { serviceField: "reference" },
    { actionGroup: "time" },
    { actionType: "vacancyExtension" },
    { special: "administrativeType" },
    { special: "reviewed" },
    { special: "deadlineMode" },
    { special: "variant" },
    { special: "scope" },
    { special: "reason" },
    { specialItem: "1" },
    { specialDue: "1" },
    {},
  ];
  for (let n = 0; n < 2000; n++) {
    const d = {
      id: "draft",
      caseId: "case",
      draft: !!random(2),
      type: pick(["notice", "bestInterestExtension", "vacancyExtension", "summaryAbatement", "noOccupancy"]),
      authoringVersion: pick([13, 14, 15, 16]),
      fromReinspId: random(2) ? "visit" : "",
      special: { originalDues: { 1: "2026-11-01" }, extendedDues: { 1: "2026-12-01" }, affected: ["1"], reviewed: true, noSafety: true },
      items: [{ id: "item", no: 1, due: "2026-11-01", sections: ["27.01"], title: "Repair", done: random(5) === 0, withdrawn: random(5) === 0 }],
    };
    if (random(4) === 0) d.selectionCache = { bestInterestExtension: { noSafety: true, reviewed: true } };
    const input = {
      d,
      dataset: { ...pick(datasets) },
      value: pick(["vacancyExtension", "bestInterestExtension", "dated", "tree", "2026-12-15", "Test reason"]),
      checkbox: !!random(2),
      checked: !!random(2),
      event: pick(["input", "change"]),
      missing: random(10) === 0,
      noVisit: random(10) === 0,
      locked: random(5) === 0,
    };
    if (random(4) === 0) Object.assign(input.dataset, pick(datasets));
    assert.deepEqual(run(current, input), run(legacy, input), "scenario " + checked++);
  }
  dom.window.close();
  console.log("PASS scoped edit equivalence " + checked + " scenarios: precedence, family caches, live state, DOM and service order");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
