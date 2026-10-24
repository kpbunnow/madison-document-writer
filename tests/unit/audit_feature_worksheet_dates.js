/* Feature suite (Consolidation Phase 6): Reinspection worksheet due dates: batch dates with an undecided follow-up and stale hidden selections.
   Each scenario runs in its own process with a fresh bundle, DOM, state, storage and mocks
   (tests/fixtures/scenarios.cjs). Labels name the suite each scenario came from; its code is unchanged. */
require("../fixtures/scenarios.cjs").run(__filename, {
  "audit_r60_review_fixes.js: batch dates with an undecided follow-up; Apply uses the visible selection": () => {
    globalThis.MADISON_TEST_DATA = true;
    require("../fixtures/bundle_test.cjs")(`
  global.Event = window.Event;
  Object.defineProperty(window.HTMLElement.prototype,"isContentEditable",{get(){return this.getAttribute("contenteditable")==="true";},configurable:true});
  Object.defineProperty(window.HTMLElement.prototype,"innerText",{get(){return this.textContent;},set(value){this.textContent=value;},configurable:true});
  saveDrafts = async () => true;
  scheduleDraftSave = () => {};
  WriterState.PENDING = []; WriterState.EVENTS = {}; WriterState.DOCS = []; WriterState.REINSP = [];
  // Batch dates: an import rule that asks for a choice leaves followupIntent "" (or legacy null); the panel shows,
  // so applying must work too.
  const root = {id:'root',caseId:'k1',type:'notice',draft:false,status:'Final',inspDate:'2026-03-07',items:[
    {id:'a',no:'1',sections:['27.05(2)(c)'],text:'Repair wall.',due:'2026-11-01'},
    {id:'b',no:'2',sections:['27.05(2)(c)'],text:'Repair door.',due:'2026-11-01'}]};
  WriterState.DOCS = [root];
  const date = addDays(recordDay(today), 21);
  for (const intent of ['', null, undefined, 'undecided']) {
    const visit = {id:'v-'+String(intent),caseId:'k1',sourceDocId:'root',date:recordDay(today),draft:true,followupIntent:intent,
      results:{a:{oc:'none',due:''},b:{oc:'progress',due:''}}};
    WriterState.REINSP = [visit];
    assert.equal(assignDue(visit,true,date,['a']), '', 'follow-up intent ' + JSON.stringify(intent) + ' accepts batch dates');
    assert.equal(visit.results.a.due, date);
  }
  const decided = {id:'v-ref',caseId:'k1',sourceDocId:'root',date:recordDay(today),draft:true,followupIntent:'referral',results:{a:{oc:'none',due:''}}};
  assert.ok(assignDue(decided,true,date,['a']), 'a referral follow-up still has no batch due dates');

  // A selected item that has since been corrected no longer has a checkbox; Apply uses the visible selection.
  const visit = {id:'v-stale',caseId:'k1',sourceDocId:'root',date:recordDay(today),draft:true,followupIntent:'',
    results:{a:{oc:'none',due:''},b:{oc:'none',due:''}}};
  WriterState.REINSP = [visit];
  WriterState.state.screen = 'reinspect'; WriterState.state.reinspId = visit.id;
  visit.dueWork = {selected:['a','b'], date};
  visit.results.a = {oc:'corrected', on: recordDay(today)};
  render();
  assert.ok(document.querySelector('#btn-bulkdue'));
  assert.equal(document.querySelectorAll('[data-due-select]').length, 1, 'only the outstanding item can be selected');
  document.querySelector('#btn-bulkdue').click();
  assert.equal(visit.results.b.due, date, 'the visible selection is applied');
  assert.equal(visit.results.a.due, undefined, 'the corrected item is not given a due date');
  assert.deepEqual(visit.dueWork.selected.filter(id => id === 'a'), [], 'the hidden selection is dropped');
  console.log('PASS audit_r60_review_fixes.js: batch dates with an undecided follow-up; Apply uses the visible selection');
`);
  },
});
