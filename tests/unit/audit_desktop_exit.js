/* Exit Document Writer (Writer and Reports, JSDOM): the Tools action, drafts saved before the helper is asked to
   stop, unresolved work listed from existing state, refusal while a publication or filing is in flight, queued
   items never described as saved, the helper's refusal reasons, the stopped state in this and other windows,
   and no request that stops the helper anywhere but the confirmed Exit action. */
globalThis.MADISON_TEST_DATA = true;
const assert = require("assert/strict"),
  { JSDOM } = require("jsdom");
const { builtPage, bundleSource } = require("../fixtures/built_bundle.cjs");

class FakeChannel {
  constructor(name) {
    this.name = name;
    this.sent = [];
    FakeChannel.all.push(this);
  }
  postMessage(message) {
    this.sent.push(message);
  }
  close() {}
}
FakeChannel.all = [];

function setup(stem, url) {
  const dom = new JSDOM('<div id="app"></div><div id="overlay"></div><div id="toast"></div>', { url, pretendToBeVisual: true });
  const w = dom.window;
  global.window = w;
  global.document = w.document;
  global.FormData = w.FormData;
  global.localStorage = w.localStorage;
  global.getSelection = () => w.getSelection();
  global.fetch = async () => {
    throw Error("offline");
  };
  w.scrollTo = () => {};
  w.__NO_AUTOLOAD__ = true;
  w.BroadcastChannel = FakeChannel;
  w.HTMLDialogElement.prototype.showModal = function () {
    this.open = true;
  };
  w.HTMLDialogElement.prototype.close = function () {
    this.open = false;
    this.dispatchEvent(new w.Event("close"));
  };
  return bundleSource(builtPage(stem));
}

const squash = (el) => (el?.textContent || "").replace(/\s+/g, " ").trim();
// The final message: "Document Writer has stopped. You can close this window. To start again, double-click ..."
function assertStoppedMessage(page) {
  assert.equal(squash(page.querySelector("h1")), "Document Writer has stopped");
  assert.equal(squash(page.querySelector("p")), "You can close this window. To start again, double-click Document Writer on the desktop.");
}
async function until(check, label) {
  for (let n = 0; n < 200; n++) {
    if (check()) return;
    await new Promise((r) => setTimeout(r, 5));
  }
  throw new Error("Timed out waiting for " + label);
}

