/* Retained check routing protects message precedence, targets, lazy case/date reads and alias behavior. */
const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path"),
  acorn = require("acorn"),
  esbuild = require("esbuild"),
  { liftedSplice } = require("../fixtures/lifted_splice.cjs");
(async () => {
  let active;
  function effect(name, args = []) {
    active.calls.push([name, structuredClone(args)]);
    if (++active.steps === active.x.fail) throw Error("interrupted:" + name);
  }
  const field = {
    focus(...a) {
      effect("focus", a);
    },
    scrollIntoView(...a) {
      effect("scroll", a);
    },
    querySelector(selector) {
      effect("fieldQuery", [selector]);
      return active.x.focus === 2 ? field : null;
    },
  };
  const dom = {
    querySelector(selector) {
      effect("query", [selector]);
      if (selector === '[data-ri-walk-current="true"]') return active.x.focus ? field : null;
      return field;
    },
  };

  const source = fs.readFileSync("app/modules/reinspection.js", "utf8"),
    factory = acorn
      .parse(source, { ecmaVersion: 2022, sourceType: "module" })
      .body.find((n) => n.declaration?.id?.name === "createReinspection").declaration,
    reference = fs.readFileSync("tests/fixtures/reinspection_outcome_reference.txt", "utf8");
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
    new Function("today", "document", "module", "exports", b.outputFiles[0].text)(new Date("2026-10-29T12:00:00Z"), dom, box, box.exports);
    return box.exports;
  }
  const [current, legacy] = await Promise.all([
    compile(source),
    compile(liftedSplice(source, "reinspection", "recordReinspectionOutcome", reference)),
  ]);
  function run(api, input) {
    const x = structuredClone(input),
      calls = [];
    active = { x, calls, steps: 0 };
    const s = api.WriterState,
      r = x.r;
    Object.assign(s, {
      CASES: [{ id: "case", date: "2026-01-01" }],
      DOCS: [x.source],
      REINSP: [r],
      DIRTY: false,
      WORK: { walk: null },
      state: {
        screen: x.screen,
        reinspId: "visit",
        riWalk: x.walk,
        riWalkItem: "one",
        riWalkUndo: null,
        riWalkSkipped: ["two"],
        riWalkMode: x.mode,
        riWalkStage: "outcome",
        riWalkContext: null,
      },
    });
    const owner = api.createReinspection({
      ui: {
        render() {
          effect("render");
        },
        renderKeep() {
          effect("renderKeep");
        },
        toast(...a) {
          effect("toast", a);
        },
      },
      authoring: {
        scheduleDraftSave() {
          effect("save");
        },
      },
    });
    assert.deepEqual(calls, []);
    s.state.riWalkContext = x.stale ? "old" : owner.walkIdentity(r);
    let result, undo, error;
    try {
      result = owner.recordReinspectionOutcome(x.id, x.outcome);
      if (x.undo) undo = owner.undoWalkOutcome();
    } catch (e) {
      error = [e.name, e.message];
    }
    return { result, undo, error, calls, state: structuredClone(s) };
  }
  let seed = 20261130,
    checked = 0,
    accepted = 0;
  const random = (n) => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return Math.floor((seed / 4294967296) * n);
    },
    pick = (a) => a[random(a.length)];
  function fixture() {
    return {
      source: {
        id: "src",
        caseId: "case",
        items: [
          { id: "one", no: "1" },
          { id: "two", no: "2" },
        ],
      },
      r: {
        id: "visit",
        caseId: "case",
        sourceDocId: "src",
        draft: true,
        date: "2026-10-28",
        results: { one: { oc: "none", note: "Kept", due: "2026-11-10", cite: true }, two: {} },
      },
      screen: "reinspect",
      walk: true,
      mode: "quick",
      stale: false,
      id: "one",
      outcome: "corrected",
      fail: 0,
      focus: 0,
      undo: false,
    };
  }
  function compare(x) {
    const a = run(current, x),
      b = run(legacy, x);
    assert.deepEqual(a, b, "scenario " + checked++);
    if (a.result) accepted++;
  }
  for (const outcome of ["corrected", "progress", "noaccess", "none"])
    for (const mode of ["quick", "details"])
      for (const walk of [true, false])
        for (const undo of [true, false]) {
          const x = fixture();
          Object.assign(x, { outcome, mode, walk, undo });
          compare(x);
        }
  for (let n = 0; n < 4000; n++) {
    const x = fixture();
    Object.assign(x, {
      walk: !!random(2),
      mode: pick(["quick", "details"]),
      stale: random(8) === 0,
      id: pick(["one", "two", "one", "missing"]),
      outcome: pick(["corrected", "progress", "noaccess", "none", "unsupported"]),
      fail: random(10),
      focus: random(3),
      undo: random(3) === 0,
    });
    x.r.draft = random(10) !== 0;
    if (random(9) === 0) x.r.docId = "issued";
    if (random(12) === 0) x.screen = "write";
    if (random(10) === 0) x.source.items[0].withdrawn = true;
    x.r.results.one = {
      oc: pick(["none", "progress", "corrected", null]),
      on: pick(["", "2026-10-25", null]),
      manualDate: pick([true, false, null]),
      due: pick(["", "2026-11-10", null]),
      note: pick(["", "Retained note", null]),
      cite: pick([true, false, null]),
      carried: random(9) === 0,
    };
    compare(x);
  }
  assert.ok(accepted > 400, "exercise accepted outcomes beyond refusal");
  console.log(
    "PASS reinspection outcome equivalence " +
      checked +
      " scenarios: result/undo state, lazy live records, saves, walk/focus order and interruptions",
  );
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
