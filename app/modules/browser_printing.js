import { editorState as editor } from "./editor_state.js";
import { APPROVED_PRINT_STYLE } from "./data/approved_print_style.js";
import { esc, fmtDate, fmtTime } from "./presentation_format.js";
import { doc, docCase, kase } from "./writer_queries.js";

/* Text a native control prints as, since inputs, selects and buttons do not print reliably. */
function controlText(n) {
  if (n.tagName === "SELECT") return (n.options[n.selectedIndex] || {}).text || "";
  if (n.type === "date") return n.value ? fmtDate(n.value) : "";
  if (n.type === "time") return fmtTime(n.value);
  return n.value || n.textContent || "";
}

function printableClone(services, sheet) {
  const clone = sheet.cloneNode(true);
  // A compact editor preference must never suppress a copy in printable HTML,
  // including the fallback path that clones an already enhanced editor.
  clone.querySelectorAll("[data-editor-extra-copy]").forEach((n) => n.removeAttribute("data-editor-extra-copy"));
  clone.querySelectorAll(".grip,.gbtn,.rm,.addrow,.no-print").forEach((n) => n.remove());
  clone.querySelectorAll("[contenteditable]").forEach((n) => n.removeAttribute("contenteditable"));
  // native inputs do not print reliably — swap them for their values
  clone.querySelectorAll("input,select,button").forEach((n) => {
    const s = services.document.createElement("span");
    s.textContent = controlText(n);
    if (n.classList.contains("hdr-time")) {
      s.style.display = "block";
      s.textContent = " " + s.textContent;
    }
    n.replaceWith(s);
  });
  return clone;
}

// Approved print CSS is frozen independently of screen-code formatting.
const PRINT_PAGE_CSS =
  "<style>html,body{background:#fff;margin:0;padding:24px}" +
  // the sheet already carries the page margins; a @page margin on top of them
  // would push the address block out of the envelope window
  "@page{size:letter;margin:0}" +
  (".desk{background:none!important;border:0!important;padding:0!important;b" + "order-radius:0!important;overflow:visible!important}") +
  ".sheet{width:8.5in!important;min-height:11in!important;margin:0 auto 24px!important;" +
  "padding:.4in .6in .7in!important;" +
  "position:relative!important;box-sizing:border-box!important;" +
  "break-after:page!important;page-break-after:always!important;" +
  ("box-shadow:0 2px 10px rgba(0,0,0,.15);background:#fff!important;font-siz" + "e:9.6pt!important;line-height:1.42!important}") +
  ".sheet table.notice{display:table!important}.sheet table.notice thead{display:table-header-group!important}" +
  ".sheet table.notice tbody{display:table-row-group!important}" +
  (".sheet table.notice tr{display:table-row!important;background:none!impor" + "tant;border:0!important;padding:0!important;margin:0!important}") +
  (".sheet table.notice td{display:table-cell!important;border-bottom:.75px " +
    "solid #999!important;padding:7px 6px!important;margin:0!important}") +
  ".sheet .c-no{width:34px!important;font:inherit!important;border-bottom:.75px solid #999!important}" +
  ".sheet .c-sec::before,.sheet .c-ab::before,.sheet .corr::before,.sheet .c-due::before{display:none!important}" +
  ".sheet .n-owner,.sheet .n-body{border:0!important;background:none!important;padding:0!important}" +
  ".sheet .n-foot{position:absolute!important;left:.6in!important;right:.6in!important;" +
  "bottom:.34in!important;margin-top:0!important;border-top:1px solid #000!important;padding-top:6px!important}" +
  ".sheet .n-owner{position:absolute!important;left:.875in!important;top:2in!important;width:4in!important;" +
  "max-height:1.1in!important;margin:0!important;outline:0!important;" +
  "font-family:Arial,Helvetica,sans-serif!important;font-size:10pt!important;" +
  "line-height:1.32!important;text-transform:uppercase!important}" +
  ".sheet .n-winspace{display:block!important;height:1.5in!important}" +
  ".sheet .n-head{min-height:1.3in!important;max-height:1.58in!important;overflow:hidden!important;" +
  "display:flex!important;align-items:flex-start!important;box-sizing:border-box!important}" +
  ".sheet .n-meta{display:grid!important;font-size:9pt!important;" +
  "grid-template-columns:minmax(0,1fr) minmax(0,1.12fr)!important;gap:0 18px!important}" +
  ".sheet .n-col{display:grid!important;grid-template-columns:auto minmax(0,1fr)!important;" +
  "gap:2px 8px!important;align-content:start!important;margin:0!important}" +
  ".sheet .n-meta dt{white-space:nowrap!important}.sheet .n-col dd{margin:0!important}" +
  ".ed{border:0!important;background:none!important;padding:0!important;min-height:0!important}" +
  ".cit{width:8.5in!important;min-height:11in!important;box-sizing:border-box!important;" +
  "padding:.5in!important;margin:0 auto 24px!important;background:#fff!important;font-size:8pt!important;" +
  "break-after:page!important;page-break-after:always!important}" +
  (".cit:last-child,.sheet:last-child{margin-bottom:0!important;break-after:" + "auto!important;page-break-after:auto!important}") +
  ".cit-bar{display:grid!important;grid-template-columns:2.85in .78in 1.05in .72in 1fr!important}" +
  ".cit-dollar .cit-bar{grid-template-columns:2.6in .78in 1.55in .72in 1fr!important}" +
  ".cit-bar>div{display:flex!important;flex-direction:column!important;justify-content:center!important}" +
  ".cit-cols{display:grid!important;grid-template-columns:2.9in 1fr!important}" +
  ".cit-mid{display:grid!important;grid-template-columns:1fr 1.85in!important}" +
  ".cit-mid-l{display:flex!important;flex-direction:column!important}" +
  ".cit-when{display:grid!important;grid-template-columns:2.9in 1fr!important}" +
  ".cit-sign{display:grid!important;grid-template-columns:1.7in 1.25in .8in 1.15in 1fr!important}" +
  ".cit-ord{display:grid!important;grid-template-columns:1fr 1.15in!important}" +
  ".cit-bar>div+div,.cit-cols>div+div{border-left:1px solid #000!important;border-top:0!important}" +
  (".cit-when>div+div,.cit-sign>div+div,.cit-ord>div+div{border-left:.6px so" + "lid #000!important;border-top:0!important}") +
  ".cit-cells{display:flex!important;flex-direction:row!important}" +
  ".cit-cells>span{border-right:.6px solid #000!important;border-bottom:0!important;padding:0 5px 0 0!important}" +
  ".cit-cells>span:last-child{border-right:0!important}" +
  ("@media print{html,body{padding:0}.sheet,.cit{box-shadow:none!important;m" + "argin-bottom:0!important}}</style></head><body>");