if (process.argv[2] === "reports") {
  const src = setup("reports", "http://127.0.0.1:8777/madison-reports.html");
  const test = async () => {
    await new Promise((r) => setTimeout(r, 40));
    const channel = FakeChannel.all.find((c) => c.name === "madison-helper-stopped-v1");
    assert.ok(channel && typeof channel.onmessage === "function", "Reports listens for Exit Document Writer");
    channel.onmessage({ data: { kind: "other" } });
    assert.equal(document.querySelector("[data-helper-stopped]"), null, "only a stop message changes the page");
    channel.onmessage({ data: { kind: "stopped" } });
    const page = document.querySelector("[data-helper-stopped]");
    assertStoppedMessage(page);
    assert.match(page.textContent, /Reports cannot read case records until Document Writer starts again/);
    assert.equal(document.title, "Document Writer has stopped");
    render();
    assert.ok(document.querySelector("[data-helper-stopped]"), "a later render does not replace the stopped state");
    await assert.rejects(authFetch("/reporting/index"), /Document Writer has stopped/);
    console.log("PASS Reports shows the stopped state when Exit Document Writer is used in Writer");
    process.exit(0);
  };
  eval(src + "\n(" + test.toString() + ")().catch(e=>{console.error(e);process.exit(1);})");
} else {
  const src = setup("app", "http://127.0.0.1:8777/");
  // Nothing but the confirmed Exit action asks the helper to stop; closing or reloading a window never does.
  assert.equal(src.split("/helper/shutdown").length - 1, 1, "one shutdown request in Writer");
  assert.equal(bundleSource(builtPage("reports")).includes("/helper/shutdown"), false, "Reports never stops the helper");
  assert.equal(/sendBeacon|addEventListener\("(?:pagehide|unload)"/.test(src), false, "no window-closing request");
  const test = async () => {
    await new Promise((r) => setTimeout(r, 40));
    scheduleRecoveryBackup = () => {};
    scheduleDraftSave = () => {};
    const order = [],
      shutdowns = [];
    let answer = () => ({ status: 200, body: { ok: true, stopping: true } });
    idbSet = async () => {
      order.push("device save");
      return true;
    };
    const realAuthFetch = authFetch;
    authFetch = async (url, options = {}) => {
      if (url === "/helper/shutdown") {
        order.push("shutdown");
        shutdowns.push(JSON.parse(options.body));
        const { status, body, error } = answer();
        if (error) throw error;
        return { ok: status >= 200 && status < 300, status, json: async () => body };
      }
      return { ok: true, status: 200, json: async () => ({ ok: true }) };
    };
    WriterState.CASES = [{ id: "dx", number: "QA-EXIT", address: "58 SYNTHETIC STREET", date: recordDay(today), time: "09:00", inspectorId: "i4" }];
    WriterState.EVENTS = {};
    WriterState.DOCS = [];
    WriterState.REINSP = [];
    WriterState.PENDING = [];
    WriterState.RECORD_ATTEMPTS = {};
    WriterState.HELPER = { ok: true, outbox: 0 };
    WriterState.CASEDIR = { helper: true };
    WriterState.NEEDGRANT = false;
    WriterState.LOCAL_SAVE = { ok: true, at: nowISO(), saving: false };
    const k = WriterState.CASES[0];
    rememberSaved(k, caseFile(k.id));
    COMMITTED.set(summaryName(k), { file: caseFile(k.id) });
    const dialog = () => document.getElementById("utility-dialog");
    const submit = () => document.getElementById("exit-writer-form").dispatchEvent(new window.Event("submit", { cancelable: true }));

    // Tools: one Exit action in Saved work & connection; the five Writer destinations and ten tool cards are unchanged.
    WriterState.state.screen = "tools";
    render();
    const exits = document.querySelectorAll("[data-exit-writer]");
    assert.equal(exits.length, 1);
    assert.equal(squash(exits[0]), "Exit Document Writer");
    assert.equal(squash(exits[0].closest(".tools-section").querySelector("h2")), "Saved work & connection");
    assert.match(squash(exits[0].closest("[data-tools-exit]")), /Closing a window does not stop it/);
    assert.equal(document.querySelectorAll(".tools-section .tool-action").length, 10);
    assert.equal(document.querySelectorAll(".writer-navigation .rail-item").length, 5);
    assert.equal(document.querySelector(".rail-foot [data-exit-writer]"), null);

    // Idle: drafts are saved first, the dialog explains what happens, and nothing is listed.
    order.length = 0;
    exits[0].click();
    await until(() => dialog(), "the Exit dialog");
    assert.deepEqual(order, ["device save"], "drafts are saved on this device before the review");
    assert.equal(squash(dialog().querySelector("#utility-title")), "Exit Document Writer");
    const intro = squash(dialog().querySelector("form"));
    assert.match(intro, /This window and any other open Writer or Reports windows lose their connection/);
    assert.match(intro, /Drafts saved on this device stay on this device/);
    assert.match(intro, /Queued shared saves and PDF transfers stay queued on this device and resume when Document Writer starts again/);
    assert.match(intro, /They are not in the shared folder until then/);
    assert.match(intro, /double-click Document Writer on the desktop/);
    assert.equal(dialog().querySelector("[data-exit-blocking]"), null);
    assert.equal(dialog().querySelector("[data-exit-unresolved]"), null);
    assert.equal(squash(dialog().querySelector("[data-exit-confirm]")), "Exit Document Writer");
    assert.equal(squash(dialog().querySelector("[data-utility-close]")), "Cancel");
    dialog().querySelector("[data-utility-close]").click();
    assert.equal(dialog(), null, "Cancel closes the dialog");
    assert.deepEqual(shutdowns, [], "Cancel never asks the helper to stop");

    // A publication in flight: refused, with guidance and no way to confirm.
    WriterState.state.publicationBusy = "dx-doc";
    await openExit();
    let blocking = squash(dialog().querySelector("[data-exit-blocking]"));
    assert.match(blocking, /A document is being issued\. Wait until its confirmation appears/);
    assert.equal(dialog().querySelector("[data-exit-confirm]"), null, "no Exit button while publishing");
    assert.ok(dialog().querySelector("[data-exit-recheck]"));
    WriterState.state.publicationBusy = null;
    // Filing that starts after the dialog opened is caught when Exit is confirmed.
    await openExit();
    assert.ok(dialog().querySelector("[data-exit-confirm]"));
    WriterState.FILING_ACTIVE = 1;
    submit();
    await until(() => dialog()?.querySelector("[data-exit-blocking]"), "the filing refusal");
    assert.match(squash(dialog().querySelector("[data-exit-blocking]")), /A PDF is being filed or an email is being prepared/);
    assert.deepEqual(shutdowns, [], "the helper is not asked to stop during filing");
    WriterState.FILING_ACTIVE = 0;
    // A device-save failure blocks: the stopped page would replace work that is not on this device.
    idbSet = async () => false;
    await openExit();
    assert.match(squash(dialog().querySelector("[data-exit-blocking]")), /could not be saved on this device.*download a workspace backup/);
    idbSet = async () => {
      order.push("device save");
      return true;
    };

    // Queued and unconfirmed work: listed from existing state, needs acknowledgment, never called saved.
    WriterState.PENDING = [{ cid: "elsewhere", name: "QA-QUEUED.json", body: "{}" }];
    WriterState.HELPER.outbox = 2;
    newDoc(k.id, "notice");
    const d = doc(WriterState.state.docId);
    d.pendingAmendment = { eventId: "dx-attempt", sourceHash: "dx", payload: { snapshot: clone(d) } };
    await openExit();
    const unresolved = dialog().querySelector("[data-exit-unresolved]");
    const listed = squash(unresolved);
    assert.match(listed, /QA-EXIT: save confirmation needed\. The original attempt is kept on this device and has not been confirmed/);
    assert.match(listed, /1 shared save queued on this device\. They have not reached the shared folder/);
    assert.match(listed, /2 PDFs waiting in the local outbox\. They have not reached the shared folder/);
    // "Saved work & connection" names the Tools destination; nothing listed is described as saved.
    assert.equal(
      /\bsaved\b/i.test(listed.replaceAll("Saved work & connection", "")),
      false,
      "queued and unconfirmed items are never described as saved: " + listed,
    );
    assert.equal(dialog().querySelector("[data-exit-blocking]"), null, "queued work alone does not block");
    const acknowledged = unresolved.querySelector('input[name="acknowledged"]');
    assert.ok(acknowledged.required);
    const shownForm = document.getElementById("exit-writer-form");
    submit();
    await until(() => document.getElementById("exit-writer-form") !== shownForm, "the re-shown dialog");
    assert.deepEqual(shutdowns, [], "no acknowledgment, no request");
    // The helper's own refusal is shown with its reasons; the page keeps working.
    answer = () => ({
      status: 409,
      body: { ok: false, error: "Document Writer is still working, so it was not stopped.", reasons: ["A PDF is being made or filed."] },
    });
    dialog().querySelector('input[name="acknowledged"]').checked = true;
    order.length = 0;
    submit();
    await until(() => shutdowns.length === 1, "the shutdown request");
    await until(() => squash(dialog()?.querySelector("[data-exit-error]")).includes("A PDF is being made or filed."), "the refusal");
    assert.deepEqual(order, ["device save", "shutdown"], "drafts are saved again immediately before the request");
    assert.deepEqual(shutdowns[0], { force: true }, "acknowledged client warnings; the helper still decides");
    assert.equal(dialog().querySelector("[data-exit-confirm]").disabled, false);
    assert.equal(document.querySelector("[data-helper-stopped]"), null);
    // No answer at all: it may already have stopped; drafts are kept.
    answer = () => ({ error: new TypeError("Failed to fetch") });
    submit();
    await until(() => /did not answer/.test(squash(dialog().querySelector("[data-exit-error]"))), "the network failure");
    assert.equal(document.querySelector("[data-helper-stopped]"), null);

    // Exit used in another window: this window keeps its device drafts and shows the stopped state.
    const channel = FakeChannel.all.find((c) => c.name === "madison-helper-stopped-v1");
    assert.ok(channel && typeof channel.onmessage === "function", "Writer listens for Exit in other windows");
    order.length = 0;
    channel.onmessage({ data: { kind: "stopped" } });
    await until(() => document.querySelector("[data-helper-stopped]"), "the stopped state from another window");
    assert.deepEqual(order, ["device save"]);
    assert.match(squash(document.querySelector("[data-helper-stopped]")), /used in another Writer window/);
    helperStop.stopped = false;
    WriterState.HELPER = { ok: true, outbox: 2 };
    WriterState.state.screen = "tools";
    render();

    // Success: answered, other windows told, this window shows the final message and stays stopped.
    answer = () => ({ status: 200, body: { ok: true, stopping: true } });
    await openExit();
    dialog().querySelector('input[name="acknowledged"]').checked = true;
    shutdowns.length = 0;
    submit();
    await until(() => document.querySelector("[data-helper-stopped]"), "the stopped page");
    assert.equal(shutdowns.length, 1);
    assert.equal(dialog(), null);
    assertStoppedMessage(document.querySelector("[data-helper-stopped]"));
    const page = squash(document.querySelector("[data-helper-stopped]"));
    assert.match(page, /Drafts saved on this device stay on this device/);
    assert.match(page, /1 shared save and 2 PDF transfers remain queued on this device\. They have not reached the shared folder/);
    assert.deepEqual(channel.sent, [{ kind: "stopped" }], "other Writer and Reports windows are told");
    assert.equal(WriterState.HELPER, null);
    render();
    assert.ok(document.querySelector("[data-helper-stopped]"), "a later render does not replace the stopped state");
    await assert.rejects(realAuthFetch("/cases/list"), /Document Writer has stopped/, "no helper request after the stop");
    console.log("PASS Exit Document Writer saves drafts, lists unresolved work, refuses active work and shows the stopped state");
    require("child_process").execFileSync(process.execPath, [__filename, "reports"], { stdio: "inherit" });
    process.exit(0);
  };
  eval(src + "\n(" + test.toString() + ")().catch(e=>{console.error(e);process.exit(1);})");
}
