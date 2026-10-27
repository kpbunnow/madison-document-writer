import { WriterState } from "./state.js";
import { localSaveText, updateLocalPresentation } from "./saved_work.js";

export function createDraftSaveControls(services) {
  function updateSaveStatus() {
    const el = services.document.getElementById("save-status");
    if (el) {
      el.textContent = localSaveText(services.app_savedworkContext());
      el.classList.toggle("save-error", !WriterState.LOCAL_SAVE.ok);
    }
    updateLocalPresentation(services.app_savedworkContext());
  }

  function scheduleDraftSave() {
    WriterState.DIRTY = true;
    ++WriterState.LOCAL_CHANGED;
    if (!services.IDB_OK) {
      WriterState.LOCAL_SAVE.ok = false;
      updateSaveStatus();
      return;
    }
    if (WriterState.draftTimer) services.clearTimeout(WriterState.draftTimer);
    WriterState.draftTimer = services.setTimeout(() => {
      WriterState.draftTimer = null;
      services.saveDrafts();
    }, 1500);
  }
  return { updateSaveStatus, scheduleDraftSave };
}
