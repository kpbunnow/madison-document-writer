globalThis.MADISON_TEST_DATA = true;
const fs = require("fs");
const { JSDOM } = require("jsdom");
const src = Buffer.from(
  /var B="([A-Za-z0-9+\/=]+)"/.exec(
    fs.readFileSync(
      require("path").join(
        process.env.DW_OUTPUT_DIR || require("path").join(require("path").resolve(__dirname, "../.."), "build/dist"),
        "madison-document-writer.html",
      ),
      "utf8",
    ),
  )[1],
  "base64",
).toString("utf8");
const dom = new JSDOM('<!doctype html><html><body><div id="app"></div><div id="overlay"></div><div id="toast"></div></body></html>', {
  pretendToBeVisual: true,
});
const w = dom.window;
global.window = w;
global.document = w.document;
global.getSelection = () => w.getSelection();
global.Blob = function (a) {
  global.lastBlob = a && a[0];
};
global.URL = { createObjectURL: () => "b", revokeObjectURL() {} };
global.FileReader = w.FileReader;
global.confirm = () => true;
Object.defineProperty(w.HTMLElement.prototype, "scrollHeight", {
  configurable: true,
  get() {
    if (!this.classList || !this.classList.contains("sheet")) return 0;
    let h = 105;
    Array.prototype.forEach.call(this.children, (c) => {
      if (c.tagName === "TABLE") {
        h += 26;
        const tb = c.querySelector("tbody");
        if (tb) h += tb.children.length * 78;
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
  " step(t){console.log('\\n--- '+t+' ---');}\nfunction leaks(h){return ['${'" +
  ",'.concat(','undefined','[object Object]','NaN'].filter(function(x){retu" +
  "rn h.indexOf(x)>=0;});}\n\nconsole.log('FULL WORKFLOW, TWO VISITS, ENDING " +
  "IN A CITATION');\nWriterState.DOCS.length=0;WriterState.REINSP.length=0;W" +
  "riterState.EVENTS={};\n\nstep('1. inspector opens a case and writes the no" +
  "tice');\nWriterState.state.screen='cases';render();\nok('cases screen rend" +
  "ers clean',leaks(document.getElementById('app').innerHTML).length===0);\n" +
  "newDoc('k1','notice');var N=WriterState.DOCS[0];WriterState.state.docId=" +
  "N.id;WriterState.state.screen='write';\n[['27.05(2)(c)','Exterior propert" +
  "y area','Clean all exterior property areas.'],\n ['27.05(2)(f)','Grow gra" +
  "ss','Establish grass on the north terrace.'],\n ['10.25(5)','Terrace plan" +
  "tings','Remove the shrubs from the terrace.'],\n ['27.05(2)(y)','Downspou" +
  "t','Redirect the downspout away from the foundation.']]\n .forEach(functi" +
  "on(t){N.items.push({id:uid('x'),group:'',sections:[t[0]],title:t[1],\n   " +
  "abate:false,due:futureDue(iso(today),21),text:t[2],prov:'notice'});});\nr" +
  "enumber(N);render();\nok('notice renders clean',leaks(document.querySelec" +
  "tor('.desk').innerHTML).length===0);\nok('4 items numbered 1-4',N.items.m" +
  "ap(function(i){return i.no;}).join(',')==='1,2,3,4');\nok('no blockers',b" +
  "lockers(N).length===0,blockers(N).map(function(c){return c.t;}).join('|'" +
  "));\n\nstep('2. finalize: freezes, saves the case file, prints');\nN.mailed" +
  "=iso(today);renumber(N);issueDocument(N);N=docsFor('k1')[0];\nsaveCaseFil" +
  "e('k1');\nvar file1=lastBlob;\nok('case file produced',!!file1&&file1.leng" +
  "th>500,file1.length+' bytes');\nok('notice now locked',isLocked(N)&&!stru" +
  "ctEditable(N));\nrender();\nok('locked notice has no editable fields',docu" +
  "ment.querySelector('.desk').innerHTML.indexOf('contenteditable')<0);\n\nst" +
  "ep('3. reload the file on a later visit');\nWriterState.DOCS.length=0;Wri" +
  "terState.REINSP.length=0;WriterState.EVENTS={};WriterState.CASES=WriterS" +
  "tate.CASES.filter(function(c){return c.id!=='k1';});\nloadCaseFile(file1)" +
  ";\nvar k=WriterState.CASES.filter(function(c){return c.number===JSON.pars" +
  "e(file1)['case'].number;})[0];\nok('case restored',!!k,k&&k.address);\nok(" +
  "'notice restored with 4 items',docsFor(k.id)[0].items.length===4);\nok('s" +
  "till locked after reload',isLocked(docsFor(k.id)[0]));\n\nstep('4. first r" +
  "einspection: 1 corrected, 3 outstanding');\nstartReinspection(k.id);var r" +
  "=WriterState.REINSP[WriterState.REINSP.length-1];r.date=iso(today);r.tim" +
  "e='10:00';\nvar src1=doc(r.sourceDocId);\nok('worksheet walks the notice'," +
  "src1.type==='notice'&&src1.items.length===4);\nsrc1.items.forEach(functio" +
  "n(it,i){r.results[it.id]={oc:i===0?'corrected':'progress',\n  on:r.date,d" +
  "ue:i===0?'':futureDue(iso(today),21),note:i===0?'Owner cleared it.':'',c" +
  "ite:false};});\nrender();\nok('worksheet renders clean',leaks(document.get" +
  "ElementById('app').innerHTML).length===0);\nok('1 corrected / 3 outstandi" +
  "ng',doneItems(r).length===1&&openItems(r).length===3);\ndocFromReinspecti" +
  "on(r,'extension');\nvar E=WriterState.DOCS[0];WriterState.state.docId=E.i" +
  "d;render();\nok('extension shows all 4 items',E.items.length===4);\nok('  " +
  "item 1 struck through',E.items[0].done&&!!E.items[0].doneOn);\nok('  numb" +
  "ers preserved 1-4',E.items.map(function(i){return i.no;}).join(',')==='1" +
  ",2,3,4');\nok('  renders clean',leaks(document.querySelector('.desk').inn" +
  "erHTML).length===0);\nok('  no blockers',blockers(E).length===0,blockers(" +
  "E).map(function(c){return c.t;}).join('|'));\nE.mailed=iso(today);issueDo" +
  "cument(E);E=docsFor(k.id)[0];\nsaveCaseFile(k.id);var file2=lastBlob;\n\nst" +
  "ep('5. second reinspection off the extension, ending in two citations');" +
  "\nstartReinspection(k.id);var r2=WriterState.REINSP[WriterState.REINSP.le" +
  "ngth-1];r2.date=iso(today);r2.time='10:00';\nok('walks the extension',doc" +
  "(r2.sourceDocId).type==='extension');\nok('cleared item pre-seeded and lo" +
  "cked',r2.results[E.items[0].id].carried===true);\nok('only 3 left to resu" +
  "lt',unchecked(r2).length===3);\nE.items.forEach(function(it,i){\n  if(i===" +
  "0)return;\n  r2.results[it.id]={oc:i===1?'corrected':'none',on:r2.date,\n " +
  "   due:i===1?'':futureDue(iso(today),21),note:'',cite:i>1};});\ndocFromRe" +
  "inspection(r2,'citation');\nvar C=WriterState.DOCS[0];WriterState.state.d" +
  "ocId=C.id;render();\nok('citation shows all 4 items',C.items.length===4);" +
  "\nok('  2 struck through',C.items.filter(function(i){return i.done;}).len" +
  "gth===2);\nok('  2 cited',C.items.filter(function(i){return i.cite;}).len" +
  "gth===2);\nvar cited=C.items.filter(function(i){return i.cite;});\nok('  d" +
  "eposits calculated',cited.every(function(i){return !!C.cits[i.id].amount" +
  ";}),\n   cited.map(function(i){return i.sections[0]+'='+C.cits[i.id].amou" +
  "nt;}).join('  '));\nok('  citation numbers unique',C.cits[cited[0].id].nu" +
  "m!==C.cits[cited[1].id].num);\nok('  court dates are a Wednesday',cited.e" +
  "very(function(i){var p=C.cits[i.id].courtDate.split('-');\n   return new " +
  "Date(+p[0],+p[1]-1,+p[2]).getDay()===3;}));\nok('  session times valid',c" +
  "ited.every(function(i){return ['08:30','09:30'].indexOf(C.cits[i.id].cou" +
  "rtTime)>=0;}));\nok('  badges filled',cited.every(function(i){return !!C." +
  "cits[i.id].deptId;}));\nok('  narrative drafted',(C.cits[cited[0].id].com" +
  "ment||'').indexOf('Re-inspection on')>=0);\nok('  no blockers',blockers(C" +
  ").length===0,blockers(C).map(function(c){return c.t;}).join(' | '));\n\nst" +
  "ep('6. the printed document');\nvar pages=document.querySelectorAll('.des" +
  "k .sheet'),cits=document.querySelectorAll('.desk .cit');\nok('notice page" +
  "s then citation pages',pages.length>=1&&cits.length===8);\nvar kids=Array" +
  ".prototype.map.call(document.querySelector('.desk').children,function(n)" +
  "{return n.className.split(' ')[0];});\nok('  order is sheet(s) first',kid" +
  "s.indexOf('cit')>kids.lastIndexOf('sheet'),kids.join(' '));\nok('  4 copi" +
  "es per citation',cits.length===8);\nvar labels=Array.prototype.map.call(c" +
  "its,function(c){return c.querySelector('.cit-foot span:last-child').text" +
  "Content;});\nok('  copy labels repeat correctly',labels.slice(0,4).join('" +
  "|')===labels.slice(4).join('|'),labels.slice(0,4).join(' / '));\nok('  ag" +
  "ency+inspector copies carry a record',Array.prototype.filter.call(cits,f" +
  "unction(c){return !!c.querySelector('.cit-rec');}).length===4);\nok('  de" +
  "fendant copies carry instructions',Array.prototype.filter.call(cits,func" +
  "tion(c){return !!c.querySelector('.cit-inst');}).length===2);\nok('  no l" +
  "eaks anywhere',leaks(document.querySelector('.desk').innerHTML).length==" +
  "=0);\n\nstep('7. final save and reload');\nC.mailed=iso(today);issueDocumen" +
  "t(C);C=docsFor(k.id)[0];\nsaveCaseFile(k.id);var file3=lastBlob;\nWriterSt" +
  "ate.DOCS.length=0;WriterState.REINSP.length=0;WriterState.EVENTS={};Writ" +
  "erState.CASES=WriterState.CASES.filter(function(c){return c.id!==k.id;})" +
  ";\nloadCaseFile(file3);\nvar k3=WriterState.CASES.filter(function(c){retur" +
  "n c.number===JSON.parse(file3)['case'].number;})[0];\nok('3 documents res" +
  "tored',docsFor(k3.id).filter(function(d){return !d.draft;}).length===3);" +
  "\nok('2 reinspections restored',reinspFor(k3.id).length===2);\nok('citatio" +
  "n deposits survive',(function(){var c=docsFor(k3.id)[0];\n  return Object" +
  ".keys(c.cits).every(function(x){return !!c.cits[x].amount;});})());\nWrit" +
  "erState.state.docId=docsFor(k3.id)[0].id;WriterState.state.screen='write" +
  "';render();\nok('reloaded citation renders clean',leaks(document.querySel" +
  "ector('.desk').innerHTML).length===0);\nok('everything locked',docsFor(k3" +
  ".id).filter(function(d){return !d.draft;}).every(function(d){return isLo" +
  "cked(d);}));\n\nif(fails.length&&typeof process!=='undefined')process.exit" +
  "Code=1;\nif(fails.length)process.exitCode=1;\nconsole.log('\\n'+(fails.leng" +
  "th?fails.length+' FAILURE(S): '+fails.join(' | '):'END-TO-END CLEAN'));\n";
eval(src + "\n;;\n" + T);
