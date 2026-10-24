/* Feature suite (Consolidation Phase 6): Correction review: monetary and policy values shown in correction changes.
   Each scenario runs in its own process with a fresh bundle, DOM, state, storage and mocks
   (tests/fixtures/scenarios.cjs). Labels name the suite each scenario came from; its code is unchanged. */
require("../fixtures/scenarios.cjs").run(__filename, {
  "audit_r61_development.js: correction value text for money, assessments, overrides and ordinances": () => {
    globalThis.MADISON_TEST_DATA = true;
    globalThis.CURRENT_AUTHORING = require("../fixtures/authoring_expectations.cjs");
    require("../fixtures/bundle_test.cjs")(`
  saveDrafts = async () => true; scheduleDraftSave = () => {};
  WriterState.DOCS = []; WriterState.REINSP = []; WriterState.EVENTS = {}; WriterState.PENDING = [];
  const stamp = recordDay(today);
  assert.equal(correctionValueText('citation.1.base',100),'$100.00');
  assert.equal(correctionValueText('citation.1.amount','197.00'),'$197.00');
  assert.equal(correctionValueText('citation.1.cc',0),'$0.00');
  assert.equal(correctionValueText('citation.1.amount','1234.50'),'$1,234.50');
  for (const value of [null,undefined,'',false,'NaN','1.234']) assert.equal(correctionValueText('citation.1.base',value),'—');
  const assessment = {base:10000,penalty:2600,jail:1000,crimeLab:1300,court:4800,total:19700};
  const savedAssessment = JSON.stringify(assessment);
  assert.equal(correctionValueText('citation.1.assessments',assessment),'Base: $100.00; Penalty assessment: $26.00; Jail assessment: $10.00; Crime lab: $13.00; Court costs: $48.00; Total: $197.00');
  assert.equal(JSON.stringify(assessment),savedAssessment,'display never changes stored cents');
  assert.equal(correctionValueText('citation.1.overrideBasis',{totalCents:32300,tier:2}),'Total: $323.00; tier: 2');
  assert.equal(correctionValueText('citation.1.ord','27.05(2)(g)2.'),'27.05(2)(g)2.');
  console.log('PASS audit_r61_development.js: correction value text for money, assessments, overrides and ordinances');
`);
  },
});
