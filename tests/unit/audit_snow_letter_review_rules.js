/* Seasonal letter review against the retained module: connection refusals, the exact review form, and the submit
   that rewrites phone lines, posts the confirmed letter and closes the dialog, or shows the failure in place. */
const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  { JSDOM } = require("jsdom"),
  { compile, prng, recorder } = require("../fixtures/equivalence_harness.cjs");

globalThis.__TEST_BUILD__ = true;
const { random, pick, chance } = prng(20261707);

function scenario() {
  const sites = Array.from({ length: random(4) }, (_, n) => [
    pick([`Streets West: ${100 + n}-${200 + n} ward <${n}>`, "Plain west text", "Streets West: 608-266-4000"]),
    pick([`Streets East: 608-${300 + n}`, "East <site> & more", ""]),
  ]);
  const form = () => ({
    season: pick(["2026–27", "", "Season <x>"]),
    reviewedOn: pick(["2026-10-01", ""]),
    webAddress: pick(["https://example.org/snow", "https://a.test/?q=1&r=2"]),
    westPhone: pick(["608-266-4001", "608-555-0100", "123"]),
    eastPhone: pick(["608-266-4002", "", "608-555-0199"]),
    closing: pick(["Closing <line>", "Thanks"]),
    administrator: pick(["Pat Admin", ""]),
    reason: "Annual review of the seasonal content",
    sourceReference: pick(["Memo 12", ""]),
    confirmed: chance(2),
  });
  return {
    ready: pick([true, true, true, false]),
    helper: pick([true, true, true, false]),
    letter: {
      season: pick(["2025–26", "Season <1>"]),
      reviewedOn: pick(["2025-10-01", undefined]),
      webAddress: pick(["https://old.example/snow", "https://q.test/?a=1&b=2"]),
      westPhone: pick(["608-266-4000", "x"]),
      eastPhone: pick(["608-266-4005", "y"]),
      closing: pick(["Old <closing>", "Assistance"]),
      sites,
      extra: pick([undefined, "kept"]),
    },
    form: form(),
    getFails: chance(5),
    postFails: chance(4) ? pick(["Not saved <now>", "Locked"]) : "",
    submit: !chance(5),
    fail: chance(6) ? 1 + random(12) : 0,
  };
}

function run(api, sc) {
  const dom = new JSDOM('<body><dialog id="utility-dialog"></dialog><div id="host"></div></body>'),
    document = dom.window.document,
    calls = [];
  globalThis.document = document;
  globalThis.FormData = dom.window.FormData;
  Object.assign(api.WriterState, { HELPER: sc.ready ? { ok: true } : { ok: false }, CASEDIR: sc.helper ? { helper: true } : null });
  const x = structuredClone(sc);
  document.getElementById("utility-dialog").close = () => calls.push("dialog.close");
  const returns = {
    helperJSON: async (url, body) => {
      if (!body) {
        if (x.getFails) throw new Error("helper offline");
        return { letter: x.letter };
      }
      if (x.postFails) throw new Error(x.postFails);
      return { letter: { ...body.letter, stored: true } };
    },
    "A11Y.utility": (title, html) => (document.getElementById("host").innerHTML = html) && undefined,
  };
  const services = recorder(calls, returns, {}, x.fail);
  const owner = api.initAdministration(services);
  return (async () => {
    let error;
    try {
      await owner.openLetter();
      const form = document.getElementById("admin-snow-letter-form");
      if (form && x.submit) {
        const set = (name, value) => form.elements[name] && (form.elements[name].value = value);
        for (const [k, v] of Object.entries(x.form)) if (k !== "confirmed") set(k, v);
        x.letter.sites.forEach((_, n) => {
          set("west-" + n, pick2(n, "w"));
          set("east-" + n, pick2(n, "e"));
        });
        if (form.elements.confirmed) form.elements.confirmed.checked = x.form.confirmed;
        await form.onsubmit({ preventDefault: () => calls.push("preventDefault"), target: form });
      }
    } catch (e) {
      error = [e.name, e.message];
    }
    const form = document.getElementById("admin-snow-letter-form");
    return JSON.stringify({ error, calls, html: document.getElementById("host").innerHTML, alert: form?.querySelector("[role=alert]").textContent });
  })();
}

const pick2 = (n, side) => ["Streets West: 608-266-4000 — ward " + n, "Streets East: 608-111-2222", "plain " + side + n][(n + side.length) % 3];

(async () => {
  const [current, legacy] = await Promise.all([
    compile('export {initAdministration} from "./administration.js";'),
    compile(fs.readFileSync("tests/fixtures/administration_letter_reference.txt", "utf8")),
  ]);
  const wanted = [
    "Connect the local helper and case folder first.",
    "helper offline",
    "Administrator snow-letter review",
    "Seasonal content updated for new snow citations.",
    "Confirmed by named administrator",
    "dialog.close",
    "Not saved",
    "Locked",
    "snow.setLetter",
    "interrupted",
    "West Side · row 2",
    "Streets West: 608-266-4001",
  ];
  const seen = new Set();
  for (let n = 0; n < 1500; n++) {
    const sc = scenario();
    const [before, after] = [await run(legacy, sc), await run(current, sc)];
    assert.equal(after, before, `snow letter scenario ${n} differs from the retained module:\n${JSON.stringify(sc)}`);
    for (const f of wanted) if (after.includes(f)) seen.add(f);
  }
  for (const f of wanted) assert.ok(seen.has(f), "scenarios reach: " + f);
  delete globalThis.document;
  delete globalThis.FormData;
  console.log("PASS snow letter review matches the retained module over 1500 scenarios");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
