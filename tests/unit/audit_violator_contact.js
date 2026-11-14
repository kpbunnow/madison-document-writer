/* The Violator contact: one entry on the copies list marked Violator replaces the property owner as the main contact
   in the mailing block and as the citation defendant; a snow removal case ignores it; the owner is copied unless the
   case says otherwise; and the pricing respondent follows the Violator (the same keys are asserted in Python by
   audit_violator_pricing.py). Pure rules only; the screens are covered in browser_violator.js. */
const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  { compile } = require("../fixtures/equivalence_harness.cjs");

(async () => {
  const api = await compile(
    'export {violatorOf, copiesOf, violatorActive, copiesOwner, setCopyKind, defendantName, isLLC, ownerLines, cleanOwnerAddress} from "./mailing_rules.js";' +
      'export {defendantLines, ownerCopy, cleanOwnerCopyLines, ownerMailingLines} from "./defendant_contact.js"; export {defendantKey, respondentKey} from "./citation_policy.js";',
  );
  const owner = { owner: "SYNTHETIC OWNER", ownerAddr: ["100 TEST ST", "MADISON WI 53703"] };
  const violator = { kind: "Violator", name: "THE VIOLATOR", addr: "55 second st", city: "madison, wi 53704" };
  const copy = { kind: "Copy", name: "A COPY", addr: "9 OTHER AVE", city: "MADISON WI 53705" };
  const withList = (list, extra = {}) => ({ ...owner, ...extra, ccList: list });

  // Who is the Violator.
  assert.equal(api.violatorOf(owner), null);
  assert.equal(api.violatorOf(withList([copy])), null);
  assert.equal(api.violatorOf(withList([copy, violator])), violator);
  assert.deepEqual(api.copiesOf(withList([copy, violator, { name: "NO TYPE" }])), [copy, { name: "NO TYPE" }]);
  assert.equal(api.violatorActive(withList([violator])), true);
  assert.equal(api.violatorActive(withList([violator], { caseType: "snow-10.28" })), false, "snow removal cases cite the property owner");
  assert.equal(api.violatorActive(withList([copy])), false);
  assert.equal(api.violatorActive(null), false);
  assert.equal(api.violatorOf({ ...owner, ccList: ["x", null, 3] }), null, "a malformed copy list is ignored");

  // One Violator per case: marking another demotes the first; marking Copy clears the type.
  const list = [{ ...violator }, { ...copy }, { name: "THIRD" }];
  api.setCopyKind({ ccList: list }, 2, "Violator");
  assert.deepEqual(
    list.map((c) => c.kind),
    ["Copy", "Copy", "Violator"],
  );
  api.setCopyKind({ ccList: list }, 2, "Copy");
  assert.deepEqual(
    list.map((c) => c.kind),
    ["Copy", "Copy", "Copy"],
  );
  api.setCopyKind({ ccList: list }, 9, "Violator");
  api.setCopyKind({ ccList: list }, 0, "anything else");
  assert.equal(list[0].kind, "Copy", "only Violator is a special type");

  // The name documents and citations are addressed to, and the company rule that follows it.
  assert.equal(api.defendantName(owner), "SYNTHETIC OWNER");
  assert.equal(api.defendantName(withList([violator])), "THE VIOLATOR");
  assert.equal(api.defendantName(withList([violator], { caseType: "snow-10.28" })), "SYNTHETIC OWNER");
  assert.equal(api.isLLC({ ...owner, owner: "ACME HOLDINGS LLC" }), true);
  assert.equal(api.isLLC(withList([violator], { owner: "ACME HOLDINGS LLC" })), false, "a person as Violator needs no registered agent");
  assert.equal(api.isLLC(withList([{ ...violator, name: "THE VIOLATOR INC" }])), true, "a company as Violator needs one");

  // The mailing block and citation defendant lines.
  assert.deepEqual(api.defendantLines(owner), ["SYNTHETIC OWNER", "100 TEST ST", "MADISON WI 53703"]);
  assert.deepEqual(api.defendantLines(withList([copy])), api.ownerLines(withList([copy])), "a copy changes nothing");
  assert.deepEqual(
    api.defendantLines(withList([violator]), false),
    ["THE VIOLATOR", "55 second st", "madison, wi 53704"],
    "issued documents print the stored lines",
  );
  assert.deepEqual(
    api.defendantLines(withList([violator]), true),
    ["THE VIOLATOR", "55 Second St", "Madison, WI 53704"],
    "drafts show the standardized lines",
  );
  assert.deepEqual(api.defendantLines(withList([violator], { caseType: "snow-10.28" })), ["SYNTHETIC OWNER", "100 TEST ST", "MADISON WI 53703"]);

  // The owner is copied beside a Violator unless the case turns that off.
  assert.equal(api.ownerCopy(owner), null);
  assert.equal(api.ownerCopy(null), null);
  assert.deepEqual(
    api.cleanOwnerCopyLines({ ...owner, ownerAddr: "100 TEST ST" }),
    ["SYNTHETIC OWNER", "100 TEST ST"],
    "legacy scalar mailing lines retain their original shape semantics",
  );
  assert.equal(api.ownerCopy(withList([copy])), null, "no Violator, no owner copy");
  assert.deepEqual(api.ownerCopy(withList([violator])), { lines: ["SYNTHETIC OWNER", "100 TEST ST", "MADISON WI 53703"], owner: true });
  assert.equal(api.copiesOwner(withList([violator])), true, "ticked by default");
  assert.equal(api.copiesOwner(withList([violator], { copyOwner: true })), true);
  assert.equal(api.ownerCopy(withList([violator], { copyOwner: false })), null);
  assert.equal(api.ownerCopy(withList([violator], { caseType: "snow-10.28" })), null, "snow removal prints the owner as the defendant already");
  assert.equal(api.ownerCopy({ ccList: [violator] }), null, "nothing to copy when the case has no owner lines");

  const duplicate = withList([violator], { ownerAddr: ["7105 EXAMPLE DR", " 7105   example dr ", "UNIT 2", "MADISON, WI 53717"] });
  const original = JSON.stringify(duplicate);
  const cleaned = api.cleanOwnerCopyLines(duplicate);
  assert.deepEqual(cleaned, ["SYNTHETIC OWNER", "7105 EXAMPLE DR", "UNIT 2", "MADISON, WI 53717"]);
  assert.equal(JSON.stringify(duplicate), original, "cleaning a derived CC never mutates case facts");
  assert.deepEqual(api.ownerCopy(duplicate).lines, api.ownerLines(duplicate), "the default preserves old issued rendering");
  assert.deepEqual(api.ownerCopy(duplicate, cleaned).lines, cleaned, "a new draft or retained cleaned fact uses the corrected lines");
  assert.deepEqual(
    api.cleanOwnerCopyLines({ owner: "SAME NAME", ownerAddr: ["SAME NAME", "C/O MANAGER", "UNIT 2", "100 TEST ST", "UNIT 2"] }),
    ["SAME NAME", "SAME NAME", "C/O MANAGER", "UNIT 2", "100 TEST ST", "UNIT 2"],
    "names, care-of, units and nonconsecutive lines are retained",
  );
  // Three- and four-line owner addresses: the report can repeat the street line further down (owner report after R82).
  const fourLine = { owner: "SYNTHETIC OWNER", ownerAddr: ["C/O MANAGER", "7105 EXAMPLE DR", "UNIT 2", "7105 Example Dr.", "MADISON WI 53717"] };
  const fourBefore = JSON.stringify(fourLine);
  const printedFour = ["SYNTHETIC OWNER", "C/O MANAGER", "7105 EXAMPLE DR", "UNIT 2", "MADISON WI 53717"];
  assert.deepEqual(api.defendantLines(fourLine, true), printedFour, "a draft mailing block prints the street line once");
  assert.deepEqual(api.defendantLines(fourLine, false), api.ownerLines(fourLine), "older issued documents keep their original lines");
  assert.deepEqual(api.defendantLines(fourLine, false, printedFour), printedFour, "issued documents print their retained lines");
  assert.deepEqual(api.ownerMailingLines(fourLine), printedFour);
  assert.equal(api.ownerMailingLines(owner), null, "nothing is retained when no line repeats");
  assert.equal(JSON.stringify(fourLine), fourBefore, "raw case facts are unchanged");
  assert.deepEqual(api.cleanOwnerAddress(["PO BOX 555", "SUITE 0100", "P.O. Box 555", "MADISON, WI 53701", "MADISON WI 53701"]), [
    "PO BOX 555",
    "SUITE 0100",
    "MADISON, WI 53701",
  ]);
  assert.deepEqual(api.cleanOwnerAddress(["123 MAIN ST", "", "  ", "123  main st", "MADISON WI 53703"]), ["123 MAIN ST", "MADISON WI 53703"]);
  assert.deepEqual(
    api.cleanOwnerAddress(["SECOND OWNER", "123 MAIN ST APT 2", "123 MAIN ST", "MADISON WI 53703"]),
    ["SECOND OWNER", "123 MAIN ST APT 2", "123 MAIN ST", "MADISON WI 53703"],
    "only an identical line is a repeat",
  );
  for (const unit of ["2ND FLOOR", "3 FL", "4TH FLR", "5 ROOM", "6 SUITE"]) {
    const lines = ["10 MAIN ST", unit, "20 OTHER ST", unit, "10 Main St.", "MADISON WI 53703"];
    assert.deepEqual(
      api.cleanOwnerAddress(lines),
      lines.filter((_, index) => index !== 4),
      "a numbered unit is not a street: " + unit,
    );
  }
  assert.deepEqual(api.cleanOwnerAddress(["12 2ND ST", "UNIT 3", "12 2nd St."]), ["12 2ND ST", "UNIT 3"], "numbered streets still deduplicate");
  assert.equal(api.INSPECTORS.find((i) => i.name === "STEPHEN SUNDSTROM").badge, "5603");

  // Pricing respondent: shared cases, asserted identically in Python.
  const shared = JSON.parse(fs.readFileSync("tests/fixtures/violator_cases.json", "utf8"));
  for (const { name, case: k, key } of shared.cases) assert.equal(api.defendantKey(k), key, name);
  const ownerKeyOnly = shared.cases.filter((c) => !c.case.ccList?.some?.((x) => x && x.kind === "Violator") || c.case.caseType);
  for (const { name, case: k } of ownerKeyOnly) assert.equal(api.defendantKey(k), api.respondentKey(k), "the owner key is unchanged: " + name);
  assert.equal(api.respondentKey(withList([violator])), "100 TEST ST|53703", "the case summary and Reports keep the owner key");
  console.log("PASS Violator contact rules: type, snow exclusion, defendant lines, owner copy, company rule and pricing respondent");
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
