/* Read-only candidate coverage; optional synthetic DOM capture for before/after screen-shell comparison. */
const fs = require("fs"),
  path = require("path"),
  assert = require("assert/strict");
const inventory = require("../fixtures/screen_shell_css.json");
const classes = inventory.removedClasses;
const checks = [];
async function inspectScreenCSS(page, screen, out) {
  const observed = await page.evaluate((names) => {
    const present = new Set();
    document.querySelectorAll(names.map((name) => "." + CSS.escape(name)).join(",")).forEach((el) =>
      names.forEach((name) => {
        if (el.classList.contains(name)) present.add(name);
      }),
    );
    return {
      present: [...present],
      width: innerWidth,
      height: innerHeight,
      theme: document.documentElement.dataset.theme || "default",
      forcedColors: matchMedia("(forced-colors: active)").matches,
    };
  }, classes);
  checks.push({ screen, ...observed });
  fs.writeFileSync(
    path.join(out, "screen-css-results.json"),
    JSON.stringify({ mode: "guard", passed: checks.every((x) => !x.present.length), checks }, null, 2),
  );
  assert.deepEqual(observed.present, [], screen + ": removed screen classes must not be used");
  if (!process.env.DW_SCREEN_SNAPSHOTS) return;
  const snapshot = await page.evaluate(() => {
    const clone = document.body.cloneNode(true),
      original = [...document.body.querySelectorAll("input,select,textarea")],
      copies = [...clone.querySelectorAll("input,select,textarea")];
    original.forEach((el, i) => {
      const copy = copies[i];
      if (el.tagName === "INPUT") {
        copy.setAttribute("value", el.value);
        copy.toggleAttribute("checked", el.checked);
      } else if (el.tagName === "TEXTAREA") copy.textContent = el.value;
      else [...copy.options].forEach((option, j) => option.toggleAttribute("selected", el.options[j].selected));
    });
    clone.querySelectorAll("script").forEach((el) => el.remove());
    const elements = [...document.body.querySelectorAll("*:not(script)")];
    return {
      body: clone.outerHTML,
      attributes: [...document.documentElement.attributes].map((a) => [a.name, a.value]),
      focus: elements.indexOf(document.activeElement),
      hover: elements.indexOf([...document.querySelectorAll(":hover")].at(-1)),
      scroll: [scrollX, scrollY],
      media: {
        colorScheme: matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light",
        forcedColors: matchMedia("(forced-colors: active)").matches ? "active" : "none",
        reducedMotion: matchMedia("(prefers-reduced-motion: reduce)").matches ? "reduce" : "no-preference",
      },
    };
  });
  const folder = path.resolve(process.env.DW_SCREEN_SNAPSHOTS);
  fs.mkdirSync(folder, { recursive: true });
  fs.writeFileSync(
    path.join(folder, String(checks.length).padStart(3, "0") + ".json"),
    JSON.stringify({ screen, kind: page.url().includes("madison-reports") ? "reports" : "writer", viewport: page.viewportSize(), ...snapshot }),
  );
}
module.exports = { inspectScreenCSS };
