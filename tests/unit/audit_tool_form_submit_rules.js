/* Tool form submits against the retained module in real forms: form selection, the five handlers' peer calls in
   order, search result markup, reminder preferences, batch deadlines, outbox sync, failure toasts and the button
   being re-enabled only while connected. */
const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  { JSDOM } = require("jsdom"),
  { compile, prng, recorder, listenerTarget } = require("../fixtures/equivalence_harness.cjs");

process.on("unhandledRejection", () => {});
globalThis.__TEST_BUILD__ = true;
const { random, pick, chance } = prng(20262009);
const dom = new JSDOM("<body></body>");

const FORMS = ["global-search-form", "reminder-settings", "reminder-email", "batch-due-form", "outbox-form", "other-form"];

function scenario() {
  const hits = Array.from({ length: random(4) }, (_, n) => ({
    number: "BLD-" + n + pick(["", "<x>"]),
    address: pick(["1 Main <St>", "2 Oak & Elm"]),
    owner: pick(["Pat", "A&B"]),
    duplicate: chance(3),
  }));
  return {
    id: pick(FORMS),
    submit: !chance(8),
    connected: !chance(5),
    query: pick(["weeds & more", "x y", ""]),
    enabled: chance(2),
    days: pick(["", "0", "5", "45", "abc", "7", "-3"]),
    plans: pick([
      [],
      [["plan:c1", "2026-11-01"]],
      [
        ["plan:c1", "bad"],
        ["plan:c2", "2026-12-01"],
        ["other", "2026-01-01"],
      ],
    ]),
    mail: { to: "a@b.org", subject: "Hi", body: "Body" },
    due: pick(["2026-11-05", ""]),
    items: Array.from({ length: random(3) }, (_, n) => ({ doc: "d" + n, item: "i" + n, checked: chance(2) })),
    docs: [
      { id: "d0", v: 1 },
      { id: "d1", v: 1 },
      { id: "d2", v: 1 },
    ],
    search: { hits, unreadable: random(3), partial: chance(3) },
    outbox: { moved: random(4), conflicts: Array.from({ length: random(3) }, (_, n) => "c" + n) },
    throwAt: pick(["", "", "", "helper", "persist", "outbox"]),
    fail: chance(6) ? 1 + random(14) : 0,
  };
}

async function run(api, sc) {
  const x = structuredClone(sc),
    calls = [],
    document = dom.window.document;
  document.body.innerHTML = '<dialog id="utility-dialog"></dialog><div id="global-search-results"></div>';
  globalThis.document = document;
  globalThis.FormData = dom.window.FormData;
  document.getElementById("utility-dialog").close = () => calls.push("dialog.close");
  const prefs = { enabled: false, days: 3, plans: { old: "x" } };
  Object.assign(api.WriterState, { WORKFLOW_PREFS: { reminders: prefs }, DOCS: x.docs, DIRTY: false });
  const field = (name, value) => `<input name="${name}" value="${value}">`;
  const form = document.createElement("form");
  form.id = x.id;
  form.innerHTML =
    field("query", x.query) +
    (x.enabled ? '<input name="enabled" value="on">' : "") +
    field("days", x.days) +
    x.plans.map(([k, v]) => field(k, v)).join("") +
    field("to", x.mail.to) +
    field("subject", x.mail.subject) +
    field("body", x.mail.body) +
    field("due", x.due) +
    x.items.map((i) => `<input type="checkbox" data-batch-item="${i.item}" data-batch-doc="${i.doc}" ${i.checked ? "checked" : ""}>`).join("") +
    (x.submit ? '<button type="submit">Go</button>' : "");
  document.body.appendChild(form);
  const drop = () => x.connected || form.remove();
  const returns = {
    helperJSON: async (url) => {
      drop();
      if (x.throwAt === "helper") throw new Error("helper <down>");
      return url.startsWith("/cases/search") ? x.search : url === "/outbox/batch-sync" ? { result: x.outbox } : {};
    },
    validISO: (v) => /^\d{4}-\d{2}-\d{2}$/.test(v),
    planBulkDue: (changes, due) => new Map(changes.map((c) => [c.docId, { id: c.docId, v: 2, due }])),
    persistWorkspacePatch: async (stage, apply) => {
      drop();
      calls.push("staged " + JSON.stringify(stage({ docs: x.docs })));
      if (x.throwAt === "persist") throw new Error("not saved");
      apply();
    },
    selectedOutbox: () => [{ id: "o1" }],
    refreshArtifactLocations: async () => drop(),
    showOutbox: async () => {
      if (x.throwAt === "outbox") throw new Error("outbox <gone>");
    },
  };
  const services = recorder(calls, returns, {}, x.fail);
  const target = listenerTarget();
  const owner = api.createWorkflowEvents(services);
  assert.deepEqual(calls, [], "construction remains inert");
  owner.registerToolForms(target);
  const event = { target: form, preventDefault: () => calls.push("preventDefault") };
  let error;
  try {
    await target.listeners.submit(event);
  } catch (e) {
    error = [e.name, e.message];
  }
  return JSON.stringify({
    error,
    calls,
    prefs,
    docs: api.WriterState.DOCS,
    results: document.getElementById("global-search-results").innerHTML,
    disabled: form.querySelector("button")?.disabled,
  });
}

(async () => {
  const [current, legacy] = await Promise.all([
    compile('export {createWorkflowEvents} from "./workflow_events.js";'),
    compile(fs.readFileSync("tests/fixtures/workflow_events_reference.txt", "utf8")),
  ]);
  const wanted = [
    "matching cases",
    "Results limited",
    "Duplicate identity",
    "data-global-open",
    '"days":30',
    '"days":1',
    '"days":7',
    '"plans":{"c1"',
    "Opened Outlook reminder draft",
    "Saved selected draft deadlines",
    "PDF(s) filed",
    'severity\\":\\"warning',
    "helper &lt;down&gt;",
    "helper <down>",
    "not saved",
    "outbox <gone>",
    "dialog.close",
    "interrupted",
    '"disabled":true',
    '"disabled":false',
  ];
  const seen = new Set();
  for (let n = 0; n < 4000; n++) {
    const sc = scenario();
    const [before, after] = [await run(legacy, sc), await run(current, sc)];
    assert.equal(after, before, `tool form scenario ${n} differs from the retained module:\n${JSON.stringify(sc)}`);
    for (const f of wanted) if (after.includes(f) || after.includes(f.replace(/&lt;/g, "<").replace(/&gt;/g, ">"))) seen.add(f);
  }
  for (const f of wanted) assert.ok(seen.has(f), "scenarios reach: " + f);
  console.log("PASS tool form submits match the retained module over 4000 scenarios");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
