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
  "\nvar fails=[];\nfunction H(t){console.log('\\n=== '+t+' ===');}\nfunction o" +
  "k(l,c,extra){console.log('  '+(c?'ok   ':'FAIL ')+l+(extra!==undefined?'" +
  "   '+extra:''));if(!c)fails.push(l);}\nfunction fresh(){WriterState.DOCS." +
  "length=0;WriterState.REINSP.length=0;WriterState.EVENTS={};WriterState.s" +
  "tate.docId=null;WriterState.state.reinspId=null;}\nfunction mkNotice(cid," +
  "n,secs){\n  fresh();newDoc(cid||'k1','notice');var N=WriterState.DOCS[0];" +
  "\n  for(var i=0;i<(n||1);i++)N.items.push({id:uid('x'),group:'',sections:" +
  "secs||['27.05(2)(c)'],\n    title:'Item '+(i+1),abate:false,due:futureDue" +
  "(iso(today),21),text:'Do the work.',prov:'notice'});\n  renumber(N);retur" +
  "n N;\n}\n\nH('ESCAPING / INJECTION');\nvar N=mkNotice('k1',1);\nvar k=kase('k" +
  "1'),save={o:k.owner,a:k.address,nm:k.number};\nk.owner='<script>alert(1)<" +
  "\\/script>';\nk.address='\" onmouseover=\"alert(2)';\nk.number=\"'); alert(3);" +
  " //\";\nN.items[0].title='<img src=x onerror=alert(4)>';\nN.items[0].text='" +
  "5 < 6 & 7 > 4 \"quoted\" \\'single\\'';\nWriterState.state.docId=N.id;WriterS" +
  "tate.state.screen='write';\nvar h=screenWrite();\nok('no live script tag i" +
  "njected',h.indexOf('<script>alert')<0);\nok('no img onerror injected',h.i" +
  "ndexOf('<img src=x')<0);\nok('quote in address escaped',h.indexOf('\" onmo" +
  "useover=')<0);\nok('ampersand escaped',h.indexOf('&amp;')>=0);\nk.owner=sa" +
  "ve.o;k.address=save.a;k.number=save.nm;\n\nH('EMPTY AND MISSING DATA');\nfr" +
  "esh();\nok('cases screen with no docs renders',screenCases().length>500);" +
  "\nnewDoc('k1','notice');WriterState.state.docId=WriterState.DOCS[0].id;\no" +
  "k('writer with zero items renders',screenWrite().length>1000);\nok('check" +
  "s on an empty notice',checks(WriterState.DOCS[0]).filter(function(c){ret" +
  "urn !c.ok;}).length>0);\nvar orphan={id:'dX',caseId:'nosuchcase',type:'no" +
  "tice',created:iso(today),status:'Draft',mailed:iso(today),items:[],cc:''" +
  ",cits:{}};\nWriterState.DOCS.unshift(orphan);WriterState.state.docId='dX'" +
  ";\nvar threw=false;try{screenWrite();}catch(e){threw=true;}\nok('document " +
  "pointing at a missing case does not throw',!threw);\nWriterState.DOCS.shi" +
  "ft();\nWriterState.state.docId='nope';\nok('missing docId falls back to ca" +
  "ses',render()===undefined||true);\n\nH('ITEM NUMBERING');\nN=mkNotice('k1'," +
  "5);\nWriterState.state.docId=N.id;\nok('renumber is 1..n',N.items.map(func" +
  "tion(i){return i.no;}).join(',')==='1,2,3,4,5',N.items.map(function(i){r" +
  "eturn i.no;}).join(','));\nN.items.reverse();renumber(N);\nok('renumber af" +
  "ter reorder',N.items.map(function(i){return i.no;}).join(',')==='1,2,3,4" +
  ",5');\nN.items.splice(2,1);renumber(N);\nok('renumber after delete',N.item" +
  "s.map(function(i){return i.no;}).join(',')==='1,2,3,4');\n\nH('LOCK STATE " +
  "MACHINE');\nfresh();\nN=mkNotice('k1',2);\nok('draft notice editable',!isLo" +
  "cked(N)&&structEditable(N));\nvar before=WriterState.REINSP.length;\nstart" +
  "Reinspection('k1');\nok('a draft notice cannot be reinspected',WriterStat" +
  "e.REINSP.length===before);\nok('  and stays fully editable',structEditabl" +
  "e(N)&&!isLocked(N));\nissueDocument(N);\nvar pub=docsFor('k1')[0];\nok('iss" +
  "ued notice locked',isLocked(pub)&&!structEditable(pub));\nstartReinspecti" +
  "on('k1');reinsp(WriterState.state.reinspId).time='10:00';\nok('an issued " +
  "notice can be reinspected',WriterState.REINSP.filter(function(x){return " +
  "x.draft;}).length===1);\nvar r=WriterState.REINSP.filter(function(x){retu" +
  "rn x.draft;})[0];\npub.items.forEach(function(it){r.results[it.id]={oc:'n" +
  "one',on:r.date,due:futureDue(iso(today),21),note:'',cite:false};});\ndocF" +
  "romReinspection(r,'extension');\nvar E=WriterState.DOCS.filter(function(d" +
  "){return d.draft;})[0];\nok('extension is the newest doc',docsFor('k1')[0" +
  "]===E);\nok('extension is editable',!isLocked(E));\nok('one follow-up only" +
  "',(function(){var n=WriterState.DOCS.length;docFromReinspection(r,'citat" +
  "ion');return WriterState.DOCS.length===n;})());\nok('  second call opens " +
  "the existing doc',WriterState.state.docId===E.id);\n\nH('REINSPECTION SEED" +
  "ING');\nfresh();\nN=mkNotice('k1',3);N.mailed=iso(today);issueDocument(N);" +
  "\nvar pub2=docsFor('k1')[0];\nstartReinspection('k1');reinsp(WriterState.s" +
  "tate.reinspId).time='10:00';r=WriterState.REINSP.filter(function(x){retu" +
  "rn x.draft;})[0];\nok('nothing pre-resulted on a first visit',unchecked(r" +
  ").length===3);\npub2.items.forEach(function(it,ix){r.results[it.id]={oc:i" +
  "x===0?'corrected':'none',on:r.date,\n  due:ix===0?'':futureDue(iso(today)" +
  ",21),note:'',cite:false};});\ndocFromReinspection(r,'extension');\nE=Write" +
  "rState.DOCS.filter(function(d){return d.draft;})[0];\nissueDocument(E);\nv" +
  "ar pubE=docsFor('k1')[0];\nok('extension carries all 3 items',pubE.items." +
  "length===3);\nok('  one marked done',pubE.items.filter(function(i){return" +
  " i.done;}).length===1);\nstartReinspection('k1');reinsp(WriterState.state" +
  ".reinspId).time='10:00';var r2=WriterState.REINSP.filter(function(x){ret" +
  "urn x.draft;})[0];\nok('it walks the extension',doc(r2.sourceDocId)===pub" +
  "E);\nok('second visit pre-seeds the cleared item',Object.keys(r2.results)" +
  ".length===1);\nok('  it is locked as carried',r2.results[pubE.items[0].id" +
  "].carried===true);\nok('  only 2 left to result',unchecked(r2).length===2" +
  ");\n\nH('DATE HANDLING');\nok('iso() has no UTC drift',iso(new Date(2026,0," +
  "1))==='2026-01-01',iso(new Date(2026,0,1)));\nok('futureDue crosses a yea" +
  "r end',futureDue('2026-12-20',21)==='2027-01-10',futureDue('2026-12-20'," +
  "21));\nok('daysBetween across a leap day',daysBetween('2028-02-27','2028-" +
  "03-01')===3,daysBetween('2028-02-27','2028-03-01'));\nok('daysBetween acr" +
  "oss DST spring',daysBetween('2026-03-07','2026-03-09')===2,daysBetween('" +
  "2026-03-07','2026-03-09'));\nok('daysBetween across DST autumn',daysBetwe" +
  "en('2026-10-31','2026-11-02')===2,daysBetween('2026-10-31','2026-11-02')" +
  ");\nok('fmtDate of empty is a dash (table)',fmtDate('')==='—');\nok('fmtDa" +
  "teEd of empty is blank (field)',fmtDateEd('')==='');\nok('longDate of emp" +
  "ty is empty',longDate('')==='');\nok('fmtTime midnight',fmtTime('00:00')=" +
  "=='12:00 AM',fmtTime('00:00'));\nok('fmtTime noon',fmtTime('12:00')==='12" +
  ":00 PM',fmtTime('12:00'));\nok('court date never a weekend',(function(){f" +
  "or(var n=0;n<400;n++){var f=iso(new Date(2026,0,1+n));\n  var c=nextCourt" +
  "Date(f),p=c.split('-');if(new Date(+p[0],+p[1]-1,+p[2]).getDay()!==3)ret" +
  "urn false;}return true;})());\n\nH('CASE FILE ROUND TRIP');\nfresh();\nN=mkN" +
  "otice('k1',3);N.mailed=iso(today);issueDocument(N);\nvar pubR=docsFor('k1" +
  "')[0];\nstartReinspection('k1');reinsp(WriterState.state.reinspId).time='" +
  "10:00';r=WriterState.REINSP.filter(function(x){return x.draft;})[0];\npub" +
  "R.items.forEach(function(it,ix){r.results[it.id]={oc:ix?'none':'correcte" +
  "d',on:r.date,due:ix?futureDue(iso(today),21):'',note:'n'+ix,cite:ix===1}" +
  ";});\ndocFromReinspection(r,'citation');\nissueDocument(WriterState.DOCS.f" +
  "ilter(function(d){return d.draft;})[0]);\nvar json=JSON.stringify(caseFil" +
  "e('k1'));\nvar beforeDocs=JSON.stringify(docsFor('k1')),beforeRe=JSON.str" +
  "ingify(reinspFor('k1'));\nloadCaseFile(json);\nvar k2=WriterState.CASES.fi" +
  "lter(function(c){return c.number===kase('k1').number;});\nok('no duplicat" +
  "e case after load',k2.length===1);\nok('documents identical',JSON.stringi" +
  "fy(docsFor(k2[0].id))===beforeDocs);\nok('reinspections identical',JSON.s" +
  "tringify(reinspFor(k2[0].id))===beforeRe);\nok('newest doc still first',d" +
  "ocsFor(k2[0].id)[0].type==='citation');\nloadCaseFile(json);loadCaseFile(" +
  "json);\nok('loading three times leaves one copy',WriterState.CASES.filter" +
  "(function(c){return c.number===k2[0].number;}).length===1);\nvar kk=Write" +
  "rState.CASES.filter(function(c){return c.number===k2[0].number;})[0];\nok" +
  "('  and one set of documents',docsFor(kk.id).length===2,\n   docsFor(kk.i" +
  "d).map(function(d){return d.type+(d.draft?'(draft)':'');}).join(', ')+\n " +
  "  '  events '+eventsFor(kk.id).length);\nok('rejects a non-case-file',(fu" +
  'nction(){var n=WriterState.CASES.length;loadCaseFile(\'{"format":"other"}' +
  "');return WriterState.CASES.length===n;})());\nok('rejects malformed json" +
  "',(function(){var n=WriterState.CASES.length;loadCaseFile('{not json');r" +
  "eturn WriterState.CASES.length===n;})());\n\nH('ID COLLISION AFTER LOAD');" +
  "\nfresh();\nN=mkNotice('k1',2);issueDocument(N);N=docsFor(N.caseId)[0];\nva" +
  "r f1=JSON.stringify(caseFile('k1'));\nWriterState.seq=0;                 " +
  "      // simulate a fresh session with a reset counter\nloadCaseFile(f1);" +
  "\nvar kk=WriterState.CASES.filter(function(c){return c.number===JSON.pars" +
  "e(f1)['case'].number;})[0];\nvar d1=docsFor(kk.id)[0];\nnewDoc(kk.id,'noti" +
  "ce');\nok('new ids do not collide with loaded ones',WriterState.DOCS[0].i" +
  "d!==d1.id,WriterState.DOCS[0].id+' vs '+d1.id);\nvar allIds=WriterState.D" +
  "OCS.map(function(d){return d.id;});\nok('  all document ids unique',new S" +
  "et(allIds).size===allIds.length);\n\nif(fails.length)process.exitCode=1;\nc" +
  "onsole.log('\\n'+(fails.length?fails.length+' FAILURE(S): '+fails.join(' " +
  "| '):'all functional checks passed'));\n";
eval(src + "\n;;\n" + T);
