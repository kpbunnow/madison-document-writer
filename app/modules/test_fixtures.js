import { recordDay as dep_recordDay } from "../assets/shared.js";
import { fmtDate as dep_fmtDate, freezeSources as dep_freezeSources, toast as dep_toast } from "./court_and_deposits.js";
import { appendEvent as dep_appendEvent, project as dep_project } from "./workspace_shell.js";
import { saveDrafts as dep_saveDrafts, validateAndStandardizeAddresses as dep_validateAndStandardizeAddresses } from "./case_files.js";
import { recordReinspection as dep_recordReinspection, startCorrection as dep_startCorrection } from "./issuance_and_corrections.js";
import { render as dep_render } from "./inspection_import.js";
import {
  ISSUE_EVENT as dep_ISSUE_EVENT,
  MINDUE as dep_MINDUE,
  addDays as dep_addDays,
  clone as dep_clone,
  doc as dep_doc,
  docCase as dep_docCase,
  docInsp as dep_docInsp,
  isLLC as dep_isLLC,
  recordHead as dep_recordHead,
  reinsp as dep_reinsp,
} from "./app_core.js";
import { WriterState } from "./state.js";
const TEST_CASES = [
  {
    id: "k1",
    number: "CB2026-238-03639",
    address: "1910 LEWON DR",
    parcel: "0708-222-1910-3",
    owner: "JAWAID, MAHUM",
    ownerAddr: ["HANIF, JAWAD", "1910 LEWON DR", "MADISON, WI 53711"],
    description: "COMPLAINT INSPECTION",
    inspectorId: "i4",
    date: "2026-08-26",
    time: "13:56",
    historic: false,
  },
  {
    id: "k2",
    number: "CB2026-216-03297",
    address: "1151 JENIFER ST",
    parcel: "0710-364-1151-8",
    owner: "GLAVINVESTMENTS LLC",
    ownerAddr: ["PO BOX 555", "MONROE, WI 53566"],
    description: "COMPLAINT INSPECTION",
    inspectorId: "i3",
    date: "2026-08-04",
    time: "10:28",
    historic: true,
  },
  {
    id: "k3",
    number: "CB2026-239-03712",
    address: "511 W MIFFLIN ST",
    parcel: "0709-133-0511-4",
    owner: "ESPESETH FAMILY TRUST",
    ownerAddr: ["% UPM", "516 E WASHINGTON AVE", "MADISON WI 53703"],
    description: "COMPLAINT INSPECTION",
    inspectorId: "i2",
    date: "2026-08-27",
    time: "09:15",
    historic: true,
  },
];
export { TEST_CASES };
export function initTestFixtures() {
  const fmtDateEd = (v) => (v ? dep_fmtDate(v) : "");
  function futureDue(from, days) {
    const d = dep_addDays(from || dep_recordDay(today), days),
      m = dep_MINDUE();
    return d < m ? m : d;
  }
  function issueDocument(d) {
    if (!d || !d.draft) return null;
    const addressFault = dep_validateAndStandardizeAddresses(dep_docCase(d), d.type === "citation" && dep_isLLC(dep_docCase(d)));
    if (addressFault) {
      dep_toast(addressFault.message);
      return null;
    }
    if (d.correction) {
      dep_toast("Use Review correction to save this revision to the shared record");
      return null;
    }
    const snap = dep_clone(d);
    delete snap.draft;
    snap.status = "Final";
    // the snapshot has to be everything that printed, not just the document
    snap.frozen = dep_freezeSources(d);
    const type = dep_ISSUE_EVENT[d.type];
    if (!type) {
      dep_toast("That document type cannot be issued yet");
      return null;
    }
    // a reinspection that has not been committed on its own goes on the record now
    const r = d.fromReinspId ? dep_reinsp(d.fromReinspId) : null;
    if (r && r.draft) dep_recordReinspection(r, true);
    const ev = dep_appendEvent(
      d.caseId,
      type,
      {
        docId: d.id,
        snapshot: snap,
        replaces: d.replaces || "",
        fromReinspId: d.fromReinspId || "",
        fromDocId: d.fromDocId || "",
        expectedHead: dep_recordHead(d.caseId),
      },
      null,
      dep_docInsp(d).id,
    );
    WriterState.DOCS = WriterState.DOCS.filter((x) => x.id !== d.id); // the draft is spent
    dep_project();
    dep_saveDrafts();
    const live = dep_doc(d.id);
    if (live) {
      WriterState.state.docId = live.id;
    }
    dep_render();
    return ev;
  }
  const reissueDocument = (docId) => dep_startCorrection(docId);
  return { futureDue, issueDocument, fmtDateEd, reissueDocument };
}
