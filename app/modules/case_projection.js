/* Explicit record facts in, derived report facts out. No workspace, UI, clock or I/O dependencies. */
import { SUMMARY_VERSION, normParcel, recordDay } from "../assets/shared.js";
import { DOC_TYPES, SCHEMA, STATUS_OF } from "./document_types.js";
import { isEffective, activeRestrictions, supplemental, isSnowCase } from "./document_rules.js";
import { addDays } from "./calendar.js";
import { byTime, clone } from "./record_values.js";
import { moneyNum } from "./presentation_format.js";
import { respondentKey } from "./citation_policy.js";
import { isSnowDocument } from "./record_sources.js";
import { caseFileName } from "./case_file_rules.js";
import { LIBRARY as DEFAULT_LIBRARY } from "./data/library.js";
export const libType = (e, how) => ({
  key: e.cl.code + "/" + e.g.code + "/" + e.it.o,
  label: e.cl.name + " \u203a " + e.g.name + " \u203a " + e.it.t,
  how: how,
});

/* Replay phases. The Python helper mirrors these (replay_issued, apply_correction, patch_visit, ...); change them together. */
function patchVisit(state, ev, patch) {
  const r = state.reins.find((x) => x.id === patch.id);
  if (!r) return;
  r.date = patch.date;
  r.time = patch.time;
  r.results = Object.assign({}, r.results, clone(patch.results));
  r.amendedAt = ev.at;
  r.amendedBy = ev.by;
}

function applyCorrection(state, ev, p, d) {
  const old = state.docs.find((x) => x.id === p.replaces);
  if (old) {
    old.superseded = { at: ev.at, by: ev.by, replacedBy: d.id, reason: p.reason };
    if (old.void) old.void.replacedBy = d.id;
  }
  d.revision = Object.assign({}, d.revision, { at: ev.at, by: ev.by });
  if (p.visitCorrection) patchVisit(state, ev, p.visitCorrection);
}

function replayIssued(state, ev, p) {
  const d = clone(p.snapshot);
  d.status = "Final";
  d.issuedAt = ev.at;
  d.issuedBy = ev.by;
  d.eventId = ev.id;
  if (p.replaces) d.replaces = p.replaces;
  if (ev.type === "correction.issued") applyCorrection(state, ev, p, d);
  state.docs.push(d);
}

function replayVisit(state, ev, p) {
  const r = clone(p.reinspection);
  r.recordedAt = ev.at;
  r.eventId = ev.id;
  state.reins.push(r);
}

/* Events that annotate an already replayed document; an unknown document or kind changes nothing. */
const DOCUMENT_EVENTS = {
  "document.served": (d, ev, p) => {
    d.serviceRecords = d.serviceRecords || [];
    d.serviceRecords.push({ ...clone(p), id: ev.id, at: ev.at, by: ev.by });
  },
  "document.annotated": (d, ev, p) => {
    d.annotations = d.annotations || [];
    d.annotations.push({ at: ev.at, by: ev.by, text: p.text });
  },
  "document.reconciled": (d, ev, p) => {
    d.reconciliation = { at: ev.at, by: ev.by, reference: p.reference };
  },
  "document.recorded": (d, ev, p) => {
    d.accelaAt = ev.at;
    d.accelaRef = p.reference || "";
  },
  "document.filed": (d, ev, p) => {
    d.filedAt = ev.at;
    d.filedRef = p.reference || "";
    d.filedArtifact = p.sha256 && p.filename ? { filename: p.filename, sha256: p.sha256 } : null;
  },
};

function replayDocumentEvent(state, ev, p) {
  if (typeof ev.type !== "string" || !Object.hasOwn(DOCUMENT_EVENTS, ev.type)) return;
  const d = state.docs.find((x) => x.id === p.docId);
  if (d) DOCUMENT_EVENTS[ev.type](d, ev, p);
}

function replayEvent(state, ev) {
  const p = ev.payload || {};
  if (/\.issued$/.test(ev.type) && p.snapshot) replayIssued(state, ev, p);
  else if (ev.type === "reinspection.recorded" && p.reinspection) replayVisit(state, ev, p);
  else if (ev.type === "document.voided") state.voided[p.docId] = { reason: p.reason || "", at: ev.at, by: ev.by, replacedBy: p.replacedBy || "" };
  else replayDocumentEvent(state, ev, p);
}

