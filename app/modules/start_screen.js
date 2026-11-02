/* Where Document Writer opens. On a PC that can reach the City case database the helper reports caseLookup, and the
   program opens on Import inspection (its open-case list can take up to a minute to load, so it starts loading as
   soon as the program opens). Anything that needs attention keeps the Workspace start so nothing is hidden: a draft or
   worksheet, an import waiting for review, a saved case number, or a case file waiting to reach the share. */
import { editorState as editor } from "./editor_state.js";
import { startupState as startup } from "./startup_state.js";
import { workspaceState as workspace } from "./workspace_state.js";

export function chooseStartScreen() {
  if (!startup.HELPER?.caseLookup || editor.state.screen !== "cases") return false;
  const unfinished =
    workspace.DOCS.some((d) => d.draft) ||
    workspace.REINSP.some((r) => r.draft) ||
    workspace.PENDING.length > 0 ||
    Object.values(editor.RECORD_ATTEMPTS || {}).some((attempt) => attempt.pendingAmendment) ||
    Object.values(editor.WORK?.recordForms || {}).some((form) => form.text || form.external) ||
    !!editor.state.acc ||
    !!editor.WORK?.acc ||
    !!String(editor.WORK?.entry?.["lookup-number"] || "").trim();
  if (unfinished) return false;
  editor.state.screen = "import";
  return true;
}
