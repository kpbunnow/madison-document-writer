/* Printable HTML against the retained module: the exact document produced from seeded sheets of inputs, selects,
   buttons, editable and extra-copy parts, with the title escaping, the missing-sheet notice and the no-document case. */
const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  { JSDOM } = require("jsdom"),
  { compile, prng, recorder } = require("../fixtures/equivalence_harness.cjs");

globalThis.__TEST_BUILD__ = true;
const { random, pick, chance } = prng(20261606);

function control() {
  const kind = pick(["text", "date", "time", "select", "button", "checkbox", "hdr", "empty"]);
  if (kind === "text") return `<input type="text" value="${pick(["Pat <O'Neil>", "", "x & y"])}">`;
  if (kind === "date") return `<input type="date" value="${pick(["2026-10-27", "", "2026-01-05"])}">`;
  if (kind === "time") return `<input type="time" value="${pick(["13:05", "09:00", ""])}">`;
  if (kind === "select") return `<select>${pick(["<option>A</option><option selected>B &amp; C</option>", "", "<option>One</option>"])}</select>`;
  if (kind === "button") return `<button class="btn">${pick(["Open", "", "Go <now>"])}</button>`;
  if (kind === "checkbox") return `<input type="checkbox" value="on">`;
  if (kind === "hdr") return `<input class="hdr-time" type="time" value="${pick(["08:15", ""])}">`;
  return "<input>";
}

function fragment() {
  return pick([
    () => `<p>${pick(["Note", "Row <1>"])} ${control()}</p>`,
    () => `<div class="grip">g</div>`,
    () => `<span class="gbtn rm addrow no-print">x</span>`,
    () => `<div contenteditable="true" data-editor-extra-copy="1">Edit</div>`,
    () => `<div data-editor-extra-copy="yes">Extra</div>`,
    () => `<table class="notice"><tbody><tr><td>${control()}</td></tr></tbody></table>`,
    () => control(),
    () => `<div class="cit">Citation ${control()}</div>`,
  ])();
}

function scenario() {
  return {
    sheet: chance(8) ? null : Array.from({ length: random(7) }, fragment).join(""),
    override: chance(3),
    docPresent: !chance(6),
    number: pick(["BLD2026-00001", "", "No <1> & 2"]),
    fail: chance(5) ? 1 + random(4) : 0,
  };
}

function run(api, sc) {
  const dom = new JSDOM("<body></body>"),
    document = dom.window.document,
    calls = [];
  if (sc.sheet !== null) {
    const desk = document.createElement("div");
    desk.className = "desk";
    desk.innerHTML = '<section class="sheet">' + sc.sheet + "</section>";
    document.body.appendChild(desk);
  }
  Object.assign(api.WriterState, {
    CASES: [{ id: "case", number: sc.number }],
    DOCS: sc.docPresent ? [{ id: "d1", caseId: "case" }] : [],
    state: { docId: "d1" },
  });
  const services = recorder(calls, { toast: undefined }, { document }, sc.fail);
  const owner = api.createBrowserPrinting(services);
  assert.deepEqual(calls, [], "construction remains inert");
  let value, error;
  try {
    value = sc.override ? owner.printableHTML({ id: "d1", caseId: "case" }, document.querySelector(".desk") || undefined) : owner.printableHTML();
  } catch (e) {
    error = [e.name, e.message];
  }
  return JSON.stringify({ value, error, calls });
}

(async () => {
  const [current, legacy] = await Promise.all([
    compile('export {createBrowserPrinting} from "./browser_printing.js";'),
    compile(fs.readFileSync("tests/fixtures/browser_printing_reference.txt", "utf8")),
  ]);
  const wanted = ["Nothing to print", "hdr-time", "display: block", "Official Notice", "&lt;", "<span>", "10/27/2026", "interrupted", "Citation"],
    seen = new Set();
  for (let n = 0; n < 1500; n++) {
    const sc = scenario();
    const [before, after] = [run(legacy, sc), run(current, sc)];
    assert.equal(after, before, `printable HTML scenario ${n} differs from the retained module:\n${JSON.stringify(sc)}`);
    for (const f of wanted) if (after.includes(f)) seen.add(f);
    if (JSON.parse(after).value === "") seen.add("none");
  }
  for (const f of [...wanted, "none"]) assert.ok(seen.has(f), "scenarios reach: " + f);
  console.log("PASS printable HTML matches the retained module over 1500 scenarios");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