function linkVoids(docs, voided) {
  docs.forEach((d) => {
    if (voided[d.id]) {
      d.void = voided[d.id];
    }
  });
  docs.forEach((d) => {
    const rep = docs.find((x) => x.replaces === d.id);
    if (rep && d.void && !d.void.replacedBy) d.void.replacedBy = rep.id;
  });
}

export function replayEvents(list) {
  const evs = (list || []).slice().sort(byTime);
  const state = { docs: [], reins: [], voided: {} };
  evs.forEach((ev) => replayEvent(state, ev));
  linkVoids(state.docs, state.voided);
  return { documents: state.docs.reverse(), reinspections: state.reins }; // newest document first
}

export function libEntry(key, LIBRARY = DEFAULT_LIBRARY) {
  if (!key) return null;
  const cl = LIBRARY.find((x) => x.code === key.c),
    g = cl && cl.groups.find((x) => x.code === key.g),
    it = g && g.items.find((x) => x.o === key.o);
  return it ? { cl: cl, g: g, it: it } : null;
}

export function reportSectionSignature(sections) {
  // R61 display punctuation must not reclassify legacy items without library IDs.
  return sections.map((s) => (s === "27.05(2)(g)2" ? "27.05(2)(g)2." : s)).join("|");
}

export function violationType(it, LIBRARY = DEFAULT_LIBRARY) {
  const e = libEntry(it.lib, LIBRARY);
  if (e) return libType(e, "library");
  const t = String(it.title || "").trim(),
    s = reportSectionSignature(it.sections || []),
    hits = [];
  LIBRARY.forEach((cl) =>
    cl.groups.forEach((g) =>
      g.items.forEach((x) => {
        if (String(x.t).trim() === t && reportSectionSignature(x.s || []) === s) hits.push({ cl: cl, g: g, it: x });
      }),
    ),
  );
  if (hits.length === 1) return libType(hits[0], "matched");
  const s0 = (it.sections || [])[0] || "";
  return { key: "unclassified/" + s0, label: "Unclassified: " + (s0 || "no ordinance"), how: "section" };
}

/* Summary phases. Statement order matches the original, so the first refusing expression is unchanged.
   The Python helper mirrors these (document_facts, case_status, active_visits, ...); change them together. */
const issuedDay = (d) => (d.revision && (d.revision.actionDate || d.revision.originalIssued)) || d.mailed || recordDay(d.issuedAt);
const starts = (d) => (d.revision ? recordDay(d.issuedAt) : d.mailed || recordDay(d.issuedAt));
const ends = (d) => [d.void && recordDay(d.void.at), d.superseded && recordDay(d.superseded.at)].filter(Boolean).sort()[0] || "";
const issuedBy = (d, nameOf) => (d.frozen && d.frozen.inspector ? d.frozen.inspector.name : nameOf(d.issuedBy));

function rosterNames(f, INSPECTORS) {
  const roster = (f.inspectors || []).concat(INSPECTORS);
  return (id) => (roster.find((i) => i.id === id) || {}).name || "";
}

function documentFacts(st) {
  const docs = st.documents.slice().reverse(); // oldest first
  const live = docs.filter(isEffective);
  const notice = docs.find((d) => d.type === "notice" && d.items.length) || null;
  const noticeActive = live.some((d) => d.type === "notice" && d.items.length);
  const restrictions = activeRestrictions(live);
  const withItems = live.filter((d) => d.items.length && !supplemental(d));
  const lastItems = withItems[withItems.length - 1] || null;
  const lastDoc = live[live.length - 1] || null;
  const comp = lastItems && lastItems.type === "compliance" ? lastItems : null;
  const everReferred = live.some((d) => d.type === "referral");
  return { docs, live, notice, noticeActive, restrictions, lastItems, lastDoc, comp, everReferred };
}

function caseStatus(k, { restrictions, lastItems, lastDoc, comp, everReferred }) {
  if (isSnowCase(k) && lastDoc) return "Cited – snow";
  if (restrictions.length) return "Occupancy restricted";
  if (!lastDoc) return "Not issued";
  if (lastItems && lastItems.items.length && lastItems.items.every((i) => i.withdrawn)) return "Withdrawn";
  if (comp) return "Closed";
  if (everReferred) return "Referred";
  if (lastDoc.type === "noOccupancy" && lastDoc.special?.mode === "release" && !lastItems) return "Restriction released";
  return STATUS_OF[(lastItems || lastDoc).type] || (lastItems || lastDoc).type;
}

