/* R60 confirmed Workspace, text-entry, worksheet deadlines and item-specific referral rules. */
globalThis.MADISON_TEST_DATA = true;
require("../fixtures/bundle_test.cjs")(`
  global.Event = window.Event;
  Object.defineProperty(window.HTMLElement.prototype,"isContentEditable",{get(){return this.getAttribute("contenteditable")==="true";},configurable:true});
  Object.defineProperty(window.HTMLElement.prototype,"innerText",{get(){return this.textContent;},set(value){this.textContent=value;},configurable:true});
  saveDrafts = async () => true;
  scheduleDraftSave = () => {};
  WriterState.PENDING = []; WriterState.EVENTS = {}; WriterState.DOCS = []; WriterState.REINSP = [];
  WriterState.state.screen = 'cases'; render();
  assert.equal(document.querySelector('.writer-navigation [data-nav="import"]'), null);
  assert.equal(document.querySelectorAll('.workspace-start [data-nav="import"]').length, 1);
  assert.equal(document.querySelectorAll('.workspace-start [data-global-search]').length, 1);
  const loadedCases=WriterState.CASES;WriterState.CASES=[];render();
  assert.equal(document.querySelectorAll('#app [data-nav="import"]').length,1,'one import entry in an empty Workspace');
  WriterState.CASES=loadedCases;
  newDoc('k1','notice');
  const d = doc(WriterState.state.docId);
  d.items = [{id:'item1',no:'1',sections:['27.05(2)(c)'],text:'Repair ( ) and ( ).',title:'Wall'}]; render();
  window.HTMLDialogElement.prototype.close = function() { this.dispatchEvent(new window.Event('close')); };
  let blank = document.querySelector('.blank-edit'); blank.focus(); blank.click();
  assert.equal(document.activeElement.id, 'corrective-detail');
  let form = document.querySelector('#corrective-detail-form');
  form.querySelector('textarea').value = '  <script>unsafe</script> & detail  ';
  form.dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true}));
  assert.equal(d.items[0].text, 'Repair <script>unsafe</script> & detail and ( ).');
  assert.equal(document.querySelector('.desk script'), null);
  assert.equal(document.activeElement.dataset.field, 'text');
  blank = document.querySelector('.blank-edit'); blank.click();
  document.querySelector('#utility-dialog').close();
  assert.equal(d.items[0].text, 'Repair <script>unsafe</script> & detail and ( ).');
  blank.click(); form = document.querySelector('#corrective-detail-form');
  form.querySelector('textarea').value = ' '; form.dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true}));
  assert.ok(document.querySelector('#corrective-detail-error').textContent);
  form.querySelector('textarea').value = 'stale'; d.status = 'Final';
  form.dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true}));
  assert.ok(!d.items[0].text.includes('stale'));
  document.querySelector('#utility-dialog').close();

  const root = {id:'root',caseId:'k1',type:'notice',draft:false,status:'Final',inspDate:'2026-03-07',items:[{id:'a',no:'1',sections:['27.05(2)(c)'],text:'Repair wall.',due:'2026-11-01'}]};
  const extension = {id:'ext',caseId:'k1',type:'extension',fromDocId:'root',fromReinspId:'v1',draft:false,status:'Final',inspDate:'2026-03-09',items:[{...root.items[0],id:'b',srcItemId:'a'},{id:'later',no:'2',sections:[],text:'Later finding.'}]};
  WriterState.DOCS = [extension,root];
  WriterState.REINSP = [
    {id:'v1',caseId:'k1',sourceDocId:'root',date:'2026-03-09',results:{a:{oc:'none',on:'2026-03-09'}}},
    {id:'unrelated',caseId:'k1',sourceDocId:'root',date:'2026-03-10',results:{other:{oc:'none',on:'2026-03-10'}}},
    {id:'v2',caseId:'k1',sourceDocId:'ext',date:'2026-03-15',draft:true,results:{b:{oc:'corrected',on:'2026-03-14'},later:{oc:'none',on:'2026-03-15'}}},
    {id:'carried',caseId:'k1',sourceDocId:'ext',date:'2026-03-20',results:{b:{oc:'corrected',on:'2026-03-14',carried:true}}}
  ];
  const referral = {id:'ref',caseId:'k1',type:'referral',authoringVersion:14,draft:true,fromDocId:'ext',fromReinspId:'v2',items:[{...extension.items[0],id:'c',srcItemId:'b',done:true,doneOn:'2026-03-14'},{...extension.items[1],id:'late-ref',srcItemId:'later'}]};
  const h = itemInspectionHistory(referral,referral.items[0]);
  assert.deepEqual(h.map(x=>x.on), ['2026-03-07','2026-03-09','2026-03-14']);
  assert.deepEqual(itemInspectionHistory(referral,referral.items[1]).map(x=>x.on), ['2026-03-09','2026-03-15']);
  referral.items.forEach(it=>it.hist=itemInspectionHistory(referral,it));
  let printed = document.createElement('div'); printed.innerHTML = noticeHTML(referral);
  assert.match(printed.querySelector('[data-row="c"] .c-due').textContent,/Days Outstanding: 7/);
  assert.match(printed.querySelector('[data-row="late-ref"] .c-due').textContent,/Days Outstanding: 6/);
  assert.ok(printed.querySelector('[data-row="c"] .c-due').textContent.includes('First observed'));
  assert.ok(printed.querySelector('[data-row="c"] .c-due').textContent.includes('Corrected'));
  const frozen = noticeHTML({...clone(referral),draft:false,status:'Final',frozen:freezeSources(referral)});
  WriterState.REINSP.push({id:'v3',caseId:'k1',sourceDocId:'ext',date:'2026-03-21',results:{b:{oc:'none',on:'2026-03-21'}}});
  assert.equal(noticeHTML({...clone(referral),draft:false,status:'Final',frozen:freezeSources(referral)}),frozen,'later visits cannot change retained history');
  const observedLater = clone(referral); observedLater.items[0].hist.push({on:'2026-03-21',oc:'none'});
  assert.match(referralHistoryHTML(observedLater,observedLater.items[0]),/Days Outstanding: 7/);
  const invalid = clone(referral.items[0]); invalid.doneOn = '';
  assert.match(referralHistoryHTML(referral,invalid),/Days Outstanding: Unavailable/);
  for (const [start,end,expected] of [['2024-02-28','2024-03-01',2],['2026-11-01','2026-11-02',1],['2026-03-08','2026-03-08',0]]) {
    const it = {hist:[{on:start,oc:'initial'},{on:end,oc:'none'}]};
    assert.ok(referralHistoryHTML(referral,it).includes('Days Outstanding: '+expected));
  }
  const withdrawn = clone(referral);withdrawn.items[0].withdrawn=true;withdrawn.items[0].done=false;withdrawn.items[0].doneOn='';
  printed.innerHTML=noticeHTML(withdrawn);
  const withdrawnHistory=printed.querySelector('[data-row="c"] .c-due').textContent;
  assert.match(withdrawnHistory,/Withdrawn.*Entered in error/);
  assert.match(withdrawnHistory,/First observed/);
  assert.match(withdrawnHistory,/Days Outstanding: Unavailable/);
  const old = {...clone(referral),authoringVersion:13};
  assert.ok(!noticeHTML(old).includes('Days Outstanding'));
  assert.ok(!noticeHTML(old).includes('First observed'));

  const visit = WriterState.REINSP.find(r=>r.id==='v2');
  visit.date = recordDay(today); visit.results.b = {oc:'none',due:''}; visit.results.later={oc:'corrected',carried:true};
  WriterState.state.screen='reinspect'; WriterState.state.reinspId=visit.id;
  const date = addDays(recordDay(today),21);
  assert.equal(assignDue(visit,true,date,['b']), '');
  assert.equal(visit.results.b.due,date);
  const before = JSON.stringify(visit.results);
  assert.ok(assignDue(visit,true,date,['b','later']));
  assert.equal(JSON.stringify(visit.results),before,'ineligible mixed selection fails without partial changes');
  assert.ok(assignDue(visit,true,'2026-02-30',['b']));
  assert.equal(JSON.stringify(visit.results),before);
  assert.ok(assignDue(visit,true,date,[]));
  visit.docId='issued'; assert.ok(assignDue(visit,true,date,['b'])); delete visit.docId;
  render();
  assert.ok(document.querySelector('#btn-bulkdue'));
  assert.equal(document.querySelector('#btn-bulkdue').closest('details'),null,'batch dates are visible outside collapsed checks');
  WriterState.REINSP=WriterState.REINSP.filter(r=>r.id==='v1'||r.id===visit.id);
  kase('k1').date='2026-03-07';
  visit.results.b={oc:'none',on:visit.date,due:date};
  visit.results.later={oc:'corrected',on:visit.date};
  visit.time='09:00';visit.inspectorId=INSPECTORS[0].id;
  assert.deepEqual(worksheetFaults(visit,'referral'),[]);
  docFromReinspection(visit,'referral');
  const generated=doc(visit.docId);
  assert.equal(generated.type,'referral');assert.equal(generated.authoringVersion,15);
  assert.equal(generated.items[0].hist[0].on,'2026-03-07');
  assert.equal(generated.items[1].hist[0].on,'2026-03-09');
  const snap=makePublication(generated).payload.snapshot;
  assert.equal(snap.authoringVersion,15);assert.deepEqual(snap.items[0].hist,generated.items[0].hist);
  console.log('PASS R60 Workspace, safe text dialog, scoped batch deadlines, item lineage, frozen history and civil-day calculations');
`);
