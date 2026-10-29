/* Frozen-owner comparison for the editor's document input and change listeners: service access, call order,
   model mutation and DOM effects over seeded scenarios, including thrown errors. */
const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path"),
  acorn = require("acorn"),
  esbuild = require("esbuild");
const { JSDOM } = require("jsdom");
const dir = path.resolve("app/modules"),
  source = fs.readFileSync(path.join(dir, "editor_events.js"), "utf8"),
  [referenceInput, referenceChange] = fs.readFileSync("tests/fixtures/editor_input_reference.txt", "utf8").split("\n//---- registerDocumentChange\n");
const factory = acorn
  .parse(source, { ecmaVersion: 2022, sourceType: "module" })
  .body.find((n) => n.declaration?.id?.name === "createEditorEvents").declaration;
const owner = (name) => factory.body.body.find((n) => n.id?.name === name);
const [input, change] = [owner("registerDocumentInput"), owner("registerDocumentChange")].sort((a, b) => b.start - a.start);
assert.ok(input && change, "both listener registrations stay in the editor event owner");
const legacySource = [
  [input, referenceInput.trimEnd()],
  [change, referenceChange.trimEnd()],
]
  .sort(([a], [b]) => b.start - a.start)
  .reduce((text, [node, replacement]) => text.slice(0, node.start) + replacement + text.slice(node.end), source);

