/* Stable document/event identities and approved metadata; no UI or persistence dependencies. */
import { APPROVED_LANGUAGE } from "./data/approved_language.js";
import { CITATION_POLICY } from "./citation_policy.js";
export const NEW_TYPES = [
  {
    id: "summaryAbatement",
    label: "Summary Abatement",
    heading: "Order to Abate Public Nuisance",
    pfx: "SUMMARY ABATEMENT",
    group: "enforcement",
    effect: "supplemental",
    deadline: "immediate",
  },
  {
    id: "nonSummaryAbatement",
    label: "Non-Summary Abatement",
    heading: "Order to Abate Public Nuisance",
    pfx: "NON-SUMMARY ABATEMENT",
    group: "enforcement",
    effect: "supplemental",
    deadline: "order",
  },
  { id: "noOccupancy", label: "No Occupancy", pfx: "NO OCCUPANCY", group: "occupancy", effect: "supplemental", deadline: "restriction" },
  {
    id: "bestInterestExtension",
    label: "Best Interest Extension",
    pfx: "BEST INTEREST EXTENSION",
    group: "time",
    effect: "items",
    deadline: "extension",
  },
  { id: "vacancyExtension", label: "Vacancy Extension", pfx: "VACANCY EXTENSION", group: "time", effect: "items", deadline: "conditional" },
].map((x) => ({ ...x, ready: true, stacked: true }));

/* =====================================================================
   MADISON BUILDING INSPECTION — DOCUMENT WRITER (prototype)
   Template model follows the city's guide checklist export:
     CHECKLIST → GROUP → ITEM {display order, display text,
                               ordinance violation, corrective action}
   Library data below is extracted from
   ChecklistOutput_JG_PropertyMaintenance.xlsx.
   Issued records are shared; working drafts are retained on this device.
   ===================================================================== */
/* Housing (ENF_HSE_*) and Zoning (ENF_ZONE_*) checklists exist in the
   export but every row is a PLACE HOLDER — no language written yet. */
/* Document-level blocks that print below the item table. These appear
   on real notices; they are not part of the checklist export. */
export const BLOCKS = APPROVED_LANGUAGE.blocks;

export const EXTERIOR_WORK = /exterior|porch|siding|fence|paint|window|roof/i;

export const DOC_TYPES = [
  { id: "notice", label: "Official Notice", ready: true, pfx: "" },
  { id: "extension", label: "Extension", ready: true, pfx: "EXTENSION" },
  { id: "citation", label: "Citation", ready: true, pfx: "CITATION" },
  { id: "reinspect", label: "Reinspection Notice", ready: false },
  { id: "compliance", label: "Compliance Letter", ready: true, pfx: "COMPLIANCE" },
  /* the referral heading is too long to sit on the notice line, so it stacks
     above it as the division's own referrals do */
  { id: "referral", label: "Referral for Prosecution", ready: true, pfx: "REFERRAL FOR PROSECUTION", stacked: true, history: true },
  /* once a case is with the City Attorney every later visit reports on it
     rather than starting over */
  { id: "referralUpdate", label: "Update for Case Referral", ready: true, pfx: "UPDATE FOR CASE REFERRAL", stacked: true, history: true },
  { id: "placard", label: "Placard / Order to Vacate", ready: false },
]
  .filter((t) => t.ready)
  .concat(NEW_TYPES);

/* Reinspection outcomes. Anything that is not 'corrected' stays on the case
   and carries onto the next document with its original item number. */
export const OUTCOMES = [
  { id: "corrected", label: "Corrected", found: "the work complete" },
  { id: "progress", label: "Progress made", found: "partial progress, with the work still incomplete" },
  { id: "none", label: "No change", found: "no change" },
  { id: "noaccess", label: "No access", found: "no access to inspect" },
];

/* Body copy per document type, transcribed from notices on file. */
export const DOCBODY = APPROVED_LANGUAGE.documentBodies;

export const COURT = APPROVED_LANGUAGE.court;

/* The four copies are not identical. The court copy carries the narrative
   only; agency and inspector copies add a disposition record for the court to
   complete; the defendant's copy drops the narrative and carries the plea
   instructions instead. Transcribed from the division's own citations. */
export const CIT_COPIES = APPROVED_LANGUAGE.citationCopies;

export const CIT_INSTRUCTIONS = APPROVED_LANGUAGE.citationInstructions.join("");

export const COURT_CONTACT = APPROVED_LANGUAGE.courtContact;

/* ---------- what a citation actually costs ----------
   The amount on an MC-2000 is the cash deposit, not the forfeiture. Under
   MGO 1.08(3) it is the base deposit for the offence plus the statutory
   assessments in 1.08(3)(c). Sources, all read from Chapter 1 itself:
     1.08(3)(a)  the enumerated schedule of deposits, transcribed below
     1.08(3)(b)  the fallback for Chapters 6, 7, 22, 27, 28, 31, 34 and
                 Sec. 33.24 when the offence is not enumerated:
                 $100 first, $200 second, $250 third and subsequent,
                 within any twelve month period
     1.08(3)(c)  penalty assessment, jail assessment, crime lab and drug law
                 enforcement assessment, and court costs of $48 under
                 Wis. Stat. 814.65 (raised from $38 by 2025 Wis. Act 113 and
                 adopted by ORD-26-00039, 7-30-26)
   That reproduces the division's own citations exactly: a first violation of
   27.05(2)(c) at $100 comes to $197.00, and 10.25(5) at $50 comes to $134.00. */
/* ---------- when the citation is answerable ----------
   Court dates fall on a Tuesday at least six weeks out. If that Tuesday is a
   court holiday the date moves on a week. Sessions sit at 8:30 or 9:30 AM. */
