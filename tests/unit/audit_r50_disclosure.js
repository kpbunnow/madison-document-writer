const assert = require("assert/strict");
require("../fixtures/bundle_test.cjs")(
  '\nconst html=id=>\'<main class="document-workspace" data-editor-doc="\'+id+\'"><details id="r26-details"><summary>Review sources</summary><input></details>' +
    '<div data-charge="item-one"><details data-review-details="pricing"><summary>Pricing</summary>Basis</details></div></main>\';\n' +
    "WriterState.state={screen:'write',docId:'one'};A11Y.rememberFocus=()=>{};A11Y.enhance=()=>{};ensureWalkContext=()=>{};screenWrite=()=>html(WriterState.state.docId);" +
    "overlayHTML=()=>'';paginate=()=>{};restoreWorkControls=()=>{};updateSaveStatus=()=>{};enhanceDialog=()=>{};highlightOpenChecks=()=>{};\n" +
    "document.getElementById('app').innerHTML=html('one');document.getElementById('r26-details').open=true;" +
    "document.querySelector('[data-review-details=pricing]').open=true;render();\n" +
    "assert.equal(document.getElementById('r26-details').open,true);assert.equal(document.querySelector('[data-review-details=pricing]').open,true);\n" +
    "assert.equal(document.querySelector('.editor-initial-options'),null);\n" +
    "WriterState.state.docId='two';render();assert.equal(document.querySelector('[data-review-details=pricing]').open,false);" +
    "console.log('PASS disclosure state survives only the same document repaint');",
);