export function createBrowserPrinting(services) {
  function printableHTML(documentOverride, sheetOverride) {
    const d = documentOverride || doc(editor.state.docId);
    if (!d) return "";
    const k = docCase(d);
    const sheet = sheetOverride || services.document.querySelector(".desk");
    if (!sheet) {
      services.toast("Nothing to print");
      return;
    }
    const clone = printableClone(services, sheet);
    const html =
      '<!doctype html><html lang="en"><head><meta charset="utf-8"><title>' +
      esc(k.number || "Official Notice") +
      "</title>" +
      "" +
      "<style>" +
      APPROVED_PRINT_STYLE +
      "</style>" +
      PRINT_PAGE_CSS +
      clone.outerHTML +
      "</body></html>";
    return html;
  }

  function printNotice(job) {
    const d = (job && doc(job.docId)) || doc(editor.state.docId);
    if (!d) return;
    const k = kase(d.caseId);
    const html = (job && job.html) || printableHTML();
    if (!html) {
      services.toast("Nothing to print");
      return;
    }
    const url = services.URL.createObjectURL(new services.Blob([html], { type: "text/html" }));
    let w = null;
    try {
      w = services.window.open(url, "_blank");
    } catch (err) {
      w = null;
    }
    if (w) {
      services.toast("Opened in a new tab — use your browser Print");
      let fired = false;
      const go = () => {
        if (fired) return;
        fired = true;
        try {
          w.focus();
          w.print();
        } catch (err) {
          /* The browser may refuse printing; the original PDF and manual print command remain available. */
        }
      };
      try {
        w.addEventListener("load", go);
      } catch (err) {
        /* The explicit print command remains available if the browser refuses the optional load listener. */
      }
      services.setTimeout(go, 1200);
    } else {
      const a = services.document.createElement("a");
      a.href = url;
      a.download = "notice-" + (k.number || "draft") + ".html";
      services.document.body.appendChild(a);
      a.click();
      a.remove();
      services.toast("Pop-up blocked — notice downloaded. Open the file and print.");
    }
    services.setTimeout(() => services.URL.revokeObjectURL(url), 60000);
  }
  return { printableHTML, printNotice };
}
