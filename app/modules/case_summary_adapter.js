import { summarizeRecord } from "./case_projection.js";
import { INSPECTORS } from "./data/inspectors.js";
import { LIBRARY } from "./data/library.js";
import { BUILD } from "./data/build_identity.js";
import { WriterState } from "./state.js";
import { nowISO } from "./calendar.js";

export function createCaseSummaryAdapter(services) {
  function summarize(f) {
    return summarizeRecord(f, {
      inspectors: INSPECTORS,
      library: LIBRARY,
      cases: WriterState.CASES,
      integrity: services.recordIntegrity.status(f["case"] || {}),
      build: BUILD,
      written: nowISO(),
    });
  }
  return { summarize };
}
