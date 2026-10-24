/* Feature suite (Consolidation Phase 6): Histories and referrals: item-specific observation history, correction endpoints, compliance history and referral state.
   Each scenario runs in its own process with a fresh bundle, DOM, state, storage and mocks
   (tests/fixtures/scenarios.cjs). Labels name the suite each scenario came from; its code is unchanged. */
require("../fixtures/scenarios.cjs").run(__filename, {
  "audit_r62_history_notes.js: authoring-16 notes under the violation on history documents": () => {
    /* R62 (owner, Development 3): authoring-16 referral, referral-update and compliance documents print every
   observation note under the violation (corrected items included), never in the Inspection History column; a
   referred case offers only Update for Case Referral and Compliance Letter. Earlier formats unchanged. Synthetic. */
    globalThis.MADISON_TEST_DATA = true;
    require("../fixtures/bundle_test.cjs")(`
  saveDrafts = async () => true; scheduleDraftSave = () => {};
  WriterState.DOCS = []; WriterState.REINSP = []; WriterState.EVENTS = {}; WriterState.PENDING = [];
  const stamp = recordDay(today);
  const item = (done) => ({ id: done ? 'c' : 'o', no: done ? '2' : '1', text: 'Repair wall.', sections: ['27.05(2)(c)'], abate: false,
    done, doneOn: done ? '2026-03-14' : '', hist: [
      { on: '2026-03-07', oc: 'initial' },
      { on: '2026-03-09', oc: 'none', note: 'Observed <surface> & damage.' },
      ...(done ? [{ on: '2026-03-14', oc: 'corrected', note: 'Repair verified.' }] : [{ on: '2026-03-12', oc: 'progress', note: 'Contractor started.' }]),
    ] });
  for (const type of ['referral', 'referralUpdate', 'compliance']) {
    const items = type === 'compliance' ? [item(true)] : [item(false), item(true)];
    const d = { id: 'r62-' + type, caseId: 'k1', type, authoringVersion: 16, draft: true, items, cits: {}, inspDate: '2026-03-14' };
    const root = document.createElement('div');
    root.innerHTML = noticeHTML(d);
    for (const row of root.querySelectorAll('tr[data-row]')) {
      const it = items.find((x) => x.id === row.dataset.row);
      const notes = [...row.querySelectorAll('.corr [data-history-note]')];
      const expected = it.hist.filter((x) => x.note);
      assert.equal(notes.length, expected.length, type + ': every note under the violation');
      assert.deepEqual(notes.map((n) => n.lastChild.textContent), expected.map((x) => x.note), type + ': oldest first, text escaped');
      assert.ok(notes.every((n) => n.style.display === 'block'), type + ': notes print on corrected items too');
      assert.match(notes[0].querySelector('.it-note-h').textContent, new RegExp(fmtDate('2026-03-09')));
      assert.equal(row.querySelector('surface'), null);
      const history = row.querySelector('.visit-list');
      assert.ok(history, type + ': history column retained');
      assert.ok(!/Note:|Observed|Repair verified|Contractor started/.test(history.textContent), type + ': no note in the history column');
      assert.match(history.textContent, /Days Outstanding/);
    }
    // Authoring 15 keeps notes in the history column.
    root.innerHTML = noticeHTML({ ...clone(d), authoringVersion: 15 });
    assert.equal(root.querySelectorAll('[data-history-note]').length, 0);
    assert.match(root.querySelector('.visit-list').textContent, /Note: Observed <surface> & damage\\./);
  }

  // A referred case: only Update for Case Referral and Compliance Letter are offered and allowed.
  const source = { id: 'src', caseId: 'k1', type: 'notice', draft: false, status: 'Final', inspDate: addDays(stamp, -30),
    items: [{ id: 'a', no: '1', text: 'Repair wall.', sections: ['27.05(2)(c)'], due: addDays(stamp, -1) }] };
  const referral = { id: 'ref', caseId: 'k1', type: 'referral', draft: false, status: 'Final', fromDocId: 'src', inspDate: addDays(stamp, -7),
    authoringVersion: 15, items: clone(source.items), cits: {} };
  const visit = { id: 'v', caseId: 'k1', sourceDocId: 'ref', draft: true, date: stamp, time: '09:00', inspectorId: INSPECTORS[0].id,
    results: { a: { oc: 'none', on: stamp, note: '' } } };
  WriterState.DOCS = [referral, source]; WriterState.REINSP = [visit];
  const box = document.createElement('div');
  box.innerHTML = newDocuments.chooser(visit);
  const groups = [...box.querySelectorAll('[data-action-group]')].map((x) => x.dataset.actionGroup);
  assert.deepEqual(groups.sort(), ['compliance', 'enforcement'], 'only groups with an allowed document');
  for (const type of ['extension', 'bestInterestExtension', 'vacancyExtension', 'citation', 'noOccupancy', 'summaryAbatement', 'nonSummaryAbatement'])
    assert.match(newDocuments.eligibility(visit, type), /Only an Update for Case Referral or a Compliance Letter/, type);
  assert.equal(newDocuments.eligibility(visit, 'referralUpdate'), '');
  visit.followupIntent = '';
  visit.actionGroup = 'enforcement';
  box.innerHTML = newDocuments.chooser(visit);
  assert.deepEqual([...box.querySelectorAll('[data-action-type]')].map((x) => x.dataset.actionType), ['referralUpdate']);
  const toasts = []; toast = (m) => toasts.push(String(m));
  assert.equal(newDocuments.caseAction('k1', 'noOccupancy'), null);
  assert.match(toasts.at(-1), /Only an Update for Case Referral or a Compliance Letter/);
  assert.ok(!WriterState.DOCS.some((x) => x.type === 'noOccupancy'), 'no scoped order is created');
  WriterState.WORK.currentAction = { cid: 'k1', type: '', group: '' };
  const screen = document.createElement('div');
  screen.innerHTML = newDocuments.caseActionScreen();
  assert.equal(screen.querySelectorAll('[data-case-action-group],[data-case-action-type],[data-special="emergencyApproved"]').length, 0);
  assert.match(screen.textContent, /Only an Update for Case Referral or a Compliance Letter/);
  console.log('PASS R62 history notes under the violation on every item, and referred cases limited to Update for Case Referral or Compliance');
`);
  },
  "audit_referred_case.js: one live referred-case predicate and the correction source exclusion": () => {
    /* Consolidation Phase 4 (C1): one live referred-case predicate. A case is referred when it has an effective referral
   or referral update; drafts, voided and superseded documents and other document types do not count, and other
   cases never do. isReferredCase matches each of the three spellings it replaced for every document state, and the
   correction check keeps its source-document exclusion. Synthetic data. */
    globalThis.MADISON_TEST_DATA = true;
    require("../fixtures/bundle_test.cjs")(`
  const replaced = [
    (cid) => docsFor(cid).some((x) => isEffective(x) && isHistoryDoc(x)),
    (cid) => docsFor(cid).some((x) => !x.draft && !x.void && !x.superseded && isHistoryDoc(x)),
    (cid) => docsFor(cid).some((d) => !d.draft && !d.void && !d.superseded && (d.type === "referral" || d.type === "referralUpdate")),
  ];
  const states = {
    issued: {},
    draft: { draft: true },
    voided: { void: true },
    superseded: { superseded: true },
    "voided draft": { draft: true, void: true },
  };
  const types = ["referral", "referralUpdate", "notice", "extension", "citation", "compliance", "bestInterestExtension", "noOccupancy"];
  let n = 0;
  for (const type of types)
    for (const [state, flags] of Object.entries(states)) {
      WriterState.DOCS = [
        { id: "d" + ++n, caseId: "k1", type, items: [], ...flags },
        { id: "other" + n, caseId: "k2", type: "referral", items: [] },
      ];
      const expected = (type === "referral" || type === "referralUpdate") && state === "issued";
      assert.equal(isReferredCase("k1"), expected, type + " " + state);
      replaced.forEach((old, i) => assert.equal(isReferredCase("k1"), old("k1"), "spelling " + i + ": " + type + " " + state));
      assert.equal(isReferredCase("k2"), true, "the other case's own referral");
      assert.equal(isReferredCase("k3"), false, "a case with no documents");
    }
  // A superseded referral with its effective correction still counts; a voided one with no replacement does not.
  WriterState.DOCS = [
    { id: "r1", caseId: "k1", type: "referral", items: [], superseded: true },
    { id: "r2", caseId: "k1", type: "referral", items: [] },
  ];
  assert.equal(isReferredCase("k1"), true);
  WriterState.DOCS = [{ id: "r1", caseId: "k1", type: "referral", items: [], void: true }];
  assert.equal(isReferredCase("k1"), false);

  // Source exclusion: correcting the case's only referral is not blocked by that referral itself.
  const source = { id: "src", caseId: "k1", type: "referral", items: [], fromReinspId: "v1" };
  WriterState.DOCS = [source];
  assert.equal(isReferredCase("k1"), true, "live state: the case is referred");
  for (const type of ["extension", "referral", "referralUpdate", "compliance"])
    assert.equal(correctionTypeAllowed(source, type), true, "correcting the only referral may become " + type);
  // With an earlier effective referral, a correction may only become a referral update or compliance letter.
  WriterState.DOCS = [source, { id: "earlier", caseId: "k1", type: "referral", items: [] }];
  assert.equal(correctionTypeAllowed(source, "extension"), false);
  assert.equal(correctionTypeAllowed(source, "referralUpdate"), true);
  assert.equal(correctionTypeAllowed(source, "compliance"), true);
  console.log("PASS isReferredCase matches the replaced spellings; correction checks keep the source exclusion");
`);
  },
  "audit_r60_review_fixes.js: initial citation numbers in authoring-14 item history": () => {
    globalThis.MADISON_TEST_DATA = true;
    require("../fixtures/bundle_test.cjs")(`
  global.Event = window.Event;
  Object.defineProperty(window.HTMLElement.prototype,"isContentEditable",{get(){return this.getAttribute("contenteditable")==="true";},configurable:true});
  Object.defineProperty(window.HTMLElement.prototype,"innerText",{get(){return this.textContent;},set(value){this.textContent=value;},configurable:true});
  saveDrafts = async () => true;
  scheduleDraftSave = () => {};
  WriterState.PENDING = []; WriterState.EVENTS = {}; WriterState.DOCS = []; WriterState.REINSP = [];
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
  console.log('PASS audit_r60_review_fixes.js: initial citation numbers in authoring-14 item history');
`);
  },
  "audit_r61_development.js: referral and compliance history rendering, correction endpoints and historical output": () => {
    globalThis.MADISON_TEST_DATA = true;
    globalThis.CURRENT_AUTHORING = require("../fixtures/authoring_expectations.cjs");
    require("../fixtures/bundle_test.cjs")(`
  saveDrafts = async () => true; scheduleDraftSave = () => {};
  WriterState.DOCS = []; WriterState.REINSP = []; WriterState.EVENTS = {}; WriterState.PENDING = [];
  const stamp = recordDay(today);
  const item={id:'i',no:'1',text:'Repair wall.',sections:['27.05(2)(c)'],done:true,doneOn:'2026-03-14',abate:false,hist:[
    {on:'2026-03-07',oc:'initial'}, {on:'2026-03-09',oc:'none',note:'Observed <surface> & damage.'},
    {on:'2026-03-14',oc:'corrected',note:'Repair verified.'}]};
  const d={id:'ref',caseId:'k1',type:'referral',authoringVersion:15,draft:true,items:[item],cits:{},inspDate:'2026-03-14'};
  let root=document.createElement('div');root.innerHTML=noticeHTML(d);
  let history=root.querySelector('.visit-list');
  assert.equal([...history.querySelectorAll('b')].filter(el=>el.textContent===fmtDate(item.doneOn)).length,1);
  assert.equal(history.querySelectorAll('.done-note').length,0);
  assert.match(history.innerHTML,/CORRECTED/); assert.ok(!history.textContent.includes('Completed'));
  assert.match(history.textContent,/Observed <surface> & damage/);assert.equal(history.querySelector('surface'),null);
  assert.match(history.textContent,/Days Outstanding: 7/);
  const old={...d,authoringVersion:14};root.innerHTML=noticeHTML(old);
  assert.equal(root.querySelectorAll('.visit-list .done-note').length,1,'authoring 14 retains its summary');
  const missing={...clone(item),hist:item.hist.slice(0,2)};
  root.innerHTML=referralHistoryHTML(d,missing);assert.match(root.textContent,/Correction observation unavailable/);assert.match(root.textContent,/Days Outstanding: Unavailable/);
  const sameDay={...clone(item),hist:[...item.hist,{on:'2026-03-14',oc:'none',note:'Separate observation'}]};
  root.innerHTML=referralHistoryHTML(d,sameDay);assert.equal(root.querySelectorAll('b').length,4,'same date does not collapse distinct visits');
  const compliance={...clone(d),type:'compliance'};
  assert.equal(isHistoryDoc(compliance),false,'compliance is never classified as referral');
  assert.equal(hasItemInspectionHistory(compliance),true);
  for(const [value,label] of [[false,'No'],[true,'Yes'],[undefined,'Unavailable']]){
    compliance.items[0].abate=value;root.innerHTML=noticeHTML(compliance);
    assert.equal(root.querySelector('.c-ab span').textContent,label);
    assert.match(root.querySelector('.visit-list').textContent,/Repair verified/);
  }
  const historical={...clone(compliance),authoringVersion:14};root.innerHTML=noticeHTML(historical);
  assert.equal(root.querySelector('.visit-list'),null,'older compliance output remains date-only');
  assert.equal(root.querySelector('td.c-ab').textContent,'—');
  console.log('PASS audit_r61_development.js: referral and compliance history rendering, correction endpoints and historical output');
`);
  },
  "audit_r61_development.js: compliance letter generated from a worksheet keeps its snapshot history": () => {
    globalThis.MADISON_TEST_DATA = true;
    globalThis.CURRENT_AUTHORING = require("../fixtures/authoring_expectations.cjs");
    require("../fixtures/bundle_test.cjs")(`
  saveDrafts = async () => true; scheduleDraftSave = () => {};
  WriterState.DOCS = []; WriterState.REINSP = []; WriterState.EVENTS = {}; WriterState.PENDING = [];
  const stamp = recordDay(today);
  const source={id:'source',caseId:'k1',type:'notice',draft:false,status:'Final',inspDate:addDays(stamp,-7),items:[{id:'a',no:'1',text:'Repair wall.',sections:['27.05(2)(c)'],abate:false,due:addDays(stamp,-1)}]};
  const visit={id:'visit',caseId:'k1',sourceDocId:source.id,draft:true,date:stamp,time:'09:00',inspectorId:INSPECTORS[0].id,results:{a:{oc:'corrected',on:stamp,note:'Confirmed repair.'}}};
  WriterState.DOCS=[source];WriterState.REINSP=[visit];WriterState.state.reinspId=visit.id;
  docFromReinspection(visit,'compliance');
  const generated=doc(visit.docId);assert.equal(generated.type,'compliance');assert.equal(generated.authoringVersion,CURRENT_AUTHORING.followUp);
  assert.equal(generated.items[0].abate,false);assert.equal(generated.items[0].due,source.items[0].due,'compliance keeps the original repair deadline in its snapshot');assert.equal(generated.items[0].hist.at(-1).note,'Confirmed repair.');
  const snapshot=makePublication(generated).payload.snapshot;
  const before=noticeHTML(snapshot);visit.results.a.note='Later private change';assert.equal(noticeHTML(snapshot),before,'issued histories retain their snapshot');
  console.log('PASS audit_r61_development.js: compliance letter generated from a worksheet keeps its snapshot history');
`);
  },
  "audit_r60_development.js: item lineage, frozen history, civil-day counts, scoped batch deadlines and the generated referral": () => {
    globalThis.MADISON_TEST_DATA = true;
    globalThis.CURRENT_AUTHORING = require("../fixtures/authoring_expectations.cjs");
    require("../fixtures/bundle_test.cjs")(`
  global.Event = window.Event;
  Object.defineProperty(window.HTMLElement.prototype,"isContentEditable",{get(){return this.getAttribute("contenteditable")==="true";},configurable:true});
  Object.defineProperty(window.HTMLElement.prototype,"innerText",{get(){return this.textContent;},set(value){this.textContent=value;},configurable:true});
  saveDrafts = async () => true;
  scheduleDraftSave = () => {};
  WriterState.PENDING = []; WriterState.EVENTS = {}; WriterState.DOCS = []; WriterState.REINSP = [];
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
  assert.equal(generated.type,'referral');assert.equal(generated.authoringVersion,CURRENT_AUTHORING.followUp);
  assert.equal(generated.items[0].hist[0].on,'2026-03-07');
  assert.equal(generated.items[1].hist[0].on,'2026-03-09');
  const snap=makePublication(generated).payload.snapshot;
  assert.equal(snap.authoringVersion,CURRENT_AUTHORING.followUp);assert.deepEqual(snap.items[0].hist,generated.items[0].hist);
  console.log('PASS audit_r60_development.js: item lineage, frozen history, civil-day counts, scoped batch deadlines and the generated referral');
`);
  },
});
