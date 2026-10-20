/* A background repaint must leave an active document edit attached to its input handler. */
require("../fixtures/bundle_test.cjs")(String.raw`
saveDrafts=async()=>true;idbSet=async()=>true;
WriterState.HELPER=null;WriterState.CASEDIR=null;WriterState.state.modal=null;
newDoc('k1','notice');const editing=doc(WriterState.state.docId);
editing.items=[{id:'editing-item',no:'1',title:'Repair',text:'Original text',
  sections:['27.05(2)(c)'],due:addDays(recordDay(today),21)}];
render();const field=document.querySelector('[data-field="text"]');
Object.defineProperty(field,'isContentEditable',{value:true});field.focus();
const caret=document.createRange();caret.setStart(field.firstChild,5);caret.collapse(true);
window.getSelection().removeAllRanges();window.getSelection().addRange(caret);
render();assert.equal(document.querySelector('[data-field="text"]'),field,'passive repaint preserves the active editing node');
assert.equal(window.getSelection().anchorOffset,5,'caret is preserved through the refresh');
field.textContent='Retained typing';field.innerText='Retained typing';
field.dispatchEvent(new window.Event('input',{bubbles:true}));render();
assert.equal(editing.items[0].text,'Retained typing');
assert.equal(document.querySelector('[data-field="text"]'),field);
field.textContent='';field.innerText='';field.dispatchEvent(new window.Event('input',{bubbles:true}));render();
assert.equal(editing.items[0].text,'','an explicit clear is retained');
assert.equal(document.querySelector('[data-field="text"]'),field);
editing.items[0].text='Explicit program update';render();
const refreshed=document.querySelector('[data-field="text"]');
assert.notEqual(refreshed,field,'new model text still redraws');
assert.equal(refreshed.textContent,'Explicit program update');
Object.defineProperty(refreshed,'isContentEditable',{value:true});refreshed.focus();
editing.status='Final';render();
assert.notEqual(document.querySelector('[data-field="text"]'),refreshed,'a lock transition still redraws immediately');
assert.notEqual(document.querySelector('[data-field="text"]').getAttribute('contenteditable'),'true');
newDoc('k1','notice');const next=doc(WriterState.state.docId);
next.items=[{id:'next-item',no:'1',title:'Next',text:'New document text',
  sections:['27.05(2)(c)'],due:addDays(recordDay(today),21)}];
render();assert.equal(document.querySelector('.document-workspace').dataset.editorDoc,next.id);
assert.equal(document.querySelector('[data-field="text"]').textContent,'New document text');
const current=document.querySelector('[data-field="text"]');
Object.defineProperty(current,'isContentEditable',{value:true});current.focus();
const different={...clone(next),id:'other-editing-document'};different.items[0].text='Different document';
WriterState.DOCS.unshift(different);WriterState.state.docId=different.id;render();
assert.equal(document.querySelector('.document-workspace').dataset.editorDoc,different.id);
assert.equal(document.querySelector('[data-field="text"]').textContent,'Different document');
console.log('PASS active edit, explicit clear, immediate lock and document navigation repaint boundaries');
`);
