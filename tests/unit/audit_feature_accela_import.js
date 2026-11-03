/* Feature suite (Consolidation Phase 6): Accela inspection import: workbook parsing and columns, type/status routing and case rules, candidate selection, stale-state races and repaint.
   Each scenario runs in its own process with a fresh bundle, DOM, state, storage and mocks
   (tests/fixtures/scenarios.cjs). Labels name the suite each scenario came from; its code is unchanged. */
require("../fixtures/scenarios.cjs").run(__filename, {
  "audit_import.js: Accela/SSRS workbook import, routing and draft creation": () => {
    globalThis.MADISON_TEST_DATA = true;
    // Consolidation Phase 2 (T1): run remaining long UI timers once the suite completes instead of waiting.
    const { settle } = require("../fixtures/settle_ui_timers.cjs");
    const fs = require("fs"),
      path = require("path");
    const { JSDOM } = require("jsdom");
    const { builtPage, bundleSource } = require("../fixtures/built_bundle.cjs");
    const html = builtPage(),
      src = bundleSource(html);
    const CSS = /<style>([\s\S]*?)<\/style>/.exec(html)[1];
    const dom = new JSDOM(
      "<!doctype html><html><head><style>" +
        CSS +
        "</style></head>" +
        '<body><div id="app"></div><div id="overlay"></div><div id="toast"></div></body></html>',
      { pretendToBeVisual: true, url: "http://127.0.0.1:8777/" },
    );
    const w = dom.window;
    global.window = w;
    global.document = w.document;
    global.getSelection = () => w.getSelection();
    global.Blob = function () {};
    global.URL = { createObjectURL: () => "b", revokeObjectURL() {} };
    global.FileReader = w.FileReader;
    global.confirm = () => true;
    global.indexedDB = undefined;
    global.fetch = async () => {
      throw 0;
    };
    global.DOMParser = w.DOMParser;
    Object.defineProperty(w.HTMLElement.prototype, "scrollHeight", {
      configurable: true,
      get() {
        if (!this.classList || !this.classList.contains("sheet")) return 0;
        let h = 105;
        Array.prototype.forEach.call(this.children, (c) => {
          if (c.classList && (c.classList.contains("no-print") || c.classList.contains("addrow"))) return;
          if (c.tagName === "TABLE") {
            h += 26;
            const tb = c.querySelector("tbody");
            if (tb) h += tb.children.length * 60;
          } else h += 70;
        });
        return h;
      },
    });
    Object.defineProperty(w.HTMLElement.prototype, "clientWidth", {
      configurable: true,
      get() {
        return 900;
      },
    });
    global.CSSTEXT = CSS;

    /* ---------- fixtures: report grids, each variant built here ----------
       The spreadsheet file import was removed (R69). The case lookup hands the report rows to the same table reader as a
       grid, so a variant is a header row and data rows placed at a chosen row and column. Numbers are written as {n}. */
    function fxXlsx(opt) {
      const hr = opt.headerRow || 3,
        sc = opt.startCol === undefined ? 1 : opt.startCol;
      const line = (vals) => new Array(sc).fill(null).concat(vals.map((v) => (v && typeof v === "object" ? v.n : v)));
      const grid = [[""]];
      while (grid.length < hr - 1) grid.push([]);
      grid.push(line(opt.header));
      opt.rows.forEach((r) => grid.push(line(r)));
      return { grid };
    }
    const fxFile = (name) =>
      JSON.parse(
        fs.readFileSync(path.join(require("path").resolve(__dirname, "../.."), "tests/fixtures/reference/import-grids", name + ".grid.json"), "utf8"),
      );
    const loadGrid = require("../fixtures/report_grid_loader.cjs").createReportGridLoader({
      getState: () => WriterState.state,
      cancelLookup: () => cancelCaseLookup(),
      readTable: (grid) => accelaTable(grid),
      readShare: () => accelaFromShare(),
    });
    const H15 = [
      "Case Number",
      "Inspector Name",
      "Site Address",
      "Zoning District",
      "Historic District",
      "Landmark",
      "Parcel Number",
      "Case Description",
      "Detailed Description",
      "Owner Name",
      "Owner Address",
      "Inspection Type",
      "Inspection Date",
      "Inspection Status",
      "Inspection Time",
    ];
    function fxCase(o) {
      const base = [
        o.number || "CB2026-180-02537",
        null,
        o.address || "5322 Valley Edge DR, Madison, WI 53704",
        "SR-C2",
        o.historic || "No",
        o.landmark || "",
        o.parcel || "081034111097",
        "Complaint",
        "SECRET-NARRATIVE line one\nline two",
        o.owner || "CARR, ALFRED",
        o.ownerAddr || "5322 VALLEY EDGE DR\nMADISON, WI 53704",
      ];
      return o.insp.map((x) => {
        const r = base.slice();
        r[1] = x[0];
        return r.concat([x[1], x[2] === null ? "" : { n: x[2] }, x[3], x[4]]);
      });
    }
    const I02537 = [
      ["Robert Ales", "Initial Inspection", 46203.4513888889, "Official Notice", "10:50AM"],
      ["Robert Ales", "Reinspection", 46225.4861111111, "Citation", "11:40AM"],
      ["Robert Ales", "Reinspection", 46245.4715277778, "Extension Processing", "11:19AM"],
      ["Robert Ales", "Reinspection", 46252.3368055556, "Extension Processing", "8:05AM"],
      ["Robert Ales", "Reinspection", 46253.4972222222, "Compliance", "11:56AM"],
    ];
    const FX02537 = { grid: fxFile("fx02537") };
    const FX03868 = { grid: fxFile("fx03868") };
    const FX03868_OPENPYXL = { grid: fxFile("fx03868-openpyxl") };
    async function ACC_TESTS() {
      var fails = [];
      function H(t) {
        console.log("\n=== " + t + " ===");
      }
      function ok(l, c, x) {
        console.log("  " + (c ? "ok   " : "FAIL ") + l + (x !== undefined && !c ? "   " + x : ""));
        if (!c) fails.push(l);
      }
      function items(N, n, text) {
        for (var i = 0; i < n; i++)
          N.items.push({
            id: uid("x"),
            group: "",
            sections: ["27.05(2)(c)"],
            title: "Item " + (i + 1),
            abate: false,
            due: futureDue(iso(today), 21),
            text: text || "Clean it.",
            prov: "notice",
          });
        renumber(N);
      }
      const load = loadGrid;
      const ser = (d, t) => {
        const p = d.split("-").map(Number),
          m = t ? +t.slice(0, 2) * 60 + +t.slice(3) : 0;
        return (Date.UTC(p[0], p[1] - 1, p[2]) - Date.UTC(1899, 11, 30)) / 864e5 + m / 1440;
      };
      const click = (el) => el.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
      const forget = (num) => {
        const k = WriterState.CASES.find((c) => c.number === num);
        if (!k) return;
        WriterState.CASES = WriterState.CASES.filter((c) => c !== k);
        delete WriterState.EVENTS[k.id];
        WriterState.DOCS = WriterState.DOCS.filter((d) => d.caseId !== k.id);
        WriterState.REINSP = WriterState.REINSP.filter((r) => r.caseId !== k.id);
        project();
      };
      const fx02537 = (o) => fxXlsx(Object.assign({ header: H15, rows: fxCase({ insp: I02537 }) }, o || {}));

      H("Time primitives");
      {
        const s = accSerial(46225.4861111111);
        ok("07/22 serial 11:39:59.999 reads 11:40", s && s.date === "2026-07-22" && accHM(s.mins) === "11:40", JSON.stringify(s));
        const e = accSerial(46203.99999999);
        ok("a hair before midnight rolls to the next day, 00:00", e.date === "2026-07-01" && e.mins === 0, JSON.stringify(e));
        ok("text time with seconds and PM", accTime("1:12:00 PM") === "13:12" && accTime("10:50AM") === "10:50");
        const w1 = accWhen("9/16/2026 11:12:00 AM", "");
        ok(
          "text date with time after a re-save: R36 takes the date only; time comes from Inspection Time",
          w1.date === "2026-09-16" && w1.time === "" && w1.warn === "",
          JSON.stringify(w1),
        );
        ok("parcel with dashes", accParcel("070913125237").v === "0709-131-2523-7" && !accParcel("070913125237").warn);
        const p11 = accParcel(81034111097);
        ok("parcel that lost its leading zero is kept raw with a warning", p11.v === "81034111097" && !!p11.warn);
      }

      H("The 03868 report, as SSRS writes it");
      {
        fresh0();
        const acc = await load(FX03868, "CB2026-254-03868.xlsx");
        ok("no read errors", acc.errors.length === 0, acc.errors.join("|"));
        const c = acc.cases[0];
        // R62 (owner, Development 3): the report's undated Pending row is hidden rather than listed as unavailable.
        ok("one case; the undated Pending row is hidden", acc.cases.length === 1 && c.rows.length === 1 && c.rows[0].typeKey === "initial");
        ok("the defined Official Notice result is selected", acc.sel === c.rows[0].i);
        let p = accelaPlan(acc);
        ok("the actual report result is importable without changing its status", p.blockers.length === 0);
        ok("the hidden Pending row cannot be selected", !selectImportInspection(1) && acc.sel === c.rows[0].i);
        p = accelaPlan(acc);
        ok("Official Notice is a valid inspection result rather than proof of prior program issuance", p.blockers.length === 0);
        // Retain the actual exported source status throughout the import.
        const f = p.f;
        ok("address is number and street", f.address === "1155 WILLIAMSON ST", f.address);
        ok("site city kept for reference", f.siteCity === "MADISON, WI 53703", f.siteCity);
        ok("parcel formatted", f.parcel === "0709-131-2523-7", f.parcel);
        ok("owner as delivered, no suffix added", f.owner === "1155 WILLIAMSON STREET");
        ok("owner mailing block, ZIP+4", JSON.stringify(f.ownerAddr) === JSON.stringify(["924 E MIFFLIN ST", "MADISON, WI 53703-2346"]));
        ok("description as Accela gives it", f.description === "Complaint");
        ok("historic district named", f.historic === true && f.historicDistrict === "Third Lake Ridge");
        ok("no landmark", f.landmark === "");
        ok("initial inspection 09/16/2026 11:12", p.date === "2026-09-16" && p.time === "11:12");
        ok("inspector matched to ABBIE KURTZ", p.row.inspectorId === "i10");
        ok("next step is a new notice", p.next === "notice");
        WriterState.state.screen = "import";
        render();
        ok(
          "review panel renders with the Confirm button enabled",
          !!document.getElementById("acc-go") && !document.getElementById("acc-go").disabled,
        );
        ok("detailed description not shown", !document.getElementById("app").textContent.includes("Large items"));
        await confirmDatabaseCase();
        const k = WriterState.CASES.find((x) => x.number === "CB2026-254-03868");
        ok("case created", !!k && k.address === "1155 WILLIAMSON ST" && k.inspectorId === "i10" && k.date === "2026-09-16" && k.time === "11:12");
        // R62: like Scheduled rows, a hidden row is not part of the retained import reference.
        ok("history kept as reference, not events", k.accela && k.accela.inspections.length === 1 && eventsFor(k.id).length === 0);
        ok(
          "a notice was opened",
          WriterState.state.screen === "write" &&
            doc(WriterState.state.docId) &&
            doc(WriterState.state.docId).type === "notice" &&
            doc(WriterState.state.docId).caseId === k.id,
        );
        ok("the notice has no inspection date of its own (it is the initial one)", !hasOwnInsp(doc(WriterState.state.docId)));
        const all = JSON.stringify(caseFile(k.id)) + JSON.stringify(draftBundle()) + JSON.stringify(WriterState.state);
        ok("Detailed Description is nowhere in state, drafts or the case file", !/Large items|Eligible/.test(all));
        ok("Zoning District is nowhere either", !/TSS|HIS-TL/.test(all));
        ok("case file named from the street address", caseFileName(k) === "1155 WILLIAMSON ST - CB2026-254-03868.json", caseFileName(k));
      }

      H("02537 layout with an inspector column");
      {
        const acc = await load(fx02537());
        const c = acc.cases[0];
        ok(
          "five inspections in date order",
          c.rows.length === 5 &&
            c.rows.map((r) => r.date).join() ===
              c.rows
                .map((r) => r.date)
                .slice()
                .sort()
                .join(),
        );
        ok("07/22 is 11:40", c.rows.find((r) => r.date === "2026-07-22").time === "11:40");
        ok("multiple completed rows have no default", acc.sel === null);
        const noTxt = fxXlsx({
          header: H15,
          rows: fxCase({ insp: [["Robert Ales", "Initial Inspection", 46225.4861111111, "Official Notice", ""]] }),
        });
        const a2 = await load(noTxt);
        ok("with no Inspection Time text, R36 ignores the time in the date column", a2.cases[0].rows[0].time === "", a2.cases[0].rows[0].time);
        const bad = fxXlsx({
          header: H15,
          rows: fxCase({ insp: [["Robert Ales", "Initial Inspection", 46203.4513888889, "Official Notice", "11:50AM"]] }),
        });
        const a3 = await load(bad);
        ok(
          "time column disagreeing with the serial: Inspection Time wins, no warning (R36)",
          !accelaPlan(a3).warnings.some((w) => /does not match/.test(w)) && a3.cases[0].rows[0].time !== "",
        );
      }

      H("Re-saved and rearranged files read the same");
      {
        const want = JSON.stringify((await load(fx02537())).cases[0]);
        const same = async (label, b) => {
          const a = await load(b);
          ok(label, a.errors.length === 0 && JSON.stringify(a.cases[0]) === want, a.errors.join("|"));
        };
        await same("header on row 7 starting in column A", fx02537({ headerRow: 7, startCol: 0 }));
        const order = [14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0];
        await same(
          "columns in reverse order",
          fxXlsx({ header: order.map((i) => H15[i]), rows: fxCase({ insp: I02537 }).map((r) => order.map((i) => r[i])) }),
        );
        const txtRows = fxCase({ insp: I02537 }).map((r) => {
          r = r.slice();
          const s = accSerial(r[12].n);
          r[12] = +s.date.slice(5, 7) + "/" + +s.date.slice(8) + "/" + s.date.slice(0, 4) + " " + fmtTime(accHM(s.mins));
          return r;
        });
        await same("dates stored as text", fxXlsx({ header: H15, rows: txtRows }));
        const orig = await load(FX03868),
          rs = await load(FX03868_OPENPYXL);
        ok("the real 03868 file re-saved by another writer reads the same", JSON.stringify(orig.cases) === JSON.stringify(rs.cases));
      }

      H("Header problems");
      {
        const a = await load(FX02537);
        ok("the 14-column report is refused, naming Inspector Name", a.errors.length === 1 && /Inspector Name/.test(a.errors[0]), a.errors.join("|"));
        ok("nothing to confirm", accelaPlan(a).blockers.length > 0);
        const b = await load(fxXlsx({ header: H15.concat(["Extra Column"]), rows: fxCase({ insp: I02537 }).map((r) => r.concat(["x"])) }));
        ok("an unknown column is ignored with a note", b.errors.length === 0 && b.notes.some((n) => /Extra Column/.test(n)));
      }

      H("Several cases, conflicts, roster");
      {
        const two = fxXlsx({
          header: H15,
          rows: fxCase({ insp: I02537 }).concat(
            fxCase({
              number: "CB2026-181-00001",
              address: "1 A ST, Madison, WI 53703",
              insp: [["Robert Ales", "Initial Inspection", ser("2026-09-01", "09:00"), "Official Notice", "9:00AM"]],
            }),
          ),
        });
        await load(two);
        WriterState.state.screen = "import";
        render();
        ok("two cases, a picker", WriterState.state.acc.cases.length === 2 && document.querySelectorAll("[data-acccase]").length === 2);
        click(document.querySelector('[data-acccase="1"]'));
        await new Promise((r) => setTimeout(r, 0));
        ok(
          "choosing the second case selects its inspection",
          WriterState.state.acc.caseIx === 1 && accelaPlan(WriterState.state.acc).c.number === "CB2026-181-00001" && WriterState.state.acc.sel === 0,
        );
        const rows = fxCase({ insp: I02537.slice(0, 2) });
        rows[1][9] = "SOMEONE ELSE";
        await load(fxXlsx({ header: H15, rows: rows }));
        WriterState.state.acc.sel = 0;
        ok(
          "two owners on one case block the import",
          accelaPlan(WriterState.state.acc).blockers.some((b) => /two different values for Owner Name/.test(b)),
        );
        const n0 = WriterState.CASES.length;
        await load(
          fxXlsx({
            header: H15,
            rows: fxCase({
              number: "CB2026-182-00002",
              insp: [["Jane Nobody", "Initial Inspection", ser("2026-09-01", "09:00"), "Official Notice", "9:00AM"]],
            }),
          }),
        );
        ok(
          "unmatched inspector blocks, name shown",
          accelaPlan(WriterState.state.acc).blockers.some((b) => /Jane Nobody/.test(b)),
        );
        ok("and the guard holds when confirm is called directly", acceptAccela() === null && WriterState.CASES.length === n0);
        const blankInsp = fxCase({
          number: "CB2026-183-00003",
          insp: [
            ["Robert Ales", "Initial Inspection", ser("2026-09-01", "09:00"), "Official Notice", "9:00AM"],
            ["", "Reinspection", null, "Pending", ""],
          ],
        });
        await load(fxXlsx({ header: H15, rows: blankInsp }));
        ok(
          "blank inspector on an unselected row is no error",
          accelaPlan(WriterState.state.acc).blockers.length === 0,
          accelaPlan(WriterState.state.acc).blockers.join("|"),
        );
        ok("DONNA MAGDALINA matches i12", accInspector("Donna  Magdalina").id === "i12" && insp("i12").name === "DONNA MAGDALINA");
        await load(
          fxXlsx({
            header: H15,
            rows: fxCase({
              number: "CB2026-184-00004",
              parcel: "81034111097",
              insp: [["Robert Ales", "Initial Inspection", ser("2026-09-01", "09:00"), "Official Notice", "9:00AM"]],
            }),
          }),
        );
        const pp = accelaPlan(WriterState.state.acc);
        ok("11-digit parcel kept raw with a warning", pp.f.parcel === "81034111097" && pp.warnings.some((w) => /not 12 digits/.test(w)));
        await load(
          fxXlsx({
            header: H15,
            rows: fxCase({
              number: "CB2026-185-00005",
              insp: [["Robert Ales", "Reinspection", ser("2026-09-01", "09:00"), "Extension Processing", "9:00AM"]],
            }),
          }),
        );
        const np = accelaPlan(WriterState.state.acc);
        ok(
          "no Initial row on a new case: date required",
          np.blockers.some((b) => /enter the initial inspection date/.test(b)),
        );
        ok(
          "and a reinspection on a case the program has never seen is blocked",
          np.blockers.some((b) => /Import its Initial Inspection first/.test(b)),
        );
      }

      H("Reinspection path, header and violation date");
      {
        const NUM = "CB2026-253-00099";
        const mk = (ins) =>
          fxXlsx({
            header: H15,
            rows: fxCase({
              number: NUM,
              address: "100 TEST St, Madison, WI 53703",
              owner: "DOE, JANE",
              ownerAddr: "100 TEST ST\nMADISON, WI 53703",
              insp: ins,
            }),
          });
        const INIT = ["Robert Ales", "Initial Inspection", ser("2026-09-10", "09:00"), "Official Notice", "9:00AM"];
        await load(mk([INIT, ["", "Reinspection", null, "Pending", ""]]));
        acceptAccela();
        const k = WriterState.CASES.find((x) => x.number === NUM);
        let N = draftDocFor(k.id);
        await load(mk([INIT, ["Abbie Kurtz", "Reinspection", ser("2026-09-15", "14:30"), "Citation", "2:30PM"]]));
        WriterState.state.acc.sel = 1;
        ok(
          "reinspection with only a draft notice is blocked",
          accelaPlan(WriterState.state.acc).blockers.some((b) => /unfinished work/.test(b)),
        );
        WriterState.state.acc = null;
        items(N, 2);
        issueDocument(N);
        const pub = docsFor(k.id).find((d) => d.type === "notice" && !d.draft);
        await load(mk([INIT, ["Abbie Kurtz", "Reinspection", ser("2026-09-15", "14:30"), "Citation", "2:30PM"]]));
        WriterState.state.acc.sel = 1;
        let p = accelaPlan(WriterState.state.acc);
        ok(
          "explicitly chosen reinspection is allowed",
          p.blockers.length === 0 && p.next === "reinspect" && p.row.date === "2026-09-15",
          p.blockers.join("|"),
        );
        ok(
          "inspector change shown in the diff",
          p.diff.some((x) => x.l === "Case inspector" && x.now === "ABBIE KURTZ"),
        );
        acceptAccela();
        let r = reinsp(WriterState.state.reinspId);
        ok(
          "worksheet opened with the row date, time and inspector",
          WriterState.state.screen === "reinspect" && r.date === "2026-09-15" && r.time === "14:30" && r.inspectorId === "i10",
          JSON.stringify(r && { d: r.date, t: r.time, i: r.inspectorId }),
        );
        ok("case inspector updated, initial inspection kept", k.inspectorId === "i10" && k.date === "2026-09-10" && k.time === "09:00");
        ok("the issued notice keeps its inspector and header", docInsp(pub).name === "ROBERT ALES" && inspAt(pub).date === "2026-09-10");
        render();
        ok("worksheet shows the time field", document.getElementById("ri-time") && document.getElementById("ri-time").value === "14:30");
        await load(mk([INIT, ["Abbie Kurtz", "Reinspection", ser("2026-09-16", "08:00"), "Extension Processing", "8:00AM"]]));
        WriterState.state.acc.sel = 1;
        ok(
          "an open worksheet for another date blocks a second import",
          accelaPlan(WriterState.state.acc).blockers.some((w) => /unfinished work/.test(w)),
        );
        acceptAccela();
        ok(
          "and opened instead of a second",
          WriterState.state.reinspId === r.id &&
            WriterState.REINSP.filter((x) => x.draft && x.caseId === k.id).length === 1 &&
            r.date === "2026-09-15",
        );
        pub.items.forEach((it, i) => {
          r.results[it.id] = { oc: "none", on: r.date, due: futureDue(iso(today), 21), note: "", cite: i === 0 };
        });
        docFromReinspection(r, "citation");
        const C = doc(WriterState.state.docId);
        ok("citation carries the reinspection", C.type === "citation" && C.inspDate === "2026-09-15" && C.inspTime === "14:30");
        render();
        const hd = document.querySelector('[data-doc="inspDate"]'),
          ht = document.querySelector('[data-doc="inspTime"]');
        ok("header shows the reinspection date and time", hd && hd.value === "2026-09-15" && ht && ht.value === "14:30");
        const face = citationFaces(C, false);
        ok(
          "MC-2000 violation date is the reinspection",
          face.includes(longDate("2026-09-15")) && face.includes("2:30 PM") && !face.includes(longDate("2026-09-10")),
        );
        ok(
          "no time blocker while the time is set",
          !blockers(C).some((b) => /reinspection time/.test(b.t)),
          blockers(C)
            .map((b) => b.t)
            .join("|"),
        );
        const cm = Object.values(C.cits)[0].comment;
        ok("narrative still counts from the initial inspection", cm.includes("09/10/2026"), cm);
        hd.value = "2026-09-14";
        hd.dispatchEvent(new window.Event("input", { bubbles: true }));
        ok("editing a follow-up header changes only the document", C.inspDate === "2026-09-14" && k.date === "2026-09-10");
        C.inspDate = "2026-09-15";
        C.inspTime = "";
        ok(
          "no time: a blocking check",
          blockers(C).some((b) => /inspection time/i.test(b.t)),
        );
        ok("the header does not borrow the initial time", !citationFaces(C, false).includes("9:00 AM"));
        const btn = document.createElement("button");
        btn.id = "fin-go";
        document.body.appendChild(btn);
        WriterState.state.docId = C.id;
        click(btn);
        btn.remove();
        ok("and the finalize handler refuses it", !docsFor(k.id).some((d) => d.type === "citation" && !d.draft));
        C.inspTime = "14:30";
        // a follow-up drafted before this build has no date of its own and reads the initial one
        fresh0();
        newDoc("k1", "notice");
        let N1 = WriterState.DOCS[0];
        items(N1, 2);
        issueDocument(N1);
        N1 = docsFor("k1")[0];
        startReinspection("k1");
        const r1 = WriterState.REINSP.filter((x) => x.draft)[0];
        r1.time = "10:00";
        N1.items.forEach((it) => {
          r1.results[it.id] = { oc: "none", on: r1.date, due: futureDue(iso(today), 21), note: "", cite: false };
        });
        docFromReinspection(r1, "extension");
        const E = WriterState.DOCS.find((d) => d.draft && d.type === "extension");
        delete E.inspDate;
        delete E.inspTime;
        issueDocument(E);
        const Ei = docsFor("k1").find((d) => d.type === "extension" && !d.draft);
        WriterState.state.docId = Ei.id;
        WriterState.state.screen = "write";
        render();
        const oldIn = document.querySelector('.n-meta input[type="date"]');
        ok(
          "an older issued follow-up still prints the initial date",
          !hasOwnInsp(Ei) && oldIn && oldIn.value === kase("k1").date && oldIn.dataset.case === "date",
        );
        newDoc("k3", "notice");
        render();
        const nin = document.querySelector('[data-case="date"]');
        nin.value = "2026-08-20";
        nin.dispatchEvent(new window.Event("input", { bubbles: true }));
        ok("editing a notice header changes the case", kase("k3").date === "2026-08-20");
      }

      H("Existing case on the share, address kept");
      {
        fresh0();
        await load(fx02537());
        WriterState.state.acc.sel = WriterState.state.acc.cases[0].rows[0].i;
        // R62: selection follows the listed eligible results; the report row keeps its Official Notice status.
        acceptAccela();
        const k = WriterState.CASES.find((x) => x.number === "CB2026-180-02537");
        let N = draftDocFor(k.id);
        items(N, 1);
        issueDocument(N);
        const f = caseFile(k.id);
        f["case"].address = "5322 VALLEY EDGE DR REAR";
        const text = JSON.stringify(f);
        const fname = caseFileName(f["case"]);
        forget("CB2026-180-02537");
        WriterState.CASEDIR = {
          name: "Case JSON Files",
          kind: "directory",
          queryPermission: async () => "granted",
          requestPermission: async () => "granted",
          async *entries() {
            yield [fname, { kind: "file", getFile: async () => ({ size: text.length, lastModified: 1, text: async () => text }) }];
          },
          async getFileHandle(n) {
            if (n !== fname) throw new Error("NotFound");
            return { getFile: async () => ({ text: async () => text }) };
          },
        };
        WriterState.NEEDGRANT = false;
        await load(fx02537());
        const p = accelaPlan(WriterState.state.acc),
          ex = p.existing;
        ok("the shared case file was merged in before the review", !!ex && docsFor(ex.id).some((d) => d.type === "notice" && !d.draft));
        ok(
          "address on file is kept, with a warning",
          p.warnings.some((w) => /is kept so the case keeps writing/.test(w)),
        );
        WriterState.state.acc.sel = WriterState.state.acc.cases[0].rows.find((r) => r.date === "2026-08-18").i;
        acceptAccela();
        ok("after confirming the case still writes to its own file", ex.address === "5322 VALLEY EDGE DR REAR" && caseFileName(ex) === fname);
        WriterState.CASEDIR = null;
      }

      H("Escaping");
      {
        fresh0();
        await load(
          fxXlsx({
            header: H15,
            rows: fxCase({
              number: "CB2026-186-00006",
              address: "<b>7 X St</b>, Madison, WI",
              owner: "<img src=x onerror=alert(1)>",
              ownerAddr: "<i>1 A ST</i>\nMADISON, WI 53703",
              insp: [["<script>x</script>", "Initial Inspection", ser("2026-09-01", "09:00"), "Official Notice", "9:00AM"]],
            }),
          }),
        );
        WriterState.state.screen = "import";
        render();
        const app = document.getElementById("app");
        const bad = [...document.querySelector(".acc").querySelectorAll("img,b,i,script")];
        ok("nothing from the report becomes markup in the panel", !bad.length, bad.map((e) => e.outerHTML).join(" "));
        ok("the inspector blocker quotes the name as text", app.textContent.includes("<script>x</script>"));
      }

      H("Refused reports");
      {
        await load(fxXlsx({ header: ["Nothing"], rows: [] }));
        ok("a report with no table is refused", WriterState.state.acc.errors.length > 0, WriterState.state.acc.errors.join("|"));
        WriterState.state.screen = "import";
        render();
        ok("an error panel renders", !!document.querySelector(".acc .banner.alert"));
        WriterState.state.acc = null;
      }

      H("Part A — year built and the lead-paint block are gone");
      {
        ok("no yearBuilt anywhere in the program", !/yearBuilt|year_built|Pre-1978/.test(src));
        ok("no LEAD_1978 in the program", !/LEAD_1978/.test(src));
        fresh0();
        newDoc("k1", "notice");
        let N = WriterState.DOCS[0];
        items(N, 1, "Repair and paint the siding.");
        issueDocument(N);
        const f = caseFile("k1");
        const ev = f.events.find((e) => e.type === "notice.issued");
        const LEAD = "Buildings constructed before 1978 are likely to have paint containing lead.";
        ev.payload.snapshot.frozen.blocks.push({ key: "LEAD_1978", label: "Lead paint (pre-1978)", text: LEAD });
        f["case"].yearBuilt = 1950;
        f["case"].number = "CB2026-200-00001";
        f["case"].id = "kOld";
        f.events.forEach((e) => {
          e.id = "old-" + e.id;
        });
        const f2 = JSON.parse(JSON.stringify(f));
        WriterState.EVENTS = {};
        project(); // the copy is a different case; its documents must not share the screen with the original
        const k = loadCaseFile(JSON.stringify(f).split('"k1"').join('"kOld"'));
        ok("an old case file carrying yearBuilt loads", !!k);
        const pub = docsFor(k.id).find((d) => d.type === "notice");
        ok("an issued notice with the frozen lead block still shows it", noticeHTML(pub).includes(LEAD));
        WriterState.state.docId = pub.id;
        WriterState.state.screen = "write";
        render();
        ok("and still prints it", printableHTML().includes(LEAD));
        forget("CB2026-200-00001");
        f2["case"].number = "CB2026-200-00002";
        f2["case"].id = "kOlder";
        f2.events.forEach((e) => {
          e.id = "older-" + e.id;
          if (e.payload.snapshot) delete e.payload.snapshot.frozen;
        });
        const k2 = loadCaseFile(JSON.stringify(f2).split('"k1"').join('"kOlder"'));
        const old = docsFor(k2.id).find((d) => d.type === "notice");
        ok("KNOWN: a notice issued before frozen snapshots existed renders blocks live and loses the lead block", !noticeHTML(old).includes(LEAD));
      }

      H("Part D — Landmark block");
      {
        fresh0();
        const k2 = kase("k2");
        k2.landmark = "Old Main";
        newDoc("k2", "notice");
        const N = WriterState.DOCS[0];
        items(N, 1, "Repair the exterior siding.");
        const act = activeBlocks(N);
        ok("unsupplied Landmark wording is omitted; Historic District wording remains", act.indexOf("LANDMARK") < 0 && act.indexOf("LANDMARKS") >= 0);
        ok("missing Landmark language does not block issuance", !blockers(N).some((b) => /Landmark paragraph has not been supplied/.test(b.t)));
        ok("no empty Landmark section is rendered", !docBlocks(N).some((b) => b.key === "LANDMARK"));
        const savedLandmark = BLOCKS.LANDMARK.text;
        BLOCKS.LANDMARK.text = "SYNTHETIC supplied landmark wording.";
        ok(
          "supplied optional Landmark wording still prints",
          docBlocks(N).some((b) => b.key === "LANDMARK" && b.text === BLOCKS.LANDMARK.text),
        );
        const frozenLandmark = { ...N, frozen: { blocks: clone(docBlocks(N)) } };
        BLOCKS.LANDMARK.text = savedLandmark;
        ok(
          "issued frozen Landmark wording remains unchanged",
          docBlocks(frozenLandmark).some((b) => b.key === "LANDMARK" && b.text === "SYNTHETIC supplied landmark wording."),
        );
        ok(
          "unrelated missing due-date checks remain",
          (() => {
            const due = N.items[0].due;
            N.items[0].due = "";
            const blocked = blockers(N).some((b) => /due date/i.test(b.t));
            N.items[0].due = due;
            return blocked;
          })(),
        );
        N.items[0].text = "Clean the yard.";
        ok(
          "no exterior item: no Landmark block, no blocker",
          activeBlocks(N).indexOf("LANDMARK") < 0 && !blockers(N).some((b) => /Landmark/.test(b.t)),
        );
        k2.landmark = "";
        N.items[0].text = "Repair the exterior siding.";
        ok("not a landmark: no Landmark block", activeBlocks(N).indexOf("LANDMARK") < 0 && activeBlocks(N).indexOf("LANDMARKS") >= 0);
        ok(
          "Historic District block unchanged",
          BLOCKS.LANDMARKS.label === "Historic district" && /^This property is located in a Historic District/.test(BLOCKS.LANDMARKS.text),
        );
        k2.landmark = "Old Main";
        ok("follow-ups carry no blocks", activeBlocks({ type: "extension", caseId: "k2", items: N.items }).length === 0);
        k2.landmark = "";
      }

      H("Import screen entry options");
      {
        fresh0();
        WriterState.state.acc = null;
        WriterState.state.screen = "import";
        render();
        ok(
          "legacy manual and CSV controls are absent",
          !document.getElementById("m-go") && !document.getElementById("imp-go") && !document.getElementById("imp-csv"),
        );
        ok("field-by-field import preview is absent", !document.body.textContent.includes("Check what will be imported"));
        ok(
          "the case lookup remains and no spreadsheet loader is offered",
          !!document.getElementById("lookup-number") && !document.getElementById("acc-pick"),
        );
      }

      if (fails.length) process.exitCode = 1;
      console.log("\n" + (fails.length ? fails.length + " FAILURE(S): " + fails.join(" | ") : "all import checks passed"));
    }

    const T =
      "\n// Schema 4 export fixture; R31 tests cover schema 5 helper-only writes" +
      ".\nconst legacyCaseFile=caseFile;caseFile=(cid)=>({...legacyCaseFile(cid)" +
      ",schema:4});\n\nfunction fresh0(){WriterState.EVENTS={};WriterState.DOCS.l" +
      "ength=0;WriterState.REINSP.length=0;WriterState.state.docId=null;WriterS" +
      "tate.state.reinspId=null;WriterState.state.acc=null;}\n(" +
      `${ACC_TESTS.toString()}` +
      ")().catch(e=>{console.log('CRASH',e&&e.stack);process.exitCode=1;});\n";
    settle(eval(src + "\n;;\n" + T), global.window);
  },
  "audit_r45_import.js: source-selection parity, interruption and draft continuity": () => {
    /* Source-selection parity, interruption and draft-continuity regressions. Synthetic inputs only. */
    globalThis.MADISON_TEST_DATA = true;
    const fs = require("fs"),
      path = require("path"),
      assert = require("assert/strict"),
      { JSDOM } = require("jsdom");
    const { builtPage, bundleSource } = require("../fixtures/built_bundle.cjs");
    const html = builtPage(),
      payload = bundleSource(html);
    const dom = new JSDOM('<!doctype html><div id="app"></div><div id="overlay"></div><div id="toast"></div>', {
      url: "http://127.0.0.1:8777/",
      pretendToBeVisual: true,
    });
    const w = dom.window;
    global.window = w;
    global.document = w.document;
    global.DOMParser = w.DOMParser;
    global.getSelection = () => w.getSelection();
    global.confirm = () => true;
    w.scrollTo = () => {};
    const test = async function () {
      await new Promise((r) => setTimeout(r, 30));
      idbSet = async () => true;
      saveDrafts = async () => true;
      render = () => {};
      scheduleDraftSave = () => {};
      WriterState.CASEDIR = { helper: true };
      helperJSON = async () => ({ files: [] });
      let checks = 0;
      const ok = (name, value) => {
        assert.ok(value, name);
        checks++;
        console.log("PASS " + name);
      };
      const number = "CB2026-280-00045",
        source = { kind: "sql", database: "Synthetic", server: "fixture", retrievedAt: "2026-10-16T12:00:00Z", querySha256: "a".repeat(64) };
      const row = {
        CaseNumber: number,
        SiteAddress: "4500 SYNTHETIC LANE, MADISON WI 53703",
        ParcelNumber: "070913125237",
        OwnerName: "SYNTHETIC OWNER",
        OwnerAddress: "4500 SYNTHETIC LANE\nMADISON WI 53703",
        CaseDescription: "Synthetic import acceptance fixture",
        HistoricDistrict: "No",
        IndividualLandmark: "No",
        InspectionDate: "2026-09-18",
        InspectionType: "Initial Inspection",
        InspectionStatus: "Official Notice",
        InspectionTime: "",
        InspectorName: "Robert Ales",
        CaseType: "Code Violation",
        RecordCategory: "",
      };
      const report = (rows) => sqlReport({ ok: true, caseNumber: number, source, rows }, number);
      const reset = () => {
        cancelCaseLookup();
        WriterState.CASES = [];
        WriterState.DOCS = [];
        WriterState.REINSP = [];
        WriterState.EVENTS = {};
        WriterState.SAVE_CHECKPOINTS = {};
        COMMITTED.clear();
        WriterState.state = { ...WriterState.state, screen: "import", acc: null, modal: null };
        WriterState.WORK = { entry: {}, acc: null, recordForms: {} };
        helperJSON = async () => ({ files: [] });
      };
      const loadGrid = require("../fixtures/report_grid_loader.cjs").createReportGridLoader({
        getState: () => WriterState.state,
        cancelLookup: () => cancelCaseLookup(),
        readTable: (grid) => accelaTable(grid),
        readShare: () => accelaFromShare(),
      });
      const load = (name) =>
        loadGrid(
          {
            grid: JSON.parse(
              fs.readFileSync(
                path.join(require("path").resolve(__dirname, "../.."), "tests/fixtures/reference/r45-import-fixtures", name + ".grid.json"),
                "utf8",
              ),
            ),
          },
          name,
        );
      reset();
      const excel = await load("ordinary"),
        sql = report([row]);
      ok(
        "SQL rows and the stored report grid preserve equivalent identity and inspection facts",
        stableJSON(baseLookupPlan(excel).f) === stableJSON(baseLookupPlan(sql).f) &&
          baseLookupPlan(excel).time === "" &&
          baseLookupPlan(sql).time === "",
      );
      await confirmDatabaseCase();
      ok(
        "The stored report grid opens one ordinary notice without inventing a time",
        WriterState.CASES.length === 1 && WriterState.DOCS.length === 1 && WriterState.DOCS[0].type === "notice" && WriterState.CASES[0].time === "",
      );
      const k = WriterState.CASES[0],
        d = WriterState.DOCS[0];
      d.items = [
        { id: "r45-item", no: "1", title: "Synthetic repair", text: "Repair wall.", sections: ["27.05(2)(c)"], due: addDays(recordDay(today), 21) },
      ];
      const retained = JSON.stringify(d);
      WriterState.state.screen = "import";
      WriterState.state.acc = report([
        row,
        { ...row, InspectionType: "Reinspection", InspectionStatus: "Extension Processing", InspectionDate: "2026-09-22" },
      ]);
      WriterState.state.acc.sel = 1;
      ok(
        "Existing unfinished work blocks import",
        accelaPlan(WriterState.state.acc).blockers.some((x) => /unfinished work/.test(x)),
      );
      preflightCase = async (_cid, _action, continuation) => continuation();
      openImportWorkspace(k.id);
      ok(
        "Continue existing case opens retained draft without applying import",
        WriterState.state.screen === "write" && WriterState.state.docId === d.id && JSON.stringify(d) === retained && k.owner === "SYNTHETIC OWNER",
      );
      reset();
      const multi = await load("multiple");
      ok("Stored grid multiple completed choices have no arbitrary default", multi.sel === null);
      WriterState.state.acc = multi;
      const panel = accelaPanel();
      ok("Choice panel excludes Scheduled Assist Pending rows", (panel.match(/data-accsel=/g) || []).length === 2 && !panel.includes(">Pending<"));
      for (const name of ["scheduled-only", "assist-only", "pending-only"]) {
        reset();
        const a = await load(name);
        ok(
          name + " gives a specific stop reason",
          name === "pending-only"
            ? accelaPlan(a).blockers.some((x) => /Pending/.test(x))
            : a.errors.some((x) => new RegExp(name.split("-")[0], "i").test(x)),
        );
      }
      for (const [field, value, label] of [
        ["InspectionStatus", "Scheduled", "Scheduled"],
        ["InspectionType", "Assist", "Assist"],
      ]) {
        let message = "";
        try {
          report([{ ...row, [field]: value }]);
        } catch (e) {
          message = e.message;
        }
        ok("SQL all-filtered " + label + " is not a multiple-case error", message.includes(label) && !message.includes("More than one"));
      }
      reset();
      WriterState.state.acc = report([{ ...row, RecordCategory: "Snow Removal", InspectionStatus: "Citation" }]);
      await confirmDatabaseCase();
      ok(
        "SQL snow route creates citation draft with blank observation time",
        WriterState.DOCS.length === 1 && snow.is(WriterState.DOCS[0]) && WriterState.DOCS[0].inspTime === "",
      );
      reset();
      await load("snow");
      await confirmDatabaseCase();
      ok("Stored grid snow route matches SQL", WriterState.DOCS.length === 1 && snow.is(WriterState.DOCS[0]) && WriterState.DOCS[0].inspTime === "");
      reset();
      WriterState.state.acc = report([row]);
      await confirmDatabaseCase();
      const created = WriterState.CASES[0],
        draft = WriterState.DOCS[0];
      draft.items = [{ id: "r45-pub", no: "1", title: "Wall", text: "Repair wall.", sections: ["27.05(2)(c)"], due: addDays(recordDay(today), 21) }];
      issueDocument(draft);
      const frozen = JSON.stringify(WriterState.DOCS);
      WriterState.state.screen = "import";
      WriterState.state.acc = report([row]);
      // R62: the reused inspection is hidden, so nothing can be selected and the reason is shown.
      ok(
        "Reused inspection stays blocked",
        !accelaPlan(WriterState.state.acc).row &&
          accelaPlan(WriterState.state.acc).blockers.some((b) => /already been used to generate a document/.test(b)),
      );
      await confirmDatabaseCase();
      ok("Reused import preserves frozen documents", JSON.stringify(WriterState.DOCS) === frozen);
      WriterState.state.acc = report([
        { ...row, InspectionType: "Reinspection", InspectionStatus: "Extension Processing", InspectionDate: "2026-09-22" },
      ]);
      const before = lookupPlanSignature(WriterState.state.acc);
      WriterState.DOCS.unshift({ ...clone(WriterState.DOCS[0]), id: "r45-new-latest", inspDate: "2026-09-23" });
      ok(
        "Review signature binds actual latest document selection",
        lookupPlanSignature(WriterState.state.acc) !== before && accelaPlan(WriterState.state.acc).blockers.some((x) => /latest issued/.test(x)),
      );
      WriterState.DOCS.shift();
      const shared = caseFile(created.id);
      shared.schema = 4; // Legacy fixture; production schema-5 proof is covered by the real-helper browser gate.
      rememberSaved(created, clone(shared));
      shared.case.owner = "UPDATED SHARED OWNER";
      helperJSON = async (route) => (route === "/cases/list" ? { files: [{ name: caseFileName(created) }] } : { file: shared });
      await confirmDatabaseCase();
      ok(
        "Changed shared details require renewed review before starting worksheet",
        WriterState.state.screen === "import" && WriterState.REINSP.length === 0 && kase(created.id).owner === "UPDATED SHARED OWNER",
      );
      await confirmDatabaseCase();
      ok(
        "Reviewed shared import uses latest source and preserves blank time",
        WriterState.state.screen === "reinspect" &&
          WriterState.REINSP[0].sourceDocId === sourceDocFor(created.id).id &&
          WriterState.REINSP[0].time === "",
      );
      reset();
      reset();
      WriterState.state.acc = report([row]);
      const acc = WriterState.state.acc;
      let release;
      helperJSON = async () => new Promise((r) => (release = r));
      const confirm = confirmDatabaseCase();
      await new Promise((r) => setTimeout(r, 0));
      cancelCaseLookup();
      WriterState.state.screen = "cases";
      release({ files: [] });
      await confirm;
      ok(
        "Delayed shared preflight cannot accept after navigation",
        WriterState.CASES.length === 0 && WriterState.state.acc === acc && WriterState.state.screen === "cases",
      );
      reset();
      let readText;
      const fileName = "4500 SYNTHETIC LANE - " + number + ".json";
      WriterState.CASEDIR = {
        async *entries() {
          yield [fileName, { kind: "file", getFile: async () => ({ size: 1, lastModified: 1 }) }];
        },
        getFileHandle: async () => ({ getFile: async () => ({ text: () => new Promise((r) => (readText = r)) }) }),
      };
      const directoryRead = load("ordinary");
      for (let n = 0; n < 30 && !readText; n++) await new Promise((r) => setTimeout(r, 0));
      assert.equal(typeof readText, "function");
      cancelCaseLookup();
      WriterState.state.screen = "cases";
      readText(JSON.stringify(shared));
      await directoryRead;
      ok(
        "Delayed directory record cannot merge or reopen Import after navigation",
        WriterState.CASES.length === 0 && WriterState.state.screen === "cases",
      );
      reset();
      const input = document.createElement("input");
      input.id = "lookup-number";
      document.getElementById("app").append(input);
      WriterState.WORK.entry["lookup-number"] = number;
      input.value = "";
      captureWork();
      ok("A late capture cannot replace typed lookup work with a transient empty control", WriterState.WORK.entry["lookup-number"] === number);
      input.value = "";
      input.dispatchEvent(new window.Event("input", { bubbles: true }));
      captureWork();
      ok("Deliberately clearing the case number remains an explicit saved edit", WriterState.WORK.entry["lookup-number"] === "");
      delete WriterState.WORK.entry["lookup-number"];
      input.value = number;
      captureWork();
      ok("First capture still recovers a previously unrecorded search", WriterState.WORK.entry["lookup-number"] === number);
      input.remove();
      console.log(checks + " R45 assertions passed.");
      process.exit(0);
    };
    eval(payload + "\n(" + test.toString() + ")().catch(e=>{console.error(e);process.exit(1)});");
  },
  "audit_r50_import.js: result-status eligibility table": () => {
    /* Regression for City acceptance: result statuses must use the defined eligibility table. */
    globalThis.MADISON_TEST_DATA = true;
    const fs = require("fs"),
      path = require("path"),
      assert = require("assert/strict"),
      { JSDOM } = require("jsdom");
    const { builtPage, bundleSource } = require("../fixtures/built_bundle.cjs");
    const payload = bundleSource(builtPage());
    const dom = new JSDOM('<div id="app"></div><div id="overlay"></div><div id="toast"></div>', {
      url: "http://127.0.0.1:8777/",
      pretendToBeVisual: true,
    });
    Object.assign(global, {
      window: dom.window,
      document: dom.window.document,
      DOMParser: dom.window.DOMParser,
      confirm: () => true,
      getSelection: () => dom.window.getSelection(),
    });
    dom.window.scrollTo = () => {};
    const check = async function () {
      await new Promise((r) => setTimeout(r, 30));
      idbSet = async () => true;
      saveDrafts = async () => true;
      render = () => {};
      scheduleDraftSave = () => {};
      const number = "CB2026-280-00050";
      const row = {
        CaseNumber: number,
        SiteAddress: "4500 SYNTHETIC LANE, MADISON WI 53703",
        ParcelNumber: "070913125237",
        OwnerName: "SYNTHETIC OWNER",
        OwnerAddress: "4500 SYNTHETIC LANE\nMADISON WI 53703",
        CaseDescription: "Import eligibility acceptance",
        HistoricDistrict: "No",
        IndividualLandmark: "No",
        InspectionDate: "2026-09-18",
        InspectionType: "Initial Inspection",
        InspectionTime: "",
        InspectorName: "Robert Ales",
        RecordCategory: "",
      };
      const loadGrid = require("../fixtures/report_grid_loader.cjs").createReportGridLoader({
        getState: () => WriterState.state,
        cancelLookup: () => cancelCaseLookup(),
        readTable: (grid) => accelaTable(grid),
        readShare: () => accelaFromShare(),
      });
      const report = (status, extra = {}) =>
        sqlReport({ ok: true, caseNumber: number, source: { kind: "sql" }, rows: [{ ...row, InspectionStatus: status, ...extra }] }, number);
      const reset = () => {
        WriterState.CASES = [];
        WriterState.DOCS = [];
        WriterState.REINSP = [];
        WriterState.EVENTS = {};
        WriterState.SAVE_CHECKPOINTS = {};
        COMMITTED.clear();
        WriterState.WORK = { entry: {}, acc: null, recordForms: {} };
        WriterState.state = { ...WriterState.state, screen: "import", modal: null, acc: null };
        WriterState.CASEDIR = { helper: true };
        helperJSON = async () => ({ files: [] });
      };
      // R53: an Initial Inspection with status Compliance has no document rule and is refused (SQL and stored grid).
      // R62 (owner, Development 3): status Completed is hidden, so a lookup returning only Completed lists nothing.
      for (const status of ["Completed", "Compliance"]) {
        reset();
        if (status === "Completed") assert.throws(() => report(status), /status is not an inspection result/, status + " SQL hidden");
        else {
          WriterState.state.acc = report(status);
          assert.ok(
            accelaPlan(WriterState.state.acc).blockers.some((b) => /has no document rule/.test(b)),
            status + " SQL refused",
          );
        }
        reset();
        await loadGrid({
          grid: JSON.parse(
            fs.readFileSync(
              path.join(
                require("path").resolve(__dirname, "../.."),
                "tests/fixtures/reference/r50-import-fixtures",
                status.toLowerCase() + ".grid.json",
              ),
              "utf8",
            ),
          ),
        });
        assert.ok(accelaPlan(WriterState.state.acc).blockers.length > 0, status + " stored grid refused");
      }
      for (const status of ["Official Notice", "Citation", " OFFICIAL  NOTICE "]) {
        reset();
        WriterState.state.acc = report(status);
        assert.equal(accelaPlan(WriterState.state.acc).blockers.length, 0, status + " SQL eligibility");
        assert.equal(accelaPlan(WriterState.state.acc).row.time, "");
        await confirmDatabaseCase();
        assert.equal(WriterState.DOCS.length, 1, status + " SQL imports");
        assert.equal(WriterState.DOCS[0].type, "notice");
        reset();
        await loadGrid({
          grid: JSON.parse(
            fs.readFileSync(
              path.join(
                require("path").resolve(__dirname, "../.."),
                "tests/fixtures/reference/r50-import-fixtures",
                status.trim().replace(/\s+/g, "-").toLowerCase() + ".grid.json",
              ),
              "utf8",
            ),
          ),
        });
        assert.equal(accelaPlan(WriterState.state.acc).blockers.length, 0, status + " stored grid eligibility");
        await confirmDatabaseCase();
        assert.equal(WriterState.DOCS.length, 1, status + " stored grid imports");
        reset();
        WriterState.state.acc = report(status, { RecordCategory: "Snow Removal" });
        if (status === "Citation") {
          await confirmDatabaseCase();
          assert.ok(snow.is(WriterState.DOCS[0]), status + " snow routes");
        } else
          assert.ok(
            accelaPlan(WriterState.state.acc).blockers.some((b) => /Snow removal inspections are imported with status Citation/.test(b)),
            status + " snow refused",
          );
      }
      for (const status of ["Cancelled", "Unknown", ""]) {
        reset();
        WriterState.state.acc = report(status);
        assert.equal(WriterState.state.acc.sel, null);
        assert.ok(accelaPlan(WriterState.state.acc).blockers.length);
        assert.ok(!accelaPanel().includes("data-accsel="));
        await confirmDatabaseCase();
        assert.equal(WriterState.DOCS.length, 0);
      }
      for (const [status, extra] of [
        ["Scheduled", {}],
        ["Official Notice", { InspectionType: "Assist" }],
        // R62: Pending is hidden like Scheduled.
        ["Pending", {}],
      ]) {
        reset();
        assert.throws(() => report(status, extra), /Scheduled|Assist|not an inspection result/);
      }
      // Multiple valid results require a choice and show the actual result, not a false exclusion.
      reset();
      // R53: three valid Initial Inspection results (Compliance has no initial rule).
      const rows = ["Official Notice", "Citation", "No Occupancy"].map((status, index) => ({
        ...row,
        InspectionStatus: status,
        InspectionDate: "2026-09-" + (18 + index),
      }));
      WriterState.state.acc = sqlReport({ ok: true, caseNumber: number, source: { kind: "sql" }, rows }, number);
      assert.equal(WriterState.state.acc.sel, null);
      assert.equal((accelaPanel().match(/data-accsel=/g) || []).length, 3);
      WriterState.state.acc.sel = 0;
      await confirmDatabaseCase();
      const k = WriterState.CASES[0],
        d = WriterState.DOCS[0];
      d.items = [{ id: "qa-item", no: "1", title: "Repair", text: "Repair wall.", sections: ["27.05(2)(c)"], due: addDays(recordDay(today), 21) }];
      assert.ok(issueDocument(d));
      WriterState.state.screen = "import";
      WriterState.state.acc = report("Official Notice");
      // R62: the used inspection is hidden; nothing can be selected and the reason is given.
      assert.equal(accelaPlan(WriterState.state.acc).candidates.length, 0);
      assert.ok(accelaPlan(WriterState.state.acc).blockers.some((b) => /already been used to generate a document/.test(b)));
      await confirmDatabaseCase();
      assert.equal(WriterState.REINSP.length, 0);
      WriterState.state.acc = report("Citation", { InspectionType: "Reinspection", InspectionDate: "2026-09-22" });
      assert.equal(accelaPlan(WriterState.state.acc).blockers.length, 0);
      await confirmDatabaseCase();
      assert.equal(WriterState.REINSP.length, 1);
      assert.equal(WriterState.REINSP[0].time, "");
      assert.equal(WriterState.REINSP[0].caseId, k.id);
      console.log(
        "PASS SQL and stored grid result status parity, snow routing, explicit m" +
          "ultiple choice, refusal of incomplete/unknown/Assist rows, reused-result" +
          " protection and later inspection import",
      );
      process.exit(0);
    };
    eval(payload + "\n(" + check.toString() + ")().catch(e=>{console.error(e);process.exit(1)});");
  },
  "audit_r50_import_repaint.js: import disclosure and navigation across repaints": () => {
    const assert = require("assert/strict");
    require("../fixtures/bundle_test.cjs")(
      `WriterState.state.screen='import';WriterState.state.acc=null;WriterState.state.modal=null;WriterState.state.picker=false;
render();
assert.equal(document.querySelector('.import-alternative'), null, 'no spreadsheet alternative is offered');
assert.equal(document.getElementById('acc-pick'), null, 'no spreadsheet loader is offered');
const workflow=document.querySelector('.import-workflow');workflow.open=true;render();
assert.equal(document.querySelector('.import-workflow').open,true,'late repaint keeps the workflow choice visible');
document.querySelector('.import-workflow').open=false;render();
assert.equal(document.querySelector('.import-workflow').open,false,'an explicit close remains closed');
document.querySelector('.import-workflow').open=true;WriterState.state.screen='cases';render();
WriterState.state.screen='import';render();assert.equal(document.querySelector('.import-workflow').open,false,'a new navigation starts with its own disclosure state');
console.log('PASS import disclosure, explicit close and navigation isolation');`,
    );
  },
  "audit_r53_status_rules.js: inspection type and status decide the document": () => {
    /* R53 WP1: the imported Inspection Type and Inspection Status decide the document (division rules, 2026-10-19). */
    globalThis.MADISON_TEST_DATA = true;
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
    global.getSelection = () => window.getSelection();
    window.scrollTo = () => {};
    global.fetch = async () => {
      throw new Error("offline");
    };
    const test = async () => {
      await new Promise((r) => setTimeout(r, 25));
      // 1. Rule matrix, synonyms and spacing variants; unlisted statuses and types have no rule.
      const expect = [
        ["Initial Inspection", "Official Notice", "notice", false],
        ["Initial Inspection", "Citation", "notice", true],
        ["Initial Inspection", "No Occupancy", "noOccupancy", false],
        ["Initial Inspection", "Abatement Summary", "summaryAbatement", false],
        ["Initial Inspection", "Abatement Non-Summary", "nonSummaryAbatement", false],
        ["initial inspection", "  abatement non - summary ", "nonSummaryAbatement", false],
        ["Reinspection", "CA Referral", "referral", false],
        ["Re-inspection", "City Attorney Referral", "referral", false],
        ["Reinspection", "Compliance", "compliance", false],
        ["Reinspection", "Citation", "citation", true],
        ["Reinspection", "No Occupancy", "noOccupancy", false],
        ["CA Reinspection", "Compliance", "compliance", false],
        ["CA Reinspection", "Non Compliance", "referralUpdate", false],
        ["CA Reinspection", "Non-Compliance", "referralUpdate", false],
      ];
      for (const [type, status, doc, cite] of expect) {
        const r = statusRule(type, status);
        assert.equal(r.error, undefined, type + "/" + status);
        assert.equal(r.doc, doc, type + "/" + status);
        assert.equal(!!r.cite, cite, type + "/" + status);
      }
      assert.deepEqual(statusRule("Reinspection", "Extension Processing").choose, ["extension", "bestInterestExtension", "vacancyExtension"]);
      for (const [type, status] of [
        ["Initial Inspection", "Completed"],
        ["Reinspection", "Completed"],
        ["Initial Inspection", "Compliance"],
        ["Reinspection", "Official Notice"],
        ["CA Reinspection", "Citation"],
        ["Initial Inspection", "Pending"],
      ])
        assert.match(statusRule(type, status).error, /has no document rule/, type + "/" + status);
      assert.match(statusRule("Complaint Inspection", "Official Notice").error, /Inspection type "Complaint Inspection" has no document rule/);
      assert.equal(statusRule("Initial Inspection", "Completed").kind, "initial");

      // Report grid helpers.
      const day = recordDay(today),
        inspector = INSPECTORS.find((i) => i.id === "i4").name;
      const head = [
        "Case Number",
        "Inspector Name",
        "Site Address",
        "Parcel Number",
        "Owner Name",
        "Owner Address",
        "Inspection Type",
        "Inspection Date",
        "Inspection Status",
        "Inspection Time",
        "Case Type",
        "Record Category",
      ];
      const row = (num, type, status, category = "", date = day, time = "09:00 AM") => [
        num,
        inspector,
        "100 TEST ST",
        "070822219101",
        "TEST OWNER",
        "100 TEST ST, MADISON, WI 53703",
        type,
        date,
        status,
        time,
        "Property Maintenance",
        category,
      ];
      const reset = () => {
        WriterState.DOCS = [];
        WriterState.EVENTS = {};
        WriterState.REINSP = [];
        WriterState.PENDING = [];
        WriterState.CASES = [];
        WriterState.WORK.entry = {};
        WriterState.state.acc = null;
      };
      const plan = (rows) => {
        const acc = accelaTable([head, ...rows]);
        acc.sel = acc.cases[0]?.rows.find((r) => r.selectable)?.i ?? null;
        WriterState.state.acc = acc;
        return { acc, p: accelaPlan(acc) };
      };

      // 2. "Completed" is not importable. R62 (owner, Development 3): it is hidden, and the report explains why.
      reset();
      let { p } = plan([row("CB2026-100-00001", "Initial Inspection", "Completed")]);
      assert.ok(
        p.blockers.some((b) => /status is not an inspection result \(such as Pending, Completed or No Violation\)/.test(b)),
        JSON.stringify(p.blockers),
      );

      // 3. Initial statuses create the matching draft with the rule recorded.
      for (const [status, type, initialAction] of [
        ["Official Notice", "notice", false],
        ["Citation", "notice", false],
        ["No Occupancy", "noOccupancy", true],
        ["Abatement Summary", "summaryAbatement", true],
        ["Abatement Non-Summary", "nonSummaryAbatement", true],
      ]) {
        reset();
        ({ p } = plan([row("CB2026-100-00002", "Initial Inspection", status)]));
        assert.deepEqual(p.blockers, [], status);
        acceptAccela();
        const d = doc(WriterState.state.docId);
        assert.equal(d.type, type, status);
        assert.equal(!!d.initialAction, initialAction, status);
        assert.equal(d.importRule.status, status);
      }

      // 4. Initial Citation needs a cited item; Official Notice allows none.
      reset();
      plan([row("CB2026-100-00003", "Initial Inspection", "Citation")]);
      acceptAccela();
      let d = doc(WriterState.state.docId);
      const ci = LIBRARY.findIndex((x) => x.code === "ENF_PM_PROPMAINT"),
        gi = LIBRARY[ci].groups.findIndex((g) => g.code === "OTHER");
      toggleLibraryItem(d, ci, gi, LIBRARY[ci].groups[gi].items[0]);
      assert.ok(blockers(d).some((b) => /Accela status is Citation, but no item is marked for citation/.test(b.t)));
      d.items[0].cite = true;
      assert.ok(!blockers(d).some((b) => /Accela status/.test(b.t)));
      reset();
      plan([row("CB2026-100-00004", "Initial Inspection", "Official Notice")]);
      acceptAccela();
      d = doc(WriterState.state.docId);
      toggleLibraryItem(d, ci, gi, LIBRARY[ci].groups[gi].items[0]);
      d.items[0].cite = true;
      assert.ok(blockers(d).some((b) => /Accela status is Official Notice, so no item can be cited/.test(b.t)));

      // 5. An Initial Inspection cannot import into an existing case (snow included); a reinspection needs a case.
      // R62: on a case that already has its notice, an Initial Inspection counts as used and is hidden.
      const usedHidden = /already been used to generate a document/;
      reset();
      plan([row("CB2026-100-00005", "Initial Inspection", "Official Notice")]);
      acceptAccela();
      ({ p } = plan([row("CB2026-100-00005", "Initial Inspection", "Official Notice", "", day, "10:00 AM")]));
      assert.ok(p.candidates.length === 0 && p.blockers.some((b) => usedHidden.test(b)), JSON.stringify(p.blockers));
      reset();
      ({ p } = plan([row("CB2026-100-00006", "Reinspection", "Citation")]));
      assert.ok(
        p.blockers.some((b) => /No case exists for this inspection/.test(b)),
        JSON.stringify(p.blockers),
      );
      reset();
      ({ p } = plan([row("CB2026-100-00007", "Initial Inspection", "Citation", "Snow Removal")]));
      assert.deepEqual(p.blockers, []);
      assert.equal(p.next, "snow");
      acceptAccela();
      ({ p } = plan([row("CB2026-100-00007", "Initial Inspection", "Citation", "Snow Removal", day, "11:00 AM")]));
      assert.ok(
        p.blockers.some((b) => /An Initial Inspection result can only start a new case/.test(b)),
        "snow initial into existing case: " + JSON.stringify(p.blockers),
      );
      reset();
      ({ p } = plan([row("CB2026-100-00008", "Initial Inspection", "No Occupancy", "Snow Removal")]));
      assert.ok(
        p.blockers.some((b) => /Snow removal inspections are imported with status Citation/.test(b)),
        JSON.stringify(p.blockers),
      );

      // 6. Refresh from Accela: the same unissued initial inspection updates the stored status.
      reset();
      plan([row("CB2026-100-00009", "Initial Inspection", "Official Notice")]);
      acceptAccela();
      const first = doc(WriterState.state.docId);
      ({ p } = plan([row("CB2026-100-00009", "Initial Inspection", "No Occupancy")]));
      assert.ok(p.refresh, "refresh target found");
      assert.deepEqual(p.blockers, []);
      acceptAccela();
      assert.equal(doc(first.id).importRule.status, "No Occupancy");
      assert.equal(doc(first.id).type, "noOccupancy");

      console.log(
        "PASS R53 status-driven documents: rule matrix, Completed refused, initial documents, citation checks, case-existence and snow rules, refresh",
      );
      process.exit(0);
    };
    eval(payload + "\n(" + test.toString() + ")().catch(e=>{console.error(e);process.exit(1);})");
  },
  "audit_r62_import_rules.js: R62 import table, hidden rows and greyed pairs": () => {
    /* R62 (owner, Development 3): import rule table with the No Fee statuses, rows that never appear among candidates,
   and other type/status pairs listed greyed with their reason. Synthetic data. */
    globalThis.MADISON_TEST_DATA = true;
    require("../fixtures/bundle_test.cjs")(`
  saveDrafts = async () => true; scheduleDraftSave = () => {};
  // 1. The rule table, including the new No Fee statuses.
  const table = [
    ["Initial Inspection", "Official Notice", "notice"],
    ["Initial Inspection", "Citation", "notice"],
    ["Initial Inspection", "No Occupancy", "noOccupancy"],
    ["Initial Inspection", "Abatement Summary", "summaryAbatement"],
    ["Initial Inspection", "Abatement Non-Summary", "nonSummaryAbatement"],
    ["Initial Inspection", "Abatement Non Summary", "nonSummaryAbatement"],
    ["Reinspection", "CA Referral", "referral"],
    ["Reinspection", "City Attorney Referral", "referral"],
    ["Reinspection", "Compliance", "compliance"],
    ["Reinspection", "Citation", "citation"],
    ["Reinspection", "No Occupancy", "noOccupancy"],
    ["Reinspection", "No Fee No Occupancy", "noOccupancy"],
    ["Reinspection", " no fee  no occupancy ", "noOccupancy"],
    // Owner request after R62: these results of a Reinspection are importable and lead to the Reinspection Notice.
    ["Reinspection", "Reinspection", "reinspectionNotice"],
    ["Reinspection", "No Fee Reinspection", "reinspectionNotice"],
    ["Reinspection", " no  fee reinspection ", "reinspectionNotice"],
    ["CA Reinspection", "Compliance", "compliance"],
    ["CA Reinspection", "Non Compliance", "referralUpdate"],
    ["CA Reinspection", "Non-Compliance", "referralUpdate"],
  ];
  for (const [type, status, kind] of table) {
    const r = statusRule(type, status);
    assert.equal(r.error, undefined, type + "/" + status);
    assert.equal(r.doc, kind, type + "/" + status);
  }
  for (const status of ["Extension Processing", "No Fee Extension Processing", " no fee  extension processing "])
    assert.deepEqual(statusRule("Reinspection", status).choose, ["extension", "bestInterestExtension", "vacancyExtension"], status);

  // 2. Hidden rows never appear, for every inspection type; the report explains what it returned.
  const head = ["Case Number", "Inspector Name", "Site Address", "Parcel Number", "Owner Name", "Owner Address",
    "Inspection Type", "Inspection Date", "Inspection Status", "Inspection Time"];
  const row = (type, status, date = "2026-09-10") =>
    ["CB2026-262-00001", INSPECTORS[0].name, "100 TEST ST", "070822219101", "TEST OWNER", "100 TEST ST, MADISON, WI 53703", type, date, status, "09:00 AM"];
  const hiddenStatuses = ["Scheduled", "Pending", "Completed", "Inspection", "No Violation"];
  const reinspectionResults = ["Reinspection", "No Fee Reinspection", " no  fee reinspection "];
  // Reinspection and No Fee Reinspection stay hidden on every type except a Reinspection, where they are listed.
  for (const type of ["Initial Inspection", "Reinspection", "CA Reinspection", "Complaint Inspection"])
    for (const status of type === "Reinspection" ? hiddenStatuses : [...hiddenStatuses, ...reinspectionResults]) {
      const t = accelaTable([head, row(type, status)]);
      assert.equal(t.cases.length, 0, type + "/" + status + " hidden");
      assert.match(t.errors[0], /^No eligible completed inspection: the report returned only /, type + "/" + status);
    }
  for (const status of reinspectionResults) {
    const t = accelaTable([head, row("Reinspection", status)]);
    assert.equal(t.cases.length, 1, "Reinspection/" + status + " is listed");
    assert.equal(t.cases[0].rows[0].rule.doc, "reinspectionNotice", status);
  }
  assert.match(accelaTable([head, row("Reinspection", "Scheduled")]).errors[0], /Scheduled rows/);
  assert.match(accelaTable([head, row("Reinspection", "No Violation")]).errors[0], /status is not an inspection result/);
  assert.match(accelaTable([head, row("Assist", "Official Notice")]).errors[0], /Assist rows/);
  assert.match(accelaTable([head, row("Initial Inspection", "No Entry")]).errors[0], /Initial Inspection rows with status No Entry/);
  assert.match(accelaTable([head, row("Initial Inspection", "Official Notice", "")]).errors[0], /rows without an inspection date/);
  const mixed = accelaTable([head, row("Reinspection", "Scheduled"), row("Assist", "Citation"), row("Initial Inspection", "No Entry")]);
  assert.match(mixed.errors[0], /Scheduled rows .*, Initial Inspection rows with status No Entry and Assist rows\\./, mixed.errors[0]);

  // 3. Other pairs are listed but not selectable, greyed with their reason; hidden rows are absent.
  WriterState.CASES = []; WriterState.DOCS = []; WriterState.REINSP = []; WriterState.EVENTS = {};
  const acc = accelaTable([
    head,
    row("Initial Inspection", "Official Notice", "2026-09-10"),
    row("Reinspection", "No Entry", "2026-09-11"),
    row("Initial Inspection", "Compliance", "2026-09-12"),
    row("Initial Inspection", "No Entry", "2026-09-13"),
    row("Reinspection", "Pending", "2026-09-14"),
    row("Reinspection", "Official Notice", ""),
  ]);
  assert.equal(acc.cases[0].rows.length, 3, "three listed rows; the Initial No Entry, Pending and undated rows are hidden");
  acc.sel = acc.cases[0].sel;
  WriterState.state = { ...WriterState.state, screen: "import", acc };
  const p = accelaPlan(acc);
  assert.equal(acc.sel, acc.cases[0].rows.find((x) => x.status === "Official Notice").i, "the one eligible row is selected");
  assert.deepEqual(p.blockers.filter((b) => /Reinspection|Compliance/.test(b)), []);
  const box = document.createElement("div");
  box.innerHTML = accelaPanel();
  const greyed = [...box.querySelectorAll(".import-unavailable")];
  assert.equal(greyed.length, 2, "two greyed rows");
  assert.ok(greyed.every((g) => g.getAttribute("aria-disabled") === "true" && !g.matches("button") && !g.querySelector("button")));
  assert.match(greyed.map((g) => g.textContent).join("|"), /Reinspection status "No Entry" has no document rule/);
  assert.match(greyed.map((g) => g.textContent).join("|"), /Initial Inspection status "Compliance" has no document rule/);
  assert.match(box.querySelector(".import-unavailable-list h3").textContent, /Not available for import/);
  const shownStatuses = [...box.querySelectorAll('[data-import-field="Status"] strong')].map((x) => x.textContent);
  assert.deepEqual(shownStatuses.sort(), ["Compliance", "No Entry", "Official Notice"], "hidden rows are not shown");
  const listed = acc.cases[0].rows.find((x) => x.status === "No Entry").i;
  assert.equal(selectImportInspection(listed), false, "a greyed row cannot be selected");

  // 4. A No Fee Extension Processing reinspection offers the extension chooser.
  assert.equal(accStatusEligible("No Fee Extension Processing", "Reinspection"), true);
  assert.equal(accStatusEligible("No Fee No Occupancy", "Reinspection"), true);
  assert.equal(accStatusEligible("No Fee No Occupancy", "Initial Inspection"), false, "No Fee No Occupancy is a Reinspection status");

  // 5. On an existing case, hiding the used initial inspection leaves one result, which becomes the selection.
  WriterState.CASES = []; WriterState.DOCS = []; WriterState.REINSP = []; WriterState.EVENTS = {};
  WriterState.CASEDIR = null;
  const first = accelaTable([head, row("Initial Inspection", "Official Notice", "2026-09-10")]);
  first.sel = first.cases[0].sel;
  WriterState.state = { ...WriterState.state, screen: "import", acc: first };
  acceptAccela();
  const notice = WriterState.DOCS[0];
  notice.items = [{ id: "r62-item", no: "1", sections: ["27.05(2)(c)"], text: "Repair the wall.", title: "Wall", due: addDays(iso(today), 21), prov: "notice" }];
  issueDocument(notice);
  const later = accelaTable([head, row("Initial Inspection", "Official Notice", "2026-09-10"), row("Reinspection", "Citation", "2026-09-20")]);
  later.sel = later.cases[0].sel;
  assert.equal(later.sel, null, "two eligible rows in the report: no default");
  WriterState.state = { ...WriterState.state, screen: "import", acc: later };
  const plan = accelaPlan(later);
  assert.equal(plan.candidates.length, 1, "the used initial inspection is hidden");
  assert.equal(plan.row?.date, "2026-09-20", "the one remaining result is selected");
  const correction = startCorrection(notice.id);
  assert.ok(correction, "a correction draft of the issued notice opens");
  later.sel = later.cases[0].rows.find((x) => x.typeKey === "initial").i;
  const correcting = accelaPlan(later);
  assert.equal(correcting.candidates.length, 1, "a correction draft does not make its already-used inspection refreshable");
  assert.equal(correcting.refresh, null, "refresh never rewrites a correction draft");
  console.log("PASS R62 import rules: No Fee statuses, hidden rows and messages, greyed unavailable pairs, single remaining result");
`);
  },
  "audit_status_own_property.js: inherited-property statuses and case numbers are ordinary text": () => {
    /* Import rules and the report's case grouping read only their own entries: a status or case number spelled like an
   inherited object property ("constructor", "__proto__") is ordinary text, never a document rule or an existing case.
   Covers every supported inspection type and both import paths (uploaded report and SQL lookup). Synthetic data. */
    globalThis.MADISON_TEST_DATA = true;
    require("../fixtures/bundle_test.cjs")(`
  saveDrafts = async () => true; scheduleDraftSave = () => {};
  const types = ["Initial Inspection", "Reinspection", "CA Reinspection"];
  const inherited = ["constructor", "__proto__", "Constructor", "__PROTO__", " constructor "];

  // 1. The rule table refuses inherited names for every supported inspection type.
  for (const type of types)
    for (const status of inherited) {
      const rule = statusRule(type, status);
      assert.equal(rule.error, type + ' status "' + status.trim() + '" has no document rule', type + "/" + status);
      assert.equal(rule.doc, undefined, type + "/" + status);
      assert.equal(rule.choose, undefined, type + "/" + status);
      assert.equal(accStatusEligible(status, type), false, type + "/" + status);
    }
  // Supported statuses are unchanged.
  assert.equal(statusRule("Initial Inspection", "Official Notice").doc, "notice");
  assert.equal(statusRule("CA Reinspection", "Non-Compliance").doc, "referralUpdate");

  const head = ["Case Number", "Inspector Name", "Site Address", "Parcel Number", "Owner Name", "Owner Address",
    "Inspection Type", "Inspection Date", "Inspection Status", "Inspection Time"];
  const row = (number, type, status, date = "2026-09-10") =>
    [number, INSPECTORS[0].name, "100 TEST ST", "070822219101", "TEST OWNER", "100 TEST ST, MADISON, WI 53703", type, date, status, "09:00 AM"];
  const fresh = (acc) => {
    WriterState.CASES = []; WriterState.DOCS = []; WriterState.REINSP = []; WriterState.EVENTS = {};
    WriterState.state = { ...WriterState.state, screen: "import", acc };
  };

  // 2. Uploaded report: the row is listed but not selectable, nothing is auto-selected and the plan is blocked.
  for (const type of types)
    for (const status of ["constructor", "__proto__"]) {
      const acc = accelaTable([head, row("CB2026-262-00001", type, status)]);
      assert.deepEqual(acc.errors, [], type + "/" + status);
      const listed = acc.cases[0].rows[0];
      assert.equal(listed.selectable, false, type + "/" + status + " not selectable");
      assert.equal(listed.why, type + ' status "' + status + '" has no document rule');
      assert.equal(acc.cases[0].sel, null, type + "/" + status + " not auto-selected");
      acc.sel = acc.cases[0].sel;
      fresh(acc);
      const plan = accelaPlan(acc);
      assert.equal(plan.row, null, type + "/" + status);
      assert.ok(plan.blockers.some((b) => /^No eligible inspection result is available: .*has no document rule/.test(b)), plan.blockers.join(" | "));
      assert.equal(selectImportInspection(listed.i), false, type + "/" + status + " cannot be selected");
    }
  // Alongside a valid result, the valid one is still the selection.
  const mixed = accelaTable([head, row("CB2026-262-00001", "Initial Inspection", "Official Notice"), row("CB2026-262-00001", "Reinspection", "constructor", "2026-09-20")]);
  assert.equal(mixed.cases[0].rows.length, 2);
  assert.equal(mixed.cases[0].rows[mixed.cases[0].sel].status, "Official Notice");

  // 3. SQL lookup: the same rows reach the same rules.
  const number = "CB2026-262-00002";
  const sqlRow = (type, status) => ({
    CaseNumber: number, SiteAddress: "102 TEST ST, MADISON WI 53703", ParcelNumber: "070913125237", OwnerName: "TEST OWNER",
    OwnerAddress: "102 TEST ST\\nMADISON WI 53703", CaseDescription: "Complaint", HistoricDistrict: "No", IndividualLandmark: "No",
    InspectionDate: "2026-09-18T00:00:00", InspectionType: type, InspectionStatus: status, InspectionTime: "09:05:00",
    InspectorName: INSPECTORS[0].name,
  });
  const sql = (rows) => sqlReport({ ok: true, rows, caseNumber: number, source: { kind: "sql", retrievedAt: "2026-09-26T12:00:00Z" } }, number);
  for (const type of types)
    for (const status of ["constructor", "__proto__"]) {
      const acc = sql([sqlRow(type, status)]);
      assert.equal(acc.cases[0].rows[0].selectable, false, "SQL " + type + "/" + status);
      assert.equal(acc.sel, null, "SQL " + type + "/" + status + " not auto-selected");
      fresh(acc);
      const plan = accelaPlan(acc);
      assert.equal(plan.row, null, "SQL " + type + "/" + status);
      assert.ok(plan.blockers.some((b) => /has no document rule/.test(b)), plan.blockers.join(" | "));
    }
  assert.equal(sql([sqlRow("Initial Inspection", "Official Notice")]).sel, 0, "a valid SQL result is still selected");

  // 4. Case numbers are grouped by their own text: an inherited name starts its own case instead of failing the import.
  for (const name of ["constructor", "__proto__", "toString", "hasOwnProperty"]) {
    const acc = accelaTable([head, row(name, "Initial Inspection", "Official Notice"), row(name, "Reinspection", "Citation", "2026-09-20")]);
    assert.deepEqual(acc.errors, [], name);
    assert.equal(acc.cases.length, 1, name + " is one case");
    assert.equal(acc.cases[0].number, name);
    assert.equal(acc.cases[0].rows.length, 2, name + " keeps both rows");
    assert.equal(acc.cases[0].raw.address, "100 TEST ST", name);
  }
  const two = accelaTable([head, row("CB2026-262-00003", "Initial Inspection", "Official Notice"), row("constructor", "Initial Inspection", "Official Notice")]);
  assert.deepEqual(two.cases.map((c) => c.number), ["CB2026-262-00003", "constructor"], "report order is kept");
  console.log("PASS inherited-property statuses and case numbers are ordinary text on both import paths");
`);
  },
});
