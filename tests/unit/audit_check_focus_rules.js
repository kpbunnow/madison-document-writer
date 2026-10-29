/* Retained check routing protects message precedence, targets, lazy case/date reads and alias behavior. */
const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path"),
  acorn = require("acorn"),
  esbuild = require("esbuild"),
  { liftedSplice } = require("../fixtures/lifted_splice.cjs");
(async () => {
  const { JSDOM } = require("jsdom"),
    page = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://127.0.0.1:8777/" });
  let active;
  function effect(name, args = []) {
    active.calls.push([name, structuredClone(args)]);
    if (++active.steps === active.x.fail) throw Error("interrupted:" + name);
  }
  page.window.HTMLElement.prototype.scrollIntoView = function (options) {
    effect("scroll", [this.id, options]);
  };
  const dom = {
    querySelector(selector) {
      effect("query", [selector]);
      active.last = page.window.document.querySelector(selector);
      return active.last;
    },
  };
  function later(callback, delay) {
    effect("timer", [delay]);
    active.timers.push(callback);
  }

  const source = fs.readFileSync("app/modules/reinspection.js", "utf8"),
    factory = acorn
      .parse(source, { ecmaVersion: 2022, sourceType: "module" })
      .body.find((n) => n.declaration?.id?.name === "createReinspection").declaration,
    reference = fs.readFileSync("tests/fixtures/check_focus_reference.txt", "utf8");
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
    new Function("today", "document", "setTimeout", "module", "exports", b.outputFiles[0].text)(
      new Date("2026-10-29T12:00:00Z"),
      dom,
      later,
      box,
      box.exports,
    );
    return box.exports;
  }
  const [current, legacy] = await Promise.all([compile(source), compile(liftedSplice(source, "reinspection", "focusCheckTarget", reference))]);
  function run(api, input) {
    const x = structuredClone(input),
      calls = [],
      s = api.WriterState;
    active = { x, calls, steps: 0, timers: [], last: null };
    page.window.document.body.innerHTML =
      '<details id="outer"><summary>Group</summary><details id="inner"><summary>Fields</summary><input id="field"><input id="owner" data-case="ownerBlock"><input id="agent" data-agent="name"><input id="copy" data-cc="1|name"></details></details>';
    if (x.tabindex !== null) page.window.document.getElementById("field").setAttribute("tabindex", x.tabindex);
    Object.assign(s, {
      CASES: [x.k],
      DOCS: [x.d, { ...x.d, id: "other", items: [{ id: "one", libraryKey: "Changed catalog key" }] }],
      REINSP: [{ id: "visit", caseId: "case" }],
      WORK: { walk: { kept: true } },
      state: {
        screen: x.screen,
        docId: x.missing ? "absent" : "draft",
        reinspId: "visit",
        modal: "before",
        picker: true,
        riFilter: "old",
        riWalk: true,
        riWalkItem: "one",
        riWalkSkipped: ["one"],
        riWalkUndo: { kept: true },
        catalogAdminKey: "before",
      },
    });
    const services = {
      inspection: {
        captureWork() {
          effect("capture");
          if (x.switchDoc) s.state.docId = "other";
        },
        returnToWorksheet(...args) {
          effect("worksheet", args);
          return false;
        },
      },
      ui: {
        goCase(...args) {
          effect("goCase", args);
          s.state.screen = "cases";
        },
        render() {
          effect("render");
          if (x.clear) page.window.document.body.innerHTML = "";
        },
        toast(...args) {
          effect("toast", args);
        },
      },
      authoring: {
        validateAndStandardizeAddresses(...args) {
          effect("validate", args);
          return x.problem;
        },
      },
    };
    const owner = api.createReinspection(services);
    assert.deepEqual(calls, []);
    let error;
    try {
      owner.focusCheckTarget(x.target, "Check retained record");
    } catch (e) {
      error = [e.name, e.message];
    }
    const before = page.window.document.body.innerHTML,
      focus = page.window.document.activeElement?.id,
      last = active.last?.outerHTML;
    if (x.detach) active.last?.remove();
    for (const timer of active.timers) timer();
    return {
      state: structuredClone(s),
      calls,
      error,
      before,
      focus,
      last,
      after: page.window.document.body.innerHTML,
      expired: active.last?.outerHTML,
    };
  }
  let seed = 20261201,
    count = 0;
  const random = (n) => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return Math.floor((seed / 4294967296) * n);
    },
    pick = (a) => a[random(a.length)];
  function fixture() {
    return {
      k: { id: "case", number: "CB2026-100-00001", owner: "Owner LLC" },
      d: { id: "draft", caseId: "case", type: "citation", items: [{ id: "one", libraryKey: "Original key" }] },
      target: { action: "contacts", selector: "#field", itemId: "one" },
      screen: "write",
      missing: false,
      switchDoc: false,
      problem: null,
      clear: false,
      detach: false,
      tabindex: null,
      fail: 0,
    };
  }
  const actions = ["workspace", "catalog", "recipient:agent:0:name", "recipient:copy:1:name", "visit", "contacts", "guidance", "", undefined, 17];
  function compare(x) {
    assert.deepEqual(run(current, x), run(legacy, x), "scenario " + count++);
  }
  for (const action of actions)
    for (const screen of ["write", "reinspect"])
      for (const fail of [0, 1, 2, 3, 4]) {
        const x = fixture();
        x.target.action = action;
        x.screen = screen;
        x.fail = fail;
        compare(x);
      }
  for (let i = 0; i < 600; i++) {
    const x = fixture();
    x.target.action = pick(actions);
    x.target.selector = pick(["#field", "#owner", "#absent", "["]);
    x.target.itemId = pick(["one", "missing"]);
    x.screen = pick(["write", "reinspect"]);
    x.missing = random(5) === 0;
    x.switchDoc = !!random(2);
    x.problem = pick([null, { selector: "#agent" }, { selector: "#copy" }]);
    x.clear = random(6) === 0;
    x.detach = !!random(2);
    x.tabindex = pick([null, "-1", "0"]);
    x.fail = random(10);
    if (random(2)) x.d.correction = { case: { ...x.k, owner: "Correction Owner" } };
    compare(x);
  }
  page.window.close();
  console.log(
    "PASS check focus equivalence " +
      count +
      " scenarios: workspace/catalog/recipient routing, live context, DOM focus/disclosures, timer cleanup and interruptions",
  );
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
