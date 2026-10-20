/* R51 test fixture only: alter host font metrics without changing production rendering. */
const r51FrameDocument = Object.getOwnPropertyDescriptor(HTMLIFrameElement.prototype, "contentDocument");
Object.defineProperty(HTMLIFrameElement.prototype, "contentDocument", {
  get() {
    const doc = r51FrameDocument.get.call(this);
    if (doc && !doc.__r51Write) {
      const write = doc.write.bind(doc);
      doc.write = (...parts) =>
        write(
          ...parts.map((part) => {
            if (window.__r51Metric === "native" || !window.__r51Metric) return part;
            const size = window.__r51Metric === "compact" ? "8pt" : "11pt";
            return String(part).replace(
              "</head>",
              "<style data-r51-font-metric>.snow-cover,.snow-cover *,.snow-sheet .n-notes,.snow-sheet .n-notes *{font-size:" +
                size +
                "!important;line-height:1.08!important}</style></head>",
            );
          }),
        );
      doc.__r51Write = true;
    }
    return doc;
  },
});
function inspectPrintPacket(source, citation = true) {
  const frame = document.createElement("iframe");
  frame.style.cssText = "position:absolute;left:-20000px;top:0;width:1400px;height:1200px;border:0";
  document.body.appendChild(frame);
  try {
    const doc = frame.contentDocument;
    doc.open();
    doc.write(source);
    doc.close();
    const pages = [...doc.querySelectorAll(".sheet,.cit")];
    const geometry = pages.map((sheet) => {
      const box = sheet.getBoundingClientRect();
      let clipped = false;
      const walker = doc.createTreeWalker(sheet, NodeFilter.SHOW_TEXT);
      while (walker.nextNode()) {
        const text = walker.currentNode;
        if (!text.textContent.trim() || !text.parentElement.getClientRects().length) continue;
        const range = doc.createRange();
        range.selectNodeContents(text);
        for (const rect of range.getClientRects()) {
          if (rect.width < 1 || rect.height < 1) continue;
          if (rect.left < box.left - 2 || rect.right > box.right + 2 || rect.top < box.top - 2 || rect.bottom > box.bottom + 2) clipped = true;
          for (let parent = text.parentElement; parent && parent !== sheet; parent = parent.parentElement) {
            const style = frame.contentWindow.getComputedStyle(parent);
            if ([style.overflowX, style.overflowY].some((value) => value === "hidden" || value === "clip")) {
              const clip = parent.getBoundingClientRect();
              if (rect.left < clip.left - 2 || rect.right > clip.right + 2 || rect.top < clip.top - 2 || rect.bottom > clip.bottom + 2)
                clipped = true;
            }
          }
        }
      }
      return {
        height: box.height,
        overflow: sheet.scrollHeight > sheet.clientHeight + 2 || sheet.scrollWidth > sheet.clientWidth + 2,
        clipped,
        continuation: !sheet.classList.contains("cont") || !!sheet.querySelector(".n-cont"),
        orphan:
          sheet.classList.contains("snow-sheet") &&
          !sheet.textContent
            .replace(sheet.querySelector(".n-cont")?.textContent || "", "")
            .replace(sheet.querySelector(".n-foot")?.textContent || "", "")
            .trim(),
      };
    });
    const covers = [...doc.querySelectorAll(".snow-cover")];
    return {
      citation,
      copies: doc.querySelectorAll(".cit").length,
      covers: doc.querySelectorAll(".snow-sheet").length,
      geometry,
      coverParagraphs: covers.flatMap((cover) => [...cover.querySelectorAll("p")].map((p) => p.outerHTML)),
      coverRows: covers.flatMap((cover) => [...cover.querySelectorAll("tbody tr")].map((row) => row.outerHTML)),
      coverNotes: [...doc.querySelectorAll(".sheet .n-notes")].map((node) => node.outerHTML),
      courtHTML: [...doc.querySelectorAll(".cit")].map((copy) => copy.outerHTML),
    };
  } finally {
    frame.remove();
  }
}
/* Deterministic synthetic document families; no dates or identities are migrated. */
function fixedPrintFixtures(metric = "native") {
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
      const authored = documentHTML(d);
      window.__r51Metric = variant.snow && authoringVersion === 9 ? metric : "native";
      const job = printJob(d),
        html = new DOMParser().parseFromString(job.html, "text/html");
      if (variant.snow && authoringVersion === 9) window.__r51LastSnow = job.html;
      const style = html.querySelector("head style")?.textContent || "";
      if (styles && style !== styles) throw new Error("Print family styles disagree");
      styles = style;
      out.push({
        authoringVersion,
        type,
        snow: !!variant.snow,
        authored,
        body: html.body.outerHTML,
        layout: inspectPrintPacket(job.html, type === "citation"),
        copies: html.querySelectorAll(".cit").length,
        sheets: html.querySelectorAll(".sheet").length,
      });
    }
  window.__r51Metric = "native";
  return { styles, results: out };
}
