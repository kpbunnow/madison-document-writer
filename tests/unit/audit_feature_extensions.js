/* Feature suite (Consolidation Phase 6): Extensions: current and historical formats, family switching and explicit adoption. Print parity stays in audit_r54_extensions.js and audit_r54_extension_print.js; audit_r62_extensions.js keeps its helper pair.
   Each scenario runs in its own process with a fresh bundle, DOM, state, storage and mocks
   (tests/fixtures/scenarios.cjs). Labels name the suite each scenario came from; its code is unchanged. */
require("../fixtures/scenarios.cjs").run(__filename, {
  "audit_r61_review_fixes.js: administrative family switching keeps each family's authoring version": () => {
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
  // An older (authoring 13) Best Interest draft keeps its review/signer model through a family switch and back.
  const older = adminDraft(13, { reason: 'Contractor plan.', noSafety: true, signerName: 'S', signerTitle: 'Supervisor', originalDues: { 1: addDays(stamp, 30) } });
  control('administrativeType', 'vacancyExtension');
  assert.equal(older.type, 'vacancyExtension');
  assert.equal(older.authoringVersion, 13, 'Vacancy keeps the draft\\'s version');
  control('administrativeType', 'bestInterestExtension');
  assert.equal(older.authoringVersion, 13, 'returning to Best Interest never adopts the simplified format silently');
  assert.equal(older.special.signerName, 'S', 'its signer data is still the active model');

  // An authoring-12 draft is not upgraded by a switch.
  const twelve = adminDraft(12, { originalDues: { 1: addDays(stamp, 30) } });
  control('administrativeType', 'vacancyExtension');
  assert.equal(twelve.authoringVersion, 12);
  control('administrativeType', 'bestInterestExtension');
  assert.equal(twelve.authoringVersion, 12);

  // A draft created in the R61 format keeps the R61 defaults: 15 for Best Interest, the dated Vacancy model otherwise.
  const current = adminDraft(15, { reason: 'Contractor plan.', noSafety: true, originalDues: { 1: addDays(stamp, 30) } });
  control('administrativeType', 'vacancyExtension');
  assert.equal(current.authoringVersion, DATED_EXTENSIONS);
  control('administrativeType', 'bestInterestExtension');
  assert.equal(current.authoringVersion, 15);

  // A current Vacancy draft switched to Best Interest for the first time gets the current Best Interest format.
  const vacancy = adminDraft(DATED_EXTENSIONS, { originalDues: { 1: addDays(stamp, 30) } });
  vacancy.type = 'vacancyExtension';
  control('administrativeType', 'bestInterestExtension');
  assert.equal(vacancy.authoringVersion, 15);
  control('administrativeType', 'vacancyExtension');
  assert.equal(vacancy.authoringVersion, DATED_EXTENSIONS);
  console.log('PASS audit_r61_review_fixes.js: administrative family switching keeps each family\\'s authoring version');
`);
  },
  "audit_r61_development.js: Best Interest checks, correction of an issued Best Interest and explicit adoption": () => {
    globalThis.MADISON_TEST_DATA = true;
    globalThis.CURRENT_AUTHORING = require("../fixtures/authoring_expectations.cjs");
    require("../fixtures/bundle_test.cjs")(`
  saveDrafts = async () => true; scheduleDraftSave = () => {};
  WriterState.DOCS = []; WriterState.REINSP = []; WriterState.EVENTS = {}; WriterState.PENDING = [];
  const stamp = recordDay(today);
  let root=document.createElement('div');
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
  console.log('PASS audit_r61_development.js: Best Interest checks, correction of an issued Best Interest and explicit adoption');
`);
  },
});
