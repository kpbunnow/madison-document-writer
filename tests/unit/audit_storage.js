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
global.prompt = () => "reason";
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

// --- mock IndexedDB (a plain map) and a mock case folder -------------------
const KV = new Map();
global.indexedDB = {
  open() {
    const r = {};
    setTimeout(() => {}, 0);
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
                KV.set(k, v);
                const q = {};
                return q;
              },
            };
          },
          oncomplete: null,
          set oncomplete(f) {
            queueMicrotask(() => f && f());
          },
          get oncomplete() {
            return null;
          },
        };
      },
    };
    queueMicrotask(() => r.onsuccess && r.onsuccess());
    return r;
  },
};

const FOLDER = new Map();
let FAIL = false;
function mkHandle() {
  return {
    name: "cases",
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
  };
}
w.showDirectoryPicker = async () => mkHandle();

const T =
  "\n// Schema 4 export fixture; R31 tests cover schema 5 helper-only writes" +
  ".\nconst legacyCaseFile=caseFile;caseFile=(cid)=>({...legacyCaseFile(cid)" +
  ",schema:4});\n\nvar fails=[];\nfunction H(t){console.log('\\n=== '+t+' ===')" +
  ";}\nfunction ok(l,c,x){console.log('  '+(c?'ok   ':'FAIL ')+l+(x!==undefi" +
  "ned?'   '+x:''));if(!c)fails.push(l);}\nconst sleep=ms=>new Promise(r=>se" +
  "tTimeout(r,ms));\nfunction addItems(N,n){for(var i=0;i<n;i++)N.items.push" +
  "({id:uid('x'),group:'',sections:['27.05(2)(c)'],\n  title:'Item '+(i+1),a" +
  "bate:false,due:futureDue(iso(today),21),text:'Do the work.',prov:'notice" +
  "'});renumber(N);}\n\n(async function(){\nH('CAPABILITIES');\nok('File System" +
  " Access detected',FS_OK===true);\nok('IndexedDB detected',IDB_OK===true);" +
  "\nok('starts unlinked',storageMode()==='folder-not-linked',storageMode())" +
  ";\n\nH('LINKING THE CASE FOLDER');\nawait linkCaseFolder();\nok('linked',sto" +
  "rageMode()==='folder',storageMode());\nok('  folder name shown',WriterSta" +
  "te.DIRNAME==='cases');\nok('  handle persisted',!!(await idbGet('casedir'" +
  ")));\n\nH('WRITING IN PLACE');\nWriterState.DOCS.length=0;WriterState.REINS" +
  "P.length=0;WriterState.EVENTS={};\nnewDoc('k1','notice');var N=WriterStat" +
  "e.DOCS[0];addItems(N,2);issueDocument(N);\nawait saveCaseFile('k1');\nvar " +
  "name=caseFileName(kase('k1'));\nok('file written to the folder',FOLDER.ha" +
  "s(name),name);\nok('  it is current schema with events',JSON.parse(FOLDER" +
  ".get(name)).schema===4);\nvar size1=FOLDER.get(name).length;\n// issue a s" +
  "econd document and save again — must overwrite, not duplicate\nvar pub=do" +
  "csFor('k1')[0];\nstartReinspection('k1');reinsp(WriterState.state.reinspI" +
  "d).time='10:00';var r=WriterState.REINSP.filter(x=>x.draft)[0];\npub.item" +
  "s.forEach(function(it,i){r.results[it.id]={oc:i?'none':'corrected',on:r." +
  "date,\n  due:i?futureDue(iso(today),21):'',note:'',cite:false};});\ndocFro" +
  "mReinspection(r,'extension');\nissueDocument(WriterState.DOCS.filter(x=>x" +
  ".draft)[0]);\nawait saveCaseFile('k1');\nok('same file overwritten, not du" +
  "plicated',FOLDER.size===1,FOLDER.size+' file(s)');\nok('  and it grew',FO" +
  "LDER.get(name).length>size1);\n\nH('OFFLINE QUEUE');\nFAIL=true;\nnewDoc('k1" +
  "','notice');var N2=WriterState.DOCS.filter(x=>x.draft)[0];addItems(N2,1)" +
  ";\nawait saveCaseFile('k1');\nok('unreachable share queues the write',Writ" +
  "erState.PENDING.length===1);\nok('  queue persisted',Array.isArray(await " +
  "idbGet('pending')));\nawait saveCaseFile('k1');\nok('  a second save repla" +
  "ces the queued copy',WriterState.PENDING.length===1);\nFAIL=false;\nawait " +
  "flushPending();\nok('reconnecting flushes the queue',WriterState.PENDING." +
  "length===0);\nok('  and the file is current',FOLDER.get(name).length>0);\n" +
  "\nH('READING BACK FROM THE FOLDER');\nvar list=await listCaseFolder();\nok(" +
  "'folder lists case files',list.length===1&&list[0].name===name,list.map(" +
  "f=>f.name).join(', '));\nWriterState.EVENTS={};WriterState.DOCS.length=0;" +
  "project();\nok('  history cleared',docsFor('k1').filter(d=>!d.draft).leng" +
  "th===0);\nawait openFromFolder(name);\nok('  reopened from the folder',doc" +
  "sFor('k1').filter(d=>!d.draft).length===2,\n   docsFor('k1').filter(d=>!d" +
  ".draft).length+' documents');\n\nH('DRAFTS STAY OFF THE SHARE');\nWriterSta" +
  "te.DOCS.length=0;WriterState.REINSP.length=0;WriterState.EVENTS={};\nnewD" +
  "oc('k1','notice');var D=WriterState.DOCS[0];addItems(D,3);\nawait saveDra" +
  "fts();\nvar body=JSON.stringify(caseFile('k1'));\nok('draft is not in the " +
  "case file',body.indexOf(D.id)<0);\nok('  case file has no events yet',JSO" +
  "N.parse(body).events.length===0);\nvar stored=await idbGet('drafts');\nok(" +
  "'draft held on this machine',!!stored&&stored.docs.length===1);\n// simul" +
  "ate closing and reopening the browser\nWriterState.DOCS.length=0;WriterSt" +
  "ate.REINSP.length=0;\nawait restoreDrafts();\nok('draft restored after a r" +
  "estart',WriterState.DOCS.filter(d=>d.draft).length===1);\nok('  with its " +
  "items',WriterState.DOCS.filter(d=>d.draft)[0].items.length===3);\n// issu" +
  "ing publishes and clears the draft\nissueDocument(WriterState.DOCS.filter" +
  "(d=>d.draft)[0]);\nawait saveDrafts();\nok('issuing clears the draft',(awa" +
  "it idbGet('drafts')).docs.length===0);\nok('  and writes an event',events" +
  "For('k1').length===1);\nawait discardDraft('nothing');\n\nH('PERMISSION RE-" +
  "PROMPT');\nWriterState.NEEDGRANT=true;\nok('locked mode reported',storageM" +
  "ode()==='folder-locked');\nawait saveCaseFile('k1');\nok('  permission is " +
  "re-requested and the write goes through',WriterState.PENDING.length===0&" +
  "&WriterState.NEEDGRANT===false);\nok('  file is on the share',FOLDER.size" +
  ">0);\n\nH('BOOT');\nWriterState.CASEDIR=null;WriterState.DIRNAME='';\nawait " +
  "restoreCaseFolder();\nok('folder restored from disk on boot',storageMode(" +
  ")==='folder',storageMode());\n\nif(fails.length)process.exitCode=1;\nconsol" +
  "e.log('\\n'+(fails.length?fails.length+' FAILURE(S): '+fails.join(' | '):" +
  "'all storage checks passed'));\n})();\n";
eval(src + "\n;;\n" + T);
