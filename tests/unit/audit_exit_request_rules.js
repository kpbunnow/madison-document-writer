/* Exit request against the retained module, in a real dialog: draft saving, the review re-check before and after the
   recovery copy, acknowledgment, supersession, the shutdown request and its refusal, failure and success paths,
   with every peer call in order and the dialog, helper and workspace state left behind. */
const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path"),
  esbuild = require("esbuild"),
  { JSDOM } = require("jsdom"),
  { prng } = require("../fixtures/equivalence_harness.cjs");

process.on("unhandledRejection", () => {});
const { random, pick, chance } = prng(20261205);

globalThis.document = { addEventListener: () => undefined };
globalThis.window = { addEventListener: () => undefined };
globalThis.__stub = { context: () => ({}), call: () => undefined };

const STUBS = {
  "./app_core.js": `export const app_savedworkContext = () => globalThis.__stub.context();
export const captureWork = () => globalThis.__stub.call("captureWork");
export const saveDrafts = () => globalThis.__stub.call("saveDrafts");
export const backupUnfinished = (jobs) => globalThis.__stub.call("backupUnfinished", jobs);
export const recoveryJobs = () => globalThis.__stub.call("recoveryJobs");`,
  "./helper_transport.js": `export const authFetch = (url, options) => globalThis.__stub.call("authFetch", url, options);`,
  "./helper_stopped.js": `export const helperStop = { stopped: false };
export const announceStop = () => globalThis.__stub.call("announceStop");
export const listenForStop = (fn) => globalThis.__stub.call("listenForStop");
export const showStopped = (details) => globalThis.__stub.call("showStopped", details);`,
  "./saved_work.js": `export const savedCaseState = (R, k) => globalThis.__stub.call("savedCaseState", k.id) || { action: "none" };`,
};

