/* Feature suite (Consolidation Phase 6): Accela inspection import: workbook parsing and columns, type/status routing and case rules, candidate selection, stale-state races and repaint.
   Each scenario runs in its own process with a fresh bundle, DOM, state, storage and mocks
   (tests/fixtures/scenarios.cjs). Labels name the suite each scenario came from; its code is unchanged. */
require("../fixtures/scenarios.cjs").run(__filename, {
  "audit_import.js: Accela/SSRS workbook import, routing and draft creation": () => {
    globalThis.MADISON_TEST_DATA = true;
    // Consolidation Phase 2 (T1): run remaining long UI timers once the suite completes instead of waiting.
    const { settle } = require("../fixtures/settle_ui_timers.cjs");
    const zlib = require("zlib");
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

    /* ---------- fixtures: a minimal xlsx writer, so each variant is built here ---------- */
    const fxCrc = (b) => {
      let c,
        cr = 0xffffffff;
      for (let i = 0; i < b.length; i++) {
        c = (cr ^ b[i]) & 0xff;
        for (let k = 0; k < 8; k++) c = c & 1 ? (c >>> 1) ^ 0xedb88320 : c >>> 1;
        cr = (cr >>> 8) ^ c;
      }
      return (cr ^ 0xffffffff) >>> 0;
    };
    function fxZip(files, stored) {
      const locals = [],
        cds = [];
      let off = 0;
      Object.keys(files).forEach((name) => {
        const data = Buffer.from(files[name], "utf8"),
          st = (stored || []).indexOf(name) >= 0;
        const body = st ? data : zlib.deflateRawSync(data),
          nm = Buffer.from(name, "utf8"),
          crc = fxCrc(data);
        const lh = Buffer.alloc(30);
        lh.writeUInt32LE(0x04034b50, 0);
        lh.writeUInt16LE(20, 4);
        lh.writeUInt16LE(st ? 0 : 8, 8);
        lh.writeUInt32LE(crc, 14);
        lh.writeUInt32LE(body.length, 18);
        lh.writeUInt32LE(data.length, 22);
        lh.writeUInt16LE(nm.length, 26);
        const ch = Buffer.alloc(46);
        ch.writeUInt32LE(0x02014b50, 0);
        ch.writeUInt16LE(20, 4);
        ch.writeUInt16LE(20, 6);
        ch.writeUInt16LE(st ? 0 : 8, 10);
        ch.writeUInt32LE(crc, 16);
        ch.writeUInt32LE(body.length, 20);
        ch.writeUInt32LE(data.length, 24);
        ch.writeUInt16LE(nm.length, 28);
        ch.writeUInt32LE(off, 42);
        locals.push(lh, nm, body);
        cds.push(ch, nm);
        off += 30 + nm.length + body.length;
      });
      const cd = Buffer.concat(cds),
        e = Buffer.alloc(22);
      e.writeUInt32LE(0x06054b50, 0);
      e.writeUInt16LE(Object.keys(files).length, 8);
      e.writeUInt16LE(Object.keys(files).length, 10);
      e.writeUInt32LE(cd.length, 12);
      e.writeUInt32LE(off, 16);
      return Buffer.concat(locals.concat([cd, e]));
    }
    const fxEsc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const fxCol = (i) => {
      let s = "";
      i++;
      while (i > 0) {
        const m = (i - 1) % 26;
        s = String.fromCharCode(65 + m) + s;
        i = Math.floor((i - 1) / 26);
      }
      return s;
    };
    /* opt: header[], rows[][] (strings, or {n:number}), shared, rich, headerRow, startCol, rstOrder, stored */
    function fxXlsx(opt) {
      const sst = [],
        si = (s) => {
          let i = sst.indexOf(s);
          if (i < 0) {
            sst.push(s);
            i = sst.length - 1;
          }
          return i;
        };
      const hr = opt.headerRow || 3,
        sc = opt.startCol === undefined ? 1 : opt.startCol;
      const cell = (ref, v) => {
        if (v && typeof v === "object") return opt.rstOrder ? `<c s="4" r="${ref}"><v>${v.n}</v></c>` : `<c r="${ref}" s="4"><v>${v.n}</v></c>`;
        if (opt.shared) return `<c r="${ref}" t="s"><v>${si(v)}</v></c>`;
        return opt.rstOrder
          ? `<c s="3" t="inlineStr" r="${ref}"><is><t xml:space="preserve">${fxEsc(v)}</t></is></c>`
          : `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${fxEsc(v)}</t></is></c>`;
      };
      const row = (n, vals) => `<row r="${n}">${vals.map((v, i) => cell(fxCol(sc + i) + n, v)).join("")}</row>`;
      const rows = [`<row r="1"><c r="A1" t="inlineStr"><is><t></t></is></c></row>`, row(hr, opt.header)].concat(
        opt.rows.map((r, i) => row(hr + 1 + i, r)),
      );
      const files = {
        "[Content_Types].xml": '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"></Types>',
        "xl/workbook.xml":
          '<?xml version="1.0"?><workbook xmlns="http://schemas.openxmlformats.org/' +
          'spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/offi' +
          'ceDocument/2006/relationships"><sheets><sheet name="Sheet1" sheetId="1" ' +
          'r:id="rId9"/></sheets></workbook>',
        "xl/_rels/workbook.xml.rels":
          '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats' +
          '.org/package/2006/relationships"><Relationship Id="rId9" Type="x" Target' +
          '="worksheets/data.xml"/></Relationships>',
        "xl/worksheets/data.xml":
          '<?xml version="1.0"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>' +
          rows.join("") +
          "</sheetData></worksheet>",
      };
      if (opt.shared)
        files["xl/sharedStrings.xml"] =
          '<?xml version="1.0"?><sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
          sst
            .map((s) =>
              opt.rich && s.length > 3
                ? '<si><r><rPr><b/></rPr><t xml:space="preserve">' +
                  `${fxEsc(s.slice(0, 3))}` +
                  '</t></r><r><t xml:space="preserve">' +
                  `${fxEsc(s.slice(3))}` +
                  "</t></r><rPh><t>X</t></rPh></si>"
                : `<si><t xml:space="preserve">${fxEsc(s)}</t></si>`,
            )
            .join("") +
          "</sst>";
      return fxZip(files, opt.stored ? ["xl/worksheets/data.xml"] : []);
    }
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
    const FX02537 =
      "UEsDBBQAAAAIAPxbMl0k2ZOLggEAAMADAAAPABwAeGwvd29ya2Jvb2sueG1sIKIYACigFAAA" +
      "AAAAAAAAAAAAAAAAAAAAAAAAAJ1TwW7CMAz9lSj30VJRQIgWaWLSuExIQ3DOGpdGpEmUpLT8" +
      "/dxWhU7aAXGyn+28PDvOetOUklzBOqFVQqeTkBJQmeZCnRNa+fxtSYnzTHEmtYKE3sBRsknX" +
      "tbaXH60vBM8rl9DCe7MKApcVUDI30QYUZnJtS+YR2nPgjAXGXQHgSxlEYTgPSiYU7RlW9hkO" +
      "necig63OqhKU70ksSOZRvSuEcQNbw5/i45bV2OmgZyRx22cGvqc6/E+dK5gFfrgZuGu7+lfJ" +
      "uM72Vht3/MPHXuh0PPnspVll2Nh9Suk6FxKO/RoRZswXK3FZGkmJZM5/cOGBJ3SGUNfwJ2Ar" +
      "814J2YI4nCNTMKJ67NneEg45q6Q/oMIhjxsbzaKoO/aoTNetPQqo3YOghaQ5CcV1ndBohot+" +
      "G9A0QlR34CS4LzCyDOf32CeIc4GPtgjjcHxTS4lwdFm3OoMlqhvCd+tP8Re1dod9om9XAh27" +
      "453yLjNYPJ0xie9MWtPVR/EiitvCPjFSkP4CUEsDBAoAAAAAAPxbMl3mOic9QwIAAEMCAAAL" +
      "ABwAX3JlbHMvLnJlbHMgohgAKKAUAAAAAAAAAAAAAAAAAAAAAAAAAAAA77u/PD94bWwgdmVy" +
      "c2lvbj0iMS4wIiBlbmNvZGluZz0idXRmLTgiPz48UmVsYXRpb25zaGlwcyB4bWxucz0iaHR0" +
      "cDovL3NjaGVtYXMub3BlbnhtbGZvcm1hdHMub3JnL3BhY2thZ2UvMjAwNi9yZWxhdGlvbnNo" +
      "aXBzIj48UmVsYXRpb25zaGlwIFR5cGU9Imh0dHA6Ly9zY2hlbWFzLm9wZW54bWxmb3JtYXRz" +
      "Lm9yZy9vZmZpY2VEb2N1bWVudC8yMDA2L3JlbGF0aW9uc2hpcHMvb2ZmaWNlRG9jdW1lbnQi" +
      "IFRhcmdldD0iL3hsL3dvcmtib29rLnhtbCIgSWQ9InJJZDIiIC8+PFJlbGF0aW9uc2hpcCBU" +
      "eXBlPSJodHRwOi8vc2NoZW1hcy5vcGVueG1sZm9ybWF0cy5vcmcvcGFja2FnZS8yMDA2L3Jl" +
      "bGF0aW9uc2hpcHMvbWVhdGFkYXRhL2NvcmUtcHJvcGVydGllcyIgVGFyZ2V0PSIvZG9jUHJv" +
      "cHMvY29yZS54bWwiIElkPSJySWQ0IiAvPjxSZWxhdGlvbnNoaXAgVHlwZT0iaHR0cDovL3Nj" +
      "aGVtYXMub3BlbnhtbGZvcm1hdHMub3JnL29mZmljZURvY3VtZW50LzIwMDYvcmVsYXRpb25z" +
      "aGlwcy9leHRlbmRlZC1wcm9wZXJ0aWVzIiBUYXJnZXQ9Ii9kb2NQcm9wcy9hcHAueG1sIiBJ" +
      "ZD0icklkNSIgLz48L1JlbGF0aW9uc2hpcHM+UEsDBBQAAAAIAPxbMl3ZjHHPBgQAACkWAAAN" +
      "ABwAeGwvc3R5bGVzLnhtbCCiGAAooBQAAAAAAAAAAAAAAAAAAAAAAAAAAADlWG1v2zYQ/iuC" +
      "sK+tZKs1rEJ20TkwUGDriiUbBhT9QEuUTYwiBYpO7fz63pF6c9r0lAzDilVGTPJ0fO654/FI" +
      "J3t9qmRwy00jtFqFs+dxGHCV60Ko/So82vLZMgway1TBpFZ8FZ55Ewav11ljz5JfHzi3ASCo" +
      "ZhUerK1fRVGTH3jFmue65grelNpUzMLQ7KOmNpwVDU6qZDSP40VUMaFCj/DKTMHQZSlyfqXz" +
      "Y8WV9SCGS2aBf3MQddOhnYpJeIVhn8DXjs+I4pV/0+FN8vBr7JoDM7y4Ode853ZrnwpW6Py9" +
      "0XXz5wUee4Kn48jnT4pVDo71UVpn6lhtK9sEuT4q8G/WiwLfvC1W4XIeBh5xowvIpg8/PYtn" +
      "8Ys4/VhFRXSGB2ZFXr/vNOus1GpAfhl6ASThXXDLJNhCY1Fzt85yLbUJzH63Crfb2D34yomB" +
      "D6u4n7FhUuyMcNZACICsEvLsX85R7AVgA+PRzqqE0saZckLUcjz898Vg52c467t1JkZDgbvH" +
      "iL/5SOYF6+zoZQr2GoqPg4/z5WN9vOZ7zYM/3ga/iP3BDq7+uzxn8VN5fr8M3xjB5Bf0XIPJ" +
      "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" +
      "/QEAAL8UAAAAAA==";
    const FX03868 =
      "UEsDBBQAAAAIAOJeMl0k2ZOLggEAAMADAAAPABwAeGwvd29ya2Jvb2sueG1sIKIYACigFAAA" +
      "AAAAAAAAAAAAAAAAAAAAAAAAAJ1TwW7CMAz9lSj30VJRQIgWaWLSuExIQ3DOGpdGpEmUpLT8" +
      "/dxWhU7aAXGyn+28PDvOetOUklzBOqFVQqeTkBJQmeZCnRNa+fxtSYnzTHEmtYKE3sBRsknX" +
      "tbaXH60vBM8rl9DCe7MKApcVUDI30QYUZnJtS+YR2nPgjAXGXQHgSxlEYTgPSiYU7RlW9hkO" +
      "necig63OqhKU70ksSOZRvSuEcQNbw5/i45bV2OmgZyRx22cGvqc6/E+dK5gFfrgZuGu7+lfJ" +
      "uM72Vht3/MPHXuh0PPnspVll2Nh9Suk6FxKO/RoRZswXK3FZGkmJZM5/cOGBJ3SGUNfwJ2Ar" +
      "814J2YI4nCNTMKJ67NneEg45q6Q/oMIhjxsbzaKoO/aoTNetPQqo3YOghaQ5CcV1ndBohot+" +
      "G9A0QlR34CS4LzCyDOf32CeIc4GPtgjjcHxTS4lwdFm3OoMlqhvCd+tP8Re1dod9om9XAh27" +
      "453yLjNYPJ0xie9MWtPVR/EiitvCPjFSkP4CUEsDBAoAAAAAAOJeMl3mOic9QwIAAEMCAAAL" +
      "ABwAX3JlbHMvLnJlbHMgohgAKKAUAAAAAAAAAAAAAAAAAAAAAAAAAAAA77u/PD94bWwgdmVy" +
      "c2lvbj0iMS4wIiBlbmNvZGluZz0idXRmLTgiPz48UmVsYXRpb25zaGlwcyB4bWxucz0iaHR0" +
      "cDovL3NjaGVtYXMub3BlbnhtbGZvcm1hdHMub3JnL3BhY2thZ2UvMjAwNi9yZWxhdGlvbnNo" +
      "aXBzIj48UmVsYXRpb25zaGlwIFR5cGU9Imh0dHA6Ly9zY2hlbWFzLm9wZW54bWxmb3JtYXRz" +
      "Lm9yZy9vZmZpY2VEb2N1bWVudC8yMDA2L3JlbGF0aW9uc2hpcHMvb2ZmaWNlRG9jdW1lbnQi" +
      "IFRhcmdldD0iL3hsL3dvcmtib29rLnhtbCIgSWQ9InJJZDIiIC8+PFJlbGF0aW9uc2hpcCBU" +
      "eXBlPSJodHRwOi8vc2NoZW1hcy5vcGVueG1sZm9ybWF0cy5vcmcvcGFja2FnZS8yMDA2L3Jl" +
      "bGF0aW9uc2hpcHMvbWVhdGFkYXRhL2NvcmUtcHJvcGVydGllcyIgVGFyZ2V0PSIvZG9jUHJv" +
      "cHMvY29yZS54bWwiIElkPSJySWQ0IiAvPjxSZWxhdGlvbnNoaXAgVHlwZT0iaHR0cDovL3Nj" +
      "aGVtYXMub3BlbnhtbGZvcm1hdHMub3JnL29mZmljZURvY3VtZW50LzIwMDYvcmVsYXRpb25z" +
      "aGlwcy9leHRlbmRlZC1wcm9wZXJ0aWVzIiBUYXJnZXQ9Ii9kb2NQcm9wcy9hcHAueG1sIiBJ" +
      "ZD0icklkNSIgLz48L1JlbGF0aW9uc2hpcHM+UEsDBBQAAAAIAOJeMl3ZjHHPBgQAACkWAAAN" +
      "ABwAeGwvc3R5bGVzLnhtbCCiGAAooBQAAAAAAAAAAAAAAAAAAAAAAAAAAADlWG1v2zYQ/iuC" +
      "sK+tZKs1rEJ20TkwUGDriiUbBhT9QEuUTYwiBYpO7fz63pF6c9r0lAzDilVGTPJ0fO654/FI" +
      "J3t9qmRwy00jtFqFs+dxGHCV60Ko/So82vLZMgway1TBpFZ8FZ55Ewav11ljz5JfHzi3ASCo" +
      "ZhUerK1fRVGTH3jFmue65grelNpUzMLQ7KOmNpwVDU6qZDSP40VUMaFCj/DKTMHQZSlyfqXz" +
      "Y8WV9SCGS2aBf3MQddOhnYpJeIVhn8DXjs+I4pV/0+FN8vBr7JoDM7y4Ode853ZrnwpW6Py9" +
      "0XXz5wUee4Kn48jnT4pVDo71UVpn6lhtK9sEuT4q8G/WiwLfvC1W4XIeBh5xowvIpg8/PYtn" +
      "8Ys4/VhFRXSGB2ZFXr/vNOus1GpAfhl6ASThXXDLJNhCY1Fzt85yLbUJzH63Crfb2D34yomB" +
      "D6u4n7FhUuyMcNZACICsEvLsX85R7AVgA+PRzqqE0saZckLUcjz898Vg52c467t1JkZDgbvH" +
      "iL/5SOYF6+zoZQr2GoqPg4/z5WN9vOZ7zYM/3ga/iP3BDq7+uzxn8VN5fr8M3xjB5Bf0XIPJ" +
      "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" +
      "AP0BAADoEwAAAAA=";
    const FX03868_OPENPYXL =
      "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";
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
      const buf = (b) => {
        const x = typeof b === "string" ? Buffer.from(b, "base64") : b;
        return x.buffer.slice(x.byteOffset, x.byteOffset + x.length);
      };
      async function load(b, name, size) {
        WriterState.state.screen = "import";
        const ab = buf(b);
        await readAccelaFile({ name: name || "report.xlsx", size: size === undefined ? ab.byteLength : size, arrayBuffer: async () => ab });
        return WriterState.state.acc;
      }
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

      H("ZIP and time primitives");
      try {
        await accInflate(zlib.deflateRawSync(Buffer.alloc(1024)), 128);
        ok("Expanded stream limit enforced", false);
      } catch (e) {
        ok("Expanded stream limit enforced", /expanded workbook/.test(e.message));
      }
      try {
        await readXlsx(buf(fxZip({ "xl/workbook.xml": '<workbook><workbookPr date1904="1"/></workbook>' })));
        ok("Alternate Excel date origin cannot shift dates silently", false);
      } catch (e) {
        ok("Alternate Excel date origin cannot shift dates silently", /1904 date system/.test(e.message));
      }

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
        await same("shared strings", fx02537({ shared: true }));
        await same("shared strings with rich-text runs and a phonetic guide", fx02537({ shared: true, rich: true }));
        await same("attributes in s,t,r order", fx02537({ rstOrder: true }));
        await same("header on row 7 starting in column A", fx02537({ headerRow: 7, startCol: 0 }));
        await same("sheet stored uncompressed", fx02537({ stored: true }));
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

      H("Refused files");
      {
        await load(Buffer.from("this is not a spreadsheet at all, just text"), "notes.xlsx");
        ok(
          "non-xlsx refused",
          WriterState.state.acc.errors.length && /not an Excel/.test(WriterState.state.acc.errors[0]),
          WriterState.state.acc.errors.join("|"),
        );
        const whole = Buffer.from(FX03868, "base64");
        await load(whole.subarray(0, Math.floor(whole.length / 2)));
        ok(
          "truncated file refused",
          WriterState.state.acc.errors.length && /incomplete or damaged/.test(WriterState.state.acc.errors[0]),
          WriterState.state.acc.errors.join("|"),
        );
        await load(FX03868, "big.xlsx", 6 * 1024 * 1024);
        ok("oversize refused", WriterState.state.acc.errors.length && /MB/.test(WriterState.state.acc.errors[0]));
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
        ok("inspection selection and confirmation remain", !!document.getElementById("acc-pick"));
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
      const load = async (name) => {
        const b = fs.readFileSync(
          path.join(require("path").resolve(__dirname, "../.."), "tests/fixtures/reference/r45-import-fixtures", name + ".xlsx"),
        );
        await readAccelaFile({
          name: name + ".xlsx",
          size: b.length,
          arrayBuffer: async () => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength),
        });
        return WriterState.state.acc;
      };
      reset();
      const excel = await load("ordinary"),
        sql = report([row]);
      ok(
        "SQL and actual Excel bytes preserve equivalent identity and inspection facts",
        stableJSON(baseLookupPlan(excel).f) === stableJSON(baseLookupPlan(sql).f) &&
          baseLookupPlan(excel).time === "" &&
          baseLookupPlan(sql).time === "",
      );
      await confirmDatabaseCase();
      ok(
        "Excel opens one ordinary notice without inventing a time",
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
      ok("Excel multiple completed choices have no arbitrary default", multi.sel === null);
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
      ok("Excel snow route matches SQL", WriterState.DOCS.length === 1 && snow.is(WriterState.DOCS[0]) && WriterState.DOCS[0].inspTime === "");
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
      let finish;
      const pending = readAccelaFile({ name: "late.xlsx", size: 100, arrayBuffer: () => new Promise((r) => (finish = r)) });
      cancelCaseLookup();
      WriterState.state.screen = "cases";
      finish(new ArrayBuffer(0));
      await pending;
      ok(
        "Delayed Excel bytes cannot reopen Import after navigation",
        WriterState.state.screen === "cases" && WriterState.state.acc === null && !WriterState.LOOKUP_BUSY,
      );
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
      let completeRead;
      const abandonedRead = readAccelaFile({ name: "abandoned.xlsx", size: 100, arrayBuffer: () => new Promise((r) => (completeRead = r)) });
      WriterState.state.screen = "cases";
      completeRead(new ArrayBuffer(0));
      await abandonedRead;
      ok(
        "Navigation without an explicit cancellation clears busy and ignores the Excel result",
        !WriterState.LOOKUP_BUSY && WriterState.state.screen === "cases" && WriterState.state.acc === null,
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
      // R53: an Initial Inspection with status Compliance has no document rule and is refused (SQL and Excel).
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
        const refusedBytes = fs.readFileSync(
          path.join(require("path").resolve(__dirname, "../.."), "tests/fixtures/reference/r50-import-fixtures", status.toLowerCase() + ".xlsx"),
        );
        await readAccelaFile({
          name: "result.xlsx",
          size: refusedBytes.length,
          arrayBuffer: async () => refusedBytes.buffer.slice(refusedBytes.byteOffset, refusedBytes.byteOffset + refusedBytes.byteLength),
        });
        assert.ok(accelaPlan(WriterState.state.acc).blockers.length > 0, status + " Excel refused");
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
        const bytes = fs.readFileSync(
          path.join(
            require("path").resolve(__dirname, "../.."),
            "tests/fixtures/reference/r50-import-fixtures",
            status.trim().replace(/\s+/g, "-").toLowerCase() + ".xlsx",
          ),
        );
        await readAccelaFile({
          name: "result.xlsx",
          size: bytes.length,
          arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
        });
        assert.equal(accelaPlan(WriterState.state.acc).blockers.length, 0, status + " Excel eligibility");
        await confirmDatabaseCase();
        assert.equal(WriterState.DOCS.length, 1, status + " Excel imports");
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
        "PASS SQL and actual Excel result status parity, snow routing, explicit m" +
          "ultiple choice, refusal of incomplete/unknown/Assist rows, reused-result" +
          " protection and later inspection import",
      );
      process.exit(0);
    };
    eval(payload + "\n(" + check.toString() + ")().catch(e=>{console.error(e);process.exit(1)});");
  },
  "audit_r50_import_repaint.js: import disclosure, picker focus and navigation across repaints": () => {
    const assert = require("assert/strict");
    require("../fixtures/bundle_test.cjs")(
      "\nWriterState.state.screen='import';WriterState.state.acc=null;WriterStat" +
        "e.state.modal=null;WriterState.state.picker=false;\nrender();\nconst alter" +
        "native=document.querySelector('.import-alternative');alternative.open=tr" +
        "ue;\ndocument.getElementById('acc-pick').focus();render();\nassert.equal(d" +
        "ocument.querySelector('.import-alternative').open,true,'late repaint kee" +
        "ps Excel choice visible');\nassert.equal(document.activeElement.id,'acc-p" +
        "ick','late repaint keeps picker keyboard focus');\ndocument.querySelector" +
        "('.import-alternative').open=false;render();\nassert.equal(document.query" +
        "Selector('.import-alternative').open,false,'an explicit close remains cl" +
        "osed');\ndocument.querySelector('.import-alternative').open=true;WriterSt" +
        "ate.state.screen='cases';render();\nWriterState.state.screen='import';ren" +
        "der();assert.equal(document.querySelector('.import-alternative').open,fa" +
        "lse,'a new navigation starts with its own disclosure state');\nconsole.lo" +
        "g('PASS import disclosure, picker focus, explicit close and navigation i" +
        "solation');",
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
  const hiddenStatuses = ["Scheduled", "Pending", "Completed", "Inspection", "No Violation", "Reinspection", "No Fee Reinspection", " no  fee reinspection "];
  for (const type of ["Initial Inspection", "Reinspection", "CA Reinspection", "Complaint Inspection"])
    for (const status of hiddenStatuses) {
      const t = accelaTable([head, row(type, status)]);
      assert.equal(t.cases.length, 0, type + "/" + status + " hidden");
      assert.match(t.errors[0], /^No eligible completed inspection: the report returned only /, type + "/" + status);
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
