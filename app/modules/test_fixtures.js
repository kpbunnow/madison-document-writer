import { recordDay } from "../assets/shared.js";
import { fmtDate, freezeSources, toast } from "./court_and_deposits.js";
import { appendEvent, project } from "./workspace_shell.js";
import { saveDrafts, validateAndStandardizeAddresses } from "./case_files.js";
import { recordReinspection, startCorrection } from "./issuance_and_corrections.js";
import { render } from "./inspection_import.js";
import { ISSUE_EVENT, MINDUE, addDays, clone, doc, docCase, docInsp, isLLC, recordHead, reinsp } from "./app_core.js";
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
  const fmtDateEd = (v) => (v ? fmtDate(v) : "");
  function futureDue(from, days) {
    const d = addDays(from || recordDay(today), days),
      m = MINDUE();
    return d < m ? m : d;
  }
  function issueDocument(d) {
    if (!d || !d.draft) return null;
    const addressFault = validateAndStandardizeAddresses(docCase(d), d.type === "citation" && isLLC(docCase(d)));
    if (addressFault) {
      toast(addressFault.message);
      return null;
    }
    if (d.correction) {
      toast("Use Review correction to save this revision to the shared record");
      return null;
    }
    const snap = clone(d);
    delete snap.draft;
    snap.status = "Final";
    // the snapshot has to be everything that printed, not just the document
    snap.frozen = freezeSources(d);
    const type = ISSUE_EVENT[d.type];
    if (!type) {
      toast("That document type cannot be issued yet");
      return null;
    }
    // a reinspection that has not been committed on its own goes on the record now
    const r = d.fromReinspId ? reinsp(d.fromReinspId) : null;
    if (r && r.draft) recordReinspection(r, true);
    const ev = appendEvent(
      d.caseId,
      type,
      {
        docId: d.id,
        snapshot: snap,
        replaces: d.replaces || "",
        fromReinspId: d.fromReinspId || "",
        fromDocId: d.fromDocId || "",
        expectedHead: recordHead(d.caseId),
      },
      null,
      docInsp(d).id,
    );
    WriterState.DOCS = WriterState.DOCS.filter((x) => x.id !== d.id); // the draft is spent
    project();
    saveDrafts();
    const live = doc(d.id);
    if (live) {
      WriterState.state.docId = live.id;
    }
    render();
    return ev;
  }
  const reissueDocument = (docId) => startCorrection(docId);
  return { futureDue, issueDocument, fmtDateEd, reissueDocument };
}
