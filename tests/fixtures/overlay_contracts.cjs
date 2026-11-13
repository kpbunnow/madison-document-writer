/* Independent screen behavior contracts. No production renderers or frozen HTML copies are loaded. */
const assert = require("node:assert/strict"),
  { JSDOM } = require("jsdom");
const document = new JSDOM("").window.document;
const template = document.createElement("template");
function overlayContract(markup, expected) {
  if (expected.delegate !== undefined) return assert.equal(markup, expected.delegate, "correct modal/picker owner receives priority");
  template.innerHTML = markup;
  const view = template.content;
  assert.equal(view.querySelectorAll('[role="dialog"][aria-modal="true"]').length, 1, "one named modal");
  assert.equal(view.querySelectorAll("h2").length, 1);
  assert.equal(view.querySelectorAll("script,iframe,object,embed").length, 0, "untrusted values never become active markup");
  const ids = [...view.querySelectorAll("[id]")].map((el) => el.id);
  assert.equal(new Set(ids).size, ids.length, "control identities remain unique");
  for (const el of view.querySelectorAll("*"))
    for (const { name, value } of el.attributes) {
      assert.doesNotMatch(name, /^on/i, "no inline event attributes");
      if (["href", "src"].includes(name)) assert.doesNotMatch(value, /^\s*javascript:/i);
    }
  const find = (selector) => {
    const el = view.querySelector(selector);
    assert.ok(el, selector);
    return el;
  };
  const count = (selector, n) => assert.equal(view.querySelectorAll(selector).length, n, selector);
  switch (expected.modal) {
    case "sendto":
      assert.equal(view.querySelector("h2").textContent, "Send this document to");
      count("[data-sendto]", expected.emails);
      assert.ok([...view.querySelectorAll("[data-sendto]")].every((el) => el.checked));
      find("#btn-sendgo");
      find("#btn-sendnone");
      break;
    case "cc": {
      assert.equal(view.querySelector("h2").textContent, "Copies, email and registered agent");
      count("input[data-cc]", expected.copies * 3);
      count("[data-rmcc]", expected.copies);
      count("input[data-em]", expected.emails);
      count("[data-rmem]", expected.emails);
      count("input[data-agent]", 3);
      if (expected.contact) {
        (expected.contact.ccList || []).forEach((copy, ix) => {
          for (const field of ["name", "addr", "city"]) assert.equal(find('[data-cc="' + ix + "|" + field + '"]').value, copy[field] || "");
        });
        (expected.contact.emails || []).forEach((email, ix) => assert.equal(find('[data-em="' + ix + '|addr"]').value, email.addr || ""));
        for (const field of ["name", "addr", "city"]) assert.equal(find('[data-agent="' + field + '"]').value, expected.contact.agent?.[field] || "");
      }
      if (expected.previews)
        assert.deepEqual(
          [...view.querySelectorAll("[data-recipient-preview]")].map((el) => el.textContent),
          expected.previews,
        );
      for (const el of view.querySelectorAll('input[data-cc$="|addr"]')) assert.match(el.placeholder, /PO Box/i);
      assert.equal(!!view.querySelector(".rec-h .req"), expected.needAgent);
      const link = find('a[href="https://apps.dfi.wi.gov/apps/corpsearch/search.aspx"]');
      assert.equal(link.target, "_blank");
      assert.ok(link.rel.split(/\s+/).includes("noopener"));
      if (expected.problem) find("#cc-address-error[role='alert']");
      else count("#cc-address-error", 0);
      find("#btn-addcc");
      find("#btn-addem");
      find("[data-close='modal']");
      break;
    }
    case "clear":
      assert.equal(view.querySelector("h2").textContent, "Remove cases from this workspace");
      count("[data-clearcases='safe']", expected.safe ? 1 : 0);
      count("[data-clearcases='all']", expected.risky ? 1 : 0);
      if (expected.safe) assert.match(find("[data-clearcases='safe']").textContent, new RegExp(String(expected.safe)));
      if (expected.risky) assert.match(find("[data-clearcases='all']").textContent, /losing that unsaved work/);
      assert.match(view.textContent, /does not delete its shared case record/);
      break;
    case "folder":
      assert.equal(view.querySelector("h2").textContent, "Open a saved case");
      find("#folder-search[type='search']");
      count("[data-openfolder]", expected.files);
      assert.equal(!!view.querySelector(".banner.warn"), expected.folderError);
      break;
    case "storage":
      assert.equal(view.querySelector("h2").textContent, "Where documents are going");
      count("#btn-reindex", expected.folder ? 1 : 0);
      if (expected.folder) assert.equal(find("#btn-reindex").disabled, expected.running);
      count("#btn-testwrite", expected.folder && !expected.helperStorage ? 1 : 0);
      count("#btn-linkdir", !expected.folder || !expected.helperStorage ? 1 : 0);
      if (expected.wrong) assert.match(view.textContent, /not where they belong/);
      find("[data-sync-safety]");
      break;
    case "final": {
      const issue = find("#fin-go"),
        mailed = find("#fin-mailed[type='date']");
      assert.equal(issue.disabled, expected.blocked || expected.busy);
      assert.equal(issue.textContent, expected.correction ? "Save & issue correction" : expected.initial ? "Issue citation" : "Issue document");
      assert.equal(mailed.disabled, expected.correction);
      assert.equal(mailed.value, expected.mailed);
      assert.match(mailed.max, /^\d{4}-\d{2}-\d{2}$/);
      count("#correction-reviewed", expected.correction ? 1 : 0);
      if (expected.correction) assert.equal(find("#correction-reviewed").checked, expected.reviewed);
      count("[data-finsend]", expected.send?.length || 0);
      if (expected.send?.length)
        assert.deepEqual(
          [...view.querySelectorAll("[data-finsend]")].map((el) => el.checked),
          expected.send,
        );
      find("#btn-savework");
      find("[data-close='modal']");
      break;
    }
    default:
      assert.fail("Unspecified screen contract: " + expected.modal);
  }
}
function overlayCalls(state, checks, options = {}) {
  const modal = state.state.modal,
    calls = [];
  const get = (name) => calls.push(["get", name]);
  const call = (name, args = []) => calls.push([name, structuredClone(args)]);
  const pair = (property, name, args = []) => {
    get(property);
    call(name, args);
  };
  const delegates = {
    "shared-change": "sharedChangeModal",
    review: "reviewModalHTML",
    recovery: "recoveryModal",
    void: "recordActionModal",
    recordnote: "recordActionModal",
    reconcile: "recordActionModal",
  };
  if (delegates[modal]) {
    pair(delegates[modal], delegates[modal]);
    return calls;
  }
  if (!modal && state.state.picker) {
    pair("pickerHTML", "pickerHTML");
    return calls;
  }
  const d = state.DOCS.find((doc) => doc.id === state.state.docId);
  const k = d?.correction?.case || state.CASES.find((item) => item.id === d?.caseId) || {};
  if (modal === "cc") {
    for (const copy of k.ccList || []) pair("recipientPreview", "preview", [copy]);
    pair("recipientPreview", "preview", [k.agent || {}, false]);
  } else if (modal === "clear") {
    for (let pass = 0; pass < 2; pass++) for (const item of state.CASES) pair("caseUnsaved", "unsaved", [item]);
    const unsafe = options.unsafe || ((item) => Number(item.id.replace("case", "")) % 2);
    for (const item of state.CASES.filter(unsafe)) pair("caseUnsaved", "unsaved", [item]);
  } else if (modal === "storage") {
    pair("storageReport", "storageReport");
    if (state.CASEDIR) {
      get("CASEDIR_EXPECT");
      if (state.DIRNAME !== (options.destination || "Expected")) get("CASEDIR_EXPECT");
    }
    pair("reindexReport", "reindexReport");
  } else if (modal === "final") {
    pair("checks", "checks", [d]);
    pair("blockers", "blockers", [d]);
    if (d.correction) pair("correctionDiffHTML", "correctionDiffHTML", [d]);
    checks.forEach((check, ix) => {
      if (!check.ok) pair("checkRowHTML", "row", [check, ix]);
    });
    if (!d.mailed) get("today");
    pair("initialCitations", "initial", [d]);
    if (!d.correction) pair("initialCitations", "initial", [d]);
  }
  return calls;
}
module.exports = { overlayContract, overlayCalls };
