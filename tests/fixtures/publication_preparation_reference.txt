import { inspAt } from "./inspection_facts.js";
import { mailingDateMessage, mailingMaxDay, recordDay } from "../assets/shared.js";
import { stableJSON, clone } from "./record_values.js";
import { ISSUE_EVENT, REFERRED_ONLY } from "./document_types.js";
import { doc, reinsp, originalNotice, recordHead, recordNow, isReferredCase, docsFor, docInsp } from "./writer_queries.js";
import { isEffective, specialType } from "./document_rules.js";
import { validISO } from "./calendar.js";

// Preparation consumes current facts; it does not confirm, persist or file an issuance.
export function createPublicationPreparation(services) {
  function lifecycleChecks(d) {
    if (d && d.initialPreview) return [];
    if (!d || !d.draft || d.correction) return [];
    if (services.snow.is(d)) return services.snow.lifecycle(d);
    if (specialType(d.type)) return services.newDocuments.specialLifecycle(d);
    const faults = [],
      src = d.fromDocId ? doc(d.fromDocId) : null,
      r = d.fromReinspId ? reinsp(d.fromReinspId) : null;
    const first = originalNotice(d.caseId),
      current = services.sourceDocFor(d.caseId),
      baseline = d.expectedHead;
    if (Array.isArray(baseline) && stableJSON(baseline) !== stableJSON(recordHead(d.caseId)))
      faults.push("The case record changed after this draft began. Reopen the current case and review the draft before issuing.");
    if (d.type === "notice" && first) faults.push("A case can have only one original notice. Use its correction history.");
    if (d.type !== "notice" && (!src || !isEffective(src) || !current || current.id !== src.id))
      faults.push("The follow-up must use the current issued document.");
    if (src && (src.type === "compliance" || src.items.every((i) => i.withdrawn)))
      faults.push("This case is completed; start a new case for new observations.");
    if (d.type !== "notice" && !r && !(d.type === "citation" && src && src.type === "notice"))
      faults.push("This follow-up needs its recorded inspection.");
    if (r) {
      faults.push(...services.worksheetFaults(r, d.type));
      if (r.sourceDocId !== d.fromDocId) faults.push("The document and inspection have different source documents.");
      if (d.inspDate !== r.date || (d.inspTime || "") !== (r.time || ""))
        faults.push("Review the inspection: its date/time differs from this document.");
    }
    if (src && stableJSON(src.items.map((i) => String(i.no))) !== stableJSON(d.items.map((i) => String(i.no))))
      faults.push("Every issued item must retain its number and order through the follow-up.");
    if (d.type !== "notice" && REFERRED_ONLY.indexOf(d.type) < 0 && isReferredCase(d.caseId))
      faults.push("A referred case permits only referral updates or compliance.");
    if (d.type === "referralUpdate" && !isReferredCase(d.caseId)) faults.push("Issue the initial referral before a referral update.");
    if (d.type === "citation") {
      const numbers = d.items
        .filter((i) => i.cite && !i.withdrawn)
        .map((i) => ((d.cits || {})[i.id] || {}).num)
        .filter(Boolean);
      if (
        new Set(numbers).size !== numbers.length ||
        docsFor(d.caseId).some((x) => !x.draft && Object.values(x.cits || {}).some((c) => numbers.includes(c.num)))
      )
        faults.push("Each new citation needs a unique citation number. Corrections retain their existing number.");
      d.items
        .filter((i) => i.cite && !i.withdrawn)
        .forEach((i) => {
          const c = d.cits[i.id] || {};
          if (!validISO(c.issued) || c.issued < inspAt(d).date || c.issued > recordDay(services.today))
            faults.push("Citation issue dates must be between the inspection and today.");
        });
    }
    if (validISO(d.mailed) && (d.mailed < inspAt(d).date || d.mailed > mailingMaxDay(d.type))) faults.push(mailingDateMessage(d.type));
    return [...new Set(faults)].map((t) => ({ ok: false, t }));
  }

  function makePublication(d) {
    const r = d.fromReinspId ? reinsp(d.fromReinspId) : null;
    const base = recordHead(d.caseId),
      events = [];
    let at = Date.parse(recordNow(d.caseId));
    if (r && r.draft) {
      const snapshot = services.cleanVisit(r);
      snapshot.docId = d.id;
      events.push({
        id: services.evid(),
        at: new Date(at++).toISOString(),
        by: r.inspectorId,
        type: "reinspection.recorded",
        payload: { reinspId: r.id, reinspection: snapshot, sourceDocId: r.sourceDocId, expectedHead: base, lifecycle: 1 },
      });
    }
    const release = services.newDocuments.releaseVisit(d);
    if (release)
      events.push({
        id: services.evid(),
        at: new Date(at++).toISOString(),
        by: release.inspectorId,
        type: "reinspection.recorded",
        payload: {
          reinspId: release.id,
          reinspection: release,
          sourceDocId: release.sourceDocId,
          expectedHead: base.concat(events.map((e) => e.id)).sort(),
          lifecycle: 1,
        },
      });
    const snap = clone(d);
    ["draft", "pendingAmendment", "publicationEvents", "expectedHead", "publicationError", "emailSelection"].forEach((k) => delete snap[k]);
    snap.status = "Final";
    snap.authoringVersion = Math.max(11, snap.authoringVersion || 0);
    delete snap.dueWork;
    delete snap.selectionCache;
    snap.frozen = services.freezeSources(d);
    if (d.type === "notice") {
      snap.cits = {};
      delete snap.initialCitationId;
    }
    const attempt = {
      id: services.evid(),
      at: new Date(at).toISOString(),
      by: docInsp(d).id,
      type: ISSUE_EVENT[d.type],
      payload: {
        docId: d.id,
        snapshot: snap,
        fromReinspId: d.fromReinspId || "",
        fromDocId: d.fromDocId || "",
        expectedHead: base.concat(events.map((e) => e.id)).sort(),
        lifecycle: 1,
      },
    };
    d.publicationEvents = events;
    return services.initialCitations.enabled(d) ? services.initialCitations.group(d, attempt) : attempt;
  }
  return { lifecycleChecks, makePublication };
}
