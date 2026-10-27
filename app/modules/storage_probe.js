import { nowISO } from "./calendar.js";
import { WriterState } from "./state.js";

export function createStorageProbe(services) {
  async function testWrite() {
    if (!WriterState.CASEDIR) {
      services.toast("Link the case folder first");
      return;
    }
    if (WriterState.NEEDGRANT) await services.grantCaseFolder(true);
    if (WriterState.CASEDIR.helper) {
      try {
        await services.helperJSON("/cases/probe", {});
        services.toast("The shared case folder is writable");
      } catch (err) {
        services.toast("Test write FAILED — " + err.message);
      }
      services.render();
      return;
    }
    const name = "_write-test.json";
    const r = await services.writeToFolder(name, JSON.stringify({ test: true, at: nowISO() }, null, 2));
    services.toast(
      r.ok ? "Test file written to " + WriterState.DIRNAME + " — look for " + name : "Test write FAILED — " + (r.why || "unknown reason"),
    );
    services.render();
  }
  return { testWrite };
}
