const assert = require("assert/strict");
require("../fixtures/bundle_test.cjs")(
  '\nconst html=id=>\'<main class="document-workspace" data-editor-doc="\'+id+' +
    '\'"><details class="editor-initial-options"><summary>Other initial inspec' +
    "tion actions</summary><select data-initial-action><option>Choose action<" +
    '/option></select></details><details id="r26-details"><summary>Review sou' +
    'rces</summary><input></details><div data-charge="item-one"><details data' +
    '-review-details="pricing"><summary>Pricing</summary>Basis</details></div' +
    "></main>';\nWriterState.state={screen:'write',docId:'one'};A11Y.rememberF" +
    "ocus=()=>{};A11Y.enhance=()=>{};ensureWalkContext=()=>{};screenWrite=()=" +
    ">html(WriterState.state.docId);overlayHTML=()=>'';paginate=()=>{};restor" +
    "eWorkControls=()=>{};updateSaveStatus=()=>{};enhanceDialog=()=>{};highli" +
    "ghtOpenChecks=()=>{};\ndocument.getElementById('app').innerHTML=html('one" +
    "');document.querySelector('.editor-initial-options').open=true;document." +
    "getElementById('r26-details').open=true;document.querySelector('[data-re" +
    "view-details=pricing]').open=true;document.querySelector('[data-initial-" +
    "action]').focus();render();\nassert.equal(document.querySelector('.editor" +
    "-initial-options').open,true);assert.equal(document.getElementById('r26-" +
    "details').open,true);assert.equal(document.querySelector('[data-review-d" +
    "etails=pricing]').open,true);assert.equal(document.activeElement,documen" +
    "t.querySelector('[data-initial-action]'));\nWriterState.state.docId='two'" +
    ";render();assert.equal(document.querySelector('.editor-initial-options')" +
    ".open,false);console.log('PASS disclosure and focus survive only the sam" +
    "e document repaint');",
);
