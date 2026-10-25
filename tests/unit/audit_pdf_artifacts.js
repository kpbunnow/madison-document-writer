/* Retained PDF operations preserve synchronous popups, stale-response and identity boundaries. */
const assert = require("assert/strict"),
  fs = require("fs"),
  path = require("path"),
  acorn = require("acorn"),
  esbuild = require("esbuild"),
  { JSDOM } = require("jsdom");
const root = path.resolve(__dirname, "../.."),
  directory = path.join(root, "app/modules");
const parse = (name) => acorn.parse(fs.readFileSync(path.join(directory, name + ".js"), "utf8"), { ecmaVersion: 2022, sourceType: "module" });
function walk(node, visit) {
  if (!node || typeof node !== "object") return;
  if (Array.isArray(node)) return node.forEach((n) => walk(n, visit));
  visit(node);
  Object.values(node).forEach((n) => walk(n, visit));
}
const required = new Set();
walk(parse("pdf_artifacts"), (node) => {
  if (node.type === "MemberExpression" && node.object.name === "services") {
    assert.equal(node.computed, false);
    required.add(node.property.name);
  }
});
assert.deepEqual([...required].sort(), ["A11Y", "helperJSON", "navigation", "render", "toast"]);
const declarations = parse("app_core").body.flatMap((n) => (n.declaration || n).declarations || []),
  construction = declarations.find((n) => n.id.name === "pdfArtifacts");
