/* Consolidation Phase 4 (C1): one live referred-case predicate. A case is referred when it has an effective referral
   or referral update; drafts, voided and superseded documents and other document types do not count, and other
   cases never do. isReferredCase matches each of the three spellings it replaced for every document state, and the
   correction check keeps its source-document exclusion. Synthetic data. */
globalThis.MADISON_TEST_DATA = true;
require("../fixtures/bundle_test.cjs")(`
  const replaced = [
    (cid) => docsFor(cid).some((x) => isEffective(x) && isHistoryDoc(x)),
    (cid) => docsFor(cid).some((x) => !x.draft && !x.void && !x.superseded && isHistoryDoc(x)),
    (cid) => docsFor(cid).some((d) => !d.draft && !d.void && !d.superseded && (d.type === "referral" || d.type === "referralUpdate")),
  ];
  const states = {
    issued: {},
    draft: { draft: true },
    voided: { void: true },
    superseded: { superseded: true },
    "voided draft": { draft: true, void: true },
  };
  const types = ["referral", "referralUpdate", "notice", "extension", "citation", "compliance", "bestInterestExtension", "noOccupancy"];
  let n = 0;
  for (const type of types)
    for (const [state, flags] of Object.entries(states)) {
      WriterState.DOCS = [
        { id: "d" + ++n, caseId: "k1", type, items: [], ...flags },
        { id: "other" + n, caseId: "k2", type: "referral", items: [] },
      ];
      const expected = (type === "referral" || type === "referralUpdate") && state === "issued";
      assert.equal(isReferredCase("k1"), expected, type + " " + state);
      replaced.forEach((old, i) => assert.equal(isReferredCase("k1"), old("k1"), "spelling " + i + ": " + type + " " + state));
      assert.equal(isReferredCase("k2"), true, "the other case's own referral");
      assert.equal(isReferredCase("k3"), false, "a case with no documents");
    }
  // A superseded referral with its effective correction still counts; a voided one with no replacement does not.
  WriterState.DOCS = [
    { id: "r1", caseId: "k1", type: "referral", items: [], superseded: true },
    { id: "r2", caseId: "k1", type: "referral", items: [] },
  ];
  assert.equal(isReferredCase("k1"), true);
  WriterState.DOCS = [{ id: "r1", caseId: "k1", type: "referral", items: [], void: true }];
  assert.equal(isReferredCase("k1"), false);

  // Source exclusion: correcting the case's only referral is not blocked by that referral itself.
  const source = { id: "src", caseId: "k1", type: "referral", items: [], fromReinspId: "v1" };
  WriterState.DOCS = [source];
  assert.equal(isReferredCase("k1"), true, "live state: the case is referred");
  for (const type of ["extension", "referral", "referralUpdate", "compliance"])
    assert.equal(correctionTypeAllowed(source, type), true, "correcting the only referral may become " + type);
  // With an earlier effective referral, a correction may only become a referral update or compliance letter.
  WriterState.DOCS = [source, { id: "earlier", caseId: "k1", type: "referral", items: [] }];
  assert.equal(correctionTypeAllowed(source, "extension"), false);
  assert.equal(correctionTypeAllowed(source, "referralUpdate"), true);
  assert.equal(correctionTypeAllowed(source, "compliance"), true);
  console.log("PASS isReferredCase matches the replaced spellings; correction checks keep the source exclusion");
`);
