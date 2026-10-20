globalThis.MADISON_TEST_DATA = true;
const fs = require("fs");
const assert = require("assert/strict");
for (const name of ["madison-document-writer.html", "madison-reports.html"]) {
  const html = fs.readFileSync(require("path").join(require("path").resolve(__dirname, "../.."), "build/dist", name), "utf8");
  assert.match(html, /^<!doctype html>\s*<html lang="en">/);
  assert.match(html, /<\/body>\s*<\/html>\s*$/);
  assert.equal(new (require("jsdom").JSDOM)(html).window.document.compatMode, "CSS1Compat");
}
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
const store = {},
  mkEl = (id) => ({
    id,
    innerHTML: "",
    textContent: "",
    style: {},
    dataset: {},
    value: "",
    className: "",
    classList: { toggle() {}, add() {}, remove() {} },
    files: [],
    focus() {},
    setSelectionRange() {},
    click() {},
    remove() {},
    appendChild() {},
    cloneNode() {
      return mkEl("c");
    },
    querySelectorAll() {
      return [];
    },
    querySelector() {
      return null;
    },
    setAttribute() {},
    getAttribute() {
      return null;
    },
    hasAttribute() {
      return false;
    },
    scrollIntoView() {},
    addEventListener() {},
  });
global.document = {
  getElementById(id) {
    return store[id] || (store[id] = mkEl(id));
  },
  createElement(t) {
    return mkEl(t);
  },
  querySelector(s) {
    return s === "style" ? { textContent: "" } : null;
  },
  querySelectorAll() {
    return [];
  },
  addEventListener() {},
  body: mkEl("body"),
  execCommand() {},
  createRange() {
    return { selectNodeContents() {}, collapse() {} };
  },
};
global.window = {
  addEventListener() {},
  scrollY: 0,
  scrollTo() {},
  print() {},
  focus() {},
  open() {
    return null;
  },
};
global.getSelection = () => ({ removeAllRanges() {}, addRange() {} });
global.setTimeout = () => 0;
global.URL = { createObjectURL: () => "b", revokeObjectURL() {} };
global.Blob = function () {};
global.FileReader = function () {};
global.confirm = () => true;
const T =
  "\nnewDoc('k1','notice');var N=WriterState.DOCS[0];\nLIBRARY[0].groups[0].i" +
  "tems.slice(0,3).forEach(function(it){\n  N.items.push({id:uid('x'),group:" +
  "'',sections:it.s.slice(),title:it.t,abate:false,due:'2026-07-10',text:it" +
  ".a,prov:it.p});});\nrenumber(N);global.OUT={notice_draft:screenWrite()};\n" +
  "renumber(N);issueDocument(N);N=docsFor(N.caseId)[0];\nOUT.notice_final=sc" +
  "reenWrite();\nstartReinspection('k1');var r=WriterState.REINSP[0];\nOUT.re" +
  "inspect_blank=screenReinspect();\nr.results[N.items[0].id]={oc:'corrected" +
  "',on:'2026-08-27',due:'',note:'ok',cite:false};\nr.results[N.items[1].id]" +
  "={oc:'none',on:'2026-08-27',due:'2026-09-25',note:'no change',cite:true}" +
  ";\nr.results[N.items[2].id]={oc:'progress',on:'2026-08-27',due:'2026-09-2" +
  "5',note:'',cite:false};\nOUT.reinspect_filled=screenReinspect();\ndocFromR" +
  "einspection(r,'citation');\nOUT.citation=screenWrite();\nOUT.cases=screenC" +
  "ases();OUT.documents=screenCases();OUT.library=screenLibrary();\nWriterSt" +
  "ate.state.modal='final';OUT.modal=modalHTML();\n";
eval(src + "\n;;\n" + T);
const VOID = new Set(["br", "hr", "img", "input", "meta", "link", "col", "source", "area", "base", "wbr", "embed"]);
let bad = 0;
for (const [name, h] of Object.entries(OUT)) {
  const stack = [];
  const strays = [];
  const re = /<(\/?)([a-zA-Z][a-zA-Z0-9]*)\b[^>]*?(\/?)>/g;
  let m;
  while ((m = re.exec(h))) {
    const tag = m[2].toLowerCase();
    if (VOID.has(tag) || m[3] === "/") continue;
    if (m[1] === "/") {
      if (stack[stack.length - 1] === tag) stack.pop();
      else strays.push(tag);
    } else stack.push(tag);
  }
  const leaks = ["${", ".concat(", "undefined"].filter((x) => h.includes(x));
  const ok = !stack.length && !strays.length && !leaks.length;
  if (!ok) bad++;
  console.log(
    (ok ? "ok    " : "BAD   ") +
      name.padEnd(18) +
      String(h.length).padStart(7) +
      (stack.length ? "  unclosed:" + stack.slice(-3) : "") +
      (strays.length ? "  stray:" + strays.slice(0, 3) : "") +
      (leaks.length ? "  leak:" + leaks : ""),
  );
}
console.log(bad ? "\n" + bad + " PROBLEM(S)" : "\nall clean");

if (bad) process.exitCode = 1;
