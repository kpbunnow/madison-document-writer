module.exports = function () {
  WriterState.CASES = [];
  WriterState.DOCS = [];
  WriterState.REINSP = [];
  WriterState.EVENTS = {};
  WriterState.PENDING = [];
  WriterState.RECORD_ATTEMPTS = {};
  WriterState.ARTIFACT_LOCATIONS = {};
  WriterState.ARTIFACT_VERIFY = {};
  WriterState.WORK = { entry: {}, acc: null, recordForms: {} };
  WriterState.HELPER = null;
  WriterState.CASEDIR = null;
  WriterState.NEEDGRANT = false;
  for (let n = 0; n < 32; n++) {
    const id = "queue-" + n,
      k = {
        id,
        number: "CB2026-100-" + String(n).padStart(5, "0"),
        address: 100 + n + " EXAMPLE LANE",
        owner: "SYNTHETIC OWNER " + n,
        parcel: "070822219101",
        inspectorId: "i4",
        date: recordDay(today),
        time: "09:00",
      };
    WriterState.CASES.push(k);
    const d = {
      id: "qdoc-" + n,
      caseId: id,
      type: "notice",
      created: recordDay(today),
      mailed: recordDay(today),
      draft: n % 6 === 0,
      status: n % 6 === 0 ? "Draft" : "Final",
      filedAt: "filed",
      items: [
        {
          id: "qitem-" + n,
          no: "1",
          title: "Repair porch",
          text: "Repair the porch railing.",
          sections: ["27.05(2)(c)"],
          due: addDays(recordDay(today), n % 6 === 1 ? -3 : n % 6 === 2 ? 3 : 30),
        },
      ],
      cits: {},
      filedArtifact: { filename: "Synthetic " + n + ".pdf", sha256: "a".repeat(64) },
    };
    WriterState.DOCS.push(d);
    WriterState.ARTIFACT_LOCATIONS[d.id] = ["shared"];
    if (n % 6 === 3) WriterState.PENDING.push({ cid: id, name: k.number + ".json", at: nowISO(), body: "{}" });
    if (n % 6 === 4) d.filedAt = null;
    if (n % 6 === 5) {
      d.filedArtifact = { filename: "Synthetic " + n + ".pdf", sha256: "a".repeat(64) };
      WriterState.ARTIFACT_LOCATIONS[d.id] = ["local"];
    }
  }
  WriterState.state = {
    ...WriterState.state,
    screen: "cases",
    caseFilter: "attention",
    metric: "",
    caseQ: "",
    caseInspector: "",
    modal: null,
    docId: null,
    reinspId: null,
    acc: null,
  };
  render();
};
