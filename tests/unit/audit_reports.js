globalThis.MADISON_TEST_DATA = true;
// Reporting, reports side. Fed with summaries written by the real Document
// Writer (mk_summaries.js) plus hand-built ones whose counts are known.
// Consolidation Phase 2 (T1): run remaining long UI timers once the suite completes instead of waiting.
const { settle } = require("../fixtures/settle_ui_timers.cjs");
const fs = require("fs"),
  cp = require("child_process");
const { JSDOM } = require("jsdom");
cp.execFileSync("node", ["tests/fixtures/mk_summaries.js"], { cwd: require("path").resolve(__dirname, "../.."), stdio: "ignore" });
const REAL = JSON.parse(fs.readFileSync("/tmp/real_summaries.json", "utf8"));
const { builtPage, bundleSource } = require("../fixtures/built_bundle.cjs");
const html = builtPage("reports"),
  src = bundleSource(html);
const CSS = [...html.matchAll(/<style>([\s\S]*?)<\/style>/g)].map((m) => m[1]).join("\n");
const dom = new JSDOM("<!doctype html><html><head><style>" + CSS + '</style></head><body><div id="app"></div></body></html>', {
  pretendToBeVisual: true,
  url: "http://127.0.0.1:8777/madison-reports.html",
});
const w = dom.window;
global.window = w;
global.document = w.document;
global.location = w.location;
global.Blob = function (p) {
  this.p = p;
};
global.URL = { createObjectURL: () => "b", revokeObjectURL() {} };
w.scrollTo = () => {};

// ---- fixtures -------------------------------------------------------------
function mk(no, o) {
  return {
    format: "madison-case-summary",
    summaryVersion: o.ver == null ? 6 : o.ver,
    schema: 3,
    build: "x",
    written: "2026-09-18T10:00:00Z",
    eventCount: 3,
    case: Object.assign(
      {
        number: no,
        address: o.address || "1 " + no + " ST",
        siteCity: o.siteCity || "",
        zip: o.zip || "",
        parcel: o.parcel || "",
        inspector: o.inspector || "TEST INSPECTOR",
        opened: o.opened,
        noticeIssued: o.noticeIssued == null ? o.opened : o.noticeIssued,
        status: o.status,
        closedOn: o.closedOn || "",
        owner: o.owner || "OWNER " + no,
        ownerAddr: o.ownerAddr || ["9 " + no + " RD", "MADISON, WI 53704"],
      },
      {},
    ),
    violations: (o.v || []).map((v, i) =>
      Object.assign(
        {
          no: String(i + 1),
          title: "T" + (i + 1),
          sections: ["27.05(2)(c)"],
          type: "X/Y/1",
          typeLabel: "Type A",
          typeHow: "library",
          due: "",
          done: false,
          doneOn: "",
          lastOutcome: "",
          visits: 0,
          cited: 0,
        },
        v,
      ),
    ),
    visits: o.visits || [],
    documents: o.documents || [],
    citations: o.citations || [],
    referrals: o.referrals || [],
  };
}
const T1 = mk("T1", {
  parcel: "1111-111-1111-1",
  opened: "2026-01-15",
  noticeIssued: "2026-01-16",
  status: "Notice",
  owner: "ACME LLC",
  ownerAddr: ["% UPM", "516 E WASHINGTON AVE", "MADISON WI 53703"],
  v: [{}, {}],
});
const T2 = mk("T2", {
  parcel: "222222222222",
  opened: "2026-05-10",
  status: "Cited",
  owner: "O'NEIL & <SONS>",
  ownerAddr: ["516 East Washington Avenue", "Madison, WI 53703-1234"],
  v: [
    { done: true, doneOn: "2026-06-09", lastOutcome: "corrected", visits: 1 },
    { type: "X/Y/2", typeLabel: "Type B" },
  ],
  citations: [
    {
      num: "B00000000001",
      no: "2",
      ordinance: "27.05(2)(c)",
      desc: "X",
      issued: "2026-06-01",
      courtDate: "2026-07-01",
      amount: 197,
      tier: "1st",
      by: "TEST INSPECTOR",
    },
  ],
  visits: [
    {
      date: "2026-06-09",
      inspector: "TEST INSPECTOR",
      results: [
        { no: "1", oc: "corrected" },
        { no: "2", oc: "none" },
      ],
    },
  ],
  documents: [
    { id: "d1", type: "notice", label: "Official Notice", issued: "2026-05-10", by: "TEST INSPECTOR", void: false, voidReason: "", replaces: "" },
    { id: "d2", type: "citation", label: "Citation", issued: "2026-05-20", by: "TEST INSPECTOR", void: true, voidReason: "wrong date", replaces: "" },
    { id: "d3", type: "citation", label: "Citation", issued: "2026-06-01", by: "TEST INSPECTOR", void: false, voidReason: "", replaces: "d2" },
  ],
});
const T3 = mk("T3", { opened: "2025-12-01", status: "Closed", closedOn: "2026-01-05", zip: "53711", v: [{ done: true, doneOn: "2026-01-05" }] });
const T4 = mk("T4", { parcel: "444444444444", opened: "2026-02-01", noticeIssued: "", status: "Not issued" });
const T5 = mk("T5", { ver: 6, opened: "2026-07-01", status: "Notice", ownerAddr: [], v: [{ type: "X/Y/2", typeLabel: "Type B" }] });
const TOLD = mk("TOLD", { ver: 0, opened: "2026-07-01", status: "Notice", v: [{}] });
const SUMS = REAL.concat([T1, T2, T3, T4, T5, TOLD]);

