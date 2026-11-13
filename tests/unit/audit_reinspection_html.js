/* Worksheet behavior across every seeded state: readonly controls, result binding, filters, walk and retained work. */
const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path"),
  esbuild = require("esbuild"),
  { JSDOM } = require("jsdom"),
  fc = require("fast-check");
(async () => {
  const dir = path.resolve("app/modules");
  let source = fs.readFileSync(path.join(dir, "reinspection.js"), "utf8");
  source +=
    '\nexport {WriterState} from "./state.js";export {validISO,parseTime} from "./calendar.js";export {INSPECTORS} from "./data/inspectors.js";';
  const compiled = await esbuild.build({
    stdin: { contents: source, resolveDir: dir },
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
  new Function("today", "module", "exports", compiled.outputFiles[0].text)(new Date("2026-10-27T12:00:00Z"), box, box.exports);
  const { createReinspection, WriterState: s, validISO, parseTime, INSPECTORS } = box.exports;
  let flags = {},
    calls = [];
  const methods = {
    screenCases: () => "<h1>Cases</h1>",
    fmtDate: (v) => String(v || ""),
    validISO,
    parseTime,
    MINDUE: () => "2026-10-28",
    inspAt: () => ({ date: "2026-10-20", time: "09:00" }),
    dueContext: (r) => s.DOCS[0].items.map((i) => ({ ...i, due: r.results[i.id]?.due || i.due })),
    dueDateSpacingConflicts: () => [],
    worksheetFaults: () => (flags.extra ? ["Additional <&> check"] : []),
    duePanel: () => "<p>Due panel</p>",
    newDocuments: { chooser: () => "<p>Permitted documents</p>" },
    shell: (title, crumb, actions, body) => body,
  };
  const historicalServices = new Proxy(methods, {
    get(target, key) {
      calls.push(key);
      assert.ok(key in target, "known worksheet adapter: " + String(key));
      return target[key];
    },
  });
  const api = createReinspection({ ui: historicalServices, inspection: historicalServices, authoring: historicalServices });
  function reset() {
    const kase = { id: "c", address: "100 TEST <&> ST", number: "CB2026-100-00001", date: "2026-10-20" };
    const items = flags.items.map((spec, i) => ({
      id: "i" + i,
      no: String(i + 1),
      title: "Wall <&>",
      text: "Repair <&> ◯",
      sections: ["27.05(2)(c)"],
      due: "2026-10-01",
      done: spec.carried && spec.oc === "corrected",
      withdrawn: spec.carried && spec.oc === "withdrawn",
    }));
    const src = {
      id: "src",
      caseId: "c",
      type: flags.referred ? "referral" : "notice",
      draft: false,
      items,
      mailed: "2026-10-20",
      frozen: { case: kase },
    };
    const r = {
      id: "r",
      caseId: "c",
      sourceDocId: flags.missingSource ? "missing" : "src",
      draft: !flags.readOnly,
      date: "2026-10-26",
      time: "10:00",
      inspectorId: INSPECTORS[0].id,
      followupIntent: flags.intent,
      importRule: flags.imported ? { cite: true, status: "Citation", label: "Citation" } : null,
      previousDraft: flags.previous ? { id: "previous" } : null,
      docId: flags.closed ? "followup" : null,
      results: Object.fromEntries(
        flags.items.map((spec, i) => [
          "i" + i,
          { oc: spec.oc, on: spec.date, due: spec.due, note: "Observation <&>", cite: spec.cite, carried: spec.carried },
        ]),
      ),
    };
    Object.assign(s, {
      CASES: [kase],
      DOCS: [src, ...(flags.closed ? [{ id: "followup", caseId: "c", type: "extension", draft: flags.draft, items, mailed: "2026-10-27" }] : [])],
      REINSP: [r],
      EVENTS: {},
      WORK: { walk: null },
      state: {
        screen: "reinspect",
        reinspId: flags.missing ? "missing" : "r",
        riFilter: flags.filter,
        riWalk: flags.walk,
        riWalkItem: flags.items.length ? "i0" : null,
        riWalkMode: flags.mode,
        riWalkStage: flags.stage,
        riWalkSkipped: flags.skipped ? ["i0"] : [],
        riWalkUndo: flags.undo ? { itemId: "i0" } : null,
      },
    });
  }
  let checked = 0;
  function run(fn) {
    reset();
    calls = [];
    const initialState = JSON.stringify(s);
    try {
      return { html: fn(), initialState, state: JSON.stringify(s), calls: calls.slice() };
    } catch (error) {
      return { error: { name: error.name, message: error.message }, initialState, state: JSON.stringify(s), calls: calls.slice() };
    }
  }
  const dom = new JSDOM(""),
    template = dom.window.document.createElement("template");
  let readonlySample;
  function validateWorksheet(html, options) {
    if (options.missing || options.missingSource) {
      assert.equal(html, "<h1>Cases</h1>");
      return;
    }
    template.innerHTML = html;
    const view = template.content,
      readonly = options.closed || options.readOnly;
    assert.equal(view.querySelectorAll("script,iframe,object").length, 0);
    for (const id of ["ri-date", "ri-time", "ri-insp"]) assert.equal(view.getElementById(id).disabled, readonly, id);
    const shown = options.items
      .map((item, ix) => ({ item, ix }))
      .filter(({ item }) =>
        options.filter === "corrected"
          ? item.oc === "corrected"
          : options.filter === "open"
            ? item.oc && !["corrected", "withdrawn"].includes(item.oc)
            : options.filter === "todo"
              ? !item.oc
              : true,
      );
    const rows = [...view.querySelectorAll("[data-ri-item]")];
    assert.deepEqual(
      rows.map((row) => row.dataset.riItem),
      shown.map(({ ix }) => "i" + ix),
      "filtering keeps original item IDs/order",
    );
    rows.forEach((row, n) => {
      const { item, ix } = shown[n],
        locked = readonly || item.carried;
      assert.equal(row.querySelector(".ri-no").textContent, String(ix + 1) + ".", "issued numbering remains");
      assert.equal(row.querySelector(".ri-ttl").textContent, "Wall <&>");
      assert.match(row.querySelector(".ri-body").textContent, /Repair <&>/);
      assert.equal(row.dataset.oc, item.oc);
      assert.equal(row.hidden, !!(!readonly && options.walk && options.items.length && ix !== 0));
      const actions = [...row.querySelectorAll("[data-setoc]")];
      assert.deepEqual(
        actions.map((el) => el.dataset.setoc),
        ["corrected", "progress", "none", "noaccess"],
      );
      actions.forEach((el) => {
        assert.equal(el.dataset.item, "i" + ix);
        assert.equal(el.disabled, locked, "recorded/carried outcomes are read-only");
        assert.equal(el.getAttribute("aria-pressed"), String(item.oc === el.dataset.setoc));
      });
      const date = row.querySelector("[data-ridate]"),
        note = row.querySelector("[data-rinote]");
      assert.equal(!!date, !!item.oc);
      assert.equal(!!note, !!item.oc);
      if (item.oc) {
        assert.equal(date.getAttribute("value"), item.date || "2026-10-26");
        assert.equal(date.disabled, locked);
        assert.equal(note.disabled, locked);
        assert.equal(note.value, "Observation <&>");
      }
      const open = !!item.oc && !["corrected", "withdrawn"].includes(item.oc);
      const due = row.querySelector("[data-ridue]");
      assert.equal(!!due, open && ["undecided", "extension", "bestInterestExtension", "citation"].includes(options.intent));
      if (due) {
        assert.equal(due.getAttribute("value"), item.due);
        assert.equal(due.disabled, locked);
        const hint = due.closest("label").querySelector(".hint").textContent;
        if (!item.due) assert.match(hint, /Needs a new due date/);
        else if (["2026-10-27", "2026-10-29"].includes(item.due)) assert.match(hint, /unusually short/);
        else if (item.due === "2027-12-01") assert.match(hint, /unusually long/);
        else assert.match(hint, /20 days/);
      }
      const cite = row.querySelector("[data-ricite]");
      assert.equal(!!cite, open && (options.imported || item.cite));
      if (cite) {
        assert.equal(cite.checked, item.cite);
        assert.equal(cite.disabled, locked);
      }
    });
    const left = options.items.filter((item) => !item.oc).length;
    const active = options.items.filter((item) => !(item.carried && item.oc === "withdrawn")).length;
    const progress = view.querySelector("progress");
    assert.equal(Number(progress.getAttribute("value")), active - left);
    assert.equal(Number(progress.getAttribute("max")), active || 1);
    const batch = [...view.querySelectorAll("[data-ri-batch]")];
    assert.deepEqual(
      batch.map((el) => el.dataset.riBatch),
      !options.closed && left && !options.walk ? ["corrected", "none"] : [],
    );
    assert.equal(!!view.querySelector("#btn-previousdraft"), options.previous);
    assert.equal(!!view.querySelector('[data-open="followup"]'), options.closed);
    assert.equal(view.textContent.includes("Permitted documents"), !options.closed);
    for (const control of view.querySelectorAll("[data-rifilter]")) assert.equal(control.disabled, options.walk);
    assert.equal(!!view.querySelector(".ri-checks"), !readonly);
    assert.ok(view.querySelector("#btn-risave"));
  }
  function compare(options) {
    flags = options;
    const actual = run(api.screenReinspect);
    assert.deepEqual(actual, run(api.screenReinspect), "deterministic live adapters and fields");
    assert.equal(typeof actual.html, "string", "each worksheet renders successfully");
    const expected = JSON.parse(actual.initialState);
    if (flags.missing || flags.missingSource) expected.state.screen = "cases";
    assert.deepEqual(JSON.parse(actual.state), expected, "only a missing-record redirect may change state");
    if (flags.missing || flags.missingSource) assert.deepEqual(actual.calls, ["screenCases"]);
    else {
      assert.equal(actual.calls.filter((name) => name === "shell").length, 1);
      assert.ok(!actual.calls.includes("screenCases"));
    }
    validateWorksheet(actual.html, options);
    if (!readonlySample && !flags.missing && !flags.missingSource && (flags.closed || flags.readOnly) && flags.items.length && !flags.filter)
      readonlySample = { html: actual.html, options: structuredClone(options) };
    checked++;
  }
  const baseItem = { oc: "none", date: "2026-10-26", due: "2026-11-15", cite: false, carried: false },
    defaults = {
      items: [baseItem],
      closed: false,
      readOnly: false,
      referred: false,
      imported: false,
      previous: false,
      draft: false,
      missing: false,
      filter: "",
      walk: false,
      mode: "quick",
      stage: "outcome",
      skipped: false,
      undo: false,
      extra: false,
      intent: "extension",
    };
  for (const filter of ["", "open", "corrected", "todo"])
    for (const oc of ["", "none", "corrected", "progress", "noaccess", "withdrawn"]) compare({ ...defaults, filter, items: [{ ...baseItem, oc }] });
  compare({ ...defaults, missing: true });
  compare({ ...defaults, missingSource: true });
  const item = fc.record({
    oc: fc.constantFrom("", "none", "corrected", "progress", "noaccess", "withdrawn"),
    date: fc.constantFrom("", "2026-10-26", "bad"),
    due: fc.constantFrom("", "2026-10-27", "2026-10-29", "2026-11-15", "2027-12-01"),
    cite: fc.boolean(),
    carried: fc.boolean(),
  });
  fc.assert(
    fc.property(
      fc.record({
        items: fc.array(item, { maxLength: 4 }),
        closed: fc.boolean(),
        readOnly: fc.boolean(),
        referred: fc.boolean(),
        imported: fc.boolean(),
        previous: fc.boolean(),
        draft: fc.boolean(),
        missing: fc.boolean(),
        filter: fc.constantFrom("", "open", "corrected", "todo"),
        walk: fc.boolean(),
        mode: fc.constantFrom("quick", "details"),
        stage: fc.constantFrom("outcome", "details"),
        skipped: fc.boolean(),
        undo: fc.boolean(),
        extra: fc.boolean(),
        intent: fc.constantFrom("undecided", "extension", "bestInterestExtension", "vacancyExtension", "citation", "referral", "compliance"),
      }),
      compare,
    ),
    { seed: 20261027, numRuns: 1000 },
  );
  assert.ok(readonlySample);
  const mutated = dom.window.document.createElement("div");
  mutated.innerHTML = readonlySample.html;
  mutated.querySelector("[data-setoc]").disabled = false;
  assert.throws(
    () => validateWorksheet(mutated.innerHTML, readonlySample.options),
    assert.AssertionError,
    "a mutation that unlocks a retained result fails the contract",
  );
  dom.window.close();
  console.log("PASS reinspection behavior contracts", checked, "outcome/walk/filter/retained/closed states");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
