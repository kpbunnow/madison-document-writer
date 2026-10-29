/* Retained editing comparisons pin field dispatch, pricing effects, errors and partial mutations. */
const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path"),
  esbuild = require("esbuild");
(async () => {
  async function compile(contents) {
    const b = await esbuild.build({
      stdin: {
        contents: contents + '\nexport {WriterState} from "./state.js"; ',
        resolveDir: path.resolve("app/modules"),
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
    const box = { exports: {} };
    new Function("document", "module", "exports", b.outputFiles[0].text)({ addEventListener() {} }, box, box.exports);
    return box.exports;
  }
  const [current, legacy] = await Promise.all([
    compile(fs.readFileSync("app/modules/language_catalog.js", "utf8")),
    compile(fs.readFileSync("tests/fixtures/language_catalog_reference.txt", "utf8")),
  ]);
  const snapshot = (v) => JSON.parse(JSON.stringify(v, (_, x) => (typeof x === "function" ? "<callback>" : x)));
  async function run(api, x) {
    const state = api.WriterState;
    for (const key of Object.keys(state)) delete state[key];
    const local = { id: "case", number: "CB2026-100-00001", owner: "Baseline", address: "100 Main St" },
      base = structuredClone(local),
      remote = structuredClone(local),
      calls = [];
    const event = { id: "one", at: "2026-10-25T12:00:00Z", type: "case.updated", payload: { text: "original" } };
    if (x.kind === "shared-only" || x.kind === "compatible" || x.kind === "conflict") remote.owner = "Remote";
    if (x.kind === "local-only" || x.kind === "compatible") local.address = "Local address";
    if (x.kind === "conflict") local.owner = "Local";
    const file = { format: "madison-case-file", case: remote, events: x.kind === "shared-history" ? [event, { ...event, id: "two" }] : [event] };
    Object.assign(state, {
      CASES: [local],
      DOCS: [],
      REINSP: [],
      PENDING: [],
      EVENTS: { case: [event] },
      RECORD_ATTEMPTS: {},
      WORK: { recordForms: {} },
      SAVE_CHECKPOINTS: { case: { case: base, events: ["one"] } },
      CASEDir: null,
      CASEDIR: x.offline ? null : { helper: true },
      NEEDGRANT: false,
      PREFLIGHT_SEQ: 0,
      state: { screen: "cases", docId: null, reinspId: null, modal: null },
    });
    if (x.unfinished) state.DOCS = [{ id: "draft", draft: true, caseId: "case" }];
    const log = (name, args) => calls.push([name, snapshot(args)]);
    const values = {
      recordIntegrity: {
        status(k) {
          log("status", [k]);
          return { valid: x.kind !== "invalid" };
        },
      },
      async helperJSON(url, body) {
        log("helperJSON", [url, body]);
        if (x.failRead && url.startsWith("/cases")) throw Error("Unavailable");
        if (x.stale === "read") state.state.screen = "changed";
        return { file: structuredClone(file) };
      },
      caseUnsaved(k) {
        log("caseUnsaved", [k]);
        return x.unfinished ? "Unfinished" : "";
      },
      render() {
        log("render", []);
      },
      rememberSaved(k, f) {
        log("rememberSaved", [k, f]);
        state.SAVE_CHECKPOINTS.case = { case: structuredClone(k), events: f.events.map((e) => e.id) };
      },
      async saveDrafts() {
        log("saveDrafts", []);
        if (x.stale === "save") state.state.docId = "changed";
        return x.writeOK;
      },
      loadCaseFile(body) {
        log("loadCaseFile", [body]);
        return x.writeOK;
      },
      recoveryCaseKey(id) {
        log("recoveryCaseKey", [id]);
        return "key";
      },
      RECOVERY_WORKSPACE: "workspace",
      recoverySnapshot(...args) {
        log("recoverySnapshot", args);
        return { case: "key", work: { kept: true } };
      },
      draftBundle() {
        log("draftBundle", []);
        return { kept: true };
      },
      async idbSet(...args) {
        log("idbSet", args);
        return x.writeOK;
      },
      clearWalk() {
        log("clearWalk", []);
      },
      project() {
        log("project", []);
      },
      toast(...args) {
        log("toast", args);
      },
    };
    const services = new Proxy(values, {
        get(t, k) {
          calls.push("get:" + k);
          return t[k];
        },
      }),
      owner = api.createLanguageCatalog(services);
    assert.deepEqual(calls, []);
    const prior = global.confirm;
    global.confirm = (...args) => {
      log("confirm", args);
      return x.confirm;
    };
    let result, error;
    try {
      if (x.operation === "replace") {
        state.PREFLIGHT_CONFLICT = { cid: "case", file: structuredClone(file) };
        if (x.pending) state.PENDING = [{ cid: "case" }];
        result = await owner.openChangedShared();
      } else result = await owner.preflightCase("case", "draft", () => log("continue", []));
    } catch (e) {
      error = [e.name, e.message];
    } finally {
      if (prior === undefined) delete global.confirm;
      else global.confirm = prior;
    }
    return { result, error, calls, state: snapshot(state) };
  }
  let checked = 0;
  for (const operation of ["preflight", "replace"])
    for (const kind of ["unchanged", "shared-only", "local-only", "compatible", "conflict", "shared-history", "invalid"])
      for (const writeOK of [true, false])
        for (const stale of ["", "read", "save"])
          for (const unfinished of [true, false]) {
            const x = {
              operation,
              kind,
              writeOK,
              stale,
              unfinished,
              confirm: checked % 5 !== 0,
              offline: checked % 11 === 0,
              failRead: checked % 13 === 0,
              pending: checked % 7 === 0,
            };
            assert.deepEqual(await run(current, x), await run(legacy, x), "scenario " + checked++);
          }
  console.log(
    "PASS shared preflight/replacement equivalence " + checked + " async scenarios: refusal, merge rollback, stale views and durable staging",
  );
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
