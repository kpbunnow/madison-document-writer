const assert = require("assert/strict");
require("../fixtures/bundle_test.cjs")(
  "\nWriterState.state.screen='import';WriterState.state.acc=null;WriterStat" +
    "e.state.modal=null;WriterState.state.picker=false;\nrender();\nconst alter" +
    "native=document.querySelector('.import-alternative');alternative.open=tr" +
    "ue;\ndocument.getElementById('acc-pick').focus();render();\nassert.equal(d" +
    "ocument.querySelector('.import-alternative').open,true,'late repaint kee" +
    "ps Excel choice visible');\nassert.equal(document.activeElement.id,'acc-p" +
    "ick','late repaint keeps picker keyboard focus');\ndocument.querySelector" +
    "('.import-alternative').open=false;render();\nassert.equal(document.query" +
    "Selector('.import-alternative').open,false,'an explicit close remains cl" +
    "osed');\ndocument.querySelector('.import-alternative').open=true;WriterSt" +
    "ate.state.screen='cases';render();\nWriterState.state.screen='import';ren" +
    "der();assert.equal(document.querySelector('.import-alternative').open,fa" +
    "lse,'a new navigation starts with its own disclosure state');\nconsole.lo" +
    "g('PASS import disclosure, picker focus, explicit close and navigation i" +
    "solation');",
);
