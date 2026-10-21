globalThis.MADISON_TEST_DATA = true;
const { JSDOM } = require("jsdom");
const { builtPage, bundleSource } = require("../fixtures/built_bundle.cjs");
const src = bundleSource(builtPage());
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
global.prompt = () => "Wrong ordinance on item 2";
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
  ",schema:4});\n\nvar fails=[];\nfunction H(t){console.log('\\n=== '+t+' ===')" +
  ";}\nfunction ok(l,c,x){console.log('  '+(c?'ok   ':'FAIL ')+l+(x!==undefi" +
  "ned?'   '+x:''));if(!c)fails.push(l);}\nfunction fresh(){WriterState.DOCS" +
  ".length=0;WriterState.REINSP.length=0;WriterState.EVENTS={};}\nfunction a" +
  "ddItems(N,n){for(var i=0;i<n;i++)N.items.push({id:uid('x'),group:'',sect" +
  "ions:['27.05(2)(c)'],\n  title:'Item '+(i+1),abate:false,due:futureDue(is" +
  "o(today),21),text:'Do the work.',prov:'notice'});renumber(N);}\n\nH('EVENT" +
  " LOG BASICS');\nfresh();\nnewDoc('k1','notice');var N=WriterState.DOCS[0];" +
  "addItems(N,3);\nok('a new document is a draft',N.draft===true&&!eventsFor" +
  "('k1').length);\nissueDocument(N);\nok('issuing appends one event',eventsF" +
  "or('k1').length===1,eventsFor('k1')[0].type);\nok('the draft is gone',!Wr" +
  "iterState.DOCS.some(function(d){return d.draft;}));\nvar pub=docsFor('k1'" +
  ")[0];\nok('the published document replays',!!pub&&pub.items.length===3);\n" +
  "ok('  it is final and locked',pub.status==='Final'&&isLocked(pub));\nok('" +
  "  it carries who and when',!!pub.issuedAt&&!!pub.issuedBy);\nok('event id" +
  "s are unique and random',/^ev_/.test(eventsFor('k1')[0].id));\n\nH('SNAPSH" +
  "OTS ARE FROZEN');\nvar before=pub.items[0].text;\npub.items[0].text='TAMPE" +
  "RED';\nproject();\nok('editing the projection does not change the record'," +
  "docsFor('k1')[0].items[0].text===before,\n   docsFor('k1')[0].items[0].te" +
  "xt.slice(0,20));\n\nH('REINSPECTION RECORDED ON ITS OWN');\nfresh();\nnewDoc" +
  "('k1','notice');N=WriterState.DOCS[0];addItems(N,2);issueDocument(N);\npu" +
  "b=docsFor('k1')[0];\nstartReinspection('k1');reinsp(WriterState.state.rei" +
  "nspId).time='10:00';var r=WriterState.REINSP.filter(function(x){return x" +
  ".draft;})[0];\nok('worksheet starts as a draft',!!r&&r.draft===true);\npub" +
  ".items.forEach(function(it){r.results[it.id]={oc:'corrected',on:r.date,d" +
  "ue:'',note:'',cite:false};});\nrecordReinspection(r);\nok('full compliance" +
  " is recorded with no document',eventsFor('k1').length===2);\nok('  event " +
  "type',eventsFor('k1')[1].type==='reinspection.recorded');\nok('  it repla" +
  "ys',reinspFor('k1').length===1&&doneItems(reinspFor('k1')[0]).length===2" +
  ");\nok('  no new document was created',docsFor('k1').length===1);\n\nH('FOL" +
  "LOW-UP CHAIN');\nfresh();\nnewDoc('k1','notice');N=WriterState.DOCS[0];add" +
  "Items(N,3);issueDocument(N);\npub=docsFor('k1')[0];\nstartReinspection('k1" +
  "');reinsp(WriterState.state.reinspId).time='10:00';r=WriterState.REINSP." +
  "filter(function(x){return x.draft;})[0];\npub.items.forEach(function(it,i" +
  "){r.results[it.id]={oc:i?'none':'corrected',on:r.date,\n  due:i?futureDue" +
  "(iso(today),21):'',note:'',cite:false};});\ndocFromReinspection(r,'extens" +
  "ion');\nvar E=WriterState.DOCS.filter(function(d){return d.draft;})[0];\no" +
  "k('extension starts as a draft',!!E&&E.draft===true);\nok('  reinspection" +
  " not yet on the record',eventsFor('k1').length===1);\nissueDocument(E);\no" +
  "k('issuing writes both events',eventsFor('k1').length===3,eventsFor('k1'" +
  ").map(function(e){return e.type;}).join(', '));\nok('  reinspection recor" +
  "ded first',eventsFor('k1')[1].type==='reinspection.recorded');\nok('  ext" +
  "ension carries all 3 items',docsFor('k1')[0].items.length===3);\nok('  on" +
  "e struck through',docsFor('k1')[0].items.filter(function(i){return i.don" +
  "e;}).length===1);\n\nH('CORRECTION DRAFT CONTINUITY');\nvar ext=docsFor('k1" +
  "')[0],before=JSON.stringify(eventsFor('k1'));\nvar back=startCorrection(e" +
  "xt.id);\nok('correction starts from the entire issued document',!!back&&b" +
  "ack.items.length===ext.items.length);\nok('correction remembers the exact" +
  " version',back.correction.targetId===ext.id&&back.correction.baseEventId" +
  "===ext.eventId);\nok('starting a correction leaves the event log unchange" +
  "d',JSON.stringify(eventsFor('k1'))===before);\nok('starting a correction " +
  "records no additional visit',reinspFor('k1').filter(x=>!x.draft).length=" +
  "==1);\nok('item numbers and IDs are stable',JSON.stringify(back.items.map" +
  "(x=>[x.id,x.no]))===JSON.stringify(ext.items.map(x=>[x.id,x.no])));\nback" +
  ".items[1].text='Corrected order text.';back.correction.reason='Correct a" +
  " transcribed order on item two.';\nvar revised=makeCorrectionAttempt(back" +
  ");eventsFor('k1').push(revised);WriterState.DOCS=WriterState.DOCS.filter" +
  "(x=>x.id!==back.id);project();\nok('revision ends old version in the same" +
  " event',doc(ext.id).superseded.replacedBy===back.id&&sourceDocFor('k1')." +
  "id===back.id);\nok('the old snapshot remains unchanged',eventsFor('k1').f" +
  "ind(e=>e.id===ext.eventId).payload.snapshot.items[1].text!=='Corrected o" +
  "rder text.');\nok('correction does not duplicate the inspection',reinspFo" +
  "r('k1').filter(x=>!x.draft).length===1);\nok('an ancestor cannot be corre" +
  "cted again',startCorrection(ext.id)===null);\n\nH('CITATION CORRECTION PRE" +
  "SERVES IDENTITY');\nfresh();newDoc('k1','notice');N=WriterState.DOCS[0];a" +
  "ddItems(N,1);issueDocument(N);\npub=docsFor('k1')[0];startReinspection('k" +
  "1');reinsp(WriterState.state.reinspId).time='10:00';r=WriterState.REINSP" +
  ".find(x=>x.draft);\nr.results[pub.items[0].id]={oc:'none',on:r.date,due:f" +
  "utureDue(iso(today),21),note:'',cite:true};\ndocFromReinspection(r,'citat" +
  "ion');var C=WriterState.DOCS.find(x=>x.draft);issueDocument(C);\nvar pubC" +
  "=doc(C.id),oldNum=pubC.cits[pubC.items[0].id].num;\nvar rep2=startCorrect" +
  "ion(pubC.id);\nok('citation correction keeps the original citation number" +
  "',rep2.cits[rep2.items[0].id].num===oldNum);\nok('court instructions requ" +
  "ired before correction',correctionChecks(rep2).some(x=>!x.ok&&/court.*At" +
  "torney/i.test(x.t)));\nok('citation correction creates no visit',reinspFo" +
  "r('k1').filter(x=>!x.draft).length===1);\n\nH('FILE ROUND TRIP AND MERGE')" +
  ";\nvar f=caseFile('k1');\nok('current schema',f.schema===4);\nok('carries e" +
  "vents not state',Array.isArray(f.events)&&!f.documents);\nok('  event cou" +
  "nt',f.events.length===eventsFor('k1').length,f.events.length+' events');" +
  "\nvar json=JSON.stringify(f);\nvar beforeDocs=JSON.stringify(docsFor('k1')" +
  ".filter(function(d){return !d.draft;}));\nWriterState.EVENTS={};project()" +
  ";\nok('wiping events leaves only unissued drafts',docsFor('k1').filter(fu" +
  "nction(d){return !d.draft;}).length===0);\nloadCaseFile(json);\nok('reload" +
  " restores the history',JSON.stringify(docsFor('k1').filter(function(d){r" +
  "eturn !d.draft;}))===beforeDocs);\nloadCaseFile(json);loadCaseFile(json);" +
  "\nok('loading three times adds nothing',eventsFor('k1').length===f.events" +
  ".length,eventsFor('k1').length+' events');\n\nH('OFFLINE MERGE OF TWO DEVI" +
  "CES');\nfresh();\nnewDoc('k1','notice');N=WriterState.DOCS[0];addItems(N,2" +
  ");issueDocument(N);\nvar deviceA=JSON.stringify(caseFile('k1'));\n// devic" +
  "e B has the same notice, then records a reinspection A never saw\npub=doc" +
  "sFor('k1')[0];\nstartReinspection('k1');reinsp(WriterState.state.reinspId" +
  ").time='10:00';r=WriterState.REINSP.filter(function(x){return x.draft;})" +
  "[0];\npub.items.forEach(function(it){r.results[it.id]={oc:'corrected',on:" +
  "r.date,due:'',note:'',cite:false};});\nrecordReinspection(r);\nvar deviceB" +
  "=JSON.stringify(caseFile('k1'));\n// A reloads: should gain B's reinspect" +
  "ion without losing its notice\nWriterState.EVENTS={};project();loadCaseFi" +
  "le(deviceA);\nok('device A has the notice only',eventsFor('k1').length===" +
  "1);\nloadCaseFile(deviceB);\nok('merging B adds the reinspection',eventsFo" +
  "r('k1').length===2,\n   eventsFor('k1').map(function(e){return e.type;})." +
  "join(', '));\nok('  no duplicate notice',docsFor('k1').length===1);\nok(' " +
  " events in time order',eventsFor('k1').every(function(e,i,a){return i===" +
  "0||a[i-1].at<=e.at;}));\n\nH('MIGRATION FROM SCHEMA 1');\nvar v1={format:'m" +
  "adison-case-file',version:1,exported:nowISO(),exportedBy:'X',\n  'case':{" +
  "id:'kOld',number:'CB2025-100-00001',address:'99 OLD ST',parcel:'0000-000" +
  "-0000-0',\n    owner:'OLD, OWNER',ownerAddr:['99 OLD ST','MADISON, WI 537" +
  "03'],date:'2025-06-01',time:'09:00',\n    inspectorId:'i1',description:'X" +
  "'},\n  inspectors:[],\n  documents:[{id:'dOld',caseId:'kOld',type:'notice'" +
  ",created:'2025-06-01',status:'Final',\n    mailed:'2025-06-02',items:[{id" +
  ":'xOld',no:'1',group:'',sections:['27.05(2)(c)'],\n    title:'Old item',a" +
  "bate:false,due:'2025-06-23',text:'Old text.',prov:'notice'}],cc:'',cits:" +
  "{}}],\n  reinspections:[{id:'rOld',caseId:'kOld',sourceDocId:'dOld',date:" +
  "'2025-07-01',\n    inspectorId:'i1',results:{xOld:{oc:'corrected',on:'202" +
  "5-07-01',due:'',note:'',cite:false}},docId:null}]};\nWriterState.EVENTS={" +
  "};WriterState.CASES=WriterState.CASES.filter(function(c){return c.number" +
  "!=='CB2025-100-00001';});\nvar loaded=loadCaseFile(JSON.stringify(v1));\no" +
  "k('v1 file loads',!!loaded);\nok('  upgraded to events',eventsFor(loaded." +
  "id).length===2,\n   eventsFor(loaded.id).map(function(e){return e.type;})" +
  ".join(', '));\nok('  document replays',docsFor(loaded.id).length===1&&doc" +
  "sFor(loaded.id)[0].items[0].text==='Old text.');\nok('  reinspection repl" +
  "ays',reinspFor(loaded.id).length===1);\nok('  saves as current schema',ca" +
  "seFile(loaded.id).schema===4);\nok('rejects a future schema',(function(){" +
  "\n  var fut=JSON.parse(JSON.stringify(caseFile(loaded.id)));fut.schema=99" +
  ";\n  return loadCaseFile(JSON.stringify(fut))===null;})());\n\nH('STORAGE')" +
  ";\nok('mode reported',['folder','folder-not-linked','download'].indexOf(s" +
  "torageMode())>=0,storageMode());\nok('queue starts empty',WriterState.PEN" +
  "DING.length===0);\nqueuePending('a.json','{}');queuePending('a.json','{\"v" +
  "\":2}');\nok('queue keeps only the newest per file',WriterState.PENDING.le" +
  "ngth===1&&WriterState.PENDING[0].body==='{\"v\":2}');\nWriterState.PENDING." +
  "length=0;\n\nif(fails.length)process.exitCode=1;\nconsole.log('\\n'+(fails.l" +
  "ength?fails.length+' FAILURE(S): '+fails.join(' | '):'all event-log chec" +
  "ks passed'));\n";
eval(src + "\n;;\n" + T);
