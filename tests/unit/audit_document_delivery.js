const { serviceComposition } = require("../fixtures/deferred_service_syntax.cjs");
/* Isolated fixed-layout packet preparation and archived original/email/filing coordination. */
const assert = require("assert/strict"),
  fs = require("fs"),
  path = require("path"),
  acorn = require("acorn"),
  esbuild = require("esbuild"),
  { JSDOM } = require("jsdom");
const root = path.resolve(__dirname, "../.."),
  dir = path.join(root, "app/modules"),
  parse = (n) => acorn.parse(fs.readFileSync(path.join(dir, n + ".js"), "utf8"), { ecmaVersion: 2022, sourceType: "module" });
function walk(n, f) {
  if (!n || typeof n !== "object") return;
  if (Array.isArray(n)) return n.forEach((c) => walk(c, f));
  f(n);
  Object.values(n).forEach((c) => walk(c, f));
}
const defs = {
  documentPrinting: [
    "document_printing",
    "createDocumentPrinting",
    ["fmtDate", "today", "document", "citationDepositFault", "documentHTML", "snow", "printableHTML", "paginate"],
  ],
  documentDelivery: [
    "document_delivery",
    "createDocumentDelivery",
    [
      "authFetch",
      "fmtDate",
      "today",
      "toast",
      "toastHold",
      "render",
      "documentFileName",
      "printJob",
      "document",
      "window",
      "URL",
      "Blob",
      "atob",
      "setTimeout",
      "confirm",
      "printNotice",
      "recordIntegrity",
      "appendEvent",
      "saveCaseFile",
      "refreshArtifactLocations",
    ],
  ],
};
const entries = parse("app_core").body.flatMap((n) => (n.declaration || n).declarations || []);
let previous = entries.findIndex((n) => n.id.name === "visitRecording");
for (const [name, [file, ctor, fields]] of Object.entries(defs)) {
  const used = new Set();
  walk(parse(file), (n) => {
    if (n.type === "MemberExpression" && n.object.name === "services") {
      assert.equal(n.computed, false);
      used.add(n.property.name);
    }
  });
  assert.deepEqual([...used].sort(), fields.slice().sort());
  const e = entries.find((n) => n.id.name === name);
  assert.equal(e.init.callee.name, ctor);
  assert.deepEqual(new Set(serviceComposition(e.init.arguments[0]).properties.map((p) => p.key.name)), used);
  assert.ok(entries.indexOf(e) > previous);
  assert.ok(entries.indexOf(e) < entries.findIndex((n) => n.id.name === "documentRenderer"));
  previous = entries.indexOf(e);
  for (const p of serviceComposition(e.init.arguments[0]).properties) {
    if (p.kind === "get") assert.equal(p.value.body.body[0].argument.name, p.key.name);
    else {
      assert.equal(p.value.type, "ArrowFunctionExpression");
      assert.equal(p.value.body.callee.name, p.key.name);
    }
  }
}
const copy = (v) => JSON.parse(JSON.stringify(v));
(async () => {
  const built = await esbuild.build({
    stdin: {
      contents:
        "export {createDocumentPrinting} from './document_printing.js'; export {createDocumentDelivery} from './document_delivery.js'; export {WriterState} from './state.js'; export {CIT_COPIES} from './document_types.js';",
      resolveDir: dir,
    },
    bundle: true,
    format: "cjs",
    write: false,
    plugins: [
      {
        name: "data",
        setup(b) {
          b.onResolve({ filter: /\/data\// }, (a) => ({ path: path.join(root, "build/generated/modules/data", path.basename(a.path)) }));
        },
      },
    ],
  });
  const box = { exports: {} };
  new Function("module", "exports", built.outputFiles[0].text)(box, box.exports);
  const { createDocumentPrinting, createDocumentDelivery, WriterState: s, CIT_COPIES } = box.exports;
  assert.deepEqual(s, {});
  for (const c of [createDocumentPrinting, createDocumentDelivery]) c(new Proxy({}, { get: (_, k) => assert.fail("premature " + String(k)) }));
  assert.deepEqual(s, {});
  const dom = new JSDOM("<style>.desk{width:1000px}</style><body></body>");
  let calls, day, d, reply, networkError, popup, confirmCopy, depositFault, faces, snowMode;
  const printing = createDocumentPrinting({
    fmtDate: (v) => "date/" + v,
    get today() {
      return day;
    },
    get document() {
      return dom.window.document;
    },
    citationDepositFault: () => depositFault,
    documentHTML(doc) {
      calls.push("render-document");
      if (doc.type !== "citation")
        return '<article>Retained content<span class="affected-pick">screen only</span><span class="due-pick">selection</span></article>';
      return CIT_COPIES.slice(0, faces)
        .map(
          (c) => '<div class="cit"><span class="cit-no">C1</span><div class="cit-foot"><span>footer</span><span>' + c.label + "</span></div></div>",
        )
        .join("");
    },
    get snow() {
      return { is: () => snowMode };
    },
    printableHTML(doc, stage) {
      calls.push("printable");
      const printable = stage.cloneNode(true);
      printable.querySelectorAll(".affected-pick,.due-pick").forEach((n) => n.remove());
      return '<html><body><div class="desk">' + printable.innerHTML + "</div></body></html>";
    },
    paginate(stage) {
      calls.push("paginate");
      assert.equal(stage.querySelector(".affected-pick,.due-pick"), null);
    },
  });
  const delivery = createDocumentDelivery({
    async authFetch(url, options) {
      calls.push(["request", url, options?.body ? JSON.parse(options.body) : options]);
      if (networkError) throw Error("offline");
      if (url !== "/dw-status") assert.ok(s.FILING_ACTIVE > 0 || url === "/artifact/read");
      return { ok: reply.httpOK !== false, json: async () => reply };
    },
    fmtDate: (v) => "date:" + v,
    get today() {
      return day;
    },
    toast: (t) => calls.push(["toast", t]),
    toastHold: (t) => calls.push(["hold", t]),
    render: () => calls.push("render"),
    documentFileName: (...a) => printing.documentFileName(...a),
    printJob(doc) {
      calls.push("fallback-print");
      return { docId: doc.id, name: "reconstructed.pdf", html: "<body>saved facts</body>" };
    },
    get document() {
      return {
        body: dom.window.document.body,
        createElement(tag) {
          const el = dom.window.document.createElement(tag);
          el.click = () => calls.push(["download", el.download]);
          return el;
        },
      };
    },
    get window() {
      return {
        open(url, target) {
          calls.push(["open", url, target]);
          return popup ? {} : null;
        },
      };
    },
    get URL() {
      return {
        createObjectURL(blob) {
          assert.equal(blob.type, "application/pdf");
          calls.push("blob");
          return "blob:synthetic";
        },
        revokeObjectURL(url) {
          calls.push(["revoke", url]);
        },
      };
    },
    get Blob() {
      return Blob;
    },
    atob: (v) => Buffer.from(v, "base64").toString("binary"),
    setTimeout(fn, ms) {
      calls.push(["timer", ms]);
      assert.equal(ms, 300000);
      fn();
    },
    confirm(text) {
      calls.push(["confirm", text]);
      return confirmCopy;
    },
    printNotice: (job) => calls.push(["reconstructed", job.html]),
    get recordIntegrity() {
      return {
        async sourceHash(snapshot) {
          calls.push(["hash", snapshot.id]);
          return "source-hash";
        },
      };
    },
    appendEvent(cid, type, payload) {
      calls.push(["append", type, copy(payload)]);
      const e = { id: "file-event", at: "2026-10-20T12:01:00Z", type, payload };
      s.EVENTS[cid].push(e);
    },
    async saveCaseFile(cid) {
      calls.push(["save", cid]);
      return true;
    },
    async refreshArtifactLocations() {
      calls.push("refresh");
    },
  });
  function reset() {
    calls = [];
    day = "2026-10-26";
    reply = {
      ok: true,
      name: "original.pdf",
      sha256: "hash",
      path: "synthetic",
      via: "outlook",
      pdf: Buffer.from("%PDF synthetic").toString("base64"),
    };
    networkError = false;
    popup = true;
    confirmCopy = false;
    depositFault = "";
    faces = 4;
    snowMode = false;
    d = {
      id: "issued",
      caseId: "one",
      type: "notice",
      authoringVersion: 16,
      mailed: "2026-10-20",
      items: [],
      frozen: {
        case: { id: "one", number: "ORIGINAL", address: "1 ORIGINAL ST" },
        inspector: { name: "Original inspector", email: "inspector@example.test" },
      },
    };
    Object.assign(s, {
      CASES: [{ id: "one", number: "LIVE", address: "2 LIVE ST", emails: [{ addr: "to@example.test", kind: "Owner" }] }],
      DOCS: [d],
      REINSP: [],
      EVENTS: { one: [{ id: "issued-event", at: "2026-10-20T12:00:00Z", type: "notice.issued", payload: { snapshot: copy(d) } }] },
      HELPER: { chrome: true, outbox: 0 },
      FILING_ACTIVE: 0,
      state: { docId: d.id, modal: null },
    });
  }
  function archived() {
    s.EVENTS.one.push({
      id: "receipt",
      at: "2026-10-20T12:01:00Z",
      type: "document.filed",
      payload: { docId: d.id, filename: "archived.pdf", sha256: "archived-hash" },
    });
  }
  reset();
  const name = printing.documentFileName(d);
  assert.ok(name.startsWith("1 ORIGINAL ST - ORIGINAL"));
  s.CASES[0].address = "CHANGED";
  assert.equal(printing.documentFileName(d), name);
  assert.notEqual(printing.documentFileName({ ...d, id: "different" }), name);
  assert.match(printing.documentFileName({ ...d, void: true }), /^VOID - /);
  assert.equal(printing.printJob(null), null);
  let job = printing.printJob(d);
  assert.equal(job.docId, d.id);
  assert.equal(job.html.includes("screen only"), false);
  assert.deepEqual(calls, ["render-document", "paginate", "printable"]);
  assert.equal(dom.window.document.querySelectorAll("iframe").length, 0);
  reset();
  d.type = "citation";
  d.draft = true;
  d.items = [{ id: "charge", cite: true }];
  d.cits = { charge: { num: "C1", mandatoryAppearance: true } };
  assert.throws(() => printing.printJob(d), /Mandatory-appearance/);
  d.cits.charge.mandatoryAppearance = false;
  depositFault = "unconfirmed";
  assert.throws(() => printing.printJob(d), /confirm every citation deposit/);
  depositFault = "";
  faces = 3;
  assert.throws(() => printing.printJob(d), /packet is incomplete/);
  assert.equal(dom.window.document.querySelectorAll("iframe").length, 0);
  faces = 4;
  job = printing.printJob(d);
  assert.equal(new JSDOM(job.html).window.document.querySelectorAll(".cit").length, 4);
  reset();
  snowMode = true;
  job = printing.printJob(d);
  assert.deepEqual(calls, ["render-document", "printable", "paginate"]);
  assert.match(job.html, /<!doctype html>/);
  reset();
  reply = { chrome: true };
  assert.deepEqual(await delivery.checkHelper(), { chrome: true });
  reply = { httpOK: false };
  assert.equal(await delivery.checkHelper(), null);
  networkError = true;
  assert.equal(await delivery.checkHelper(), null);
  reset();
  assert.equal(await delivery.emailDocument({ ...d, draft: true }, []), false);
  assert.equal(await delivery.emailDocument(d, []), false);
  assert.equal(
    calls.some((c) => Array.isArray(c) && c[0] === "request"),
    false,
  );
  archived();
  calls = [];
  assert.equal(await delivery.emailDocument(d), false);
  assert.equal(s.state.modal, "sendto");
  assert.equal(s.state.sendJob.name, "archived.pdf");
  assert.equal(calls.at(-1), "render");
  calls = [];
  const before = copy(d);
  assert.equal(await delivery.emailDocument(d, [{ addr: "to@example.test" }], false, { docId: "wrong", name: "wrong.pdf", html: "wrong" }), true);
  const email = calls.find((c) => Array.isArray(c) && c[1] === "/email")[2];
  assert.equal(email.filename, "archived.pdf");
  assert.equal(email.sha256, "archived-hash");
  assert.equal(email.html, "");
  assert.equal(email.reuse, true);
  assert.equal(email.docId, d.id);
  assert.equal(email.to, "to@example.test");
  assert.match(email.subject, /1 ORIGINAL ST/);
  assert.match(email.body, /Case number: ORIGINAL/);
  assert.deepEqual(d, before);
  assert.equal(s.FILING_ACTIVE, 0);
  networkError = true;
  assert.equal(await delivery.emailDocument(d, []), false);
  assert.equal(s.FILING_ACTIVE, 0);
  reset();
  archived();
  assert.equal(await delivery.openIssuedCopy(d), true);
  assert.ok(calls.some((c) => Array.isArray(c) && c[0] === "timer"));
  assert.equal(calls.includes("fallback-print"), false);
  reset();
  archived();
  popup = false;
  assert.equal(await delivery.openIssuedCopy(d), true);
  assert.ok(calls.some((c) => Array.isArray(c) && c[0] === "download" && c[1] === "archived.pdf"));
  reset();
  confirmCopy = false;
  assert.equal(await delivery.openIssuedCopy(d), false);
  assert.equal(calls.includes("fallback-print"), false);
  confirmCopy = true;
  assert.equal(await delivery.openIssuedCopy(d), false);
  assert.match(calls.find((c) => Array.isArray(c) && c[0] === "reconstructed")[1], /RECONSTRUCTED COPY — NOT VERIFIED ORIGINAL/);
  reset();
  const retainedJob = { docId: d.id, name: "original.pdf", html: "<body>retained PDF input</body>" };
  assert.equal(await delivery.filePdf(d, retainedJob), true);
  const request = calls.find((c) => Array.isArray(c) && c[1] === "/save-pdf")[2];
  assert.deepEqual(request.operation, { caseId: "one", caseNumber: "ORIGINAL", docId: d.id, version: "source-hash" });
  assert.equal(request.html, retainedJob.html);
  assert.equal(s.FILING_ACTIVE, 0);
  assert.equal(calls.filter((c) => Array.isArray(c) && c[0] === "append").length, 1);
  assert.deepEqual(calls.slice(-2), [["save", "one"], "refresh"]);
  await delivery.filePdf(d, retainedJob);
  assert.equal(calls.filter((c) => Array.isArray(c) && c[0] === "append").length, 1);
  assert.equal(calls.filter((c) => Array.isArray(c) && c[0] === "save").length, 2);
  reset();
  reply.local = true;
  await delivery.filePdf(d, retainedJob);
  assert.equal(s.HELPER.outbox, 1);
  assert.equal(s.FILING_ACTIVE, 0);
  reset();
  networkError = true;
  assert.equal(await delivery.filePdf(d, retainedJob), false);
  assert.equal(s.FILING_ACTIVE, 0);
  assert.match(calls.at(-1)[1], /response is uncertain/);
  assert.equal(
    calls.some((c) => Array.isArray(c) && c[0] === "append"),
    false,
  );
  reset();
  s.EVENTS.one = [];
  await assert.rejects(delivery.filePdf(d, retainedJob), /Save the issued document/);
  assert.equal(s.FILING_ACTIVE, 0);
  reset();
  s.HELPER = null;
  assert.equal(await delivery.filePdf(d, retainedJob), false);
  dom.window.close();
  console.log(
    JSON.stringify({
      passed: true,
      printingInputs: 8,
      deliveryInputs: 20,
      inertConstruction: true,
      packetAndFrameGuards: true,
      archivedByteReuse: true,
      snapshotBoundFiling: true,
      receiptDeduplication: true,
      counterCleanup: true,
    }),
  );
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
