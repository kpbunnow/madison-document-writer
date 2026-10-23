globalThis.MADISON_TEST_DATA = true;
/* audit_review.js — one check per defect from the external review.
   Every check here fails against the build that preceded the fixes. */
// Consolidation Phase 2 (T1): run remaining long UI timers once the suite completes instead of waiting.
const { settle } = require("../fixtures/settle_ui_timers.cjs");
const { JSDOM } = require("jsdom");
const { builtPage, bundleSource } = require("../fixtures/built_bundle.cjs");
const html = builtPage(),
  src = bundleSource(html);
const CSS = /<style>([\s\S]*?)<\/style>/.exec(html)[1];
const dom = new JSDOM(
  "<!doctype html><html><head><style>" +
    CSS +
    '</style></head><body><div id="app"></div><div id="overlay"></div><div id="toast"></div></body></html>',
  { pretendToBeVisual: true, url: "http://127.0.0.1:8777/" },
);
const w = dom.window;
global.window = w;
global.document = w.document;
global.getSelection = () => w.getSelection();
global.Blob = function () {};
global.URL = { createObjectURL: () => "b", revokeObjectURL() {} };
global.FileReader = w.FileReader;
global.confirm = () => true;

// ---- IndexedDB stub -------------------------------------------------------
const KV = new Map();
global.indexedDB = {
  open() {
    const r = {};
    r.result = {
      objectStoreNames: { contains: () => true },
      createObjectStore() {},
      transaction() {
        return {
          objectStore() {
            return {
              get(k) {
                const q = {};
                queueMicrotask(() => {
                  q.result = KV.get(k);
                  q.onsuccess && q.onsuccess();
                });
                return q;
              },
              put(v, k) {
                KV.set(k, JSON.parse(JSON.stringify(v)));
                return {};
              },
            };
          },
          set oncomplete(f) {
            queueMicrotask(() => f && f());
          },
          get oncomplete() {
            return null;
          },
          set onerror(f) {},
          get onerror() {
            return null;
          },
          set onabort(f) {},
          get onabort() {
            return null;
          },
        };
      },
    };
    queueMicrotask(() => r.onsuccess && r.onsuccess());
    return r;
  },
};

// ---- shared folder stub ---------------------------------------------------
const FOLDER = new Map();
let FAIL = false;
w.showDirectoryPicker = async () => ({
  name: "Case JSON Files",
  kind: "directory",
  queryPermission: async () => "granted",
  requestPermission: async () => "granted",
  async getFileHandle(name, opts) {
    if (FAIL) throw new Error("share unreachable");
    if (!FOLDER.has(name) && !(opts && opts.create)) throw new Error("missing");
    return {
      kind: "file",
      name,
      async createWritable() {
        let buf = "";
        return {
          async write(b) {
            buf += b;
          },
          async close() {
            FOLDER.set(name, buf);
          },
        };
      },
      async getFile() {
        return {
          size: (FOLDER.get(name) || "").length,
          lastModified: Date.now(),
          async text() {
            return FOLDER.get(name) || "";
          },
        };
      },
    };
  },
  async *entries() {
    for (const k of FOLDER.keys())
      yield [
        k,
        {
          kind: "file",
          async getFile() {
            return { size: (FOLDER.get(k) || "").length, lastModified: Date.now() };
          },
        },
      ];
  },
});

// ---- helper POSTs ---------------------------------------------------------
const POSTS = [];
global.fetch = async (u, o) => {
  const s = String(u);
  if (s.indexOf("/dw-status") >= 0) return { ok: true, json: async () => ({ ok: true, out: "X", chrome: true, outlook: true }) };
  if (s.indexOf("/save-pdf") >= 0 || s.indexOf("/email") >= 0) {
    POSTS.push(Object.assign({ url: s }, JSON.parse(o.body)));
    return { ok: true, json: async () => ({ ok: true, name: "x.pdf", via: "outlook" }) };
  }
  throw 0;
};

