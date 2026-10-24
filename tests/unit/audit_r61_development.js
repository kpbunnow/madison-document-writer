/* R61 new history, monetary presentation, copy completeness and retained output. Synthetic only. */
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

  const source={id:'source',caseId:'k1',type:'notice',draft:false,status:'Final',inspDate:addDays(stamp,-7),items:[{id:'a',no:'1',text:'Repair wall.',sections:['27.05(2)(c)'],abate:false,due:addDays(stamp,-1)}]};
  const visit={id:'visit',caseId:'k1',sourceDocId:source.id,draft:true,date:stamp,time:'09:00',inspectorId:INSPECTORS[0].id,results:{a:{oc:'corrected',on:stamp,note:'Confirmed repair.'}}};
  WriterState.DOCS=[source];WriterState.REINSP=[visit];WriterState.state.reinspId=visit.id;
  docFromReinspection(visit,'compliance');
  const generated=doc(visit.docId);assert.equal(generated.type,'compliance');assert.equal(generated.authoringVersion,CURRENT_AUTHORING.followUp);
  assert.equal(generated.items[0].abate,false);assert.equal(generated.items[0].due,source.items[0].due,'compliance keeps the original repair deadline in its snapshot');assert.equal(generated.items[0].hist.at(-1).note,'Confirmed repair.');
  const snapshot=makePublication(generated).payload.snapshot;
  const before=noticeHTML(snapshot);visit.results.a.note='Later private change';assert.equal(noticeHTML(snapshot),before,'issued histories retain their snapshot');

  const entries=allItems().filter(i=>i.s.includes('27.05(2)(g)2'));
  assert.equal(entries.length,19);
  assert.equal(canonicalOrdinance('27.05(2)(g)2'),canonicalOrdinance('27.05(2)(g)2.'));
  assert.deepEqual(resolveCitationAmount({ordinance:'27.05(2)(g)2',date:stamp}),resolveCitationAmount({ordinance:'27.05(2)(g)2.',date:stamp}));
  assert.ok(!allItems().some(i=>i.s.includes('27.05(2)(g)2.')));
  const legacyMatch=entries.find(entry=>violationType({title:entry.t,sections:entry.s}).how==='matched');assert.ok(legacyMatch);
  const currentClassification=violationType({title:legacyMatch.t,sections:legacyMatch.s});
  assert.deepEqual(violationType({title:legacyMatch.t,sections:legacyMatch.s.map(s=>s==='27.05(2)(g)2'?'27.05(2)(g)2.':s)}),currentClassification,'legacy title/section classification survives display punctuation');


  const best={id:'best',caseId:'k1',type:'bestInterestExtension',authoringVersion:15,draft:false,status:'Final',eventId:'best-event',mailed:stamp,inspDate:stamp,items:[{id:'best-item',no:'1',text:'Repair wall.',sections:['27.05(2)(c)'],due:addDays(stamp,21)}],special:{affected:['1'],originalDues:{1:addDays(stamp,-7)},reason:'Original reason.',noSafety:true,safetyBasis:'Previously recorded exclusion of safety and urgent items.'}};
  WriterState.DOCS=[];WriterState.REINSP=[];
  const checksDraft={...clone(best),draft:true};delete checksDraft.special.safetyBasis;
  assert.deepEqual(newDocuments.specialChecks(checksDraft).filter(check=>!check.ok),[],'Reasons plus explicit safety confirmation and valid deadlines are sufficient');
  checksDraft.special.noSafety=false;assert.ok(newDocuments.specialChecks(checksDraft).some(check=>!check.ok&&/exclude safety/.test(check.t)));
  checksDraft.special.noSafety=true;checksDraft.special.reason='';assert.ok(newDocuments.specialChecks(checksDraft).some(check=>!check.ok&&/reasons/.test(check.t)));
  checksDraft.special.reason='Valid reasons.';newDocuments.invalidateItemReview(checksDraft);assert.equal(checksDraft.special.noSafety,false,'changed item facts/deadlines require renewed safety confirmation');
  WriterState.DOCS=[best];WriterState.REINSP=[];best.frozen=freezeSources(best);
  assert.equal(best.frozen.authorizedSigner,undefined);
  root.innerHTML=noticeHTML(best);assert.equal(root.querySelector('.extension-signer'),null);
  const correction=startCorrection(best.id);assert.ok(correction);render();
  assert.equal(document.querySelectorAll('#r26-details [data-special]').length,2);
  const reasonField=document.querySelector('[data-special="reason"]');reasonField.value='Updated repair plan.';
  reasonField.dispatchEvent(new window.Event('input',{bubbles:true}));
  assert.match(docBody(correction),/Updated repair plan/);assert.ok(!docBody(correction).includes('Original reason'));
  assert.ok(correctionChanges(correction).some(change=>change.path==='special.reason'&&change.after==='Updated repair plan.'));
  assert.match(docBody(best),/Original reason/,'the issued body is unchanged');
  assert.ok(!noticeHTML(correction).includes('Unlisted items retain'));
  const legacyDraft={...clone(best),id:'legacy-best',draft:true,status:'Draft',authoringVersion:13};delete legacyDraft.frozen;delete legacyDraft.eventId;
  WriterState.DOCS=[legacyDraft];WriterState.state.docId=legacyDraft.id;render();
  assert.ok(document.querySelector('[data-adopt-best-interest]'));
  const previousDetails=JSON.stringify(legacyDraft.special);document.querySelector('[data-adopt-best-interest]').click();
  // R62: adoption moves to the current all-item Best Interest format (authoring 16).
  assert.equal(legacyDraft.authoringVersion,CURRENT_AUTHORING.allItemExtension);assert.equal(JSON.stringify(legacyDraft.special),previousDetails,'adoption retains earlier review data');
  WriterState.DOCS=[];WriterState.REINSP=[];newDoc('k1','notice');
  const citation=doc(WriterState.state.docId);citation.type='citation';citation.items=[{id:'charge',no:'1',text:'Repair wall.',sections:['27.05(2)(c)'],cite:true}];
  citation.cits={charge:{num:'B90000000001',ord:'27.05(2)(c)',issued:stamp,courtDate:addDays(stamp,21),courtTime:'08:30',depositMode:'schedule'}};
  applyDeposit(citation,'charge','27.05(2)(c)');render();
  assert.equal(document.querySelectorAll('[data-editor-extra-copy]').length,0,'all copies shown by default');
  document.querySelector('[data-citation-copies]').click();
  assert.equal(document.querySelectorAll('[data-editor-extra-copy]').length,3,'compact preview remains optional');
  assert.equal(new DOMParser().parseFromString(printableHTML(),'text/html').body.querySelector('[data-editor-extra-copy]'),null,'printing strips editor-only filtering');
  assert.equal((printJob(citation).html.match(/class="cit /g)||[]).length,4);
  citation.frozen={...freezeSources(citation),courtCopies:[globalCourtCopies()[0]]};
  assert.throws(()=>printJob(citation),/packet is incomplete/,'an incomplete packet cannot be filed');
  WriterState.DOCS=[];newDoc('k1','notice');render();
  document.querySelector('.desk').insertAdjacentHTML('beforeend','<div class="n-cont"><span class="r">OLD</span></div><div class="n-foot"><span class="mono">OLD</span><span class="pg">Page 1 of 2</span></div><div class="n-foot"><span class="mono">OLD</span><span class="pg">Page 2 of 2</span></div>');
  const number=document.querySelector('[data-case="number"]');number.textContent='QA-R61-NEW';number.dispatchEvent(new window.Event('input',{bubbles:true}));
  assert.deepEqual([...document.querySelectorAll('.n-foot .mono,.n-cont .r')].map(el=>el.textContent),Array(3).fill('QA-R61-NEW'));
  assert.deepEqual([...document.querySelectorAll('.n-foot .pg')].map(el=>el.textContent),['Page 1 of 2','Page 2 of 2'],'case edits never overwrite page counts');
  console.log('PASS R61 history/compliance, currency units, copy completeness, catalog normalization and historical compatibility');
`);
