/* Feature suite (Consolidation Phase 6): Order language catalog: dotted ordinance references normalize to the catalog entry and pricing.
   Each scenario runs in its own process with a fresh bundle, DOM, state, storage and mocks
   (tests/fixtures/scenarios.cjs). Labels name the suite each scenario came from; its code is unchanged. */
require("../fixtures/scenarios.cjs").run(__filename, {
  "audit_r61_development.js: 27.05(2)(g)2 catalog normalization, pricing and legacy classification": () => {
    globalThis.MADISON_TEST_DATA = true;
    globalThis.CURRENT_AUTHORING = require("../fixtures/authoring_expectations.cjs");
    require("../fixtures/bundle_test.cjs")(`
  saveDrafts = async () => true; scheduleDraftSave = () => {};
  WriterState.DOCS = []; WriterState.REINSP = []; WriterState.EVENTS = {}; WriterState.PENDING = [];
  const stamp = recordDay(today);
  const entries=allItems().filter(i=>i.s.includes('27.05(2)(g)2'));
  assert.equal(entries.length,19);
  assert.equal(canonicalOrdinance('27.05(2)(g)2'),canonicalOrdinance('27.05(2)(g)2.'));
  assert.deepEqual(resolveCitationAmount({ordinance:'27.05(2)(g)2',date:stamp}),resolveCitationAmount({ordinance:'27.05(2)(g)2.',date:stamp}));
  assert.ok(!allItems().some(i=>i.s.includes('27.05(2)(g)2.')));
  const legacyMatch=entries.find(entry=>violationType({title:entry.t,sections:entry.s}).how==='matched');assert.ok(legacyMatch);
  const currentClassification=violationType({title:legacyMatch.t,sections:legacyMatch.s});
  assert.deepEqual(violationType({title:legacyMatch.t,sections:legacyMatch.s.map(s=>s==='27.05(2)(g)2'?'27.05(2)(g)2.':s)}),currentClassification,'legacy title/section classification survives display punctuation');
  console.log('PASS audit_r61_development.js: 27.05(2)(g)2 catalog normalization, pricing and legacy classification');
`);
  },
});
