import { caseFileName } from "./case_file_rules.js";
import { nowISO } from "./calendar.js";
import { kase } from "./writer_queries.js";
import { workspaceState } from "./workspace_state.js";
// Case saving delegates folder writes, validation/merge, retained retries and summary generation.

function saveCaseToDownloads(services, k, name, body) {
  if (JSON.parse(body).schema >= 5) {
    services.downloadWorkspace();
    services.toast("Workspace backup downloaded. Connect the current helper to save a verified case record.");
    return false;
  }
  workspaceState.LASTWRITE = { name: name, ok: true, why: "downloads folder (no case folder linked)", at: nowISO(), bytes: body.length };
  services.rememberSaved(k, JSON.parse(body));
  services.downloadFile(name, body);
  workspaceState.DIRTY = false;
  services.toast("Saved to your downloads — " + name + " (the case folder is not linked)");
  services.render();
  return true;
}

function savedCaseMessage(name, merged) {
  return (
    "Saved to " +
    workspaceState.DIRNAME +
    " \u2014 " +
    name +
    (merged ? " (merged " + merged + " event" + (merged === 1 ? "" : "s") + " another inspector had written)" : "")
  );
}

function failedCaseSaveMessage(r) {
  return r.needGrant
    ? "The browser is still waiting for permission on " + workspaceState.DIRNAME + " — the file is held and will write once you reconnect"
    : "Could not write to " + workspaceState.DIRNAME + " (" + r.why + ") — the file is held and will write when the folder is reachable";
}

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

    if (!workspaceState.CASEDIR) return saveCaseToDownloads(services, k, name, body);
    // Chrome asks to confirm the folder once a session. Finalizing is a click, so
    // ask now rather than queueing the file behind a message nobody reads.
    if (workspaceState.NEEDGRANT) await services.grantCaseFolder(true);

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
      if (workspaceState.PENDING.some((p) => p.name === name)) {
        workspaceState.PENDING = workspaceState.PENDING.filter((p) => p.name !== name);
        await services.idbSet("pending", workspaceState.PENDING);
      }
      workspaceState.DIRTY = false;
      services.rememberSaved(k, r.file || JSON.parse(body));
      await services.writeSummary(cid, r.file || JSON.parse(body));
      await services.saveDrafts();
      services.toast(savedCaseMessage(name, merged));
      services.render();
      return true;
    }

    await services.queuePending(name, body, cid);
    services.toast(failedCaseSaveMessage(r));
    services.render();
    return false;
  }
  return { saveCaseFile };
}