async function compile(contents, resolveName) {
  const build = await esbuild.build({
    stdin: { contents, resolveDir: path.resolve("app/modules") },
    bundle: true,
    write: false,
    format: "cjs",
    plugins: [
      {
        name: "stubs",
        setup(b) {
          b.onResolve({ filter: /^\.\/(app_core|helper_transport|helper_stopped|saved_work)\.js$/ }, (a) => ({ path: a.path, namespace: "stub" }));
          b.onLoad({ filter: /.*/, namespace: "stub" }, (a) => ({ contents: STUBS[a.path], resolveDir: path.resolve("app/modules") }));
          b.onResolve({ filter: /\/data\// }, (a) => ({ path: path.resolve("build/generated/modules/data", path.basename(a.path)) }));
        },
      },
    ],
  });
  const box = { exports: {} };
  new Function("module", "exports", build.outputFiles[0].text)(box, box.exports);
  return box.exports;
}

function scenario() {
  return {
    attach: !chance(25),
    save: pick([true, true, true, true, true, false, "throw"]),
    pending: pick([0, 0, 0, 0, 0, 1, 2]),
    outbox: pick([0, 0, 0, 0, 1, null]),
    localOk: pick([true, true, true, true, true, false]),
    acknowledged: chance(2),
    detachAt: pick(["", "", "", "", "flush", "settle"]),
    changeAt: pick(["", "", "", "", "flush", "settle"]),
    helper: pick([null, { outbox: 0 }]),
    busyWait: pick([0, 0, 3]),
    backup: pick(["ok", "ok", "throw"]),
    reply: pick(["ok", "ok", "ok", "refuse", "refuse-reasons", "nojson", "error", "notok"]),
    again: chance(8),
    publication: chance(14),
    fail: chance(8) ? 1 + random(12) : 0,
  };
}

async function run(api, sc) {
  const x = structuredClone(sc),
    calls = [],
    state = api.WriterState;
  const dom = new JSDOM('<div id="app"></div>', { url: "http://127.0.0.1/" });
  const w = dom.window;
  w.HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute("open", "");
  };
  w.HTMLDialogElement.prototype.close = function () {
    this.removeAttribute("open");
  };
  globalThis.document = w.document;
  let count = 0;
  const tick = (label) => {
    if (++count === x.fail) throw new Error("interrupted:" + label);
  };
  let waited = 0;
  globalThis.setTimeout = (fn) => {
    calls.push("setTimeout");
    if (++waited >= x.busyWait) state.RECOVERY_BUSY = false;
    fn();
    return 1;
  };
  globalThis.clearTimeout = () => calls.push("clearTimeout");
  const context = {
    LOCAL_SAVE: { ok: x.localOk },
    draftTimer: 0,
    CASES: [],
    PENDING: Array.from({ length: x.pending }, (_, n) => ({ cid: "c" + n })),
    HELPER: x.outbox === null ? {} : { outbox: x.outbox },
    A11Y: {
      utility: (title, html) => {
        calls.push("utility " + title);
        const old = w.document.getElementById("utility-dialog");
        if (old) old.remove();
        const dialog = w.document.createElement("dialog");
        dialog.id = "utility-dialog";
        dialog.setAttribute("open", "");
        dialog.innerHTML = "<button data-utility-close>Close</button>" + html;
        w.document.body.append(dialog);
      },
    },
    caseState: () => ({}),
    recordIntegrity: { status: () => ({}) },
  };
  Object.assign(state, {
    WORK: { entry: {} },
    state: { publicationBusy: x.publication ? "doc" : null },
    AMENDMENT_BUSY: false,
    FILING_ACTIVE: 0,
    HELPER: x.helper,
    RECOVERY_BUSY: x.busyWait > 0,
    RECOVERY_TIMER: 0,
    PENDING: context.PENDING,
    WRITER_ACCESS: true,
    HANDOFF_SEQ: 0,
    WRITER_CHANNEL: { close: () => calls.push("channel.close") },
    releaseWorkspaceLock: () => calls.push("releaseLock"),
  });
  let fetches = 0;
  globalThis.__stub = {
    context: () => context,
    call: (name, ...args) => {
      calls.push(name + "(" + JSON.stringify(args) + ")");
      tick(name);
      if (name === "saveDrafts") {
        if (x.changeAt === "flush") context.PENDING.push({ cid: "late" });
        if (x.detachAt === "flush") w.document.getElementById("exit-writer-form")?.remove();
        if (x.save === "throw") throw new Error("save failed");
        return Promise.resolve(x.save);
      }
      if (name === "backupUnfinished") {
        if (x.changeAt === "settle") context.PENDING.push({ cid: "late" });
        if (x.detachAt === "settle") w.document.getElementById("exit-writer-form")?.remove();
        return x.backup === "throw" ? Promise.reject(new Error("backup failed")) : Promise.resolve();
      }
      if (name === "recoveryJobs") return ["job"];
      if (name === "authFetch") {
        fetches++;
        if (x.reply === "error") return Promise.reject(new Error("offline"));
        return Promise.resolve({
          ok: x.reply !== "notok",
          json: () =>
            x.reply === "nojson"
              ? Promise.reject(new Error("bad"))
              : Promise.resolve(
                  x.reply === "refuse"
                    ? { ok: false, error: "Busy" }
                    : x.reply === "refuse-reasons"
                      ? { ok: false, reasons: ["Work A.", "Work B."] }
                      : { ok: true },
                ),
        });
      }
      return undefined;
    },
  };
  let error;
  try {
    await api.openExit(false);
    const form = w.document.getElementById("exit-writer-form");
    if (form && x.acknowledged && form.elements.acknowledged) form.elements.acknowledged.checked = true;
    if (!x.attach) w.document.getElementById("utility-dialog")?.removeAttribute("open");
    form?.onsubmit({ preventDefault: () => calls.push("preventDefault") });
    if (x.again) form?.onsubmit({ preventDefault: () => calls.push("preventDefault") });
    for (let n = 0; n < 40; n++) await new Promise((resolve) => setImmediate(resolve));
  } catch (e) {
    error = [e.name, e.message];
  }
  const dialog = w.document.getElementById("utility-dialog");
  const formNow = w.document.getElementById("exit-writer-form");
  return JSON.stringify({
    error,
    fetches,
    errorText: formNow?.querySelector("[data-exit-error]")?.textContent ?? null,
    dataset: formNow ? { ...formNow.dataset } : null,
    buttons: formNow
      ? [formNow.querySelector("[data-exit-confirm]")?.disabled ?? null, dialog?.querySelector("[data-utility-close]")?.disabled ?? null]
      : null,
    startup: [state.HELPER, state.WRITER_ACCESS, state.HANDOFF_SEQ, !!state.WRITER_CHANNEL, !!state.releaseWorkspaceLock],
    calls,
  });
}

(async () => {
  const [current, legacy] = await Promise.all([
    compile('export {openExit} from "./desktop_exit.js"; export {WriterState} from "./state.js";'),
    compile(fs.readFileSync("tests/fixtures/desktop_exit_reference.txt", "utf8") + '\nexport {WriterState} from "./state.js";'),
  ]);
  let interrupted = 0,
    stopped = 0,
    refused = 0,
    recheck = 0;
  const seen = new Set();
  for (let n = 0; n < 3000; n++) {
    const sc = scenario();
    const [before, after] = [await run(legacy, sc), await run(current, sc)];
    assert.equal(after, before, `exit request scenario ${n} differs from the retained module:\n${JSON.stringify(sc)}`);
    const parsed = JSON.parse(after);
    if (parsed.error || parsed.calls.some((c) => c.includes("interrupted:"))) interrupted++;
    if (parsed.calls.includes("announceStop(" + "[])")) stopped++;
    if (parsed.errorText && /Busy|Work A/.test(parsed.errorText)) refused++;
    if (parsed.calls.filter((c) => c.startsWith("utility ")).length > 1) recheck++;
    for (const c of parsed.calls) seen.add(c.split("(")[0]);
    if (parsed.errorText) seen.add("text:" + parsed.errorText.slice(0, 20));
  }
  for (const name of [
    "saveDrafts",
    "backupUnfinished",
    "authFetch",
    "announceStop",
    "showStopped",
    "channel.close",
    "releaseLock",
    "setTimeout",
    "text:Stopping Document Wr",
    "text:Document Writer did ",
  ])
    assert.ok(seen.has(name), "scenarios reach " + name);
  assert.ok(
    interrupted > 50 && stopped > 100 && refused > 40 && recheck > 100,
    `coverage: ${interrupted} interrupted, ${stopped} stopped, ${refused} refused, ${recheck} rechecked`,
  );
  console.log(
    "PASS exit request matches the retained module over 3000 scenarios (" +
      interrupted +
      " interrupted, " +
      stopped +
      " stopped, " +
      refused +
      " refused)",
  );
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
