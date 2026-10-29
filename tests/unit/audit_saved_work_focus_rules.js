/* Retained check routing protects message precedence, targets, lazy case/date reads and alias behavior. */
const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path"),
  acorn = require("acorn"),
  esbuild = require("esbuild");
(async () => {
  const { JSDOM } = require("jsdom"),
    page = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://127.0.0.1:8777/" });
  let active;
  function effect(name, args = []) {
    active.calls.push([name, structuredClone(args)]);
    if (++active.steps === active.x.fail) throw Error("interrupted:" + name);
  }
  const dom = {
    querySelector(selector) {
      effect("documentQuery", [selector]);
      return page.window.document.querySelector(selector);
    },
    getElementById(id) {
      effect("documentID", [id]);
      return page.window.document.getElementById(id);
    },
    get activeElement() {
      effect("activeElement");
      return page.window.document.activeElement;
    },
  };

  const source = fs.readFileSync("app/modules/language_catalog.js", "utf8"),
    factory = acorn
      .parse(source, { ecmaVersion: 2022, sourceType: "module" })
      .body.find((n) => n.declaration?.id?.name === "createLanguageCatalog").declaration,
    fn = factory.body.body.find((n) => n.id?.name === "showSafety"),
    reference = fs.readFileSync("tests/fixtures/safety_focus_reference.txt", "utf8");
  async function compile(contents) {
    const b = await esbuild.build({
      stdin: {
        contents: contents + '\nexport {WriterState} from "./state.js";export {esc} from "./presentation_format.js";',
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
  const [current, legacy] = await Promise.all([compile(source), compile(source.slice(0, fn.start) + reference + source.slice(fn.end))]);
  async function run(api, input) {
    const x = structuredClone(input),
      calls = [],
      s = api.WriterState;
    for (const key of Object.keys(s)) delete s[key];
    Object.assign(s, { state: { modal: x.modal, screen: "tools" }, SAFETY_HEALTH: { before: true } });
    active = { x, calls, steps: 0 };
    let reads = 0,
      release,
      reject;
    page.window.document.body.innerHTML = '<button id="outside">Outside</button>';
    const context = {
      esc: api.esc,
      CASES: [],
      CASEDIR: null,
      NEEDGRANT: false,
      PENDING: [],
      LOCAL_SAVE: { ok: !x.localBad, saving: false, at: "" },
      draftTimer: null,
      CATALOG_AT: "checked",
      recoveryStatusHTML() {
        effect("recoveryStatus");
        if (reads > 1 && x.disappear) return "";
        return (
          '<button id="identified">Identified</button><button data-safety-case="case1" data-action="' +
          (reads > 1 ? "changed" : "old") +
          '">Case</button><button data-custom="same" data-variant="' +
          (reads > 1 && x.changedDataset ? "new" : "old") +
          '">Dataset</button><button>Plain</button><input data-unidentified="1">'
        );
      },
    };
    const owner = api.createLanguageCatalog({
      navigation: {
        utilityContext() {
          effect("utilityContext");
          return { token: 1 };
        },
        utilityCurrent(value) {
          effect("utilityCurrent", [value]);
          return !x.stale;
        },
      },
      captureWork() {
        effect("capture");
      },
      render() {
        effect("render");
      },
      app_savedworkContext() {
        effect("context");
        reads++;
        return context;
      },
      A11Y: {
        utility(title, markup) {
          effect("utility", [title]);
          page.window.document.body.insertAdjacentHTML(
            "beforeend",
            '<div id="utility-dialog"><button id="close" data-utility-close>Close</button>' + markup + "</div>",
          );
        },
      },
      helperJSON(url) {
        effect("helperJSON", [url]);
        return new Promise((a, b) => {
          release = a;
          reject = b;
        });
      },
    });
    assert.deepEqual(calls, []);
    const pending = owner.showSafety();
    const dialog = page.window.document.getElementById("utility-dialog");
    if (dialog) {
      for (const details of dialog.querySelectorAll("details[data-saved-detail]")) details.open = x.open;
      const selector = {
        summary: '[data-saved-detail="pdf"]>summary',
        id: "#identified",
        case: "[data-safety-case]",
        dataset: "[data-custom]",
        plain: "#saved-recovery-status button:not([id]):not([data-safety-case]):not([data-custom])",
        input: "[data-unidentified]",
        outside: "#outside",
        body: "body",
      }[x.focus];
      page.window.document.querySelector(selector)?.focus();
      if (x.close) dialog.remove();
    }
    if (release) {
      if (x.helperError) reject(Error("offline"));
      else release({ ok: true, outbox: 2 });
    }
    let result, error;
    try {
      result = await pending;
    } catch (e) {
      error = [e.name, e.message];
    }
    const focused = page.window.document.activeElement;
    return {
      result,
      error,
      calls,
      state: structuredClone(s),
      html: page.window.document.body.innerHTML,
      focus: {
        id: focused?.id,
        tag: focused?.tagName,
        data: { ...focused?.dataset },
        summary: focused?.matches("summary") ? focused.parentElement.dataset.savedDetail : "",
      },
    };
  }
  let seed = 20261203,
    count = 0;
  const random = (n) => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return Math.floor((seed / 4294967296) * n);
    },
    pick = (a) => a[random(a.length)];
  const focuses = ["summary", "id", "case", "dataset", "plain", "input", "outside", "body"];
  function fixture() {
    return {
      focus: "summary",
      open: true,
      modal: null,
      localBad: false,
      stale: false,
      close: false,
      helperError: false,
      disappear: false,
      changedDataset: false,
      fail: 0,
    };
  }
  async function compare(x) {
    const a = await run(current, x),
      b = await run(legacy, x);
    assert.deepEqual(a, b, "scenario " + count++);
    if (!x.fail && !x.stale && !x.close) {
      assert.equal(a.state.SAFETY_HEALTH.before, undefined);
      if (x.focus === "summary") assert.equal(a.focus.summary, "pdf");
      if (x.focus === "outside") assert.equal(a.focus.id, "outside");
    }
  }
  for (const focus of focuses)
    for (const open of [true, false])
      for (const helperError of [true, false])
        for (const disappear of [true, false]) {
          const x = fixture();
          Object.assign(x, { focus, open, helperError, disappear });
          await compare(x);
        }
  for (let i = 0; i < 300; i++) {
    const x = fixture();
    Object.assign(x, {
      focus: pick(focuses),
      open: !!random(2),
      modal: pick([null, "cc"]),
      localBad: !!random(2),
      stale: random(5) === 0,
      close: random(6) === 0,
      helperError: !!random(2),
      disappear: !!random(2),
      changedDataset: !!random(2),
      fail: random(13),
    });
    await compare(x);
  }
  page.window.close();
  console.log(
    "PASS saved-work focus equivalence " +
      count +
      " asynchronous cases: summaries, identifiers, data buttons, close fallback, disclosures, stale contexts and failures",
  );
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
