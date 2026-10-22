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
/* A shared-save completion repaints the editor; an identified correction field being typed in keeps focus,
   caret and later input. Dialogs and changed model values still use the newly rendered field. */
WriterState.DOCS=[];WriterState.CASES.push({id:'k1',number:'CE-SYNTH-0001',address:'100 Synthetic St',owner:'Synthetic Owner'});
newDoc('k1','citation');const corr=doc(WriterState.state.docId);
corr.correction={targetId:'synthetic-issued-source',reason:'',case:clone(docCase(corr)),caseBaseline:caseDetails(kase('k1')),
  body:docBody(corr),blocks:clone(docBlocks(corr)),updateCase:true,externalReference:'',reviewed:false,outcomes:{},actionDate:recordDay(today)};
writeSummary=async()=>true;recordIntegrity.verify=async()=>({valid:true,anchored:false,label:'Synthetic verified record'});
WriterState.CASEDIR={helper:true,getFileHandle:async()=>{throw Object.assign(new Error('missing'),{name:'NotFoundError'});}};
WriterState.DIRNAME='Synthetic case folder';WriterState.NEEDGRANT=false;WriterState.PENDING=[];
let release=null;const saves=[];
helperJSON=async(url,body)=>{assert.equal(url,'/cases/save');saves.push(body.name);await new Promise(r=>{release=r;});
  return {ok:true,file:body.file,revision:'synthetic-'+saves.length,name:body.name};};
const heldSave=async()=>{release=null;const saving=saveCaseFile('k1');
  for(let i=0;i<200&&!release;i++)await new Promise(r=>setTimeout(r,1));assert.ok(release,'the helper save response is held');return [saving];};
const typeInto=(field,text,caret=text.length)=>{field.value=text;if(field.type!=='date')field.setSelectionRange(caret,caret);
  field.dispatchEvent(new window.Event('input',{bubbles:true}));};
render();
for(const [id,key] of [['correction-reason','reason'],['correction-external','externalReference']]){
  const [saving]=await heldSave(),before=document.getElementById(id);before.focus();typeInto(before,'Correct the error.',7);
  release();assert.equal(await saving,true,'the held shared save completes');
  const after=document.getElementById(id);
  assert.notEqual(after,before,'the save completion repaints the correction panel');
  assert.equal(document.activeElement,after,id+' keeps focus through the save repaint');
  assert.deepEqual([after.selectionStart,after.selectionEnd],[7,7],id+' keeps its caret');
  typeInto(after,'Correct the synthetic transcription error.');
  assert.equal(after.value,'Correct the synthetic transcription error.');
  assert.equal(corr.correction[key],'Correct the synthetic transcription error.',id+' input after the save reaches the draft');
}
{const [saving]=await heldSave(),date=document.getElementById('correction-action-date'),day=addDays(recordDay(today),-1);
  date.focus();typeInto(date,day);release();assert.equal(await saving,true);
  assert.equal(document.activeElement,document.getElementById('correction-action-date'),'the action date keeps focus');
  assert.equal(corr.correction.actionDate,day);}
{const [saving]=await heldSave(),field=document.getElementById('correction-reason');field.focus();
  WriterState.state.modal='storage';render();const dialog=document.querySelector('#overlay [role="dialog"]');
  assert.ok(dialog&&dialog.contains(document.activeElement),'the opened dialog has focus');
  release();assert.equal(await saving,true);
  assert.ok(document.querySelector('#overlay [role="dialog"]').contains(document.activeElement),'a save repaint never takes focus from a dialog');
  WriterState.state.modal=null;render();}
{const [saving]=await heldSave(),field=document.getElementById('correction-reason');field.focus();typeInto(field,'Inspector wording');
  corr.correction.reason='Program replacement reason';release();assert.equal(await saving,true);
  const fresh=document.getElementById('correction-reason');
  assert.equal(fresh.value,'Program replacement reason','a changed model value is redrawn');
  assert.notEqual(document.activeElement,fresh,'a changed model value is not refocused with stale typing');}
assert.equal(saves.length,5,'each check used one real held shared save');
console.log('PASS correction fields keep focus, caret and typing through a held shared-save completion; dialogs and model changes are respected');
`);
