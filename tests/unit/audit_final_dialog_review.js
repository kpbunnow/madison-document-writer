/* Finalize dialog defects found by the 2026-11-27 code review (synthetic).

   - A correction's dialog lists the email recipients of its own edited case details, but the selection saved when the
     workspace was captured was read against the live case's list, so a correction that added, removed or reordered
     recipients saved the wrong addresses and the dialog then showed the wrong boxes ticked. Both now use the same list.
   - With several advisory notes and no blockers the banner still said "One thing worth a second look". */
const assert = require("node:assert/strict"),
  path = require("node:path"),
  esbuild = require("esbuild"),
  { JSDOM } = require("jsdom");

(async () => {
  const dir = path.resolve(__dirname, "../../app/modules");
  const built = await esbuild.build({
    stdin: {
      contents:
        "export {createScreenOverlays} from './screen_overlays.js'; export {createWorkingPapers} from './working_papers.js'; export {WriterState} from './state.js';",
      resolveDir: dir,
    },
    bundle: true,
    format: "cjs",
    write: false,
    plugins: [
      {
        name: "data",
        setup(b) {
          b.onResolve({ filter: /\/data\// }, (a) => ({
            path: path.resolve(__dirname, "../../build/generated/modules/data", path.basename(a.path)),
          }));
        },
      },
    ],
  });
  const box = { exports: {} };
  new Function("module", "exports", built.outputFiles[0].text)(box, box.exports);
  const { createScreenOverlays, createWorkingPapers, WriterState: s } = box.exports;

  let notes = [];
  const overlays = createScreenOverlays({
    today: "2026-11-27",
    checks: () => notes,
    blockers: () => [],
    correctionDiffHTML: () => "<p>Changes</p>",
    checkRowHTML: (c, ix) => '<p data-check="' + ix + '">' + c.t + "</p>",
    initialCitations: { enabled: () => false },
  });
  const dom = new JSDOM("<!doctype html><body></body>");
  const papers = createWorkingPapers({
    ensureWalkContext: () => true,
    ENTRY_IDS: [],
    get document() {
      return dom.window.document;
    },
    recordFormKey: () => "",
  });

  const live = {
    id: "c1",
    number: "CE2026-000-00001",
    address: "1 TEST ST",
    owner: "SYNTHETIC OWNER",
    emails: [{ kind: "Owner", addr: "old@example.invalid" }],
  };
  // The correction removed the old address and added two new ones.
  const corrected = {
    ...live,
    emails: [
      { kind: "Owner", addr: "first@example.invalid" },
      { kind: "Agent", addr: "second@example.invalid" },
    ],
  };
  const draft = {
    id: "d1",
    caseId: "c1",
    type: "notice",
    draft: true,
    items: [],
    mailed: "2026-11-27",
    correction: { case: corrected, reason: "Synthetic correction", reviewed: true },
  };
  Object.assign(s, {
    state: { docId: "d1", modal: "final", screen: "write" },
    WORK: { entry: {}, recordForms: {} },
    DOCS: [draft],
    CASES: [live],
    HELPER: { chrome: true, outlook: true },
    AMENDMENT_BUSY: false,
  });

  const paint = () => {
    dom.window.document.body.innerHTML = overlays.overlayHTML();
    return [...dom.window.document.querySelectorAll("[data-finsend]")];
  };
  let boxes = paint();
  assert.deepEqual(
    boxes.map((b) => b.closest("label").textContent.replace(/\s+/g, " ").trim()),
    ["Owner first@example.invalid", "Agent second@example.invalid"],
    "the dialog offers the correction's recipients",
  );
  boxes[0].checked = false;
  boxes[1].checked = true;
  papers.captureWork();
  assert.deepEqual(draft.emailSelection, ["second@example.invalid|Agent"], "the saved selection is read against the same list");
  boxes = paint();
  assert.deepEqual(
    boxes.map((b) => b.checked),
    [false, true],
    "the repainted dialog keeps the ticked recipient",
  );

  // An ordinary draft still reads the live case's recipients.
  delete draft.correction;
  boxes = paint();
  assert.equal(boxes.length, 1);
  boxes[0].checked = true;
  papers.captureWork();
  assert.deepEqual(draft.emailSelection, ["old@example.invalid|Owner"]);

  const banner = () => dom.window.document.querySelector(".banner.warn").textContent.replace(/\s+/g, " ").trim();
  notes = [{ ok: false, soft: true, t: "Advisory one" }];
  paint();
  assert.equal(banner(), "Ready to issue. One thing worth a second look, noted below.");
  notes = [
    { ok: false, soft: true, t: "Advisory one" },
    { ok: false, soft: true, t: "Advisory two" },
    { ok: false, soft: true, t: "Advisory three" },
  ];
  paint();
  assert.equal(banner(), "Ready to issue. 3 things worth a second look, noted below.");
  console.log("PASS finalize dialog: a correction's email selection is saved against its own recipients; advisory notes are counted");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
