import { startupState as startup } from "./startup_state.js";
import { workspaceState as workspace } from "./workspace_state.js";
import { editorState as editor } from "./editor_state.js";
import { SUMMARY_DIR } from "../assets/shared.js";
import { esc, fmtDate } from "./presentation_format.js";
import { BUILD } from "./data/build_identity.js";

export function createStorageStatus(services) {
  function lastWriteStatus() {
    return workspace.LASTWRITE
      ? (workspace.LASTWRITE.ok ? "OK — " : "FAILED — ") +
          workspace.LASTWRITE.name +
          (workspace.LASTWRITE.why ? " (" + workspace.LASTWRITE.why + ")" : "") +
          (workspace.LASTWRITE.bytes ? " · " + workspace.LASTWRITE.bytes + " bytes" : "") +
          " · " +
          fmtDate(String(workspace.LASTWRITE.at).slice(0, 10))
      : "nothing written yet this session";
  }

  function reportingIndexStatus() {
    return workspace.LASTINDEX
      ? (workspace.LASTINDEX.ok ? "OK — " : "FAILED — ") +
          SUMMARY_DIR +
          "\\" +
          workspace.LASTINDEX.name +
          (workspace.LASTINDEX.why ? " (" + workspace.LASTINDEX.why + ")" : "") +
          " · " +
          fmtDate(String(workspace.LASTINDEX.at).slice(0, 10))
      : "no summary written yet this session";
  }

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
        startup.HELPER && startup.HELPER.caseStore
          ? startup.HELPER.caseDir
          : workspace.CASEDIR
            ? (workspace.DIRNAME || "linked") +
              (workspace.DIRNAME === services.CASEDIR_EXPECT ? "" : '   <-- expected "' + services.CASEDIR_EXPECT + '"')
            : "not linked — files go to your downloads",
      ],
      ["Folder permission", !workspace.CASEDIR ? "—" : workspace.NEEDGRANT ? "waiting for you to reconnect" : "granted"],
      ["Mode", services.storageMode()],
      [
        "Files waiting to write",
        String(workspace.PENDING.length) + (workspace.PENDING.length ? " (" + workspace.PENDING.map((p) => p.name).join(", ") + ")" : ""),
      ],
      [
        "PDF helper",
        startup.HELPER
          ? startup.HELPER.chrome
            ? "running, Chrome found"
            : "running, but Chrome was NOT found"
          : "not running — documents will print instead",
      ],
      ["PDF folder", startup.HELPER && startup.HELPER.out ? startup.HELPER.out : "—"],
      ["Outlook", !startup.HELPER ? "—" : startup.HELPER.outlook ? "found" : "NOT found — email falls back to your default mail program"],
      ["Last write", lastWriteStatus()],
      ["Reporting index", reportingIndexStatus()],
    ];
    return `<table class="diag"><tbody>${rows.map((r) => `<tr><td>${esc(r[0])}</td><td>${esc(r[1])}</td></tr>`).join("")}</tbody></table>`;
  }

  function reindexReport() {
    const r = editor.state.reindex;
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
