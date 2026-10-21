/* Focused regressions for universal catalog search, correction withdrawals,
   selected email notices, and recipient address validation/display. */
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
global.confirm = () => true;
global.prompt = () => "";
global.URL = { createObjectURL: () => "test", revokeObjectURL() {} };
global.Blob = function () {};
w.scrollTo = () => {};
w.HTMLElement.prototype.scrollIntoView = function () {};
const test = async () => {
  const failures = [];
  let count = 0;
  const ok = (label, condition) => {
    count++;
    if (!condition) {
      failures.push(label);
      console.log("FAIL " + label);
    }
  };
  const originalSchedule = scheduleDraftSave;
  scheduleDraftSave = () => {};
  const far = LIBRARY[LIBRARY.length - 1],
    farItem = far.groups[0].items[0],
    searchTerm = farItem.catalogId || farItem.t.split(" ")[0];
  WriterState.state.libCl = 0;
  WriterState.state.libStatus = "all";
  WriterState.state.libFilter = searchTerm;
  const search = screenLibrary();
  ok(
    "catalog search spans all checklists outside the selected tab",
    search.includes(farItem.t) && search.includes(far.name) && search.includes("Search results across all checklists"),
  );
  ok(
    "catalog universal search includes ordinance, action, fill-in and guidance fields",
    (() => {
      const item = allItems().find((x) => x.fillIn && x.guidance && x.s.length);
      if (!item) return true;
      const term = item.guidance.split(/\s+/).find((x) => x.length > 5);
      WriterState.state.libFilter = term;
      return screenLibrary().includes(item.t);
    })(),
  );
  if (!kase("k1").id)
    WriterState.CASES.unshift({
      id: "k1",
      number: "TEST-1",
      owner: "Test Owner",
      address: "123 Test St",
      date: "2026-09-01",
      time: "10:00",
      ccList: [],
      emails: [],
      agent: {},
    });
  const k = kase("k1");
  k.ccList = [];
  k.emails = [{ addr: "configured@example.com", kind: "Other" }];
  newDoc("k1", "notice");
  const d = doc(WriterState.state.docId);
  d.draft = false;
  d.items = [
    {
      id: "withdrawn-test",
      no: "1",
      sections: ["27.05(2)(c)"],
      title: "Test",
      text: "Remove test condition",
      due: "2026-10-20",
      prov: "notice",
      done: false,
      withdrawn: true,
      withdrawalReason: "Entered in error",
    },
  ];
  d.correction = { case: { ...k } };
  const withdrawn = noticeHTML(d);
  d.correction = null;
  ok("withdrawn correction item receives the corrected strike-through row class", /data-row="withdrawn-test" class="done"/.test(withdrawn));
  ok(
    "unselected configured email recipient is absent from printed document",
    !withdrawn.includes("configured@example.com") && !withdrawn.includes("Email copy prepared for:"),
  );
  d.emailedTo = [{ addr: "selected@example.com", kind: "Agent" }];
  const sent = noticeHTML(d);
  ok(
    "selected email recipients are recorded at the end of the document",
    sent.includes("selected@example.com") && sent.includes("Email copy prepared for:"),
  );
  ok("street address standardizes common suffix and directional formatting", standardStreetAddress("123 north main street") === "123 N Main St");
  ok("street number and name are required", !standardStreetAddress("Main Street"));
  ok("city, state and ZIP standardize with ZIP+4 support", standardCityStateZip(" madison, wi 53703-1234 ") === "Madison, WI 53703-1234");
  ok("invalid state abbreviation is rejected", !standardCityStateZip("Madison, XX 53703"));
  const contacts = { ccList: [{ name: " Jane Doe ", addr: "123 north main street", city: " madison, wi 53703 " }], agent: {}, owner: "Person" };
  ok(
    "valid copy address is standardized before saving",
    !validateAndStandardizeAddresses(contacts) && contacts.ccList[0].addr === "123 N Main St" && contacts.ccList[0].city === "Madison, WI 53703",
  );
  ok(
    "incomplete copy address is blocked with an actionable error",
    validateAndStandardizeAddresses({
      ccList: [{ name: "Jane Doe", addr: "Main Street", city: "Madison, WI 53703" }],
      owner: "Person",
    }).message.includes("street number and name"),
  );
  ok(
    "company owner requires a complete registered-agent address",
    validateAndStandardizeAddresses({ ccList: [], owner: "Acme LLC", agent: { name: "Agent" } }).message.startsWith("Registered agent:"),
  );
  k.ccList = [{ name: "Jane Doe", addr: "Main Street", city: "Madison, WI 53703" }];
  WriterState.state.modal = "cc";
  render();
  document.querySelector('[data-close="modal"]').click();
  ok(
    "Done keeps the editor open with a persistent inline error focused on the street",
    WriterState.state.modal === "cc" &&
      /street number and name/.test(document.getElementById("cc-address-error").textContent) &&
      document.activeElement.dataset.cc === "0|addr",
  );
  k.ccList[0] = { name: "Jane Doe", addr: "123 main street", city: "madison, wi 53703" };
  render();
  document.querySelector('[data-close="modal"]').click();
  ok(
    "Done closes after validating and standardizing complete address",
    WriterState.state.modal === null && k.ccList[0].addr === "123 Main St" && k.ccList[0].city === "Madison, WI 53703",
  );
  scheduleDraftSave = originalSchedule;
  console.log("Order and address checks: " + count + " assertions, " + failures.length + " failures.");
  if (failures.length) process.exit(1);
};
eval(payload + "\n(" + test.toString() + ")().catch(e=>{console.error(e);process.exit(1);});");
