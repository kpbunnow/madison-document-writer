/* Message repaint keeps focus, scoped markup and timer/event order from the retained owner. */
const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path"),
  acorn = require("acorn"),
  esbuild = require("esbuild"),
  { JSDOM } = require("jsdom");
(async () => {
  const source = fs.readFileSync("app/modules/accessibility.js", "utf8"),
    factory = acorn
      .parse(source, { ecmaVersion: 2022, sourceType: "module" })
      .body.find((n) => n.declaration?.id?.name === "createAccessibility").declaration,
    fn = factory.body.body.find((n) => n.id?.name === "paint");
  async function compile(contents) {
    const b = await esbuild.build({ stdin: { contents, resolveDir: path.resolve("app/modules") }, bundle: true, write: false, format: "cjs" });
    return b.outputFiles[0].text;
  }
  const [current, legacy] = await Promise.all([
    compile(source),
    compile(source.slice(0, fn.start) + fs.readFileSync("tests/fixtures/message_paint_reference.txt", "utf8") + source.slice(fn.end)),
  ]);
  async function run(code, flags) {
    const dom = new JSDOM(
        '<!doctype html><html><body><div id="app"><main class="main"><h1>Screen</h1></main></div>' +
          (flags.host ? '<div id="toast"></div>' : "") +
          "</body></html>",
        { url: "http://127.0.0.1:8777/", pretendToBeVisual: true },
      ),
      w = dom.window,
      document = w.document;
    w.MutationObserver = undefined;
    if (flags.dialog) {
      const dialog = document.createElement("dialog");
      dialog.id = "utility-dialog";
      dialog.innerHTML =
        '<h2 id="utility-title">Synthetic dialog</h2>' + (flags.local ? '<div data-utility-messages class="message-stack"></div>' : "");
      document.body.append(dialog);
    }
    const calls = [],
      timers = new Map();
    let sequence = 0,
      now = 1793221200000;
    class Clock extends Date {
      constructor(...args) {
        super(...(args.length ? args : [now]));
      }
      static now() {
        return now;
      }
    }
    const box = { exports: {} };
    new Function("module", "exports", "window", "document", "localStorage", "setTimeout", "clearTimeout", "Date", code)(
      box,
      box.exports,
      w,
      document,
      w.localStorage,
      (fn, ms) => {
        const id = ++sequence;
        timers.set(id, { fn, ms });
        calls.push(["set", id, ms]);
        return id;
      },
      (id) => {
        calls.push(["clear", id]);
        timers.delete(id);
      },
      Clock,
    );
    const owner = box.exports.createAccessibility(),
      frames = [];
    const frame = () =>
      frames.push({
        html: document.body.innerHTML,
        focus: document.activeElement?.outerHTML,
        history: w.localStorage.getItem("madison-message-history-v1"),
        calls: structuredClone(calls),
      });
    const options = {
      severity: flags.severity,
      key: flags.key ? "synthetic" : "",
      inline: flags.inline,
      undo: flags.undo ? () => calls.push(["undo"]) : undefined,
    };
    owner.notify("Synthetic <&> message", options);
    await Promise.resolve();
    frame();
    const target = document.querySelector(flags.undo ? "[data-message-undo]" : "[data-message-dismiss]");
    if (target && flags.focus) {
      target.focus();
      target.dispatchEvent(new w.FocusEvent("focusin", { bubbles: true }));
    }
    if (target && flags.hover) target.closest("[data-message]").dispatchEvent(new w.MouseEvent("mouseenter"));
    now += 1800;
    owner.notify("Second warning", { severity: "warning" });
    await Promise.resolve();
    frame();
    owner.notify("Synthetic <&> message", options);
    await Promise.resolve();
    frame();
    const active = document.querySelector('[data-message="1"]');
    if (active) {
      active.dispatchEvent(new w.FocusEvent("focusout", { bubbles: true, relatedTarget: document.body }));
      active.dispatchEvent(new w.MouseEvent("mouseleave"));
    }
    if (flags.fire) {
      now += 15000;
      const pending = [...timers.values()];
      timers.clear();
      for (const timer of pending) timer.fn();
      await Promise.resolve();
      frame();
    }
    if (flags.key) owner.resolve("synthetic");
    else owner.dismiss("1");
    await Promise.resolve();
    frame();
    dom.window.close();
    return frames;
  }
  let checked = 0;
  for (const severity of ["error", "warning", "success", "progress"])
    for (let bits = 0; bits < 256; bits++) {
      const flags = {
        severity,
        host: !!(bits & 1),
        dialog: !!(bits & 2),
        local: !!(bits & 4),
        focus: !!(bits & 8),
        hover: !!(bits & 16),
        undo: !!(bits & 32),
        key: !!(bits & 64),
        inline: !!(bits & 128),
        fire: !!(bits & 16),
      };
      assert.deepEqual(await run(current, flags), await run(legacy, flags), "scenario " + checked++);
    }
  console.log("PASS message repaint equivalence " + checked + " scenarios: markup, focus, dialog scope, pause/resume and timer order");
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
