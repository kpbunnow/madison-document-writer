const { withoutViolatorAdditions } = require("../fixtures/violator_overlay.cjs");
/* Complete overlay HTML, state and adapter access/failure parity against the retained owner. */
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
  const [current, original] = await Promise.all([
    load(fs.readFileSync("app/modules/screen_overlays.js", "utf8")),
    load(fs.readFileSync("tests/fixtures/writer_overlay_reference.txt", "utf8")),
  ]);
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
    let value,
      error = null;
    try {
      value = owner.overlayHTML();
    } catch (e) {
      error = [e.name, e.message];
    }
    return { value, error, calls, state: structuredClone(api.WriterState) };
  }
  const modes = ["sendto", "cc", "clear", "storage", "folder", "final", "shared-change", "review", "recovery", "recordnote", "unknown", null];
  let count = 0,
    rendered = 0;
  const seen = new Set();
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
    const result = run(current, x);
    const retained = run(original, x);
    assert.deepEqual({ ...result, value: withoutViolatorAdditions(result.value, retained.value) }, retained, "overlay:" + i);
    if (result.value) {
      rendered++;
      seen.add(x.modal);
    }
    count++;
  }
  assert.ok(rendered > 2200);
  for (const mode of modes.filter((m) => m && m !== "unknown")) assert.ok(seen.has(mode), "rendered " + mode);
  assert.equal(count, 3072);
  console.log("PASS Writer overlay templates " + count + " exact HTML/state/adapter/failure comparisons");
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
