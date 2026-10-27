import { restoreCaseFolder } from "./workspace_shell.js";
import {
  initWriterHandoff,
  markWriterReady,
  markWriterFailed,
  refreshArtifactLocations,
  refreshCatalog,
  recordIntegrity,
  restoreDrafts,
  restorePending,
  flushPending,
  checkHelper,
  scheduleRecoveryBackup,
} from "./app_core.js";
import { WriterState } from "./state.js";

async function bootStorage() {
  try {
    if (navigator.locks && navigator.locks.request) {
      WriterState.WRITER_ACCESS = false;
      const acquired = await new Promise((resolve) =>
        navigator.locks
          .request("madison-writer-workspace", { ifAvailable: true }, (lock) => {
            if (!lock) {
              resolve(false);
              return;
            }
            resolve(true);
            return new Promise((release) => {
              WriterState.releaseWorkspaceLock = release;
            }); // held until this tab closes or Writer stops
          })
          .catch(() => resolve(false)),
      );
      if (!acquired) {
        WriterState.STARTUP_STATUS = "locked";
        WriterState.releaseWriterReady(false);
        document.getElementById("app").innerHTML =
          '<main style="max-width:620px;margin:12vh auto;padding:28px;font-family:s' +
          'ystem-ui"><h1>Document Writer is already open</h1><p>Continue in your ex' +
          "isting Writer tab. To use this tab, close the other Writer tab and reloa" +
          "d this page.</p><button data-reload-tab>Reload this tab</button> <a href" +
          '="madison-reports.html">Open Reports</a></main>';
        document.querySelector("[data-reload-tab]").addEventListener("click", () => location.reload());
        return;
      }
    }
    WriterState.WRITER_ACCESS = true;
    initWriterHandoff();
    await checkHelper();
    if (WriterState.HELPER) await refreshCatalog();
    await restoreCaseFolder();
    await restorePending();
    await restoreDrafts();
    // Internal pending-write recovery may save only after every retained draft has been read.
    WriterState.WORKSPACE_RESTORED = true;
    await recordIntegrity.refresh();
    await refreshArtifactLocations();
    await flushPending();
    markWriterReady();
    if (WriterState.HELPER) scheduleRecoveryBackup();
  } catch (error) {
    markWriterFailed(error);
  }
}

export { bootStorage };
