/* Keyboard ownership, registration and context mutation timing against retained dispatch. */
const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path"),
  acorn = require("acorn"),
  esbuild = require("esbuild");
(async () => {
  const source = fs.readFileSync("app/modules/reinspection_events.js", "utf8"),
    factory = acorn
      .parse(source, { ecmaVersion: 2022, sourceType: "module" })
      .body.find((n) => n.declaration?.id?.name === "createReinspectionEvents").declaration,
    fn = factory.body.body.find((n) => n.id?.name === "registerWalkKeys"),
    reference = fs.readFileSync("tests/fixtures/walk_shortcuts_reference.txt", "utf8");
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
  let seed = 20261107,
    checked = 0;
  const random = (n) => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return Math.floor((seed / 4294967296) * n);
    },
    pick = (a) => a[random(a.length)];
  function fixture() {
    return {
      screen: "reinspect",
      walk: true,
      item: "one",
      undo: null,
      key: "1",
      tag: "DIV",
      editable: false,
      within: false,
      undoButton: false,
      context: true,
      mutate: false,
      defaultPrevented: false,
      repeat: false,
      altKey: false,
      ctrlKey: false,
      metaKey: false,
    };
  }
  function run(api, input) {
    const flags = structuredClone(input),
      calls = [],
      s = api.WriterState;
    s.state = { screen: flags.screen, riWalk: flags.walk, riWalkItem: flags.item, riWalkUndo: flags.undo };
    const services = new Proxy(
      {},
      {
        get(_, key) {
          calls.push("get:" + String(key));
          return (...args) => {
            calls.push(["call:" + String(key), ...args]);
            if (key === "ensureWalkContext") {
              if (flags.mutate) {
                s.state.riWalkItem = "replacement";
                s.state.screen = "cases";
                s.state.riWalk = false;
              }
              return flags.context;
            }
            if (key === "recordReinspectionOutcome") s.state.recorded = args;
            if (key === "undoWalkOutcome") s.state.riWalkUndo = null;
          };
        },
      },
    );
    const owner = api.createReinspectionEvents(services);
    assert.deepEqual(calls, [], "inert construction");
    const listeners = [],
      target = { addEventListener: (...args) => listeners.push(args) };
    const registered = owner.registerWalkKeys(target),
      duplicate = owner.registerWalkKeys(target);
    assert.equal(listeners.length, 1);
    assert.equal(listeners[0][0], "keydown");
    const event = {
      key: flags.key,
      defaultPrevented: flags.defaultPrevented,
      repeat: flags.repeat,
      altKey: flags.altKey,
      ctrlKey: flags.ctrlKey,
      metaKey: flags.metaKey,
      target: flags.tag
        ? {
            tagName: flags.tag,
            isContentEditable: flags.editable,
            closest(selector) {
              calls.push("closest:" + selector);
              return selector === "[data-ri-walk-current]" ? flags.within : flags.undoButton;
            },
          }
        : null,
      preventDefault() {
        calls.push("preventDefault");
        this.defaultPrevented = true;
      },
    };
    let value, error;
    try {
      value = listeners[0][1](event);
    } catch (e) {
      error = [e.name, e.message];
    }
    return { value, error, registered, duplicate, calls, state: structuredClone(s), prevented: event.defaultPrevented };
  }
  function compare(x) {
    assert.deepEqual(run(current, x), run(legacy, x), "scenario " + checked++);
  }
  const initial = run(current, fixture());
  assert.equal(initial.prevented, true);
  assert.deepEqual(initial.state.state.recorded, ["one", "corrected"]);
  compare(fixture());
  for (const key of ["1", "2", "3", "4", "u", "U", "Enter"])
    for (const tag of ["DIV", "BUTTON", "A", "INPUT", null])
      for (const within of [false, true])
        for (const undoButton of [false, true])
          for (const undo of [null, { id: "undo" }])
            for (const mutate of [false, true]) compare({ ...fixture(), key, tag, within, undoButton, undo, mutate });
  for (let n = 0; n < 4000; n++) {
    const x = fixture();
    x.screen = pick(["reinspect", "write", "cases"]);
    x.key = pick(["1", "2", "3", "4", "u", "U", "Enter", null]);
    x.tag = pick([null, "DIV", "INPUT", "SELECT", "TEXTAREA", "BUTTON", "A"]);
    x.item = pick([null, "one"]);
    x.undo = random(2) ? { id: "undo" } : null;
    for (const k of ["walk", "editable", "within", "undoButton", "context", "mutate", "defaultPrevented", "repeat", "altKey", "ctrlKey", "metaKey"])
      x[k] = !!random(2);
    compare(x);
  }
  console.log("PASS walkthrough keyboard equivalence " + checked + " scenarios: registration, ownership, context changes and effect order");
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
