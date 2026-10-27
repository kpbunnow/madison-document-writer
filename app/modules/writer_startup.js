import { startupState as startup } from "./startup_state.js";

export function createWriterStartup(services) {
  async function bootStorage() {
    try {
      if (services.navigator.locks && services.navigator.locks.request) {
        startup.WRITER_ACCESS = false;
        const acquired = await new Promise((resolve) =>
          services.navigator.locks
            .request("madison-writer-workspace", { ifAvailable: true }, (lock) => {
              if (!lock) {
                resolve(false);
                return;
              }
              resolve(true);
              return new Promise((release) => {
                startup.releaseWorkspaceLock = release;
              }); // held until this tab closes or Writer stops
            })
            .catch(() => resolve(false)),
        );
        if (!acquired) {
          startup.STARTUP_STATUS = "locked";
          startup.releaseWriterReady(false);
          services.document.getElementById("app").innerHTML =
            '<main style="max-width:620px;margin:12vh auto;padding:28px;font-family:s' +
            'ystem-ui"><h1>Document Writer is already open</h1><p>Continue in your ex' +
            "isting Writer tab. To use this tab, close the other Writer tab and reloa" +
            "d this page.</p><button data-reload-tab>Reload this tab</button> <a href" +
            '="madison-reports.html">Open Reports</a></main>';
          services.document.querySelector("[data-reload-tab]").addEventListener("click", () => services.location.reload());
          return;
        }
      }
      startup.WRITER_ACCESS = true;
      services.initWriterHandoff();
      await services.checkHelper();
      if (startup.HELPER) await services.refreshCatalog();
      await services.restoreCaseFolder();
      await services.restorePending();
      await services.restoreDrafts();
      // Internal pending-write recovery may save only after every retained draft has been read.
      startup.WORKSPACE_RESTORED = true;
      await services.recordIntegrity.refresh();
      await services.refreshArtifactLocations();
      await services.flushPending();
      services.markWriterReady();
      if (startup.HELPER) services.scheduleRecoveryBackup();
    } catch (error) {
      services.markWriterFailed(error);
    }
  }
  return { bootStorage };
}
