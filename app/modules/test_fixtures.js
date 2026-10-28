import { workspaceState as workspace } from "./workspace_state.js";
import { editorState as editor } from "./editor_state.js";
/* Core supplies named UI/peer dependencies; construction does not read them. */
import { recordDay } from "../assets/shared.js";

import { ISSUE_EVENT } from "./document_types.js";

import { addDays } from "./calendar.js";
import { doc, docCase, docInsp, recordHead, reinsp } from "./writer_queries.js";
import { clone } from "./record_values.js";
import { isLLC } from "./mailing_rules.js";
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
export function initTestFixtures(services) {
  const fmtDateEd = (v) => (v ? services.fmtDate(v) : "");
  function futureDue(from, days) {
    const d = addDays(from || recordDay(today), days),
      m = services.MINDUE();
    return d < m ? m : d;
  }
  function issueDocument(d) {
    if (!d || !d.draft) return null;
    const addressFault = services.validateAndStandardizeAddresses(docCase(d), d.type === "citation" && isLLC(docCase(d)));
    if (addressFault) {
      services.toast(addressFault.message);
      return null;
    }
    if (d.correction) {
      services.toast("Use Review correction to save this revision to the shared record");
      return null;
    }
    const snap = clone(d);
    delete snap.draft;
    snap.status = "Final";
    // the snapshot has to be everything that printed, not just the document
    snap.frozen = services.freezeSources(d);
    const type = ISSUE_EVENT[d.type];
    if (!type) {
      services.toast("That document type cannot be issued yet");
      return null;
    }
    // a reinspection that has not been committed on its own goes on the record now
    const r = d.fromReinspId ? reinsp(d.fromReinspId) : null;
    if (r && r.draft) services.recordReinspection(r, true);
    const ev = services.appendEvent(
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
    workspace.DOCS = workspace.DOCS.filter((x) => x.id !== d.id); // the draft is spent
    services.project();
    services.saveDrafts();
    const live = doc(d.id);
    if (live) {
      editor.state.docId = live.id;
    }
    services.render();
    return ev;
  }
  const reissueDocument = (docId) => services.startCorrection(docId);
  return { futureDue, issueDocument, fmtDateEd, reissueDocument };
}