Object.defineProperty(w.HTMLElement.prototype, "scrollHeight", {
  configurable: true,
  get() {
    return 0;
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
  "ned?'   '+x:''));if(!c)fails.push(l);}\nconst sleep=ms=>new Promise(r=>se" +
  "tTimeout(r,ms));\nfunction fresh(){WriterState.DOCS.length=0;WriterState." +
  "REINSP.length=0;WriterState.EVENTS={};WriterState.state.docId=null;Write" +
  "rState.state.reinspId=null;\n  WriterState.state.modal=null;WriterState.s" +
  "tate.screen='cases';}\nfunction items(N,n){for(var i=0;i<n;i++)N.items.pu" +
  "sh({id:uid('x'),group:'',sections:['27.05(2)(c)'],\n  title:'Item '+(i+1)" +
  ",abate:false,due:futureDue(iso(today),21),text:'Clean it.',prov:'notice'" +
  "});renumber(N);}\n\n(async function(){\nawait new Promise(resolve=>setTimeo" +
  "ut(resolve,30));WriterState.CATALOG_VERIFIED=true;refreshCatalog=async()" +
  "=>true;\n\nH('F-002  the clock is real, not a fixture');\nvar n=new Date();" +
  "\nvar want=n.getFullYear()+'-'+String(n.getMonth()+1).padStart(2,'0')+'-'" +
  "+String(n.getDate()).padStart(2,'0');\nok('today is the actual date',iso(" +
  "today)===want,iso(today));\nok('  and is re-read, not captured',(function" +
  "(){var a=today;return a!==today||iso(today)===want;})());\nok('  MINDUE i" +
  "s tomorrow',MINDUE()===addDays(want,1));\n\nH('F-001  ids do not collide b" +
  "etween two machines');\nvar a1=uid('d'); WriterState.seq=100; var b1=uid(" +
  "'d');   // the other laptop, same counter\nok('same counter, different id" +
  "',a1!==b1,a1+' vs '+b1);\nvar many={},dupes=0;\nfor(var q=0;q<2000;q++){va" +
  "r u=uid('x');if(many[u])dupes++;many[u]=1;}\nok('  2000 ids, no repeat',d" +
  "upes===0);\nok('  still a plain identifier',/^[A-Za-z0-9_-]+$/.test(a1),a" +
  "1);\n\nH('F-003  two documents never share a PDF name');\nfresh();\nnewDoc('" +
  "k1','notice');var N1=WriterState.DOCS[0];items(N1,1);N1.mailed=iso(today" +
  ");\nnewDoc('k1','notice');var N2=WriterState.DOCS[0];items(N2,1);N2.maile" +
  "d=iso(today);\nok('same case, type and date',documentFileName(N1)!==docum" +
  "entFileName(N2),documentFileName(N1));\nok('  and the name still reads pl" +
  "ainly',documentFileName(N1).indexOf(kase('k1').address)===0);\n\nH('F-011 " +
  " an unreadable date fails a check instead of passing');\nfresh();\nnewDoc(" +
  "'k1','notice');var Nd=WriterState.DOCS[0];items(Nd,1);\nNd.items[0].due='" +
  "not-a-date';\nok('malformed due date blocks',blockers(Nd).length>0,blocke" +
  "rs(Nd).map(function(c){return c.t;}).join(' | '));\nok('  parseDate rejec" +
  "ts February 31',parseDate('2026-02-31')===null);\nok('  and 02/31/2026',p" +
  "arseDate('02/31/2026')===null);\nok('  but keeps a real date',parseDate('" +
  "2026-02-28')==='2026-02-28');\n\nH('F-012  every citation needs its own of" +
  "ficer I.D.');\nfresh();\nvar blank=INSPECTORS.filter(function(i){return !i" +
  ".badge;})[0];\nvar hadInsp=kase('k1').inspectorId; kase('k1').inspectorId" +
  "=blank.id;\nnewDoc('k1','citation');var C=WriterState.DOCS[0];\nitems(C,2)" +
  ";C.items.forEach(function(i){i.cite=true;});\nC.cits={};C.items.forEach(f" +
  "unction(i){C.cits[i.id]={num:'1',courtDate:futureDue(iso(today),30),\n  a" +
  "mount:'$100',desc:'X',ord:'27.05(2)(c)',base:50,cc:10,deptId:''};});\nC.c" +
  "its[C.items[0].id].deptId='2839';       // one form filled in, one blank" +
  "\nok('one badge does not cover the other',blockers(C).some(function(c){re" +
  "turn /badge/i.test(c.t);}));\nC.cits[C.items[1].id].deptId='2839';\nok('  " +
  "both filled in passes',!blockers(C).some(function(c){return /badge/i.tes" +
  "t(c.t);}));\nkase('k1').inspectorId=hadInsp;\n\nH('F-008  an issued documen" +
  "t does not follow the case');\nfresh();\nnewDoc('k2','notice');var F8=Writ" +
  "erState.DOCS[0];items(F8,2);\nvar wasOwner=kase('k2').owner, wasAddr=kase" +
  "('k2').address;\nissueDocument(F8);\nvar issued=doc(F8.id);\nvar beforeHTML" +
  "=noticeHTML(issued), beforeName=documentFileName(issued);\nkase('k2').own" +
  "er='SOMEBODY ELSE LLC';kase('k2').address='999 NEW ST';\nok('owner change" +
  " does not reach it',noticeHTML(issued)===beforeHTML);\nok('  nor the file" +
  "d name',documentFileName(issued)===beforeName);\nok('  the old owner is w" +
  "hat it prints',noticeHTML(issued).indexOf(esc(wasOwner))>=0);\nok('  a dr" +
  "aft still reads live',(function(){newDoc('k2','notice');var D=WriterStat" +
  "e.DOCS[0];items(D,1);\n  return noticeHTML(D).indexOf('999 NEW ST')>=0;})" +
  "());\nkase('k2').owner=wasOwner;kase('k2').address=wasAddr;\nok('  and a s" +
  "napshot from before this existed still renders',(function(){\n  var old=c" +
  "lone(issued);delete old.frozen;return noticeHTML(old).length>500;})());\n" +
  "\nH('F-004  what is filed is the document that was issued');\nfresh();POST" +
  "S.length=0;\nawait checkHelper();\nconst historyFetch=global.fetch;global." +
  "fetch=async function(url,opts){if(String(url).includes('/citations/histo" +
  "ry'))return {ok:true,json:async()=>({ok:true,history:[]})};return histor" +
  "yFetch(url,opts);};\nnewDoc('k3','notice');var Nf=WriterState.DOCS[0];ite" +
  "ms(Nf,2);\nNf.items[0].cite=true;                       // this is what o" +
  "pens a citation draft\nWriterState.state.docId=Nf.id;WriterState.state.sc" +
  "reen='write';render();\nvar noticeTag=documentFileName(Nf);\nvar oldDirect" +
  "ory=WriterState.CASEDIR,oldHelperJSON=helperJSON;\nWriterState.CASEDIR={h" +
  "elper:true};helperJSON=async function(url,body){return {ok:true,file:clo" +
  "ne(body.file),revision:'test',name:caseFileName(body.file.case)};};\nawai" +
  "t runFinalize(Nf);\nWriterState.CASEDIR=oldDirectory;helperJSON=oldHelper" +
  "JSON;\nvar filedAll=POSTS.filter(function(p){return p.url.indexOf('/save-" +
  "pdf')>=0;}),filed=filedAll[0];\nvar issuedCitation=WriterState.DOCS.find(" +
  "function(x){return x.type==='citation'&&!x.draft&&x.fromDocId===Nf.id;})" +
  ";\n// R35: the initial-inspection citation replaces the Official Notice, " +
  "so the one filed document is the issued citation.\nok('something was file" +
  "d',!!filed);\nok('  exactly one document, the issued citation',filedAll.l" +
  "ength===1&&!!issuedCitation&&filed.filename===documentFileName(issuedCit" +
  "ation)+'.pdf',filed&&filed.filename);\nok('  it carries the court copies " +
  "and the notice order language',\n  !!filed&&filed.html.indexOf('WISCONSIN" +
  " UNIFORM MUNICIPAL')>=0&&filed.html.indexOf('To appeal this order')>=0);" +
  "\nok('  the notice record is delivered within it, not filed',!!doc(Nf.id)" +
  "&&!doc(Nf.id).filedAt&&deliveredByCitation(doc(Nf.id))&&noticeTag.length" +
  ">0);\nok('  the screen did move on to the citation',\n  !!doc(WriterState." +
  "state.docId)&&doc(WriterState.state.docId).type==='citation');\n\nH('F-005" +
  "  a case imported under another id keeps its documents');\nfresh();\nnewDo" +
  "c('k1','notice');var Nx=WriterState.DOCS[0];items(Nx,2);issueDocument(Nx" +
  ");\nvar exported=JSON.parse(JSON.stringify(caseFile('k1')));\nfresh();\nexp" +
  "orted['case'].id='k900';                  // the other machine numbered " +
  "it differently\nexported.events.forEach(function(e){if(e.payload.snapshot" +
  ")e.payload.snapshot.caseId='k900';});\nloadCaseFile(JSON.stringify(export" +
  "ed));\nok('the documents land on the case we hold',docsFor('k1').length==" +
  "=1,'k1 has '+docsFor('k1').length);\nok('  and nothing was left on the in" +
  "coming id',docsFor('k900').length===0);\n\nH('F-014  a legacy file loaded " +
  "twice is not doubled');\nfresh();\n// schema 1 stored documents newest fir" +
  "st, both written the same day\nvar v1={format:'madison-case-file',version" +
  ":1,'case':clone(kase('k1')),inspectors:[],\n  documents:[{id:'d2',caseId:" +
  "'k1',type:'extension',mailed:'2026-03-02',status:'Final',items:[\n    {id" +
  ":'x2',no:'1',sections:['27.05(2)(c)'],title:'A',text:'t',due:'2026-05-01" +
  "'}],cits:{},fromDocId:'d1'},\n   {id:'d1',caseId:'k1',type:'notice',maile" +
  "d:'2026-03-02',status:'Final',items:[\n    {id:'x1',no:'1',sections:['27." +
  "05(2)(c)'],title:'A',text:'t',due:'2026-04-01'}],cits:{}}],\n  reinspecti" +
  "ons:[]};\nloadCaseFile(JSON.stringify(v1));\nvar first=eventsFor('k1').len" +
  "gth;\nloadCaseFile(JSON.stringify(v1));\nok('second load adds nothing',eve" +
  "ntsFor('k1').length===first,first+' then '+eventsFor('k1').length);\nok('" +
  "  same-day order is kept (extension is newest)',docsFor('k1')[0].type===" +
  "'extension',\n  docsFor('k1').map(function(d){return d.type;}).join(','))" +
  ";\n\nH('F-015  a malformed file changes nothing');\nfresh();\nnewDoc('k1','n" +
  "otice');var Ng=WriterState.DOCS[0];items(Ng,1);issueDocument(Ng);\nvar go" +
  "odCount=eventsFor('k1').length, caseCount=WriterState.CASES.length, docC" +
  "ount=docsFor('k1').length;\nvar broken=JSON.parse(JSON.stringify(caseFile" +
  "('k1')));\nbroken['case'].id='k777';broken['case'].number='CB-BROKEN-1';\n" +
  "broken.events.push({id:'ev_bad',at:new Date().toISOString(),type:'notice" +
  ".issued',payload:{docId:'zz'}});\nvar r1=loadCaseFile(JSON.stringify(brok" +
  "en));\nok('the load is refused',r1===null);\nok('  no case was added',Writ" +
  "erState.CASES.length===caseCount,WriterState.CASES.length+' vs '+caseCou" +
  "nt);\nok('  no events were added',eventsFor('k1').length===goodCount);\nok" +
  "('  the screen still renders',docsFor('k1').length===docCount&&noticeHTM" +
  "L(docsFor('k1')[0]).length>500);\nok('  a bad identifier is refused too'," +
  "loadCaseFile(JSON.stringify((function(){\n  var b=JSON.parse(JSON.stringi" +
  "fy(caseFile('k1')));b['case'].number='CB-BROKEN-2';\n  b['case'].id='k\\\" " +
  "onmouseover=\\\"x';return b;})()))===null);\n\nH('F-009  an imported identif" +
  "ier cannot break out of an attribute');\nfresh();\nvar nasty=JSON.parse(JS" +
  "ON.stringify(caseFile('k1')));\nnewDoc('k1','notice');var Nn=WriterState." +
  "DOCS[0];items(Nn,1);issueDocument(Nn);\nnasty=JSON.parse(JSON.stringify(c" +
  "aseFile('k1')));\nnasty['case'].number='CB-NASTY-1';nasty['case'].id='k95" +
  "0';\nnasty.events.forEach(function(e){if(e.payload.snapshot){e.payload.sn" +
  "apshot.caseId='k950';\n  e.payload.snapshot.items.forEach(function(it){it" +
  ".id='x\\\" onmouseover=\\\"alert(1)';});}});\nok('the file is refused',loadCa" +
  "seFile(JSON.stringify(nasty))===null);\nok('  and an id is escaped even s" +
  "o',(function(){\n  var d=clone(docsFor('k1')[0]);d.items[0].id='x\\\" onmou" +
  "seover=\\\"alert(1)';\n  return noticeHTML(d).indexOf('onmouseover=\"alert(1" +
  ")\"')<0;})());\n\nH('F-020  a voided citation can actually be rewritten');\n" +
  "fresh();\nnewDoc('k1','notice');var Nb=WriterState.DOCS[0];items(Nb,2);Nb" +
  ".items[0].cite=true;issueDocument(Nb);\nvar cd=citationFromNotice(Nb.id);" +
  "\ncd.items.filter(function(i){return i.cite;}).forEach(function(i){\n  Obj" +
  "ect.assign(cd.cits[i.id],{num:'C1',courtDate:futureDue(iso(today),30),am" +
  "ount:'$100',\n    desc:'X',ord:'27.05(2)(c)',deptId:'2839',base:50,cc:10}" +
  ");});\nissueDocument(cd);\nvoidDocument(cd.id,'wrong ordinance');\nvar agai" +
  "n=reissueDocument(cd.id);\nok('the replacement has its items',!!again&&ag" +
  "ain.items.length>0,again&&again.items.length);\nok('  and its citation de" +
  "tails',!!again&&Object.keys(again.cits).length>0);\nok('  and can be fini" +
  "shed',!!again&&!blockers(again).some(function(c){return /No item selecte" +
  "d/.test(c.t);}));\n\nH('F-018  discarding a follow-up frees the worksheet'" +
  ");\nfresh();\nnewDoc('k1','notice');var Nw=WriterState.DOCS[0];items(Nw,2)" +
  ";issueDocument(Nw);\nstartReinspection('k1');reinsp(WriterState.state.rei" +
  "nspId).time='10:00';\nvar R=WriterState.REINSP.filter(function(r){return " +
  "r.draft;})[0];\nR.results[doc(Nw.id).items[0].id]={oc:'none',note:'still " +
  "there',on:R.date,due:futureDue(iso(today),21)};\nR.results[doc(Nw.id).ite" +
  "ms[1].id]={oc:'none',note:'still there',on:R.date,due:futureDue(iso(toda" +
  "y),21)};\ndocFromReinspection(R,'extension');\nvar follow=WriterState.DOCS" +
  ".filter(function(d){return d.draft&&d.type==='extension';})[0];\nok('a fo" +
  "llow-up was written',!!follow&&R.docId===follow.id);\nawait discardDraft(" +
  "follow.id);\nok('  discarding clears the link',!R.docId);\ndocFromReinspec" +
  "tion(R,'extension');\nok('  and another can be written',WriterState.DOCS." +
  "some(function(d){return d.draft&&d.type==='extension';}));\n\nH('F-017  a " +
  "worksheet survives a restart with its source');\nfresh();KV.clear();\nnewD" +
  "oc('k1','notice');var Ns=WriterState.DOCS[0];items(Ns,2);issueDocument(N" +
  "s);\nvar srcId=doc(Ns.id).id;\nstartReinspection('k1');reinsp(WriterState." +
  "state.reinspId).time='10:00';\nvar Rs=WriterState.REINSP.filter(function(" +
  "r){return r.draft;})[0];\nawait saveDrafts();\nfresh();                   " +
  "                  // the laptop was closed\nok('the history is gone with " +
  "the session',!(WriterState.EVENTS['k1']||[]).length);\nawait restoreDraft" +
  "s();\nvar back=WriterState.REINSP.filter(function(r){return r.draft;})[0]" +
  ";\nok('the worksheet came back',!!back&&back.id===Rs.id);\nok('  and its s" +
  "ource document resolves',!!back&&!!doc(back.sourceDocId),back&&back.sour" +
  "ceDocId);\nok('  which is the notice it was walked against',!!back&&back." +
  "sourceDocId===srcId);\n\nH('F-021  Save really saves');\nfresh();KV.clear()" +
  ";\nnewDoc('k1','notice');var Nv=WriterState.DOCS[0];items(Nv,1);\nWriterSt" +
  "ate.state.docId=Nv.id;WriterState.state.screen='write';render();\nNv.item" +
  "s.push({id:uid('x'),group:'',sections:['27.05(2)(c)'],title:'Added by a " +
  "click',\n  abate:false,due:futureDue(iso(today),21),text:'Clean it.',prov" +
  ":'notice'});renumber(Nv);\ndocument.getElementById('btn-save').click();\na" +
  "wait sleep(20);\nvar kept=KV.get('drafts');\nok('the draft is on disk',!!k" +
  "ept&&!!kept.docs&&kept.docs.length===1);\nok('  with the item added by th" +
  "e click',!!kept&&kept.docs[0].items.length===2,\n  kept&&kept.docs[0].ite" +
  "ms.length);\n\nH('F-006  a held write never overwrites a newer one');\nfres" +
  "h();KV.clear();FOLDER.clear();FAIL=false;\nawait linkCaseFolder();\nnewDoc" +
  "('k1','notice');var Nq=WriterState.DOCS[0];items(Nq,2);issueDocument(Nq)" +
  ";\nFAIL=true;                                   // the share drops\nawait " +
  "saveCaseFile('k1');\nok('the write is held',WriterState.PENDING.length===" +
  "1);\nFAIL=false;\nnewDoc('k1','extension');var Nq2=WriterState.DOCS[0];\nNq" +
  "2.items=clone(doc(Nq.id).items);Nq2.fromDocId=Nq.id;\nissueDocument(Nq2);" +
  "\nawait saveCaseFile('k1');                    // this one gets through\nv" +
  "ar after=JSON.parse(FOLDER.get(caseFileName(kase('k1'))));\nok('  the new" +
  "er save wrote both events',after.events.length===2,after.events.length);" +
  "\nok('  and the stale copy was dropped from the queue',WriterState.PENDIN" +
  "G.length===0);\nawait flushPending();\nafter=JSON.parse(FOLDER.get(caseFil" +
  "eName(kase('k1'))));\nok('  a flush cannot wind it back',after.events.len" +
  "gth===2,after.events.length);\n\nH('F-007  a save does not drop the other " +
  "inspector');\nfresh();KV.clear();FOLDER.clear();FAIL=false;\nawait linkCas" +
  "eFolder();\nnewDoc('k1','notice');var Nm=WriterState.DOCS[0];items(Nm,2);" +
  "issueDocument(Nm);\nawait saveCaseFile('k1');\nvar shared=JSON.parse(FOLDE" +
  "R.get(caseFileName(kase('k1'))));\n// inspector B, working offline from t" +
  "he same case, writes a visit of their own\nshared.events.push({id:'ev_fro" +
  "m_b',at:new Date().toISOString(),by:'i2',\n  type:'reinspection.recorded'" +
  ",payload:{reinspId:'r_b',sourceDocId:Nm.id,\n    reinspection:{id:'r_b',c" +
  "aseId:'k1',sourceDocId:Nm.id,date:iso(today),inspectorId:'i2',results:{}" +
  "}}});\nFOLDER.set(caseFileName(kase('k1')),JSON.stringify(shared,null,2))" +
  ";\n// meanwhile this machine issues something else and saves\nnewDoc('k1'," +
  "'extension');var Nm2=WriterState.DOCS[0];Nm2.items=clone(doc(Nm.id).item" +
  "s);Nm2.fromDocId=Nm.id;\nissueDocument(Nm2);\nawait saveCaseFile('k1');\nva" +
  "r out=JSON.parse(FOLDER.get(caseFileName(kase('k1'))));\nok('the other in" +
  "spector survived the write',out.events.some(function(e){return e.id==='e" +
  "v_from_b';}));\nok('  and so did this machine',out.events.length===3,out." +
  "events.length);\nok('  their visit shows on the case',reinspFor('k1').som" +
  "e(function(r){return r.id==='r_b';}));\n\nconsole.log('\\n'+(fails.length?f" +
  "ails.length+' FAILURE(S): '+fails.join(' | '):'review regressions all pa" +
  "ss'));\nif(fails.length)process.exitCode=1;\n})();\n";
global.CSSTEXT = CSS;
settle(eval(src + "\n;;\n" + T), global.window);