assert.equal(construction.init.callee.name, "createPdfArtifacts");
assert.ok(declarations.indexOf(construction) > declarations.findIndex((n) => n.id.name === "caseActivity"));
assert.ok(declarations.indexOf(construction) < declarations.findIndex((n) => n.id.name === "documentRenderer"));
assert.equal(construction.init.arguments.length, 1);
const properties = construction.init.arguments[0].properties;
assert.deepEqual(new Set(properties.map((p) => p.key.name)), required);
for (const p of properties) {
  assert.equal(p.type, "Property", "no registry or shared-service spread");
  if (p.kind === "get") {
    assert.equal(p.value.body.body.length, 1);
    assert.equal(p.value.body.body[0].argument.name, p.key.name);
  } else {
    assert.equal(p.value.type, "ArrowFunctionExpression");
    assert.equal(p.value.body.type, "CallExpression");
    assert.equal(p.value.body.callee.name, p.key.name);
  }
}
const tick = () => new Promise((resolve) => setImmediate(resolve));
const deferred = () => {
  let resolve;
  const promise = new Promise((r) => (resolve = r));
  return { promise, resolve };
};
(async () => {
  const built = await esbuild.build({
    stdin: { contents: "export * from './pdf_artifacts.js'; export {WriterState} from './state.js';", resolveDir: directory },
    define: { __TEST_BUILD__: "false" },
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
  const { createPdfArtifacts, pdfTransferState, independentArtifact, WriterState: state } = box.exports;
  assert.deepEqual(state, {});
  createPdfArtifacts(new Proxy({}, { get: (_, k) => assert.fail("premature dependency: " + String(k)) }));
  assert.deepEqual(state, {}, "loading/construction requires no Writer startup, DOM or live state");
  const dom = new JSDOM('<!doctype html><meta name="docwriter-token" content="synthetic-session"><body></body>');
  global.document = dom.window.document;
  let context = 0,
    helper = async () => assert.fail("unexpected helper request"),
    calls = [];
  const api = createPdfArtifacts({
    navigation: { utilityContext: () => ++context, utilityCurrent: (value) => value === context },
    A11Y: { utility: (title, html) => calls.push({ title, html }) },
    helperJSON: (...args) => helper(...args),
    render: () => calls.push("render"),
    toast: (...args) => calls.push(args),
  });
  Object.assign(state, {
    HELPER: { outbox: 9 },
    OUTBOX_FILES: [],
    DOCS: [],
    ARTIFACT_SEQ: 0,
    ARTIFACT_LOCATIONS: {},
    ARTIFACT_IDENTITY: {},
    ARTIFACT_VERIFY: {},
    state: { screen: "cases" },
  });
  const old = deferred(),
    fresh = [{ name: '<original & "one">.pdf', sha256: "a".repeat(64), size: 123 }];
  helper = () => old.promise;
  const staleList = api.showOutbox();
  helper = async () => ({ files: fresh });
  await api.showOutbox();
  old.resolve({ files: [{ name: "stale.pdf" }] });
  assert.equal(await staleList, false);
  assert.equal(state.OUTBOX_FILES, fresh);
  assert.equal(state.HELPER.outbox, 1);
  assert.equal(calls.length, 1, "stale utility response neither renders nor replaces the count/list");
  assert.ok(calls[0].html.includes("&lt;original &amp; &quot;one&quot;&gt;.pdf"));

  const artifact = (id, extra = {}) => ({
    id,
    draft: false,
    filedAt: "2026-10-25",
    filedArtifact: { filename: id + ".pdf", sha256: "a".repeat(64) },
    ...extra,
  });
  const identity = (d) => d.filedArtifact.filename + "|" + d.filedArtifact.sha256;
  const d = artifact("a");
  state.DOCS = [d, artifact("draft", { draft: true })];
  state.ARTIFACT_LOCATIONS = { removed: ["shared"] };
  state.ARTIFACT_IDENTITY = { removed: "old" };
  const first = deferred();
  helper = () => first.promise;
  const staleLocations = api.refreshArtifactLocations();
  helper = async () => ({ items: [{ docId: "a", sha256: d.filedArtifact.sha256, locations: ["shared"] }] });
  await api.refreshArtifactLocations();
  first.resolve({ items: [{ docId: "a", locations: ["local"] }] });
  await staleLocations;
  assert.deepEqual(state.ARTIFACT_LOCATIONS, { a: ["shared"] });
  assert.equal(pdfTransferState(d), "shared");
  const pending = deferred();
  helper = () => pending.promise;
  const changing = api.refreshArtifactLocations();
  state.DOCS = [artifact("a", { filedArtifact: { filename: "changed.pdf", sha256: "b".repeat(64) } })];
  pending.resolve({ items: [{ docId: "a", locations: ["shared"] }] });
  await changing;
  assert.equal(state.ARTIFACT_LOCATIONS.a, undefined, "a response cannot verify a replaced artifact identity");
  assert.equal(state.ARTIFACT_IDENTITY.a, undefined);
  assert.equal(state.ARTIFACT_VERIFY.a, "incomplete");
  assert.equal(pdfTransferState(state.DOCS[0]), "location verification unavailable");
  state.DOCS = [d, artifact("bad"), artifact("missing")];
  const batches = [];
  helper = async (url, body) => {
    assert.equal(url, "/artifact/status");
    batches.push(body.items.map((x) => x.docId));
    if (body.items.some((x) => x.docId === "bad")) throw Error("Invalid artifact filename");
    return { items: body.items.filter((x) => x.docId !== "missing").map((x) => ({ docId: x.docId, locations: ["local"] })) };
  };
  await api.refreshArtifactLocations();
  assert.deepEqual(state.ARTIFACT_VERIFY, { a: "verified", bad: "invalid", missing: "incomplete" });
  assert.ok(
    batches.some((b) => b.length === 1 && b[0] === "bad"),
    "isolate bad identities without discarding valid siblings",
  );
  helper = async () => {
    throw Error("Storage unavailable");
  };
  await api.refreshArtifactLocations();
  assert.deepEqual(state.ARTIFACT_LOCATIONS.a, ["local"]);
  assert.equal(pdfTransferState(d), "last verified location; refresh unavailable");
  state.ARTIFACT_IDENTITY.a = "different";
  assert.equal(pdfTransferState(d), "location unverified");
  state.HELPER = null;
  state.DOCS = [d];
  await api.refreshArtifactLocations();
  assert.equal(state.ARTIFACT_VERIFY.a, "unavailable");
  const included = { type: "notice", authoringVersion: 11, issuanceGroup: { citationId: "c" } };
  assert.equal(independentArtifact(included), false);
  assert.equal(pdfTransferState(included), "included in citation PDF");
  for (const flags of [{ draft: true }, { void: true }, { superseded: true }]) assert.equal(independentArtifact({ ...d, ...flags }), false);
  assert.equal(independentArtifact(d), true);
  state.ARTIFACT_IDENTITY.a = identity(d);

  // Real authenticated transport, synthetic retained bytes, controlled browser popup/timer adapters.
  const saved = { window: global.window, fetch: global.fetch, URL: global.URL, setTimeout: global.setTimeout };
  const timers = [],
    popupEvents = [],
    requests = [],
    downloads = [];
  let loads,
    fetchReply,
    urlSerial = 0;
  const viewer = {
    closed: false,
    location: {},
    addEventListener: (type, fn, options) => (loads = { type, fn, options }),
    focus: () => popupEvents.push("focus"),
    print: () => popupEvents.push("print"),
    close: () => popupEvents.push("close"),
  };
  const select = (count) => {
    state.OUTBOX_FILES = Array.from({ length: count }, (_, n) => ({ name: "retained" + n + ".pdf", sha256: String(n).repeat(64), size: 123 }));
    document.body.innerHTML =
      '<form id="outbox-form">' +
      state.OUTBOX_FILES.map((_, n) => '<input name="pdf" type="checkbox" checked value="' + n + '">').join("") +
      "</form>";
  };
  try {
    global.window = {
      open: () => {
        popupEvents.push("open");
        return popupEvents.length === 1 ? viewer : null;
      },
    };
    global.fetch = async (url, options) => {
      popupEvents.push("fetch");
      requests.push({ url, identity: JSON.parse(options.body), token: options.headers.get("X-DocWriter-Token") });
      return await fetchReply();
    };
    global.URL = { createObjectURL: () => "blob:retained-" + ++urlSerial, revokeObjectURL: (url) => popupEvents.push("revoke " + url) };
    global.setTimeout = (fn, ms) => timers.push({ fn, ms });
    dom.window.HTMLAnchorElement.prototype.click = function () {
      downloads.push({ name: this.download, href: this.href });
    };
    select(2);
    const selected = api.selectedOutbox(),
      response = deferred();
    assert.deepEqual(Object.keys(selected[0]), ["name", "sha256"]);
    fetchReply = () => response.promise;
    const printing = api.printOutbox();
    await tick();
    assert.deepEqual(popupEvents, ["open", "open", "fetch"], "open every viewer synchronously before waiting for retained bytes");
    state.OUTBOX_FILES = [];
    response.resolve({ ok: true, status: 200, blob: async () => ({ retained: true }) });
    await printing;
    assert.deepEqual(
      requests.map((r) => r.identity),
      selected,
      "printing keeps the original selection despite later list replacement",
    );
    assert.ok(requests.every((r) => r.url === "/outbox/read" && r.token === "synthetic-session"));
    assert.deepEqual(downloads, [{ name: "retained1.pdf", href: "blob:retained-2" }]);
    assert.deepEqual([loads.type, loads.options.once], ["load", true]);
    loads.fn();
    timers.find((t) => t.ms === 1200).fn();
    assert.deepEqual(popupEvents.slice(-2), ["focus", "print"]);
    assert.equal(timers.filter((t) => t.ms === 120000).length, 2, "retain object-URL lifetime");
    for (const t of timers.filter((t) => t.ms === 120000)) t.fn();
    select(1);
    global.window.open = () => viewer;
    fetchReply = async () => ({ ok: false, status: 500, json: async () => ({ error: "Retained bytes unavailable" }) });
    await assert.rejects(api.printOutbox(), /Retained bytes unavailable/);
    assert.equal(popupEvents.at(-1), "close");
    for (const count of [0, 21]) {
      select(count);
      global.window.open = () => assert.fail("invalid selection opened a popup");
      await assert.rejects(api.printOutbox(), /Select 1–20/);
    }
  } finally {
    Object.assign(global, saved);
    dom.window.close();
  }
  console.log(JSON.stringify({ passed: true, boundedDependencies: 5, staleIdentityGuards: true, synchronousRetainedPdfPrinting: true }));
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
