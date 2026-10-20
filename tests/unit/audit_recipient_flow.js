/* Actual form input, address validation, standardized document output and agent safeguards. */
globalThis.MADISON_TEST_DATA = true;
const fs = require("fs"),
  path = require("path"),
  { JSDOM } = require("jsdom");
const html = fs.readFileSync(
  path.join(process.env.DW_OUTPUT_DIR || path.join(require("path").resolve(__dirname, "../.."), "build/dist"), "madison-document-writer.html"),
  "utf8",
);
const payload = Buffer.from(/var B="([A-Za-z0-9+\/=]+)"/.exec(html)[1], "base64").toString("utf8");
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
const test = () => {
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
  if (!kase("k1").id)
    WriterState.CASES.unshift({
      id: "k1",
      number: "TEST-1",
      owner: "Example LLC",
      address: "123 Test St",
      date: "2026-09-01",
      time: "10:00",
      ccList: [],
      emails: [],
      agent: {},
    });
  const k = kase("k1");
  k.owner = "Example LLC";
  k.ccList = [];
  k.agent = {};
  k.emails = [];
  newDoc("k1", "notice");
  const d = doc(WriterState.state.docId);
  const fill = (selector, value) => {
    const el = document.querySelector(selector);
    el.value = value;
    el.dispatchEvent(new w.Event("input", { bubbles: true }));
  };
  const done = () => document.querySelector('.modal [data-close="modal"]').click();
  document.querySelector("#btn-cc").click();
  document.querySelector("#btn-addcc").click();
  fill('[data-cc="0|name"]', " Jane Doe ");
  fill('[data-cc="0|addr"]', "123 north Main Street, Apartment 4");
  fill('[data-cc="0|city"]', "madison wi 53703");
  ok(
    "modal shows standardized address while typing",
    document.querySelector('[data-recipient-preview="copy|0"]').textContent === "Printed as: 123 N Main St Apt 4 · Madison, WI 53703",
  );
  done();
  ok("Done closes a notice with a valid copy and no registered agent", WriterState.state.modal === null);
  ok("saved copy uses normalized street and locality", k.ccList[0].addr === "123 N Main St Apt 4" && k.ccList[0].city === "Madison, WI 53703");
  const rendered = noticeHTML(d);
  ok(
    "notice contains standardized copy and omits raw input",
    rendered.includes("123 N Main St Apt 4") && rendered.includes("Madison, WI 53703") && !rendered.includes("123 north Main Street, Apartment 4"),
  );
  document.querySelector("#btn-cc").click();
  fill('[data-cc="0|addr"]', "Main Street");
  fill('[data-cc="0|city"]', "Madison, XX 53703");
  done();
  ok(
    "invalid street stays in modal with a persistent message and exact focus",
    WriterState.state.modal === "cc" &&
      /street number and name/.test(document.getElementById("cc-address-error").textContent) &&
      document.activeElement.dataset.cc === "0|addr" &&
      document.activeElement.getAttribute("aria-invalid") === "true",
  );
  const deskBefore = document.querySelector(".desk");
  fill('[data-cc="0|addr"]', "125 east oAK road, suite 5");
  ok(
    "editing advances the persistent error to the remaining locality field without document repagination",
    /state name or two-letter abbreviation/.test(document.getElementById("cc-address-error")?.textContent || "") &&
      document.querySelector('[data-cc="0|city"]').getAttribute("aria-describedby") === "cc-address-error" &&
      document.querySelector(".desk") === deskBefore,
  );
  done();
  ok(
    "invalid state focuses locality with a durable error",
    WriterState.state.modal === "cc" &&
      document.activeElement.dataset.cc === "0|city" &&
      /state name or two-letter abbreviation/.test(document.getElementById("cc-address-error").textContent),
  );
  fill('[data-cc="0|city"]', "Madison Wisconsin 537031234");
  ok(
    "preview standardizes full state and compact ZIP+4",
    document.querySelector('[data-recipient-preview="copy|0"]').textContent.includes("125 E Oak Rd Ste 5 · Madison, WI 53703-1234"),
  );
  done();
  ok(
    "corrected copy closes and normalizes full state and ZIP+4",
    WriterState.state.modal === null && k.ccList[0].addr === "125 E Oak Rd Ste 5" && k.ccList[0].city === "Madison, WI 53703-1234",
  );
  const before = [
    { name: "One", addr: "123 main street", city: "madison wi 53703" },
    { name: "Two", addr: "No Number Road", city: "Madison, WI 53703" },
  ];
  const fault = validateAndStandardizeAddresses({ ccList: before, agent: {} }, false);
  ok("validation is atomic when a later recipient is invalid", !!fault && before[0].addr === "123 main street");
  k.ccList = [{ name: "Jane", addr: "Main Street", city: "Madison, WI 53703" }];
  ok(
    "issuance checks catch invalid copy addresses even if editor is bypassed",
    checks(d).some((c) => !c.ok && /Copy 1:/.test(c.t)),
  );
  k.ccList = [];
  d.type = "citation";
  render();
  document.querySelector("#btn-cc").click();
  done();
  ok(
    "company citation requires agent and focuses its name",
    WriterState.state.modal === "cc" &&
      document.activeElement.dataset.agent === "name" &&
      /Registered agent/.test(document.getElementById("cc-address-error").textContent),
  );
  fill('[data-agent="name"]', " Pat Agent ");
  fill('[data-agent="addr"]', "456 WEST lake avenue, Suite 12");
  fill('[data-agent="city"]', "madison, Wisconsin 53703");
  done();
  ok(
    "valid registered agent closes and standardizes",
    WriterState.state.modal === null && k.agent.addr === "456 W Lake Ave Ste 12" && k.agent.city === "Madison, WI 53703",
  );
  ok("citation renders the same normalized agent address", documentHTML(d).includes("456 W Lake Ave Ste 12"));
  ok(
    "citation agent check accepts the standardized complete address",
    checks(d).some((c) => c.ok && c.t === "Registered agent recorded"),
  );
  k.agent.city = "Madison, ZZ 53703";
  ok(
    "citation agent check rejects a three-line address with an invalid state",
    checks(d).some((c) => !c.ok && /registered agent/i.test(c.t)),
  );
  k.agent.city = "Madison, WI 53703";
  d.items = [
    {
      id: "agent-item",
      no: "1",
      cite: true,
      sections: ["27.05(2)(c)"],
      title: "Test",
      text: "Correct the condition",
      due: "2026-10-20",
      prov: "notice",
    },
  ];
  d.cits = { "agent-item": { amount: "197.00" } };
  const face = document.createElement("div");
  face.innerHTML = citationFaces(d, true);
  ok(
    "registered agent is standardized on the citation form itself",
    face.querySelector(".cit-agent .agent")?.textContent.includes("456 W Lake Ave Ste 12"),
  );
  scheduleDraftSave = originalSchedule;
  console.log("Recipient flow checks: " + count + " assertions, " + failures.length + " failures.");
  if (failures.length) process.exit(1);
};
eval(payload + "\n(" + test.toString() + ")();");
