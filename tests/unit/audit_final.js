globalThis.MADISON_TEST_DATA = true;
const { JSDOM } = require("jsdom");
const { builtPage, bundleSource } = require("../fixtures/built_bundle.cjs");
const html = builtPage(),
  src = bundleSource(html);
const CSS = /<style>([\s\S]*?)<\/style>/.exec(html)[1];
const dom = new JSDOM(
  "<!doctype html><html><head><style>" +
    CSS +
    '</style></head><body><div id="app"></div><div id="overlay"></div><div id="toast"></div></body></html>',
  { pretendToBeVisual: true },
);
const w = dom.window;
global.window = w;
global.document = w.document;
global.getSelection = () => w.getSelection();
global.Blob = function () {};
global.URL = { createObjectURL: () => "b", revokeObjectURL() {} };
global.FileReader = w.FileReader;
global.confirm = () => true;
global.prompt = () => "reason";
global.fetch = async () => {
  throw 0;
};
Object.defineProperty(w.HTMLElement.prototype, "scrollHeight", {
  configurable: true,
  get() {
    if (!this.classList || !this.classList.contains("sheet")) return 0;
    let h = 105;
    Array.prototype.forEach.call(this.children, (c) => {
      if (c.classList && (c.classList.contains("no-print") || c.classList.contains("addrow") || c.classList.contains("addnote"))) return;
      if (c.tagName === "TABLE") {
        h += 26;
        const tb = c.querySelector("tbody");
        if (tb) h += tb.children.length * 60;
      } else h += 70;
    });
    return h;
  },
});
Object.defineProperty(w.HTMLElement.prototype, "clientWidth", {
  configurable: true,
  get() {
    return 900;
  },
});
const T =
  "\n// Schema 4 export fixture; R31 tests cover schema 5 helper-only writes" +
  ".\nconst legacyCaseFile=caseFile;caseFile=(cid)=>({...legacyCaseFile(cid)" +
  ",schema:4});\n\nvar fails=[];\nfunction ok(l,c,x){console.log('  '+(c?'ok  " +
  " ':'FAIL ')+l+(x!==undefined?'   '+x:''));if(!c)fails.push(l);}\nfunction" +
  " addItems(N,n){for(var i=0;i<n;i++)N.items.push({id:uid('x'),group:i%5==" +
  "=4?'GENERAL EXTERIOR':'',\n  sections:['27.05(2)(c)'],title:'Item '+(i+1)" +
  ",abate:i%3===0,due:futureDue(iso(today),21),\n  text:'Clean all exterior " +
  "property areas.',prov:'notice'});renumber(N);}\nfunction leaks(h){return " +
  "['${','.concat(','undefined','[object Object]','NaN'].filter(function(x)" +
  "{return h.indexOf(x)>=0;});}\n\nconsole.log('EVERY SCREEN AND EVERY DOCUME" +
  "NT TYPE, RENDERED AND CHECKED');\nWriterState.DOCS.length=0;WriterState.R" +
  "EINSP.length=0;WriterState.EVENTS={};\n\n// each screen\n['cases','import'," +
  "'library'].forEach(function(sc){\n  WriterState.state.screen=sc;render();" +
  "\n  var h=document.getElementById('app').innerHTML;\n  ok(sc.padEnd(10)+' " +
  "clean',leaks(h).length===0&&h.length>500,leaks(h).join(' ')||h.length+' " +
  "chars');\n});\n\n// notice -> extension -> citation -> referral -> complian" +
  "ce, all rendered\nnewDoc('k1','notice');var N=WriterState.DOCS[0];addItem" +
  "s(N,7);\nWriterState.state.docId=N.id;WriterState.state.screen='write';re" +
  "nder();\nok('notice     clean',leaks(document.querySelector('.desk').inne" +
  "rHTML).length===0);\nissueDocument(N);\nvar pub=docsFor('k1')[0];\n\nfunctio" +
  "n visit(outcome,cite){\n  startReinspection('k1');var r=WriterState.REINS" +
  "P.filter(x=>x.draft)[0];r.time='10:00';\n  doc(r.sourceDocId).items.forEa" +
  "ch(function(it,i){\n    if(r.results[it.id]&&r.results[it.id].carried)ret" +
  "urn;\n    r.results[it.id]={oc:outcome,on:r.date,due:outcome==='corrected" +
  "'?'':futureDue(iso(today),21),\n      note:'',cite:!!cite&&i===0};});\n  r" +
  "eturn r;\n}\nvar r1=visit('none',false);\ndocFromReinspection(r1,'extension" +
  "');\nvar E=WriterState.DOCS.filter(d=>d.draft)[0];WriterState.state.docId" +
  "=E.id;render();\nok('extension  clean',leaks(document.querySelector('.des" +
  "k').innerHTML).length===0);\nok('  no blockers',blockers(E).length===0,bl" +
  "ockers(E).map(c=>c.t).join(' | '));\nissueDocument(E);\n\nvar r2=visit('non" +
  "e',true);\ndocFromReinspection(r2,'citation');\nvar C=WriterState.DOCS.fil" +
  "ter(d=>d.draft)[0];WriterState.state.docId=C.id;render();\nok('citation  " +
  " clean',leaks(document.querySelector('.desk').innerHTML).length===0);\nok" +
  "('  no blockers',blockers(C).length===0,blockers(C).map(c=>c.t).join(' |" +
  " '));\nok('  four copies',document.querySelectorAll('.desk .cit').length=" +
  "==4);\nissueDocument(C);\n\nvar r3=visit('none',false);\ndocFromReinspection" +
  "(r3,'referral');\nvar R=WriterState.DOCS.filter(d=>d.draft)[0];WriterStat" +
  "e.state.docId=R.id;render();\nok('referral   clean',leaks(document.queryS" +
  "elector('.desk').innerHTML).length===0);\nok('  no blockers',blockers(R)." +
  "length===0,blockers(R).map(c=>c.t).join(' | '));\nok('  no due dates',R.i" +
  "tems.every(i=>i.done||!i.due));\nissueDocument(R);\n\nvar r4=visit('correct" +
  "ed',false);\ndocFromReinspection(r4,'compliance');\nvar K=WriterState.DOCS" +
  ".filter(d=>d.draft)[0];WriterState.state.docId=K.id;render();\nok('compli" +
  "ance clean',leaks(document.querySelector('.desk').innerHTML).length===0)" +
  ";\nok('  no blockers',blockers(K).length===0,blockers(K).map(c=>c.t).join" +
  "(' | '));\nissueDocument(K);\n\nconsole.log('');\nok('case history',docsFor(" +
  "'k1').filter(d=>!d.draft).map(d=>d.type).reverse().join(' -> '),\n  docsF" +
  "or('k1').filter(d=>!d.draft).map(d=>d.type).reverse().join(' -> '));\nok(" +
  "'  five events + four visits',eventsFor('k1').length===9,eventsFor('k1')" +
  ".length+' events');\nok('  all issued documents locked',docsFor('k1').fil" +
  "ter(d=>!d.draft).every(isLocked));\n\n// A correction uses the locked docu" +
  "ment, without reconstructing a visit.\nvar original=docsFor('k1').find(d=" +
  ">!d.draft),back=startCorrection(original.id);\nok('compliance correction " +
  "is a linked draft',!!back&&back.correction.targetId===original.id);\nok('" +
  "correction editor renders cleanly',leaks(screenWrite()).length===0);\nok(" +
  "'original remains effective',isEffective(doc(original.id)));\nWriterState" +
  ".DOCS=WriterState.DOCS.filter(d=>!d.draft);\n\n// file round trip of the w" +
  "hole case\nconsole.log('');\nvar json=JSON.stringify(caseFile('k1'));\nvar " +
  "before=JSON.stringify(docsFor('k1').filter(d=>!d.draft));\nWriterState.EV" +
  "ENTS={};WriterState.DOCS=WriterState.DOCS.filter(d=>d.draft);project();\n" +
  "loadCaseFile(json);\nok('whole case round trips',JSON.stringify(docsFor('" +
  "k1').filter(d=>!d.draft))===before);\nok('  current schema',JSON.parse(js" +
  "on).schema===4);\n\nif(fails.length&&typeof process!=='undefined')process." +
  "exitCode=1;\nif(fails.length)process.exitCode=1;\nconsole.log('\\n'+(fails." +
  "length?fails.length+' FAILURE(S): '+fails.join(' | '):'FULL SYSTEM CLEAN" +
  "'));\n";
eval(src + "\n;;\n" + T);
