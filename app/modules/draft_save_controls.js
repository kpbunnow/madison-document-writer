import { editorState as editor } from "./editor_state.js";
import { WriterState } from "./state.js";
import { localSaveText, updateLocalPresentation } from "./saved_work.js";

export function createDraftSaveControls(services) {
  function updateSaveStatus() {
    const el = services.document.getElementById("save-status");
    if (el) {
      el.textContent = localSaveText(services.app_savedworkContext());
      el.classList.toggle("save-error", !editor.LOCAL_SAVE.ok);
    }
    updateLocalPresentation(services.app_savedworkContext());
  }

  function scheduleDraftSave() {
    WriterState.DIRTY = true;
    ++editor.LOCAL_CHANGED;
    if (!services.IDB_OK) {
      editor.LOCAL_SAVE.ok = false;
      updateSaveStatus();
      return;
    }
    if (editor.draftTimer) services.clearTimeout(editor.draftTimer);
    editor.draftTimer = services.setTimeout(() => {
      editor.draftTimer = null;
      services.saveDrafts();
    }, 1500);
  }
  return { updateSaveStatus, scheduleDraftSave };
}
