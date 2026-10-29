/* Native DOM parity protects label/table/landmark enhancement, refusal and repeated dialog state. */
const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path"),
  acorn = require("acorn"),
  esbuild = require("esbuild"),
  { JSDOM } = require("jsdom");
(async () => {
  const source = fs.readFileSync("app/modules/accessibility.js", "utf8"),
    tree = acorn.parse(source, { ecmaVersion: 2022, sourceType: "module" }),
    factory = tree.body.find((n) => n.declaration?.id?.name === "createAccessibility").declaration,
    fn = factory.body.body.find((n) => n.id?.name === "enhance"),
    prior = source.slice(0, fn.start) + fs.readFileSync("tests/fixtures/accessibility_enhance_reference.txt", "utf8") + source.slice(fn.end);
  async function compile(contents) {
    const built = await esbuild.build({ stdin: { contents, resolveDir: path.resolve("app/modules") }, bundle: true, write: false, format: "cjs" });
    return built.outputFiles[0].text;
  }
  const [current, legacy] = await Promise.all([compile(source), compile(prior)]);
  class Clock extends Date {
    constructor(...a) {
      super(...(a.length ? a : ["2026-10-29T12:00:00Z"]));
    }
    static now() {
      return 1793275200000;
    }
  }
  function run(code, x) {
    const page = new JSDOM(
      '<!doctype html><html><body><div id="app"><aside class="rail"><nav class="' +
        (x.writer ? "writer-navigation" : "") +
        '"><button>Workspace</button></nav></aside><div class="main"><h1>Case heading</h1><strong aria-readonly="true">Case</strong><div contenteditable data-case="ownerBlock">Owner</div><div contenteditable data-field="text">Text</div><div contenteditable data-cit="one|comment">Comment</div><input id="unlabelled" placeholder="Search_case"><input id="already" aria-label="Keep this"><input type="hidden"><label><input>Wrapped label</label><label for="labelled">Named</label><input id="labelled"><select data-doc="kind"><option>Choice</option></select><div class="panel"><h2>Records &amp; facts</h2><table>' +
        (x.caption ? "<caption>Existing caption</caption>" : "") +
        '<thead><tr><th>Field</th></tr></thead><tbody><tr><th>Name</th><td>Value</td></tr></tbody></table></div><table><tbody><tr><td>Other</td></tr></tbody></table></div></div><div id="overlay"><input data-field="extra_value">' +
        (x.dialog ? '<div role="dialog"><input id="dialog-field"></div>' : "") +
        "</div></body></html>",
      { url: "http://127.0.0.1:8777/", pretendToBeVisual: true },
    );
    page.window.MutationObserver = undefined;
    page.window.localStorage.setItem("madison-theme-v1", x.theme);
    if (x.badHistory) page.window.localStorage.setItem("madison-message-history-v1", "invalid");
    const document = page.window.document,
      calls = [],
      timers = new Map();
    let tracking = false,
      steps = 0,
      sequence = 0;
    const proxy = new Proxy(document, {
      get(target, key) {
        const value = Reflect.get(target, key, target);
        if (typeof value !== "function") return value;
        return (...args) => {
          if (tracking && ["querySelector", "querySelectorAll", "getElementById", "createElement"].includes(key)) {
            calls.push([key, args.map((a) => (typeof a === "string" ? a : typeof a))]);
            if (++steps === x.fail) throw Error("interrupted:" + key);
          }
          return Reflect.apply(value, target, args);
        };
      },
    });
    const box = { exports: {} };
    new Function("document", "window", "localStorage", "Date", "setTimeout", "clearTimeout", "module", "exports", code)(
      proxy,
      page.window,
      page.window.localStorage,
      Clock,
      (fn, ms) => {
        timers.set(++sequence, { fn, ms });
        return sequence;
      },
      (id) => timers.delete(id),
      box,
      box.exports,
    );
    const owner = box.exports.createAccessibility();
    if (x.missingBody) Object.defineProperty(document, "body", { value: null, configurable: true });
    else if (x.missingPrepend) document.body.prepend = undefined;
    if (x.invalidId) document.getElementById("unlabelled").id = 'bad"]';
    tracking = true;
    let error;
    try {
      owner.enhance(x.repaint);
      if (x.repeat) {
        document.querySelector('#overlay [role="dialog"]')?.remove();
        owner.enhance(x.repaint);
      }
    } catch (e) {
      error = [e.name, e.message];
    }
    const result = {
      error,
      calls,
      html: document.documentElement.outerHTML,
      focused: document.activeElement?.id,
      timers: [...timers.values()].map((t) => t.ms),
      theme: page.window.localStorage.getItem("madison-theme-v1"),
    };
    tracking = false;
    page.window.close();
    return result;
  }
  let seed = 20261205,
    count = 0;
  const random = (n) => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return Math.floor((seed / 4294967296) * n);
    },
    pick = (a) => a[random(a.length)];
  function fixture() {
    return {
      writer: false,
      caption: false,
      dialog: false,
      theme: "system",
      badHistory: false,
      missingBody: false,
      missingPrepend: false,
      invalidId: false,
      repaint: false,
      repeat: false,
      fail: 0,
    };
  }
  function compare(x) {
    assert.deepEqual(run(current, x), run(legacy, x), "scenario " + count++);
  }
  for (const writer of [true, false])
    for (const caption of [true, false])
      for (const dialog of [true, false])
        for (const repaint of [true, false]) for (const repeat of [true, false]) compare({ ...fixture(), writer, caption, dialog, repaint, repeat });
  for (let n = 0; n < 140; n++) {
    const x = fixture();
    Object.assign(x, {
      writer: !!random(2),
      caption: !!random(2),
      dialog: !!random(2),
      theme: pick(["system", "light", "dark", "high", "invalid"]),
      badHistory: random(6) === 0,
      missingBody: random(30) === 0,
      missingPrepend: random(15) === 0,
      invalidId: random(6) === 0,
      repaint: !!random(2),
      repeat: !!random(2),
      fail: random(3) ? 0 : random(35) + 1,
    });
    compare(x);
  }
  console.log(
    "PASS accessibility enhancement equivalence " +
      count +
      " DOMs: exact landmarks/labels/tables/themes, repeated dialogs, early guards and partial failures",
  );
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
