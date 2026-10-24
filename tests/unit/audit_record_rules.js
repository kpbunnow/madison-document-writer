/* Record calculations run from explicit facts, without starting Writer or using UI/storage/clock services. */
const assert = require("assert/strict");
const path = require("path");
const esbuild = require("esbuild");
const root = path.resolve(__dirname, "../..");
const clone = (value) => JSON.parse(JSON.stringify(value));
function freeze(value) {
  if (value && typeof value === "object") {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
}
(async () => {
  const compiled = await esbuild.build({
    stdin: {
      contents: `export * from './case_migrations.js'; export * from './case_file_rules.js'; export * from './case_projection.js'; export * from './record_sources.js'; export { caseDetails, stableJSON } from './record_values.js'; export { WriterState } from './state.js';`,
      resolveDir: path.join(root, "app/modules"),
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
  new Function("module", "exports", compiled.outputFiles[0].text)(box, box.exports);
  const r = box.exports;
  assert.deepEqual(r.WriterState, {}, "record modules must not initialize/restore workspace state");
  const legacy = freeze({
    format: "madison-case-file",
    schema: 1,
    case: { id: "case1", number: "QA-123", owner: "OWNER" },
    documents: [
      { id: "d2", caseId: "case1", type: "extension", mailed: "2026-02-03", items: [] },
      { id: "d1", caseId: "case1", type: "notice", mailed: "2026-02-01", authoringVersion: 9, items: [] },
    ],
    reinspections: [{ id: "r1", date: "2026-02-02", results: {} }],
  });
  const before = JSON.stringify(legacy);
  const now = Date.now,
    random = Math.random;
  try {
    Date.now = () => {
      throw new Error("ambient clock");
    };
    Math.random = () => {
      throw new Error("ambient randomness");
    };
    const migrated = r.migrate(legacy);
    assert.equal(migrated.schema, 4, "browser legacy migration does not fabricate schema-5 integrity");
    assert.deepEqual(migrated, r.migrate(legacy), "legacy IDs must repeat deterministically");
    assert.deepEqual(
      migrated.events.map((e) => e.id),
      ["mig1_QA123_0000_doc_d1", "mig1_QA123_0002_rein_r1", "mig1_QA123_0001_doc_d2"],
    );
    assert.equal(migrated.events[0].payload.snapshot.authoringVersion, 9);
    assert.equal(JSON.stringify(legacy), before);
    for (const schema of [4, 5]) {
      const existing = { schema };
      assert.equal(r.migrate(existing), existing);
    }
    assert.throws(() => r.migrate({ schema: 6 }), /newer version/);

    const item = { id: "i1", no: "1", title: "SYNTHETIC", text: "Retained wording", sections: ["27.05(2)(c)"], due: "2026-02-10" };
    const base = {
      id: "d1",
      caseId: "case1",
      type: "notice",
      authoringVersion: 9,
      mailed: "2026-02-01",
      items: [item],
      frozen: { case: { id: "case1", owner: "ISSUED OWNER" }, inspector: { id: "inspector1", name: "ISSUED INSPECTOR" }, body: "Retained body" },
    };
    const visit = { id: "r1", sourceDocId: "d1", caseId: "case1", date: "2026-02-02", time: "09:00", results: { i1: { oc: "none" } } };
    const corrected = { ...clone(base), id: "d2", revision: { rootId: "d1" } };
    const events = freeze([
      { id: "e1", at: "2026-02-01T12:00:00Z", by: "inspector1", type: "notice.issued", payload: { snapshot: base } },
      { id: "e2", at: "2026-02-02T12:00:00Z", type: "reinspection.recorded", payload: { reinspection: visit } },
      {
        id: "e3",
        at: "2026-02-03T12:00:00Z",
        type: "correction.issued",
        payload: {
          snapshot: corrected,
          replaces: "d1",
          baseEventId: "e1",
          reason: "Recorded correction",
          visitCorrection: { id: "r1", date: "2026-02-02", time: "09:30", results: { i1: { oc: "corrected", on: "2026-02-02" } } },
        },
      },
      { id: "e4", at: "2026-02-04T12:00:00Z", type: "document.filed", payload: { docId: "d2", filename: "retained.pdf", sha256: "a".repeat(64) } },
    ]);
    const eventBytes = JSON.stringify(events);
    const replay = r.replayEvents(events);
    assert.deepEqual(
      replay.documents.map((d) => d.id),
      ["d2", "d1"],
    );
    assert.equal(replay.documents[1].superseded.replacedBy, "d2");
    assert.equal(replay.documents[0].filedArtifact.filename, "retained.pdf");
    assert.equal(replay.documents[0].authoringVersion, 9);
    assert.equal(replay.documents[0].frozen.body, "Retained body");
    assert.equal(replay.reinspections[0].time, "09:30");
    const carried = r.continuingItemsForVisits(base, replay.reinspections);
    assert.equal(carried[0].done, true);
    assert.equal(carried[0].doneOn, "2026-02-02");
    assert.equal(base.items[0].done, undefined);
    assert.equal(JSON.stringify(events), eventBytes);
    assert.deepEqual(r.replayEvents(events), replay);

    const file = freeze({
      format: "madison-case-file",
      schema: 5,
      case: {
        id: "case1",
        number: "QA-123",
        owner: "CURRENT OWNER",
        address: "100 TEST ROAD",
        ownerAddr: ["100 TEST ROAD"],
        inspectorId: "inspector1",
        parcel: "123-456",
      },
      inspectors: [{ id: "inspector1", name: "FILE INSPECTOR" }],
      events: [events[0]],
    });
    const facts = freeze({ inspectors: [], library: [], cases: [], integrity: { valid: true }, build: "SYNTHETIC", written: "2026-02-05T12:00:00Z" });
    const summary = r.summarizeRecord(file, facts);
    assert.equal(summary.case.owner, "CURRENT OWNER");
    assert.equal(summary.documents[0].by, "ISSUED INSPECTOR");
    assert.equal(summary.case.inspector, "FILE INSPECTOR");
    assert.equal(summary.written, facts.written);
    assert.equal(summary.violations[0].due, "2026-02-10");
    assert.deepEqual(r.summarizeRecord(file, facts), summary);
    assert.equal(r.caseFileFault(file), "");
    const invalid = clone(file);
    invalid.events.push(clone(invalid.events[0]));
    assert.match(r.caseFileFault(invalid), /two events share an id/);
    const unsafe = clone(file);
    unsafe.case.id = "<unsafe>";
    assert.match(r.caseFileFault(unsafe), /identifier/);
    assert.equal(r.correctionHistoryFault(events), "");
    const conflict = clone(events);
    conflict[2].payload.baseEventId = "wrong";
    assert.match(r.correctionHistoryFault(conflict), /Conflicting corrections/);
    const identityChange = clone(events);
    identityChange[2].payload.snapshot.items[0].id = "other";
    assert.match(r.correctionHistoryFault(identityChange), /item identities/);
    const local = { id: "local", owner: "NEW", address: "OLD", savedAt: "device" },
      remote = { id: "remote", owner: "OLD", address: "NEW" },
      baseline = { owner: "OLD", address: "OLD" };
    const merged = r.mergeCaseDetails(freeze(local), freeze(remote), freeze(baseline));
    assert.deepEqual(merged, { id: "local", owner: "NEW", address: "NEW" });
    assert.throws(() => r.mergeCaseDetails({ ...local, address: "DIFFERENT" }, remote, baseline), /Both copies changed address/);
    assert.throws(() => r.mergeCaseDetails(local, remote), /Case details differ/);
    assert.notEqual(r.stableJSON({ flag: false }), r.stableJSON({ flag: 0 }));
    assert.deepEqual(r.caseDetails(local), { id: "local", owner: "NEW", address: "OLD" });
    const cases = [{ id: "case1", owner: "LIVE", caseType: "snow-10.28" }];
    assert.equal(r.recordCase(base, cases), base.frozen.case);
    assert.equal(r.recordCase({ ...base, correction: { case: remote } }, cases), remote);
    assert.equal(r.recordCase({ caseId: "case1" }, cases), cases[0]);
    assert.equal(r.isSnowDocument({ caseId: "case1" }, cases), true);
    assert.equal(r.isSnowDocument({ ...base, caseType: "snow-10.28" }, []), true);
    assert.equal(r.isSnowDocument(base, cases), false, "retained frozen case classification precedes live fallback");
  } finally {
    Date.now = now;
    Math.random = random;
  }
  assert.deepEqual(r.WriterState, {}, "calculations must not mutate the workspace");
  console.log(
    JSON.stringify({
      passed: true,
      standaloneRecords: true,
      deterministicMigration: true,
      immutableReplay: true,
      explicitProjectionFacts: true,
      mergeAndIdentityRefusals: true,
    }),
  );
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
