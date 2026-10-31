/* Exact editor HTML, state mutation and ordered service effects across retained/draft workflows. */
const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path"),
  acorn = require("acorn"),
  esbuild = require("esbuild"),
  fc = require("fast-check");
const { JSDOM } = require("jsdom");
const { withHistoricalBindings } = require("../fixtures/historical_module_scope.cjs");
(async () => {
  const directory = path.resolve("app/modules");
  let source = fs.readFileSync(path.join(directory, "editor_screens.js"), "utf8");
  const ast = acorn.parse(source, { ecmaVersion: 2022, sourceType: "module" }),
    factory = ast.body.find((n) => n.declaration?.id?.name === "createEditorScreens").declaration,
    ret = factory.body.body.at(-1);
  const reference = require("../fixtures/editor_screen_reference.cjs").replace("function screenWrite(", "function referenceScreenWrite(");
  const presentation = fs.readFileSync("tests/fixtures/editor_presentation_reference.txt", "utf8");
  const retained =
    "const {referenceScreenWrite, referenceReviewModalHTML} = (() => {\n" +
    presentation +
    "\n" +
    reference +
    "\nreturn {referenceScreenWrite, referenceReviewModalHTML: reviewModalHTML};})();\n";
  source =
    source.slice(0, ret.start) +
    retained +
    source.slice(ret.start).replace("screenWrite,", "screenWrite,referenceScreenWrite,referenceReviewModalHTML,");
  source += '\nexport {WriterState} from "./state.js";export {esc} from "./presentation_format.js";';
  const compiled = await esbuild.build({
    stdin: { contents: withHistoricalBindings(source, ["WriterState", "esc"]), resolveDir: directory },
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
  const dom = new JSDOM('<div id="app"></div><div id="overlay"></div>'),
    box = { exports: {} };
  new Function("document", "today", "module", "exports", compiled.outputFiles[0].text)(
    dom.window.document,
    new Date("2026-10-27T12:00:00Z"),
    box,
    box.exports,
  );
  const { createEditorScreens, WriterState: s, esc } = box.exports;
  let flags = {},
    calls = [];
  const traced =
    (name, fn) =>
    (...args) => {
      calls.push("call:" + name);
      return fn(...args);
    };
  const methods = {
    isLocked: traced("isLocked", () => flags.locked),
    structEditable: traced("structEditable", () => flags.structural),
    correctionEligibility: traced("correctionEligibility", () => flags.eligible),
    checks: traced("checks", () =>
      Array.from({ length: flags.checks }, (_, i) => ({
        ok: i % 3 === 2,
        soft: i % 3 === 1,
        t: "Check <&> " + i,
        targets: [{ selector: "#field" + i, label: "Field " + i }],
      })),
    ),
    checkRowHTML: traced("checkRowHTML", (c, ix) => "<p>" + ix + ":" + esc(c.t) + "</p>"),
    recordIntegrity: { status: traced("integrity.status", () => ({ valid: !flags.invalid })), blocked: () => false },
    snow: {
      prepare: traced("snow.prepare", (d) => {
        d.prepared = true;
      }),
      isCase: () => flags.snow,
      factsForm: traced("snow.facts", () => (flags.facts ? "<p>Snow facts</p>" : "")),
    },
    initialCitations: { enabled: traced("initial.enabled", () => flags.initial), preview: traced("initial.preview", () => ({ id: "preview" })) },
    newDocuments: {
      details: traced("new.details", () => (flags.details ? "<p>Details</p>" : "")),
      actionPanel: traced("new.actions", () => "<p>Permitted actions</p>"),
    },
    fmtDate: traced("fmtDate", (v) => String(v || "")),
    citationReview: traced("citationReview", () => "<p>Citation review</p>"),
    documentHTML: traced("documentHTML", () => "<article>Retained printable preview</article>"),
    citationFaces: traced("citationFaces", () => "<section>Initial citation copies</section>"),
    duePanel: traced("duePanel", () => "<p>Due dates</p>"),
    correctionPanel: traced("correctionPanel", () => (flags.correction ? "<p>Correction</p>" : "")),
    recordHistoryHTML: traced("history", () => "<p>Record history</p>"),
    publicationPanel: traced("publication", () => "<p>Publication</p>"),
    filingPanel: traced("filing", () => "<p>Filing</p>"),
    citationRecoveryPanel: traced("recovery", () => "<p>Recovery</p>"),
    app_savedworkContext: traced("savedContext", () => ({
      esc,
      LOCAL_SAVE: { ok: flags.saved, saving: flags.saving, at: flags.saved ? "2026-10-27T12:00:00Z" : "" },
      draftTimer: flags.timer ? 1 : null,
    })),
    screenCases: traced("screenCases", () => "<p>Cases</p>"),
    shell: traced("shell", (title, subtitle, actions, body) => [title, subtitle, actions, body].join("<shell>")),
  };
  const services = new Proxy(methods, {
    get(target, key) {
      calls.push("get:" + String(key));
      if (!(key in target)) throw Error("Missing service " + String(key));
      return target[key];
    },
  });
  const api = createEditorScreens({ ui: services, edit: services, record: services });
  function reset() {
    for (const key of Object.keys(s)) delete s[key];
    const kase = { id: 'c"<&>', number: "CB2026-100-00001", address: "100 TEST <&> ST", owner: "SYNTHETIC <&>", date: "2026-10-20" };
    const d = {
      id: 'd"<&>',
      caseId: kase.id,
      type: flags.type,
      draft: flags.draft,
      void: flags.void,
      mailed: "2026-10-24",
      created: "2026-10-20",
      authoringVersion: flags.version,
      items: Array.from({ length: 3 }, (_, i) => ({
        id: "i" + i,
        no: String(i + 1),
        title: "Wall <&>",
        done: flags.done && i === 1,
        withdrawn: flags.withdrawn && i === 2,
      })),
      cits: flags.held ? { i0: { mandatoryAppearance: true } } : {},
      filedAt: flags.filed ? "2026-10-24" : "",
      pendingAmendment: flags.pending ? { id: "pending" } : null,
      superseded: flags.superseded ? { replacedBy: "replacement<&>" } : null,
      revision: flags.revision ? { number: 2 } : null,
      correction: flags.correction ? { case: { ...kase, owner: "CORRECTED" } } : null,
      fromReinspId: flags.visit ? "r" : null,
      frozen: flags.frozen ? { case: { ...kase, owner: "ISSUED" } } : null,
    };
    Object.assign(s, {
      CASES: [kase],
      DOCS: flags.missing ? [] : [d],
      REINSP: flags.visit ? [{ id: "r", draft: flags.visitDraft }] : [],
      EVENTS: {},
      PENDING: [],
      CASEDIR: flags.folder ? {} : null,
      DIRTY: false,
      WORK: { entry: {}, recordForms: {} },
      RECORD_ATTEMPTS: flags.note ? { note: { cid: kase.id, recordKey: "note", pendingAmendment: { payload: { docId: d.id } } } } : {},
      state: {
        screen: "write",
        docId: d.id,
        modal: null,
        publicationBusy: flags.busy ? d.id : null,
        compactCitationCopies: flags.compact ? d.id : null,
      },
    });
    calls = [];
  }
  let total = 0;
  function outcome(fn) {
    try {
      return { html: fn(), calls: [...calls], state: JSON.stringify(s) };
    } catch (error) {
      return { error: { name: error.name, message: error.message }, calls: [...calls], state: JSON.stringify(s) };
    }
  }
  function compare(input) {
    flags = input;
    reset();
    const expected = outcome(api.referenceScreenWrite);
    reset();
    const actual = outcome(api.screenWrite);
    assert.equal(actual.error, undefined, JSON.stringify(input));
    assert.equal(typeof actual.html, "string");
    // The one intentional change: when Correct and Withdraw are unavailable the sentence from the single eligibility
    // read is shown. It appears only if that read happened and returned a reason; everything else must match exactly.
    const unavailable = /<p class="hint" id="correct-unavailable">Correct and Withdraw are unavailable: [^<]*<\/p>/;
    // An issued, locked document with no pending save and a reason from the eligibility read always shows it.
    if (!input.missing && input.locked && !input.draft && !input.pending && !input.note && !input.busy && input.eligible)
      assert.ok(unavailable.test(actual.html), "the reason Correct and Withdraw are unavailable is shown: " + JSON.stringify(input));
    if (unavailable.test(actual.html)) {
      assert.ok(actual.calls.includes("call:correctionEligibility") && input.eligible, "the note needs a reason from the eligibility read");
      assert.equal((actual.html.match(/id="correct-unavailable"/g) || []).length, 1);
      actual.html = actual.html.replace(unavailable, "");
    }
    if (!input.missing && input.note && !input.invalid) assert.match(actual.html, /Confirm saved action/);
    if (!input.missing && input.pending && !input.note && !input.invalid) assert.match(actual.html, /Confirm save/);
    if (!input.missing && input.busy && !input.note && !input.pending && !input.invalid) assert.match(actual.html, /Finishing document save/);
    assert.deepEqual(actual, expected, JSON.stringify(input));
    reset();
    const expectedReview = outcome(api.referenceReviewModalHTML);
    reset();
    const actualReview = outcome(api.reviewModalHTML);
    assert.deepEqual(actualReview, expectedReview, "Review dialog: " + JSON.stringify(input));
    total++;
  }
  const base = {
    type: "notice",
    version: 16,
    checks: 3,
    draft: true,
    locked: false,
    structural: true,
    eligible: false,
    invalid: false,
    snow: false,
    initial: false,
    facts: false,
    details: false,
    correction: false,
    saved: true,
    saving: false,
    timer: false,
    void: false,
    done: false,
    withdrawn: false,
    held: false,
    filed: false,
    pending: false,
    superseded: false,
    revision: false,
    visit: false,
    visitDraft: false,
    frozen: false,
    note: false,
    busy: false,
    compact: false,
    folder: false,
    missing: false,
  };
  compare(base);
  compare({ ...base, missing: true });
  for (const key of Object.keys(base).filter((key) => typeof base[key] === "boolean")) compare({ ...base, [key]: !base[key] });
  const shape = Object.fromEntries(
    Object.keys(base)
      .filter((key) => key !== "missing" && typeof base[key] === "boolean")
      .map((key) => [key, fc.boolean()]),
  );
  for (const sample of fc.sample(
    fc.record({
      ...shape,
      type: fc.constantFrom("notice", "citation", "extension", "compliance", "referral", "referralUpdate", "bestInterestExtension"),
      version: fc.constantFrom(9, 11, 16),
      checks: fc.integer({ min: 0, max: 5 }),
    }),
    { seed: 20261028, numRuns: 2000 },
  ))
    compare({ ...sample, missing: false });
  dom.window.close();
  console.log("PASS exact editor HTML, state and ordered service effects", total, "draft/retained/lock/correction/citation states");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
