/* Mixed-case queue, unified filters, contextual recovery and protected history. */
globalThis.MADISON_TEST_DATA = true;
const assert = require("assert/strict"),
  { JSDOM } = require("jsdom");
const { builtPage, bundleSource } = require("../fixtures/built_bundle.cjs");
const payload = bundleSource(builtPage());
const dom = new JSDOM('<div id="app"></div><div id="overlay"></div><div id="toast"></div>', {
  url: "http://127.0.0.1:8777/",
  pretendToBeVisual: true,
});
global.window = dom.window;
global.document = dom.window.document;
global.getSelection = () => window.getSelection();
window.scrollTo = () => {};
global.fetch = async () => {
  throw Error("offline");
};
const test = async () => {
  await new Promise((r) => setTimeout(r, 30));
  saveDrafts = async () => true;
  idbSet = async () => true;
  WriterState.CASES = [];
  WriterState.DOCS = [];
  WriterState.REINSP = [];
  WriterState.EVENTS = {};
  WriterState.PENDING = [];
  WriterState.RECORD_ATTEMPTS = {};
  WriterState.WORK = { entry: {}, acc: null, recordForms: {} };
  WriterState.HELPER = null;
  WriterState.CASEDIR = null;
  WriterState.NEEDGRANT = false;
  WriterState.ARTIFACT_LOCATIONS = {};
  WriterState.ARTIFACT_VERIFY = {};
  for (let n = 0; n < 32; n++) {
    const k = {
      id: "queue-" + n,
      number: "QA-" + n,
      address: 100 + n + " EXAMPLE LANE",
      owner: "SYNTHETIC OWNER",
      inspectorId: "i4",
      date: recordDay(today),
      time: "09:00",
    };
    WriterState.CASES.push(k);
    const d = {
      id: "qdoc-" + n,
      caseId: k.id,
      type: "notice",
      created: recordDay(today),
      mailed: recordDay(today),
      draft: n % 6 === 0,
      status: n % 6 === 0 ? "Draft" : "Final",
      filedAt: "filed",
      items: [
        {
          id: "qi-" + n,
          no: "1",
          title: "Repair",
          text: "Repair.",
          sections: ["27.05(2)(c)"],
          due: addDays(recordDay(today), n % 6 === 1 ? -3 : n % 6 === 2 ? 3 : 30),
        },
      ],
      cits: {},
      filedArtifact: { filename: n + ".pdf", sha256: "a".repeat(64) },
    };
    WriterState.DOCS.push(d);
    WriterState.ARTIFACT_LOCATIONS[d.id] = ["shared"];
    if (n % 6 === 3) WriterState.PENDING.push({ cid: k.id, name: k.number + ".json", body: "{}" });
    if (n % 6 === 4) d.filedAt = null;
    if (n % 6 === 5) WriterState.ARTIFACT_LOCATIONS[d.id] = ["local"];
  }
  WriterState.state = {
    ...WriterState.state,
    screen: "cases",
    metric: "",
    caseQ: "",
    caseInspector: "",
    caseFilter: "attention",
    modal: null,
    docId: null,
    reinspId: null,
    acc: null,
  };
  const mount = () => {
    document.getElementById("app").innerHTML = screenCases();
    return document.getElementById("app");
  };
  let app = mount();
  // Five quick views are primary; More views holds only the additional states behind a placeholder.
  assert.deepEqual(
    [...app.querySelectorAll("[data-queue-view]")].map((b) => b.dataset.queueView),
    ["attention", "continue", "deadlines", "resolution", "all"],
  );
  assert.equal(app.querySelector('[data-queue-view="attention"]').getAttribute("aria-pressed"), "true");
  assert.equal(app.querySelector("#case-filter").getAttribute("aria-label"), "More views");
  assert.deepEqual(
    [...app.querySelectorAll("#case-filter option")].map((o) => o.value),
    ["", "soon", "overdue", "open", "closed"],
  );
  assert.equal(app.querySelector("#case-filter").value, "");
  assert.equal(app.querySelectorAll("[data-metric]").length, 0);
  assert.equal(app.querySelectorAll("thead th").length, 5);
  assert.equal(app.querySelectorAll("[data-queue-case]").length, 32);
  assert.ok(app.querySelector(".case-table caption"));
  assert.ok([...app.querySelectorAll("[data-queue-case]")].every((tr) => tr.querySelectorAll(".queue-primary").length === 1));
  assert.ok(app.querySelector('[data-queue-case="queue-0"] .queue-primary').hasAttribute("data-open"));
  assert.ok(app.querySelector('[data-queue-case="queue-3"] .queue-primary').hasAttribute("data-case-sync"));
  assert.ok(app.querySelector('[data-queue-case="queue-5"] .queue-primary').hasAttribute("data-outbox"));
  // Cached local location is not presented as a fresh verification when refresh fails.
  WriterState.ARTIFACT_VERIFY["qdoc-5"] = "unavailable";
  app = mount();
  assert.ok(app.querySelector('[data-queue-case="queue-5"]').textContent.includes("last verified"));
  assert.ok(app.querySelector('[data-queue-case="queue-5"] .queue-primary').hasAttribute("data-outbox"));
  delete WriterState.ARTIFACT_VERIFY["qdoc-5"];
  // A mixed case has one next action; its other problems stay in details.
  WriterState.PENDING.push({ cid: "queue-0", name: "QA-0.json", body: "{}" });
  WriterState.DOCS.push({ ...clone(WriterState.DOCS[4]), id: "second-pdf", caseId: "queue-0" });
  app = mount();
  let mixed = app.querySelector('[data-queue-case="queue-0"]');
  assert.equal(mixed.querySelector(".queue-primary").textContent, "Continue document");
  assert.ok(mixed.querySelector('details [data-case-sync="queue-0"]'));
  assert.ok(mixed.querySelector('details [data-open="second-pdf"]'));
  WriterState.RECORD_ATTEMPTS.attempt = { cid: "queue-0", recordKey: "attempt" };
  app = mount();
  assert.equal(app.querySelector('[data-queue-case="queue-0"] .queue-primary').textContent, "Confirm saved action");
  delete WriterState.RECORD_ATTEMPTS.attempt;
  // Counts, membership and action update together when both pending tasks resolve.
  WriterState.state.caseFilter = "resolution";
  app = mount();
  const before = app.querySelectorAll("[data-queue-case]").length;
  WriterState.PENDING = WriterState.PENDING.filter((p) => p.cid !== "queue-0");
  WriterState.DOCS.find((d) => d.id === "second-pdf").filedAt = "filed";
  WriterState.ARTIFACT_LOCATIONS["second-pdf"] = ["shared"];
  app = mount();
  assert.equal(app.querySelectorAll("[data-queue-case]").length, before - 1);
  assert.ok(!app.querySelector('[data-queue-case="queue-0"]'));
  assert.equal(Number(app.querySelector('[data-queue-view="resolution"] strong').textContent), before - 1);
  // Summary clicks change only the view: search and inspector stay applied, so the rows are their intersection.
  const shownIds = () => [...document.querySelectorAll("[data-queue-case]")].map((tr) => tr.dataset.queueCase);
  WriterState.state.caseQ = "QA-1";
  WriterState.state.caseInspector = "i4";
  app = mount();
  app.querySelector('[data-queue-view="all"]').click();
  assert.equal(WriterState.state.caseQ, "QA-1");
  assert.equal(WriterState.state.caseInspector, "i4");
  const searchedAll = shownIds();
  assert.ok(searchedAll.length > 1 && searchedAll.length < 32, "the search narrows All cases");
  document.querySelector('[data-queue-view="deadlines"]').click();
  assert.equal(WriterState.state.metric, "");
  assert.equal(WriterState.state.caseFilter, "deadlines");
  assert.equal(WriterState.state.caseQ, "QA-1", "search kept when switching quick views");
  assert.equal(WriterState.state.caseInspector, "i4", "inspector kept when switching quick views");
  assert.equal(document.querySelector("#case-search").value, "QA-1");
  assert.equal(document.querySelector("#case-inspector").value, "i4");
  assert.equal(document.querySelector("#case-filter").value, "");
  assert.equal(document.activeElement, document.querySelector('[data-queue-view="deadlines"]'));
  assert.equal(document.querySelector('[data-queue-view="deadlines"]').getAttribute("aria-pressed"), "true");
  assert.equal(WriterState.WORKFLOW_PREFS.filter, "deadlines");
  assert.equal(WriterState.WORKFLOW_PREFS.query, "QA-1");
  assert.equal(WriterState.WORKFLOW_PREFS.inspector, "i4");
  const searchedDeadlines = shownIds();
  // Only the explicit reset clears search and inspector; the view stays.
  document.querySelector("[data-queue-reset]").click();
  assert.equal(WriterState.state.caseQ, "");
  assert.equal(WriterState.state.caseInspector, "");
  assert.equal(WriterState.state.caseFilter, "deadlines");
  assert.equal(document.activeElement, document.querySelector("#case-search"));
  const allDeadlines = shownIds();
  assert.deepEqual(
    searchedDeadlines,
    allDeadlines.filter((id) => searchedAll.includes(id)),
    "filtered Deadlines rows are the intersection of Deadlines and the search",
  );
  assert.ok(searchedDeadlines.length > 0 && searchedDeadlines.length < allDeadlines.length);
  const deadlineCount = document.querySelectorAll("[data-queue-case]").length;
  assert.equal(deadlineCount, 11);
  assert.equal(Number(document.querySelector('[data-queue-view="deadlines"] strong').textContent), deadlineCount);
  WriterState.state.metric = "filing";
  WriterState.state.caseFilter = "attention";
  app = mount();
  assert.equal(WriterState.state.metric, "");
  assert.equal(WriterState.state.caseFilter, "resolution");
  WriterState.state.caseQ = "nothing";
  WriterState.state.caseInspector = "other";
  app = mount();
  app.querySelector("#case-showall").click();
  assert.equal(WriterState.state.caseFilter, "all");
  assert.equal(WriterState.state.caseQ, "");
  assert.equal(WriterState.state.caseInspector, "");
  assert.equal(document.querySelectorAll("[data-queue-case]").length, 32);
  // Mandatory wording, rather than a false deposit task, is the draft blocker.
  const d = WriterState.DOCS[0],
    entry = policyAt(recordDay(today)).entries.find((e) => e.rule?.kind === "mandatory");
  d.authoringVersion = 11;
  d.items[0].cite = true;
  d.items[0].sections = [entry.ordinance];
  d.cits[d.items[0].id] = {
    ord: entry.ordinance,
    issued: recordDay(today),
    ...resolveCitationAmount({ ordinance: entry.ordinance, entryId: entry.id, tier: 1, date: recordDay(today) }),
  };
  WriterState.state.caseFilter = "resolution";
  app = mount();
  mixed = app.querySelector('[data-queue-case="queue-0"]');
  assert.ok(mixed.textContent.includes("division-approved wording"));
  assert.ok(!mixed.textContent.includes("Citation needs deposit"));
  // Failed integrity wins over the draft and cannot lead directly to mutation.
  const oldStatus = recordIntegrity.status;
  recordIntegrity.status = (k) =>
    k.id === "queue-0" ? { valid: false, label: "Synthetic verification failure", eventId: "evt", expected: "abc", actual: "def" } : oldStatus(k);
  app = mount();
  mixed = app.querySelector('[data-queue-case="queue-0"]');
  assert.equal(mixed.querySelector(".queue-primary").dataset.syncSafety, "queue-0");
  assert.equal(safetyCaseStatus(WriterState.CASES[0])[2], "integrity");
  const utility = A11Y.utility,
    shown = [];
  A11Y.utility = (title, body) => shown.push({ title, body });
  helperJSON = async () => ({});
  await showSafety("queue-0");
  assert.ok(shown.at(-1).body.includes("QA-0"));
  assert.ok(!shown.at(-1).body.includes("QA-1</th>"));
  assert.ok(shown.at(-1).body.includes("Show all saved work"));
  recordIntegrity.status = oldStatus;
  A11Y.utility = utility;
  // A legacy filed marker without PDF identity is a verification task, before reinspection.
  const issued = WriterState.DOCS.find((x) => x.id === "qdoc-1"),
    artifact = issued.filedArtifact;
  delete issued.filedArtifact;
  WriterState.state.caseFilter = "all";
  app = mount();
  assert.equal(app.querySelector('[data-queue-case="queue-1"] .queue-primary').textContent, "Check filed PDF");
  issued.filedArtifact = artifact;
  // A queued file outside the loaded workspace remains reachable.
  WriterState.PENDING.push({ cid: "not-loaded", name: "QA-MISSING.json", body: "{}" });
  app = mount();
  assert.ok(app.textContent.includes("outside the loaded cases"));
  A11Y.utility = (title, body) => shown.push({ title, body });
  await showSafety();
  assert.ok(shown.at(-1).body.includes("QA-MISSING.json"));
  assert.ok(shown.at(-1).body.includes("data-safety-pending"));
  A11Y.utility = utility;
  // Healthy proofs and put-away controls are available only inside case details.
  assert.ok(app.querySelector("details [data-rmcase]"));
  assert.equal(app.querySelectorAll(".case-next [data-rmcase]").length, 0);
  WriterState.CASES = [];
  WriterState.DOCS = [];
  WriterState.PENDING = [];
  WriterState.state.caseFilter = "attention";
  app = mount();
  assert.equal(app.querySelectorAll("[data-queue-view]").length, 0);
  assert.ok(app.textContent.includes("Start with a case"));
  console.log(
    "PASS R41 mixed 32-case queue, next-action precedence, same-source counts" +
      ", filter reset, held mandatory draft, contextual integrity recovery, orp" +
      "han saves and empty state",
  );
  process.exit(0);
};
eval(payload + "\n(" + test.toString() + ")().catch(e=>{console.error(e);process.exit(1);})");
