/* Deposit schedule explorer against the retained module: the markup after every date change, search and page
   click, including invalid dates, empty searches and page clamping, and the order of renders and escapes. */
const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  { compile, prng } = require("../fixtures/equivalence_harness.cjs");

globalThis.__TEST_BUILD__ = true;
const { random, pick, chance } = prng(20261505);
const DATES = ["2026-10-27", "2026-10-27", "2015-06-01", "2020-03-01", "2000-01-01", "2035-01-01", "", "bad", "2026-13-40"];
const QUERIES = ["", "", "weed", "27.05", "zzzz", "  snow  ", "rule 12", "citation", "e"];

function scenario() {
  const steps = [];
  for (let n = 0, count = 2 + random(8); n < count; n++) {
    const kind = pick(["date", "query", "next", "next", "previous", "disabled", "other"]);
    steps.push({ kind, value: kind === "date" ? pick(DATES) : kind === "query" ? pick(QUERIES) : "" });
  }
  return steps;
}

function run(api, steps) {
  const handlers = {},
    calls = [],
    scrolled = [];
  globalThis.document = {
    addEventListener: (name, fn) => (handlers[name] = fn),
    getElementById: (id) => ({ scrollIntoView: (o) => scrolled.push(id + JSON.stringify(o)) }),
  };
  const services = { esc: (s) => (calls.push("esc " + String(s).slice(0, 40)), "[" + String(s) + "]"), render: () => calls.push("render") };
  const schedule = api.initDepositSchedule(services);
  const out = [];
  const click = (attribute, disabled) => ({
    target: { closest: () => ({ getAttribute: () => String(disabled), dataset: { schedulePage: attribute } }) },
  });
  for (const { kind, value } of steps) {
    try {
      if (kind === "date") handlers.change({ target: { id: "deposit-schedule-date", value } });
      else if (kind === "query") handlers.input({ target: { id: "deposit-schedule-search", value } });
      else if (kind === "next" || kind === "previous") handlers.click(click(kind, false));
      else if (kind === "disabled") handlers.click(click("next", true));
      else {
        handlers.change({ target: { id: "other", value: "x" } });
        handlers.input({ target: { id: "other", value: "x" } });
        handlers.click({ target: { closest: () => null } });
      }
      out.push(schedule.html());
    } catch (error) {
      out.push(["error", error.name, error.message]);
    }
  }
  return JSON.stringify({ out, calls, scrolled });
}

(async () => {
  const [current, legacy] = await Promise.all([
    compile('export {initDepositSchedule} from "./deposit_schedule.js";'),
    compile(fs.readFileSync("tests/fixtures/deposit_schedule_reference.txt", "utf8")),
  ]);
  const wanted = [
    "Enter a valid date.",
    "No schedule rows match",
    "no matches",
    "showing 41",
    'aria-disabled=\\"true',
    "Prior-offense window:",
    "No rolling year window stated.",
    "Same site and season",
    "No measurements required.",
    "Retained baseline to",
    "Source and technical details",
    "matching schedule rows",
    "Pricing date basis",
  ];
  const seen = new Set();
  for (let n = 0; n < 400; n++) {
    const sc = scenario();
    const [before, after] = [run(legacy, sc), run(current, sc)];
    assert.equal(after, before, `deposit schedule scenario ${n} differs from the retained module:\n${JSON.stringify(sc)}`);
    for (const f of wanted) if (after.includes(f)) seen.add(f);
  }
  for (const f of wanted) assert.ok(seen.has(f), "scenarios reach: " + f);
  delete globalThis.document;
  console.log("PASS deposit schedule explorer matches the retained module over 400 scenarios");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
