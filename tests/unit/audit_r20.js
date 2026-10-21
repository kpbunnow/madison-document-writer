/* R20 state-name, freezing, and archived-copy UI regressions. */
globalThis.MADISON_TEST_DATA = true;
const { JSDOM } = require("jsdom");
const { builtPage, bundleSource } = require("../fixtures/built_bundle.cjs");
const html = builtPage(),
  payload = bundleSource(html);
const dom = new JSDOM('<!doctype html><html><body><div id="app"></div><div id="overlay"></div><div id="toast"></div></body></html>', {
  url: "http://127.0.0.1:8777/",
  pretendToBeVisual: true,
});
const w = dom.window;
global.window = w;
global.document = w.document;
global.getSelection = () => w.getSelection();
global.confirm = () => false;
global.URL = { createObjectURL: () => "blob:qa", revokeObjectURL() {} };
global.Blob = function () {};
w.scrollTo = () => {};
const run = async () => {
  let count = 0;
  const ok = (name, condition) => {
    count++;
    if (!condition) throw Error("FAIL " + name);
  };
  for (const [name, abbr] of Object.entries(STATE_NAMES)) {
    for (const separator of [", ", " "]) {
      const city = "Charleston";
      ok(name + " " + separator, standardCityStateZip(city + separator + name + " 25301") === "Charleston, " + abbr + " 25301");
    }
    ok(abbr, standardCityStateZip("Charleston, " + abbr.toLowerCase() + " 25301-1234") === "Charleston, " + abbr + " 25301-1234");
  }
  ok("West Virginia without comma", standardCityStateZip("Charleston West Virginia 25301") === "Charleston, WV 25301");
  ok("West Virginia with comma", standardCityStateZip("Charleston, West Virginia 25301") === "Charleston, WV 25301");
  ok("New York not York", standardCityStateZip("New York New York 10001") === "New York, NY 10001");
  for (const invalid of [
    "Charleston, West Virgin 25301",
    "Charleston VirginiaWest 25301",
    "Charleston, XX 25301",
    "Charleston West Virginia 2530",
    "Charleston, West Virginia 2530112345",
    "Charleston, West Virginia, Virginia 25301",
  ]) {
    ok("malformed/ambiguous " + invalid, !standardCityStateZip(invalid));
  }
  ok("units and street abbreviations", standardStreetAddress("123 North Main Street, Apartment 4") === "123 N Main St Apt 4");
  const recipients = [
    { name: "One", addr: "123 North Main Street", city: "Charleston, West Virginia 25301" },
    { name: "Two", addr: "no number", city: "Charleston, West Virginia 25301" },
  ];
  ok(
    "validation is atomic on a later invalid copy",
    !!validateAndStandardizeAddresses({ ccList: recipients, agent: {} }, false) && recipients[0].city === "Charleston, West Virginia 25301",
  );
  const k = kase("k1");
  k.ccList = [{ name: "Jane", addr: "123 North Main Street", city: "Charleston West Virginia 25301" }];
  newDoc("k1", "notice");
  const d = doc(WriterState.state.docId);
  d.items = [
    { id: "qa-addr-item", no: "1", sections: ["27.05(2)(c)"], title: "Test", text: "Repair wall", due: futureDue(iso(today), 30), prov: "notice" },
  ];
  issueDocument(d);
  const issued = doc(d.id);
  ok(
    "new issued copy freezes normalized address",
    issued.frozen.case.ccList[0].city === "Charleston, WV 25301" && issued.frozen.case.ccList[0].addr === "123 N Main St",
  );
  ok(
    "new issued document prints normalized address",
    documentHTML(issued).includes("Charleston, WV 25301") && documentHTML(issued).includes("123 N Main St"),
  );
  const ev = eventsFor("k1").find((e) => (e.payload || {}).snapshot?.id === d.id);
  ev.payload.snapshot.frozen.case.ccList[0].addr = "123 North Main Street";
  ev.payload.snapshot.frozen.case.ccList[0].city = "Charleston, West Virginia 25301";
  project();
  ok(
    "historical frozen display remains verbatim",
    documentHTML(doc(d.id)).includes("123 North Main Street") && documentHTML(doc(d.id)).includes("Charleston, West Virginia 25301"),
  );
  const raw = Buffer.from("%PDF-R20 archived exact bytes\n");
  const hash = "a".repeat(64);
  const filename = documentFileName(doc(d.id)) + ".pdf";
  appendEvent("k1", "document.filed", { docId: d.id, filename, sha256: hash, reference: filename });
  project();
  let requested = null,
    opened = null;
  WriterState.HELPER = { ok: true };
  global.fetch = async (url, opts) => {
    requested = { url, body: JSON.parse(opts.body) };
    return { json: async () => ({ ok: true, pdf: raw.toString("base64") }) };
  };
  w.open = (url) => {
    opened = url;
    return {};
  };
  const before = doc(d.id).frozen.case.ccList[0].addr;
  ok(
    "verified archive is chosen without re-rendering",
    (await openIssuedCopy(doc(d.id))) === true &&
      requested.url === "/artifact/read" &&
      requested.body.sha256 === hash &&
      opened === "blob:qa" &&
      doc(d.id).frozen.case.ccList[0].addr === before,
  );
  let reconstructed = "";
  const priorPrint = printNotice;
  printNotice = (job) => {
    reconstructed = job.html;
  };
  global.confirm = () => true;
  global.fetch = async () => ({ json: async () => ({ ok: false, error: "Missing archived PDF" }) });
  await openIssuedCopy(doc(d.id));
  printNotice = priorPrint;
  ok(
    "missing exact PDF is explicitly labeled if reconstruction is chosen",
    reconstructed.includes("RECONSTRUCTED COPY — NOT VERIFIED ORIGINAL ISSUED PDF"),
  );
  console.log("R20 client checks: " + count + " assertions, 0 failures.");
  process.exit(0);
};
eval(payload + "\n(" + run.toString() + ")().catch(e=>{console.error(e);process.exit(1);});");
