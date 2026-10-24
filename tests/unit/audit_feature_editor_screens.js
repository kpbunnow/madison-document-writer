/* Feature suite (Consolidation Phase 6): Editor and Workspace screens: Workspace as the import entry and current destination, the corrective-detail dialog, focus after it closes and case-number edits in page furniture.
   Each scenario runs in its own process with a fresh bundle, DOM, state, storage and mocks
   (tests/fixtures/scenarios.cjs). Labels name the suite each scenario came from; its code is unchanged. */
require("../fixtures/scenarios.cjs").run(__filename, {
  "audit_r60_review_fixes.js: Workspace stays the current destination while importing": () => {
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
  console.log('PASS audit_r60_review_fixes.js: Workspace stays the current destination while importing');
`);
  },
  "audit_r60_development.js: one Workspace import entry and global search": () => {
    globalThis.MADISON_TEST_DATA = true;
    globalThis.CURRENT_AUTHORING = require("../fixtures/authoring_expectations.cjs");
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
  console.log('PASS audit_r60_development.js: one Workspace import entry and global search');
`);
  },
  "audit_r60_development.js: corrective-detail dialog inserts safe text, cancels and refuses stale drafts": () => {
    globalThis.MADISON_TEST_DATA = true;
    globalThis.CURRENT_AUTHORING = require("../fixtures/authoring_expectations.cjs");
    require("../fixtures/bundle_test.cjs")(`
  global.Event = window.Event;
  Object.defineProperty(window.HTMLElement.prototype,"isContentEditable",{get(){return this.getAttribute("contenteditable")==="true";},configurable:true});
  Object.defineProperty(window.HTMLElement.prototype,"innerText",{get(){return this.textContent;},set(value){this.textContent=value;},configurable:true});
  saveDrafts = async () => true;
  scheduleDraftSave = () => {};
  WriterState.PENDING = []; WriterState.EVENTS = {}; WriterState.DOCS = []; WriterState.REINSP = [];
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
  console.log('PASS audit_r60_development.js: corrective-detail dialog inserts safe text, cancels and refuses stale drafts');
`);
  },
  "audit_r60_review_fixes.js: focus returns to the item text after the dialog closes asynchronously": () => {
    globalThis.MADISON_TEST_DATA = true;
    require("../fixtures/bundle_test.cjs")(`
  global.Event = window.Event;
  Object.defineProperty(window.HTMLElement.prototype,"isContentEditable",{get(){return this.getAttribute("contenteditable")==="true";},configurable:true});
  Object.defineProperty(window.HTMLElement.prototype,"innerText",{get(){return this.textContent;},set(value){this.textContent=value;},configurable:true});
  saveDrafts = async () => true;
  scheduleDraftSave = () => {};
  WriterState.PENDING = []; WriterState.EVENTS = {}; WriterState.DOCS = []; WriterState.REINSP = [];
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
  console.log('PASS audit_r60_review_fixes.js: focus returns to the item text after the dialog closes asynchronously');
`);
  },
  "audit_r61_development.js: case-number edits update page furniture but never page counts": () => {
    globalThis.MADISON_TEST_DATA = true;
    globalThis.CURRENT_AUTHORING = require("../fixtures/authoring_expectations.cjs");
    require("../fixtures/bundle_test.cjs")(`
  saveDrafts = async () => true; scheduleDraftSave = () => {};
  WriterState.DOCS = []; WriterState.REINSP = []; WriterState.EVENTS = {}; WriterState.PENDING = [];
  const stamp = recordDay(today);
  WriterState.DOCS=[];newDoc('k1','notice');render();
  document.querySelector('.desk').insertAdjacentHTML('beforeend','<div class="n-cont"><span class="r">OLD</span></div><div class="n-foot"><span class="mono">OLD</span><span class="pg">Page 1 of 2</span></div><div class="n-foot"><span class="mono">OLD</span><span class="pg">Page 2 of 2</span></div>');
  const number=document.querySelector('[data-case="number"]');number.textContent='QA-R61-NEW';number.dispatchEvent(new window.Event('input',{bubbles:true}));
  assert.deepEqual([...document.querySelectorAll('.n-foot .mono,.n-cont .r')].map(el=>el.textContent),Array(3).fill('QA-R61-NEW'));
  assert.deepEqual([...document.querySelectorAll('.n-foot .pg')].map(el=>el.textContent),['Page 1 of 2','Page 2 of 2'],'case edits never overwrite page counts');
  console.log('PASS audit_r61_development.js: case-number edits update page furniture but never page counts');
`);
  },
});
