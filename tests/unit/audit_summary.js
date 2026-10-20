globalThis.MADISON_TEST_DATA = true;
// Reporting, writer side: the library key on picked items, the parcel rule on
// an Official Notice, the pure replay, summarize() over a whole case life,
// summary writes beside the case file, and the index rebuild.
const fs = require("fs");
const { JSDOM } = require("jsdom");
const html = fs.readFileSync(
  require("path").join(
    process.env.DW_OUTPUT_DIR || require("path").join(require("path").resolve(__dirname, "../.."), "build/dist"),
    "madison-document-writer.html",
  ),
  "utf8",
);
const src = Buffer.from(/var B="([A-Za-z0-9+\/=]+)"/.exec(html)[1], "base64").toString("utf8");
const CSS = /<style>([\s\S]*?)<\/style>/.exec(html)[1];
const dom = new JSDOM(
  "<!doctype html><html><head><style>" +
    CSS +
    "</style></head>" +
    '<body><div id="app"></div><div id="overlay"></div><div id="toast"></div></body></html>',
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
global.indexedDB = undefined;
global.fetch = async () => {
  throw 0;
};
Object.defineProperty(w.HTMLElement.prototype, "scrollHeight", {
  configurable: true,
  get() {
    if (!this.classList || !this.classList.contains("sheet")) return 0;
    let h = 105;
    Array.prototype.forEach.call(this.children, (c) => {
      if (c.classList && (c.classList.contains("no-print") || c.classList.contains("addrow"))) return;
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

// A folder that holds files and subfolders, like the share. subdirs:false
// models a handle that cannot open a subfolder.
function mkDir(name, opts) {
  const files = new Map(),
    dirs = new Map();
  const h = {
    name: name,
    kind: "directory",
    files: files,
    dirs: dirs,
    queryPermission: async () => "granted",
    requestPermission: async () => "granted",
    async getFileHandle(n, o) {
      if (!files.has(n) && !(o && o.create)) {
        const e = new Error("not found");
        e.name = "NotFoundError";
        throw e;
      }
      if (!files.has(n)) files.set(n, "");
      return {
        kind: "file",
        name: n,
        async getFile() {
          const b = files.get(n);
          return { size: b.length, lastModified: Date.now(), text: async () => b };
        },
        async createWritable() {
          let b = "";
          return {
            async write(x) {
              b += x;
            },
            async close() {
              files.set(n, b);
            },
          };
        },
      };
    },
    async *entries() {
      for (const n of files.keys()) yield [n, await h.getFileHandle(n)];
      for (const [n, d] of dirs) yield [n, d];
    },
  };
  if (!opts || opts.subdirs !== false)
    h.getDirectoryHandle = async (n, o) => {
      if (!dirs.has(n)) {
        if (!(o && o.create)) throw new Error("no dir");
        dirs.set(n, mkDir(n));
      }
      return dirs.get(n);
    };
  return h;
}
let PICK = null;
w.showDirectoryPicker = async () => PICK;
global.mkDir = mkDir;
global.setPick = (d) => {
  PICK = d;
};

const T =
  "\n// Schema 4 export fixture; R31 tests cover schema 5 helper-only writes" +
  ".\nconst legacyCaseFile=caseFile;caseFile=(cid)=>({...legacyCaseFile(cid)" +
  ",schema:4});\n\nvar fails=[];\nfunction H(t){console.log('\\n=== '+t+' ===')" +
  ";}\nfunction ok(l,c,x){console.log('  '+(c?'ok   ':'FAIL ')+l+(x!==undefi" +
  "ned?'   '+x:''));if(!c)fails.push(l);}\nfunction fresh(){WriterState.DOCS" +
  ".length=0;WriterState.REINSP.length=0;WriterState.EVENTS={};WriterState." +
  "state.docId=null;WriterState.state.reinspId=null;WriterState.state.modal" +
  "=null;}\nfunction items(N,n){for(var i=0;i<n;i++)N.items.push({id:uid('x'" +
  "),group:'',\n  sections:['27.05(2)(c)'],title:'Item '+(i+1),abate:false,\n" +
  "  due:futureDue(iso(today),21),text:'Clean it.',prov:'notice'});renumber" +
  "(N);}\nfunction click(el){el.dispatchEvent(new window.MouseEvent('click'," +
  "{bubbles:true}));}\nfunction visit(cid,fn){startReinspection(cid);reinsp(" +
  "WriterState.state.reinspId).time='10:00';var r=WriterState.REINSP.filter" +
  "(function(x){return x.draft&&x.caseId===cid;})[0];\n  var src=doc(r.sourc" +
  "eDocId);src.items.forEach(function(it,i){if(it.done)return;r.results[it." +
  "id]=fn(it,i,r);});return r;}\nfunction issueDraft(cid){var d=WriterState." +
  "DOCS.filter(function(x){return x.draft&&x.caseId===cid;})[0];if(d&&d.typ" +
  "e==='citation'){d.items.filter(function(i){return i.cite;}).forEach(func" +
  "tion(i){citAmount(d,i);});}\n  return issueDocument(d)?d.id:null;}\nvar su" +
  "m=function(cid){return summarize(caseFile(cid));};\n\n(async function(){\na" +
  "wait new Promise(resolve=>setTimeout(resolve,30));WriterState.CATALOG_VE" +
  "RIFIED=true;refreshCatalog=async()=>true;\nH('Phase 0: a picked item carr" +
  "ies its library key');\nfresh();\nnewDoc('k2','notice');var N=WriterState." +
  "DOCS.find(function(d){return d.draft&&d.caseId==='k2';});\nWriterState.st" +
  "ate.docId=N.id;WriterState.state.screen='write';WriterState.state.picker" +
  "=true;\nvar b=document.createElement('button');b.setAttribute('data-pick'" +
  ",'0:0:105');document.body.appendChild(b);click(b);\nawait Promise.resolve" +
  "();\nvar it=N.items[N.items.length-1];\nok('the item came from the picker'" +
  ",!!it&&it.title===LIBRARY[0].groups[0].items.find(function(x){return x.o" +
  "===105;}).t);\nok('lib key recorded',!!it&&!!it.lib&&it.lib.c===LIBRARY[0" +
  "].code&&it.lib.g===LIBRARY[0].groups[0].code&&it.lib.o===105,JSON.string" +
  "ify(it&&it.lib));\nit.title='Edited wording entirely';\nok('the type survi" +
  "ves a wording edit',violationType(it).how==='library'&&violationType(it)" +
  ".key===LIBRARY[0].code+'/'+LIBRARY[0].groups[0].code+'/105');\n\nH('Violat" +
  "ion type for items without a key');\nvar L0=LIBRARY[0].groups[0].items[0]" +
  ";\nvar m=violationType({title:L0.t,sections:L0.s.slice()});\nok('exact tit" +
  "le and sections match one entry',m.how==='matched'&&m.key===LIBRARY[0].c" +
  "ode+'/'+LIBRARY[0].groups[0].code+'/'+L0.o,m.how);\nok('the label names c" +
  "hecklist, group and item',m.label===LIBRARY[0].name+' \\u203a '+LIBRARY[0" +
  "].groups[0].name+' \\u203a '+L0.t);\nvar byKey={},dup=null;LIBRARY.forEach" +
  "(function(cl){cl.groups.forEach(function(g){g.items.forEach(function(x){" +
  "\n  var kk=x.t.trim()+'#'+x.s.join('|');if(byKey[kk]&&!dup)dup=x;byKey[kk" +
  "]=1;});});});\nif(dup)ok('an ambiguous match falls back to the section',v" +
  "iolationType({title:dup.t,sections:dup.s.slice()}).how==='section');\nels" +
  "e console.log('  (no duplicate title+sections in the library; ambiguity " +
  "branch not reachable with real data)');\nvar u=violationType({title:'Some" +
  "thing custom',sections:['27.04(2)']});\nok('no match falls back to the fi" +
  "rst section',u.how==='section'&&u.key==='unclassified/27.04(2)'&&u.label" +
  "==='Unclassified: 27.04(2)');\nok('no section at all is labelled so',viol" +
  "ationType({title:'x',sections:[]}).label==='Unclassified: no ordinance')" +
  ";\nok('a stale key that no longer resolves falls through',violationType({" +
  "title:'x',sections:['1'],lib:{c:'NOPE',g:'X',o:1}}).how==='section');\n\nH" +
  "('Phase 0: a parcel is required to issue an Official Notice');\nfresh();\n" +
  "var k3=kase('k3');var keep=k3.parcel;\nnewDoc('k3','notice');var D=Writer" +
  "State.DOCS.find(function(d){return d.draft&&d.caseId==='k3';});items(D,2" +
  ");\nok('with a parcel nothing blocks',blockers(D).length===0,JSON.stringi" +
  "fy(blockers(D).map(function(c){return c.t;})));\nk3.parcel='';\nok('no par" +
  "cel blocks the notice',blockers(D).some(function(c){return /No parcel nu" +
  "mber/.test(c.t);}));\nk3.parcel='0709-133-051';\nok('an 11-digit parcel bl" +
  "ocks it',blockers(D).some(function(c){return /not 12 digits/.test(c.t);}" +
  "));\nk3.parcel='';\nWriterState.state.docId=D.id;WriterState.state.screen=" +
  "'write';WriterState.state.modal='final';render();\nvar fin=document.getEl" +
  "ementById('fin-go');\nok('the finalize dialog is showing',!!fin);\nif(fin)" +
  "click(fin);\nok('the handler refused to issue',!docsFor('k3').some(functi" +
  "on(d){return !d.draft;}));\nvar parcelDir=WriterState.CASEDIR,parcelHelpe" +
  "r=helperJSON,parcelIDB=idbSet;\nWriterState.CASEDIR={helper:true};idbSet=" +
  "async function(){return true;};helperJSON=async function(url,body){retur" +
  "n {ok:true,file:clone(body.file),revision:'test',name:caseFileName(body." +
  "file.case)};};\nk3.parcel=keep;WriterState.state.modal='final';render();f" +
  "in=document.getElementById('fin-go');if(fin)click(fin);\nawait new Promis" +
  "e(function(r){setTimeout(r,30);});\nok('with the parcel restored it issue" +
  "s',docsFor('k3').some(function(d){return !d.draft&&d.type==='notice';}))" +
  ";\nWriterState.CASEDIR=parcelDir;helperJSON=parcelHelper;idbSet=parcelIDB" +
  ";\nok('follow-ups are not re-checked for the parcel',(function(){var x={t" +
  "ype:'extension',caseId:'k3',items:[]};return !checks(x).some(function(c)" +
  "{return /parcel/i.test(c.t);});})());\nok('normParcel',normParcel('0709-1" +
  "33-0511-4')==='070913305114'&&normParcel('070913305114')==='070913305114" +
  "'&&normParcel('0709-133-0511')===''&&normParcel(null)===''&&normParcel('" +
  "07091330511A')==='');\n\nH('Replay is pure');\nok('replay(cid) is replayEve" +
  "nts over the log',JSON.stringify(replay('k3'))===JSON.stringify(replayEv" +
  "ents(eventsFor('k3'))));\nvar before=JSON.stringify([WriterState.EVENTS,W" +
  "riterState.CASES,WriterState.DOCS.map(function(d){return d.id;}),WriterS" +
  "tate.REINSP.map(function(r){return r.id;})]);\nvar sx=sum('k3');\nok('summ" +
  "arize changed nothing',before===JSON.stringify([WriterState.EVENTS,Write" +
  "rState.CASES,WriterState.DOCS.map(function(d){return d.id;}),WriterState" +
  ".REINSP.map(function(r){return r.id;})]));\n\nH('A whole case life, summar" +
  "ized');\nObject.defineProperty(globalThis,'today',{configurable:true,get(" +
  "){return new Date('2027-02-01T12:00:00');}});\nfresh();\nkase('k1').date='" +
  "2026-08-26';\nnewDoc('k1','notice');N=WriterState.DOCS[0];items(N,3);N.ma" +
  "iled='2026-08-28';issueDraft('k1');\nvar s=sum('k1');\nok('status Notice'," +
  "s['case'].status==='Notice',s['case'].status);\nok('opened is the initial" +
  " inspection date',s['case'].opened==='2026-08-26');\nok('notice issued da" +
  "te is the mailed date',s['case'].noticeIssued==='2026-08-28',s['case'].n" +
  "oticeIssued);\nok('three open violations',s.violations.length===3&&s.viol" +
  "ations.every(function(v){return !v.done;}));\nok('parcel key',s['case'].p" +
  "arcelKey==='070822219103');\nok('inspector named',!!s['case'].inspector,s" +
  "['case'].inspector);\nok('summary header',s.format==='madison-case-summar" +
  "y'&&s.summaryVersion===SUMMARY_VERSION&&s.schema===4&&s.eventCount===eve" +
  "ntsFor('k1').length);\n\nvar r1=visit('k1',function(it,i,r){r.date='2026-0" +
  "9-20';return i===0?{oc:'corrected',on:'2026-09-20',due:'',note:'',cite:f" +
  "alse}\n  :{oc:'none',on:'',due:futureDue(iso(today),21),note:'',cite:fals" +
  "e};});\ndocFromReinspection(r1,'extension');issueDraft('k1');\ns=sum('k1')" +
  ";\nok('status Extension',s['case'].status==='Extension',s['case'].status)" +
  ";\nok('item 1 corrected on the visit date',s.violations[0].done&&s.violat" +
  "ions[0].doneOn==='2026-09-20',JSON.stringify(s.violations[0]));\nok('item" +
  " 2 still open, one visit',!s.violations[1].done&&s.violations[1].visits=" +
  "==1&&s.violations[1].lastOutcome==='none');\nok('one visit recorded',s.vi" +
  "sits.length===1&&s.visits[0].results.length===3,JSON.stringify(s.visits)" +
  ");\n\nvar r2=visit('k1',function(it,i,r){r.date='2026-10-15';r.time='10:00" +
  "';return it.no==='2'?{oc:'none',on:'',due:futureDue(iso(today),21),note:" +
  "'',cite:true}\n  :{oc:'progress',on:'',due:futureDue(iso(today),21),note:" +
  "'',cite:false};});\ndocFromReinspection(r2,'citation');var citId=issueDra" +
  "ft('k1');\ns=sum('k1');\nok('status Cited',s['case'].status==='Cited',s['c" +
  "ase'].status);\nok('one citation, on item 2',s.citations.length===1&&s.ci" +
  "tations[0].no==='2',JSON.stringify(s.citations));\nok('citation carries o" +
  "rdinance, number, amount',s.citations.length&&s.citations[0].ordinance==" +
  "='27.05(2)(c)'&&/^B\\d{11}$/.test(s.citations[0].num)&&s.citations[0].amo" +
  "unt===197,JSON.stringify(s.citations[0]));\nok('item 2 cited once, two vi" +
  "sits',s.violations[1].cited===1&&s.violations[1].visits===2);\nok('correc" +
  "ted item not counted again',s.violations[0].visits===1&&s.visits[1].resu" +
  "lts.length===2,JSON.stringify(s.visits[1]));\n\nH('Void and reissue');\n// " +
  "A legacy withdrawal remains visible, and its corrected restoration reuse" +
  "s the visit.\nappendEvent('k1','document.voided',{docId:citId,reason:'wro" +
  "ng court date'});project();\ns=sum('k1');\nok('a withdrawn citation is not" +
  " counted',s.citations.length===0&&s['case'].status==='Extension',s['case" +
  "'].status);\nok('the withdrawn document is still listed',s.documents.some" +
  "(d=>d.id===citId&&d.void));\nvar rr=startCorrection(citId);\nok('restorati" +
  "on starts a correction draft',!!rr&&rr.correction.targetId===citId);\nrr." +
  "correction.reason='Correct a transcribed court date';rr.correction.exter" +
  "nalReference='Court instructions recorded for this test.';\nrr.cits[rr.it" +
  "ems.find(i=>i.cite).id].courtDate='2027-04-12';\nvar correctionEvent=make" +
  "CorrectionAttempt(rr),cit2=rr.id;\neventsFor('k1').push(correctionEvent);" +
  "WriterState.DOCS=WriterState.DOCS.filter(x=>x.id!==rr.id);project();\ns=s" +
  "um('k1');\nok('the replacement citation counts once',s.citations.length==" +
  "=1&&s['case'].status==='Cited');\nok('the same two visits remain',s.visit" +
  "s.length===2,s.visits.length+' visits');\nok('item 2 still two visits',s." +
  "violations[1].visits===2,s.violations[1].visits);\nok('the replacement re" +
  "cords what it replaces',s.documents.some(d=>d.id===cit2&&d.replaces===ci" +
  "tId));\n\nH('Referral, frozen owner, compliance');\nvar r3=visit('k1',funct" +
  "ion(it,i,r){r.date='2026-12-01';return {oc:'none',on:'',due:'',note:'',c" +
  "ite:false};});\ndocFromReinspection(r3,'referral');\n// The synthetic case" +
  " runs in 2027; set its mailing dates explicitly rather than\n// inheritin" +
  "g the module's real startup clock from this maintenance session.\ndoc(Wri" +
  "terState.state.docId).mailed=iso(today);issueDraft('k1');\nkase('k1').own" +
  "er='SOMEONE WHO BOUGHT IT LATER';\ns=sum('k1');\nok('status Referred',s['c" +
  "ase'].status==='Referred',s['case'].status);\nok('one referral',s.referra" +
  "ls.length===1&&s.referrals[0].issued===iso(today));\nok('current owner gr" +
  "oups the case; referral retains its printed owner',s['case'].owner==='SO" +
  "MEONE WHO BOUGHT IT LATER'&&s.referrals[0].owner==='JAWAID, MAHUM',s['ca" +
  "se'].owner);\nok('mailing address as printed',s['case'].ownerAddr.join('|" +
  "')==='HANIF, JAWAD|1910 LEWON DR|MADISON, WI 53711');\nvar r4=visit('k1'," +
  "function(it,i,r){r.date='2027-01-10';return {oc:'corrected',on:'2027-01-" +
  "10',due:'',note:'',cite:false};});\ndocFromReinspection(r4,'compliance');" +
  "var cp=WriterState.DOCS.find(function(d){return d.draft&&d.caseId==='k1'" +
  ";});\nok('compliance drafted',!!cp&&cp.type==='compliance');\ncp.mailed=is" +
  "o(today);\nissueDraft('k1');\ns=sum('k1');\nok('status Closed',s['case'].st" +
  "atus==='Closed',s['case'].status);\nok('closedOn is the compliance issue " +
  "date',s['case'].closedOn===iso(today));\nok('every violation corrected wi" +
  "th a date',s.violations.every(function(v){return v.done&&v.doneOn;}),JSO" +
  "N.stringify(s.violations.map(function(v){return v.doneOn;})));\nok('item " +
  "1 keeps its first correction date',s.violations[0].doneOn==='2026-09-20'" +
  ");\nok('items 2 and 3 corrected at the last visit',s.violations[1].doneOn" +
  "==='2027-01-10'&&s.violations[2].doneOn==='2027-01-10');\nkase('k1').owne" +
  "r='JAWAID, MAHUM';\n\nH('A referral stays Referred after an update');\nok('" +
  "status map covers referral update',STATUS_OF.referralUpdate==='Referred'" +
  ");\n\nH('A schema-1 file summarizes after migration');\nvar v1={format:'mad" +
  "ison-case-file',schema:1,'case':{id:'kv1',number:'CB2025-010-00001',addr" +
  "ess:'1 TEST ST',\n  parcel:'0708-222-1910-3',owner:'OLD OWNER',ownerAddr:" +
  "['1 TEST ST','MADISON, WI 53703'],inspectorId:'i2',date:'2025-01-02'},\n " +
  " documents:[{id:'dv1',type:'notice',mailed:'2025-01-05',caseId:'kv1',ite" +
  "ms:[{id:'xv1',no:'1',title:'T',sections:['27.05(2)(c)'],done:false}]}],\n" +
  "  reinspections:[]};\nvar mf=migrate(JSON.parse(JSON.stringify(v1)));\nok(" +
  "'migrates with no fault',!caseFileFault(mf),caseFileFault(mf));\nvar sv=s" +
  "ummarize(mf);\nok('one violation, notice date kept',sv.violations.length=" +
  "==1&&sv['case'].noticeIssued==='2025-01-05'&&sv['case'].status==='Notice" +
  "');\nok('zip empty when the case has no site city',sv['case'].zip==='');\n" +
  "var z=summarize({format:'madison-case-file','case':{id:'kz',number:'QA-Z" +
  "1',siteCity:'MADISON, WI 53703-1234'},events:[]});\nok('zip from the site" +
  " city',z['case'].zip==='53703'&&z['case'].status==='Not issued');\n\nH('Sa" +
  "ving a case writes its summary into Reporting Index');\nfresh();\nvar dir=" +
  "mkDir('Case JSON Files');setPick(dir);await linkCaseFolder();\nnewDoc('k1" +
  "','notice');N=WriterState.DOCS[0];items(N,2);issueDraft('k1');\nvar ok1=a" +
  "wait saveCaseFile('k1');\nvar idx=dir.dirs.get('Reporting Index');\nok('th" +
  "e case file was written',ok1&&[...dir.files.keys()].some(function(n){ret" +
  "urn / - CB2026-238-03639\\.json$/.test(n);}));\nok('the summary was writte" +
  "n',!!idx&&idx.files.has('cb2026-238-03639.json'));\nvar js=idx?JSON.parse" +
  "(idx.files.get('cb2026-238-03639.json')):{};\nok('the summary matches the" +
  " case',js.format==='madison-case-summary'&&js['case'].number==='CB2026-2" +
  "38-03639'&&js.violations.length===2);\nok('diagnostics report the index w" +
  "rite',WriterState.LASTINDEX&&WriterState.LASTINDEX.ok&&/Reporting index/" +
  ".test(storageReport()));\n\nH('A folder that refuses subfolders does not c" +
  "ost the case file');\nfresh();\nvar dir2=mkDir('Case JSON Files',{subdirs:" +
  "false});setPick(dir2);await linkCaseFolder();\nnewDoc('k2','notice');N=Wr" +
  "iterState.DOCS.find(function(d){return d.draft&&d.caseId==='k2';});items" +
  "(N,1);issueDraft('k2');\nvar ok2=await saveCaseFile('k2');\nok('case file " +
  "still written',ok2&&[...dir2.files.keys()].some(function(n){return /CB20" +
  "26-216-03297/.test(n);}));\nok('the failed summary is reported',WriterSta" +
  "te.LASTINDEX&&!WriterState.LASTINDEX.ok,JSON.stringify(WriterState.LASTI" +
  "NDEX));\nok('nothing queued for the summary',!WriterState.PENDING.some(fu" +
  "nction(p){return /Reporting/.test(p.name);}));\n\nH('Rebuild the index fro" +
  "m every case file in the folder');\nvar dir3=mkDir('Case JSON Files');set" +
  "Pick(dir3);await linkCaseFolder();\ndir3.files.set('1 TEST ST - CB2025-01" +
  "0-00001.json',JSON.stringify(v1));\ndir3.files.set('1910 LEWON DR - CB202" +
  "6-238-03639.json',JSON.stringify(caseFile('k1')));\ndir3.files.set('_writ" +
  "e-test.json',JSON.stringify({test:true}));\ndir3.files.set('junk.json','{" +
  "not json');\ndir3.files.set('other.json',JSON.stringify({format:'somethin" +
  "g-else'}));\nvar casesBefore=WriterState.CASES.length,evBefore=JSON.strin" +
  "gify(WriterState.EVENTS);\nvar out=await rebuildIndex();\nvar idx3=dir3.di" +
  "rs.get('Reporting Index');\nok('two summaries written',out&&out.written==" +
  "=2,JSON.stringify(out));\nok('the unreadable and foreign files are refuse" +
  "d by name',out&&out.refused.length===2&&out.refused.some(function(x){ret" +
  "urn /^junk\\.json/.test(x);})&&out.refused.some(function(x){return /^othe" +
  "r\\.json/.test(x);}),JSON.stringify(out&&out.refused));\nok('the test file" +
  " is skipped',out&&!out.refused.concat(out.failed).some(function(x){retur" +
  "n /_write-test/.test(x);}));\nok('a case never opened here is summarized'" +
  ",!!idx3&&idx3.files.has('cb2025-010-00001.json'));\nok('nothing was loade" +
  "d into the working list',WriterState.CASES.length===casesBefore&&JSON.st" +
  "ringify(WriterState.EVENTS)===evBefore);\nWriterState.state.modal='storag" +
  "e';render();\nok('the storage dialog reports the rebuild',/Reporting inde" +
  "x rebuilt: 2 of 4 case files summarized/.test(document.body.innerHTML));" +
  "\nok('the rebuild button is offered',!!document.getElementById('btn-reind" +
  "ex'));\nok('the rail links to the reports page',!!document.querySelector(" +
  "'a.rail-item[href=\"madison-reports.html\"]'));\n\nconsole.log('\\n'+(fails.l" +
  "ength?fails.length+' FAILURE(S): '+fails.join(' | '):'all checks passed'" +
  "));\nif(fails.length)process.exitCode=1;\n})().catch(function(e){console.l" +
  "og('CRASH',e&&e.stack||e);process.exitCode=1;});\n";
global.CSSTEXT = CSS;
eval(src + "\n;;\n" + T);