const sq = (x0, y0, x1, y1) => [
  [x0, y0],
  [x1, y0],
  [x1, y1],
  [x0, y1],
  [x0, y0],
];
const AREAS = {
  ok: true,
  notes: [],
  districtsDate: "2026-09-01",
  districts: {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        properties: { OBJECTID: 1, ALD_DIST: 6, NAME: "Six" },
        geometry: { type: "Polygon", coordinates: [sq(-89.37, 43.06, -89.3, 43.12)] },
      },
      {
        type: "Feature",
        properties: { OBJECTID: 2, ALD_DIST: 10, NAME: "Ten" },
        geometry: { type: "Polygon", coordinates: [sq(-89.53, 43.02, -89.45, 43.08)] },
      },
    ],
  },
  zips: {
    type: "FeatureCollection",
    features: [{ type: "Feature", properties: { ZIP5: "53703" }, geometry: { type: "Polygon", coordinates: [sq(-89.4, 43.05, -89.3, 43.13)] } }],
  },
};
const CACHED = {
  "070822219103": {
    history: [
      { fetched: "2026-01-01", alder: 9, building: 3, lat: 43.05, lon: -89.5 },
      { fetched: "2026-06-01", alder: 10, building: 3, lat: 43.05, lon: -89.5 },
    ],
  },
  111111111111: { history: [{ fetched: "2026-01-01", alder: 6, building: 1, lat: 43.08, lon: -89.33 }] },
  222222222222: { history: [{ fetched: "2026-01-01", alder: 6, building: 1, lat: 43.09, lon: -89.34 }] },
  444444444444: { history: [{ fetched: "2026-01-01", alder: 6, building: 1, lat: 43.09, lon: -89.34 }] },
};
const POSTED = [];
let FAIL = false;
global.fetch = w.fetch = async (u, o) => {
  const R = (j) => ({ ok: true, status: 200, json: async () => JSON.parse(JSON.stringify(j)) });
  if (FAIL) throw new Error("connection refused");
  if (u === "/reporting/index")
    return R({
      ok: true,
      caseDir: "S:\\Case JSON Files",
      summaries: SUMS,
      unreadable: [],
      missing: ["9 NOWHERE - CB-MISSING.json"],
      stale: [],
      readAt: "2026-09-18T10:00:00",
    });
  if (u === "/reporting/parcels" && !o?.method) return R({ ok: true, parcels: CACHED, missing: [] });
  if (u === "/reporting/parcels") {
    const b = JSON.parse(o.body);
    POSTED.push(b);
    return R({
      ok: true,
      error: "",
      invalid: [],
      parcels: { "071036411518": { history: [{ fetched: "2026-02-01", alder: 6, building: 2, lat: 43.09, lon: -89.35 }] } },
      missing: ["070913305114"],
    });
  }
  if (u === "/reporting/areas") return R(AREAS);
  throw new Error("unexpected " + u);
};

