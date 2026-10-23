/* PR 31 review corrections: batch dates with an undecided follow-up, stale hidden selections, focus after the
   corrective-action dialog closes asynchronously, initial citation numbers in item history, and Workspace as the
   current destination while importing. */
globalThis.MADISON_TEST_DATA = true;
require("../fixtures/bundle_test.cjs")(`
  global.Event = window.Event;
  Object.defineProperty(window.HTMLElement.prototype,"isContentEditable",{get(){return this.getAttribute("contenteditable")==="true";},configurable:true});
  Object.defineProperty(window.HTMLElement.prototype,"innerText",{get(){return this.textContent;},set(value){this.textContent=value;},configurable:true});
  saveDrafts = async () => true;
  scheduleDraftSave = () => {};
  WriterState.PENDING = []; WriterState.EVENTS = {}; WriterState.DOCS = []; WriterState.REINSP = [];

  // Import is entered from Workspace, so Workspace stays the current rail destination.
  WriterState.state.screen = 'import'; render();
  const current = [...document.querySelectorAll('.writer-navigation [aria-current="page"]')].map(x => x.textContent.trim().split('\\n')[0]);
  assert.deepEqual(current, ['Workspace']);

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

  // Corrective-action dialog: the browser fires "close" asynchronously, after the dialog handler's own focus restore.
  WriterState.REINSP = []; WriterState.DOCS = [];
  WriterState.state.screen = 'cases';
  newDoc('k1','notice');
  const d = doc(WriterState.state.docId);
  d.items = [{id:'item1',no:'1',sections:['27.05(2)(c)'],text:'Repair ( ) now.',title:'Wall'}];
  render();
  window.HTMLDialogElement.prototype.close = function() {
    this.open = false;
    setTimeout(() => this.dispatchEvent(new window.Event('close')), 0);
  };
  document.querySelector('.blank-edit').click();
  const form = document.querySelector('#corrective-detail-form');
  form.querySelector('textarea').value = 'the north wall';
  form.dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true}));
  await new Promise(r => setTimeout(r, 20));
  assert.equal(d.items[0].text, 'Repair the north wall now.');
  assert.equal(document.activeElement.dataset.field, 'text', 'focus returns to the item text after the dialog closes');

  // Authoring-14 history keeps the number of a citation issued with the original notice on the first observation.
  const notice = {id:'n1',caseId:'k2',type:'notice',draft:false,status:'Final',inspDate:'2026-03-07',
    items:[{id:'i1',no:'1',sections:['27.05(2)(c)'],text:'Repair wall.',cite:true}]};
  const initialCitation = {id:'c1',caseId:'k2',type:'citation',fromDocId:'n1',draft:false,status:'Final',
    items:[{id:'ci1',no:'1',srcItemId:'i1',cite:true,sections:['27.05(2)(c)'],text:'Repair wall.'}],cits:{ci1:{num:'X1234567'}}};
  WriterState.DOCS = [initialCitation, notice];
  WriterState.REINSP = [{id:'w1',caseId:'k2',sourceDocId:'n1',date:'2026-03-20',results:{i1:{oc:'none',on:'2026-03-20'}}}];
  const referral = {id:'r1',caseId:'k2',type:'referral',authoringVersion:14,draft:true,fromDocId:'n1',fromReinspId:'w1',
    items:[{id:'ri1',no:'1',srcItemId:'i1',sections:['27.05(2)(c)'],text:'Repair wall.'}]};
  const hist = itemInspectionHistory(referral, referral.items[0]);
  assert.deepEqual(hist.map(x => [x.on, x.oc, x.cit]), [['2026-03-07','initial','X1234567'],['2026-03-20','none','']]);
  referral.items[0].hist = hist;
  assert.match(noticeHTML(referral), /Citation X1234567/);
  // A citation that replaced the notice is the root document itself.
  const replaced = {...initialCitation, id:'c2', fromDocId:undefined, inspDate:'2026-03-07',
    items:[{id:'ci2',no:'1',cite:true,sections:['27.05(2)(c)'],text:'Repair wall.'}], cits:{ci2:{num:'X7654321'}}};
  WriterState.DOCS = [replaced];
  WriterState.REINSP = [{id:'w2',caseId:'k2',sourceDocId:'c2',date:'2026-03-20',results:{ci2:{oc:'none',on:'2026-03-20'}}}];
  const ref2 = {...referral, id:'r2', fromDocId:'c2', fromReinspId:'w2', items:[{id:'ri2',no:'1',srcItemId:'ci2',sections:['27.05(2)(c)'],text:'Repair wall.'}]};
  assert.equal(itemInspectionHistory(ref2, ref2.items[0])[0].cit, 'X7654321');
  // An unrelated or voided citation never annotates the history.
  WriterState.DOCS = [{...initialCitation, void:true}, notice];
  WriterState.REINSP = [{id:'w1',caseId:'k2',sourceDocId:'n1',date:'2026-03-20',results:{i1:{oc:'none',on:'2026-03-20'}}}];
  assert.equal(itemInspectionHistory(referral, referral.items[0])[0].cit, '');
  console.log('PASS R60 review corrections: undecided follow-up batch dates, stale selections, dialog focus, initial citation history, Workspace current while importing');
`);
