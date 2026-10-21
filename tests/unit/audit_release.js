globalThis.MADISON_TEST_DATA = true;
/* audit_review.js — one check per defect from the external review.
   Every check here fails against the build that preceded the fixes. */
const { JSDOM } = require("jsdom");
const { builtPage, bundleSource } = require("../fixtures/built_bundle.cjs");
const html = builtPage(),
  src = bundleSource(html);
const CSS = /<style>([\s\S]*?)<\/style>/.exec(html)[1];
const dom = new JSDOM(
  "<!doctype html><html><head><style>" +
    CSS +
    '</style></head><body><div id="app"></div><div id="overlay"></div><div id="toast"></div></body></html>',
  { pretendToBeVisual: true, url: "http://127.0.0.1:8777/" },
);
const w = dom.window;
global.window = w;
global.document = w.document;
global.getSelection = () => w.getSelection();
global.Blob = function () {};
global.URL = { createObjectURL: () => "b", revokeObjectURL() {} };
global.FileReader = w.FileReader;
global.confirm = () => true;

// ---- IndexedDB stub -------------------------------------------------------
const KV = new Map();
global.indexedDB = {
  open() {
    const r = {};
    r.result = {
      objectStoreNames: { contains: () => true },
      createObjectStore() {},
      transaction() {
        return {
          objectStore() {
            return {
              get(k) {
                const q = {};
                queueMicrotask(() => {
                  q.result = KV.get(k);
                  q.onsuccess && q.onsuccess();
                });
                return q;
              },
              put(v, k) {
                KV.set(k, JSON.parse(JSON.stringify(v)));
                return {};
              },
            };
          },
          set oncomplete(f) {
            queueMicrotask(() => f && f());
          },
          get oncomplete() {
            return null;
          },
          set onerror(f) {},
          get onerror() {
            return null;
          },
          set onabort(f) {},
          get onabort() {
            return null;
          },
        };
      },
    };
    queueMicrotask(() => r.onsuccess && r.onsuccess());
    return r;
  },
};

// ---- shared folder stub ---------------------------------------------------
const FOLDER = new Map();
let FAIL = false;
w.showDirectoryPicker = async () => ({
  name: "Case JSON Files",
  kind: "directory",
  queryPermission: async () => "granted",
  requestPermission: async () => "granted",
  async getFileHandle(name, opts) {
    if (FAIL) throw new Error("share unreachable");
    if (!FOLDER.has(name) && !(opts && opts.create)) throw new Error("missing");
    return {
      kind: "file",
      name,
      async createWritable() {
        let buf = "";
        return {
          async write(b) {
            buf += b;
          },
          async close() {
            FOLDER.set(name, buf);
          },
        };
      },
      async getFile() {
        return {
          size: (FOLDER.get(name) || "").length,
          lastModified: Date.now(),
          async text() {
            return FOLDER.get(name) || "";
          },
        };
      },
    };
  },
  async getDirectoryHandle() {
    return {
      async getFileHandle(name) {
        return {
          async createWritable() {
            return {
              async write(b) {
                FOLDER.set("Reporting Index/" + name, b);
              },
              async close() {},
            };
          },
        };
      },
    };
  },
  async *entries() {
    for (const k of FOLDER.keys())
      yield [
        k,
        {
          kind: "file",
          async getFile() {
            return { size: (FOLDER.get(k) || "").length, lastModified: Date.now() };
          },
        },
      ];
  },
});

// ---- helper POSTs ---------------------------------------------------------
const POSTS = [];
global.fetch = async (u, o) => {
  const s = String(u);
  if (s.indexOf("/dw-status") >= 0) return { ok: true, json: async () => ({ ok: true, out: "X", chrome: true, outlook: true }) };
  if (s.indexOf("/save-pdf") >= 0 || s.indexOf("/email") >= 0) {
    POSTS.push(Object.assign({ url: s }, JSON.parse(o.body)));
    return { ok: true, json: async () => ({ ok: true, name: "x.pdf", via: "outlook" }) };
  }
  throw 0;
};

