const { overlayContract, overlayCalls } = require("../fixtures/overlay_contracts.cjs");
/* Modal behavior, escaping, input state, current adapter/failure order and read-only rendering. */
const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path"),
  esbuild = require("esbuild");
(async () => {
  async function load(contents) {
    const b = await esbuild.build({
      stdin: { contents: contents + '\nexport {WriterState} from "./state.js";', resolveDir: path.resolve("app/modules") },
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
    new Function("module", "exports", b.outputFiles[0].text)(box, box.exports);
    return box.exports;
  }
  const current = await load(fs.readFileSync("app/modules/screen_overlays.js", "utf8"));
  function run(api, x) {
    const calls = [];
    let steps = 0;
    const effect =
      (name, fn) =>
      (...args) => {
        calls.push([name, structuredClone(args)]);
        if (++steps === x.fail) throw Error("interrupted:" + name);
        return fn(...args);
      };
    const k = {
      id: "case",
      number: 'QA <&> "case"',
      address: "100 <&> Street",
      owner: x.llc ? "Example LLC" : "Example Owner",
      ccList: x.copies ? [{ name: "Name <&>", addr: "123 <&> ST", city: "Madison, WI 53703" }] : [],
      emails: x.emails
        ? [
            { kind: "Owner", addr: "owner@example.invalid", on: x.selected },
            { kind: "Other <&>", addr: "other@example.invalid", on: false },
          ]
        : [],
      agent: { name: "Agent <&>", addr: "456 <&> ST", city: "Madison, WI 53703" },
    };
    const d = {
      id: "doc",
      caseId: k.id,
      type: x.citation ? "citation" : "notice",
      mailed: x.mailed ? "2026-10-29" : "",
      items: [],
      emailSelection: x.selection ? ["owner@example.invalid|Owner"] : undefined,
    };
    if (x.correction) d.correction = { reason: "Reason <&>", reviewed: x.reviewed, case: { ...k, number: "Correction <&>" } };
    Object.assign(api.WriterState, {
      CASES: Array.from({ length: x.cases }, (_, i) => ({ ...k, id: i ? "case" + i : k.id, number: k.number + i })),
      DOCS: [d],
      REINSP: [],
      EVENTS: {},
      HELPER: x.helper ? { chrome: x.chrome, outlook: x.outlook } : null,
      CASEDIR: x.folder ? { helper: x.native === false } : null,
      DIRNAME: x.wrong ? "Wrong <&>" : "Expected",
      AMENDMENT_BUSY: x.busy,
      state: {
        docId: d.id,
        sendDoc: x.send ? "missing" : d.id,
        modal: x.modal,
        picker: x.picker,
        publicationBusy: x.busy ? "doc" : null,
        ccProblem: x.problem ? { scope: x.agent ? "agent" : "copy", index: 0, field: "addr", message: "Invalid <&>" } : null,
        reindex: { running: x.busy },
        folder: Array.from({ length: x.files }, (_, i) => ({ name: "QA " + i + " <&>.json", size: i * 1024, mod: i % 2 ? "2026-10-20" : null })),
        folderQ: x.query ? "no match" : "",
        folderError: x.error ? "Error <&>" : "",
      },
    });
    // Preserve the selected case even when testing the empty clear-workspace branch.
    if (!x.cases && x.modal !== "clear") api.WriterState.CASES = [k];
    const checks = Array.from({ length: x.checks }, (_, i) => ({ ok: i % 3 === 2, soft: i % 3 === 1, t: "Check <&> " + i }));
    const methods = {
      CASEDIR_EXPECT: "Expected",
      today: new Date("2026-10-29T12:00:00Z"),
      recipientPreview: effect("preview", (v) => "Printed " + v.addr),
      caseUnsaved: effect("unsaved", (v) => (Number(v.id.replace("case", "")) % 2 ? "Unsaved <&>" : "")),
      checks: effect("checks", () => checks),
      blockers: effect("blockers", () => checks.filter((c) => !c.ok && !c.soft)),
      checkRowHTML: effect("row", (_, i) => "<p>Check " + i + "</p>"),
      initialCitations: { enabled: effect("initial", () => x.initial) },
    };
    for (const name of [
      "storageReport",
      "reindexReport",
      "correctionDiffHTML",
      "pickerHTML",
      "sharedChangeModal",
      "reviewModalHTML",
      "recoveryModal",
      "recordActionModal",
    ])
      methods[name] = effect(name, () => "<article>" + name + "</article>");
    const services = new Proxy(methods, {
      get(t, k) {
        calls.push(["get", String(k)]);
        if (++steps === x.fail) throw Error("interrupted:get:" + String(k));
        assert.ok(k in t, "unknown adapter " + String(k));
        return t[k];
      },
    });
    const owner = api.createScreenOverlays(services);
    assert.equal(calls.length, 0);
    const initialState = structuredClone(api.WriterState);
    let value,
      error = null;
    try {
      value = owner.overlayHTML();
    } catch (e) {
      error = [e.name, e.message];
    }
    return { value, error, calls, checks, initialState, state: structuredClone(api.WriterState) };
  }
  const modes = ["sendto", "cc", "clear", "storage", "folder", "final", "shared-change", "review", "recovery", "recordnote", "unknown", null];
  let count = 0,
    rendered = 0;
  const seen = new Set();
  let blockedSample, lastScenario;
  for (let i = 0; i < 3072; i++) {
    const variant = Math.floor(i / 12);
    const x = {
      modal: modes[i % 12],
      llc: !!(variant & 1),
      citation: !!(variant & 2),
      copies: !!(variant & 4),
      emails: !!(variant & 8),
      selected: !!(variant & 16),
      correction: !!(variant & 32),
      reviewed: !!(variant & 64),
      helper: variant % 3 !== 0,
      chrome: variant % 5 !== 0,
      outlook: variant % 7 !== 0,
      folder: !!(variant & 128),
      native: !!(variant & 256),
      wrong: !!(variant & 512),
      busy: variant % 11 === 0,
      problem: variant % 7 === 0,
      agent: variant % 13 === 0,
      send: variant % 3 === 0,
      picker: variant % 4 === 0,
      files: [0, 1, 14][Math.floor(i / 12) % 3],
      cases: [0, 1, 15][Math.floor(i / 36) % 3],
      checks: i % 5,
      initial: variant % 5 === 0,
      selection: variant % 7 === 0,
      mailed: variant % 3 === 0,
      query: variant % 11 === 0,
      error: variant % 13 === 0,
      fail: variant % 19 === 0 ? (i % 17) + 1 : 0,
    };
    lastScenario = x;
    const result = run(current, x);
    assert.deepEqual(result, run(current, x), "deterministic output/call/failure sequence: " + i);
    assert.deepEqual(result.state, result.initialState, "rendering never edits records or selections");
    const expectedCalls = overlayCalls(result.initialState, result.checks);
    const interrupted = x.fail > 0 && x.fail <= expectedCalls.length;
    assert.deepEqual(result.calls, expectedCalls.slice(0, interrupted ? x.fail : expectedCalls.length), "independent full adapter order: " + i);
    if (interrupted) {
      const last = expectedCalls[x.fail - 1];
      assert.deepEqual(result.error, ["Error", "interrupted:" + (last[0] === "get" ? "get:" + last[1] : last[0])]);
    } else {
      assert.equal(result.error, null);
      const delegated = {
        "shared-change": "sharedChangeModal",
        review: "reviewModalHTML",
        recovery: "recoveryModal",
        recordnote: "recordActionModal",
      };
      const delegate = delegated[x.modal];
      const document = result.initialState.DOCS[0];
      const contact = document.correction?.case || result.initialState.CASES.find((item) => item.id === document.caseId) || {};
      const expected = delegate
        ? { delegate: "<article>" + delegate + "</article>" }
        : x.modal === "unknown" || (!x.modal && !x.picker)
          ? { delegate: "" }
          : !x.modal
            ? { delegate: "<article>pickerHTML</article>" }
            : {
                modal: x.modal,
                copies: x.copies ? 1 : 0,
                contact,
                previews: [...(contact.ccList || []), contact.agent || {}].map((copy) => "Printed " + copy.addr),
                emails: x.emails ? 2 : 0,
                needAgent: x.citation && x.llc,
                problem: x.problem,
                safe: Math.ceil(x.cases / 2),
                risky: Math.floor(x.cases / 2),
                files: x.query ? 0 : x.files,
                folderError: x.error,
                folder: x.folder,
                helperStorage: x.native === false,
                running: x.busy,
                wrong: x.folder && x.wrong,
                blocked: x.checks > 0,
                busy: x.busy,
                correction: x.correction,
                reviewed: x.reviewed,
                initial: x.initial,
                mailed: "2026-10-29",
                send: x.helper && x.chrome && x.emails ? [x.selection || x.selected, false] : [],
              };
      overlayContract(result.value, expected);
      if (expected.modal === "final" && expected.blocked && !blockedSample) blockedSample = { html: result.value, expected };
      if (delegate || (!x.modal && x.picker)) {
        const name = delegate || "pickerHTML";
        assert.deepEqual(
          result.calls.map((call) => call[0]),
          ["get", name],
          "delegation calls only its current owner",
        );
      }
    }
    if (result.value) {
      rendered++;
      seen.add(x.modal);
    }
    count++;
  }
  for (const helperStorage of [false, true])
    for (const wrong of [false, true]) {
      const x = { ...lastScenario, modal: "storage", folder: true, native: !helperStorage, wrong, fail: 0, busy: false };
      const result = run(current, x);
      assert.equal(result.error, null);
      assert.deepEqual(result.calls, overlayCalls(result.initialState, result.checks));
      overlayContract(result.value, { modal: "storage", folder: true, helperStorage, wrong, running: false });
    }
  const manyCases = run(current, { ...lastScenario, modal: "clear", cases: 31, fail: 0 });
  assert.equal(manyCases.error, null);
  assert.deepEqual(manyCases.calls, overlayCalls(manyCases.initialState, manyCases.checks));
  overlayContract(manyCases.value, { modal: "clear", safe: 16, risky: 15 });
  assert.match(manyCases.value, /and 4 more/);
  assert.ok(blockedSample);
  const mutation = require("jsdom").JSDOM.fragment(blockedSample.html);
  mutation.querySelector("#fin-go").disabled = false;
  assert.throws(
    () => overlayContract(mutation.firstElementChild.outerHTML, blockedSample.expected),
    assert.AssertionError,
    "the contract detects an enabled blocked Issue action",
  );
  assert.throws(
    () => overlayContract(blockedSample.html + "<script>unsafe()</script>", blockedSample.expected),
    assert.AssertionError,
    "the contract detects active injected markup",
  );
  assert.ok(rendered > 2200);
  for (const mode of modes.filter((m) => m && m !== "unknown")) assert.ok(seen.has(mode), "rendered " + mode);
  assert.equal(count, 3072);
  console.log("PASS Writer overlay templates " + count + " behavior/state/adapter/failure scenarios");
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
