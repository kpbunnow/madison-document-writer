/* R59: a citation item with several sections charges one of them, chosen explicitly from a select, and a changed
   charge is priced afresh from the configured schedule. Real policy rows; synthetic case data only. */
globalThis.MADISON_TEST_DATA = true;
globalThis.CURRENT_AUTHORING = require("../fixtures/authoring_expectations.cjs");
const assert = require("assert/strict"),
  { JSDOM } = require("jsdom");
const { builtPage, bundleSource } = require("../fixtures/built_bundle.cjs");
const payload = bundleSource(builtPage());
const dom = new JSDOM('<!doctype html><div id="app"></div><div id="overlay"></div><div id="toast"></div>', {
  url: "http://127.0.0.1:8777/",
  pretendToBeVisual: true,
});
global.window = dom.window;
global.document = dom.window.document;
global.FormData = dom.window.FormData;
global.getSelection = () => window.getSelection();
window.scrollTo = () => {};
global.confirm = () => true;
global.fetch = async () => {
  throw Error("offline");
};
const test = async () => {
  await new Promise((r) => setTimeout(r, 25));
  render = () => {};
  saveDrafts = async () => true;
  scheduleDraftSave = () => {};
  idbSet = async () => true;
  let checks = 0;
  const ok = (name, value, detail = "") => {
    assert.ok(value, name + (detail ? " " + detail : ""));
    checks++;
    console.log("PASS " + name);
  };
  // Real configured rows: two fixed schedules, one ordinance with no verified schedule, one with two schedule rows.
  const FIXED = "27.05(2)(c)",
    OTHER = "27.05(2)(cc)",
    UNSCHEDULED = "SPS321.125",
    AMBIGUOUS = "23.52";
  const sections = [FIXED, OTHER, "SPS 321.125", AMBIGUOUS];
  ok("Policy has a fixed schedule row for the chosen ordinances", CITATION_POLICY.entries.filter((e) => e.ordinance === FIXED).length === 1);
  ok(
    "Policy has no verified schedule for the unscheduled ordinance",
    resolveCitationAmount({ ordinance: UNSCHEDULED, date: "2026-10-22" }).kind === "needs-basis",
  );
  ok("Policy has two schedule rows for the ambiguous ordinance", CITATION_POLICY.entries.filter((e) => e.ordinance === AMBIGUOUS).length === 2);
  WriterState.DOCS = [];
  WriterState.EVENTS = {};
  WriterState.REINSP = [];
  const draft = (list) => {
    newDoc("k1", "notice");
    const d = doc(WriterState.state.docId);
    d.items = [{ id: "r59", no: "1", title: "Synthetic charge", text: "Repair.", cite: true, sections: list, due: addDays(recordDay(today), 21) }];
    initialCitations.prepare(d);
    assert.equal(d.authoringVersion, CURRENT_AUTHORING.initialNotice, "Preparing initial charges retains the current authoring version");
    return d;
  };
  const show = (d) => {
    document.getElementById("app").innerHTML = citationReview(d);
    return document.getElementById("app");
  };
  const fire = (el, value, types = ["input", "change"]) => {
    el.value = value;
    for (const type of types) el.dispatchEvent(new window.Event(type, { bubbles: true }));
  };
  const priced = (d, c, ordinance, entryId = "") => {
    const p = resolveCitationAmount({ ordinance, entryId, tier: 1, date: citationPricingDate(c, d), measurements: {} });
    delete p.kind;
    return p;
  };
  const sameAs = (c, p) => Object.keys(p).every((k) => stableJSON(c[k]) === stableJSON(p[k]));
  const charge = (d) => d.cits?.r59 || d.depositRequests?.r59;

  // Zero and one section keep the existing free-text entry and its automatic charge.
  const none = draft([]);
  ok("Zero sections: no charge is invented", !String(charge(none).ord || "") && !!none.depositRequests?.r59);
  let view = show(none);
  ok(
    "Zero sections keep the text ordinance entry",
    view.querySelector('[data-deposit-form="r59"] input[name="ord"]') && !view.querySelector('select[name="ord"]'),
  );
  ok(
    "Zero sections keep the existing ordinance message",
    blockers(none).some((c) => /choose one complete ordinance/.test(c.t)),
  );
  // A typed charge is kept through a repaint and priced only when committed.
  WriterState.state.docId = none.id;
  let typedInput = show(none).querySelector('[data-deposit-form="r59"] input[name="ord"]');
  fire(typedInput, FIXED, ["input"]);
  citationPricing.refresh(none);
  ok("A charge being typed is kept and not yet priced", none.depositRequests?.r59?.ord === FIXED && !none.cits?.r59);
  typedInput = show(none).querySelector('[data-deposit-form="r59"] input[name="ord"]');
  ok("A repaint keeps the typed charge", typedInput.value === FIXED);
  fire(typedInput, FIXED, ["change"]);
  ok(
    "Committing the typed charge prices it",
    !!none.cits?.r59 && !Object.hasOwn(none.cits.r59, "ordEditingFrom") && sameAs(none.cits.r59, priced(none, none.cits.r59, FIXED)),
  );
  const one = draft([FIXED]);
  ok("One section auto-fills and prices the charge", one.cits.r59.ord === FIXED && sameAs(one.cits.r59, priced(one, one.cits.r59, FIXED)));
  view = show(one);
  ok(
    "One section keeps the text ordinance field",
    view.querySelector('[data-review-cit="r59|ord"]')?.tagName === "INPUT" && !view.querySelector('[data-review-cit="r59|ordOther"]'),
  );

  // Several sections: an explicit choice from exactly those sections, no default.
  const d = draft(sections);
  WriterState.state.docId = d.id;
  ok("Several sections: no ordinance is chosen automatically", charge(d).ord === "" && !d.cits?.r59 && !!d.depositRequests.r59);
  view = show(d);
  let select = view.querySelector('[data-deposit-form="r59"] select[name="ord"]');
  ok(
    "The completion form offers exactly the item's sections after an empty first option",
    select &&
      stableJSON([...select.options].map((o) => [o.value, o.textContent])) ===
        stableJSON([
          ["", "Choose the charged ordinance"],
          [FIXED, FIXED],
          [OTHER, OTHER],
          [UNSCHEDULED, "SPS 321.125"],
          [AMBIGUOUS, AMBIGUOUS],
        ]),
  );
  ok("Nothing is preselected", select.value === "" && ![...select.options].some((o) => o.value && o.selected));
  ok("The different-charge entry stays secondary and empty", view.querySelector('[data-deposit-form="r59"] input[name="ordOther"]')?.value === "");
  let blocking = blockers(d).find((c) => /choose the charged ordinance from its sections/.test(c.t));
  ok("Issue is blocked until a section is chosen, with clear text", !!blocking && /^Citation for item 1: /.test(blocking.t));
  ok("The blocker targets the ordinance select", document.querySelector(blocking.targets[0].selector) === select);
  assert.throws(() => printJob(initialCitations.preview(d)), /deposit/i);
  checks++;

  // Choosing a fixed-schedule section prices it from the configured schedule.
  fire(select, FIXED, ["change"]);
  let c = d.cits?.r59;
  ok("Choosing a fixed-schedule section completes the charge", !!c && !d.depositRequests?.r59 && c.ord === FIXED);
  assert.equal(d.authoringVersion, CURRENT_AUTHORING.initialNotice, "Selecting an ordinance does not downgrade the draft");
  ok("Pricing equals resolveCitationAmount for the chosen ordinance", sameAs(c, priced(d, c, FIXED)), JSON.stringify(c));
  ok("Choosing a section raises no ordinance blocker", !blockers(d).some((x) => /charged ordinance|one complete ordinance/.test(x.t)));
  view = show(d);
  select = view.querySelector('[data-review-cit="r59|ord"]');
  ok("The charge card shows the choice in the same select", select?.tagName === "SELECT" && select.value === FIXED);

  // Changing the choice clears every value derived from the previous charge and keeps unrelated input.
  editCitation(d, "r59", "desc", "Synthetic inspector narrative description");
  editCitation(d, "r59", "comment", "Synthetic inspection history comment.");
  Object.assign(c, {
    overrideBasis: { version: 1, ordinance: FIXED },
    tierOverride: "2",
    tierOverrideSource: "Synthetic court tier instruction",
    measurements: { area: 5 },
    rowDescription: "STALE ROW",
    rowSelectionNotice: "Stale row notice",
    depositApproved: true,
    scheduleEntryId: "stale-entry",
    differentChargeSource: "Synthetic approval for an earlier different charge.",
  });
  const kept = { num: c.num, courtDate: c.courtDate, deptId: c.deptId };
  fire(select, OTHER);
  c = d.cits.r59;
  ok("A changed choice is priced for the new ordinance", c.ord === OTHER && sameAs(c, priced(d, c, OTHER)), JSON.stringify(c));
  ok(
    "Values derived from or approved for the previous charge are cleared",
    [
      "overrideBasis",
      "tierOverride",
      "tierOverrideSource",
      "rowDescription",
      "rowSelectionNotice",
      "depositApproved",
      "scheduleEntryId",
      "differentChargeSource",
    ].every((k) => !Object.hasOwn(c, k)) && stableJSON(c.measurements) === "{}",
    JSON.stringify(c),
  );
  ok(
    "Unrelated input is kept: edited description, narrative, citation number and court details",
    c.desc === "Synthetic inspector narrative description" &&
      c.comment === "Synthetic inspection history comment." &&
      c.num === kept.num &&
      c.courtDate === kept.courtDate &&
      c.deptId === kept.deptId,
  );

  // Returning to an original charge in a correction restores the exact retained basis, even after the
  // intermediate ordinance moved the charge into a deposit request instead of a completed citation.
  const correction = draft(sections),
    original = clone(correction);
  changeCharge(correction, "r59", FIXED);
  original.cits = clone(correction.cits);
  original.id = "r59-original-charge";
  original.type = "citation";
  original.draft = false;
  const retained = original.cits.r59;
  retained.depositMode = "total";
  retained.amount = "150.00";
  retained.depositSource = "Synthetic retained approved total";
  retained.tier = "2nd";
  retained.tierOverride = "2";
  retained.tierOverrideSource = "Synthetic retained tier authority";
  delete retained.assessments;
  correction.type = "citation";
  correction.correction = { targetId: original.id };
  correction.cits = clone(original.cits);
  WriterState.DOCS.push(original);
  for (const intermediate of [OTHER, UNSCHEDULED]) {
    changeCharge(correction, "r59", intermediate);
    changeCharge(correction, "r59", FIXED);
    const restored = correction.cits.r59;
    assert.ok(restored && !correction.depositRequests?.r59, "An unchanged original is restored as a completed charge");
    for (const field of [...CHARGE_DERIVED, "depositMode", "tier"].filter((field) => field !== "historicalDeposit"))
      assert.equal(stableJSON(restored[field]), stableJSON(retained[field]), "Retained correction basis: " + field);
    assert.equal(citationDepositFault(restored, correction, correction.items[0]), "", "Returning to the unchanged charge stays valid");
    assert.equal(correction.authoringVersion, CURRENT_AUTHORING.initialNotice);
  }
  WriterState.DOCS = WriterState.DOCS.filter((x) => x.id !== original.id && x.id !== correction.id);
  WriterState.state.docId = d.id;

  const pair = makePublication(d);
  assert.equal(pair.payload.snapshot.authoringVersion, CURRENT_AUTHORING.initialNotice, "Atomic companion publication retains current authoring");
  assert.equal(
    d.publicationEvents[0].payload.snapshot.authoringVersion,
    CURRENT_AUTHORING.initialNotice,
    "Atomic notice publication retains current authoring",
  );
  delete d.publicationEvents;

  // No verified schedule: the existing manual path, never the previous amount.
  view = show(d);
  fire(view.querySelector('[data-review-cit="r59|ord"]'), UNSCHEDULED);
  let request = d.depositRequests?.r59;
  ok("An unscheduled section opens the existing manual completion", !d.cits.r59 && request?.ord === UNSCHEDULED);
  ok(
    "Its own reason is shown and no amount from the previous charge remains",
    /No verified fixed deposit/.test(request.reason) &&
      ["amount", "base", "cc", "assessments", "depositSource"].every((k) => !Object.hasOwn(request, k)),
    JSON.stringify(request),
  );
  ok(
    "A missing schedule is not a zero deposit",
    !depositStep.complete(d, "r59", { depositMode: "base", base: "0", depositSource: "Synthetic court approved base." }),
  );

  // Several schedule rows: the Scheduled offense choice is required.
  view = show(d);
  fire(view.querySelector('[data-deposit-form="r59"] select[name="ord"]'), AMBIGUOUS, ["change"]);
  request = d.depositRequests?.r59;
  ok("An ordinance with two schedule rows is not priced by guess", request?.ord === AMBIGUOUS && !Object.hasOwn(request, "amount"));
  view = show(d);
  const offense = view.querySelector('[data-deposit-form="r59"] select[name="scheduleEntryId"]');
  ok("The Scheduled offense choice is offered with no default", offense && offense.value === "" && offense.options.length === 3);
  blocking = blockers(d).find((x) => /choose the scheduled offense/.test(x.t));
  ok("Issue is blocked until the scheduled offense is chosen", !!blocking && document.querySelector(blocking.targets[0].selector) === offense);
  const row =
    CITATION_POLICY.entries.find((e) => e.ordinance === AMBIGUOUS && e.id.endsWith("395-" + AMBIGUOUS)) ||
    CITATION_POLICY.entries.find((e) => e.ordinance === AMBIGUOUS);
  fire(offense, row.id, ["change"]);
  c = d.cits?.r59;
  ok(
    "Choosing the scheduled offense prices that row",
    !!c && c.scheduleEntryId === row.id && sameAs(c, priced(d, c, AMBIGUOUS, row.id)),
    JSON.stringify(c),
  );
  view = show(d);
  ok("The card keeps the Scheduled offense choice", view.querySelector('[data-review-cit="r59|scheduleEntryId"]')?.value === row.id);

  // Save and reopen keeps the choice.
  editCitation(d, "r59", "ord", FIXED);
  const reopened = JSON.parse(JSON.stringify(d));
  view = show(reopened);
  ok(
    "A saved choice is preselected after reopening",
    view.querySelector('[data-review-cit="r59|ord"]').value === FIXED && reopened.cits.r59.amount === d.cits.r59.amount,
  );

  // A charge outside the sections stays on the different-charge path.
  view = show(d);
  fire(view.querySelector('[data-review-cit="r59|ordOther"]'), "27.04(2)(c)");
  c = d.cits.r59;
  view = show(d);
  ok(
    "A different charge is kept outside the select",
    c.ord === "27.04(2)(c)" &&
      view.querySelector('[data-review-cit="r59|ord"]').value === "" &&
      view.querySelector('[data-review-cit="r59|ordOther"]').value === "27.04(2)(c)",
  );
  ok("A different charge without its source keeps the existing charge check", !!citationPricing.chargeFault(d, d.items[0], c));
  editCitation(d, "r59", "differentChargeSource", "Synthetic division approval of the different charge.");
  const outside = JSON.parse(JSON.stringify(d));
  ok(
    "A saved different charge with its source is kept on reopening",
    outside.cits.r59.ord === "27.04(2)(c)" && !citationPricing.chargeFault(outside, outside.items[0], outside.cits.r59),
  );
  const nextOutside = CITATION_POLICY.entries.find(
    (entry) =>
      !sections.map(canonicalOrdinance).includes(entry.ordinance) &&
      entry.ordinance !== c.ord &&
      resolveCitationAmount({ ordinance: entry.ordinance, date: citationPricingDate(c, d) }).kind === "priced",
  ).ordinance;
  editCitation(d, "r59", "ord", nextOutside);
  c = charge(d);
  assert.equal(c.differentChargeSource, undefined, "A different charge's approval cannot authorize another outside ordinance");
  assert.ok(citationPricing.chargeFault(d, d.items[0], c), "The new different charge requires its own confirmation");
  const singleSection = draft([FIXED]);
  editCitation(singleSection, "r59", "ord", "27.04(2)(c)");
  editCitation(singleSection, "r59", "differentChargeSource", "Synthetic first different-charge approval");
  editCitation(singleSection, "r59", "ord", nextOutside);
  assert.equal(charge(singleSection).differentChargeSource, undefined, "Single-section free-text charge changes also clear prior approval");
  WriterState.DOCS = WriterState.DOCS.filter((x) => x.id !== singleSection.id);
  WriterState.state.docId = d.id;
  view = show(d);
  fire(view.querySelector('[data-review-cit="r59|ord"]'), FIXED);
  ok(
    "Choosing a section again retires the different-charge confirmation",
    d.cits.r59.ord === FIXED && !Object.hasOwn(d.cits.r59, "differentChargeSource"),
  );

  // A blank saved draft reopens with no selection and stays blocked.
  const blank = JSON.parse(JSON.stringify(draft(sections)));
  view = show(blank);
  ok(
    "A saved draft without a choice reopens unselected and blocked",
    view.querySelector('[data-deposit-form="r59"] select[name="ord"]').value === "" &&
      blockers(blank).some((x) => /choose the charged ordinance from its sections/.test(x.t)),
  );

  // A failed schedule lookup is a validation concern, never a guessed amount.
  const late = draft(sections);
  late.depositRequests.r59.issued = "2026-02-30";
  WriterState.state.docId = late.id;
  view = show(late);
  fire(view.querySelector('[data-deposit-form="r59"] select[name="ord"]'), FIXED, ["change"]);
  request = late.depositRequests?.r59;
  ok(
    "An unreadable pricing date leaves the charge incomplete with its reason",
    !late.cits?.r59 && /valid pricing date/.test(request?.reason) && !Object.hasOwn(request, "amount"),
  );
  console.log(checks + " R59 charge selection assertions passed.");
  process.exit(0);
};
eval(payload + "\n(" + test.toString() + ")().catch(e=>{console.error(e);process.exit(1);})");
