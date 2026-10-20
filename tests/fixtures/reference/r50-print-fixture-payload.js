/* Deterministic synthetic document families; no dates or identities are migrated. */
function fixedPrintFixtures() {
  const day = "2026-10-16";
  WriterState.CASES = [
    {
      id: "compat-case",
      number: "QA-R50-PRINT",
      address: "4200 SYNTHETIC LANE",
      parcel: "070822219105",
      owner: "SYNTHETIC OWNER",
      ownerAddr: ["4200 SYNTHETIC LANE", "MADISON WI 53703"],
      inspectorId: "i4",
      date: day,
      time: "09:00",
      emails: [],
    },
  ];
  WriterState.DOCS = [];
  WriterState.REINSP = [];
  WriterState.EVENTS = {};
  const out = [];
  let styles = "";
  const variants = DOC_TYPES.map((t) => ({ type: t.id })).concat([{ type: "citation", snow: true }]);
  for (const authoringVersion of [6, 7, 8, 9, 10, 11])
    for (const variant of variants) {
      if (variant.snow && authoringVersion < 9) continue;
      const type = variant.type;
      const d = {
        id: "compat-" + authoringVersion + "-" + type + (variant.snow ? "-snow" : ""),
        caseId: WriterState.CASES[0].id,
        type,
        authoringVersion,
        created: day,
        mailed: day,
        issuedAt: day + "T14:00:00Z",
        draft: false,
        status: "Final",
        inspDate: day,
        inspTime: "09:00",
        items: [
          {
            id: "compat-item",
            no: "1",
            title: "Wall maintenance",
            text: "Repair the damaged exterior wall.",
            sections: ["27.05(2)(c)"],
            due: addDays(day, 21),
            done: type === "compliance",
            doneOn: day,
            cite: type === "citation",
          },
        ],
        cits: {},
        special: {
          scope: "building",
          affected: ["1"],
          findings: "Synthetic unsafe condition.",
          authority: "27.05",
          work: "Correct the synthetic condition",
          orderDue: addDays(day, 21),
          extensionDue: addDays(day, 30),
          reason: "Synthetic approved continuation.",
          mode: "restrict",
          occupancy: "No occupancy until the listed conditions are corrected.",
        },
      };
      if (variant.snow) {
        d.caseType = "snow-10.28";
        d.snow = { snowfallDate: "2026-10-14", inches: 0.8, condition: "snow covered", photographed: true, cornerNotCleared: false };
        Object.assign(d.items[0], {
          libraryKey: '["ENF_PM_PROPMAINT","SNOW",1]',
          sections: ["10.28"],
          title: "Snow removal",
          due: null,
          dueExempt: "snow-10.28",
        });
      }
      if (type === "citation")
        d.cits["compat-item"] = {
          num: "AB123456",
          ord: variant.snow ? "10.28" : "27.05(2)(c)",
          desc: variant.snow ? "SNOW REMOVAL" : "WALL MAINTENANCE",
          amount: "197.00",
          issued: day,
          pricedOn: day,
          violDate: day,
          violTime: "09:00",
          courtDate: nextCourtDate(day),
          courtTime: "08:30",
          deptId: "1234",
          depositMode: "schedule",
          base: "100.00",
          cc: true,
        };
      WriterState.DOCS = [d];
      if (type === "citation") {
        d.draft = true;
        d.status = "Draft";
        applyDeposit(d, "compat-item", variant.snow ? "10.28" : "27.05(2)(c)");
        d.draft = false;
        d.status = "Final";
      }
      d.frozen = freezeSources(d);
      WriterState.state.docId = d.id;
      WriterState.state.screen = "write";
      const job = printJob(d),
        html = new DOMParser().parseFromString(job.html, "text/html");
      const style = html.querySelector("head style")?.textContent || "";
      if (styles && style !== styles) throw new Error("Print family styles disagree");
      styles = style;
      out.push({
        authoringVersion,
        type,
        snow: !!variant.snow,
        body: html.body.outerHTML,
        copies: html.querySelectorAll(".cit").length,
        sheets: html.querySelectorAll(".sheet").length,
      });
    }
  return { styles, results: out };
}
