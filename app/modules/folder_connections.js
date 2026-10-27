import { WriterState } from "./state.js";

export function createFolderConnections(services) {
  async function linkCaseFolder() {
    if (WriterState.HELPER && WriterState.HELPER.caseStore) {
      await restoreCaseFolder();
      await services.flushPending();
      services.toast("Using " + WriterState.HELPER.caseDir);
      return true;
    }
    if (!services.FS_OK) {
      services.toast("Direct folder access needs the program opened from the localhost address");
      return false;
    }
    try {
      const h = await services.window.showDirectoryPicker({ id: "madison-cases", mode: "readwrite" });
      const was = WriterState.DIRNAME;
      WriterState.CASEDIR = h;
      WriterState.DIRNAME = h.name;
      WriterState.NEEDGRANT = false;
      await services.idbSet("casedir", h);
      await services.flushPending();
      services.toast(
        was && was !== h.name ? "Now writing to " + h.name + " instead of " + was : "Linked to " + h.name + " — case files will be written there",
      );
      services.render();
      return true;
    } catch (err) {
      return false;
    }
  }

  async function restoreCaseFolder() {
    if (WriterState.HELPER && WriterState.HELPER.caseStore) {
      WriterState.CASEDIR = services.helperFolder();
      WriterState.DIRNAME = services.CASEDIR_EXPECT;
      WriterState.NEEDGRANT = false;
      services.render();
      return;
    }
    if (!services.FS_OK) return;
    const h = await services.idbGet("casedir");
    if (!h) return;
    WriterState.CASEDIR = h;
    WriterState.DIRNAME = h.name || "case folder";
    try {
      const p = await h.queryPermission({ mode: "readwrite" });
      WriterState.NEEDGRANT = p !== "granted";
    } catch (e) {
      WriterState.NEEDGRANT = true;
    }
    services.render();
  }

  async function grantCaseFolder(quiet) {
    if (!WriterState.CASEDIR) return false;
    try {
      const p = await WriterState.CASEDIR.requestPermission({ mode: "readwrite" });
      WriterState.NEEDGRANT = p !== "granted";
      if (!WriterState.NEEDGRANT && !quiet) {
        services.toast("Reconnected to " + WriterState.DIRNAME);
        await services.flushPending();
      }
      if (!quiet) services.render();
      return !WriterState.NEEDGRANT;
    } catch (e) {
      return false;
    }
  }
  return { linkCaseFolder, restoreCaseFolder, grantCaseFolder };
}
