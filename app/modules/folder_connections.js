import { workspaceState as workspace } from "./workspace_state.js";
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
      const was = workspace.DIRNAME;
      workspace.CASEDIR = h;
      workspace.DIRNAME = h.name;
      workspace.NEEDGRANT = false;
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
      workspace.CASEDIR = services.helperFolder();
      workspace.DIRNAME = services.CASEDIR_EXPECT;
      workspace.NEEDGRANT = false;
      services.render();
      return;
    }
    if (!services.FS_OK) return;
    const h = await services.idbGet("casedir");
    if (!h) return;
    workspace.CASEDIR = h;
    workspace.DIRNAME = h.name || "case folder";
    try {
      const p = await h.queryPermission({ mode: "readwrite" });
      workspace.NEEDGRANT = p !== "granted";
    } catch (e) {
      workspace.NEEDGRANT = true;
    }
    services.render();
  }

  async function grantCaseFolder(quiet) {
    if (!workspace.CASEDIR) return false;
    try {
      const p = await workspace.CASEDIR.requestPermission({ mode: "readwrite" });
      workspace.NEEDGRANT = p !== "granted";
      if (!workspace.NEEDGRANT && !quiet) {
        services.toast("Reconnected to " + workspace.DIRNAME);
        await services.flushPending();
      }
      if (!quiet) services.render();
      return !workspace.NEEDGRANT;
    } catch (e) {
      return false;
    }
  }
  return { linkCaseFolder, restoreCaseFolder, grantCaseFolder };
}
