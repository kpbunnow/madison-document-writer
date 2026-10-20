globalThis.MADISON_TEST_DATA = true;
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
global.fetch = async () => {
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
  "\nvar fails=[];\nfunction H(t){console.log('\\n=== '+t+' ===');}\nfunction o" +
  "k(l,c,x){console.log('  '+(c?'ok   ':'FAIL ')+l+(x!==undefined?'   '+x:'" +
  "'));if(!c)fails.push(l);}\nfunction fresh(){WriterState.DOCS.length=0;Wri" +
  "terState.REINSP.length=0;WriterState.EVENTS={};WriterState.state.docId=n" +
  "ull;WriterState.state.reinspId=null;}\nfunction items(N,n){for(var i=0;i<" +
  "n;i++)N.items.push({id:uid('x'),group:'',sections:['27.05(2)(c)'],\n  tit" +
  "le:'Item '+(i+1),abate:false,due:futureDue(iso(today),21),text:'Clean it" +
  ".',prov:'notice'});renumber(N);}\nfunction rowFor(num){\n  WriterState.sta" +
  "te.screen='cases';WriterState.state.caseFilter='all';render();\n  var row" +
  "s=document.querySelectorAll('table.list tbody tr');\n  for(var i=0;i<rows" +
  ".length;i++)\n    if(rows[i].cells[0].textContent.includes(num))return ro" +
  "ws[i];\n  return null;\n}\nfunction actionFor(num){var r=rowFor(num);var b=" +
  "r&&r.querySelector('td:last-child button');\n  return b?b.textContent.tri" +
  "m():'(none)';}\nvar NUM=kase('k1').number;\n\nH('A HALF-WRITTEN NOTICE IS R" +
  "ESUMED, NOT REINSPECTED');\nfresh();\nnewDoc('k1','notice');var N=WriterSt" +
  "ate.DOCS[0];items(N,3);\nok('row offers to finish it',actionFor(NUM)==='C" +
  "ontinue document',actionFor(NUM));\nok('  not a reinspection',actionFor(N" +
  "UM).indexOf('reinspection')<0);\nok('  sourceDocFor ignores drafts',sourc" +
  "eDocFor('k1')===null);\nvar before=WriterState.REINSP.length;\nstartReinsp" +
  "ection('k1');\nok('  and starting one is refused',WriterState.REINSP.leng" +
  "th===before);\nok('  the notice is untouched',!isLocked(N)&&structEditabl" +
  "e(N));\n\nH('AND IT IS STILL FULLY EDITABLE');\nWriterState.state.docId=N.i" +
  "d;WriterState.state.screen='write';render();\nvar h=document.querySelecto" +
  "r('.desk').innerHTML;\nok('drag handles present',(h.match(/data-grip/g)||" +
  "[]).length===3);\nok('remove buttons present',(h.match(/class=\"rm no-prin" +
  "t\"/g)||[]).length===3);\nok('cite boxes present',(h.match(/data-notecite/" +
  "g)||[]).length===3);\nok('text is editable',h.indexOf('contenteditable')>" +
  "=0);\nok('abate is a button',h.indexOf('ab-btn')>=0);\n// reorder and dele" +
  "te actually work\nvar order0=N.items.map(function(i){return i.title;}).jo" +
  "in(',');\nN.items.reverse();renumber(N);\nok('reordering renumbers 1..n',N" +
  ".items.map(function(i){return i.no;}).join(',')==='1,2,3');\nok('  and ch" +
  "anged the order',N.items.map(function(i){return i.title;}).join(',')!==o" +
  "rder0);\nN.items.splice(1,1);renumber(N);\nok('deleting renumbers',N.items" +
  ".map(function(i){return i.no;}).join(',')==='1,2');\n\nH('ONCE ISSUED, THE" +
  " ROW OFFERS A REINSPECTION');\nissueDocument(N);\n// A fully filed fixture" +
  " includes independently known PDF location facts.\ndoc(N.id).filedAt='fil" +
  "ed';doc(N.id).filedArtifact={filename:'resume-fixture.pdf',sha256:'a'.re" +
  "peat(64)};WriterState.ARTIFACT_LOCATIONS[N.id]=['shared'];\nok('row offer" +
  "s a direct reinspection action',actionFor(NUM)==='Reinspect'||actionFor(" +
  "NUM)==='Start reinspection',actionFor(NUM));\nok('  the notice is now loc" +
  "ked',isLocked(docsFor('k1')[0]));\n\nH('AN INTERRUPTED REINSPECTION IS RES" +
  "UMED TOO');\nstartReinspection('k1');\nvar r=WriterState.REINSP.filter(fun" +
  "ction(x){return x.draft;})[0];\nvar pub=docsFor('k1')[0];\nr.results[pub.i" +
  "tems[0].id]={oc:'corrected',on:r.date,due:'',note:'',cite:false};\nvar ri" +
  "=screenReinspect();\nok('worksheet offers Save & continue later',ri.index" +
  "Of('btn-risave')>=0);\nok('  no bare Back to cases',ri.indexOf('Back to c" +
  "ases')<0);\n// save it\nsaveDrafts();WriterState.state.screen='cases';rend" +
  "er();\nok('row offers to finish the reinspection',actionFor(NUM)==='Conti" +
  "nue reinspection',actionFor(NUM));\nok('  the worksheet is still there',W" +
  "riterState.REINSP.filter(function(x){return x.draft;}).length===1);\nok('" +
  "  it kept the result already entered',Object.keys(r.results).length===1)" +
  ";\nstartReinspection('k1');\nok('  and reopens the same one',WriterState.s" +
  "tate.reinspId===r.id&&WriterState.REINSP.filter(function(x){return x.dra" +
  "ft;}).length===1);\n\nH('BOTH KINDS OF UNFINISHED WORK ARE LISTED');\nWrite" +
  "rState.state.screen='cases';render();\nvar ch=document.getElementById('ap" +
  "p').innerHTML;\nok('unfinished panel names the reinspection',ch.indexOf('" +
  "Reinspection draft')>=0);\nok('  with its progress',/1 corrected, \\d+ sti" +
  "ll to result/.test(ch));\nok('  and offers to discard it',ch.indexOf('dat" +
  "a-discardri')>=0);\n\nH('THE HEADER BLOCK');\nfresh();\nnewDoc('k1','notice'" +
  ");var N2=WriterState.DOCS[0];items(N2,1);\nWriterState.state.docId=N2.id;" +
  "WriterState.state.screen='write';render();\nh=document.querySelector('.de" +
  "sk').innerHTML;\nok('two stacked columns',(h.match(/class=\"n-col\"/g)||[])" +
  ".length===2);\nok('  date and time sit together',/data-case=\"date\"[\\s\\S]{" +
  "0,220}data-case=\"time\"/.test(h));\nok('  inspector keeps its own lines',(" +
  'h.match(/class="n-insp-l"/g)||[]).length===3);\nok(\'  title, phone and em' +
  "ail all present',\n   h.indexOf(insp(kase('k1').inspectorId).title)>=0&&\n" +
  "   h.indexOf(insp(kase('k1').inspectorId).phone)>=0&&\n   h.indexOf(insp(" +
  "kase('k1').inspectorId).email)>=0);\nok('  no empty spacer rows left',h.i" +
  "ndexOf('<dt></dt><dd></dd>')<0);\nok('  date field fits a full date',/inp" +
  "ut\\[type=\"date\"\\]\\.hdr-in\\s*\\{\\s*width:\\s*6\\.6em/.test(CSSTEXT.replace(/\\n/g,''))" +
  ");\nok('  picker icon takes no width',/calendar-picker-indicator\\s*\\{\\s*display" +
  ":\\s*none/.test(CSSTEXT.replace(/\\n/g,'')));\nvar ph=printableHTML();\nok('  p" +
  "rints as plain text',(function(){var b=ph.slice(ph.indexOf('<body>'));re" +
  "turn b.indexOf('<input')<0;})());\nok('  and all five details survive pri" +
  "nting',\n   ['Case number','Property','Inspection date','Inspector','Mail" +
  "ed date'].every(function(x){return ph.indexOf(x)>=0;}));\n\nif(fails.lengt" +
  "h)process.exitCode=1;\nconsole.log('\\n'+(fails.length?fails.length+' FAIL" +
  "URE(S): '+fails.join(' | '):'all resume checks passed'));\n";
global.CSSTEXT = CSS;
eval(src + "\n;;\n" + T);
