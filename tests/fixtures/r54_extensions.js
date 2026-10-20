/* Synthetic extension rendering facts; no production records. */
module.exports = function makeR54Fixture() {
  newDoc("k1", "notice");
  const original = clone(doc(WriterState.state.docId));
  original.id = "r54-extension-fixture";
  original.draft = false;
  original.mailed = "2026-10-20";
  original.inspDate = "2026-10-20";
  original.inspTime = "10:00";
  original.items = [
    {
      id: "r54-open",
      no: "1",
      sections: ["27.05(2)(c)"],
      text: "Repair the synthetic porch condition.",
      group: "Exterior",
      abate: true,
      due: "2026-11-20",
      note: "Synthetic inspection note retained in the table.",
      noteOn: "2026-10-20",
    },
    {
      id: "r54-corrected",
      no: "2",
      sections: ["27.05(2)(c)"],
      text: "Repair the synthetic gutter condition.",
      group: "Exterior",
      due: "2026-10-21",
      done: true,
      doneOn: "2026-10-19",
    },
  ];
  original.special = {
    scope: "building",
    affected: ["1"],
    stage: "administrative",
    reason: "Synthetic approved repair plan.",
    deadlineMode: "dated",
    originalDues: { 1: "2026-10-21" },
    conditions: "Synthetic approved vacancy conditions.",
    transferClause: "Synthetic approved transfer clause.",
    reviewDate: "2026-11-27",
    signerName: "Synthetic supervisor",
    signerTitle: "Synthetic supervisory title",
  };
  return original;
};
