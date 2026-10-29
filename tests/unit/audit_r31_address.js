const fs = require("fs"),
  assert = require("assert/strict"),
  { JSDOM } = require("jsdom");
const createAddressWorkflow = require("../fixtures/address_workflow.cjs");
const dom = new JSDOM('<!doctype html><div id="app"></div><div id="overlay"></div><div id="toast"></div>', {
  url: "http://127.0.0.1:8777/",
  pretendToBeVisual: true,
});
global.window = dom.window;
global.document = dom.window.document;
global.getSelection = () => window.getSelection();
window.scrollTo = () => {};
global.confirm = () => true;
global.fetch = async () => {
  throw Error("offline");
};
if (
  require("child_process").execFileSync("python3", ["-c", "import address_parser;print(address_parser.available())"], { encoding: "utf8" }).trim() !==
  "True"
) {
  console.error("usaddress not installed: pip install -r requirements-dev.txt");
  process.exit(1);
}
const test = async () => {
  const workflow = await createAddressWorkflow(),
    {
      WriterState,
      queries: { kase, doc },
      editor: { newDoc },
      addresses: addressParser,
      records: { caseFile },
      summary: { summarize },
      format: { standardStreetAddress, standardCityStateZip, respondentKey, SUMMARY_VERSION },
    } = workflow;
  let saveDrafts = async () => true,
    render = () => {},
    helperJSON;
  const A11Y = workflow.adapters.A11Y;
  Object.assign(workflow.adapters, {
    saveDrafts: (...args) => saveDrafts(...args),
    render: (...args) => render(...args),
    helperJSON: (...args) => helperJSON(...args),
  });
  const corpus = JSON.parse(fs.readFileSync("tests/fixtures/address_corpus.json")),
    answers = JSON.parse(
      require("child_process").execFileSync(
        "python3",
        [
          "-c",
          "import address_parser,json;print(json.dumps([address_parser.parse_addres" +
            "s(x['raw']) for x in json.load(open('tests/fixtures/address_corpus.json'))]))",
        ],
        { encoding: "utf8" },
      ),
    );
  let pass = 0,
    agree = 0;
  const report = corpus.map((x, n) => {
    const lines = x.raw.split(/,\s*(?=[A-Za-z])/),
      street = lines[0],
      city = lines.slice(1).join(", "),
      r19 = !!standardStreetAddress(street) && !!standardCityStateZip(city),
      parsed = answers[n].type !== "ambiguous";
    if (r19) {
      pass++;
      if (x.type !== "ambiguous") assert.ok(parsed, "Every unambiguous R19 corpus address remains usable: " + x.raw);
    }
    if (r19 === parsed) agree++;
    return { raw: x.raw, r19, parser: parsed, parserType: answers[n].type, r19FalsePositive: r19 && !parsed };
  });
  fs.mkdirSync("build/test-results", { recursive: true });
  fs.writeFileSync(
    "build/test-results/address-agreement.json",
    JSON.stringify({ r19Pass: pass, agreement: agree, total: corpus.length, cases: report }, null, 2),
  );
  assert.equal(new Set(answers.slice(0, 3).map((x) => x.ownerKey)).size, 1);
  const k = kase("k1");
  k.owner = "Exact Accela OWNER Name";
  k.ownerAddr = ["PO BOX 555", "MONROE WI 53566"];
  newDoc(k.id, "notice");
  const d = doc(WriterState.state.docId);
  saveDrafts = async () => true;
  render = () => {};
  helperJSON = async () => ({ ok: true, ...answers[10] });
  let html = "";
  A11Y.utility = (title, text) => {
    html = text;
  };
  await addressParser.preview("owner");
  assert.equal(k.ownerAddr[1], "MONROE WI 53566");
  const token = /data-accept-address="([^"]+)"/.exec(html)[1];
  assert.ok(addressParser.accept(token));
  assert.equal(k.owner, "Exact Accela OWNER Name");
  assert.equal(respondentKey(k), answers[10].ownerKey);
  assert.equal(summarize(caseFile(k.id)).case.ownerAddressKey, answers[10].ownerKey);
  assert.equal(SUMMARY_VERSION, 6);
  helperJSON = async () => ({ ok: true, ...answers[15] });
  k.ownerAddr = answers[15].raw.split("\n");
  await addressParser.preview("owner");
  assert.ok(addressParser.fault(k));
  assert.ok(!html.includes("data-accept-address"));
  k.ownerAddr = ["123 Changed St", "MADISON WI 53703"];
  assert.equal(addressParser.fault(k), null);
  console.log("PASS R31 address corpus, preview acceptance, unchanged owner name, raw ambiguity and summary 6");
  process.exit(0);
};
test().catch((e) => {
  console.error(e);
  process.exit(1);
});
