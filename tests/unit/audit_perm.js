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

// Chrome only honours requestPermission while a click is "active".
// ACTIVE goes false once the promise chain has gone a few turns deep.
const FOLDER = new Map();
let ACTIVE = false,
  PERM = "prompt",
  PDFS = [];
global.fetch = async (u, o) => {
  if (String(u).indexOf("/dw-status") >= 0) return { ok: true, json: async () => ({ ok: true, out: "X", chrome: true }) };
  if (String(u).indexOf("/save-pdf") >= 0) {
    PDFS.push(JSON.parse(o.body).filename);
    return { ok: true, json: async () => ({ ok: true, name: "x.pdf" }) };
  }
  throw 0;
};
w.showDirectoryPicker = async () => ({
  name: "Case JSON Files",
  kind: "directory",
  queryPermission: async () => PERM,
  requestPermission: async () => {
    if (!ACTIVE) {
      const e = new Error("user activation is required");
      e.name = "SecurityError";
      throw e;
    }
    PERM = "granted";
    return "granted";
  },
  async getFileHandle(n, o) {
    if (PERM !== "granted") {
      const e = new Error("not allowed");
      e.name = "NotAllowedError";
      throw e;
    }
    if (!FOLDER.has(n) && !(o && o.create)) {
      const e = new Error("not found");
      e.name = "NotFoundError";
      throw e;
    }
    return {
      async getFile() {
        return { text: async () => FOLDER.get(n) };
      },
      async createWritable() {
        let b = "";
        return {
          async write(x) {
            b += x;
          },
          async close() {
            FOLDER.set(n, b);
          },
        };
      },
    };
  },
  async *entries() {},
});
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
  "tTimeout(r,ms));\nfunction addItems(N,n){for(var i=0;i<n;i++)N.items.push" +
  "({id:uid('x'),group:'',sections:['27.05(2)(c)'],\n  title:'Item '+(i+1),a" +
  "bate:false,due:futureDue(iso(today),21),text:'Clean it.',prov:'notice'})" +
  ";renumber(N);}\n// a click: activation is live for the synchronous part a" +
  "nd one microtask turn\nfunction click(fn){ACTIVE=true;const r=fn();Promis" +
  "e.resolve().then(()=>{ACTIVE=false;});return r;}\n\n(async function(){\nH('" +
  "SETUP: linked, then the session ends and permission drops to prompt');\na" +
  "wait checkHelper();\nACTIVE=true;PERM='granted';await linkCaseFolder();AC" +
  "TIVE=false;\nok('linked',storageMode()==='folder');\nPERM='prompt';WriterS" +
  "tate.NEEDGRANT=true;      // exactly what a new session looks like\nok('n" +
  "ew session needs a click',storageMode()==='folder-locked');\n\nH('THE OLD " +
  "PATH: permission asked too late');\nWriterState.DOCS.length=0;WriterState" +
  ".REINSP.length=0;WriterState.EVENTS={};WriterState.PENDING.length=0;FOLD" +
  "ER.clear();PDFS.length=0;\nnewDoc('k1','notice');var N=WriterState.DOCS[0" +
  "];addItems(N,2);issueDocument(N);\n// ask for permission from deep inside" +
  " a promise chain, as before\nawait Promise.resolve().then(()=>sleep(1)).t" +
  "hen(()=>saveCaseFile('k1'));\nok('case file did NOT write (this was the b" +
  "ug)',FOLDER.size===0);\nok('  it queued instead',WriterState.PENDING.leng" +
  "th===1);\nWriterState.PENDING.length=0;PERM='prompt';WriterState.NEEDGRAN" +
  "T=true;\n\nH('THE FIX: permission asked on the click');\nWriterState.DOCS.l" +
  "ength=0;WriterState.EVENTS={};FOLDER.clear();PDFS.length=0;\nnewDoc('k1'," +
  "'notice');N=WriterState.DOCS[0];addItems(N,2);\nWriterState.state.docId=N" +
  ".id;WriterState.state.screen='write';render();\nWriterState.state.modal='" +
  "final';render();\ndocument.getElementById('fin-mailed').value=iso(today);" +
  "\n// this is what the Finalize button does\nclick(()=>{\n  var d=doc(Writer" +
  "State.state.docId);\n  if(WriterState.CASEDIR&&WriterState.NEEDGRANT){gra" +
  "ntCaseFolder(true).then(()=>runFinalize(d));return;}\n  runFinalize(d);\n}" +
  ");\nawait sleep(60);\nok('permission granted from the click',WriterState.N" +
  "EEDGRANT===false&&PERM==='granted');\nok('  legacy folder cannot publish " +
  "without the locked helper',FOLDER.size===0);\nok('  no unconfirmed PDF fi" +
  "led',PDFS.length===0);\nok('  nothing queued',WriterState.PENDING.length=" +
  "==0);\nok('  dialog closed',WriterState.state.modal===null);\nok('  docume" +
  "nt remains a draft',docsFor('k1').filter(d=>!d.draft).length===0&&N.draf" +
  "t);\nok('  current helper requirement explained',WriterState.state.amendm" +
  "entError.includes('current local helper'));\n\nH('MANUAL SAVE ALSO CARRIES" +
  " A LIVE CLICK');\nPERM='prompt';WriterState.NEEDGRANT=true;FOLDER.clear()" +
  ";\nvar dd=docsFor('k1')[0];\nclick(()=>{ if(WriterState.CASEDIR&&WriterSta" +
  "te.NEEDGRANT){grantCaseFolder(true).then(()=>saveCaseFile(dd.caseId));re" +
  "turn;}\n  saveCaseFile(dd.caseId); });\nawait sleep(40);\nok('Save case fil" +
  "e works after a lapse',FOLDER.size===1&&WriterState.PENDING.length===0);" +
  "\n\nH('IF THE INSPECTOR REFUSES, NOTHING IS LOST');\nPERM='denied';WriterSt" +
  "ate.NEEDGRANT=true;FOLDER.clear();\nw.showDirectoryPicker=w.showDirectory" +
  "Picker; // unchanged\nWriterState.CASEDIR.requestPermission=async()=>{ if" +
  "(!ACTIVE)throw new Error('no activation'); return 'denied'; };\nclick(()=" +
  ">{ grantCaseFolder(true).then(()=>saveCaseFile('k1')); });\nawait sleep(4" +
  "0);\nok('queued rather than lost',WriterState.PENDING.length===1&&FOLDER." +
  "size===0);\nok('  banner reports it',(function(){WriterState.state.screen" +
  "='cases';render();\n  const banner=document.querySelector('.saved-connect" +
  "ion');return !!banner&&banner.textContent.includes('1 shared save waitin" +
  "g')&&!!banner.querySelector('[data-sync-safety]');})());\n\nH('DIAGNOSTICS" +
  " PANEL');\nWriterState.state.modal='storage';render();\nvar m=document.get" +
  "ElementById('overlay').innerHTML;\n['Served from','Folder access','Case f" +
  "older','Folder permission','Files waiting to write','PDF helper','Last w" +
  "rite']\n  .forEach(function(r){ok('  reports: '+r,m.indexOf(r)>=0);});\nok" +
  "('  offers a test write',m.indexOf('btn-testwrite')>=0);\nWriterState.sta" +
  "te.modal=null;\n\nif(fails.length)process.exitCode=1;\nconsole.log('\\n'+(fa" +
  "ils.length?fails.length+' FAILURE(S): '+fails.join(' | '):'permission ha" +
  "ndling correct'));\n})();\n";
eval(src + "\n;;\n" + T);
