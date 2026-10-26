import { caseFileName } from "./case_file_rules.js";
import { nowISO } from "./calendar.js";
import { kase } from "./writer_queries.js";
import { WriterState } from "./state.js";
// Case saving delegates folder writes, validation/merge, retained retries and summary generation.

export function createCaseSaveWorkflow(services) {
  async function saveCaseFile(cid) {
    if (!services.caseNumberAllowed(kase(cid))) {
      services.toast("Case number must use 3–80 letters, numbers or hyphens");
      return false;
    }
    const k = kase(cid),
      name = caseFileName(k);
    let body;
    try {
      body = JSON.stringify(services.caseFile(cid), null, 2);
      if (typeof body !== "string" || !body.length) throw new Error("The case did not produce a readable record");
    } catch (err) {
      services.toast("The case could not be exported — " + ((err && err.message) || "unknown error"));
      return false;
    }

    if (!WriterState.CASEDIR) {
      if (JSON.parse(body).schema >= 5) {
        services.downloadWorkspace();
        services.toast("Workspace backup downloaded. Connect the current helper to save a verified case record.");
        return false;
      }
      WriterState.LASTWRITE = { name: name, ok: true, why: "downloads folder (no case folder linked)", at: nowISO(), bytes: body.length };
      services.rememberSaved(k, JSON.parse(body));
      services.downloadFile(name, body);
      WriterState.DIRTY = false;
      services.toast("Saved to your downloads — " + name + " (the case folder is not linked)");
      services.render();
      return true;
    }
    // Chrome asks to confirm the folder once a session. Finalizing is a click, so
    // ask now rather than queueing the file behind a message nobody reads.
    if (WriterState.NEEDGRANT) await services.grantCaseFolder(true);

    let merged = 0;
    try {
      merged = await services.mergeSharedFile(cid, name);
    } catch (err) {
      await services.queuePending(name, body, cid);
      services.toast(err.message);
      services.render();
      return false;
    }
    try {
      body = JSON.stringify(services.caseFile(cid), null, 2);
      if (typeof body !== "string" || !body.length) throw new Error("The case did not produce a readable record");
    } catch (err) {
      services.toast("The case could not be exported — " + ((err && err.message) || "unknown error"));
      return false;
    }

    let r = await services.writeToFolder(name, body);
    if (!r.ok && r.needGrant) {
      await services.grantCaseFolder(true);
      r = await services.writeToFolder(name, body);
    }
    if (r.ok) {
      // a held copy of this same file is now out of date and must not be
      // written over the newer one when the queue next flushes
      if (WriterState.PENDING.some((p) => p.name === name)) {
        WriterState.PENDING = WriterState.PENDING.filter((p) => p.name !== name);
        await services.idbSet("pending", WriterState.PENDING);
      }
      WriterState.DIRTY = false;
      services.rememberSaved(k, r.file || JSON.parse(body));
      await services.writeSummary(cid, r.file || JSON.parse(body));
      await services.saveDrafts();
      services.toast(
        "Saved to " +
          WriterState.DIRNAME +
          " \u2014 " +
          name +
          (merged ? " (merged " + merged + " event" + (merged === 1 ? "" : "s") + " another inspector had written)" : ""),
      );
      services.render();
      return true;
    }

    await services.queuePending(name, body, cid);
    services.toast(
      r.needGrant
        ? "The browser is still waiting for permission on " + WriterState.DIRNAME + " — the file is held and will write once you reconnect"
        : "Could not write to " + WriterState.DIRNAME + " (" + r.why + ") — the file is held and will write when the folder is reachable",
    );
    services.render();
    return false;
  }
  return { saveCaseFile };
}
