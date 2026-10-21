/* A background repaint of a snow citation must keep focus, and typed facts, in the snow field being entered. */
require("../fixtures/bundle_test.cjs")(String.raw`
saveDrafts=async()=>true;idbSet=async()=>true;
WriterState.HELPER=null;WriterState.CASEDIR=null;WriterState.state.modal=null;
const stamp=recordDay(today);
WriterState.CASES.push({id:'case-snow-repaint',number:'QA-SNOW-REPAINT',address:'3400 SYNTHETIC SNOW ST',parcel:'070822219190',
  owner:'SYNTHETIC OWNER',ownerAddr:['3400 SYNTHETIC SNOW ST','MADISON WI 53703'],inspectorId:'i4',date:stamp,time:'11:46',caseType:'snow-10.28',historic:false});
newDoc('case-snow-repaint','notice');WriterState.state.screen='write';render();
const d=doc(WriterState.state.docId),field=(key)=>document.querySelector('[data-snow="'+key+'"]');
assert.equal(d.type,'citation');
for(const key of ['snowfallDate','inches','condition','photographed']){
  field(key).focus();render();
  assert.equal(document.activeElement,field(key),key+' keeps focus through a repaint of the same document');
}
field('inches').focus();render();
document.activeElement.value='0.8';document.activeElement.dispatchEvent(new window.Event('input',{bubbles:true}));
assert.equal(d.snow.inches,0.8,'input typed after the repaint reaches the draft');
field('inches').focus();newDoc('case-snow-repaint','notice');render();
assert.notEqual(doc(WriterState.state.docId).id,d.id);
assert.notEqual(document.activeElement?.dataset?.snow,'inches','a different document does not inherit snow focus');
WriterState.state.docId=d.id;render();field('inches').focus();
WriterState.state.modal={type:'synthetic-dialog'};render();
assert.notEqual(document.activeElement?.dataset?.snow,'inches','an open dialog keeps focus');
console.log('PASS snow facts keep focus and typed input through same-document repaints');
`);
