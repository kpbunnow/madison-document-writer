/* Independent shell frame, browser printing, storage status and write-probe behavior. */
const assert = require("assert/strict"),
  fs = require("fs"),
  path = require("path"),
  acorn = require("acorn"),
  esbuild = require("esbuild"),
  { JSDOM } = require("jsdom");
const root = path.resolve(__dirname, "../.."),
  dir = path.join(root, "app/modules");
const specs = [
  ["workspaceShell", "workspace_shell", "createWorkspaceShell", ["app_savedworkContext", "navigation", "recordIntegrity"]],
  ["browserPrinting", "browser_printing", "createBrowserPrinting", ["Blob", "URL", "document", "setTimeout", "toast", "window"]],
  ["storageStatus", "storage_status", "createStorageStatus", ["CASEDIR_EXPECT", "FS_OK", "IDB_OK", "storageMode", "window"]],
  ["storageProbe", "storage_probe", "createStorageProbe", ["grantCaseFolder", "helperJSON", "render", "toast", "writeToFolder"]],
];
function walk(n, f) {
  if (!n || typeof n !== "object") return;
  if (Array.isArray(n)) return n.forEach((x) => walk(x, f));
  f(n);
  Object.values(n).forEach((x) => walk(x, f));
}
const parse = (file) => acorn.parse(fs.readFileSync(path.join(dir, file + ".js"), "utf8"), { ecmaVersion: 2022, sourceType: "module" });
const entries = parse("app_core").body.flatMap((n) => (n.declaration || n).declarations || []);
for (const [name, file, ctor, inputs] of specs) {
  const used = new Set();
  walk(parse(file), (n) => {
    if (n.type === "MemberExpression" && n.object.name === "services") used.add(n.property.name);
  });
  assert.deepEqual([...used].sort(), inputs);
  const entry = entries.find((n) => n.id.name === name);
  assert.equal(entry.init.callee.name, ctor);
  assert.deepEqual(entry.init.arguments[0].properties.map((p) => p.key.name).sort(), inputs);
  for (const p of entry.init.arguments[0].properties)
    assert.ok(p.kind === "get" || p.value.type === "ArrowFunctionExpression", "native/service inputs stay lazy");
  assert.ok(entries.indexOf(entry) > entries.findIndex((n) => n.id.name === "caseSummaryAdapter"));
  assert.ok(entries.indexOf(entry) < entries.findIndex((n) => n.id.name === "folderConnections"));
}
(async () => {
  const built = await esbuild.build({
    stdin: {
      contents: specs.map(([, f, c]) => `export {${c}} from './${f}.js';`).join("") + "export {WriterState} from './state.js';",
      resolveDir: dir,
    },
    bundle: true,
    format: "cjs",
    write: false,
    define: { __TEST_BUILD__: "false" },
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
  const { createWorkspaceShell, createBrowserPrinting, createStorageStatus, createStorageProbe, WriterState: s } = box.exports;
  assert.deepEqual(s, {});
  for (const [, , ctor] of specs) box.exports[ctor](new Proxy({}, { get: (_, k) => assert.fail("construction reads " + String(k)) }));
  s.state = { docId: "d" };
  s.DOCS = [{ id: "d", caseId: "c" }];
  s.CASES = [{ id: "c", number: 'BI<&"' }];
  const dom = new JSDOM(
    '<body><div class="desk"><div data-editor-extra-copy><input type="date" value="2026-10-27"><input class="hdr-time" type="time" value="09:30"><select><option>A</option><option selected>B &amp; C</option></select><b contenteditable="true">kept</b><button>Button</button><i class="no-print">removed</i><i class="grip">grip</i></div></div></body>',
  );
  let calls = [],
    timers = [],
    opened,
    openError = false,
    listenerError = false,
    printError = false;
  const viewer = {
    focus() {
      calls.push("focus");
    },
    print() {
      calls.push("print");
      if (printError) throw Error("print refused");
    },
    addEventListener(type, fn) {
      calls.push(type);
      if (listenerError) throw Error("listener refused");
      this.onload = fn;
    },
  };
  const native = {
    document: dom.window.document,
    Blob,
    URL: {
      createObjectURL(blob) {
        calls.push(["blob", blob]);
        return "blob:synthetic";
      },
      revokeObjectURL(url) {
        calls.push(["revoke", url]);
      },
    },
    window: {
      open(url, target) {
        calls.push(["open", url, target]);
        if (openError) throw Error("blocked");
        return opened;
      },
    },
    setTimeout(fn, ms) {
      timers.push([fn, ms]);
    },
    toast(msg) {
      calls.push(["toast", msg]);
    },
  };
  const printing = createBrowserPrinting(native),
    sheet = dom.window.document.querySelector(".desk"),
    before = sheet.outerHTML;
  const html = printing.printableHTML();
  assert.equal(sheet.outerHTML, before, "printing must only change a clone");
  const printed = new JSDOM(html).window.document;
  assert.equal(printed.title, 'BI<&"');
  assert.equal(printed.querySelectorAll("[data-editor-extra-copy],[contenteditable],input,select,button,.grip,.no-print").length, 0);
  assert.match(printed.body.textContent, /10\/27\/2026/);
  assert.match(printed.body.textContent, /9:30 AM/);
  assert.match(printed.body.textContent, /B & C/);
  assert.equal(printed.querySelector('[style="display: block;"]').textContent, " 9:30 AM");
  assert.match(html, /top:2in!important/);
  const custom = dom.window.document.createElement("div");
  custom.textContent = "override";
  assert.match(printing.printableHTML(s.DOCS[0], custom), /override/);
  sheet.remove();
  assert.equal(printing.printableHTML(), undefined);
  assert.equal(calls.at(-1)[1], "Nothing to print");
  s.state.docId = "missing";
  assert.equal(printing.printableHTML(), "");
  s.state.docId = "d";
  opened = viewer;
  calls = [];
  timers = [];
  printing.printNotice({ docId: "d", html: "<p>retained job</p>" });
  assert.equal(await calls[0][1].text(), "<p>retained job</p>");
  assert.equal(calls[0][1].type, "text/html");
  assert.deepEqual(calls[1], ["open", "blob:synthetic", "_blank"]);
  assert.deepEqual(
    timers.map((t) => t[1]),
    [1200, 60000],
  );
  viewer.onload();
  timers[0][0]();
  assert.equal(calls.filter((c) => c === "print").length, 1);
  timers[1][0]();
  assert.deepEqual(calls.at(-1), ["revoke", "blob:synthetic"]);
  calls = [];
  timers = [];
  listenerError = true;
  printError = true;
  assert.doesNotThrow(() => printing.printNotice({ html: "<p>fallback timer</p>" }));
  assert.doesNotThrow(() => timers[0][0]());
  listenerError = false;
  printError = false;
  for (const throws of [false, true]) {
    calls = [];
    timers = [];
    opened = null;
    openError = throws;
    let anchor;
    const create = native.document.createElement.bind(native.document);
    native.document.createElement = (tag) => {
      const el = create(tag);
      if (tag === "a") {
        anchor = el;
        el.click = () => calls.push(["download", el.download, el.isConnected]);
      }
      return el;
    };
    printing.printNotice({ html: "download bytes" });
    assert.deepEqual(
      calls.find((c) => Array.isArray(c) && c[0] === "download"),
      ["download", 'notice-BI<&".html', true],
    );
    assert.equal(anchor.isConnected, false);
    assert.deepEqual(
      timers.map((t) => t[1]),
      [60000],
    );
    native.document.createElement = create;
  }
  s.CASEDIR = null;
  s.HELPER = null;
  s.PENDING = [];
  s.LASTWRITE = null;
  s.LASTINDEX = null;
  let available = true,
    idb = false,
    origin = "file:",
    mode = "local<&";
  const status = createStorageStatus({
    get window() {
      return { location: { protocol: origin, origin: "https://synthetic" } };
    },
    get FS_OK() {
      return available;
    },
    get IDB_OK() {
      return idb;
    },
    CASEDIR_EXPECT: "Case JSON Files",
    storageMode: () => mode,
  });
  const rows = () =>
    [...new JSDOM(status.storageReport()).window.document.querySelectorAll("tr")].map((r) => [...r.querySelectorAll("td")].map((c) => c.textContent));
  assert.equal(rows().find((r) => r[0] === "Mode")[1], "local<&");
  assert.match(status.storageReport(), /local&lt;&amp;/);
  assert.match(rows().find((r) => r[0] === "Served from")[1], /a file path/);
  available = false;
  idb = true;
  origin = "https:";
  s.CASEDIR = {};
  s.DIRNAME = "different<&";
  s.NEEDGRANT = true;
  s.PENDING = [{ name: "a<&" }, { name: "b" }];
  s.LASTWRITE = { ok: false, name: "case<&", why: "refused<&", bytes: 12, at: "2026-10-27" };
  s.LASTINDEX = { ok: true, name: "summary<&", at: "2026-10-27" };
  assert.match(rows().find((r) => r[0] === "Case folder")[1], /expected "Case JSON Files"/);
  assert.equal(rows().find((r) => r[0] === "Folder permission")[1], "waiting for you to reconnect");
  assert.equal(rows().find((r) => r[0] === "Files waiting to write")[1], "2 (a<&, b)");
  assert.match(rows().find((r) => r[0] === "Last write")[1], /FAILED.*refused<&.*12 bytes/);
  s.HELPER = { caseStore: true, caseDir: "shared<&", chrome: true, out: "pdf<&", outlook: true };
  assert.equal(rows().find((r) => r[0] === "Case folder")[1], "shared<&");
  assert.equal(rows().find((r) => r[0] === "PDF helper")[1], "running, Chrome found");
  assert.equal(
    createStorageStatus({ window: undefined, storageMode: () => "", FS_OK: false, IDB_OK: false })
      .storageReport()
      .includes("unknown"),
    true,
  );
  assert.equal(status.reindexReport(), "");
  s.state.reindex = { running: true, done: 2, total: 3 };
  assert.match(status.reindexReport(), /2 of 3/);
  s.state.reindex = { running: false, written: 1, total: 1, refused: ["refused<&"], failed: ["failed<&"] };
  const report = status.reindexReport();
  assert.match(report, /banner warn/);
  assert.match(report, /1 of 1 case file summarized/);
  assert.ok(report.indexOf("refused&lt;&amp;") < report.indexOf("failed&lt;&amp;"));
  s.state.reindex = { running: false, written: 2, total: 2, refused: [], failed: [] };
  assert.match(status.reindexReport(), /banner ok/);
  let rail = "rail",
    banner = "banner",
    context = {
      storageMode: () => "local",
      HELPER: null,
      CASEDIR: null,
      FS_OK: false,
      IDB_OK: false,
      PENDING: [],
      LOCAL_SAVE: { ok: true },
      state: {},
      CASES: [],
      DOCS: [],
    };
  calls = [];
  const frame = createWorkspaceShell({
    get navigation() {
      return {
        rail: () => {
          calls.push("rail");
          return rail;
        },
      };
    },
    get recordIntegrity() {
      return {
        banner: () => {
          calls.push("integrity");
          return banner;
        },
      };
    },
    app_savedworkContext: () => {
      calls.push("context");
      return context;
    },
  });
  const rendered = frame.shell("title<&", "crumb<&", "<button>action</button>", "<main>body</main>");
  assert.deepEqual(calls, ["rail", "integrity", "context"]);
  assert.match(rendered, /title&lt;&amp;/);
  assert.match(rendered, /class="writer-navigation" aria-label="Main navigation"/);
  assert.match(rendered, /crumb&lt;&amp;/);
  assert.match(rendered, /<button>action<\/button>/);
  assert.match(rendered, /<main>body<\/main>/);
  rail = "changed";
  banner = "new banner";
  assert.match(frame.shell("", "", "", ""), /changed/);
  assert.match(frame.shell("", "", "", ""), /new banner/);
  calls = [];
  let grantError = false,
    helperError = false,
    writeError = false,
    writeResult = { ok: false, why: "write denied" },
    release;
  const probe = createStorageProbe({
    toast: (m) => calls.push(["toast", m]),
    grantCaseFolder: async (quiet) => {
      calls.push(["grant", quiet]);
      if (grantError) throw Error("grant failed");
      await new Promise((r) => (release = r));
    },
    helperJSON: async (...a) => {
      calls.push(["helper", ...a]);
      if (helperError) throw Error("probe denied");
    },
    writeToFolder: async (...a) => {
      calls.push(["write", ...a]);
      if (writeError) throw Error("write rejected");
      return writeResult;
    },
    render: () => calls.push(["render"]),
  });
  s.CASEDIR = null;
  await probe.testWrite();
  assert.deepEqual(calls, [["toast", "Link the case folder first"]]);
  calls = [];
  s.CASEDIR = { helper: true };
  s.NEEDGRANT = true;
  const pending = probe.testWrite();
  assert.deepEqual(calls, [["grant", true]]);
  release();
  await pending;
  assert.deepEqual(calls.slice(1), [["helper", "/cases/probe", {}], ["toast", "The shared case folder is writable"], ["render"]]);
  calls = [];
  s.NEEDGRANT = false;
  helperError = true;
  await probe.testWrite();
  assert.deepEqual(calls.slice(-2), [["toast", "Test write FAILED — probe denied"], ["render"]]);
  calls = [];
  s.CASEDIR = {};
  await probe.testWrite();
  assert.equal(calls[0][1], "_write-test.json");
  assert.equal(JSON.parse(calls[0][2]).test, true);
  assert.ok(Number.isFinite(Date.parse(JSON.parse(calls[0][2]).at)));
  assert.deepEqual(calls.slice(1), [["toast", "Test write FAILED — write denied"], ["render"]]);
  calls = [];
  writeResult = { ok: true };
  s.DIRNAME = "native folder";
  await probe.testWrite();
  assert.deepEqual(calls.slice(1), [["toast", "Test file written to native folder — look for _write-test.json"], ["render"]]);
  calls = [];
  writeError = true;
  await assert.rejects(probe.testWrite(), /write rejected/);
  assert.equal(calls.length, 1);
  calls = [];
  s.NEEDGRANT = true;
  grantError = true;
  await assert.rejects(probe.testWrite(), /grant failed/);
  assert.deepEqual(calls, [["grant", true]]);
  console.log(
    JSON.stringify({
      passed: true,
      inertConstruction: true,
      printCloneAndValues: true,
      popupTimerAndDownload: true,
      liveEscapedStatus: true,
      frameOrder: true,
      probeOrderingAndErrors: true,
    }),
  );
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