/* a reissue re-records its visit; the visit it replaced no longer counts */
function activeVisits(reinspections, docs) {
  const superseded = {};
  reinspections.forEach((r) => {
    if (!r.replaces) return;
    const vd = docs.find((d) => d.id === r.replaces);
    if (vd && vd.fromReinspId) superseded[vd.fromReinspId] = 1;
  });
  return reinspections.filter((r) => !superseded[r.id]).sort((a, b) => (a.date === b.date ? 0 : a.date < b.date ? -1 : 1));
}

function itemNumbers(docs) {
  const noOf = {};
  docs.forEach((d) =>
    d.items.forEach((it) => {
      noOf[d.id + ":" + it.id] = String(it.no || "");
    }),
  );
  return noOf;
}

function citationRow(d, it, c, nameOf) {
  return {
    num: c.num,
    no: String(it.no || ""),
    ordinance: c.ord || (it.sections || [])[0] || "",
    desc: c.desc || "",
    issued: issuedDay(d),
    courtDate: c.courtDate || "",
    amount: moneyNum(c.amount),
    tier: c.tier || "",
    overrideBasis: c.overrideBasis || null,
    caseType: d.caseType || d.frozen?.case?.caseType || "",
    by: issuedBy(d, nameOf),
  };
}

function citationRows(live, nameOf) {
  const citations = [],
    seen = {};
  live
    .filter((d) => d.type === "citation")
    .forEach((d) =>
      d.items.forEach((it) => {
        const c = (d.cits || {})[it.id];
        if (it.withdrawn || !it.cite || !c || !c.num || seen[c.num]) return;
        seen[c.num] = 1;
        citations.push(citationRow(d, it, c, nameOf));
      }),
    );
  return citations;
}

/* What the visits say about one numbered item, in visit order. */
function applyVisitResult(outcome, r, res) {
  if (!res.carried) {
    outcome.n++;
    outcome.last = res.oc;
  }
  if (res.oc === "corrected") {
    if (!outcome.done) {
      outcome.done = true;
      outcome.doneOn = res.on || r.date || "";
    }
  } else if (!res.carried) {
    outcome.done = false;
    outcome.doneOn = "";
  }
}

function visitOutcome(visits, noOf, no) {
  const outcome = { done: false, doneOn: "", last: "", n: 0 };
  visits.forEach((r) =>
    Object.keys(r.results || {}).forEach((id) => {
      if (noOf[r.sourceDocId + ":" + id] !== no) return;
      const res = r.results[id];
      if (!res || !res.oc) return;
      applyVisitResult(outcome, r, res);
    }),
  );
  return outcome;
}

function documentHistory(docs, no, LIBRARY) {
  return docs
    .filter((d) => !supplemental(d))
    .map((d) => {
      const item = d.items.find((x) => String(x.no || "") === no);
      return item
        ? {
            docId: d.id,
            issued: starts(d),
            effectiveFrom: starts(d),
            effectiveTo: ends(d),
            void: !!d.void,
            voidAt: d.void ? recordDay(d.void.at) : "",
            done: !!item.done,
            doneOn: item.doneOn || "",
            withdrawn: !!item.withdrawn,
            due: item.due || "",
            title: item.title || "",
            sections: item.sections || [],
            ...violationType(item, LIBRARY),
          }
        : null;
    })
    .filter(Boolean);
}

function visitHistory(docs, visits, no, LIBRARY) {
  const entries = [];
  visits
    .filter((r) => !docs.some((d) => !supplemental(d) && d.fromReinspId === r.id))
    .forEach((r) => {
      const parent = docs.find((d) => d.id === r.sourceDocId),
        sourceItem = parent?.items.find((i) => String(i.no) === no),
        res = sourceItem && r.results[sourceItem.id];
      if (res)
        entries.push({
          docId: r.id,
          issued: r.date,
          effectiveFrom: r.date,
          effectiveTo: "",
          done: res.oc === "corrected",
          doneOn: res.oc === "corrected" ? res.on || r.date : "",
          withdrawn: !!sourceItem.withdrawn,
          due: sourceItem.due || "",
          title: sourceItem.title || "",
          sections: sourceItem.sections || [],
          ...violationType(sourceItem, LIBRARY),
        });
    });
  return entries;
}

