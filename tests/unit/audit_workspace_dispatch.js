const { withHistoricalState } = require("../fixtures/historical_module_scope.cjs");
/* First-match dispatch, synchronous permission calls, return values and state must match the original listener. */
const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path"),
  esbuild = require("esbuild"),
  fc = require("fast-check");
(async () => {
  const dir = path.resolve("app/modules"),
    source = fs.readFileSync(path.join(dir, "workspace_events.js"), "utf8"),
    reference = require("../fixtures/workspace_click_reference.cjs");
  const compiled = await esbuild.build({
    stdin: {
      contents:
        withHistoricalState(source) + "\nexport function legacy(services){return (" + reference + ');}export {WriterState} from "./state.js";',
      resolveDir: dir,
    },
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
  let calls = [],
    flags = {},
    toast = { innerHTML: "" };
  const document = {
    getElementById: (id) => {
      calls.push(["native-element", id]);
      return id === "toast" ? toast : { close: () => calls.push("close-dialog") };
    },
  };
  const box = { exports: {} };
  new Function("document", "confirm", "module", "exports", compiled.outputFiles[0].text)(
    document,
    (message) => {
      calls.push(["confirm", message]);
      return flags.confirm;
    },
    box,
    box.exports,
  );
  const { createWorkspaceEvents, legacy, WriterState: s } = box.exports;
  const services = new Proxy(
    {},
    {
      get(_, key) {
        calls.push(["get", key]);
        if (key.endsWith("Events") || key === "navigation")
          return new Proxy(
            {},
            {
              get(_, method) {
                calls.push(["peer", key, method]);
                return (...args) => {
                  calls.push(["call", key, method, args.map((a) => a?.id || a)]);
                  return key === "navigation" ? Promise.resolve("ignored") : key + "." + method;
                };
              },
            },
          );
        return (...args) => {
          calls.push(["call", key, args.map((a) => a?.id || a)]);
          switch (key) {
            case "storageMode":
              return flags.folder ? "folder" : "device";
            case "listCaseFolder":
              return Promise.resolve([]);
            case "grantCaseFolder":
              return Promise.resolve(flags.grant);
            case "flushPending":
              return Promise.resolve();
            case "caseNumberAllowed":
              return flags.allowed;
            case "caseFileName":
              return "case.json";
            case "caseFile":
              return { case: { id: "c" } };
            case "caseUnsaved":
              return flags.risky ? "unfinished work" : "";
            case "removeCase":
              return flags.remove;
            default:
              return undefined;
          }
        };
      },
    },
  );
  let actual;
  createWorkspaceEvents(services).registerWorkspaceClicks({ addEventListener: (type, fn) => (actual = fn) });
  const old = legacy(services);
  const reset = () => {
    for (const key of Object.keys(s)) delete s[key];
    Object.assign(s, {
      state: { screen: "write", docId: "d", modal: null, acc: {}, publicationBusy: flags.busy ? "other" : "" },
      DOCS: [
        { id: "d", caseId: "c" },
        { id: "other", caseId: "c" },
      ],
      CASES: [{ id: "c", number: "TEST-1" }],
      CASEDIR: flags.folder ? {} : null,
      NEEDGRANT: flags.grant,
      LOOKUP_BUSY: flags.busy,
      undoFn: () => calls.push("undo"),
    });
    toast = { innerHTML: "undo" };
  };
  let checked = 0;
  async function compare(id, dataset, attrs = []) {
    const t = {
      id,
      dataset,
      hasAttribute: (key) =>
        attrs.includes(key) || Object.keys(dataset).some((k) => "data-" + k.replace(/[A-Z]/g, (x) => "-" + x.toLowerCase()) === key),
      closest: (selector) => {
        calls.push(["closest", selector]);
        return t;
      },
    };
    const e = { target: t };
    const run = async (fn) => {
      reset();
      calls = [];
      let value, error;
      try {
        const pending = fn(e);
        const synchronous = calls.slice();
        value = await pending;
        await new Promise(setImmediate);
        return { value, synchronous, calls: JSON.stringify(calls), state: JSON.stringify(s), toast: toast.innerHTML };
      } catch (caught) {
        error = { name: caught.name, message: caught.message };
        return { error, calls: JSON.stringify(calls), state: JSON.stringify(s) };
      }
    };
    assert.deepEqual(await run(actual), await run(old), JSON.stringify({ id, dataset, attrs, flags }));
    checked++;
  }
  const ids = [
    "case-showall",
    "t-undo",
    "btn-openfile",
    "btn-linkdir",
    "btn-grantdir",
    "btn-browse",
    "btn-flush",
    "btn-storage",
    "btn-clear",
    "btn-cc",
    "btn-addcc",
    "btn-addem",
    "btn-email",
    "btn-sendgo",
    "btn-sendnone",
    "btn-savecase",
    "btn-testwrite",
    "btn-reindex",
    "btn-syncpdf",
    "btn-risave",
    "btn-recordri",
    "picker-bg",
    "btn-add-top",
    "btn-correct",
    "btn-reissue",
    "btn-exportcorrection",
    "btn-retrycorrection",
    "btn-recordnote",
    "btn-void",
    "btn-reconcile",
    "record-action-go",
    "btn-original",
    "btn-save",
    "btn-print",
    "btn-final",
    "btn-reviewcorrection",
    "fin-go",
    "acc-pick",
    "acc-cancel",
    "acc-go",
    "unknown",
  ];
  const data = {
    nav: "cases",
    exportcase: "c",
    openfolder: "file.json",
    discardri: "r",
    discard: "d",
    caseSync: "c",
    rmcc: "0",
    rmem: "0",
    clearcases: "all",
    rmcase: "c",
    reinsp: "c",
    riwalk: "",
    rifilter: "all",
    setoc: "none",
    item: "i",
    makedoc: "extension",
    close: "picker",
    libcl: "group",
    open: "d",
    new: "c",
    grp: "g",
    adoptCatalog: "i",
    resumerecord: "r",
    pick: "0:0:0",
    del: "i",
    move: "up",
    grpbtn: "g",
    notecite: "i",
    abate: "i",
    withdraw: "i",
    acccase: "0",
    accsel: "0",
  };
  flags = { folder: true, grant: true, allowed: true, remove: true, confirm: true, busy: false, risky: false };
  for (const id of ids) await compare(id, {});
  for (const [key, value] of Object.entries(data)) await compare("", { [key]: value, item: "i" });
  for (const attr of ["data-riwalk-next", "data-riwalk-skip", "data-riwalk-return", "data-riwalk-prev", "data-riwalk-undo"])
    await compare("", {}, [attr]);
  await fc.assert(
    fc.asyncProperty(
      fc.constantFrom(...ids),
      fc.subarray(Object.keys(data), { maxLength: 5 }),
      fc.record({
        folder: fc.boolean(),
        grant: fc.boolean(),
        allowed: fc.boolean(),
        remove: fc.boolean(),
        confirm: fc.boolean(),
        busy: fc.boolean(),
        risky: fc.boolean(),
      }),
      async (id, keys, options) => {
        flags = options;
        await compare(id, Object.fromEntries(keys.map((k) => [k, data[k]])));
      },
    ),
    { seed: 20261027, numRuns: 1000 },
  );
  console.log("PASS workspace dispatch equivalence", checked, "actions/combinations, synchronous calls and state");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
