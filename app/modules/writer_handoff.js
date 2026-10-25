/* Writer readiness and Reports handoff; restoration and file authority stay in their adapters. */
import { caseNumberKey } from "../assets/shared.js";
import { caseFileFault } from "./case_file_rules.js";
import { WriterState } from "./state.js";

/* Construction is inert. Startup calls initWriterHandoff at its existing position. */
export function createWriterHandoff(services) {
  function markWriterReady() {
    WriterState.WRITER_READY = true;
    WriterState.STARTUP_STATUS = "ready";
    WriterState.releaseWriterReady(true);
    services.render();
  }

  function markWriterFailed(error) {
    WriterState.WRITER_READY = false;
    WriterState.WORKSPACE_RESTORED = false;
    WriterState.STARTUP_STATUS = "failed";
    WriterState.STARTUP_ERROR = String(error?.message || error || "Workspace restoration failed");
    WriterState.releaseWriterReady(false);
    services.render();
  }

  async function writerOpenReportedCase(message) {
    if (!WriterState.WRITER_ACCESS) throw new Error("Another Writer tab owns this workspace");
    if (!WriterState.WRITER_READY) await services.WRITER_READY_WAIT;
    if (!WriterState.WRITER_READY) throw new Error("Saved workspace restoration must finish before opening a case.");
    const number = String(message.number || "");
    if (!caseNumberKey(number)) throw new Error("Invalid case number");
    const request = ++WriterState.HANDOFF_SEQ;
    const existing = WriterState.CASES.find((k) => caseNumberKey(k.number) === caseNumberKey(number));
    if (existing) {
      await services.preflightCase(existing.id, "report handoff", () => {
        WriterState.state.metric = "";
        WriterState.state.caseQ = number;
        WriterState.state.caseFilter = "all";
        WriterState.state.screen = "cases";
        services.render();
      });
      if (request !== WriterState.HANDOFF_SEQ) throw new Error("A newer case request replaced this one");
      WriterState.REPORT_RETURN = true;
      services.render();
      window.focus?.();
      return "Local work was kept; review the case or reconciliation panel in Writer.";
    }
    let opened;
    try {
      opened = await services.helperJSON("/cases/resolve?number=" + encodeURIComponent(number));
    } catch (error) {
      if (error.name === "NotFoundError") throw new Error("No shared case exists for " + number + ".");
      throw error;
    }
    if (request !== WriterState.HANDOFF_SEQ) throw new Error("A newer case request replaced this one");
    const file = opened.file;
    if (caseNumberKey(file.case?.number) !== caseNumberKey(number) || caseFileFault(file))
      throw new Error("The current shared file is invalid or belongs to a different case");
    if (!services.loadCaseFile(JSON.stringify(file))) throw new Error("The shared case could not be loaded");
    WriterState.REPORT_RETURN = true;
    WriterState.state.metric = "";
    WriterState.state.caseQ = number;
    WriterState.state.caseFilter = "all";
    services.render();
    window.focus?.();
    const count = Number(message.eventCount);
    if (Number.isFinite(count) && count !== (file.events || []).length) {
      WriterState.PREFLIGHT_NOTICE =
        "The shared case changed since this report was indexed. Writer opened the" +
        " current validated case; refresh Reports before relying on its totals.";
      services.render();
    }
    return "Current shared case opened in Writer.";
  }

  function initWriterHandoff() {
    if ("BroadcastChannel" in window) {
      const channel = new BroadcastChannel(services.HANDOFF_CHANNEL);
      WriterState.WRITER_CHANNEL = channel;
      channel.onmessage = async (e) => {
        if (!WriterState.WRITER_ACCESS || WriterState.WRITER_CHANNEL !== channel) return;
        const m = e.data;
        if (m?.kind === "return-ack") {
          WriterState.RETURN_ACK = m.request;
          return;
        }
        if (m?.kind !== "open" || !m.request) return;
        channel.postMessage({ kind: "accepted", request: m.request });
        try {
          const detail = await writerOpenReportedCase(m);
          if (WriterState.WRITER_ACCESS && WriterState.WRITER_CHANNEL === channel)
            channel.postMessage({ kind: "result", request: m.request, ok: true, detail });
        } catch (err) {
          if (WriterState.WRITER_ACCESS && WriterState.WRITER_CHANNEL === channel)
            channel.postMessage({ kind: "result", request: m.request, ok: false, error: err.message });
        }
      };
    }
    const number = new URLSearchParams(globalThis.location?.search || "").get("case");
    if (number)
      writerOpenReportedCase({ number }).catch((e) => {
        WriterState.PREFLIGHT_NOTICE = "Report handoff could not open the case: " + e.message;
        services.render();
      });
  }

  return { markWriterReady, markWriterFailed, writerOpenReportedCase, initWriterHandoff };
}
