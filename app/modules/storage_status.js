import { SUMMARY_DIR } from "../assets/shared.js";
import { esc, fmtDate } from "./presentation_format.js";
import { BUILD } from "./data/build_identity.js";
import { WriterState } from "./state.js";

export function createStorageStatus(services) {
  function storageReport() {
    const rows = [
      ["This build", BUILD],
      [
        "Served from",
        (function () {
          const L = (typeof services.window !== "undefined" && services.window.location) || null;
          if (!L) return "unknown";
          return L.protocol === "file:" ? "a file path — the folder features are unavailable here" : L.origin || L.href || "unknown";
        })(),
      ],
      ["Folder access (File System Access API)", services.FS_OK ? "available" : "NOT AVAILABLE in this browser or origin"],
      ["Local storage for drafts (IndexedDB)", services.IDB_OK ? "available" : "NOT AVAILABLE"],
      [
        "Case folder",
        WriterState.HELPER && WriterState.HELPER.caseStore
          ? WriterState.HELPER.caseDir
          : WriterState.CASEDIR
            ? (WriterState.DIRNAME || "linked") +
              (WriterState.DIRNAME === services.CASEDIR_EXPECT ? "" : '   <-- expected "' + services.CASEDIR_EXPECT + '"')
            : "not linked — files go to your downloads",
      ],
      ["Folder permission", !WriterState.CASEDIR ? "—" : WriterState.NEEDGRANT ? "waiting for you to reconnect" : "granted"],
      ["Mode", services.storageMode()],
      [
        "Files waiting to write",
        String(WriterState.PENDING.length) + (WriterState.PENDING.length ? " (" + WriterState.PENDING.map((p) => p.name).join(", ") + ")" : ""),
      ],
      [
        "PDF helper",
        WriterState.HELPER
          ? WriterState.HELPER.chrome
            ? "running, Chrome found"
            : "running, but Chrome was NOT found"
          : "not running — documents will print instead",
      ],
      ["PDF folder", WriterState.HELPER && WriterState.HELPER.out ? WriterState.HELPER.out : "—"],
      ["Outlook", !WriterState.HELPER ? "—" : WriterState.HELPER.outlook ? "found" : "NOT found — email falls back to your default mail program"],
      [
        "Last write",
        WriterState.LASTWRITE
          ? (WriterState.LASTWRITE.ok ? "OK — " : "FAILED — ") +
            WriterState.LASTWRITE.name +
            (WriterState.LASTWRITE.why ? " (" + WriterState.LASTWRITE.why + ")" : "") +
            (WriterState.LASTWRITE.bytes ? " · " + WriterState.LASTWRITE.bytes + " bytes" : "") +
            " · " +
            fmtDate(String(WriterState.LASTWRITE.at).slice(0, 10))
          : "nothing written yet this session",
      ],
      [
        "Reporting index",
        WriterState.LASTINDEX
          ? (WriterState.LASTINDEX.ok ? "OK — " : "FAILED — ") +
            SUMMARY_DIR +
            "\\" +
            WriterState.LASTINDEX.name +
            (WriterState.LASTINDEX.why ? " (" + WriterState.LASTINDEX.why + ")" : "") +
            " · " +
            fmtDate(String(WriterState.LASTINDEX.at).slice(0, 10))
          : "no summary written yet this session",
      ],
    ];
    return `<table class="diag"><tbody>${rows.map((r) => `<tr><td>${esc(r[0])}</td><td>${esc(r[1])}</td></tr>`).join("")}</tbody></table>`;
  }

  function reindexReport() {
    const r = WriterState.state.reindex;
    if (!r) return "";
    if (r.running)
      return (
        '<div class="banner info" style="margin-top:14px"><div>Rebuilding the rep' +
        "orting index &mdash; " +
        `${esc(r.done)}` +
        " of " +
        `${esc(r.total)}` +
        " case files read.</div></div>"
      );
    const bad = r.refused.concat(r.failed);
    return (
      '<div class="banner ' +
      `${bad.length ? "warn" : "ok"}` +
      '" style="margin-top:14px"><div><strong>Reporting index rebuilt: ' +
      `${esc(r.written)}` +
      " of " +
      `${esc(r.total)}` +
      " case file" +
      `${r.total === 1 ? "" : "s"}` +
      " summarized.</strong>\n    " +
      `${bad.length ? `<ul class="reidx">${bad.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>` : ""}` +
      "</div></div>"
    );
  }
  return { storageReport, reindexReport };
}