function violationRow(ctx, it) {
  const { docs, visits, noOf, lastItems, citations, LIBRARY } = ctx;
  const no = String(it.no || "");
  const outcome = visitOutcome(visits, noOf, no);
  let { done, doneOn } = outcome;
  const x = lastItems && lastItems.items.find((i) => String(i.no || "") === no);
  if (x) {
    const projected = continuingItemsForVisits(lastItems, visits).find((i) => String(i.no) === no) || x;
    done = !!projected.done;
    doneOn = projected.done ? projected.doneOn || doneOn : "";
  }
  const history = documentHistory(docs, no, LIBRARY);
  history.push(...visitHistory(docs, visits, no, LIBRARY));
  history.sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom));
  const current = x || it,
    ty = violationType(current, LIBRARY);
  return {
    dueExempt: current.dueExempt || "",
    no: no,
    title: current.title || "",
    sections: (current.sections || []).slice(),
    type: ty.key,
    typeLabel: ty.label,
    withdrawn: !!current.withdrawn,
    withdrawalReason: current.withdrawalReason || "",
    typeHow: ty.how,
    history: history,
    due: x ? x.due || "" : it.due || "",
    done: done,
    doneOn: doneOn,
    lastOutcome: outcome.last,
    visits: outcome.n,
    cited: citations.filter((c) => c.no === no).length,
  };
}

const zipCode = (k) => (/\b(\d{5})(?:-\d{4})?\s*$/.exec(String(k.siteCity || "")) || [])[1] || "";

function caseIdentity(k, zip, nameOf) {
  return {
    caseType: k.caseType || "",
    number: k.number || "",
    address: k.address || "",
    siteCity: k.siteCity || "",
    zip: zip,
    parcel: k.parcel || "",
    parcelKey: normParcel(k.parcel),
    description: k.description || "",
    inspectorId: k.inspectorId || "",
    inspector: nameOf(k.inspectorId),
    opened: k.date || "",
  };
}

function caseStanding(k, facts, status) {
  const { live, notice, noticeActive, lastDoc, comp } = facts;
  return {
    noticeIssued: notice ? issuedDay(live.find((d) => d.type === "notice") || notice) : "",
    noticeActive: noticeActive,
    status: noticeActive || live.length ? status : notice ? "Withdrawn" : "Not issued",
    closedOn:
      isSnowCase(k) && lastDoc?.filedAt && lastDoc.frozen?.snowCloseOnFiling !== false ? recordDay(lastDoc.filedAt) : comp ? starts(comp) : "",
  };
}

function caseOwnership(k, printed) {
  return {
    ownerAddressKey: respondentKey(k),
    owner: k.owner || printed.owner || "",
    ownerAddr: (k.ownerAddr || printed.ownerAddr || []).slice(),
    historic: !!k.historic,
    landmark: !!k.landmark,
  };
}

const restrictionRows = (restrictions) =>
  restrictions.map((d) => ({
    id: d.id,
    scope: d.special.scope,
    unit: d.special.unit || "",
    effective: d.special.effective,
    posting: d.special.posting,
    conditions: d.special.releaseConditions,
  }));

const conditionalExtensionRows = (live) =>
  live
    .filter((d) => d.type === "vacancyExtension")
    .map((d) => ({
      id: d.id,
      reviewDate: d.special.reviewDate,
      contactBy: d.special.reviewDate ? addDays(d.special.reviewDate, -7) : "",
      expiryDate: d.special.expiryMode === "fixed" ? d.special.expiryDate || "" : "",
      affected: d.special.affected || [],
    }));

const snowInspectionRows = (live, cases, nameOf) =>
  live
    .filter((d) => isSnowDocument(d, cases))
    .map((d) => ({
      id: d.snowInspectionId,
      docId: d.id,
      date: d.inspDate,
      time: d.inspTime,
      inspector: d.frozen?.inspector?.name || nameOf(d.issuedBy),
      snow: clone(d.snow),
      citationNumber: Object.values(d.cits || {})[0]?.num || "",
    }));

const visitRows = (visits, noOf, nameOf) =>
  visits.map((r) => ({
    date: r.date || "",
    purpose: r.purpose || "violation",
    inspector: r.inspector?.name || nameOf(r.inspectorId),
    results: Object.keys(r.results || {})
      .filter((id) => (r.results[id] || {}).oc && !(r.results[id] || {}).carried)
      .map((id) => ({ no: noOf[r.sourceDocId + ":" + id] || "", oc: r.results[id].oc })),
  }));