async function compile(contents) {
  const build = await esbuild.build({
    stdin: { contents: contents + '\nexport {WriterState} from "./state.js";', resolveDir: dir },
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
  new Function("module", "exports", build.outputFiles[0].text)(box, box.exports);
  return box.exports;
}

const clone = (value) => JSON.parse(JSON.stringify(value));
let seed = 20261029;
const random = (n) => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed % n;
  },
  pick = (values) => values[random(values.length)],
  chance = (n) => random(n) === 0;

/* Services record every property read and call (with arguments as they were at call time) in order. */
function services(calls, returns) {
  const show = (value) =>
    JSON.stringify(value, (_, v) => (v && v.nodeType ? "<node " + v.nodeName + "#" + v.id + ">" : v === undefined ? "<undefined>" : v));
  const make = (trail) =>
    new Proxy(function () {}, {
      get(_, key) {
        const next = trail.concat(String(key));
        calls.push("get " + next.join("."));
        return make(next);
      },
      apply(_, __, args) {
        const name = trail.join(".");
        calls.push(name + "(" + args.map(show).join(",") + ")");
        const result = returns[name];
        return typeof result === "function" ? result(...args) : result;
      },
    });
  return make([]);
}

const TOPICS = {
  inputIds: [
    "",
    "",
    "",
    "correction-action-date",
    "correction-reason",
    "correction-external",
    "case-search",
    "folder-search",
    "pk-q",
    "lib-filter",
    "correction-reviewed",
  ],
  inputFlags: [
    {},
    {},
    { "data-cc": "1" },
    { "data-em": "1" },
    { "data-agent": "1" },
    { "data-rinote": "1" },
    { "data-case": "number" },
    { "data-case": "ownerBlock" },
    { "data-case": "date", "data-fmt": "date" },
    { "data-case": "time", "data-fmt": "time" },
    { "data-case": "address" },
    { "data-doc": "mailed", "data-fmt": "date" },
    { "data-doc": "subject" },
    { "data-cit": "ord" },
    { "data-field": "due", "data-id": "i1" },
    { "data-field": "due", "data-id": "i2" },
    { "data-field": "sections", "data-id": "i1" },
    { "data-field": "group", "data-id": "i2" },
    { "data-field": "group", "data-id": "i3" },
    { "data-field": "text", "data-id": "i1" },
    { "data-field": "note", "data-id": "i2" },
    { "data-field": "text", "data-id": "absent" },
    { "data-field": "due" },
    { "data-id": "i1" },
  ],
  values: [
    "",
    "2026-11-05",
    "today",
    "not a date",
    "  2026-11-01  ",
    "QA-1234",
    "!!",
    "ab",
    "ACME LLC\n1 Main St\nMadison WI",
    "Fix ( ) and ( ) later",
    "plain text",
    "09:30",
    "line one\nline two\n\nline three",
    "2026-10-01",
  ],
  changeIds: [
    "",
    "",
    "ri-walk-mode",
    "ri-followup-intent",
    "lib-status",
    "pk-status",
    "correction-type",
    "keep-adding",
    "case-filter",
    "case-inspector",
    "acc-date",
    "acc-time",
    "ri-date",
    "ri-time",
    "ri-insp",
    "pk-grp",
    "other",
  ],
  changeFlags: [
    {},
    {},
    { "data-correction-outcome": "x" },
    { "data-em": "1" },
    { "data-ridate": "1" },
    { "data-ridue": "1" },
    { "data-ricite": "1" },
    { "data-doc": "inspectorId" },
    { "data-doc": "mailed" },
  ],
};

function scenario() {
  const attrs = { ...pick(TOPICS.inputFlags), ...(chance(5) ? pick(TOPICS.inputFlags) : {}) };
  const id = pick(TOPICS.inputIds);
  const items = [
    { id: "i1", text: "Fix ( ) here", due: "", sections: ["10.01"], group: "G", libraryKey: chance(2) ? "k1" : "", lib: { c: "c", g: "g", o: "o" } },
    { id: "i2", text: "second", group: "G", due: "2026-12-01" },
    { id: "i3", text: "third", group: pick(["", "G", "H"]) },
    { id: "i4", text: "fourth", group: "G" },
  ];
  const doc = {
    id: "d1",
    caseId: "c1",
    type: pick(["notice", "extension", "bestInterestExtension", "vacancyExtension"]),
    authoringVersion: pick([9, 12, 13, 16]),
    draft: true,
    items,
    inspectorId: pick(["", "ins1"]),
    cits: pick([null, {}, { i1: { deptId: "old" }, i2: { deptId: "" } }]),
    frozen: chance(3) ? { inspector: { badge: "B-12" } } : undefined,
    correction: chance(3) ? { reviewed: true, ...(chance(2) ? { case: { number: "COR-1", owner: "C", ownerAddr: [] } } : {}) } : undefined,
  };
  if (chance(4)) delete doc.cits;
  const html =
    (chance(2) ? '<input type="checkbox" id="correction-reviewed" checked>' : "") +
    (chance(2) ? '<span data-blanks="i1" style="display:none">0 blanks</span>' : "") +
    (chance(2)
      ? '<div class="document-workspace"><div class="n-foot"><span class="mono">old</span></div><div class="n-cont"><span class="r">old</span></div></div>'
      : "") +
    (chance(3) ? '<div class="document-workspace"><div class="n-foot"><span class="mono">x</span></div></div>' : "") +
    '<div id="target"></div>';
  const rinote = chance(3)
    ? { id: "r1", caseId: "c1", draft: true, docId: chance(2) ? "dx" : "", importRule: chance(2) ? { cite: true } : undefined }
    : null;
  return {
    html,
    target: { tag: pick(["input", "div", "textarea", "select"]), id, attrs, value: pick(TOPICS.values), editable: chance(2), checked: chance(2) },
    changeTarget: {
      tag: pick(["input", "select", "div"]),
      id: pick(TOPICS.changeIds),
      attrs: { ...pick(TOPICS.changeFlags), ...(chance(5) ? pick(TOPICS.changeFlags) : {}) },
      value: pick(TOPICS.values),
      checked: chance(2),
    },
    state: {
      docId: pick(["d1", "d1", "d1", "missing", ""]),
      reinspId: rinote ? "r1" : pick(["", "nope"]),
      acc: chance(2) ? { cases: [] } : undefined,
    },
    docs: [doc],
    cases: [
      { id: "c1", number: "QA-001", owner: "OWN", ownerAddr: ["1 Main"], date: "2026-10-20", address: "1 Main", inspectorId: pick(["", "ins1"]) },
    ],
    events: chance(3) ? { c1: [{ id: "e1" }] } : {},
    reinsp: rinote ? [rinote] : [],
    locked: chance(4),
    unchanged: chance(2),
    groupOld: pick(["", "G", "H"]),
    dirty: chance(2),
  };
}

function build(document, target) {
  const el = document.createElement(target.tag);
  if (target.id) el.id = target.id;
  for (const [name, value] of Object.entries(target.attrs)) el.setAttribute(name, value);
  if (target.tag === "input" || target.tag === "textarea" || target.tag === "select") {
    try {
      el.value = target.value;
    } catch (error) {
      /* select elements ignore unknown option values */
    }
  }
  el.textContent = target.tag === "input" ? "" : target.value;
  if (target.checked && target.tag === "input") {
    el.type = "checkbox";
    el.checked = true;
  }
  if (target.editable) {
    Object.defineProperty(el, "isContentEditable", { value: true });
    Object.defineProperty(el, "innerText", { value: target.value, configurable: true });
  }
  document.getElementById("target").replaceWith(el);
  return el;
}

function run(api, sc, listenerName, dom, targetKey) {
  const { document } = dom.window;
  global.document = document;
  document.body.innerHTML = sc.html;
  const S = api.WriterState,
    calls = [];
  for (const key of Object.keys(S)) delete S[key];
  Object.assign(S, {
    state: clone(sc.state),
    DOCS: clone(sc.docs),
    CASES: clone(sc.cases),
    EVENTS: clone(sc.events),
    REINSP: clone(sc.reinsp),
    DIRTY: sc.dirty,
    groupOld: sc.groupOld,
  });
  const returns = {
    "actions.isLocked": () => sc.locked,
    "actions.splitOwner": (v) => ({ owner: String(v).split("\n")[0], addr: String(v).split("\n").slice(1) }),
    "actions.parseDate": (v) => (/^\d{4}-\d\d-\d\d$/.test(String(v).trim()) ? String(v).trim() : v === "today" ? "2026-10-28" : ""),
    "actions.parseTime": (v) => (/^\d\d:\d\d$/.test(String(v).trim()) ? String(v).trim() : ""),
    "actions.MINDUE": () => "2026-10-29",
    "actions.unchangedCorrectionValue": () => sc.unchanged,
  };
  const listeners = {},
    host = {
      addEventListener(type, fn) {
        listeners[type] = fn;
      },
    };
  const events = api.createEditorEvents(services(calls, returns));
  events[listenerName](host);
  const el = build(document, sc[targetKey]);
  let thrown = "";
  try {
    Object.values(listeners)[0]({ target: el });
  } catch (error) {
    thrown = error.constructor.name + ": " + error.message;
  }
  return JSON.stringify({
    calls,
    thrown,
    docs: S.DOCS,
    cases: S.CASES,
    events: S.EVENTS,
    reinsp: S.REINSP,
    dirty: S.DIRTY,
    groupOld: S.groupOld,
    html: document.body.innerHTML,
    target: el.outerHTML,
  });
}

(async () => {
  const [actual, legacy] = await Promise.all([compile(source), compile(legacySource)]);
  const dom = new JSDOM("<!doctype html><body></body>", { url: "http://127.0.0.1/" });
  const previous = global.document;
  const seen = new Set();
  let checked = 0;
  try {
    for (const [listenerName, targetKey, count] of [
      ["registerDocumentInput", "target", 6000],
      ["registerDocumentChange", "changeTarget", 6000],
    ]) {
      for (let i = 0; i < count; i++) {
        const sc = scenario();
        const [before, after] = [run(legacy, sc, listenerName, dom, targetKey), run(actual, sc, listenerName, dom, targetKey)];
        assert.equal(after, before, `${listenerName} scenario ${i} differs from the frozen listener:\n${JSON.stringify(sc)}`);
        for (const call of JSON.parse(after).calls) seen.add(listenerName + ":" + call.replace(/\(.*$/s, ""));
        checked++;
      }
    }
  } finally {
    global.document = previous;
    dom.window.close();
  }
  // The generator must keep reaching every delegate and edit branch, or the comparison would silently weaken.
  for (const name of [
    "events.correctionEvents.editActionDate",
    "events.correctionEvents.editCorrectionReason",
    "events.workspaceEvents.editSearch",
    "events.catalogEvents.editPickerSearch",
    "events.contactEvents.editRecipient",
    "events.reinspectionEvents.editItemNote",
    "events.catalogEvents.editLibrarySearch",
    "events.citationEvents.editCitationInput",
    "actions.scheduleDraftSave",
    "actions.splitOwner",
    "actions.parseDate",
    "actions.parseTime",
    "actions.newDocuments.invalidateItemReview",
    "actions.newDocuments.setSpecialDue",
    "actions.updateDueIndicators",
    "ui.toast",
    "ui.syncChip",
  ])
    assert.ok(seen.has("registerDocumentInput:" + name), "input scenarios reach " + name);
  for (const name of [
    "events.reinspectionEvents.changeWalkMode",
    "events.reinspectionEvents.changeFollowup",
    "events.catalogEvents.changeLibraryStatus",
    "events.correctionEvents.changeCorrection",
    "events.catalogEvents.changeKeepAdding",
    "events.workspaceEvents.changeCaseFilter",
    "events.importEvents.changeInspectionDateTime",
    "events.contactEvents.changeEmail",
    "events.reinspectionEvents.changeOutcomeDetails",
    "events.reinspectionEvents.changeVisitDate",
    "events.reinspectionEvents.changeVisitTime",
    "events.reinspectionEvents.changeInspector",
    "events.catalogEvents.changePickerGroup",
    "ui.refreshSheet",
  ])
    assert.ok(seen.has("registerDocumentChange:" + name), "change scenarios reach " + name);
  console.log("PASS editor input and change listeners match the frozen owner over " + checked + " scenarios");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
