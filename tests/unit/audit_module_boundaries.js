/* Foundations load without UI/startup and continue to observe restored workspace state. */
const assert = require("assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const esbuild = require("esbuild");
const { moduleGraph } = require("../../tools/module_graph.cjs");
const root = path.resolve(__dirname, "../..");
const directory = path.join(root, "app/modules");
const graph = moduleGraph(directory);
const allowed = {
  "presentation_format.js": [],
  "mailing_rules.js": [],
  "state.js": [],
  "record_values.js": [],
  "calendar.js": ["../assets/shared.js"],
  "document_types.js": ["./data/approved_language.js", "./citation_policy.js"],
  "document_rules.js": ["./document_types.js"],
  "writer_queries.js": ["./state.js", "./data/inspectors.js", "./document_rules.js", "./record_sources.js"],
  "record_sources.js": ["./document_rules.js", "./document_types.js"],
  "case_migrations.js": ["./document_types.js", "./record_values.js"],
  "case_file_rules.js": ["../assets/shared.js", "./record_values.js", "./document_rules.js"],
  "case_projection.js": [
    "./data/library.js",
    "../assets/shared.js",
    "./document_types.js",
    "./document_rules.js",
    "./calendar.js",
    "./record_values.js",
    "./presentation_format.js",
    "./citation_policy.js",
    "./record_sources.js",
    "./case_file_rules.js",
  ],
  "citation_policy.js": ["./data/citation_policy.js"],
};
const scopedServices = {
  "navigation.js": ["./data/build_identity.js", "./state.js"],
  "snow_cases.js": [
    "../assets/shared.js",
    "./calendar.js",
    "./citation_policy.js",
    "./data/library.js",
    "./data/snow_letter.js",
    "./document_rules.js",
    "./document_types.js",
    "./presentation_format.js",
    "./record_values.js",
    "./state.js",
    "./writer_queries.js",
  ],
  "citation_pricing.js": [
    "../assets/shared.js",
    "./calendar.js",
    "./citation_policy.js",
    "./document_rules.js",
    "./helper_transport.js",
    "./state.js",
    "./writer_queries.js",
  ],
  "deposit_step.js": ["./citation_policy.js", "./document_rules.js", "./presentation_format.js", "./state.js", "./writer_queries.js"],
  "initial_citations.js": ["./citation_policy.js", "./document_types.js", "./presentation_format.js", "./record_values.js", "./writer_queries.js"],
  "language_actions.js": ["./state.js"],

  "administration.js": [
    "./citation_policy.js",
    "./document_rules.js",
    "./presentation_format.js",
    "./record_values.js",
    "./state.js",
    "./writer_queries.js",
  ],
  "address_parser.js": ["./mailing_rules.js", "./presentation_format.js", "./state.js", "./writer_queries.js"],
  "new_documents.js": [
    "../assets/shared.js",
    "./calendar.js",
    "./case_projection.js",
    "./data/inspectors.js",
    "./document_rules.js",
    "./document_types.js",
    "./presentation_format.js",
    "./record_values.js",
    "./state.js",
    "./writer_queries.js",
  ],
  "test_fixtures.js": [
    "../assets/shared.js",
    "./calendar.js",
    "./document_types.js",
    "./mailing_rules.js",
    "./record_values.js",
    "./state.js",
    "./writer_queries.js",
  ],
  "document_render.js": [
    "../assets/shared.js",
    "./citation_policy.js",
    "./data/build_identity.js",
    "./data/inspectors.js",
    "./document_rules.js",
    "./document_types.js",
    "./mailing_rules.js",
    "./presentation_format.js",
  ],
  "app_view_contexts.js": [
    "./case_file_rules.js",
    "./data/library.js",
    "./document_rules.js",
    "./presentation_format.js",
    "./state.js",
    "./writer_queries.js",
  ],
  "document_pagination.js": ["./document_rules.js", "./document_types.js", "./presentation_format.js", "./state.js", "./writer_queries.js"],
};
for (const [name, dependencies] of Object.entries({ ...allowed, ...scopedServices })) {
  for (const dependency of graph.imports[name]) assert.ok(dependencies.includes(dependency), `${name} must not depend on ${dependency}`);
  assert.ok(!graph.cycles.some((cycle) => cycle.includes(name)), `${name} must stay outside UI cycles`);
}
assert.ok(graph.cycles.length <= 2, "do not introduce another cyclic component");
for (const cycle of graph.cycles) {
  const cap = cycle.includes("app_core.js") ? 12 : cycle.includes("reports_core.js") ? 5 : 0;
  assert.ok(cycle.length <= cap, "do not grow the retained Writer/Reports cycles or introduce an unrelated cycle");
}
// Re-exports, static and dynamic imports all contribute to the graph; source is never evaluated.
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), "module-graph-"));
try {
  fs.writeFileSync(path.join(temporary, "a.js"), 'export * from "././b.js";');
  fs.writeFileSync(path.join(temporary, "b.js"), 'import("./a.js");');
  fs.writeFileSync(path.join(temporary, "self.js"), 'import "./self.js";');
  fs.writeFileSync(path.join(temporary, "unknown.js"), "import(target); import(42);");
  const fixture = moduleGraph(temporary);
  assert.deepEqual(fixture.cycles, [["a.js", "b.js"], ["self.js"]]);
  assert.deepEqual(fixture.imports["unknown.js"], ["<dynamic>"]);
} finally {
  fs.rmSync(temporary, { recursive: true, force: true });
}
(async () => {
  const result = await esbuild.build({
    stdin: {
      contents: `export * from './writer_queries.js'; export * from './document_rules.js';
        export * from './document_types.js'; export * from './calendar.js'; export * from './record_values.js';
        export * from './presentation_format.js'; export * from './mailing_rules.js';
        export { WriterState } from './state.js';`,
      resolveDir: directory,
    },
    bundle: true,
    format: "cjs",
    write: false,
    plugins: [
      {
        name: "data",
        setup(build) {
          build.onResolve({ filter: /\/data\// }, (args) => ({ path: path.join(root, "build/generated/modules/data", path.basename(args.path)) }));
        },
      },
    ],
  });
  const box = { exports: {} };
  new Function("module", "exports", result.outputFiles[0].text)(box, box.exports);
  const q = box.exports,
    state = q.WriterState;
  assert.deepEqual(state, {}, "loading foundations must not initialize or restore the workspace");
  state.CASES = [{ id: "c", owner: "Current owner" }];
  state.DOCS = [];
  state.REINSP = [];
  state.EVENTS = {};
  assert.equal(q.kase("c").owner, "Current owner");
  state.CASES = [{ id: "c", owner: "Restored owner" }];
  assert.equal(q.kase("c").owner, "Restored owner", "queries must not retain a pre-restoration array");
  const frozen = { owner: "Issued owner" },
    corrected = { owner: "Correction owner" };
  assert.equal(q.docCase({ caseId: "c", frozen: { case: frozen } }), frozen);
  assert.equal(q.docCase({ caseId: "c", frozen: { case: frozen }, correction: { case: corrected } }), corrected);
  assert.deepEqual(q.kase("missing"), {});
  assert.equal(q.doc("missing"), undefined);
  state.DOCS = [{ id: "compliance", caseId: "c", type: "compliance" }];
  assert.equal(q.isReferredCase("c"), false, "compliance history is not referral status");
  state.DOCS = [{ id: "ref", caseId: "c", type: "referral" }];
  assert.equal(q.isReferredCase("c"), true);
  state.DOCS[0].void = true;
  assert.equal(q.isReferredCase("c"), false);
  const retained = q.eventsFor("c");
  retained.push(
    { id: "z", type: "notice.issued", at: "2026-10-24T12:00:00Z" },
    { id: "a", type: "document.served", at: "2026-10-24T12:01:00Z" },
    { id: "draft", type: "draft.changed" },
  );
  assert.equal(q.eventsFor("c"), retained);
  assert.deepEqual(q.recordHead("c"), ["a", "z"]);
  state.EVENTS = { c: [{ id: "restored", type: "correction.issued" }] };
  assert.deepEqual(q.recordHead("c"), ["restored"]);
  for (const version of [11, 12, 13, 14, 15, 16]) {
    const best = { type: "bestInterestExtension", authoringVersion: version };
    assert.equal(q.alignedExtension(best), version >= 12);
    assert.equal(q.datedExtension(best), version >= 13);
    assert.equal(q.simplifiedBestInterest(best), version >= 15);
    assert.equal(q.allItemExtension(best), version >= 16);
  }
  const issued = { draft: false, importRule: { cite: false }, items: [{ id: "i", cite: true }] };
  assert.equal(q.clearProhibitedCitations(issued), false);
  assert.equal(issued.items[0].cite, true);
  const draft = { ...issued, draft: true, items: [{ id: "i", cite: true }], cits: { i: { num: "retained" } } };
  assert.equal(q.clearProhibitedCitations(draft), true);
  assert.equal(draft.items[0].cite, false);
  assert.deepEqual(draft.cits, {});
  assert.equal(q.esc('<a x="1">&\''), "&lt;a x=&quot;1&quot;&gt;&amp;&#39;");
  assert.equal(q.countBlanks("( ) and (   )"), 2);
  assert.equal(q.addDays("2026-03-07", 2), "2026-03-09");
  assert.equal(q.daysBetween("2026-03-07", "2026-03-09"), 2);
  assert.equal(q.addDays("2024-02-28", 1), "2024-02-29");
  assert.equal(q.STATE_NAMES.wisconsin, "WI");
  assert.equal(q.US_STATES.has("WI"), true);
  console.log(
    JSON.stringify({
      passed: true,
      modules: Object.keys(graph.edges).length,
      largestCycle: Math.max(...graph.cycles.map((c) => c.length)),
      isolatedFoundations: Object.keys(allowed).length,
      isolatedServices: Object.keys(scopedServices).length,
    }),
  );
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
