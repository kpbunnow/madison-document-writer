globalThis.MADISON_TEST_DATA = true;
// Consolidation Phase 2 (T1): run remaining long UI timers once the suite completes instead of waiting.
const { settle } = require("../fixtures/settle_ui_timers.cjs");
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
let ROW = 78;
Object.defineProperty(w.HTMLElement.prototype, "scrollHeight", {
  configurable: true,
  get() {
    if (!this.classList || !this.classList.contains("sheet")) return 0;
    let h = 105;
    Array.prototype.forEach.call(this.children, (c) => {
      if (c.tagName === "TABLE") {
        h += 26;
        const tb = c.querySelector("tbody");
        if (tb) h += tb.children.length * ROW;
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
global.setROW = (v) => {
  ROW = v;
};
const T =
  "\nvar fails=[];\nfunction H(t){console.log('\\n=== '+t+' ===');}\nfunction o" +
  "k(l,c,x){console.log('  '+(c?'ok   ':'FAIL ')+l+(x!==undefined?'   '+x:'" +
  "'));if(!c)fails.push(l);}\nfunction fresh(){WriterState.DOCS.length=0;Wri" +
  "terState.REINSP.length=0;}\nfunction mk(n,sec,txt){\n  fresh();newDoc('k1'" +
  ",'notice');var N=WriterState.DOCS[0];\n  for(var i=0;i<n;i++)N.items.push" +
  "({id:uid('x'),group:'',sections:sec||['27.05(2)(c)'],\n    title:'Item '+" +
  "(i+1),abate:false,due:futureDue(iso(today),21),\n    text:txt||'Do the wo" +
  "rk.',prov:'notice'});\n  renumber(N);WriterState.state.docId=N.id;return " +
  "N;\n}\n\nH('VALIDATION — each blocker fires on its own');\nvar cases=[\n ['no" +
  " items',        function(N){N.items.length=0;}],\n ['unfilled blank',  fu" +
  "nction(N){N.items[0].text='Repair the ( ).';}],\n ['no due date',     fun" +
  "ction(N){N.items[0].due='';}],\n ['past due date',   function(N){N.items[" +
  "0].due='2020-01-01';}],\n ['no ordinance',    function(N){N.items[0].sect" +
  "ions=[];}],\n ['draft language',  function(N){N.items[0].prov='draft';}]," +
  "\n ['due > 180 days',  function(N){N.items[0].due=futureDue(iso(today),20" +
  "0);}],\n ['bad mailing block',function(N){kase(N.caseId).ownerAddr=['MADI" +
  "SON'];}],\n ['6-line block',    function(N){kase(N.caseId).ownerAddr=['a'" +
  ",'b','c','d','e','f'];}]];\ncases.forEach(function(c){\n  var k=kase('k1')" +
  ",sv=JSON.stringify({o:k.owner,a:k.ownerAddr});\n  var N=mk(2);c[1](N);\n  " +
  "var b=blockers(N);\n  ok(c[0]+' blocks',b.length>0,b.length?'\"'+b[0].t+'\"" +
  "':'NOT BLOCKED');\n  var r=JSON.parse(sv);k.owner=r.o;k.ownerAddr=r.a;\n})" +
  ";\nvar N=mk(2);\nok('a clean notice has no blockers',blockers(N).length===" +
  "0,blockers(N).map(function(c){return c.t;}).join('|'));\nN.mailed=addDays" +
  "(iso(today),5);ok('Mailed date five days ahead is allowed',!blockers(N)." +
  "some(function(c){return /mailing date/.test(c.t);}));\nN.mailed=addDays(i" +
  "so(today),6);ok('Mailed date six days ahead is blocked',blockers(N).some" +
  "(function(c){return /mailing date/.test(c.t);}));\nkase(N.caseId).time='1" +
  "0:00';kase(N.caseId).date='';ok('Blank inspection date is blocked with a" +
  " field check',checks(N).some(function(c){return !c.ok&&/inspection date/" +
  ".test(c.t);}));\nkase(N.caseId).date=addDays(iso(today),-30);N.mailed=iso" +
  "(today);\nN.items[0].due=futureDue(iso(today),3);\nok('short window is a n" +
  "ote, not a blocker',blockers(N).length===0&&checks(N).some(function(c){r" +
  "eturn !c.ok&&c.soft;}));\n\nH('VALIDATION — citation-only checks');\nfresh(" +
  ");N=mk(2);N.mailed=iso(today);issueDocument(N);N=docsFor(N.caseId)[0];\ns" +
  "tartReinspection('k1');var r=WriterState.REINSP[WriterState.REINSP.lengt" +
  "h-1];r.time='10:00';\nN.items.forEach(function(it,i){r.results[it.id]={oc" +
  ":'none',on:r.date,due:futureDue(iso(today),21),note:'',cite:i===0};});\nd" +
  "ocFromReinspection(r,'citation');\nvar C=WriterState.DOCS[0];WriterState." +
  "state.docId=C.id;\nok('fresh citation has no blockers',blockers(C).length" +
  "===0,blockers(C).map(function(c){return c.t;}).join(' | '));\nvar cid=C.i" +
  "tems[0].id;\n[['citation number blank',function(){C.cits[cid].num='';}],\n" +
  " ['court date in the past',function(){C.cits[cid].courtDate='2020-01-01'" +
  ";}],\n ['description blank',function(){C.cits[cid].desc='';}],\n ['no item" +
  " cited',function(){C.items.forEach(function(i){i.cite=false;});}]].forEa" +
  "ch(function(t){\n  var snap=JSON.stringify({c:C.cits,i:C.items.map(functi" +
  "on(i){return i.cite;})});\n  t[1]();\n  ok(t[0]+' blocks',blockers(C).leng" +
  "th>0);\n  var s=JSON.parse(snap);C.cits=s.c;C.items.forEach(function(i,n)" +
  "{i.cite=s.i[n];});\n});\nC.inspectorId=INSPECTORS.filter(function(i){retur" +
  "n !i.badge;})[0].id;\nC.cits[cid].deptId='';\nok('missing badge blocks',bl" +
  "ockers(C).some(function(c){return /badge/i.test(c.t);}));\nC.inspectorId=" +
  "'i1';\n\nH('DEPOSIT ENGINE');\nok('base 50 + $48 costs = 134.00',money(feeL" +
  "ines(50,48).total)==='134.00');\nok('base 100 + $48 costs = 197.00',money" +
  "(feeLines(100,48).total)==='197.00');\nok('base 0 still totals the add-on" +
  "s',money(feeLines(0,48).total)==='71.00',money(feeLines(0,48).total));\no" +
  "k('odd base rounds to cents',money(feeLines(75,48).total)==='165.50',mon" +
  "ey(feeLines(75,48).total));\nok('non-numeric base treated as 0',money(fee" +
  "Lines('abc',48).total)==='71.00');\nok('court costs floor respected in UI" +
  " range',CITFEES.ccMin===15&&CITFEES.ccMax===48);\nok('every enumerated or" +
  "dinance resolves',DEPOSITS.every(function(f){return !!lookupForf([f.ordi" +
  "nance]);}));\nok('ch.27 fallback is 100/200/250',JSON.stringify((lookupFo" +
  'rf([\'27.99(9)\'])||{}).tiers.map(({a,l})=>({a,l})))===\'[{"a":100,"l":"1st' +
  '"},{"a":200,"l":"2nd"},{"a":250,"l":"3rd"}]\');\nok(\'unknown chapter retur' +
  "ns null',lookupForf(['99.99'])===null);\nok('subsection step-down works'," +
  "(lookupForf(['10.25'])||{}).o==='10.25(5)');\n\nH('PAGINATION EDGE CASES')" +
  ";\n[[1,'single item'],[0,'no items']].forEach(function(t){\n  fresh();var " +
  "D=mk(0);for(var i=0;i<t[0];i++)D.items.push({id:uid('x'),group:'',sectio" +
  "ns:['27.05(2)(c)'],\n    title:'x',abate:false,due:futureDue(iso(today),2" +
  "1),text:'y',prov:'notice'});\n  renumber(D);WriterState.state.docId=D.id;" +
  "WriterState.state.screen='write';render();\n  var pg=document.querySelect" +
  "orAll('.desk .sheet');\n  ok(t[1]+' -> 1 page',pg.length===1,pg.length+' " +
  "pages');\n  ok('  no footer on a single page',!document.querySelector('.s" +
  "heet .n-foot'));\n});\nsetROW(950);      // one enormous row, taller than " +
  "a page\nfresh();var D=mk(3);WriterState.state.docId=D.id;render();\nvar pg" +
  "=document.querySelectorAll('.desk .sheet');\nok('oversized rows place one" +
  " per page (+1 for the closing blocks)',pg.length===4,pg.length+' pages')" +
  ";\nok('  no row is lost',Array.prototype.reduce.call(pg,function(a,p){var" +
  " tb=p.querySelector('tbody');\n  return a+(tb?tb.querySelectorAll('tr[dat" +
  "a-row]').length:0);},0)===3);\nsetROW(78);\nfresh();D=mk(40);WriterState.s" +
  "tate.docId=D.id;render();\npg=document.querySelectorAll('.desk .sheet');\n" +
  "ok('40 items paginate',pg.length>=4,pg.length+' pages');\nok('  all rows " +
  "present',Array.prototype.reduce.call(pg,function(a,p){var tb=p.querySele" +
  "ctor('tbody');\n  return a+(tb?tb.querySelectorAll('tr[data-row]').length" +
  ":0);},0)===40);\nok('  every page has a footer',Array.prototype.every.cal" +
  "l(pg,function(p){return !!p.querySelector('.n-foot');}));\nok('  page num" +
  "bers run 1..n',Array.prototype.map.call(pg,function(p,i){\n  return p.que" +
  "rySelector('.n-foot .pg').textContent==='Page '+(i+1)+' of '+pg.length;}" +
  ").every(Boolean));\nok('  letterhead only on page 1',Array.prototype.filt" +
  "er.call(pg,function(p){return !!p.querySelector('.n-head');}).length===1" +
  ");\nok('  envelope block only on page 1',Array.prototype.filter.call(pg,f" +
  "unction(p){return !!p.querySelector('.n-owner');}).length===1);\nok('repe" +
  "at render does not multiply pages',(function(){render();render();\n  retu" +
  "rn document.querySelectorAll('.desk .sheet').length===pg.length;})());\n\n" +
  "H('GROUP HEADINGS');\nfresh();D=mk(0);\n['A','A','B','B','B','C'].forEach(" +
  "function(g,i){D.items.push({id:uid('x'),group:'GROUP '+g,\n  sections:['2" +
  "7.05(2)(c)'],title:'i'+i,abate:false,due:futureDue(iso(today),21),text:'" +
  "t',prov:'notice'});});\nrenumber(D);WriterState.state.docId=D.id;render()" +
  ";\npg=document.querySelectorAll('.desk .sheet');\nvar orphan=Array.prototy" +
  "pe.some.call(pg,function(p){var tb=p.querySelector('tbody');\n  return tb" +
  "&&tb.lastChild&&tb.lastChild.className==='grp';});\nok('no group heading " +
  "left at a page foot',!orphan);\nok('  headings render',document.querySele" +
  "ctor('.desk').innerHTML.indexOf('GROUP A')>=0);\n\nif(fails.length&&typeof" +
  " process!=='undefined')process.exitCode=1;\nif(fails.length)process.exitC" +
  "ode=1;\nconsole.log('\\n'+(fails.length?fails.length+' FAILURE(S): '+fails" +
  ".join(' | '):'all checks passed'));\n";
settle(eval(src + "\n;;\n" + T), global.window);
