globalThis.MADISON_TEST_DATA = true;
const { builtPage, bundleSource } = require("../fixtures/built_bundle.cjs");
const src = bundleSource(builtPage());
const store = {},
  mk = (id) => ({
    id,
    innerHTML: "",
    textContent: "",
    style: {},
    dataset: {},
    value: "",
    className: "",
    classList: {
      toggle() {},
      add() {},
      remove() {},
      contains() {
        return false;
      },
    },
    files: [],
    focus() {},
    setSelectionRange() {},
    click() {},
    remove() {},
    appendChild() {},
    cloneNode() {
      return mk("c");
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
    closest() {
      return null;
    },
    insertBefore() {},
    children: [],
    firstChild: null,
    lastChild: null,
  });
global.document = {
  getElementById(i) {
    return store[i] || (store[i] = mk(i));
  },
  createElement(t) {
    return mk(t);
  },
  querySelector(s) {
    return s === "style" ? { textContent: "" } : null;
  },
  querySelectorAll() {
    return [];
  },
  addEventListener() {},
  body: mk("body"),
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
  innerWidth: 1400,
};
global.getSelection = () => ({ removeAllRanges() {}, addRange() {} });
global.setTimeout = () => 0;
global.URL = { createObjectURL: () => "b", revokeObjectURL() {} };
global.Blob = function () {};
global.FileReader = function () {};
global.confirm = () => true;
const T =
  "\nfunction H(t){console.log('\\n=== '+t+' ===');}\nfunction P(l,v){console." +
  "log('  '+String(l).padEnd(42)+v);}\nvar issues=[];\nfunction bug(s){issues" +
  ".push(s);console.log('  !! '+s);}\n\nH('LIBRARY');\nvar items=[],codes={},g" +
  "rpNames={};\nLIBRARY.forEach(function(cl){\n  if(codes[cl.code])bug('dupli" +
  "cate checklist code '+cl.code);\n  codes[cl.code]=1;\n  cl.groups.forEach(" +
  "function(g){\n    var key=cl.code+'/'+g.code;\n    if(grpNames[key])bug('d" +
  "uplicate group '+key);\n    grpNames[key]=1;\n    g.items.forEach(function" +
  "(i){items.push({cl:cl.code,g:g.code,i:i});});\n  });\n});\nP('checklists / " +
  "groups / items',LIBRARY.length+' / '+Object.keys(grpNames).length+' / '+" +
  "items.length);\nvar noTitle=items.filter(function(x){return !x.i.t||!x.i." +
  "t.trim();});\nvar noText =items.filter(function(x){return !x.i.a||!x.i.a." +
  "trim();});\nvar noSec  =items.filter(function(x){return !x.i.s||!x.i.s.le" +
  "ngth;});\nvar noProv =items.filter(function(x){return !x.i.p;});\nP('missi" +
  "ng title',noTitle.length);\nP('missing corrective text',noText.length);\nP" +
  "('no ordinance',noSec.length+(noSec.length?'  ('+noSec.map(function(x){r" +
  "eturn x.i.t;}).join('; ')+')':''));\nP('missing provenance',noProv.length" +
  ");\nvar prov={};items.forEach(function(x){prov[x.i.p]=(prov[x.i.p]||0)+1;" +
  "});\nP('provenance',JSON.stringify(prov));\nvar dupT={},dups=[];\nitems.for" +
  "Each(function(x){var k=x.cl+'|'+x.i.t.toUpperCase();if(dupT[k])dups.push" +
  "(k);dupT[k]=1;});\nP('duplicate titles within a checklist',dups.length+(d" +
  "ups.length?': '+dups.slice(0,4).join(', '):''));\nvar blanks=items.filter" +
  "(function(x){return countBlanks(x.i.a)>0;});\nP('items with ( ) blanks',b" +
  "lanks.length);\nvar ordShape=items.filter(function(x){return (x.i.s||[])." +
  "some(function(o){return !/^(\\d+\\.\\d|SPS )/.test(o);});});\nP('odd-looking" +
  " ordinance strings',ordShape.length+(ordShape.length?': '+ordShape.map(f" +
  "unction(x){return x.i.s.join('/');}).slice(0,5).join(', '):''));\nvar lon" +
  "gT=items.filter(function(x){return x.i.a.length>1200;});\nP('very long co" +
  "rrective texts (>1200 ch)',longT.length);\n\nH('DEPOSIT SCHEDULE');\nP('row" +
  "s',DEPOSITS.length);\nvar dupO=[],seen={};\nDEPOSITS.forEach(function(f){i" +
  "f(seen[f.ordinance])dupO.push(f.ordinance);seen[f.ordinance]=1;});\nP('du" +
  "plicate ordinances',dupO.length+(dupO.length?': '+dupO.join(', '):''));\n" +
  "P('rows with no tier ladder',DEPOSITS.filter(function(f){return !f.tiers" +
  "||!f.tiers.length;}).length);\nvar badTier=DEPOSITS.filter(function(f){re" +
  "turn (f.tiers||[]).some(function(t){return !(t.amountCents>0)||!t.ordina" +
  "l;});});\nP('malformed tiers',badTier.length);\nvar nonAsc=DEPOSITS.filter" +
  "(function(f){var t=f.tiers||[];for(var n=1;n<t.length;n++)if(t[n].amount" +
  "Cents<t[n-1].amountCents)return true;return false;});\nP('non-ascending l" +
  "adders',nonAsc.length+(nonAsc.length?': '+nonAsc.map(function(f){return " +
  "f.ordinance;}).join(', '):''));\nP('missing description',DEPOSITS.filter(" +
  "function(f){return !f.description;}).length);\n\nH('LIBRARY -> DEPOSIT COV" +
  "ERAGE');\nvar secs={};items.forEach(function(x){(x.i.s||[]).forEach(funct" +
  "ion(o){secs[o]=1;});});\nvar all=Object.keys(secs),ex=0,fb=0,none=[];\nall" +
  ".forEach(function(o){var f=lookupForf([o]);if(!f)none.push(o);else if(f." +
  "exact)ex++;else fb++;});\nP('distinct ordinances in the library',all.leng" +
  "th);\nP('  exact schedule entry',ex);\nP('  chapter fallback',fb);\nP('  no" +
  " deposit path',none.length+': '+none.join(', '));\n\nH('INSPECTORS');\nP('c" +
  "ount',INSPECTORS.length);\nvar ids={},ems={},bad=0;\nINSPECTORS.forEach(fu" +
  "nction(x){\n  if(ids[x.id])bug('duplicate inspector id '+x.id);ids[x.id]=" +
  "1;\n  if(ems[x.email])bug('duplicate email '+x.email);ems[x.email]=1;\n  i" +
  "f(!/^[a-z0-9.\\-]+@cityofmadison\\.com$/.test(x.email))bug('odd email '+x." +
  "email);\n  if(!/^\\(608\\) \\d{3}-\\d{4}$/.test(x.phone))bug('odd phone for '" +
  "+x.name+': '+x.phone);\n  if(x.badge&&!/^\\d{4}$/.test(x.badge))bug('odd b" +
  "adge for '+x.name+': '+x.badge);\n});\nP('without a badge',INSPECTORS.filt" +
  "er(function(x){return !x.badge;}).map(function(x){return x.name;}).join(" +
  "', '));\nvar dupB={},dupBadge=[];\nINSPECTORS.forEach(function(x){if(!x.ba" +
  "dge)return;if(dupB[x.badge])dupBadge.push(x.badge);dupB[x.badge]=1;});\nP" +
  "('duplicate badges',dupBadge.length?dupBadge.join(', '):'none');\n\nH('SEE" +
  "D CASES');\nWriterState.CASES.forEach(function(k){\n  if(!k.number||!k.add" +
  "ress)bug('case '+k.id+' missing number or address');\n  if(!insp(k.inspec" +
  "torId).name)bug('case '+k.number+' points at a missing inspector: '+k.in" +
  "spectorId);\n  var o=ownerLines(k);\n  if(o.length<3)bug('case '+k.number+" +
  "' mailing block has only '+o.length+' line(s)');\n});\nP('cases',WriterSta" +
  "te.CASES.length);\nP('all inspectors resolve',WriterState.CASES.every(fun" +
  "ction(k){return !!insp(k.inspectorId).name;}));\n\nconsole.log('\\n'+(issue" +
  "s.length?issues.length+' DATA ISSUE(S)':'no data issues'));\n";
eval(src + "\n;;\n" + T);