const documentRows = (docs, nameOf) =>
  docs.map((d) => ({
    special: d.special ? clone(d.special) : null,
    serviceRecords: d.serviceRecords || [],
    id: d.id,
    type: d.type,
    label: (DOC_TYPES.find((x) => x.id === d.type) || {}).label || d.type,
    issued: issuedDay(d),
    effectiveFrom: starts(d),
    effectiveTo: ends(d),
    recordedAt: d.issuedAt,
    allWithdrawn: d.items.length > 0 && d.items.every((i) => i.withdrawn),
    revision: d.revision || null,
    superseded: !!d.superseded,
    voidAt: d.void ? recordDay(d.void.at) : "",
    annotations: d.annotations || [],
    reconciliation: d.reconciliation || null,
    by: issuedBy(d, nameOf),
    void: !!d.void,
    voidReason: d.void ? d.void.reason || "" : "",
    replaces: d.replaces || "",
    accelaAt: d.accelaAt || "",
    accelaRef: d.accelaRef || "",
  }));

const correctionRows = (f, nameOf) =>
  (f.events || [])
    .filter((e) => e.type === "correction.issued")
    .map((e) => ({
      at: e.at,
      by: nameOf(e.by),
      docId: e.payload.docId,
      replaces: e.payload.replaces,
      reason: e.payload.reason,
      changes: clone(e.payload.changes || []),
      caseChanges: clone(e.payload.caseChanges || {}),
    }));

const referralRows = (live, k, nameOf) =>
  live
    .filter((d) => d.type === "referral")
    .map((d) => {
      const pc = (d.frozen && d.frozen.case) || k;
      return {
        id: d.id,
        issued: issuedDay(d),
        by: issuedBy(d, nameOf),
        owner: pc.owner || "",
        ownerAddr: (pc.ownerAddr || []).slice(),
      };
    });

export function summarizeRecord(f, { inspectors: INSPECTORS, library: LIBRARY, cases, integrity, build: BUILD, written }) {
  const k = f["case"] || {},
    st = replayEvents(f.events || []);
  const nameOf = rosterNames(f, INSPECTORS);
  const facts = documentFacts(st);
  const { docs, live, notice, restrictions, lastItems, lastDoc } = facts;
  const status = caseStatus(k, facts);
  // Current case grouping follows reviewed case metadata; each document retains its printed owner.
  const printed = (lastDoc && lastDoc.frozen && lastDoc.frozen.case) || k;
  const visits = activeVisits(st.reinspections, docs);
  const noOf = itemNumbers(docs);
  const citations = citationRows(live, nameOf);
  const snowFirst = isSnowCase(k) ? docs.find((d) => isSnowDocument(d, cases)) : null;
  const ctx = { docs, visits, noOf, lastItems, citations, LIBRARY };
  const violations = ((notice || snowFirst)?.items || []).map((it) => violationRow(ctx, it));
  const zip = zipCode(k);
  return {
    format: "madison-case-summary",
    summaryVersion: SUMMARY_VERSION,
    schema: f.schema || SCHEMA,
    integrity: integrity,
    build: BUILD,
    written: written,
    sourceFile: caseFileName(k),
    eventCount: (f.events || []).length,
    case: { ...caseIdentity(k, zip, nameOf), ...caseStanding(k, facts, status), ...caseOwnership(k, printed) },
    restrictions: restrictionRows(restrictions),
    conditionalExtensions: conditionalExtensionRows(live),
    violations: violations,
    snowInspections: snowInspectionRows(live, cases, nameOf),
    visits: visitRows(visits, noOf, nameOf),
    documents: documentRows(docs, nameOf),
    corrections: correctionRows(f, nameOf),
    citations: citations,
    referrals: referralRows(live, k, nameOf),
  };
}

export function continuingItemsForVisits(source, visits) {
  const rows = clone(source.items || []);
  visits
    .filter((r) => !r.draft && r.sourceDocId === source.id)
    .sort((a, b) => a.date.localeCompare(b.date) || String(a.recordedAt || "").localeCompare(String(b.recordedAt || "")))
    .forEach((r) =>
      rows.forEach((i) => {
        const res = r.results?.[i.id];
        if (res?.oc === "corrected") {
          i.done = true;
          i.doneOn = res.on || r.date;
        } else if (res && res.oc !== "withdrawn" && !i.done) {
          i.done = false;
          i.doneOn = "";
        }
      }),
    );
  return rows;
}