Object.defineProperty(w.HTMLElement.prototype, "scrollHeight", {
  configurable: true,
  get() {
    return 0;
  },
});
Object.defineProperty(w.HTMLElement.prototype, "clientWidth", {
  configurable: true,
  get() {
    return 900;
  },
});

globalThis.MADISON_TEST_DATA = true;
const releaseChecks = async function () {
  // Schema 4 export fixture; R31 tests cover schema 5 helper-only writes.
  const legacyCaseFile = caseFile;
  caseFile = (cid) => ({ ...legacyCaseFile(cid), schema: 4 });

  const failures = [];
  function ok(label, value) {
    console.log((value ? "PASS " : "FAIL ") + label);
    if (!value) failures.push(label);
  }
  const delay = (ms) => new Promise((r) => setTimeout(r, ms));
  await delay(20);
  function fresh() {
    WriterState.DOCS = [];
    WriterState.REINSP = [];
    WriterState.EVENTS = {};
    WriterState.state.docId = null;
    WriterState.state.reinspId = null;
    WriterState.state.modal = null;
    WriterState.state.picker = false;
    WriterState.state.screen = "cases";
    WriterState.PENDING = [];
    FOLDER.clear();
    FAIL = false;
  }
  function notice() {
    newDoc("k1", "notice");
    const d = doc(WriterState.state.docId);
    d.items.push({
      id: uid("x"),
      no: "1",
      sections: ["27.05(2)(c)"],
      title: "Test",
      text: "Clean it.",
      due: futureDue(iso(today), 21),
      prov: "notice",
    });
    return d;
  }
  fresh();
  await linkCaseFolder();
  let rebuilt = 0;
  const oldRebuild = rebuildIndex;
  rebuildIndex = async () => {
    rebuilt++;
  };
  WriterState.state.modal = "storage";
  render();
  document.querySelector("#btn-reindex").click();
  ok("Rebuild index button reaches handler", rebuilt === 1);
  rebuildIndex = oldRebuild;
  fresh();
  let N = notice();
  const oldEvid = evid;
  let z = 0;
  evid = () => ["zz_notice", "aa_extension"][z++] || "ev_extra";
  issueDocument(N);
  newDoc("k1", "extension");
  let D = doc(WriterState.state.docId);
  D.items = clone(N.items);
  issueDocument(D);
  ok("Same-day documents stay in actual issue order", sourceDocFor("k1").id === D.id);
  evid = oldEvid;
  fresh();
  N = notice();
  issueDocument(N);
  startReinspection("k1");
  reinsp(WriterState.state.reinspId).time = "10:00";
  let r = reinsp(WriterState.state.reinspId),
    it = sourceDocFor("k1").items[0];
  r.inspectorId = "i2";
  r.results[it.id] = { oc: "none", on: r.date, due: futureDue(iso(today), 21), note: "", cite: false };
  render();
  let saved = 0;
  const oldSave = saveDrafts;
  saveDrafts = async () => {
    saved++;
    return true;
  };
  const note = document.querySelector("[data-rinote]");
  note.value = "Saved field note";
  note.dispatchEvent(new w.Event("input", { bubbles: true }));
  await delay(1650);
  ok("Reinspection notes autosave", saved > 0);
  saveDrafts = oldSave;
  docFromReinspection(r, "extension");
  D = doc(WriterState.state.docId);
  issueDocument(D);
  ok("Follow-up signs with the selected reinspection inspector", docInsp(doc(D.id)).id === "i2");
  const signed = document.createElement("div");
  signed.innerHTML = documentHTML(doc(D.id));
  ok("Printed signer name matches the frozen signer", signed.querySelector(".n-insp-name").textContent === insp("i2").name);
  ok("Invalid worksheet due date is rejected", !dueCheck("2026-02-31", iso(today)).ok);
  fresh();
  N = notice();
  N.mailed = "2026-02-31";
  ok(
    "Invalid mailed date cannot finalize",
    blockers(N).some((c) => /mail/i.test(c.t)),
  );
  N.mailed = iso(today);
  kase("k1").date = "";
  ok(
    "Initial inspection date is required",
    blockers(N).some((c) => /inspection date/i.test(c.t)),
  );
  kase("k1").date = iso(today);
  fresh();
  N = notice();
  issueDocument(N);
  const body = JSON.stringify(caseFile("k1")),
    name = caseFileName(kase("k1"));
  const more = JSON.parse(body);
  more.events.push({ id: "remote_event", at: new Date().toISOString(), type: "case.opened", payload: {}, by: "i1" });
  FOLDER.set(name, JSON.stringify(more));
  await queuePending(name, body, "k1");
  WriterState.CASES = WriterState.CASES.filter((k) => k.id !== "k1");
  WriterState.DOCS = [];
  WriterState.EVENTS = {};
  await flushPending();
  ok(
    "Queue after restart merges remote events",
    JSON.parse(FOLDER.get(name)).events.some((e) => e.id === "remote_event"),
  );
  ok("Queue after restart writes summary", !!WriterState.LASTINDEX && WriterState.LASTINDEX.ok);
  const before = FOLDER.get(name);
  FOLDER.set(name, "{broken JSON");
  await saveCaseFile(kase("k1").id || "k1");
  ok("Corrupt shared record is never overwritten", FOLDER.get(name) === "{broken JSON");
  FOLDER.set(name, before);
  const k = kase("k1");
  WriterState.PENDING = [];
  WriterState.DOCS = WriterState.DOCS.filter((d) => !d.draft);
  WriterState.REINSP = WriterState.REINSP.filter((r) => !r.draft);
  rememberSaved(k, caseFile(k.id));
  ok("Exact saved events are clean despite clock skew", !caseUnsaved(k));
  const former = k.owner;
  k.owner = "Locally changed owner";
  ok("Unwritten case details are marked unsafe to clear", !!caseUnsaved(k));
  k.owner = former;
  appendEvent(k.id, "case.opened", {}, "2000-01-01T00:00:00Z");
  ok("New event remains unsaved even with an old timestamp", !!caseUnsaved(k));
  const base = { id: k.id, number: k.number, owner: "Before", address: "Old" },
    local = { ...base, owner: "Local" },
    remote = { ...base, address: "Remote" };
  const combined = mergeCaseDetails(local, remote, base);
  ok("Disjoint case detail edits combine", combined.owner === "Local" && combined.address === "Remote");
  let conflict = false;
  try {
    mergeCaseDetails(local, { ...base, owner: "Other" }, base);
  } catch (e) {
    conflict = true;
  }
  ok("Conflicting case details remain visible", conflict);
  fresh();
  newDoc(k.id, "citation");
  let oldCitation = doc(WriterState.state.docId);
  oldCitation.items = [
    { id: uid("x"), no: "1", cite: true, sections: ["27.05(2)(c)"], title: "Prior test", text: "Test", due: futureDue(iso(today), 21) },
  ];
  oldCitation.mailed = iso(new Date(today.getFullYear() - 2, today.getMonth(), 1));
  issueDocument(oldCitation);
  ok("Expired citation does not escalate a current deposit", priorCitations(k.id, "1") === 0);
  newDoc(k.id, "citation");
  let recentCitation = doc(WriterState.state.docId);
  recentCitation.items = clone(oldCitation.items);
  recentCitation.mailed = iso(today);
  issueDocument(recentCitation);
  ok("Current citation is counted in the twelve-month window", priorCitations(k.id, "1") === 1);
  const pub = doc(recentCitation.id),
    addressBefore = k.address;
  k.address = "CHANGED AFTER ISSUANCE";
  ok(
    "Continuation headers keep the frozen property",
    contHead(pub).textContent.includes(addressBefore) && !contHead(pub).textContent.includes(k.address),
  );
  k.address = addressBefore;
  console.log("Release regressions: " + failures.length + " failure(s)");
  process.exit(failures.length ? 1 : 0);
};
eval(src + "\n;(" + releaseChecks.toString() + ")().catch(e=>{console.error(e);process.exit(1);});");
