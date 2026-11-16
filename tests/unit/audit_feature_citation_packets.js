/* Feature suite (Consolidation Phase 6): Citation packets: copy completeness, frozen copy labels, editor copy display and refused retry filing.
   Each scenario runs in its own process with a fresh bundle, DOM, state, storage and mocks
   (tests/fixtures/scenarios.cjs). Labels name the suite each scenario came from; its code is unchanged. */
require("../fixtures/scenarios.cjs").run(__filename, {
  "audit_r61_review_fixes.js: packet check uses frozen copy labels; a refused retry filing explains itself": () => {
    globalThis.MADISON_TEST_DATA = true;
    require("../fixtures/bundle_test.cjs")(`
  saveDrafts = async () => true; scheduleDraftSave = () => {};
  WriterState.DOCS = []; WriterState.REINSP = []; WriterState.EVENTS = {}; WriterState.PENDING = [];
  const stamp = recordDay(today);
  const control = (key, value) => {
    const el = document.createElement('select');
    el.dataset.special = key;
    const option = document.createElement('option'); option.value = value; el.append(option); el.value = value;
    newDocuments.editEvent({ target: el, type: 'change' });
  };
  const adminDraft = (authoringVersion, special) => {
    newDoc('k1', 'notice');
    const d = doc(WriterState.state.docId);
    Object.assign(d, { type: 'bestInterestExtension', authoringVersion, special: clone(special),
      items: [{ id: 'a', no: '1', text: 'Repair wall.', sections: ['27.05(2)(c)'], due: addDays(stamp, 30) }] });
    return d;
  };
  // The packet check compares the frozen copy labels the faces are rendered from, not today's global labels.
  WriterState.DOCS = []; newDoc('k1', 'notice');
  const citation = doc(WriterState.state.docId);
  citation.type = 'citation';
  citation.items = [{ id: 'charge', no: '1', text: 'Repair wall.', sections: ['27.05(2)(c)'], cite: true }];
  citation.cits = { charge: { num: 'B90000000001', ord: '27.05(2)(c)', issued: stamp, courtDate: addDays(stamp, 21), courtTime: '08:30', depositMode: 'schedule' } };
  applyDeposit(citation, 'charge', '27.05(2)(c)');
  const relabelled = globalCourtCopies().map((copy) => ({ ...copy, label: copy.label + ' (issued wording)' }));
  citation.frozen = { ...freezeSources(citation), courtCopies: relabelled };
  assert.equal((printJob(citation).html.match(/class="cit /g) || []).length, 4, 'a complete packet with its own frozen labels prints');
  citation.frozen = { ...freezeSources(citation), courtCopies: relabelled.slice(0, 3) };
  assert.throws(() => printJob(citation), /packet is incomplete/);
  citation.draft = false;
  assert.throws(() => printJob(citation), /issued record is unchanged/, 'after issuance the message does not claim a retained draft');

  // A refused retry filing shows its reason and leaves the button usable.
  citation.status = 'Final'; citation.filedAt = ''; WriterState.state.screen = 'write'; WriterState.state.docId = citation.id;
  const button = document.createElement('button'); button.id = 'btn-retryfiling'; document.body.append(button);
  let shown = '';
  toast = (message) => { shown = String(message); };
  button.click();
  assert.match(shown, /packet is incomplete/);
  console.log('PASS audit_r61_review_fixes.js: packet check uses frozen copy labels; a refused retry filing explains itself');
`);
  },
  "audit_r61_development.js: new three-copy defaults, compact preview, incomplete packet refused": () => {
    globalThis.MADISON_TEST_DATA = true;
    globalThis.CURRENT_AUTHORING = require("../fixtures/authoring_expectations.cjs");
    require("../fixtures/bundle_test.cjs")(`
  saveDrafts = async () => true; scheduleDraftSave = () => {};
  WriterState.DOCS = []; WriterState.REINSP = []; WriterState.EVENTS = {}; WriterState.PENDING = [];
  const stamp = recordDay(today);
  WriterState.DOCS=[];WriterState.REINSP=[];newDoc('k1','notice');
  const citation=doc(WriterState.state.docId);citation.type='citation';citation.items=[{id:'charge',no:'1',text:'Repair wall.',sections:['27.05(2)(c)'],cite:true}];
  citation.cits={charge:{num:'B90000000001',ord:'27.05(2)(c)',issued:stamp,courtDate:addDays(stamp,21),courtTime:'08:30',depositMode:'schedule'}};
  applyDeposit(citation,'charge','27.05(2)(c)');render();
  assert.equal(document.querySelectorAll('[data-editor-extra-copy]').length,0,'all copies shown by default');
  document.querySelector('[data-citation-copies]').click();
  assert.equal(document.querySelectorAll('[data-editor-extra-copy]').length,2,'compact preview remains optional');
  assert.equal(new DOMParser().parseFromString(printableHTML(),'text/html').body.querySelector('[data-editor-extra-copy]'),null,'printing strips editor-only filtering');
  assert.equal((printJob(citation).html.match(/class="cit /g)||[]).length,3);
  const currentVersion=citation.authoringVersion, currentCopies=freezeSources(citation).courtCopies;
  citation.frozen={...freezeSources(citation),courtCopies:[currentCopies[1],currentCopies[1],currentCopies[2]]};
  assert.throws(()=>printJob(citation),/packet is incomplete/,'three faces must include the Court, not a duplicate Agency role');
  citation.draft=false; citation.authoringVersion=11;
  assert.throws(()=>printJob(citation),/packet is incomplete/,'a current three-copy set is validated even on an older authoring format');
  citation.draft=true; citation.authoringVersion=currentVersion;
  citation.frozen={...freezeSources(citation),courtCopies:[globalCourtCopies()[0]]};
  assert.throws(()=>printJob(citation),/packet is incomplete/,'an incomplete packet cannot be filed');
  {

  saveDrafts = async () => true; scheduleDraftSave = () => {};
  WriterState.DOCS=[]; WriterState.REINSP=[]; WriterState.EVENTS={}; WriterState.PENDING=[];
  newDoc('k1','notice');
  const d=doc(WriterState.state.docId), day=recordDay(today);
  Object.assign(d, {importRule:{kind:'initial',doc:'notice',cite:true,status:'Citation'},
    importInspection:{type:'initial',date:day,time:'09:00'},
    items:[{id:'citation-only-item',no:'1',group:'KITCHEN',text:'Repair wall.',sections:['27.05(2)(c)'],cite:true,due:addDays(day,30)}]});
  d.dueWork={selected:['citation-only-item'],date:addDays(day,30)};
  render();
  assert.match(document.querySelector('.n-title').textContent,/CITATION/,'initial citation draft uses its issued header');
  assert.ok(document.querySelector('.n-body').textContent.includes('We are issuing a citation for the documented violation.'));
  assert.ok(!document.querySelector('.n-body').textContent.includes('If you complete the work by the due date, you may avoid:'));
  let selector=document.querySelector('[data-citation-disposition="citation-only-item"]');
  assert.ok(selector,'initial cited item offers an explicit due-date disposition');
  assert.equal(selector.tabIndex,-1);
  assert.equal(document.querySelector('[data-field="sections"]').tabIndex,-1);
  assert.equal(document.querySelector('[data-notecite]').tabIndex,-1);
  assert.equal(document.querySelector('[data-due-select]').tabIndex,-1);
  assert.equal(document.querySelector('[data-field="due"]').tabIndex,-1);
  assert.equal(document.querySelector('[data-grip]').tabIndex,0);
  assert.equal(document.querySelector('[data-grpbtn]').tabIndex,0);
  assert.equal(document.querySelector('[data-field="group"]').tabIndex,0);
  selector.value='citation-only'; selector.dispatchEvent(new window.Event('change',{bubbles:true}));
  assert.equal(d.items[0].due,'');
  assert.equal(d.items[0].dueExempt,'initial-citation-only');
  assert.deepEqual(d.dueWork.selected,[],'citation-only items leave the shared-date selection');
  assert.ok(!d.items[0].done && !d.items[0].withdrawn,'closure is not reported as correction or withdrawal');
  assert.equal(document.querySelector('[data-field="due"]'),null,'citation-only repair deadline is blank');
  assert.equal(document.querySelector('.desk .c-due'),null,'undated citation draft has no repair due-date column');
  assert.ok(document.querySelector('.desk [data-citation-disposition]'),'disposition remains editable outside the removed column');
  assert.ok(document.querySelector('.desk [data-del]'),'removal remains available outside the removed column');
  assert.ok(!checks(d).some(c=>!c.ok && /no due date/.test(c.t)),'explicit disposition satisfies the missing deadline rule');
  WriterState.DOCS.push({id:'active-restriction',caseId:d.caseId,type:'noOccupancy',items:[],special:{mode:'impose'}});
  assert.ok(checks(d).some(c=>!c.ok && /every occupancy restriction/.test(c.t)),'citation-only closure cannot bypass an existing occupancy restriction');
  WriterState.DOCS.pop();
  const preview=initialCitations.preview(d), html=citationFaces(preview,true);
  const parsed=new DOMParser().parseFromString(html,'text/html');
  assert.equal(parsed.querySelectorAll('.cit').length,3);
  assert.ok(!parsed.body.textContent.includes('INSPECTOR COPY'));
  assert.ok(parsed.body.textContent.includes('COURT COPY') && parsed.body.textContent.includes('AGENCY COPY') && parsed.body.textContent.includes("DEFENDANT'S COPY"));
  assert.equal((printJob(preview).html.match(/class="cit /g)||[]).length,3);
  const frozen=freezeSources(preview);
  assert.equal(frozen.omitRepairDueDate,true,'new issue retains its column layout');
  const retainedUndated={...preview,draft:false,initialPreview:false,issuedAt:day+'T15:00:00Z',frozen};
  assert.equal(new DOMParser().parseFromString(printJob(retainedUndated).html,'text/html').querySelector('.c-due'),null,'issued PDF omits the whole repair column');
  const retainedOld={...retainedUndated,frozen:{...frozen}}; delete retainedOld.frozen.omitRepairDueDate;
  assert.ok(new DOMParser().parseFromString(printJob(retainedOld).html,'text/html').querySelector('.c-due'),'earlier issued packets keep their original column');
  assert.equal(frozen.courtCopies.length,3,'new issue captures the selected copy set');
  const legacy={...preview,cits:clone(preview.cits),draft:false,initialPreview:false,issuedAt:day+'T15:00:00Z',frozen:{...frozen,courtCopies:clone(globalCourtCopies())}};
  assert.equal((citationFaces(legacy,true).match(/class="cit /g)||[]).length,4,'issued four-copy definitions remain intact');
  assert.equal((printJob(legacy).html.match(/class="cit /g)||[]).length,4);
  const oldFallback={...legacy,frozen:{...legacy.frozen}}; delete oldFallback.frozen.courtCopies;
  assert.equal((citationFaces(oldFallback,true).match(/class="cit /g)||[]).length,4,'legacy missing-copy metadata retains its original fallback');
  assert.equal(freezeSources(oldFallback).courtCopies.length,4,'freezing an issued legacy source retains its fallback too');
  d.items.push({id:'other',no:'2',group:'KITCHEN',text:'Other work.',sections:['27.05(2)(c)'],due:addDays(day,30),cite:false});
  render();
  assert.ok(document.querySelector('.desk th.c-due'),'mixed cases still show deadlines');
  assert.equal(freezeSources(initialCitations.preview(d)).omitRepairDueDate,undefined);
  assert.ok(!checks(d).some(c=>!c.ok && /cover every remaining violation/.test(c.t)),'mixed citation-only and ordinary items may issue together');
  assert.equal(d.items[1].due,addDays(day,30),'other violations keep their deadlines');
  d.items.pop(); render();
  selector=document.querySelector('[data-citation-disposition="citation-only-item"]');
  selector.value='date'; selector.dispatchEvent(new window.Event('change',{bubbles:true}));
  assert.ok(document.querySelector('.desk th.c-due'),'returning to a repair deadline restores the column');
  assert.equal(d.items[0].dueExempt,undefined);
  assert.equal(d.items[0].due,'','return to normal never invents a deadline');
  assert.ok(checks(d).some(c=>!c.ok && /no due date/.test(c.t)));
  selector=document.querySelector('[data-citation-disposition="citation-only-item"]');
  selector.value='citation-only';selector.dispatchEvent(new window.Event('change',{bubbles:true}));
  document.querySelector('[data-notecite]').click();
  assert.equal(d.items[0].cite,false);
  assert.equal(d.items[0].dueExempt,undefined,'removing citation also removes the exemption');
  assert.equal(document.querySelector('[data-citation-disposition]'),null);
  // Open the actual correction owner: issued fields are cleared, but its retained copy fact must survive.
  for (const copies of [frozen.courtCopies,clone(globalCourtCopies())]) {
    const source={...legacy,id:'correction-copy-source',caseId:d.caseId,eventId:'copy-source-event',frozen:{...frozen,courtCopies:clone(copies)}};
    WriterState.DOCS=[source]; WriterState.EVENTS[d.caseId]=[{id:source.eventId,type:'citation.issued',at:source.issuedAt,payload:{docId:source.id,snapshot:clone(source)}}];
    const correction=startCorrection(source.id);
    assert.ok(correction && correction.correction,'actual correction draft opens');
    assert.deepEqual(correction.correction.courtCopies,copies,'correction captures its source set before issued fields are removed');
    assert.deepEqual(freezeSources(correction).courtCopies,copies,'correction publication retains exactly its source copies');
    assert.equal(freezeSources(correction).omitRepairDueDate,true,'correction retains the source column layout');
    assert.equal((citationFaces(correction,true).match(/class="cit /g)||[]).length,copies.length);
    correction.correction.courtCopies[0].label='changed draft copy';
    assert.deepEqual(source.frozen.courtCopies,copies,'source copies are independently cloned');
  }

  if (process.env.DW_CITATION_RECORDS_FILE) {
    const records=JSON.parse(require('node:fs').readFileSync(process.env.DW_CITATION_RECORDS_FILE,'utf8')), summaries=records.map(record=>summarize(record));
    const reports=await require('./report_exports.cjs')();
    const {statusAt,openAt,violOpenAt}=reports.rules;
    const [closed,corrected,voided]=summaries.map(s=>s.case);
    assert.equal(closed.status,'Closed'); assert.equal(corrected.status,'Closed');
    assert.equal(corrected.closedOn,'2026-08-01','correction does not move closure to its recording date');
    assert.equal(voided.status,'Notice','voided citation leaves the retained deadline record open');
    for (const summary of summaries.slice(0,2)) {
      const c={...summary.case,documents:summary.documents}, v=summary.violations[0];
      assert.equal(statusAt(c,'2026-08-05'),'Closed');
      assert.equal(openAt(c,'2026-08-05'),false);
      assert.equal(violOpenAt(v,'2026-08-05'),false,'closed by citation is not outstanding repair work');
      assert.equal(v.done,false,'no compliance credit');
    }
    const c={...summaries[2].case,documents:summaries[2].documents};
    assert.equal(statusAt(c,'2026-08-05'),'Closed','later void preserves earlier closure');
    assert.equal(statusAt(c,'2026-08-15'),'Notice');
    assert.equal(violOpenAt(summaries[2].violations[0],'2026-08-05'),false);
    assert.equal(violOpenAt(summaries[2].violations[0],'2026-08-15'),true,'void restores outstanding work');
    for (const summary of summaries.slice(3,5)) {
      assert.notEqual(summary.case.status,'Closed','mixed cases stay open through ordinary follow-up');
      assert.ok(summary.violations[0].citationClosedOn);
      assert.equal(summary.violations[0].done,false);
      assert.equal(violOpenAt(summary.violations[0],'2026-09-05'),false,'citation-only item stays out of open counts');
      assert.equal(violOpenAt(summary.violations[1],'2026-09-05'),true,'ordinary violation remains open');
    }
    if(summaries[5]) {
      assert.equal(summaries[5].case.status,'Closed');
      assert.equal(summaries[5].case.closedOn,'2026-10-01');
      assert.equal(summaries[5].violations[0].done,false);
      assert.equal(summaries[5].violations[0].citationClosedOn,'2026-08-01');
      assert.equal(summaries[5].violations[1].done,true);
    }
    require('node:fs').writeFileSync(process.env.DW_CITATION_PROJECTIONS,JSON.stringify(summaries));
  }
  console.log('PASS citation-only initial controls, tab order, ordinary deadline refusal, all-three new copies, retained-four legacy, mixed-case follow-up and deselection');

  }
  console.log('PASS audit_r61_development.js: new three-copy defaults, compact preview, incomplete packet refused');
`);
  },
});