const COURT_TIMES = ["08:30", "09:30"];

export const courtTime = () => COURT_TIMES[0];

/* Eleven digits after the B: nine of seconds since 1 Jan 2020, then two at
   random. The seconds field carries the year, so a citation written on the
   same date and time next year cannot repeat one written today — the earlier
   scheme dropped the year and collided once every ten such pairs. The two
   random digits separate two devices issuing in the same second without any
   per-device setup; within one device the numbers already on file are checked
   and the seconds walked until one is free. */
export const CITEPOCH = Date.UTC(2020, 0, 1);

export const CITFEES = {
  effectiveDate: CITATION_POLICY.fees.effectiveDate,
  penaltyPct: CITATION_POLICY.fees.penaltyPercent / 100,
  crimeLab: CITATION_POLICY.fees.crimeLabCents / 100,
  courtCosts: CITATION_POLICY.fees.courtRates.at(-1).cents / 100,
  ccMin: CITATION_POLICY.fees.ccMinCents / 100,
  ccMax: CITATION_POLICY.fees.ccMaxCents / 100,
};

/* ---------- the case file as an event log ----------
   Schema 3. A case file is an ordered list of things that happened, not a
   picture of how the case looks now. Issuing a document appends an event
   carrying a frozen snapshot of exactly what printed; nothing already written
   is ever edited. Current state is replayed from the events.

   Two consequences that matter. Independent record events can merge. Competing official actions
   and corrections stop for review under the shared lock, so no writer
   silently replaces another inspector's decision. And every transition already carries its own
   timestamp, which is what the reporting index is built from. */
export const SCHEMA = 5;

/* One place decides which types can be published, and the event registry is
   built from it. Adding a document type cannot leave issuing broken, and
   cannot leave the event it emits unrecognised. */
export const ISSUE_EVENT = {};

DOC_TYPES.filter((t) => t.ready).forEach((t) => {
  ISSUE_EVENT[t.id] = t.id + ".issued";
});

export const EVENT_TYPES = [
  "case.opened",
  "reinspection.recorded",
  "document.voided",
  "document.filed",
  "document.recorded",
  "correction.issued",
  "document.annotated",
  "document.reconciled",
  "document.served",
].concat(Object.keys(ISSUE_EVENT).map((k) => ISSUE_EVENT[k]));

export const STATUS_OF = {
  notice: "Notice",
  extension: "Extension",
  citation: "Cited",
  referral: "Referred",
  referralUpdate: "Referred",
  compliance: "Closed",
  summaryAbatement: "Summary Abatement",
  nonSummaryAbatement: "Non-Summary Abatement",
  noOccupancy: "Occupancy restricted",
  bestInterestExtension: "Best Interest Extension",
  vacancyExtension: "Vacancy Extension",
};

/* The court citation's violation comment is the case history in prose. Every
   date in it is already on file, so draft it and let the inspector revise. */
/* ---------- documents ---------- */
/* ---------- cases ---------- */
/* ZIP central directory -> {name: text} for the entries asked for */
/* the first worksheet of an .xlsx, as rows of cell values */
/* an Excel serial to a local date and a whole minute. 11:39:59.999 is 11:40:
   floating point, not a different time, so round rather than truncate. */
/* the report's rows, found by header, grouped by case */
/* everything the review panel shows and the confirm handler enforces, worked
   out from the parsed report and the program's own record — never the screen */
/* a case already on the share is merged in first, so the review compares
   against the whole record and not only what is on this machine */
/* ---------- order language library ---------- */
/* Every visit that resulted this item, oldest first. Item numbers are fixed
   from the original notice, so they are what ties a line on today's document
   back to what was found on each earlier visit. */
/* MGO 1.08(3) escalates the deposit for a repeat violation, so a second or
   third citation on the same item steps up the ladder rather than repeating
   the first-violation figure. */
export const OC_WORD = { corrected: "Completed", none: "No change", progress: "Progress made", noaccess: "No access", cited: "Citation issued" };

/* what may still be written once a case has gone to the City Attorney */
export const REFERRED_ONLY = ["referralUpdate", "compliance"];

export const CASE_CORRECTION_FIELDS = ["owner", "ownerAddr", "address", "siteCity", "parcel", "date", "time", "agent", "ccList", "emails"];

export const FIELD_NAMES = {
  type: "Document type",
  owner: "Owner",
  ownerAddr: "Mailing address",
  address: "Property",
  siteCity: "City / ZIP",
  parcel: "Parcel",
  date: "Initial inspection date",
  time: "Initial inspection time",
  agent: "Registered agent",
  ccList: "Copies",
  emails: "Email recipients",
  mailed: "Mailed date",
  inspDate: "Inspection date",
  inspTime: "Inspection time",
  inspectorId: "Signing inspector",
  text: "Corrective action",
  title: "Violation title",
  sections: "Ordinance",
  due: "Due date",
  abate: "Abatement",
  note: "Inspector note",
  withdrawn: "Withdrawn as entered in error",
  withdrawalReason: "Withdrawal reason",
  done: "Compliance confirmed",
  doneOn: "Compliance date",
  courtDate: "Court date",
  num: "Citation number",
};

/* One citation is filed per ordinance, and each of the four copies is its own
   letter page, laid out to the MC-2000 (02/06) form. */
export const globalCourt = () => COURT,
  globalCourtCopies = () => CIT_COPIES,
  globalCourtInstructions = () => CIT_INSTRUCTIONS,
  globalCourtContact = () => COURT_CONTACT;

export const SNOW_TYPE = "snow-10.28";
