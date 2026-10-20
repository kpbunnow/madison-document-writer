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
  "\nfunction items(N,n){for(var i=0;i<n;i++)N.items.push({id:uid('x'),group" +
  ":'',\n  sections:[i?'27.05(2)(c)':'27.05(2)(f)'],title:'Item '+(i+1),abat" +
  "e:false,\n  due:futureDue(recordDay(today),21),text:'Clean it.',prov:'not" +
  "ice'});renumber(N);}\nfunction visit(cid,fn){startReinspection(cid);reins" +
  "p(WriterState.state.reinspId).time='10:00';var r=WriterState.REINSP.filt" +
  "er(function(x){return x.draft&&x.caseId===cid;})[0];\n  var src=doc(r.sou" +
  "rceDocId);src.items.forEach(function(it,i){if(it.done)return;r.results[i" +
  "t.id]=fn(it,i,r);});return r;}\nfunction issueDraft(cid){var d=WriterStat" +
  "e.DOCS.filter(function(x){return x.draft&&x.caseId===cid;})[0];\n  if(d.t" +
  "ype==='citation')d.items.filter(function(i){return i.cite;}).forEach(fun" +
  "ction(i){citAmount(d,i);});return issueDocument(d)?d.id:null;}\nWriterSta" +
  "te.DOCS.length=0;WriterState.REINSP.length=0;WriterState.EVENTS={};\nkase" +
  "('k1').date='2026-02-10';kase('k2').date='2026-03-05';kase('k3').date='2" +
  "026-04-20';\n// A company citation requires a complete registered agent a" +
  "t issue time.\nkase('k2').agent={name:'Synthetic Agent',addr:'456 W Lake " +
  "Ave',city:'Madison, WI 53703'};\n['k1','k2','k3'].forEach(function(cid){n" +
  "ewDoc(cid,'notice');var N=WriterState.DOCS.find(function(d){return d.dra" +
  "ft&&d.caseId===cid;});items(N,2);issueDraft(cid);});\nvar r=visit('k1',fu" +
  "nction(it,i,r){r.date='2026-03-01';return {oc:'corrected',on:'2026-03-01" +
  "',due:'',note:'',cite:false};});\ndocFromReinspection(r,'compliance');iss" +
  "ueDraft('k1');\nr=visit('k2',function(it,i,r){r.date='2026-04-01';r.time=" +
  "'09:30';return {oc:'none',on:'',due:futureDue(recordDay(today),21),note:" +
  "'',cite:i===0};});\ndocFromReinspection(r,'citation');issueDraft('k2');\nr" +
  "=visit('k2',function(it,i,r){r.date='2026-05-01';return {oc:'none',on:''" +
  ",due:'',note:'',cite:false};});\ndocFromReinspection(r,'referral');issueD" +
  "raft('k2');\nrequire('fs').writeFileSync('/tmp/real_summaries.json',JSON." +
  "stringify(['k1','k2','k3'].map(function(c){return summarize(caseFile(c))" +
  ";})));\nconsole.log('wrote');\n";
global.CSSTEXT = CSS;
eval(src + "\n;;\n" + T);
