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
  "ui_icons.js": [],
  "address_format.js": ["./mailing_rules.js"],
  "presentation_format.js": [],
  "mailing_rules.js": [],
  "state.js": [],
  "imports_state.js": ["./state.js"],
  "startup_state.js": ["./state.js"],
  "catalog_state.js": ["./state.js"],
  "workspace_state.js": ["./state.js"],
  "record_values.js": [],
  "calendar.js": ["../assets/shared.js"],
  "inspection_facts.js": ["./calendar.js", "./document_rules.js", "./writer_queries.js"],
  "document_types.js": ["./data/approved_language.js", "./citation_policy.js"],
  "document_rules.js": ["./document_types.js"],
  "writer_queries.js": ["./workspace_state.js", "./data/inspectors.js", "./document_rules.js", "./record_sources.js"],
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
  "utility_events.js": ["./event_registration.js", "./imports_state.js", "./state.js", "./writer_queries.js"],
  "import_events.js": ["./event_registration.js", "./imports_state.js", "./state.js"],
  "desktop_exit.js": ["./app_core.js", "./helper_stopped.js", "./helper_transport.js", "./saved_work.js", "./startup_state.js", "./state.js"],
  "workspace_events.js": ["./imports_state.js", "./event_registration.js", "./startup_state.js", "./state.js", "./writer_queries.js"],
  "catalog_events.js": [
    "./calendar.js",
    "./catalog_state.js",
    "./data/library.js",
    "./document_rules.js",
    "./event_registration.js",
    "./state.js",
    "./writer_queries.js",
  ],
  "due_date_events.js": ["./event_registration.js", "./workspace_state.js"],
  "case_status.js": [
    "../assets/shared.js",
    "./calendar.js",
    "./case_file_rules.js",
    "./case_records.js",
    "./document_rules.js",
    "./document_types.js",
    "./pdf_artifacts.js",
    "./state.js",
    "./writer_queries.js",
  ],
  "citation_history.js": ["../assets/shared.js", "./calendar.js", "./writer_queries.js"],
  "workspace_screen.js": [
    "./case_file_rules.js",
    "./case_records.js",
    "./data/inspectors.js",
    "./document_types.js",
    "./presentation_format.js",
    "./state.js",
    "./ui_icons.js",
    "./working_papers.js",
    "./workspace_queue.js",
    "./writer_queries.js",
  ],
  "language_views.js": ["./language_discovery.js"],
  "screen_overlays.js": [
    "../assets/shared.js",
    "./calendar.js",
    "./document_types.js",
    "./mailing_rules.js",
    "./presentation_format.js",
    "./state.js",
    "./writer_queries.js",
  ],
  "app_screens.js": [
    "./startup_state.js",
    "./helper_stopped.js",
    "./language_discovery.js",
    "./presentation_format.js",
    "./state.js",
    "./writer_queries.js",
  ],

  "workspace_shell.js": ["./presentation_format.js", "./data/build_identity.js", "./saved_work.js"],
  "browser_printing.js": ["./data/approved_print_style.js", "./presentation_format.js", "./writer_queries.js", "./state.js"],
  "storage_status.js": ["../assets/shared.js", "./presentation_format.js", "./data/build_identity.js", "./state.js"],
  "storage_probe.js": ["./calendar.js", "./workspace_state.js"],
  "helper_requests.js": ["./helper_transport.js"],
  "case_summary_adapter.js": [
    "./case_projection.js",
    "./data/inspectors.js",
    "./data/library.js",
    "./data/build_identity.js",
    "./workspace_state.js",
    "./calendar.js",
  ],
  "record_event_log.js": ["./document_types.js", "./calendar.js", "./writer_queries.js", "./workspace_state.js", "./contracts.js"],
  "folder_connections.js": ["./state.js"],
  "writer_startup.js": ["./startup_state.js", "./state.js"],
  "case_workspace_actions.js": ["./record_values.js", "./case_file_rules.js", "./writer_queries.js", "./state.js"],
  "reinspection_entry.js": ["./inspection_facts.js", "../assets/shared.js", "./writer_queries.js", "./state.js"],
  "local_case_files.js": [],
  "draft_save_controls.js": ["./state.js", "./saved_work.js"],
  "case_folder_workflow.js": [
    "./case_records.js",
    "./case_file_rules.js",
    "./case_migrations.js",
    "./writer_queries.js",
    "./calendar.js",
    "./state.js",
  ],
  "recipient_workflow.js": ["./address_format.js", "./mailing_rules.js", "./writer_queries.js", "./state.js"],
  "record_ids.js": [],
  "catalog_queries.js": ["./data/library.js"],
  "document_readiness.js": [
    "./case_records.js",
    "./inspection_facts.js",
    "../assets/shared.js",
    "./document_rules.js",
    "./presentation_format.js",
    "./writer_queries.js",
    "./calendar.js",
    "./mailing_rules.js",
  ],
  "document_feedback.js": ["./state.js", "./writer_queries.js"],
  "document_sources.js": [
    "./writer_queries.js",
    "./document_rules.js",
    "./document_types.js",
    "./citation_policy.js",
    "./record_values.js",
    "./calendar.js",
  ],
  "court_scheduling.js": ["../assets/shared.js", "./calendar.js", "./document_types.js", "./workspace_state.js"],
  "citation_charges.js": ["./citation_policy.js", "./document_types.js", "./writer_queries.js", "./record_values.js", "./document_rules.js"],
  "document_printing.js": ["../assets/shared.js", "./document_types.js", "./document_rules.js", "./writer_queries.js", "./state.js"],
  "document_delivery.js": [
    "../assets/shared.js",
    "./document_types.js",
    "./writer_queries.js",
    "./mailing_rules.js",
    "./case_records.js",
    "./state.js",
  ],
  "citation_drafts.js": [
    "./citation_policy.js",
    "../assets/shared.js",
    "./inspection_facts.js",
    "./document_rules.js",
    "./document_types.js",
    "./writer_queries.js",
    "./workspace_state.js",
  ],
  "visit_recording.js": ["./worksheet_workflow.js", "./case_records.js", "./workspace_state.js"],
  "working_papers.js": [
    "./document_rules.js",
    "./writer_queries.js",
    "./mailing_rules.js",
    "./presentation_format.js",
    "./record_values.js",
    "./state.js",
  ],
  "inspection_history.js": ["./inspection_facts.js", "./document_rules.js", "./writer_queries.js"],
  "correction_ui.js": [
    "../assets/shared.js",
    "./document_rules.js",
    "./citation_policy.js",
    "./writer_queries.js",
    "./document_types.js",
    "./presentation_format.js",
    "./data/inspectors.js",
    "./state.js",
  ],
  "record_actions.js": ["./document_rules.js", "./writer_queries.js", "./state.js"],
  "recovery_ui.js": ["./case_recovery.js", "./presentation_format.js", "./state.js"],
  "catalog_forms.js": ["./document_rules.js", "./data/library.js", "./catalog_state.js"],
  "record_history.js": ["../assets/shared.js", "./writer_queries.js", "./presentation_format.js", "./state.js"],
  "worksheet_workflow.js": [
    "./deadline_assignment.js",
    "./inspection_facts.js",
    "../assets/shared.js",
    "./record_values.js",
    "./document_types.js",
    "./writer_queries.js",
    "./document_rules.js",
    "./calendar.js",
    "./state.js",
  ],
  "case_recovery.js": ["./case_file_rules.js", "./document_types.js", "./record_values.js", "./writer_queries.js", "./case_records.js", "./state.js"],
  "automatic_recovery.js": ["./record_values.js", "./writer_queries.js", "./calendar.js", "./data/build_identity.js", "./state.js"],
  "workspace_backup.js": [
    "../assets/shared.js",
    "./case_file_rules.js",
    "./case_records.js",
    "./record_values.js",
    "./document_types.js",
    "./calendar.js",
    "./data/build_identity.js",
    "./state.js",
  ],
  "case_records.js": [
    "./case_projection.js",
    "./record_values.js",
    "../assets/shared.js",
    "./case_file_rules.js",
    "./document_types.js",
    "./calendar.js",
    "./writer_queries.js",
    "./data/inspectors.js",
    "./state.js",
  ],
  "case_loading.js": [
    "./case_file_rules.js",
    "./case_migrations.js",
    "./record_values.js",
    "./case_records.js",
    "./writer_queries.js",
    "./data/inspectors.js",
    "./state.js",
  ],
  "shared_case_storage.js": [
    "../assets/shared.js",
    "./record_values.js",
    "./case_file_rules.js",
    "./calendar.js",
    "./workspace_state.js",
    "./contracts.js",
  ],
  "pending_case_saves.js": ["./calendar.js", "./writer_queries.js", "./workspace_state.js"],
  "case_save_workflow.js": ["./case_file_rules.js", "./calendar.js", "./writer_queries.js", "./workspace_state.js"],
  "workspace_database.js": ["./state.js"],
  "draft_persistence.js": ["./startup_state.js", "./state.js", "./record_values.js", "./writer_queries.js", "./document_rules.js", "./calendar.js"],
  "correction_preparation.js": [
    "./inspection_facts.js",
    "./calendar.js",
    "./document_rules.js",
    "../assets/shared.js",
    "./record_values.js",
    "./document_types.js",
    "./writer_queries.js",
    "./mailing_rules.js",
    "./workspace_state.js",
  ],
  "correction_workflow.js": ["../assets/shared.js", "./record_values.js", "./writer_queries.js", "./state.js"],
  "publication_preparation.js": [
    "./inspection_facts.js",
    "../assets/shared.js",
    "./record_values.js",
    "./document_types.js",
    "./writer_queries.js",
    "./document_rules.js",
    "./calendar.js",
  ],
  "publication_workflow.js": [
    "./record_values.js",
    "./document_types.js",
    "./writer_queries.js",
    "./document_rules.js",
    "./presentation_format.js",
    "./state.js",
  ],
  "record_commit.js": ["./case_file_rules.js", "./record_values.js", "./writer_queries.js", "./calendar.js", "./state.js"],
  "citation_workflow.js": [
    "./deadline_assignment.js",
    "./inspection_facts.js",
    "../assets/shared.js",
    "./record_values.js",
    "./document_types.js",
    "./calendar.js",
    "./presentation_format.js",
    "./writer_queries.js",
    "./document_rules.js",
    "./citation_policy.js",
  ],
  "item_selection.js": ["./record_values.js", "./document_rules.js", "./data/library.js"],
  "workspace_tasks.js": ["./document_types.js", "./writer_queries.js", "./pdf_artifacts.js", "./presentation_format.js", "./state.js"],
  "deadline_assignment.js": [
    "./calendar.js",
    "./record_values.js",
    "./document_rules.js",
    "./writer_queries.js",
    "./presentation_format.js",
    "./state.js",
  ],
  "writer_handoff.js": ["./startup_state.js", "../assets/shared.js", "./case_file_rules.js", "./state.js"],
  "pdf_artifacts.js": ["./document_rules.js", "./writer_queries.js", "./presentation_format.js", "./state.js", "./helper_transport.js"],
  "case_activity.js": [
    "../assets/shared.js",
    "./calendar.js",
    "./document_rules.js",
    "./presentation_format.js",
    "./writer_queries.js",
    "./state.js",
  ],
  "reinspection.js": [
    "../assets/shared.js",
    "./record_values.js",
    "./document_types.js",
    "./writer_queries.js",
    "./calendar.js",
    "./presentation_format.js",
    "./document_rules.js",
    "./mailing_rules.js",
    "./data/inspectors.js",
    "./state.js",
    "./citation_policy.js",
  ],
  "language_catalog.js": [
    "./catalog_state.js",
    "../assets/shared.js",
    "./record_values.js",
    "./case_file_rules.js",
    "./writer_queries.js",
    "./presentation_format.js",
    "./calendar.js",
    "./data/build_identity.js",
    "./state.js",
    "./saved_work.js",
  ],
  "reports_services.js": ["./helper_stopped.js", "../assets/shared.js", "./state.js", "./helper_transport.js", "./report_presentation.js"],
  "reports_screens.js": ["../assets/shared.js", "./data/build_identity.js", "./state.js", "./report_presentation.js"],
  "reports_view_contexts.js": ["./state.js"],
  "deposit_schedule.js": ["../assets/shared.js", "./citation_policy.js"],
  "accela_import.js": [
    "./imports_state.js",
    "./inspection_facts.js",
    "./writer_queries.js",
    "./record_values.js",
    "./case_file_rules.js",
    "./document_types.js",
    "./document_rules.js",
    "./calendar.js",
    "./presentation_format.js",
    "./state.js",
    "./helper_transport.js",
    "./data/inspectors.js",
    "../assets/shared.js",
  ],
  "navigation.js": ["./startup_state.js", "./data/build_identity.js", "./state.js"],
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
  "deposit_step.js": ["./citation_policy.js", "./document_rules.js", "./presentation_format.js", "./workspace_state.js", "./writer_queries.js"],
  "initial_citations.js": ["./citation_policy.js", "./document_types.js", "./presentation_format.js", "./record_values.js", "./writer_queries.js"],
  "language_actions.js": ["./catalog_state.js", "./state.js"],

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
    "./catalog_state.js",
    "./case_file_rules.js",
    "./data/library.js",
    "./document_rules.js",
    "./presentation_format.js",
    "./state.js",
    "./writer_queries.js",
  ],
  "document_pagination.js": ["./document_rules.js", "./document_types.js", "./presentation_format.js", "./state.js", "./writer_queries.js"],
  "editor_screens.js": [
    "../assets/shared.js",
    "./document_rules.js",
    "./document_types.js",
    "./language_discovery.js",
    "./presentation_format.js",
    "./saved_work.js",
    "./state.js",
    "./writer_queries.js",
  ],
};
for (const [name, dependencies] of Object.entries({ ...allowed, ...scopedServices })) {
  for (const dependency of graph.imports[name]) assert.ok(dependencies.includes(dependency), `${name} must not depend on ${dependency}`);
  assert.ok(!graph.cycles.some((cycle) => cycle.includes(name)), `${name} must stay outside UI cycles`);
}
assert.deepEqual(graph.cycles, [], "Writer and Reports must remain acyclic");
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
      largestCycle: Math.max(0, ...graph.cycles.map((c) => c.length)),
      isolatedFoundations: Object.keys(allowed).length,
      isolatedServices: Object.keys(scopedServices).length,
    }),
  );
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
