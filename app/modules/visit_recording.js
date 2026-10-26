import { cleanVisit } from "./worksheet_workflow.js";
import { project } from "./case_records.js";
import { WriterState } from "./state.js";

export function createVisitRecording(services) {
  function recordReinspection(r, quiet) {
    if (!r || !r.draft) return null;
    const snap = cleanVisit(r);
    const ev = services.appendEvent(
      r.caseId,
      "reinspection.recorded",
      { reinspId: r.id, reinspection: snap, sourceDocId: r.sourceDocId },
      null,
      r.inspectorId,
    );
    WriterState.REINSP = WriterState.REINSP.filter((x) => x.id !== r.id);
    project();
    services.saveDrafts();
    if (!quiet) {
      services.toast("Reinspection of " + services.fmtDate(r.date) + " recorded");
      services.render();
    }
    return ev;
  }
  return { recordReinspection };
}