const T =
  "\nvar fails=[];\nfunction H(t){console.log('\\n=== '+t+' ===');}\nfunction o" +
  "k(l,c,x){console.log('  '+(c?'ok   ':'FAIL ')+l+(x!==undefined?'   '+x:'" +
  "'));if(!c)fails.push(l);}\nfunction click(el){el.dispatchEvent(new window" +
  ".MouseEvent('click',{bubbles:true}));}\nfunction change(el,v){el.value=v;" +
  "el.dispatchEvent(new window.Event('change',{bubbles:true}));}\nconst $=s=" +
  ">document.querySelector(s),$$=s=>Array.from(document.querySelectorAll(s)" +
  ");\n// asOf is today: the writer-made fixtures are issued today, whatever" +
  " day the suite runs\nconst setF=o=>{Object.assign(ReportsState.S.F,{from:" +
  "'2026-01-01',to:(TODAY>'2026-12-31'?TODAY:'2026-12-31'),asOf:TODAY,areaT" +
  "ype:'district',boundary:'current',\n  areas:[],inspector:'',vtype:'',ord:" +
  "'',status:'',owner:''},o||{});ReportsState.S.drill=null;};\nconst run=(id" +
  ",o)=>{setF(o);return reportById(id).run(ReportsState.S.M,ReportsState.S." +
  "F);};\nconst rowOf=(res,label)=>res.rows.map(r=>r.cells||r).find(r=>(type" +
  "of r[0]==='string'?r[0]:(r[0]&&r[0].text))===label);\nconst N=x=>x&&typeo" +
  "f x==='object'?x.n:x;\n\n(async function(){\nH('Owner key');\nok('name line " +
  "skipped',ownerKey(['HANIF, JAWAD','1910 LEWON DR','MADISON, WI 53711'])=" +
  "=='1910 LEWON DR|53711');\nok('PO box',ownerKey(['PO BOX 555','MONROE, WI" +
  " 53566'])==='PO BOX 555|53566');\nok('P.O. Box spelled otherwise',ownerKe" +
  "y(['P.O. Box 555','Monroe WI 53566'])==='PO BOX 555|53566');\nok('care-of" +
  " block and long form key alike',ownerKey(['% UPM','516 E WASHINGTON AVE'" +
  ",'MADISON WI 53703'])===ownerKey(['516 East Washington Avenue','Madison," +
  " WI 53703-1234']));\nok('unit markers agree',ownerKey(['12 Main St #3','M" +
  "adison WI 53703'])===ownerKey(['12 MAIN STREET APT 3','MADISON, WI 53703" +
  "'])&&\n  ownerKey(['12 Main St Unit 3','Madison WI 53703'])===ownerKey(['" +
  "12 Main St Suite 3','Madison WI 53703']));\nok('street type matters',owne" +
  "rKey(['12 MAIN ST','MADISON WI 53703'])!==ownerKey(['12 MAIN AVE','MADIS" +
  "ON WI 53703']));\nok('direction matters',ownerKey(['12 N MAIN ST','MADISO" +
  "N WI 53703'])!==ownerKey(['12 S MAIN ST','MADISON WI 53703']));\nok('hous" +
  "e number matters',ownerKey(['12 MAIN ST','MADISON WI 53703'])!==ownerKey" +
  "(['14 MAIN ST','MADISON WI 53703']));\nok('ZIP matters',ownerKey(['12 MAI" +
  "N ST','MADISON WI 53703'])!==ownerKey(['12 MAIN ST','MADISON WI 53704'])" +
  ");\nok('no ZIP, no key',ownerKey(['12 MAIN ST','MADISON WI'])==='');\nok('" +
  "no street line, no key',ownerKey(['ACME LLC','MADISON WI 53703'])==='');" +
  "\nok('one line, no key',ownerKey(['12 MAIN ST MADISON WI 53703'])===''&&o" +
  "wnerKey([])===''&&ownerKey(null)==='');\n\nH('Geometry');\nvar holed={type:" +
  "'Polygon',coordinates:[sq(0,0,10,10),sq(4,4,6,6)]};\nok('inside',polyHas(" +
  "holed,1,1));ok('outside',!polyHas(holed,11,1));ok('in the hole',!polyHas" +
  "(holed,5,5));\nok('multipolygon second part',polyHas({type:'MultiPolygon'" +
  ",coordinates:[[sq(0,0,1,1)],[sq(5,5,6,6)]]},5.5,5.5));\nok('district fiel" +
  "d found',detectField(AREAS.districts,'district')==='ALD_DIST');\nok('zip " +
  "field found',detectField(AREAS.zips,'zip')==='ZIP5');\nok('a name field i" +
  "s not taken for a district',detectField({features:[{properties:{DISTRICT" +
  "_NAME:'Six'}}]},'district')==='');\n\nawait new Promise(r=>setTimeout(r,60" +
  "));\nH('Loading');\nok('ready',ReportsState.S.phase==='ready',ReportsState" +
  ".S.phase+' '+ReportsState.S.error);\nok('only uncached parcels were looke" +
  "d up',POSTED.length===1&&POSTED[0].ids.slice().sort().join()==='07091330" +
  "5114,071036411518'&&!POSTED[0].refresh,JSON.stringify(POSTED));\nok('real" +
  " writer summaries parsed',ReportsState.S.M.byNo['CB2026-238-03639']&&Rep" +
  "ortsState.S.M.byNo['CB2026-238-03639'].status==='Closed');\nok('a case wi" +
  "th no issued notice is not counted',!!ReportsState.S.M.byNo.T4&&ReportsS" +
  "tate.S.M.counted.indexOf(ReportsState.S.M.byNo.T4)<0);\nok('district now " +
  "and when opened',ReportsState.S.M.byNo['CB2026-238-03639'].alderNow==='1" +
  "0'&&ReportsState.S.M.byNo['CB2026-238-03639'].alderAtOpen==='9');\nok('ZI" +
  "P from the outline when Accela had none',ReportsState.S.M.byNo['CB2026-2" +
  "16-03297'].zip==='53703');\nok('ZIP from the case wins',ReportsState.S.M." +
  "byNo.T3.zip==='53711');\nok('parcel not on the city layer is unlocated',!" +
  "ReportsState.S.M.byNo['CB2026-239-03712'].located&&ReportsState.S.M.byNo" +
  "['CB2026-239-03712'].looked);\nok('an older summary format is flagged',Re" +
  "portsState.S.M.versionStale.join()==='TOLD'&&!ReportsState.S.M.byNo.TOLD" +
  ");\n\nH('Correction and withdrawal effective dates');\nvar historical={noti" +
  "ceIssued:'2026-01-01',status:'Withdrawn',documents:[\n {id:'old',type:'no" +
  "tice',issued:'2026-01-01',effectiveFrom:'2026-01-01',effectiveTo:'2026-0" +
  "2-01',superseded:true},\n {id:'new',type:'notice',issued:'2026-01-01',eff" +
  "ectiveFrom:'2026-02-01',effectiveTo:'2026-03-01',void:true,voidAt:'2026-" +
  "03-01',allWithdrawn:true}]};\nvar hv={done:false,withdrawn:true,type:'new" +
  "-type',history:[\n {issued:'2026-01-01',effectiveFrom:'2026-01-01',effect" +
  "iveTo:'2026-02-01',done:false,withdrawn:false,key:'old-type'},\n {issued:" +
  "'2026-02-01',effectiveFrom:'2026-02-01',effectiveTo:'2026-03-01',void:tr" +
  "ue,voidAt:'2026-03-01',done:false,withdrawn:true,key:'new-type'}]};\nok('" +
  "January retains the notice that was then effective',openAt(historical,'2" +
  "026-01-31')&&statusAt(historical,'2026-01-31')==='Notice');\nok('Administ" +
  "rative withdrawal is not compliance',!openAt(historical,'2026-02-01')&&s" +
  "tatusAt(historical,'2026-02-01')==='Withdrawn');\nok('March withdrawal do" +
  "es not erase January',statusAt(historical,'2026-03-01')==='Not issued'&&" +
  "openAt(historical,'2026-01-15'));\nok('Violation stays open before its la" +
  "ter withdrawal',violOpenAt(hv,'2026-01-31')&&!violOpenAt(hv,'2026-02-01'" +
  "));\nok('Historical ordinance classification is retained',violationAt(hv," +
  "'2026-01-31').type==='old-type');\n\nH('1. Open cases by area');\nvar r=run" +
  "('openCases');\nok('District 6: three open, one referred',N(rowOf(r,'Dist" +
  "rict 6')[1])===3&&N(rowOf(r,'District 6')[3])===1);\nok('Unlocated: two'," +
  "N(rowOf(r,'Unlocated')[1])===2);\nok('closed cases are not open',!rowOf(r" +
  ",'District 10'));\nok('total five',N(r.total[1])===5);\nok('Unlocated sort" +
  "s last',(r.rows[r.rows.length-1].cells||r.rows[r.rows.length-1])[0]==='U" +
  "nlocated');\nr=run('openCases',{asOf:'2026-02-01'});\nok('as of an earlier" +
  " date: T1 and T3 closed after',N(r.total[1])===1&&rowOf(r,'District 6')," +
  "JSON.stringify(r.total[1]));\nr=run('openCases',{areas:['6']});\nok('area " +
  "filter',N(r.total[1])===3&&r.rows.length===1);\n\nH('2. Cases by inspector" +
  "');\nr=run('byInspector');\nok('six cases opened in 2026',N(r.total[r.tota" +
  "l.length-1])===6);\nok('matrix has a column per area plus total',r.cols.l" +
  "ength===1+3+1&&r.cols.indexOf('District 10')>0,JSON.stringify(r.cols));\n" +
  "var ti=rowOf(r,'TEST INSPECTOR');\nok('the test inspector has three (T1, " +
  "T2, T5)',ti&&N(ti[ti.length-1])===3);\nr=run('byInspector',{inspector:'TE" +
  "ST INSPECTOR'});\nok('inspector filter',N(r.total[r.total.length-1])===3&" +
  "&r.rows.length===1);\n\nH('3. Open violations by area');\nr=run('openViolat" +
  "ions');\nok('District 6: five open items on three cases',N(rowOf(r,'Distr" +
  "ict 6')[1])===5&&N(rowOf(r,'District 6')[2])===3,JSON.stringify(rowOf(r," +
  "'District 6')));\nok('total eight',N(r.total[1])===8);\nr=run('openViolati" +
  "ons',{vtype:'X/Y/2'});\nok('type filter: Type B only',N(r.total[1])===2);" +
  "\n\nH('4. All cases');\nr=run('allCases');\nok('six in the period, T3 opened" +
  " in 2025 is out',N(r.total[1])===6);\nok('cited two, referred one',N(r.to" +
  "tal[r.cols.indexOf('Cited')])===2&&N(r.total[r.cols.indexOf('Referred')]" +
  ")===1);\nok('District 10 one closed',N(rowOf(r,'District 10')[1])===1&&N(" +
  "rowOf(r,'District 10')[3])===1);\nr=run('allCases',{boundary:'atOpen'});\n" +
  "ok('boundaries when opened: District 9',!!rowOf(r,'District 9')&&!rowOf(" +
  "r,'District 10'));\nr=run('allCases',{areaType:'zip'});\nok('by ZIP: 53703" +
  " three, Unlocated three',N(rowOf(r,'53703')[1])===3&&N(rowOf(r,'Unlocate" +
  "d')[1])===3);\nr=run('allCases',{status:'open'});\nok('open status filter'" +
  ",N(r.total[1])===5);\nr=run('allCases',{ord:'27.05(2)(f)'});\nok('ordinanc" +
  "e filter keeps cases with that section',N(r.total[1])===3,N(r.total[1]))" +
  ";\n\nH('5. All violations');\nr=run('allViolations');\nok('Type A and Type B" +
  " rows',!!rowOf(r,'Type A')&&!!rowOf(r,'Type B'));\nok('Type A: T1 two + T" +
  "2 one',N(rowOf(r,'Type A')[1])===3);\nok('real unclassified types present" +
  "',!!rowOf(r,'Unclassified: 27.05(2)(f)'));\nok('total eleven (T5 has one " +
  "item)',N(r.total[1])===11,N(r.total[1]));\n\nH('6. Days to compliance');\nr" +
  "=run('daysToCompliance');\nvar ta=rowOf(r,'Type A');\nok('Type A: one corr" +
  "ected in 30 days',N(ta[2])===1&&N(ta[3])===30&&N(ta[4])===30,JSON.string" +
  "ify(ta.map(N)));\nvar tf=rowOf(r,'Unclassified: 27.05(2)(f)');\nok('the re" +
  "al closed case: 19 days from the initial inspection',tf&&N(tf[3])===19,J" +
  "SON.stringify(tf&&tf.map(N)));\n\nH('7. Repeat cases by owner');\nr=run('re" +
  "peatOwners');\nvar own=r.rows.find(x=>x[0]&&x[0].owner==='516 E WASHINGTO" +
  "N AVE|53703');\nok('a manager address groups three owners, every name sho" +
  "wn',own&&N(own[2])===3&&own[0].text.split('; ').sort().join('|')===\"ACME" +
  " LLC|ESPESETH FAMILY TRUST|O'NEIL & <SONS>\",JSON.stringify(own&&own[0]))" +
  ";\nvar un=r.rows.find(x=>x.dim);\nok('unmatched listed separately',un&&N(u" +
  "n.cells[2])===1);\n\nH('8. Citations by ordinance');\nr=run('citations');\no" +
  "k('two citations',N(r.total[1])===2);\nok('27.05(2)(c): one, $197',N(rowO" +
  "f(r,'27.05(2)(c)')[1])===1&&N(rowOf(r,'27.05(2)(c)')[rowOf(r,'27.05(2)(c" +
  ")').length-1])===197);\nr=run('citations',{ord:'27.05(2)(c)'});\nok('ordin" +
  "ance filter',r.rows.length===1&&N(r.total[1])===1);\nr=run('citations',{f" +
  "rom:'2026-06-02'});\nok('period on the issue date',N(r.total[1])===1,N(r." +
  "total[1]));\n\nH('9. Referrals');\nr=run('referrals');\nok('one referral, th" +
  "e real one',r.rows.length===1&&r.rows[0][1].kase==='CB2026-216-03297');\n" +
  "\nH('10. R26 document actions');\nvar preNotice={...ReportsState.S.M.byNo." +
  "T4};preNotice.number='R26-PRE-NOTICE';preNotice.documents=[{id:'r26-init" +
  "ial-order',type:'summaryAbatement',label:'Summary Abatement',issued:TODA" +
  "Y,by:'TEST INSPECTOR'}];\nvar scoped={...ReportsState.S.M.byNo.T2};scoped" +
  ".number='R26-SCOPED';scoped.documents=[\n {id:'r26-void',type:'noOccupanc" +
  "y',label:'No Occupancy',issued:TODAY,by:'TEST INSPECTOR',void:true},\n {i" +
  "d:'r26-old',type:'noOccupancy',label:'No Occupancy',issued:TODAY,by:'TES" +
  "T INSPECTOR',superseded:true},\n {id:'r26-current',type:'noOccupancy',lab" +
  "el:'No Occupancy',issued:TODAY,by:'TEST INSPECTOR'},\n {id:'r26-ref-updat" +
  "e',type:'referralUpdate',label:'Update for Case Referral',issued:TODAY,b" +
  "y:'TEST INSPECTOR'}];\nsetF();var actionModel={...ReportsState.S.M,cases:" +
  "[preNotice,scoped]},ar=reportById('documentActions').run(actionModel,Rep" +
  "ortsState.S.F);\nok('Includes an initial order without counting another c" +
  "ase opening',N(rowOf(ar,'Summary Abatement')[1])===1&&ReportsState.S.M.c" +
  "ounted.indexOf(ReportsState.S.M.byNo.T4)<0);\nok('Correction and withdraw" +
  "al do not duplicate current actions',N(rowOf(ar,'No Occupancy')[1])===1&" +
  "&N(ar.total[1])===3);\nok('Referral update stays in its existing family'," +
  "N(rowOf(ar,'Referral for Prosecution')[1])===1);\nsetF({inspector:'ANOTHE" +
  "R INSPECTOR'});ok('New-family counts follow issuing inspector',N(reportB" +
  "yId('documentActions').run(actionModel,ReportsState.S.F).total[1])===0);" +
  "setF();\n\nH('Screens, drill-through and escaping');\nsetF();ReportsState.S" +
  ".screen='allCases';ReportsState.S.view='table';render();\nok('filters bar" +
  " and table drawn',!!$('#f-from')&&!!$('table.rep'));\nvar b=$$('button[da" +
  "ta-drill]').find(x=>x.closest('tr').firstElementChild.textContent==='Dis" +
  "trict 6');\nok('count cell is a button',!!b);\nif(b)click(b);\nok('drill pa" +
  "nel lists the three cases',ReportsState.S.drill&&ReportsState.S.drill.id" +
  "s.length===3&&$$('#drill tbody tr').length===3);\nok('count cells carry a" +
  " bar',$$('td.bar').length>0);\nchange($('#f-from'),'2026-05-01');\nok('cha" +
  "nging a filter re-runs the report',N(ReportsState.S.rep.res.total[1])===" +
  "2&&!ReportsState.S.drill,N(ReportsState.S.rep.res.total[1]));\nchange($('" +
  "#f-from'),'2026-0');\nok('a half-typed date is ignored',ReportsState.S.F." +
  "from==='2026-05-01');\nsetF();click($('button[data-screen=\"repeatOwners\"]" +
  "'));\nok('owner names are escaped',document.body.innerHTML.indexOf('&lt;S" +
  "ONS&gt;')>0&&!document.querySelector('sons'));\nclick($('button[data-owne" +
  "r=\"516 E WASHINGTON AVE|53703\"]'));\nok('owner view',ReportsState.S.scree" +
  "n==='owner'&&$$('.panel tbody tr').length===3);\nclick($('button[data-act" +
  "=\"useOwner\"]'));\nok('filter reports to the owner',ReportsState.S.F.owner" +
  "==='516 E WASHINGTON AVE|53703'&&ReportsState.S.screen==='allCases'&&N(R" +
  "eportsState.S.rep.res.total[1])===3);\nclick($('button[data-act=\"clearFil" +
  "ters\"]'));ok('owner filter cleared',!ReportsState.S.F.owner);\nclick($('b" +
  "utton[data-screen=\"property\"]'));$('#pv-q').value='2222-222-2222-2';clic" +
  "k($('button[data-act=\"propGo\"]'));\nok('property found by dashed parcel'," +
  "ReportsState.S.prop.hits.length===1&&$$('.card-case').length===1);\nok('t" +
  "he void citation is shown struck',!!$('.timeline .void'));\nok('citation " +
  "listed on its item',document.body.innerHTML.indexOf('B00000000001')>0);\n" +
  "click($('button[data-screen=\"data\"]'));\nvar t=document.body.textContent;" +
  "\nok('data view: missing summary named',t.indexOf('CB-MISSING')>0);\nok('d" +
  "ata view: stale format named',t.indexOf('TOLD (earlier summary format)')" +
  ">0);\nok('data view: unlocated reasons',t.indexOf('not on the city parcel" +
  " layer')>0&&t.indexOf('T3, 1 T3 ST: no parcel on the case')>0);\nok('data" +
  " view: district field reported',t.indexOf('ALD_DIST')>0);\n\nH('Every scre" +
  "en renders');\nvar junk=function(s){return ['undefined','NaN','[object']." +
  "filter(function(w){return s.indexOf(w)>=0;}).join(',');};\nvar bad=[];\nRE" +
  "PORTS.forEach(function(rp){['table','map'].forEach(function(v){try{setF(" +
  ");ReportsState.S.screen=rp.id;ReportsState.S.view=v;render();var j=junk(" +
  "$('#app').textContent);\n  if(!$('.panel')||j)bad.push(rp.id+'/'+v+' '+j)" +
  ";}catch(e){bad.push(rp.id+'/'+v+': '+e.message);}});});\n['property','own" +
  "er','data'].forEach(function(sc){try{ReportsState.S.screen=sc;ReportsSta" +
  "te.S.view='table';render();var j=junk($('#app').textContent);if(j)bad.pu" +
  "sh(sc+' '+j);}catch(e){bad.push(sc+': '+e.message);}});\nsetF({areaType:'" +
  "zip'});REPORTS.forEach(function(rp){try{ReportsState.S.screen=rp.id;Repo" +
  "rtsState.S.view='table';render();}catch(e){bad.push(rp.id+'/zip: '+e.mes" +
  "sage);}});\nok('all nine reports, both views, three look-ups and ZIP mode" +
  " render cleanly',!bad.length,bad.join('; '));\nReportsState.S.view='table" +
  "';\nH('Map');\nsetF();ReportsState.S.screen='allCases';ReportsState.S.view" +
  "='map';render();\nok('Leaflet 1.9.4 is present',!!window.L&&window.L.vers" +
  "ion==='1.9.4');\nok('the map element is drawn',!!$('#map'));\nok('map lege" +
  "nd counts located cases',/4 cases on the map, 2 not located/.test($('.le" +
  "gend').textContent),$('.legend').textContent);\nok('districts can be shad" +
  "ed',/Shading is this report/.test($('.legend').textContent));\nok('map po" +
  "ints are the report points',ReportsState.S.rep.res.points.length===6);\nR" +
  "eportsState.S.view='table';\n\nH('Excel');\nsetF();\nvar sheets=exportSheets" +
  "(),wb=workbook(sheets);\nok('eighteen sheets including override audit and" +
  " document actions',wb.names.length===18,wb.names.join(' | '));\nok('sheet" +
  " names are legal',wb.names.every(n=>n.length<=31&&!/[\\[\\]:*?\\/\\\\]/.test(" +
  "n)));\nrequire('fs').writeFileSync('/tmp/rep.xlsx',Buffer.from(wb.bytes))" +
  ";\nvar py=require('child_process').spawnSync('python3',['-c',[\n 'import o" +
  "penpyxl,json,datetime',\n 'wb=openpyxl.load_workbook(\"/tmp/rep.xlsx\")',\n " +
  "'c=wb[\"Cases\"];hdr=[x.value for x in c[1]]',\n 'rows={r[0].value:r for r " +
  "in c.iter_rows(min_row=2)}',\n 't2=rows.get(\"T2\")',\n 'cit=wb[\"Citations\"]" +
  ';cr=[r for r in cit.iter_rows(min_row=2) if r[0].value=="B00000000001"][' +
  "0]',\n 's4=wb[\"4 All cases\"];last=[x.value for x in list(s4.iter_rows())[" +
  "-1]]',\n 'v=wb[\"Violations\"];vr=[r for r in v.iter_rows(min_row=2) if r[0" +
  '].value=="T2" and r[3].value==1][0]\',\n \'print(json.dumps({"sheets":wb.sh' +
  'eetnames,"hdr":hdr[:3],"n":len(rows),"opened_is_date":isinstance(t2[8].v' +
  'alue,datetime.datetime),"opened":str(t2[8].value)[:10],"fmt":t2[8].numbe' +
  'r_format,\',\n \'"amount":cr[9].value,"amtfmt":cr[9].number_format,"total":' +
  'last,"days":vr[12].value,"frozen":c.freeze_panes,"owner":t2[12].value}))' +
  "'].join('\\n')],{encoding:'utf8'});\nvar X=null;try{X=JSON.parse(py.stdout" +
  ");}catch(e){}\nok('openpyxl opens the workbook',!!X,py.stderr.slice(-400)" +
  ");\nif(X){\n  ok('Cases: six rows, headers',X.n===6&&X.hdr.join()==='Case " +
  "number,Address,Parcel');\n  ok('dates are real dates',X.opened_is_date&&X" +
  ".opened==='2026-05-10'&&X.fmt==='mm/dd/yyyy',X.opened+' '+X.fmt);\n  ok('" +
  "money is numeric',X.amount===197&&X.amtfmt==='#,##0.00');\n  ok('days to " +
  "compliance is a number',X.days===30);\n  ok('summary sheet total',X.total" +
  "[0]==='All areas'&&X.total[1]===6,JSON.stringify(X.total));\n  ok('header" +
  " row frozen',X.frozen==='A2');\n  ok('text survives unescaped',X.owner===" +
  "\"O'NEIL & <SONS>\");\n}\nok('export follows the owner filter',(function(){s" +
  "etF({owner:'516 E WASHINGTON AVE|53703'});var s=exportSheets();return s[" +
  "1].rows.length===4;})());\nsetF();\nsetF({inspector:'ANOTHER INSPECTOR'});" +
  "\nok('Citation export obeys issuing inspector filter',exportSheets().find" +
  "(s=>s.name==='Citations').rows.length===1);\nsetF({inspector:'TEST INSPEC" +
  "TOR'});\nok('Citation export retains matching issuing inspector',exportSh" +
  "eets().find(s=>s.name==='Citations').rows.some(r=>r[0]==='B00000000001')" +
  ");\nsetF();\nvar crcOk=crc32(new TextEncoder().encode('123456789'))===0xCB" +
  "F43926;\nok('CRC-32 check value',crcOk);\n\nH('No server');\nFAIL=true;await" +
  " loadAll(false);\nok('says what to do',ReportsState.S.phase==='error'&&/D" +
  "ocument Writer window is open/.test(ReportsState.S.error)&&!!$('button[d" +
  "ata-act=\"reload\"]'));\nFAIL=false;await loadAll(false);\nok('recovers on r" +
  "etry',ReportsState.S.phase==='ready');\n\nconsole.log('\\n'+(fails.length?f" +
  "ails.length+' FAILURE(S): '+fails.join(' | '):'all checks passed'));\nif(" +
  "fails.length)process.exitCode=1;\n})().catch(e=>{console.log('CRASH',e&&e" +
  ".stack||e);process.exitCode=1;});\n";
global.sq = (x0, y0, x1, y1) => [
  [x0, y0],
  [x1, y0],
  [x1, y1],
  [x0, y1],
  [x0, y0],
];
global.AREAS = AREAS;
global.POSTED = POSTED;
Object.defineProperty(global, "FAIL", {
  get() {
    return FAIL;
  },
  set(v) {
    FAIL = v;
  },
});
settle(eval(src + "\n;;\n" + T), global.window);
