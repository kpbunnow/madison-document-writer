import {
  activeBlocks,
  checkHelper,
  checks,
  emailDocument,
  filePdf,
  fillBlank,
  inspAt,
  openIssuedCopy,
  parseDate,
  parseTime,
  printJob,
  rnd12,
  splitOwner,
  toast,
  toastUndo,
  validISO,
} from "./court_and_deposits.js";
import {
  caseFile,
  caseFileName,
  caseNumberAllowed,
  grantCaseFolder,
  helperJSON,
  linkCaseFolder,
  loadCaseFile,
  printNotice,
  stableJSON,
  testWrite,
} from "./workspace_shell.js";
import {
  addCC,
  addEmail,
  bootStorage,
  caseUnsaved,
  clearCases,
  discardDraft,
  downloadFile,
  flushPending,
  listCaseFolder,
  openFromFolder,
  pickCaseFile,
  rebuildIndex,
  recipientPreview,
  removeCC,
  removeCase,
  removeEmail,
  saveCaseFile,
  saveDrafts,
  scheduleDraftSave,
  standardCityStateZip,
  standardStreetAddress,
  startReinspection,
  validateAndStandardizeAddresses,
} from "./case_files.js";
import {
  advanceWalk,
  clearWalk,
  ensureWalkContext,
  focusWalkItem,
  nextWalkItem,
  previousWalk,
  recordReinspectionOutcome,
  returnWalkDetails,
  skipWalkDetails,
  undoWalkOutcome,
  walkIdentity,
  focusCheckTarget,
  highlightOpenChecks,
  worksheetChecks,
} from "./reinspection.js";
import { caseState, renderKeep, render } from "./app_screens.js";
import {
  accelaFromShare,
  pickAccelaFile,
  readAccelaFile,
  accelaPlan,
  acceptAccela,
  cancelCaseLookup,
  confirmDatabaseCase,
  findDatabaseCase,
  openImportWorkspace,
  selectImportInspection,
} from "./accela_import.js";
import {
  addRecordNote,
  captureWork,
  citationFromNotice,
  commitAmendment,
  correctionChanges,
  correctionTypeAllowed,
  issueCorrection,
  itemHistory,
  itemInspectionHistory,
  needsInitialCitation,
  reconcileDocument,
  recordReinspection,
  runFinalize,
  startCorrection,
  voidDocument,
} from "./issuance_and_corrections.js";
import {
  backupUnfinished,
  catalogKey,
  changeVisitDate,
  discardWorksheet,
  downloadWorkspace,
  keepCatalogForms,
  listRecovery,
  publishDocument,
  recoveryJobs,
  recoveryWorkspace,
  restorePreviousDraft,
  restoreRecovery,
  restoreWorkspaceFile,
  returnToWorksheet,
  saveAndContinue,
  selectRecovery,
  validateRecovery,
} from "./draft_recovery.js";
import {
  adoptCatalogReview,
  applyConflict,
  catalogForm,
  catalogItem,
  catalogReplacementOptions,
  catalogReview,
  catalogSelection,
  catalogStatus,
  globalSearch,
  inspectLock,
  keepChangedLocal,
  openChangedShared,
  persistWorkspacePatch,
  preflightCase,
  refreshCatalog,
  safetyCaseStatus,
  saveWorkflowPrefs,
  showHealth,
  showLock,
  showSafety,
} from "./language_catalog.js";
import {
  activeDueTarget,
  assignDue,
  dueContext,
  dueSelectedText,
  editCitation,
  initialCitationBody,
  pdfTransferState,
  planBulkDue,
  printOutbox,
  refreshArtifactLocations,
  selectedOutbox,
  showBulkDue,
  showOutbox,
  showReminderDraft,
  showReminders,
  showTimeline,
  timelineCategory,
  timelineRows,
  toggleLibraryItem,
  updateDueIndicators,
  writerOpenReportedCase,
} from "./case_timeline.js";
import { moveItem, newDoc, renumber } from "./editor_screens.js";
import { docFromReinspection, refreshOverlay, refreshSheet, syncChip } from "./document_pagination.js";
import { DEPOSITS } from "./data/deposits.js";
import { WriterState } from "./state.js";
// Approved wording lives in app/assets/approved_language.json (acceptance item L5).
import { APPROVED_LANGUAGE } from "./data/approved_language.js";
import { languageClick } from "./language_actions.js";
import { initSnow } from "./snow_cases.js";
import { initAdministration } from "./administration.js";
import { initReviewedLibrary } from "./reviewed_library.js";
import { SUMMARY_VERSION, validCaseNumber, caseNumberKey, recordDay, csvText, downloadText } from "../assets/shared.js";
import { NEW_TYPES, alignedExtension, specialType, initNewDocuments } from "./new_documents.js";
import { initInitialCitations } from "./initial_citations.js";
import { initAddressParser } from "./address_parser.js";
import { initRecordIntegrity } from "./record_integrity.js";
import { initNavigation } from "./navigation.js";
import { createAccessibility } from "./accessibility.js";
import { LIBRARY } from "./data/library.js";
import { CITATION_POLICY, citationPricingDate as policyCitationPricingDate } from "./citation_policy.js";
import { initDepositStep } from "./deposit_step.js";
import { initCitationPricing } from "./citation_pricing.js";
import { INSPECTORS } from "./data/inspectors.js";
import { initTestFixtures, TEST_CASES as TEST_CASE_DATA } from "./test_fixtures.js";

export const snow = initSnow();
export const administration = initAdministration();
export const libraryReview = initReviewedLibrary();
export const newDocuments = initNewDocuments();
export const citationPricing = initCitationPricing();
export const depositStep = initDepositStep();
export const initialCitations = initInitialCitations();
export const navigation = initNavigation();
export const recordIntegrity = initRecordIntegrity({
  store: WriterState,
  kase: (...args) => kase(...args),
  doc: (...args) => doc(...args),
  esc: (...args) => esc(...args),
  helperJSON: (...args) => helperJSON(...args),
  render: () => render(),
});
export const addressParser = initAddressParser();
document.addEventListener("click", (e) => {
  if (e.target.closest?.("[data-a11y-help],[data-a11y-history],[data-utility-close]")) navigation.invalidateUtilities();
});
document.addEventListener("keydown", (e) => {
  if (
    !e.defaultPrevented &&
    (e.key === "Escape" || (e.key === "?" && !e.target.isContentEditable && !/INPUT|TEXTAREA|SELECT/.test(e.target.tagName)))
  )
    navigation.invalidateUtilities();
});
document.addEventListener(
  "close",
  (e) => {
    if (e.target.id === "utility-dialog") navigation.invalidateUtilities();
  },
  true,
);
const $testFixtures = __TEST_BUILD__ ? initTestFixtures() : null;

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
/* R35: an initial-inspection citation (authoring 11+) is the only mailed document; its paired Official Notice
   snapshot is the case's internal record of the deadlines and is never printed, filed or emailed separately. */
export const initialOrderCitation = (d) =>
  !!d && d.type === "citation" && !d.fromReinspId && d.authoringVersion >= 11 && !snow.is(d) && !!(d.issuanceGroup || d.initialPreview);
export const deliveredByCitation = (d) => !!d && d.type === "notice" && d.authoringVersion >= 11 && !!d.issuanceGroup?.citationId;
export const effectiveFiled = (d) => (deliveredByCitation(d) ? !!doc(d.issuanceGroup.citationId)?.filedAt : !!d?.filedAt);

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

export const courtTime = () => COURT_TIMES[0]; // One suggested session; inspector reviews court scheduling.

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
export const money = (n) => (Math.round((+n || 0) * 100) / 100).toFixed(2);
/* The inspector identifies the offence. The deposit and the statutory
   assessments follow from MGO 1.08(3) with no arithmetic on their part. */

/* 1.08(3)(b): chapters that fall back to a standard ladder when the offence
   is not on the enumerated schedule. */

/* Exact ordinance, then the same section at a finer subsection (the division
   writes 10.25 on the ticket where the schedule enumerates 10.25(5)), then the
   chapter fallback. Never a guess. */

/* ---------- inspector roster ----------
   From the division's own list of inspectors, emails and badge numbers.
   Six rows had the Last and First columns transposed; the email local part
   (initial + surname) resolves which is which. Two corrections: the sheet
   spells BLANC-CLUM where both the email and an issued citation say
   BLANC-BLUM, and Asaph Lehman's address reads 'alhman', which looks like
   a missing letter. Four badges read PLACE HOLDER and are carried as blank
   rather than as text that could print on a citation.
   Phone numbers are not in the sheet — the four here are read back from
   notices the division has issued. */

const TEST_CASES = __TEST_BUILD__ ? TEST_CASE_DATA : [];

WriterState.CASES = __TEST_BUILD__ && globalThis.MADISON_TEST_DATA ? JSON.parse(JSON.stringify(TEST_CASES)) : [];

WriterState.DOCS = [];

WriterState.REINSP = [];
/* reinspection worksheets: one per return visit */
WriterState.state = {
  acc: null,
  screen: "cases",
  docId: null,
  reinspId: null,
  folder: null,
  riFilter: "",
  riWalk: false,
  riWalkContext: null,
  riWalkItem: null,
  riWalkUndo: null,
  riWalkSkipped: [],
  riWalkMode: "quick",
  riWalkStage: "outcome",
  caseQ: "",
  caseFilter: "attention",
  caseInspector: "",
  issuedCase: "",
  metric: "",
  keepAdding: true,
  folderQ: "",
  emailOnIssue: false,
  sendDoc: null,
  sendJob: null,
  sendReuse: undefined,
  picker: false,
  q: "",
  cl: -1,
  grp: 0,
  modal: null,
  libFilter: "",
  libStatus: "approved",
  pickerStatus: "approved",
  libCl: -1,
  languageMode: "browse",
  catalogAdminKey: "",
  catalogAdminQ: "",
  catalogAdminStatus: "review",
  pickerDoc: null,
};

export const A11Y = createAccessibility();
/* Ids have to be unique across machines, not only within this session:
   two inspectors working the same case offline both allocate ids and the
   files are merged by union, so a plain counter collides. The counter is
   kept as a readable prefix; the random tail is what makes it unique. */
WriterState.seq = 100;

export const uid = (p) => p + ++WriterState.seq + "-" + rnd12();
WriterState.DIRTY = false;
/* unsaved work exists that is not in any exported file */

/* ---------- helpers ---------- */
export const esc = (s) =>
  String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
export const nl2 = (s) => esc(s).replace(/\n/g, "<br>");
export const kase = (id) => WriterState.CASES.find((k) => k.id === id) || {};
export const insp = (id) => INSPECTORS.find((i) => i.id === id) || {};
export const doc = (id) => WriterState.DOCS.find((d) => d.id === id);
/* The clock is read at the moment it is used, never captured at load. A
   laptop left open overnight must not keep writing yesterday onto
   documents, and a fixture date silently backdates everything. */
Object.defineProperty(globalThis, "today", {
  configurable: true,
  get() {
    return new Date();
  },
});
export const iso = (d) => recordDay(d);
export const addDays = (s, n) => {
  const d = new Date(s + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
export const daysBetween = (a, b) => Math.round((new Date(b + "T12:00:00") - new Date(a + "T12:00:00")) / 864e5);

/* The header dates are typed, not picked, so they read as plain text on the
   page. Parsing is deliberately forgiving; anything unreadable leaves the
   stored value alone rather than wiping it mid-keystroke. */
/* the table prints a dash for a missing date; an editable field shows nothing
   so its placeholder can do the work */
/* test fixture API: retained for audit_*.js; production uses confirmed publication. */
// Test hook: exported so the test build keeps it; tests call it by name.
export const fmtDateEd = __TEST_BUILD__ ? $testFixtures.fmtDateEd : undefined;
/* A date that does not read as a real calendar day has to be rejected
   rather than compared: every comparison against NaN is false, so an
   unreadable value otherwise satisfies every bound it is checked against.
   February 31st is shaped like a date and is not one. */

/* ---------- the mailing block ----------
   First line is the defendant, the rest is the address. A second owner name
   on line two is part of the address as the division writes it, so it is not
   treated specially. Blank lines are dropped so a stray return cannot shunt
   the name out of the defendant field or leave a hole in the address. */

export const ownerLines = (k) =>
  [k.owner]
    .concat(k.ownerAddr || [])
    .map((x) => String(x || "").trim())
    .filter(Boolean);

WriterState.undoFn = null;

// the city's fill-in convention is a literal "( )" in the corrective action
const BLANK = /\(\s{0,8}\)/g;
export const countBlanks = (s) => (String(s).match(BLANK) || []).length;
export const markBlanks = (s) => nl2(s).replace(/\(\s{0,8}\)/g, '<span class="blank" role="img" aria-label="fill-in bubble"></span>');
export const editableBlanks = (s) =>
  esc(s).replace(
    /\(\s{0,8}\)/g,
    '<span class="blank blank-edit" contenteditable="false" role="button" tab' +
      'index="0" aria-label="Fill in missing text" title="Click to fill in miss' +
      'ing text">( )</span>',
  );

document.addEventListener("click", (e) => {
  const el = e.target.closest(".blank-edit");
  if (el) {
    e.preventDefault();
    fillBlank(el);
  }
});
document.addEventListener("keydown", (e) => {
  if (e.target.matches(".blank-edit") && ["Enter", " "].includes(e.key)) {
    e.preventDefault();
    fillBlank(e.target);
  }
});
document.addEventListener("keydown", (e) => {
  if (
    WriterState.state.screen !== "reinspect" ||
    !WriterState.state.riWalk ||
    !ensureWalkContext() ||
    e.defaultPrevented ||
    e.repeat ||
    e.altKey ||
    e.ctrlKey ||
    e.metaKey
  )
    return;
  const target = e.target,
    tag = target && target.tagName;
  if (target && (target.isContentEditable || /^(INPUT|SELECT|TEXTAREA)$/.test(tag || ""))) return;
  const key = String(e.key || "").toLowerCase();
  if (target && /^(BUTTON|A)$/.test(tag || "") && !target.closest("[data-ri-walk-current]") && !(key === "u" && target.closest("[data-riwalk-undo]")))
    return;
  if (key === "u" && WriterState.state.riWalkUndo) {
    e.preventDefault();
    undoWalkOutcome();
    return;
  }
  const outcome = { 1: "corrected", 2: "progress", 3: "none", 4: "noaccess" }[key];
  if (!outcome || !WriterState.state.riWalkItem) return;
  e.preventDefault();
  recordReinspectionOutcome(WriterState.state.riWalkItem, outcome);
});

/* ---------- what an issued document renders from ----------
   Issuing freezes the document, and everything the document was written
   from goes into the snapshot with it: the case as it read, the inspector
   who signed it, the body copy and the closing blocks. A property can be
   sold, an inspector can leave the roster and a later build can reword the
   library, and none of it may change a document the owner already holds.
   A draft has no frozen block and reads live; so does an issued document
   from a file written before this existed. */
export const frozenOf = (d) => (d && d.frozen) || null;
export const docCase = (d) => (d && d.correction && d.correction.case) || (frozenOf(d) && frozenOf(d).case) || kase(d && d.caseId);
export const docInsp = (d) =>
  d && d.correction ? insp(d.inspectorId) : (frozenOf(d) && frozenOf(d).inspector) || insp((d && d.inspectorId) || docCase(d).inspectorId);
export const docBody = (d) =>
  snow.is(d) && d.authoringVersion >= 9
    ? snow.body(d)
    : (d && d.correction && d.correction.body) ||
      (frozenOf(d) && frozenOf(d).body) ||
      (specialType(d && d.type)
        ? newDocuments.specialBody(d)
        : d && d.type === "citation" && !d.fromReinspId
          ? initialCitationBody(d)
          : DOCBODY[d && d.type]) ||
      DOCBODY.notice;
const blockText = (b) => ({ key: b, label: (BLOCKS[b] || {}).label || "", text: (BLOCKS[b] || {}).text || "" });
export const docBlocks = (d) => (d && d.correction && d.correction.blocks) || (frozenOf(d) && frozenOf(d).blocks) || activeBlocks(d).map(blockText);
/* The inspection a document was written from (division, 09/18/2026). A
   follow-up carries its own inspDate/inspTime, taken from the reinspection;
   an Official Notice, a citation drafted with it, and any document written
   before this existed have none and read the case's initial inspection. When
   a document has its own date its time is its own too, or blank: one
   inspection's date is never printed beside another's time. */
export const hasOwnInsp = (d) => !!d && Object.prototype.hasOwnProperty.call(d, "inspDate");

export const blockers = (d) => checks(d).filter((c) => !c.ok && !c.soft);

export const MINDUE = () => addDays(recordDay(today), 1);
// a due date is never today or earlier
/* test fixture API: retained for audit_*.js; production uses confirmed publication. */
// Test hook: exported so the test build keeps it; tests call it by name.
export const futureDue = __TEST_BUILD__ ? $testFixtures.futureDue : undefined;

/* Printing: window.print() is blocked inside a sandboxed frame, so the
   notice is rendered into its own document and printed from there. */
/* Address - Case Number - Document Type - Date */
/* The name ends in the document's own id. Without it two documents of the
   same type on one case, mailed the same day — a replacement especially —
   write to the same file, and the second silently replaces the first. */

/* Is the local helper there? It is what turns the finished page into a PDF and
   files it, which a browser cannot do on its own. */
WriterState.HELPER = null;

/* Outlook is driven by the local helper rather than a mailto link, because a
   mailto cannot carry an attachment and the whole point is to send the PDF. */

/* Filing, printing and emailing all happen after the click that started
   them, and the screen does not wait: finalizing a notice with a citation
   ticked opens the citation immediately. The page and the filename are
   therefore captured together, up front, and that one job is what every
   later step works from — never whatever document is on screen by then. */

/* the finished document as a standalone page: what the printer sees and what
   the helper turns into the filed PDF */

/* Where documents are going, said on every screen. A case file held back
   because the browser wants permission is not something an inspector can be
   left to notice on their own. */
/* Written because a save that quietly goes to the wrong place is impossible to
   diagnose over the phone. Everything the storage layer knows, on one screen,
   plus a probe that actually writes a file and reports what happened. */

/* ---------- case files ----------
   No backend, so the exported JSON *is* the case record. It holds the case,
   every document written against it and every reinspection, so any inspector
   can open it off the shared drive and pick the work up. */

export const reinsp = (id) => WriterState.REINSP.find((r) => r.id === id);
export const docsFor = (cid) => WriterState.DOCS.filter((d) => d.caseId === cid);
export const reinspFor = (cid) => WriterState.REINSP.filter((r) => r.caseId === cid);
/* the document a reinspection is walked against: the newest one with items,
   which is the original notice on the first return visit and the extension
   after that */

export const draftDocFor = (cid) => docsFor(cid).find((d) => d.draft) || null;
export const draftReinspFor = (cid) => WriterState.REINSP.find((r) => r.draft && r.caseId === cid) || null;
// oldest notice on the case — the one the owner first received
export const originalNotice = (cid) =>
  docsFor(cid)
    .filter((d) => !d.draft && d.type === "notice" && d.items.length)
    .slice(-1)[0] || null;
/* Items can be reordered or removed only while the first notice is still a
   draft. Once it is issued the owner has that numbered list, and every later
   document refers back to it. */
/* A document is closed to editing once it is finalized, once a reinspection
   has been walked against it, or once a later document exists on the case.
   Any of those means it is out of the inspector's hands. */
export const isLocked = (d) =>
  !d ||
  recordIntegrity.blocked(d.caseId) ||
  !!d.pendingAmendment ||
  d.status === "Final" ||
  WriterState.REINSP.some((r) => !r.draft && r.sourceDocId === d.id) ||
  docsFor(d.caseId)
    .filter((x) => x.draft)
    .indexOf(d) > 0 ||
  (!d.draft && docsFor(d.caseId)[0] !== d);
/* Items may be reordered or removed only while the first notice is still a
   draft, before anything has been issued against the case. */
export const structEditable = (d) =>
  !!d && !d.correction && d.type === "notice" && d.draft && !isLocked(d) && !docsFor(d.caseId).some((x) => !x.draft) && !reinspFor(d.caseId).length;

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

/* Event ids must survive a merge between two devices, so they are random
   rather than sequential. */

export const nowISO = () => new Date().toISOString();
export const clone = (o) => JSON.parse(JSON.stringify(o));

WriterState.EVENTS = {};
/* caseId -> [event] */
export const eventsFor = (cid) => WriterState.EVENTS[cid] || (WriterState.EVENTS[cid] = []);

/* ---------- replay ----------
   Rebuilds the published documents and reinspection record for a case. Drafts
   are not in here; they live only on this device until they are issued. */
/* Pure: an event list in, documents and visits out. Nothing global is read
   or written, so reporting can replay a file without loading it. */

export const byTime = (a, b) => (Date.parse(a.at) || 0) - (Date.parse(b.at) || 0) || (a.id === b.id ? 0 : a.id < b.id ? -1 : 1);

/* The in-memory projection the screens read. Drafts sit on top of the
   replayed history. */

/* ---------- writing and reading the file ---------- */
WriterState.SAVE_CHECKPOINTS = {};

WriterState.WRITER_ACCESS = true;
WriterState.releaseWorkspaceLock = null;

/* ---------- reporting summaries ----------
   One flat summary per case, written beside the case file into
   Reporting Index. Reporting reads these and never the case files, and
   never writes the record. Everything here is pure: a case file in, a
   summary out. */
export const summaryName = (k) => caseNumberKey(k.number) + ".json";

export const libType = (e, how) => ({
  key: e.cl.code + "/" + e.g.code + "/" + e.it.o,
  label: e.cl.name + " \u203a " + e.g.name + " \u203a " + e.it.t,
  how: how,
});
/* What kind of violation an item is: its library entry when it carries one;
   for items written before that, the one library entry with the same title
   and the same sections; otherwise its first ordinance section. */

export const moneyNum = (v) => {
  const n = parseFloat(String(v == null ? "" : v).replace(/[^0-9.]/g, ""));
  return isNaN(n) ? null : n;
};
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

/* ---------- migration ----------
   A file written today has to open years from now, after the app has moved
   on. Every load runs through here; each step upgrades one version. */
/* A migrated event must carry the same id every time the same legacy file
   is opened, or loading it twice appends the whole history again. The
   ordinal preserves the order the file was written in: same-day documents
   all migrate to noon, and a tie on the timestamp is broken on the id. */
const migId = (cid, n, kind, ref) =>
  "mig1_" +
  String(cid || "").replace(/[^A-Za-z0-9]/g, "") +
  "_" +
  String(n).padStart(4, "0") +
  "_" +
  kind +
  "_" +
  String(ref || "").replace(/[^A-Za-z0-9_-]/g, "");
export const MIGRATIONS = {
  3: function (f) {
    return Object.assign({}, f, { schema: 4 });
  },
  2: function (f) {
    return Object.assign({}, f, { schema: 3 });
  },
  1: function (f) {
    // v1 stored current state; v2 stores the events that produced it
    const evs = [];
    const cno = (f["case"] || {}).number || "";
    let mn = 0;
    (f.documents || [])
      .slice()
      .reverse()
      .forEach((d) => {
        const type =
          (d.type === "notice" ? "notice" : d.type === "extension" ? "extension" : d.type === "citation" ? "citation" : "notice") + ".issued";
        const snap = clone(d);
        snap.draft = false;
        evs.push({
          id: migId(cno, mn++, "doc", d.id),
          at: (d.mailed || d.created || "1970-01-01") + "T12:00:00.000Z",
          by: d.inspectorId || (f["case"] || {}).inspectorId || "",
          type: type,
          payload: { docId: d.id, snapshot: snap, fromReinspId: d.fromReinspId || "", fromDocId: d.fromDocId || "" },
        });
      });
    (f.reinspections || []).forEach((r) => {
      evs.push({
        id: migId(cno, mn++, "rein", r.id),
        at: (r.date || "1970-01-01") + "T12:00:00.000Z",
        by: r.inspectorId || "",
        type: "reinspection.recorded",
        payload: { reinspId: r.id, reinspection: clone(r) },
      });
    });
    return {
      format: f.format,
      schema: 2,
      exported: f.exported,
      exportedBy: f.exportedBy,
      case: f["case"],
      inspectors: f.inspectors || [],
      events: evs.sort(byTime),
    };
  },
};

/* ids are preserved on load — reinspection results are keyed by item id, so
   they must survive the round trip. Push the counter past anything incoming. */

/* Identifiers from a file are written straight into HTML attributes and into
   selectors, so anything that is not a plain identifier is refused at the
   door rather than escaped at each of the places it is used. */
export const ID_FIELDS = [
  "id",
  "docId",
  "caseId",
  "reinspId",
  "sourceDocId",
  "fromDocId",
  "fromReinspId",
  "srcItemId",
  "inspectorId",
  "replaces",
  "eventId",
  "itemId",
  "targetId",
  "rootId",
  "baseEventId",
];
export const ID_OK = /^[A-Za-z0-9_-]{1,64}$/;

/* Loading merges rather than replaces: events already held are kept, new ones
   are added, and anything present in both is deduplicated by event id. */
/* Everything a case file has to satisfy before any of it is believed. A
   file that fails here changes nothing at all: half an import leaves cases
   and events that cannot be replayed, and the screen behind it broken. */

/* The same case can be held here under a different id. Events merge into
   the id already in use, so every reference inside them is repointed first
   or the documents replay onto a case nothing looks at. */

/* ---------- storage ----------
   Served from localhost the browser gives us two things a file:// page cannot
   have: the File System Access API, so the case folder on the share is written
   in place, and IndexedDB, so drafts survive a closed laptop without ever
   touching the share. Drafts are working papers; only issued documents belong
   in the shared record. */
export const FS_OK = typeof window !== "undefined" && !!window.showDirectoryPicker;
export const CASEDIR_EXPECT = "Case JSON Files"; /* the division's folder for case records */
export const IDB_OK = typeof indexedDB !== "undefined" && !!indexedDB;
WriterState.CASEDIR = null;
/* handle on the case folder, remembered between sessions */
WriterState.DIRNAME = "";

WriterState.NEEDGRANT = false;
/* handle restored but the browser wants a click first */
WriterState.PENDING = [];
/* writes the share could not take yet */

/* One connection for the session. A fresh one per autosave leaves live
   connections behind and blocks any later upgrade of the database. */
WriterState.IDBCONN = null;

export const storageMode = () =>
  WriterState.CASEDIR ? (WriterState.NEEDGRANT ? "folder-locked" : "folder") : FS_OK ? "folder-not-linked" : "download";

/* ---------- the case folder ---------- */

/* Returns the reason it failed rather than a bare false, because a write that
   quietly does nothing is the hardest kind of fault to report. A permission
   that has lapsed mid-session is flagged as such so the next save can ask for
   it back rather than blaming the network. */
WriterState.LASTWRITE = null;

WriterState.LASTINDEX = null;
/* what the last reporting-summary write did */ /* {name, ok, why, at} — what the last write attempt did */
export const COMMITTED = new Map();

/* A summary goes into Reporting Index inside the case folder: the one place
   the browser's permission already reaches. A failed summary never blocks
   the case file; the reports page shows it as missing or stale and a
   rebuild writes it. */

/* Writes a summary for every case file in the folder, including ones this
   machine never opened. Cases are read and replayed here only; nothing is
   loaded into the working list. Must be started from a click. */

/* A write the share could not take is held and retried, so a dropped
   connection never costs an inspector their work. The queue is on disk, so it
   also survives closing the laptop mid-visit. */
/* The case id travels with the held write so the retry can re-serialise the
   case as it stands then, rather than replaying a body that was already
   superseded by a later save that succeeded. */

/* The case file on the share is one whole document and is replaced whole.
   Another inspector may have written to it since this copy was opened, so
   it is read back and merged before the write; otherwise their events are
   simply dropped. This closes the ordinary case — two people working the
   same case at different moments — and not a true simultaneous write,
   which needs a lock or a compare-and-swap the folder API does not offer. */

/* ---------- drafts ----------
   Working papers stay on this machine. They are not part of the shared record
   and are not published until the document is issued. */
WriterState.draftTimer = null;

/* A worksheet is walked against an issued document, and a follow-up draft
   carries items from one. Those live in the event log, not in the draft, so
   the events of any case a draft depends on are kept beside it. Without
   them a restored worksheet has no source to resolve and drops the
   inspector back to the case list with the original file possibly on a
   share they cannot reach. */

WriterState.LOCAL_SAVE = { ok: true, at: "", saving: false };

WriterState.LOCAL_CHANGED = 0;

/* ---------- who else hears about this case ----------
   A carbon copy, an email recipient and a registered agent are all facts about
   the property rather than about one letter, so they are held on the case and
   appear on everything written afterwards. */
export const EMAIL_KINDS = ["Property Owner", "Tenant", "Agent", "Other"];
export const ccList = (k) => (k && k.ccList) || [];
export const emailList = (k) => (k && k.emails) || [];
export const US_STATES = new Set(
  (
    "AL AK AZ AR CA CO CT DE FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS " +
    "MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV " +
    "WI WY DC"
  ).split(" "),
);
export const STATE_NAMES = Object.fromEntries(
  (
    "Alabama:AL|Alaska:AK|Arizona:AZ|Arkansas:AR|California:CA|Colorado:CO|Co" +
    "nnecticut:CT|Delaware:DE|Florida:FL|Georgia:GA|Hawaii:HI|Idaho:ID|Illino" +
    "is:IL|Indiana:IN|Iowa:IA|Kansas:KS|Kentucky:KY|Louisiana:LA|Maine:ME|Mar" +
    "yland:MD|Massachusetts:MA|Michigan:MI|Minnesota:MN|Mississippi:MS|Missou" +
    "ri:MO|Montana:MT|Nebraska:NE|Nevada:NV|New Hampshire:NH|New Jersey:NJ|Ne" +
    "w Mexico:NM|New York:NY|North Carolina:NC|North Dakota:ND|Ohio:OH|Oklaho" +
    "ma:OK|Oregon:OR|Pennsylvania:PA|Rhode Island:RI|South Carolina:SC|South " +
    "Dakota:SD|Tennessee:TN|Texas:TX|Utah:UT|Vermont:VT|Virginia:VA|Washingto" +
    "n:WA|West Virginia:WV|Wisconsin:WI|Wyoming:WY|District of Columbia:DC"
  )
    .split("|")
    .map((x) => {
      const [name, abbr] = x.split(":");
      return [name.toLowerCase(), abbr];
    }),
);

export const ccLines = (c, normalize = true) =>
  [
    String(c.name || "").trim(),
    normalize ? standardStreetAddress(c.addr) || String(c.addr || "").trim() : String(c.addr || "").trim(),
    normalize ? standardCityStateZip(c.city) || String(c.city || "").trim() : String(c.city || "").trim(),
  ].filter(Boolean);
export const agentLines = (k, normalize = true) => {
  const a = (k && k.agent) || {};
  return [
    String(a.name || "").trim(),
    normalize ? standardStreetAddress(a.addr) || String(a.addr || "").trim() : String(a.addr || "").trim(),
    normalize ? standardCityStateZip(a.city) || String(a.city || "").trim() : String(a.city || "").trim(),
  ].filter(Boolean);
};
/* Wisconsin requires a registered agent for service on a limited liability
   company, so a citation against one cannot go out without it. */
export const isLLC = (k) => /\b(LLC|L\.L\.C|LLP|L\.L\.P|INC|INCORPORATED|CORP|CORPORATION|LTD)\b/i.test(String((k && k.owner) || ""));

/* ---------- clearing a case off the list ----------
   The list is a working desk, not the record: the record is the case file on
   the share. Removing a case puts it away, and Open case file brings it back.
   Work that has not reached the share yet is a different matter, so it is
   named and confirmed rather than quietly dropped. */

/* ---------- reinspection ---------- */

export const ocOf = (r, id) => (r.results[id] || {}).oc || "";
export const openItems = (r) => {
  const src = doc(r.sourceDocId);
  return src ? src.items.filter((i) => ocOf(r, i.id) && ocOf(r, i.id) !== "corrected" && ocOf(r, i.id) !== "withdrawn") : [];
};
export const doneItems = (r) => {
  const src = doc(r.sourceDocId);
  return src ? src.items.filter((i) => ocOf(r, i.id) === "corrected") : [];
};
export const unchecked = (r) => {
  const src = doc(r.sourceDocId);
  return src ? src.items.filter((i) => !ocOf(r, i.id)) : [];
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

export const isHistoryDoc = (d) => !!(DOC_TYPES.find((t) => t.id === (d || {}).type) || {}).history;
/* what may still be written once a case has gone to the City Attorney */
export const REFERRED_ONLY = ["referralUpdate", "compliance"];

/* ---------- publishing ----------
   Issuing is the moment the working draft stops being editable and becomes a
   line in the case history. The snapshot holds everything that printed, so the
   record still reads correctly years later when the library language has moved
   on and the owner has changed. */
/* test fixture API: retained for audit_*.js; production uses confirmed publication. */
// Test hook: exported so the test build keeps it; tests call it by name.
export const issueDocument = __TEST_BUILD__ ? $testFixtures.issueDocument : undefined;

/* Everything that happens once a document is issued: the case record is
   written, and the copy that goes in the mail is either filed as a PDF by the
   local helper or sent to the print dialog. Each step reports for itself, so a
   share that is down or a missing helper never leaves the inspector guessing. */
/* A notice can carry citations from the very first visit. Issuing it leaves
   the citation drafted and waiting rather than writing it silently, so the
   inspector still sets the court details and finalizes it themselves. */

/* A visit where everything passed still has to reach the record — it is the
   compliance half of every rate the division wants to report on. */

/* Document corrections are revisions of one business action, never new visits.
   The helper commits the revision and supersession together under its case lock.
   A failed/ambiguous save retains an idempotent attempt on the local draft. */
export const isEffective = (d) => !!d && !d.draft && !d.void && !d.superseded;
/* The case is with the City Attorney now: it has an effective (issued, not voided or superseded) referral or
   referral update. Live state only; as-of projections, source-excluding correction checks and helper validation keep
   their own predicates. */
export const isReferredCase = (caseId) => docsFor(caseId).some((d) => isEffective(d) && isHistoryDoc(d));
/* Items may be cited only when the imported Accela inspection status is Citation. */
export const citeAllowed = (d) => !!d?.importRule?.cite;
/* When an imported status does not permit citations (for example Citation corrected to Official Notice in Accela
   and re-imported), clear the citation marks and their draft citation and deposit data on a draft notice or an
   open worksheet. Issued and corrected documents are never changed. Returns whether anything was cleared. */
export function clearProhibitedCitations(target) {
  if (!target?.importRule || target.importRule.cite) return false;
  let cleared = false;
  if (target.results) {
    if (!target.draft || target.docId) return false;
    for (const res of Object.values(target.results)) {
      if (res?.cite) {
        res.cite = false;
        cleared = true;
      }
    }
    return cleared;
  }
  if (!target.draft || target.correction || target.pendingIssue || target.pendingAmendment || !Array.isArray(target.items)) return false;
  for (const it of target.items) {
    if (!it.cite) continue;
    it.cite = false;
    delete target.depositRequests?.[it.id];
    delete target.cits?.[it.id];
    cleared = true;
  }
  return cleared;
}
const isRecordEvent = (e) =>
  /\.issued$/.test(e.type) || e.type === "document.voided" || e.type === "reinspection.recorded" || e.type === "document.served";
export const recordHead = (cid) =>
  eventsFor(cid)
    .filter(isRecordEvent)
    .map((e) => e.id)
    .sort();
export const correctionSource = (d) => (d && d.correction ? doc(d.correction.targetId) : null);
export const unchangedCorrectionValue = (d, id, key) => {
  const src = correctionSource(d),
    old = src && src.items.find((i) => i.id === id),
    it = d && d.items.find((i) => i.id === id);
  return !!old && !!it && stableJSON(old[key]) === stableJSON(it[key]);
};
export const unchangedCourtDate = (d, id) => {
  const src = correctionSource(d);
  return !!src && !!src.cits && !!src.cits[id] && src.cits[id].courtDate === ((d.cits || {})[id] || {}).courtDate;
};
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

/* test fixture API */
// Test hook: exported so the test build keeps it; tests call it by name.
export const reissueDocument = __TEST_BUILD__ ? $testFixtures.reissueDocument : undefined;

WriterState.AMENDMENT_BUSY = false;

/* PDF filing and email requests in flight in this window; Exit Document Writer waits for them. */
WriterState.FILING_ACTIVE = 0;

WriterState.RECORD_ATTEMPTS = {};

export const recordNow = (cid) => new Date(Math.max(Date.now(), ...eventsFor(cid).map((e) => Date.parse(e.at) + 1))).toISOString();

/* Lifecycle boundaries, durable working papers, and confirmed publication.
   Shared records contain issued facts only. A pending transaction is local. */
WriterState.WORK = { entry: {}, acc: null, recordForms: {} };

WriterState.LOCAL_SAVE_CHAIN = Promise.resolve();

export const ENTRY_IDS = ["lookup-number"];
export const recordFormKey = () => WriterState.state.docId + ":" + WriterState.state.modal;

// These handlers own working forms even before a case/document identity exists.
document.addEventListener(
  "input",
  (e) => {
    const el = e.target;
    if (ENTRY_IDS.includes(el.id)) {
      WriterState.WORK.entry[el.id] = el.value;
      scheduleDraftSave();
      return;
    }
    if (["record-action-text", "record-action-external", "record-action-inspector"].includes(el.id)) {
      const key = recordFormKey(),
        field = { "record-action-text": "text", "record-action-external": "external", "record-action-inspector": "actor" }[el.id];
      WriterState.WORK.recordForms[key] = { ...(WriterState.WORK.recordForms[key] || {}), [field]: el.value };
      scheduleDraftSave();
      return;
    }
    if (el.id === "fin-mailed") {
      const d = doc(WriterState.state.docId);
      if (d && !isLocked(d)) {
        initialCitations.mailed(d, el.value);
        scheduleDraftSave();
      }
      return;
    }
  },
  true,
);
document.addEventListener(
  "change",
  (e) => {
    if (ENTRY_IDS.includes(e.target.id)) {
      WriterState.WORK.entry[e.target.id] = e.target.value;
      scheduleDraftSave();
    }
  },
  true,
);
document.addEventListener(
  "click",
  (e) => {
    const button = e.target.closest(
      "#btn-savework,#btn-workbackup,[data-workbackup],#btn-workrestore,#btn-re" +
        "trypublish,#btn-editvisit,#btn-previousdraft,#btn-exportprevious,#btn-re" +
        "tryfiling,#btn-continuecitation,[data-worknote]",
    );
    if (!button) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    captureWork();
    if (button.id === "btn-savework") {
      saveAndContinue();
      return;
    }
    if (button.id === "btn-workbackup" || button.hasAttribute("data-workbackup")) {
      downloadWorkspace();
      return;
    }
    if (button.id === "btn-workrestore") {
      document.getElementById("utility-dialog")?.close();
      restoreWorkspaceFile();
      return;
    }
    if (button.dataset.worknote) {
      const key = button.dataset.worknote,
        cut = key.lastIndexOf(":"),
        d = doc(key.slice(0, cut));
      if (d && WriterState.WORK.recordForms[key]) {
        WriterState.state.docId = d.id;
        WriterState.state.screen = "write";
        WriterState.state.modal = key.slice(cut + 1);
        render();
      }
      return;
    }
    if (button.id === "btn-retryfiling") {
      const d = doc(WriterState.state.docId);
      if (d && !d.draft) {
        button.disabled = true;
        // printJob refuses synchronously (for example an incomplete citation packet); show why and re-enable.
        let job;
        try {
          job = printJob(d);
        } catch (error) {
          toast(error.message);
          render();
          return;
        }
        filePdf(d, job).finally(() => render());
      }
      return;
    }
    if (button.id === "btn-continuecitation") {
      const d = doc(WriterState.state.docId);
      if (needsInitialCitation(d)) {
        const next = citationFromNotice(d.id);
        if (next) {
          WriterState.state.docId = next.id;
          WriterState.state.screen = "write";
          render();
        }
      }
      return;
    }
    if (button.id === "btn-retrypublish") {
      publishDocument(doc(WriterState.state.docId));
      return;
    }
    if (button.id === "btn-editvisit") {
      returnToWorksheet(doc(WriterState.state.docId));
      return;
    }
    const r = reinsp(WriterState.state.reinspId);
    if (button.id === "btn-previousdraft") {
      restorePreviousDraft(r);
      return;
    }
    if (button.id === "btn-exportprevious") {
      if (r && r.previousDraft)
        downloadFile(
          "Previous-document-draft-" + r.id + ".json",
          JSON.stringify({ format: "madison-draft-reference", draft: r.previousDraft, inspection: r.previousWorksheet }, null, 2),
        );
      return;
    }
  },
  true,
);

/* Local-helper draft recovery. Backups are independent of IndexedDB and of
   official case files. A restore stages and validates all records first. */
export const RECOVERY_WORKSPACE_KEY = "madison-recovery-workspace-v1";

export const RECOVERY_WORKSPACE = recoveryWorkspace();
export const RECOVERY_CASE_KEYS = "madison-recovery-case-keys-v1";

WriterState.RECOVERY = { at: "", error: "", list: [], selected: null, shared: null, loading: false };

WriterState.RECOVERY_TIMER = null;
WriterState.RECOVERY_SIGNATURES = {};
WriterState.RECOVERY_SELECT_SEQ = 0;
WriterState.RECOVERY_NEXT = null;
WriterState.RECOVERY_BUSY = false;

document.addEventListener("click", (e) => {
  const t = e.target.closest?.("[data-recovery-row],[data-recovery-restore],[data-recovery-export],[data-recovery-shared],#btn-recovery");
  if (!t) return;
  if (t.id === "btn-recovery") {
    document.getElementById("utility-dialog")?.close();
    listRecovery();
    return;
  }
  if (t.dataset.recoveryRow !== undefined) {
    selectRecovery(WriterState.RECOVERY.list[+t.dataset.recoveryRow]).catch((err) => {
      WriterState.RECOVERY.error = err.message;
      render();
    });
    return;
  }
  if (t.hasAttribute("data-recovery-restore")) {
    restoreRecovery();
    return;
  }
  if (t.hasAttribute("data-recovery-export")) {
    downloadFile("Madison-recovery-" + WriterState.RECOVERY.selected.number + ".json", JSON.stringify(WriterState.RECOVERY.selected, null, 2));
    return;
  }
  if (t.hasAttribute("data-recovery-shared")) {
    const k = WriterState.RECOVERY.selected?.bundle?.cases?.[0];
    WriterState.state.modal = null;
    if (k)
      helperJSON("/cases/resolve?number=" + encodeURIComponent(k.number))
        .then((x) => loadCaseFile(JSON.stringify(x.file)))
        .catch((err) => toast("Shared case unavailable: " + err.message));
  }
});
document.addEventListener("change", async (e) => {
  if (e.target.id !== "recovery-import") return;
  try {
    const b = JSON.parse(await e.target.files[0].text());
    const row = { workspace: b.workspace, case: b.case, number: b.number, name: "Imported file", imported: b };
    validateRecovery(b, row);
    WriterState.RECOVERY.list.unshift(row);
    await selectRecovery(row);
  } catch (err) {
    WriterState.RECOVERY.error = "Import rejected: " + err.message;
    render();
  }
});

/* Catalog review events live on the share. Bundled wording stays immutable;
   a review is applied only to a newly selected item, never issued history. */
WriterState.CATALOG_EVENTS = [];
WriterState.CATALOG_ERROR = "";
WriterState.CATALOG_VERIFIED = false;
WriterState.CATALOG_FROM_CACHE = false;
WriterState.CATALOG_AT = "";
WriterState.CATALOG_FORMS = {};

try {
  const cache = JSON.parse(localStorage.getItem("madison-catalog-events-v1") || "null");
  if (cache && Array.isArray(cache.events)) {
    WriterState.CATALOG_EVENTS = cache.events;
    WriterState.CATALOG_AT = cache.at;
    WriterState.CATALOG_VERIFIED = true;
    WriterState.CATALOG_FROM_CACHE = true;
  }
  WriterState.CATALOG_FORMS = JSON.parse(localStorage.getItem("madison-catalog-forms-v1") || "{}") || {};
} catch (e) {
  /* Cached review metadata is optional; fresh helper review verification still governs issuance. */
}

document.addEventListener(
  "toggle",
  (e) => {
    const details = e.target.closest?.(".lib-guidance");
    if (!details) return;
    const key = details.querySelector("[data-catalog-key]")?.dataset.catalogKey;
    if (!key) return;
    WriterState.CATALOG_FORMS[key] = { ...catalogForm(key, catalogItem(key), catalogReview(key)), open: details.open };
    keepCatalogForms();
    if (details.open) {
      const selector = details.querySelector('[data-catalog-field="replaces"]');
      if (selector)
        selector.innerHTML = catalogReplacementOptions(key, WriterState.CATALOG_FORMS[key].replaces, WriterState.CATALOG_FORMS[key].replacementQuery);
    }
  },
  true,
);
document.addEventListener("input", (e) => {
  const el = e.target.closest?.("[data-catalog-field]");
  if (!el) return;
  const key = el.dataset.catalogKey;
  WriterState.CATALOG_FORMS[key] = {
    ...catalogForm(key, catalogItem(key), catalogReview(key)),
    ...WriterState.CATALOG_FORMS[key],
    [el.dataset.catalogField]: el.value,
    open: true,
  };
  keepCatalogForms();
});
document.addEventListener("input", (e) => {
  const el = e.target.closest?.("[data-catalog-replacement-query]");
  if (!el) return;
  const key = el.dataset.catalogReplacementQuery;
  WriterState.CATALOG_FORMS[key] = {
    ...catalogForm(key, catalogItem(key), catalogReview(key)),
    ...WriterState.CATALOG_FORMS[key],
    replacementQuery: el.value,
    open: true,
  };
  keepCatalogForms();
  const selector = el.closest("details")?.querySelector('[data-catalog-field="replaces"]');
  if (selector) selector.innerHTML = catalogReplacementOptions(key, WriterState.CATALOG_FORMS[key].replaces, el.value);
});
document.addEventListener("change", (e) => {
  if (e.target.matches?.("[data-catalog-field]")) e.target.dispatchEvent(new Event("input", { bubbles: true }));
});
document.addEventListener("click", async (e) => {
  const rebase = e.target.closest?.("[data-catalog-rebase]");
  if (rebase) {
    const key = rebase.dataset.catalogRebase,
      r = catalogReview(key),
      form = WriterState.CATALOG_FORMS[key];
    if (!r || !form) return;
    if (
      confirm(
        "Use reviewed v" + r.version + " as the basis for this new review? Your unsubmitted values are kept. Compare both versions before recording.",
      )
    ) {
      form.baseVersion = r.version;
      form.error = "Review basis updated to v" + r.version + ". Confirm your entered wording and ordinance before recording.";
      keepCatalogForms();
      render();
    }
    return;
  }
  const t = e.target.closest?.("[data-catalog-save]");
  if (!t) return;
  const key = t.dataset.catalogSave,
    i = catalogItem(key);
  if (!i) return;
  const host = t.closest("details"),
    field = (name) => host.querySelector('[data-catalog-field="' + name + '"]')?.value.trim() || "";
  const status = t.dataset.catalogStatus,
    form = WriterState.CATALOG_FORMS[key] || catalogForm(key, i, catalogReview(key));
  const data = {
    key,
    status,
    reviewer: field("reviewer"),
    wording: field("wording"),
    ordinances: field("ordinances")
      .split(";")
      .map((x) => x.trim())
      .filter(Boolean),
    source: field("source"),
    replaces: field("replaces"),
    expectedVersion: form.baseVersion,
  };
  const fields = ["reviewer", "wording", "ordinances", "source", "replaces"],
    submitted = Object.fromEntries(fields.map((n) => [n, field(n)]));
  const fail = (message) => {
    WriterState.CATALOG_FORMS[key] = { ...form, ...submitted, ...WriterState.CATALOG_FORMS[key], open: true, error: message };
    keepCatalogForms();
    if (WriterState.state.screen === "library") render();
    else toast(message, { severity: "warning" });
  };
  if (!data.reviewer) {
    fail("Reviewer is required.");
    return;
  }
  if (!data.source) {
    fail("Source or authority is required.");
    return;
  }
  if (status === "approved" && (!data.wording || !data.ordinances.length)) {
    fail("Approved wording and ordinance references are required.");
    return;
  }
  if (data.replaces && (!catalogItem(data.replaces) || data.replaces === key)) {
    fail("Choose a different catalog entry.");
    return;
  }
  if (!confirm("Record " + status + " review for " + i.t + " by " + data.reviewer + "? This adds a permanent catalog version.")) return;
  t.disabled = true;
  try {
    const response = await helperJSON("/catalog/review", data);
    const known = new Set(WriterState.CATALOG_EVENTS.map((event) => event.id)),
      incoming = new Set(response.events.map((event) => event.id));
    if (!(WriterState.CATALOG_EVENTS.some((event) => !incoming.has(event.id)) && response.events.every((event) => known.has(event.id))))
      WriterState.CATALOG_EVENTS = response.events;
    WriterState.CATALOG_VERIFIED = true;
    WriterState.CATALOG_FROM_CACHE = false;
    WriterState.CATALOG_AT = nowISO();
    WriterState.CATALOG_ERROR = "";
    try {
      localStorage.setItem("madison-catalog-events-v1", JSON.stringify({ at: WriterState.CATALOG_AT, events: WriterState.CATALOG_EVENTS }));
    } catch (error) {
      WriterState.CATALOG_ERROR = "Review recorded on the share, but this browser could not cache it.";
    }
    const later = WriterState.CATALOG_FORMS[key],
      changed = later && fields.some((n) => String(later[n] || "").trim() !== submitted[n]);
    if (changed)
      WriterState.CATALOG_FORMS[key] = {
        ...later,
        open: true,
        error:
          "Review v" +
          response.event.version +
          " was recorded. Your later edits are retained; compare and update the review basis before recording again.",
      };
    else delete WriterState.CATALOG_FORMS[key];
    keepCatalogForms();
    if (WriterState.state.screen === "library") render();
    toast("Catalog review v" + response.event.version + " recorded. Existing drafts were not changed.");
  } catch (err) {
    t.disabled = false;
    fail("Review save was not confirmed: " + err.message + ". Your form is retained. Refresh review status before retrying.");
  }
});

/* Early reconciliation is advisory; publication still uses the locked gate. */
WriterState.PREFLIGHT_SEQ = 0;
WriterState.PREFLIGHT_CONFLICT = null;
WriterState.PREFLIGHT_NOTICE = "";

document.addEventListener("click", (e) => {
  const t = e.target.closest?.("[data-shared-export],[data-shared-current],[data-shared-local]");
  if (!t) return;
  if (t.hasAttribute("data-shared-export")) downloadWorkspace();
  else if (t.hasAttribute("data-shared-local")) keepChangedLocal();
  else openChangedShared();
});

/* Plain-language safety centre; no automatic lock release. */
WriterState.SAFETY_HEALTH = null;
WriterState.SAFETY_LOCK = null;
WriterState.RESOLUTION_BUSY = false;
WriterState.WORK_PATCH = null;

document.addEventListener("submit", async (e) => {
  if (e.target.id !== "lock-release-form") return;
  e.preventDefault();
  const form = e.target;
  form.querySelector("button").disabled = true;
  try {
    const data = new FormData(form);
    await helperJSON("/locks/release", {
      number: WriterState.SAFETY_LOCK.number,
      resource: WriterState.SAFETY_LOCK.resource,
      token: WriterState.SAFETY_LOCK.token,
      administrator: data.get("administrator"),
      reason: data.get("reason"),
      confirmed: data.get("confirmed") === "on",
    });
    WriterState.SAFETY_LOCK.present = false;
    showLock();
    toast("Released verified lock; audit note saved", { severity: "success" });
  } catch (error) {
    form.querySelector("button").disabled = false;
    toast(error.message, { severity: "error" });
  }
});
document.addEventListener("click", async (e) => {
  const t = e.target.closest?.(
    "[data-sync-safety],[data-setup-health],[data-health-probe],[data-diagnos" +
      "tics-copy],[data-lock-inspect],[data-safety-case],[data-safety-backup],[" +
      "data-safety-catalog],[data-safety-outbox],[data-safety-pending],[data-co" +
      "nflict-apply],[data-safety-local]",
  );
  if (!t) return;
  try {
    if (t.hasAttribute("data-safety-local")) {
      await saveDrafts();
      await showSafety();
    } else if (t.hasAttribute("data-sync-safety")) await showSafety(t.dataset.syncSafety || "");
    else if (t.hasAttribute("data-setup-health")) await showHealth();
    else if (t.hasAttribute("data-health-probe")) await showHealth(true);
    else if (t.hasAttribute("data-diagnostics-copy")) {
      const el = document.getElementById("it-diagnostics");
      el.select();
      if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(el.value);
      else document.execCommand("copy");
      toast("Copied IT diagnostics", { severity: "success" });
    } else if (t.hasAttribute("data-lock-inspect")) await inspectLock();
    else if (t.hasAttribute("data-conflict-apply")) await applyConflict();
    else if (t.hasAttribute("data-safety-backup")) {
      await backupUnfinished(recoveryJobs());
      await showSafety();
    } else if (t.hasAttribute("data-safety-catalog")) {
      await refreshCatalog();
      await showSafety();
    } else if (t.hasAttribute("data-safety-outbox")) {
      await showOutbox();
    } else if (t.hasAttribute("data-safety-pending")) {
      document.getElementById("utility-dialog")?.close();
      if (!WriterState.CASEDIR || WriterState.NEEDGRANT) {
        WriterState.state.modal = "storage";
        render();
      } else {
        await flushPending();
        render();
        await showSafety();
      }
    } else {
      document.getElementById("utility-dialog")?.close();
      const cid = t.dataset.safetyCase,
        st = caseState(kase(cid));
      if (t.dataset.safetyAction === "integrity") {
        const proof = recordIntegrity.status(kase(cid));
        A11Y.utility(
          "Record verification details",
          "<p>" +
            `${esc(kase(cid).number)}` +
            " · " +
            `${esc(proof.label)}` +
            "</p><p>Keep this case read-only and ask an administrator to review the r" +
            "etained evidence. No automatic repair is performed.</p><details><summary" +
            ">Technical evidence</summary><p>Event: " +
            `${esc(proof.eventId || "Unavailable")}` +
            " · expected: " +
            `${esc(proof.expected || "Unavailable")}` +
            " · actual: " +
            `${esc(proof.actual || "Unavailable")}` +
            " · last good commit: " +
            `${esc(proof.lastGoodCommitTime || "Unavailable")}` +
            "</p></details>",
        );
      } else if (t.dataset.safetyAction === "conflict") {
        WriterState.state.modal = "shared-change";
        render();
      } else if (t.dataset.safetyAction === "pending") {
        if (st.pendingDoc) {
          WriterState.state.docId = st.pendingDoc.id;
          WriterState.state.screen = "write";
          render();
        } else {
          const holder = WriterState.RECORD_ATTEMPTS[st.pendingRecord.recordKey];
          if (holder) commitAmendment(holder.cid, holder.pendingAmendment, holder);
        }
      } else if (t.dataset.safetyAction === "document") {
        const d = docsFor(cid).find((x) => x.draft) || st.current;
        if (d) {
          await preflightCase(cid, "draft", () => {
            WriterState.state.docId = d.id;
            WriterState.state.screen = "write";
            render();
          });
        } else if (st.visit) {
          await preflightCase(cid, "inspection", () => startReinspection(cid));
        }
      } else if (t.dataset.safetyAction === "pdf") {
        const d = docsFor(cid).find(
          (x) =>
            !x.draft &&
            !x.void &&
            !x.superseded &&
            !deliveredByCitation(x) &&
            (!x.filedAt || !["shared", "local outbox"].includes(pdfTransferState(x))),
        );
        if (d) {
          WriterState.state.docId = d.id;
          WriterState.state.screen = "write";
          render();
        }
      } else if (t.dataset.safetyAction === "outbox") {
        await showOutbox();
      } else if (t.dataset.safetyAction === "storage") {
        WriterState.state.modal = "storage";
        render();
      } else if (t.dataset.safetyAction === "save") await saveCaseFile(cid);
      else
        await preflightCase(cid, "safety check", () => {
          render();
          showSafety();
        });
    }
  } catch (error) {
    toast(error.message, { severity: "error" });
  }
});

/* Browser-profile preferences and optional inspector workflow aids. */
export const WORKFLOW_PREFS_KEY = "madison-workspace-preferences-v1";
WriterState.WORKFLOW_PREFS = { filter: "attention", query: "", inspector: "", reminders: { enabled: false, days: 7, plans: {}, dismissed: [] } };

try {
  const raw = JSON.parse(localStorage.getItem(WORKFLOW_PREFS_KEY) || "null");
  if (raw && typeof raw === "object") {
    if (["attention", "all", "continue", "deadlines", "resolution", "drafts", "soon", "overdue", "open", "closed"].includes(raw.filter))
      WriterState.WORKFLOW_PREFS.filter = raw.filter;
    for (const key of ["query", "inspector"]) if (typeof raw[key] === "string") WriterState.WORKFLOW_PREFS[key] = raw[key].slice(0, 200);
    if (raw.reminders && typeof raw.reminders === "object") {
      const r = raw.reminders;
      WriterState.WORKFLOW_PREFS.reminders = {
        enabled: r.enabled === true,
        days: Math.min(30, Math.max(1, Number(r.days) || 7)),
        plans: Object.fromEntries(Object.entries(r.plans && typeof r.plans === "object" ? r.plans : {}).filter(([, value]) => validISO(value))),
        dismissed: Array.isArray(r.dismissed) ? r.dismissed.filter((x) => typeof x === "string").slice(-200) : [],
      };
    }
  }
} catch (error) {
  /* An optional local preference cannot change case records or issued documents. */
}
WriterState.state.caseFilter = WriterState.WORKFLOW_PREFS.filter;
WriterState.state.caseQ = WriterState.WORKFLOW_PREFS.query;
WriterState.state.caseInspector = WriterState.WORKFLOW_PREFS.inspector;

WriterState.TIMELINE_CASE = "";
WriterState.TIMELINE_FILTER = "all";

WriterState.OUTBOX_FILES = [];

document.addEventListener("submit", async (e) => {
  const form = e.target;
  if (!["global-search-form", "reminder-settings", "reminder-email", "batch-due-form", "outbox-form"].includes(form.id)) return;
  e.preventDefault();
  const submit = form.querySelector("button[type=submit]");
  submit.disabled = true;
  try {
    const data = new FormData(form);
    if (form.id === "global-search-form") {
      const result = await helperJSON("/cases/search?q=" + encodeURIComponent(data.get("query")));
      if (!form.isConnected) return;
      document.getElementById("global-search-results").innerHTML =
        "<p>" +
        `${result.hits.length}` +
        " matching cases. " +
        `${result.unreadable}` +
        " unreadable files. " +
        `${result.partial ? "Results limited; refine your search." : ""}` +
        "</p><ul>" +
        "".concat(
          result.hits
            .map(
              (hit) =>
                "<li>" +
                `${esc(hit.number)}` +
                " · " +
                `${esc(hit.address)}` +
                " · " +
                `${esc(hit.owner)}` +
                " " +
                "".concat(
                  hit.duplicate
                    ? "Duplicate identity; administrator review needed"
                    : `<button class="btn" data-global-open="${esc(hit.number)}">Open current case</button>`,
                ) +
                "</li>",
            )
            .join(""),
        ) +
        "</ul>";
    } else if (form.id === "reminder-settings") {
      const prefs = WriterState.WORKFLOW_PREFS.reminders;
      prefs.enabled = data.get("enabled") === "on";
      prefs.days = Math.min(30, Math.max(1, Number(data.get("days")) || 7));
      prefs.plans = {};
      for (const [key, value] of data.entries()) if (key.startsWith("plan:") && validISO(value)) prefs.plans[key.slice(5)] = value;
      saveWorkflowPrefs();
      document.getElementById("utility-dialog")?.close();
      render();
    } else if (form.id === "reminder-email") {
      await helperJSON("/email/reminder", { to: data.get("to"), subject: data.get("subject"), body: data.get("body") });
      toast("Opened Outlook reminder draft", { severity: "success" });
    } else if (form.id === "batch-due-form") {
      const changes = [...form.querySelectorAll("[data-batch-item]:checked")].map((el) => ({
        docId: el.dataset.batchDoc,
        itemId: el.dataset.batchItem,
      }));
      const copies = planBulkDue(changes, data.get("due"));
      await persistWorkspacePatch(
        (staged) => {
          staged.docs = staged.docs.map((d) => copies.get(d.id) || d);
          return staged;
        },
        () => {
          WriterState.DOCS = WriterState.DOCS.map((d) => copies.get(d.id) || d);
        },
      );
      document.getElementById("utility-dialog")?.close();
      render();
      toast("Saved selected draft deadlines", { severity: "success" });
    } else {
      const result = await helperJSON("/outbox/batch-sync", { items: selectedOutbox() });
      await refreshArtifactLocations();
      await showOutbox();
      toast(result.result.moved + " PDF(s) filed; " + result.result.conflicts.length + " conflict(s) retained", {
        severity: result.result.conflicts.length ? "warning" : "success",
      });
    }
  } catch (error) {
    toast(error.message, { severity: "error" });
  } finally {
    if (submit.isConnected) submit.disabled = false;
  }
});
document.addEventListener("click", async (e) => {
  const t = e.target.closest?.(
    "[data-global-search],[data-shared-offer],[data-global-open],[data-reminders],[data-reminder-" +
      "draft],[data-reminder-dismiss],[data-timeline],[data-timeline-csv],[data" +
      "-timeline-json],[data-batch-due],[data-outbox],[data-outbox-print]",
  );
  if (!t) return;
  try {
    // The no-results offer opens the same shared search with the workspace query prefilled.
    if (t.hasAttribute("data-global-search") || t.hasAttribute("data-shared-offer")) await globalSearch();
    else if (t.dataset.globalOpen) {
      await writerOpenReportedCase({ number: t.dataset.globalOpen });
      document.getElementById("utility-dialog")?.close();
    } else if (t.hasAttribute("data-reminders")) showReminders();
    else if (t.dataset.reminderDraft) showReminderDraft(t.dataset.reminderDraft);
    else if (t.dataset.reminderDismiss) {
      WriterState.WORKFLOW_PREFS.reminders.dismissed.push(t.dataset.reminderDismiss);
      WriterState.WORKFLOW_PREFS.reminders.dismissed = WriterState.WORKFLOW_PREFS.reminders.dismissed.slice(-200);
      saveWorkflowPrefs();
      render();
    } else if (t.dataset.timeline) showTimeline(t.dataset.timeline, "all");
    else if (t.hasAttribute("data-timeline-csv"))
      downloadText(
        "case-timeline.csv",
        csvText([
          ["Event ID", "UTC time", "Category", "Type", "Recorded by"],
          ...timelineRows().map((e) => [e.id, e.at, timelineCategory(e.type), e.type, e.by || ""]),
        ]),
        "text/csv",
      );
    else if (t.hasAttribute("data-timeline-json"))
      downloadFile(
        "case-event-log.json",
        JSON.stringify(
          {
            format: "madison-event-log-export",
            version: 1,
            caseNumber: kase(WriterState.TIMELINE_CASE).number,
            events: eventsFor(WriterState.TIMELINE_CASE),
          },
          null,
          2,
        ),
      );
    else if (t.hasAttribute("data-batch-due")) showBulkDue();
    else if (t.hasAttribute("data-outbox")) await showOutbox();
    else if (t.hasAttribute("data-outbox-print")) await printOutbox();
  } catch (error) {
    toast(error.message, { severity: "error" });
  }
});
document.addEventListener("change", (e) => {
  if (e.target.id === "timeline-filter") showTimeline(WriterState.TIMELINE_CASE, e.target.value);
  if (["case-filter", "case-inspector"].includes(e.target.id)) queueMicrotask(saveWorkflowPrefs);
});
document.addEventListener("input", (e) => {
  if (e.target.id === "case-search") queueMicrotask(saveWorkflowPrefs);
});

/* Workspace task counts are built from the same records used by the task list.
   Artifact location is checked by the helper against approved outbox paths. */
WriterState.ARTIFACT_LOCATIONS = {};
WriterState.ARTIFACT_VERIFY = {};
WriterState.ARTIFACT_SEQ = 0;
WriterState.ARTIFACT_IDENTITY = {};

document.addEventListener("click", (e) => {
  const t = e.target.closest?.("[data-queue-view],[data-queue-reset]");
  if (!t) return;
  WriterState.state.metric = "";
  if (t.hasAttribute("data-queue-reset")) {
    WriterState.state.caseQ = "";
    WriterState.state.caseInspector = "";
  } else {
    // Switching views keeps the workspace search and inspector filter; only the reset clears them.
    WriterState.state.caseFilter = t.dataset.queueView;
  }
  render();
  saveWorkflowPrefs();
  document.querySelector(t.hasAttribute("data-queue-reset") ? "#case-search" : '[data-queue-view="' + t.dataset.queueView + '"]')?.focus();
});
document.addEventListener("click", (e) => {
  const t = e.target.closest?.("[data-case-task]");
  if (!t) return;
  const cid = t.dataset.caseTask,
    st = caseState(kase(cid));
  if (st.draft) {
    preflightCase(cid, "draft", () => {
      WriterState.state.docId = st.draft.id;
      WriterState.state.screen = "write";
      render();
    });
    return;
  }
  if (st.visit || (st.current && !st.closed)) {
    preflightCase(cid, "inspection", () => startReinspection(cid));
    return;
  }
  if (st.current)
    preflightCase(cid, "case", () => {
      WriterState.state.docId = st.current.id;
      WriterState.state.screen = "write";
      render();
    });
});

/* Reports sends only a case number. Writer resolves it through the validated
   shared-case route and preserves its single-tab Web Lock. */
export const HANDOFF_CHANNEL = "madison-writer-handoff-v1";
WriterState.WRITER_CHANNEL = null;
WriterState.REPORT_RETURN = false;
WriterState.HANDOFF_SEQ = 0;

WriterState.RETURN_ACK = "";

WriterState.WRITER_READY = false;
WriterState.STARTUP_STATUS = "starting";
// A browser without IndexedDB has no retained workspace to restore; its existing save warnings still apply.
WriterState.WORKSPACE_RESTORED = !IDB_OK;
WriterState.STARTUP_ERROR = "";
WriterState.releaseWriterReady = undefined;

export const WRITER_READY_WAIT = new Promise((resolve) => {
  WriterState.releaseWriterReady = resolve;
});

document.addEventListener("click", async (e) => {
  if (!e.target.closest?.("[data-report-return]")) return;
  await navigation.leave((sequence) => {
    const request = rnd12();
    WriterState.RETURN_ACK = "";
    if (WriterState.WRITER_CHANNEL) WriterState.WRITER_CHANNEL.postMessage({ kind: "return", request });
    setTimeout(() => {
      if (navigation.current(sequence) && WriterState.RETURN_ACK !== request) location.href = "madison-reports.html?return=1";
    }, 700);
  });
});

/* R4 authoring: explicit selections, manual deadlines, and reviewable deposits. */
export const libraryKey = (lib) => (lib ? JSON.stringify([lib.c, lib.g, lib.o]) : "");
export const itemLibraryKey = (it) => it.libraryKey || libraryKey(it.lib);

export const dueItems = (d) => (d.items || []).filter((i) => !i.done && !i.withdrawn && i.dueExempt !== "snow-10.28");
export const distinctDues = (items) => [...new Set(items.map((i) => i.due).filter(Boolean))];

export const validMoney = (v) => v !== "" && v !== null && v !== undefined && /^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/.test(String(v)) && Number.isFinite(+v);

document.addEventListener("input", (e) => {
  const el = e.target,
    ds = el.dataset || {};
  if (el.id === "bulk-due") {
    const { target } = activeDueTarget();
    if (target) {
      target.dueWork = target.dueWork || {};
      target.dueWork.date = el.value;
      WriterState.DIRTY = true;
      scheduleDraftSave();
    }
    return;
  }
  if (ds.reviewCit) {
    const d = doc(WriterState.state.docId);
    if (!d || isLocked(d)) return;
    const [id, f] = ds.reviewCit.split("|");
    editCitation(d, id, f, el.value, "input");
    WriterState.DIRTY = true;
    scheduleDraftSave();
    syncChip();
    initialCitations.refresh(d);
  }
});
document.addEventListener("change", (e) => {
  const ds = e.target.dataset || {};
  if (ds.reviewCit) {
    const d = doc(WriterState.state.docId);
    if (d && !isLocked(d)) {
      const [id, field] = ds.reviewCit.split("|");
      editCitation(d, id, field, e.target.value);
      WriterState.DIRTY = true;
      saveDrafts();
      refreshSheet();
      initialCitations.refresh(d);
      // R59: a charge that now needs its deposit basis keeps focus on that charge's completion form.
      if ((field === "ord" || field === "ordOther") && d.depositRequests?.[id]) depositStep.open(d, id);
    }
    return;
  }
  if (ds.dueSelect) {
    const { target, visit } = activeDueTarget();
    if (!target || (!visit && isLocked(target))) return;
    target.dueWork = target.dueWork || {};
    const selected = new Set(target.dueWork.selected || []);
    if (e.target.checked) selected.add(ds.dueSelect);
    else selected.delete(ds.dueSelect);
    target.dueWork.selected = [...selected];
    // Notice rows select in the items table; keep the compact bar's count current without a repaint.
    const count = document.querySelector("[data-due-selected]");
    if (count) count.textContent = dueSelectedText(dueContext(target, visit), selected);
    WriterState.DIRTY = true;
    saveDrafts();
  }
});
document.addEventListener("click", (e) => {
  const el = e.target.closest("[data-due-all],#btn-bulkdue");
  if (!el) return;
  const { target, visit } = activeDueTarget();
  if (!target || (!visit && isLocked(target)) || (visit && (!target.draft || target.docId))) return;
  target.dueWork = target.dueWork || {};
  if (el.dataset.dueAll !== undefined) {
    target.dueWork.selected = el.dataset.dueAll === "1" ? dueContext(target, visit).map((i) => i.id) : [];
  } else {
    const before = Object.fromEntries(dueContext(target, visit).map((i) => [i.id, i.due || ""]));
    // An item that has since been corrected, withdrawn or carried has no checkbox any more; drop it from the
    // selection rather than refusing a choice the inspector can no longer see.
    target.dueWork.selected = (target.dueWork.selected || []).filter((id) => Object.hasOwn(before, id));
    const fault = assignDue(target, visit, target.dueWork.date, target.dueWork.selected);
    if (fault) {
      toast(fault);
      return;
    }
    const applied = Object.fromEntries(dueContext(target, visit).map((i) => [i.id, i.due || ""]));
    toastUndo("Due date applied to selected items.", () => {
      const active = activeDueTarget();
      const current = dueContext(target, visit);
      if (
        active.target !== target ||
        active.visit !== visit ||
        (visit ? !target.draft || target.docId : isLocked(target)) ||
        current.length !== Object.keys(before).length ||
        current.some((i) => !Object.hasOwn(before, i.id) || i.due !== applied[i.id])
      ) {
        toast("This draft changed. Reopen its dates to make a new adjustment.");
        return;
      }
      for (const [id, due] of Object.entries(before)) {
        if (visit) target.results[id].due = due;
        else target.items.find((x) => x.id === id).due = due;
      }
      WriterState.DIRTY = true;
      saveDrafts();
      render();
    });
  }
  WriterState.DIRTY = true;
  saveDrafts();
  render();
});

/* Imported inspection identity excludes mutable status, owner and inspector names.
   The fixed source query has no inspection ID: date/type/time are the available key.
   Missing historical time conservatively matches any time on that date. */

/* R5 direct lookup uses the existing report importer and publication gates. */
WriterState.LOOKUP_BUSY = false;
WriterState.LOOKUP_ERROR = "";
WriterState.LOOKUP_CONTROLLER = null;
WriterState.LOOKUP_SERIAL = 0;
// R59: bumps on every inspection-candidate change so a check started for an earlier selection is ignored.
WriterState.ACC_SELECTION_SERIAL = 0;

document.addEventListener("submit", (e) => {
  if (e.target.id === "lookup-form") {
    e.preventDefault();
    findDatabaseCase();
  }
});
document.addEventListener(
  "click",
  (e) => {
    const button = e.target.closest("button");
    if (!button) return;
    if (button.dataset.importWorkspace) {
      openImportWorkspace(button.dataset.importWorkspace);
      return;
    }
    if (button.id === "lookup-cancel") {
      cancelCaseLookup();
      WriterState.LOOKUP_ERROR = "Lookup canceled. Your existing work has been kept.";
      render();
      return;
    }
    if (button.id === "lookup-recheck") {
      confirmDatabaseCase();
      return;
    }
    if (button.matches("[data-nav],#acc-pick,#acc-cancel,#btn-savework")) cancelCaseLookup();
    if (button.id === "acc-go") {
      e.preventDefault();
      e.stopImmediatePropagation();
      confirmDatabaseCase();
    }
  },
  true,
);

document.addEventListener(
  "drop",
  (e) => {
    if (e.target.closest?.("#acc-drop")) cancelCaseLookup();
  },
  true,
);

/* R13 check destinations are data, shared by the review links and field highlights. */
export const checkTarget = (selector, label, action = "") => ({ selector, label, action });
export const checkAttr = (value) => String(value).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
export const itemSelector = (id, field) => '[data-id="' + checkAttr(id) + '"][data-field="' + field + '"]';
export const citSelector = (id, field) => '[data-review-cit="' + checkAttr(id) + "|" + field + '"]';

document.addEventListener("click", (e) => {
  const b = e.target.closest("[data-check-index]");
  if (!b) return;
  const list = b.dataset.checkWorksheet ? worksheetChecks(reinsp(WriterState.state.reinspId)) : checks(doc(WriterState.state.docId));
  const c = list[+b.dataset.checkIndex],
    target = c?.targets?.[+b.dataset.checkTarget];
  if (target) {
    e.preventDefault();
    focusCheckTarget(target, c.t);
  }
});
// Run after editing handlers, without replacing the active input or losing its caret.
document.addEventListener("input", () => queueMicrotask(highlightOpenChecks));
document.addEventListener("change", () => queueMicrotask(highlightOpenChecks));

/* ---------- reinspection worksheet ----------
   The inspector is not writing from a blank page. They are standing at the
   property with the notice they already issued, walking its numbered list.
   The notice itself is closed to edits from here on — the owner has it. */

/* A due date is the inspector's judgement, so the check flags rather than
   blocks: it must be in the future, and unusually tight or long windows
   are worth a second look. */

/* ---------- writer: the document is the editor ---------- */

/* the whole printable document: the notice, then one page per citation copy */

/* ---------- Wisconsin Uniform Municipal Court Citation (MC-2000) ----------
   The four copies differ: agency and inspector carry a disposition record,
   the defendant's carries the plea instructions instead of the narrative.
   Facsimile of the form on file — confirm against the court's own stock
   before this is used to produce a filed citation. */

export const BOXY = "&#9744;",
  BOXN = "&#9746;"; // empty box / checked box

/* One citation is filed per ordinance, and each of the four copies is its own
   letter page, laid out to the MC-2000 (02/06) form. */

export const globalCourt = () => COURT,
  globalCourtCopies = () => CIT_COPIES,
  globalCourtInstructions = () => CIT_INSTRUCTIONS,
  globalCourtContact = () => COURT_CONTACT;

/* ---------- picker ---------- */

/* ---------- render ---------- */
// only one overlay at a time — the modal supersedes the picker

/* Reordering is a pointer gesture so it works the same with a mouse or a
   thumb. Rows move live; the item array is rewritten and renumbered on drop. */
WriterState.dragging = null;

document.addEventListener("pointerdown", (e) => {
  const g = e.target.closest && e.target.closest("[data-grip]");
  if (!g) return;
  const tr = g.closest("tr");
  if (!tr) return;
  e.preventDefault();
  WriterState.dragging = { tr: tr, body: tr.parentNode };
  tr.classList.add("dragging");
  try {
    g.setPointerCapture(e.pointerId);
  } catch (err) {
    /* Pointer capture is optional; ordinary pointer movement still supports this interaction. */
  }
});
document.addEventListener("pointermove", (e) => {
  if (!WriterState.dragging) return;
  const rows = Array.prototype.slice.call(WriterState.dragging.body.querySelectorAll("tr[data-row]"));
  for (let n = 0; n < rows.length; n++) {
    const r = rows[n];
    if (r === WriterState.dragging.tr) continue;
    const b = r.getBoundingClientRect();
    if (e.clientY >= b.top && e.clientY <= b.bottom) {
      WriterState.dragging.body.insertBefore(WriterState.dragging.tr, e.clientY < b.top + b.height / 2 ? r : r.nextSibling);
      break;
    }
  }
});
document.addEventListener("pointerup", () => {
  if (!WriterState.dragging) return;
  const body = WriterState.dragging.body;
  WriterState.dragging.tr.classList.remove("dragging");
  WriterState.dragging = null;
  const d = doc(WriterState.state.docId);
  if (!d || !structEditable(d)) return;
  const order = Array.prototype.slice.call(body.querySelectorAll("tr[data-row]")).map((r) => r.getAttribute("data-row"));
  d.items.sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
  renumber(d);
  WriterState.DIRTY = true;
  refreshSheet();
});
document.addEventListener("pointercancel", () => {
  if (WriterState.dragging) {
    WriterState.dragging.tr.classList.remove("dragging");
    WriterState.dragging = null;
    refreshSheet();
  }
});

document.addEventListener("keydown", (e) => {
  const grip = e.target.closest?.("[data-grip]");
  if (!grip || !["ArrowUp", "ArrowDown"].includes(e.key) || e.altKey || e.ctrlKey || e.metaKey) return;
  e.preventDefault();
  moveItem(grip.dataset.grip, e.key === "ArrowUp" ? "up" : "down", true);
});
// structural changes only — never while someone is typing

/* A follow-up is a derivative of the notice, not a fresh document. Only the
   items that failed reinspection come across, and they keep the number the
   owner already has — item 3 stays item 3 through extension and citation. */

/* ---------- pagination ----------
   The notice is written as one flowing document and then cut into letter
   pages here, so what is on screen is what comes out of the printer. Each
   page carries the table header and the division footer; only the first
   carries the letterhead and the envelope window. */
export const PAGE_PX = 11 * 96;

document.addEventListener("keydown", (e) => {
  const box = document.querySelector('[role="dialog"]');
  if (e.key === "Tab" && box) {
    const nodes = Array.from(
      box.querySelectorAll(
        "button:not([disabled]),input:not([disabled]),select:not([disabled]),text" + 'area:not([disabled]),a[href],[tabindex="0"]',
      ),
    ).filter((el) => !el.hidden && el.style.display !== "none");
    const first = nodes[0],
      last = nodes[nodes.length - 1];
    if (!first) {
      e.preventDefault();
      box.focus();
    } else if (e.shiftKey && (document.activeElement === first || document.activeElement === box)) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
    e.preventDefault();
    saveDrafts().then((ok) => toast(ok ? "Saved on this device" : "Could not save — keep this tab open"));
  }
});
document.addEventListener("click", (e) => newDocuments.clickEvent(e));
document.addEventListener("input", (e) => {
  if (e.target.matches("[data-special],[data-special-due],[data-service-field]")) newDocuments.editEvent(e);
});
document.addEventListener("change", (e) => {
  if (
    e.target.matches(
      "[data-case-action-group],[data-case-action-type],[data-service-field],[d" +
        "ata-action-group],[data-action-type],[data-special],[data-special-item]," +
        "[data-special-due],[data-administrative-type],[dat" +
        'a-special="administrativeType"]',
    )
  )
    newDocuments.editEvent(e);
});
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden" && IDB_OK) saveDrafts();
});
/* ---------- events ---------- */
WriterState.groupOld = null;

document.addEventListener("focusin", (e) => {
  if (e.target.dataset && e.target.dataset.field === "group") WriterState.groupOld = e.target.innerText.trim();
});
// paste into the document as plain text so the notice keeps its own formatting
/* The field is small by design, so the whole of it opens the picker rather
   than the few pixels of the calendar icon. */
document.addEventListener("click", (e) => {
  const el = e.target.closest && e.target.closest(".hdr-in");
  if (!el || el.disabled) return;
  if (typeof el.showPicker === "function") {
    try {
      el.showPicker();
    } catch (err) {
      /* The browser can refuse its optional picker; typed dates remain available. */
    }
  }
});

document.addEventListener("paste", (e) => {
  const el = e.target.closest && e.target.closest("[contenteditable]");
  if (!el) return;
  e.preventDefault();
  document.execCommand("insertText", false, (e.clipboardData || window.clipboardData).getData("text/plain"));
});

document.addEventListener("click", (e) => {
  const button = e.target.closest("[data-editor-review],[data-editor-command],[data-open-checklist],[data-mobile-review],[data-mobile-primary]");
  if (!button) return;
  e.preventDefault();
  captureWork();
  if (button.hasAttribute("data-mobile-primary")) {
    // The narrow-screen bar repeats the toolbar's primary action; the toolbar button keeps its own handler and checks.
    const primary = document.querySelector(".topbar .editor-primary");
    if (primary && !primary.disabled) primary.click();
    return;
  }
  if (button.matches("[data-editor-review],[data-open-checklist],[data-mobile-review]")) {
    // R59: one Review dialog; it lists the current checks() each time it opens and returns focus on close.
    if (!doc(WriterState.state.docId)) return;
    WriterState.state.picker = false;
    WriterState.state.modal = "review";
    render();
    return;
  }
  const target = document.getElementById(button.dataset.editorCommand);
  if (target && !target.disabled) {
    button.disabled = true;
    target.click();
  }
});

document.addEventListener("click", async (e) => {
  const t = e.target.closest(
    "[data-nav],[data-open],[data-new],[data-pick],[data-grp],[data-libcl],[d" +
      "ata-del],[data-abate],[data-grpbtn],[data-move],[data-adopt-catalog],[da" +
      "ta-close],[data-reinsp],[data-rifilter],[data-riwalk],[data-riwalk-undo]" +
      ",[data-riwalk-next],[data-riwalk-skip],[data-riwalk-return],[data-riwalk" +
      "-prev],[data-setoc],[data-makedoc],[data-case-sync],#btn-add-to" +
      "p,#btn-bulkdue,[data-openfile],[data-exportcase],#case-showall,#t-undo,#" +
      "btn-void,#btn-correct,#btn-retrycorrection,#btn-reviewcorrection,#btn-ex" +
      "portcorrection,#btn-recordnote,#btn-reconcile,#btn-original,#record-acti" +
      "on-go,[data-resumerecord],[data-withdraw],#btn-reissue,#btn-recordri,#bt" +
      "n-linkdir,#btn-grantdir,#btn-browse,#btn-flush,#btn-storage,#btn-syncpdf" +
      ",#btn-testwrite,#btn-reindex,#btn-savecase,#btn-clear,#btn-email,#btn-cc" +
      ",#btn-addcc,#btn-addem,#btn-sendgo,#btn-sendnone,#btn-risave,[data-notec" +
      "ite],[data-clearcases],[data-rmcase],[data-rmcc],[data-rmem],[data-disca" +
      "rdri],[data-discard],[data-openfolder],#btn-print,#btn-final" +
      ",#btn-save,#btn-openfile,#fin-go,#picker-bg,#acc-pick,#acc-go,#acc-cance" +
      "l,[data-acccase],[data-accsel]",
  );
  if (!t) return;
  captureWork();
  if (t.id === "case-showall") {
    WriterState.state.metric = "";
    WriterState.state.caseFilter = "all";
    WriterState.state.caseQ = "";
    WriterState.state.caseInspector = "";
    render();
    saveWorkflowPrefs();
    return;
  }
  if (t.dataset.nav) {
    await navigation.navigate(t.dataset.nav);
    return;
  }

  if (t.id === "t-undo") {
    const f = WriterState.undoFn;
    WriterState.undoFn = null;
    document.getElementById("toast").innerHTML = "";
    if (f) f();
    return;
  }
  if (t.dataset.exportcase) {
    if (!caseNumberAllowed(kase(t.dataset.exportcase))) {
      toast("Case number needs correction before export");
      return;
    }
    downloadFile(caseFileName(kase(t.dataset.exportcase)), JSON.stringify(caseFile(t.dataset.exportcase), null, 2));
    toast("Case record downloaded. Unfinished drafts stay on this device.");
    return;
  }
  if (t.id === "btn-openfile" || t.hasAttribute("data-openfile")) {
    if (storageMode() === "folder") {
      listCaseFolder().then((fs) => {
        WriterState.state.folder = fs;
        WriterState.state.modal = "folder";
        render();
      });
      return;
    }
    pickCaseFile();
    return;
  }
  if (t.id === "btn-linkdir") {
    linkCaseFolder();
    return;
  }
  if (t.id === "btn-grantdir") {
    grantCaseFolder();
    return;
  }
  if (t.id === "btn-browse") {
    listCaseFolder().then((fs) => {
      WriterState.state.folder = fs;
      WriterState.state.modal = "folder";
      render();
    });
    return;
  }
  if (t.dataset.openfolder) {
    WriterState.state.modal = null;
    openFromFolder(t.dataset.openfolder);
    return;
  }
  if (t.dataset.discardri) {
    if (!confirm("Discard this reinspection? Nothing has been recorded on the case yet.")) return;
    if (discardWorksheet(t.dataset.discardri)) toast("Reinspection discarded");
    return;
  }
  if (t.dataset.discard) {
    const dd = doc(t.dataset.discard);
    if (dd && !confirm("Discard this draft? It has not been issued, so nothing on the shared record changes.")) return;
    discardDraft(t.dataset.discard).then((ok) => {
      if (ok !== false) toast("Draft discarded");
    });
    return;
  }
  if (t.id === "btn-flush") {
    if (WriterState.CASEDIR && WriterState.NEEDGRANT) {
      grantCaseFolder(true)
        .then(() => flushPending())
        .then(() => render());
      return;
    }
    flushPending().then(() => render());
    return;
  }
  if (t.dataset.caseSync) {
    if (!WriterState.CASEDIR) {
      WriterState.state.modal = "storage";
      render();
      return;
    }
    if (WriterState.NEEDGRANT) {
      grantCaseFolder(true).then((ok) => (ok ? flushPending() : render()));
      return;
    }
    flushPending().then(() => render());
    return;
  }
  if (t.id === "btn-storage") {
    document.getElementById("utility-dialog")?.close();
    WriterState.state.modal = "storage";
    render();
    return;
  }
  if (t.id === "btn-clear") {
    WriterState.state.modal = "clear";
    render();
    return;
  }
  if (t.id === "btn-cc") {
    WriterState.state.ccProblem = null;
    WriterState.state.modal = "cc";
    render();
    return;
  }
  if (t.id === "btn-addcc") {
    WriterState.state.ccProblem = null;
    addCC(doc(WriterState.state.docId).caseId);
    return;
  }
  if (t.id === "btn-addem") {
    WriterState.state.ccProblem = null;
    addEmail(doc(WriterState.state.docId).caseId);
    return;
  }
  if (t.dataset.rmcc !== undefined && t.hasAttribute("data-rmcc")) {
    WriterState.state.ccProblem = null;
    removeCC(doc(WriterState.state.docId).caseId, +t.dataset.rmcc);
    return;
  }
  if (t.dataset.rmem !== undefined && t.hasAttribute("data-rmem")) {
    WriterState.state.ccProblem = null;
    removeEmail(doc(WriterState.state.docId).caseId, +t.dataset.rmem);
    return;
  }
  if (t.dataset.clearcases) {
    clearCases(t.dataset.clearcases);
    return;
  }
  if (t.dataset.rmcase) {
    const k = kase(t.dataset.rmcase),
      risky = caseUnsaved(k);
    if (
      risky &&
      !confirm(
        k.number +
          " has " +
          risky +
          ". Removing it from this workspace loses that work. The shared case record is not deleted. Remove it from this workspace anyway?",
      )
    )
      return;
    if (removeCase(k.id) === false) return;
    WriterState.state.screen = "cases";
    render();
    toast(k.number + " removed from this workspace. The shared case record is not deleted.");
    return;
  }
  if (t.id === "btn-email") {
    const dd = doc(WriterState.state.docId);
    if (dd) emailDocument(dd);
    return;
  }
  if (t.id === "btn-sendgo" || t.id === "btn-sendnone") {
    const dd = doc(WriterState.state.sendDoc) || doc(WriterState.state.docId);
    const k = dd ? kase(dd.caseId) : null;
    const list = k ? emailList(k).filter((e) => String(e.addr || "").trim()) : [];
    const picked =
      t.id === "btn-sendnone"
        ? []
        : list.filter((_, ix) => {
            const box = document.querySelector('[data-sendto="' + ix + '"]');
            return box && box.checked;
          });
    const job = WriterState.state.sendJob,
      reuse = WriterState.state.sendReuse;
    WriterState.state.modal = null;
    WriterState.state.sendDoc = null;
    WriterState.state.sendJob = null;
    WriterState.state.sendReuse = undefined;
    render();
    if (dd) emailDocument(dd, picked.length ? picked : [{ addr: "", kind: "" }], reuse, job);
    return;
  }
  if (t.id === "btn-savecase") {
    const dd = doc(WriterState.state.docId);
    if (!dd) return;
    if (WriterState.CASEDIR && WriterState.NEEDGRANT) {
      grantCaseFolder(true).then(() => saveCaseFile(dd.caseId));
      return;
    }
    saveCaseFile(dd.caseId);
    return;
  }
  if (t.id === "btn-testwrite") {
    testWrite();
    return;
  }
  if (t.id === "btn-reindex") {
    rebuildIndex();
    return;
  }
  if (t.id === "btn-syncpdf") {
    t.disabled = true;
    helperJSON("/outbox/sync", {})
      .then(async (result) => {
        await checkHelper();
        await refreshArtifactLocations();
        render();
        toast(result.moved + " PDF(s) moved to the share");
      })
      .catch((error) => {
        toast(error.message);
        t.disabled = false;
      });
    return;
  }
  if (t.id === "btn-risave") {
    saveAndContinue();
    return;
  }
  if (t.id === "btn-recordri") {
    const r = reinsp(WriterState.state.reinspId);
    if (r) {
      recordReinspection(r);
      clearWalk();
      WriterState.WORK.walk = null;
      WriterState.state.screen = "cases";
      WriterState.state.reinspId = null;
      saveCaseFile(r.caseId);
      render();
    }
    return;
  }

  /* reinspection worksheet */
  if (t.dataset.reinsp) {
    const cid = t.dataset.reinsp;
    preflightCase(cid, "reinspection", () => startReinspection(cid));
    return;
  }
  if (t.dataset.riwalk !== undefined) {
    const r = reinsp(WriterState.state.reinspId);
    if (!r || !r.draft || r.docId) return;
    // The two review modes are a pressed-button pair; choosing the current mode changes nothing.
    if ((t.dataset.riwalk === "on") === !!WriterState.state.riWalk) return;
    if (t.dataset.riwalk === "on") {
      clearWalk();
      WriterState.state.riWalk = true;
      WriterState.state.riWalkContext = walkIdentity(r);
      WriterState.state.riFilter = "";
      const next = nextWalkItem(r);
      WriterState.state.riWalkItem = (next && next.id) || null;
      WriterState.state.riWalkUndo = null;
      WriterState.state.riWalkStage = "outcome";
      scheduleDraftSave();
      render();
      focusWalkItem();
    } else {
      clearWalk();
      WriterState.WORK.walk = null;
      scheduleDraftSave();
      render();
    }
    return;
  }
  if (t.hasAttribute("data-riwalk-next")) {
    const r = reinsp(WriterState.state.reinspId);
    if (r) advanceWalk(r);
    return;
  }
  if (t.hasAttribute("data-riwalk-skip")) {
    const r = reinsp(WriterState.state.reinspId);
    if (r) skipWalkDetails(r);
    return;
  }
  if (t.hasAttribute("data-riwalk-return")) {
    const r = reinsp(WriterState.state.reinspId);
    if (r) returnWalkDetails(r);
    return;
  }
  if (t.hasAttribute("data-riwalk-prev")) {
    const r = reinsp(WriterState.state.reinspId);
    if (r) previousWalk(r);
    return;
  }
  if (t.hasAttribute("data-riwalk-undo")) {
    undoWalkOutcome();
    return;
  }
  if (t.dataset.rifilter !== undefined && t.hasAttribute("data-rifilter")) {
    if (WriterState.state.riWalk) return;
    WriterState.state.riFilter = WriterState.state.riFilter === t.dataset.rifilter ? "" : t.dataset.rifilter;
    renderKeep();
    return;
  }
  if (t.dataset.setoc !== undefined && t.dataset.item) {
    recordReinspectionOutcome(t.dataset.item, t.dataset.setoc);
    return;
  }
  if (t.dataset.makedoc) {
    const r = reinsp(WriterState.state.reinspId);
    if (r) docFromReinspection(r, t.dataset.makedoc);
    return;
  }
  if (t.id === "picker-bg" && e.target.id === "picker-bg") {
    WriterState.state.picker = false;
    render();
    return;
  }
  if (t.dataset.close === "picker") {
    WriterState.state.picker = false;
    render();
    window.scrollTo(0, 0);
    return;
  }
  if (t.dataset.close === "modal") {
    if (WriterState.state.modal === "cc") {
      const d = doc(WriterState.state.docId),
        k = d && docCase(d),
        problem = k && validateAndStandardizeAddresses(k, d.type === "citation" && isLLC(k));
      if (problem) {
        WriterState.state.ccProblem = problem;
        refreshOverlay();
        const field = document.querySelector(problem.selector);
        if (field) field.focus();
        return;
      }
      WriterState.state.ccProblem = null;
      WriterState.DIRTY = true;
      scheduleDraftSave();
    }
    WriterState.state.modal = null;
    render();
    return;
  }
  if (t.dataset.libcl) {
    WriterState.state.libCl = +t.dataset.libcl;
    render();
    return;
  }
  if (t.dataset.open) {
    const id = t.dataset.open,
      d = doc(id);
    if (!d) return;
    preflightCase(d.caseId, "document", () => {
      WriterState.state.docId = id;
      WriterState.state.screen = "write";
      render();
      window.scrollTo(0, 0);
    });
    return;
  }
  if (t.dataset.new) {
    const dd = draftDocFor(t.dataset.new);
    if (dd) {
      preflightCase(dd.caseId, "document draft", () => {
        WriterState.state.docId = dd.id;
        WriterState.state.screen = "write";
        render();
      });
      return;
    }
    if (docsFor(t.dataset.new).length) {
      toast("This case already has an official notice");
      return;
    }
    const cid = t.dataset.new;
    preflightCase(cid, "new notice", () => newDoc(cid, "notice"));
    return;
  }
  if (t.dataset.grp) {
    const [ci, gi] = t.dataset.grp.split(":").map(Number);
    WriterState.state.cl = ci;
    WriterState.state.grp = gi;
    WriterState.state.q = "";
    refreshOverlay();
    return;
  }

  const d = doc(WriterState.state.docId);
  if (t.dataset.adoptCatalog) {
    const it = d?.items.find((x) => x.id === t.dataset.adoptCatalog);
    if (adoptCatalogReview(d, it)) toast("Reviewed catalog version applied to this draft item.");
    return;
  }
  if (t.dataset.resumerecord) {
    const holder = WriterState.RECORD_ATTEMPTS[t.dataset.resumerecord];
    if (holder) commitAmendment(holder.cid, holder.pendingAmendment, holder);
    return;
  }

  if (t.dataset.pick) {
    if (!d || !structEditable(d)) return;
    const selectionContext = { docId: WriterState.state.docId, screen: WriterState.state.screen };
    await refreshCatalog();
    if (
      !WriterState.state.picker ||
      WriterState.state.screen !== selectionContext.screen ||
      WriterState.state.docId !== selectionContext.docId ||
      doc(WriterState.state.docId) !== d ||
      !structEditable(d)
    )
      return;
    const [ci, gi, o] = t.dataset.pick.split(":").map(Number);
    const raw = LIBRARY[ci]?.groups[gi]?.items.find((x) => x.o === o);
    if (!raw) return;
    const indexed = { ...raw, ci, gi },
      status = catalogStatus(indexed);
    if (
      ["review", "incomplete", "retired", "superseded", "unknown"].includes(status.code) &&
      !d.items.some((it) => itemLibraryKey(it) === catalogKey(indexed))
    ) {
      toast(status.label + "; division review is needed.");
      return;
    }
    const src = catalogSelection(indexed);
    if (
      !d.items.some((i) => itemLibraryKey(i) === JSON.stringify([LIBRARY[ci].code, LIBRARY[ci].groups[gi].code, src.o])) &&
      !snow.canAdd(d, JSON.stringify([LIBRARY[ci].code, LIBRARY[ci].groups[gi].code, src.o]))
    )
      return;
    const added = toggleLibraryItem(d, ci, gi, src);
    renumber(d);
    WriterState.DIRTY = true;
    saveDrafts();
    if (WriterState.state.keepAdding || !added) {
      refreshOverlay();
      toast((added ? "Added: " : "Removed: ") + src.t);
      return;
    }
    WriterState.state.picker = false;
    render();
    // drop the cursor straight into the new corrective action
    const cells = document.querySelectorAll('[data-field="text"]');
    const last = cells[cells.length - 1];
    if (last) {
      last.focus();
      const r = document.createRange();
      r.selectNodeContents(last);
      r.collapse(true);
      const s = getSelection();
      s.removeAllRanges();
      s.addRange(r);
      last.scrollIntoView({ block: "center" });
    }
    toast("Added: " + src.t);
    return;
  }
  if (t.id === "btn-add-top") {
    if (!structEditable(d)) return;
    if (WriterState.state.pickerDoc !== d.id) {
      WriterState.state.pickerStatus = "approved";
      WriterState.state.cl = -1;
      WriterState.state.grp = 0;
      WriterState.state.pickerDoc = d.id;
    }
    WriterState.state.picker = true;
    WriterState.state.q = "";
    render();
    return;
  }
  if (t.dataset.del) {
    if (!structEditable(d)) {
      toast("This notice has been issued — its items are fixed");
      return;
    }
    const ix = d.items.findIndex((i) => i.id === t.dataset.del);
    if (ix < 0) return;
    const gone = d.items.splice(ix, 1)[0];
    if (itemLibraryKey(gone)) {
      d.selectionCache = d.selectionCache || {};
      d.selectionCache[itemLibraryKey(gone)] = clone(gone);
    }
    renumber(d);
    WriterState.DIRTY = true;
    refreshSheet();
    toastUndo("Removed item — " + (gone.title || "untitled"), () => {
      if (!itemLibraryKey(gone) || !d.items.some((i) => itemLibraryKey(i) === itemLibraryKey(gone))) {
        d.items.splice(ix, 0, gone);
        renumber(d);
        WriterState.DIRTY = true;
        saveDrafts();
        refreshSheet();
      }
    });
    return;
  }
  if (t.dataset.move) {
    moveItem(t.dataset.move, t.dataset.direction);
    return;
  }
  if (t.dataset.grpbtn) {
    if (!structEditable(d)) return;
    const it = d.items.find((i) => i.id === t.dataset.grpbtn);
    if (!it) return;
    it.group = it.group ? "" : "GENERAL EXTERIOR";
    refreshSheet();
    if (it.group) {
      const h = document.querySelector('[data-field="group"][data-id="' + it.id + '"]');
      if (h) {
        h.focus();
        const r = document.createRange();
        r.selectNodeContents(h);
        const s = getSelection();
        s.removeAllRanges();
        s.addRange(r);
      }
    }
    return;
  }
  if (t.dataset.notecite) {
    if (!structEditable(d)) return;
    const it = d.items.find((i) => i.id === t.dataset.notecite);
    // A mark that is no longer permitted can still be removed; a new one needs a Citation import.
    if (it && (it.cite || citeAllowed(d))) {
      it.cite = !it.cite;
      if (!it.cite) {
        delete d.depositRequests?.[it.id];
        delete d.cits?.[it.id];
      }
      initialCitations.prepare(d);
      WriterState.DIRTY = true;
      render();
      if (it.cite) depositStep.openNext(d);
    }
    return;
  }
  if (t.dataset.abate) {
    if (isLocked(d) || d.type !== "notice") return;
    const it = d.items.find((i) => i.id === t.dataset.abate);
    if (!it || it.done) return;
    it.abate = !it.abate;
    t.dataset.on = it.abate ? 1 : 0;
    t.textContent = it.abate ? "Y" : "N";
    WriterState.DIRTY = true;
    scheduleDraftSave();
    return;
  }
  if (t.id === "btn-correct" || t.id === "btn-reissue") {
    const id = d.id;
    preflightCase(d.caseId, "correction", () => startCorrection(id));
    return;
  }
  if (t.id === "btn-exportcorrection") {
    if (d && d.correction)
      downloadFile(
        kase(d.caseId).number + " - correction draft - " + d.id + ".json",
        JSON.stringify(
          {
            format: "madison-correction-draft-review",
            exported: nowISO(),
            caseNumber: kase(d.caseId).number,
            source: correctionSource(d),
            draft: clone(d),
            changes: correctionChanges(d),
          },
          null,
          2,
        ),
      );
    return;
  }
  if (t.id === "btn-retrycorrection") {
    issueCorrection(d);
    return;
  }
  if (
    t.id === "btn-recordnote" &&
    WriterState.state.publicationBusy &&
    doc(WriterState.state.publicationBusy)?.caseId === doc(WriterState.state.docId)?.caseId
  ) {
    toast("Finishing document save…");
    return;
  }
  if (t.id === "btn-void" || t.id === "btn-recordnote" || t.id === "btn-reconcile") {
    WriterState.state.amendmentError = "";
    WriterState.state.modal = t.id === "btn-void" ? "void" : t.id === "btn-recordnote" ? "recordnote" : "reconcile";
    render();
    return;
  }
  if (t.id === "record-action-go") {
    const value = (document.getElementById("record-action-text") || {}).value || "",
      external = (document.getElementById("record-action-external") || {}).value || "";
    const mode = WriterState.state.modal,
      actor = (document.getElementById("record-action-inspector") || {}).value || "";
    t.disabled = true;
    const action =
      mode === "void"
        ? voidDocument(d.id, value, external, actor)
        : mode === "reconcile"
          ? reconcileDocument(d.id, value, actor)
          : addRecordNote(d.id, value, actor);
    Promise.resolve(action).finally(() => {
      const field = document.getElementById("record-action-text");
      if (field) field.value = value;
      const button = document.getElementById("record-action-go");
      if (button) button.disabled = false;
      const ref = document.getElementById("record-action-external");
      if (ref) ref.value = external;
    });
    return;
  }
  if (t.id === "btn-original") {
    openIssuedCopy(d);
    return;
  }
  if (t.dataset.withdraw) {
    if (!d.correction || isLocked(d)) return;
    const it = d.items.find((x) => x.id === t.dataset.withdraw);
    if (!it) return;
    if (it.withdrawn) {
      const base = correctionSource(d).items.find((x) => x.id === it.id);
      if (base.withdrawn) {
        toast("This item was withdrawn in a prior revision. A newly observed violation needs a new case or notice.");
        return;
      }
      delete it.withdrawn;
      delete it.withdrawalReason;
    } else {
      const reason = prompt("Why was item " + it.no + " entered in error? This is not a finding of compliance.");
      if (reason === null) return;
      if (reason.trim().length < 10) {
        toast("Provide a specific withdrawal reason of at least 10 characters.");
        return;
      }
      it.withdrawn = true;
      it.withdrawalReason = reason.trim();
    }
    d.correction.reviewed = false;
    WriterState.DIRTY = true;
    saveDrafts();
    render();
    return;
  }
  if (t.id === "btn-save") {
    saveAndContinue();
    return;
  }
  if (t.id === "btn-print") {
    if (d.pendingAmendment) {
      toast("Confirm the pending save before distributing this document.");
      return;
    }
    if (!d.draft) openIssuedCopy(d);
    else printNotice(printJob(d));
    return;
  }
  if (t.id === "btn-final" || t.id === "btn-reviewcorrection") {
    if (isLocked(d)) {
      toast("This document has already been issued");
      return;
    }
    if (WriterState.CASEDIR && WriterState.NEEDGRANT) grantCaseFolder(true); // reconnect while the click still counts
    WriterState.state.picker = false;
    WriterState.state.modal = "final";
    render();
    refreshCatalog();
    return;
  }
  if (t.id === "fin-go") {
    // a document with an open check never gets issued, whatever the click path
    if (!d || !d.draft || t.disabled || WriterState.AMENDMENT_BUSY || WriterState.state.publicationBusy) return;
    const mailedEl = document.getElementById("fin-mailed");
    if (mailedEl) initialCitations.mailed(d, mailedEl.value);
    if (d.correction) {
      d.correction.reviewed = !!(document.getElementById("correction-reviewed") || {}).checked;
      if (!d.correction.reviewed) {
        toast("Review and confirm the listed changes.");
        return;
      }
    }
    if (blockers(d).length) {
      toast("Clear the outstanding checks before finalizing");
      return;
    }
    if (d.correction) {
      const list = emailList(docCase(d)).filter((e) => String(e.addr || "").trim());
      const picked = list.filter((_, ix) => {
        const b = document.querySelector('[data-finsend="' + ix + '"]');
        return b && b.checked;
      });
      d.emailedTo = picked.map((e) => ({ addr: e.addr, kind: e.kind || "Other" }));
      issueCorrection(d);
      return;
    }
    // ask for folder permission here, on the click itself, while the browser
    // still counts it as one; asking later gets refused without explanation
    // record who it goes to before it is frozen, so the filed copy, the
    // attachment and the record all say the same thing
    const list = emailList(kase(d.caseId)).filter((e) => String(e.addr || "").trim());
    const picked = list.filter((_, ix) => {
      const b = document.querySelector('[data-finsend="' + ix + '"]');
      return b && b.checked;
    });
    WriterState.state.emailOnIssue = picked.length > 0;
    d.emailedTo = picked.map((e) => ({ addr: e.addr, kind: e.kind || "Other" }));
    // R59: one submission; publishDocument also refuses a second concurrent issuance of the same draft.
    t.disabled = true;
    if (WriterState.CASEDIR && WriterState.NEEDGRANT) {
      grantCaseFolder(true).then(() => runFinalize(d));
      return;
    }
    runFinalize(d);
    return;
  }

  if (t.id === "acc-pick") {
    pickAccelaFile();
    return;
  }
  if (t.id === "acc-cancel") {
    WriterState.state.acc = null;
    WriterState.WORK.acc = null;
    delete WriterState.WORK.entry["lookup-number"];
    WriterState.LOOKUP_ERROR = "";
    render();
    saveDrafts();
    return;
  }
  if (t.id === "acc-go") {
    const plan = accelaPlan(WriterState.state.acc),
      existing = plan.existing;
    if (existing) preflightCase(existing.id, "import update", () => acceptAccela());
    else acceptAccela();
    return;
  }
  if (t.dataset.acccase !== undefined && WriterState.state.acc) {
    const ix = +t.dataset.acccase;
    if (WriterState.state.acc.cases[ix] && !WriterState.LOOKUP_BUSY) {
      cancelCaseLookup();
      const acc = WriterState.state.acc,
        serial = WriterState.LOOKUP_SERIAL;
      WriterState.state.acc.caseIx = ix;
      WriterState.state.acc.sel = WriterState.state.acc.cases[ix].sel;
      WriterState.ACC_SELECTION_SERIAL++;
      WriterState.state.acc.manualDate = "";
      WriterState.state.acc.manualTime = "";
      accelaFromShare().then(() => {
        if (serial !== WriterState.LOOKUP_SERIAL || WriterState.state.screen !== "import" || WriterState.state.acc !== acc) return;
        const active = document.activeElement,
          id = active?.id,
          sel = active?.dataset.accsel,
          cix = active?.dataset.acccase;
        scheduleDraftSave();
        renderKeep();
        const focus = id
          ? document.getElementById(id)
          : sel !== undefined
            ? document.querySelector('[data-accsel="' + Number(sel) + '"]')
            : cix !== undefined
              ? document.querySelector('[data-acccase="' + Number(cix) + '"]')
              : null;
        focus?.focus({ preventScroll: true });
      });
    }
    return;
  }
  if (t.dataset.accsel !== undefined && WriterState.state.acc && !WriterState.LOOKUP_BUSY) {
    const selected = +t.dataset.accsel;
    if (!selectImportInspection(selected)) return;
    scheduleDraftSave();
    renderKeep();
    document.querySelector('[data-accsel="' + selected + '"]')?.focus({ preventScroll: true });
    return;
  }
});

/* the Accela report can be dropped on the import card */
document.addEventListener("dragover", (e) => {
  const z = e.target.closest && e.target.closest("#acc-drop");
  if (!z) return;
  e.preventDefault();
  z.classList.add("over");
});
document.addEventListener("dragleave", (e) => {
  const z = e.target.closest && e.target.closest("#acc-drop");
  if (z) z.classList.remove("over");
});
document.addEventListener("drop", (e) => {
  const z = e.target.closest && e.target.closest("#acc-drop");
  if (!z) return;
  e.preventDefault();
  z.classList.remove("over");
  const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
  if (f) readAccelaFile(f);
});

/* Durable workspace recovery starts before the application becomes editable. */
if (document.documentElement) document.documentElement.lang = "en";
if (typeof bootStorage === "function") bootStorage();
window.addEventListener("beforeunload", (e) => {
  if (WriterState.DIRTY) {
    e.preventDefault();
    e.returnValue = "";
  }
});

/* typing on the document writes straight to state — no re-render, no lost cursor */
document.addEventListener("input", (e) => {
  const el = e.target;
  if (el.id === "correction-action-date") {
    const d = doc(WriterState.state.docId);
    if (d && d.correction && !d.pendingAmendment) {
      d.correction.actionDate = el.value;
      d.correction.reviewed = false;
      WriterState.DIRTY = true;
      scheduleDraftSave();
    }
    return;
  }
  if (el.id === "correction-reason" || el.id === "correction-external") {
    const d = doc(WriterState.state.docId);
    if (d && d.correction && !d.pendingAmendment) {
      d.correction[el.id === "correction-reason" ? "reason" : "externalReference"] = el.value;
      d.correction.reviewed = false;
      WriterState.DIRTY = true;
      scheduleDraftSave();
    }
    return;
  }
  if (el.id === "case-search" || el.id === "folder-search") {
    const cursor = el.selectionStart,
      key = el.id === "case-search" ? "caseQ" : "folderQ",
      id = el.id;
    WriterState.state[key] = el.value;
    if (id === "case-search") {
      WriterState.state.metric = "";
      render();
    } else refreshOverlay();
    const next = document.getElementById(id);
    if (next) {
      next.focus();
      if (next.setSelectionRange)
        try {
          next.setSelectionRange(cursor, cursor);
        } catch (err) {
          /* Some controls cannot restore a selection range; their values and focus remain intact. */
        }
    }
    return;
  }
  if (el.id === "pk-q") {
    WriterState.state.q = el.value;
    refreshOverlay();
    return;
  }
  // notes must not redraw on every keystroke or the caret jumps
  if (el.dataset && (el.dataset.cc || el.dataset.em || el.dataset.agent)) {
    const dd = doc(WriterState.state.docId);
    if (!dd) return;
    const k = docCase(dd);
    if (el.dataset.cc) {
      const p = el.dataset.cc.split("|");
      k.ccList = ccList(k);
      if (k.ccList[+p[0]]) k.ccList[+p[0]][p[1]] = el.value;
    } else if (el.dataset.em) {
      const p = el.dataset.em.split("|");
      k.emails = emailList(k);
      if (k.emails[+p[0]]) k.emails[+p[0]][p[1]] = el.value;
    } else {
      k.agent = k.agent || {};
      k.agent[el.dataset.agent] = el.value;
    }
    if (el.dataset.cc || el.dataset.agent) {
      const hadProblem = !!WriterState.state.ccProblem;
      WriterState.state.ccProblem = hadProblem ? validateAndStandardizeAddresses(k, dd.type === "citation" && isLLC(k), false) : null;
      const message = document.getElementById("cc-address-error");
      if (message) {
        if (WriterState.state.ccProblem)
          message.querySelector("div").innerHTML = "<strong>Check this address:</strong> " + esc(WriterState.state.ccProblem.message);
        else message.remove();
      }
      document.querySelectorAll('[aria-describedby="cc-address-error"]').forEach((field) => {
        field.removeAttribute("aria-invalid");
        field.removeAttribute("aria-describedby");
      });
      if (WriterState.state.ccProblem) {
        const field = document.querySelector(WriterState.state.ccProblem.selector);
        field?.setAttribute("aria-invalid", "true");
        field?.setAttribute("aria-describedby", "cc-address-error");
      }
      const key = el.dataset.cc ? "copy|" + el.dataset.cc.split("|")[0] : "agent|0";
      const preview = document.querySelector('[data-recipient-preview="' + key + '"]');
      if (preview) preview.textContent = recipientPreview(el.dataset.cc ? ccList(k)[+el.dataset.cc.split("|")[0]] : k.agent);
    }
    WriterState.DIRTY = true;
    scheduleDraftSave();
    return;
  }
  if (el.dataset && el.dataset.rinote) {
    const r = reinsp(WriterState.state.reinspId);
    if (r && r.draft && !r.docId && r.results[el.dataset.rinote]) {
      r.results[el.dataset.rinote].note = el.value;
      WriterState.DIRTY = true;
      scheduleDraftSave();
    }
    return;
  }
  if (el.id === "lib-filter") {
    const p = el.selectionStart;
    WriterState.state.libFilter = el.value;
    render();
    const f = document.getElementById("lib-filter");
    if (f) {
      f.focus();
      f.setSelectionRange(p, p);
    }
    return;
  }

  const d = doc(WriterState.state.docId);
  if (!d || isLocked(d)) return;
  if (d.correction && el.id !== "correction-reviewed") {
    d.correction.reviewed = false;
    const reviewed = document.getElementById("correction-reviewed");
    if (reviewed) reviewed.checked = false;
  }
  WriterState.DIRTY = true;
  scheduleDraftSave();
  const val = el.dataset.case === "number" ? el.textContent.trim() : el.isContentEditable ? el.innerText : el.value;

  if (el.dataset.case) {
    const k = docCase(d),
      f = el.dataset.case;
    if (f === "number" && !validCaseNumber(el.textContent.trim())) {
      el.setAttribute("aria-invalid", "true");
      el.title = "Case number must use 3–80 letters, numbers or hyphens";
      toast(el.title);
      return;
    }
    if (f === "number") {
      el.removeAttribute("aria-invalid");
      el.removeAttribute("title");
    }
    if (f === "number" && eventsFor(d.caseId).length) {
      el.textContent = k.number;
      toast("The case number is fixed after the record starts");
      return;
    }
    if (f === "ownerBlock") {
      const o = splitOwner(val);
      k.owner = o.owner;
      k.ownerAddr = o.addr;
      syncChip();
    } else if (el.dataset.fmt === "date") {
      k[f] = parseDate(val) || String(val || "").trim();
    } else if (el.dataset.fmt === "time") {
      k[f] = parseTime(val) || String(val || "").trim();
    } else k[f] = val;
    if (f === "number")
      document.querySelectorAll(".document-workspace .n-foot .mono,.document-workspace .n-cont .r").forEach((foot) => (foot.textContent = val));
    syncChip();
    return;
  }
  if (el.dataset.doc) {
    if (el.dataset.fmt === "date") {
      d[el.dataset.doc] = parseDate(val) || String(val || "").trim();
    } else d[el.dataset.doc] = val;
    syncChip();
    return;
  }
  if (el.dataset.cit) {
    const parts = String(el.dataset.cit).split("|");
    d.cits = d.cits || {};
    d.cits[parts[0]] = d.cits[parts[0]] || {};
    editCitation(d, parts[0], parts[1], val, "input");
    syncChip();
    return;
  }

  const f = el.dataset.field;
  if (!f) return;
  const it = d.items.find((i) => i.id === el.dataset.id);
  if (!it) return;
  if (alignedExtension(d)) newDocuments.invalidateItemReview(d);

  if (f === "due") {
    if (alignedExtension(d)) {
      newDocuments.setSpecialDue(d, it, val);
      return;
    }
    const m = MINDUE();
    it.due = val;
    updateDueIndicators(d);
    if (val && val < m && !unchangedCorrectionValue(d, it.id, "due")) toast("Check this past due date before issuing. Your entry has been kept.");
    syncChip();
    return;
  }
  if (f === "sections") {
    if (!it.libraryKey) it.libraryKey = itemLibraryKey(it);
    it.sections = val
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
    delete it.lib;
    syncChip();
    return;
  }
  if (f === "group") {
    // rename only the contiguous run that shared the old heading, never
    // every ungrouped item just because the old value was blank
    const old = WriterState.groupOld,
      ix = d.items.indexOf(it);
    it.group = val;
    if (old) {
      for (let n = ix + 1; n < d.items.length && d.items[n].group === old; n++) d.items[n].group = val;
      for (let n = ix - 1; n >= 0 && d.items[n].group === old; n--) d.items[n].group = val;
    }
    WriterState.groupOld = val;
    return;
  }
  if (f === "text") {
    it.text = val;
    const b = countBlanks(val),
      badge = document.querySelector('[data-blanks="' + it.id + '"]');
    if (badge) {
      badge.style.display = b ? "" : "none";
      badge.textContent = b + " blank" + (b === 1 ? "" : "s");
    }
    syncChip();
    return;
  }
  it[f] = val;
  syncChip();
});

document.addEventListener("change", (e) => {
  if (e.target.id === "ri-walk-mode") {
    WriterState.state.riWalkMode = e.target.value === "details" ? "details" : "quick";
    scheduleDraftSave();
    render();
    document.getElementById("ri-walk-mode")?.focus();
    return;
  }
  if (e.target.id === "ri-followup-intent") {
    const r = reinsp(WriterState.state.reinspId);
    if (r && r.draft && !r.docId) {
      r.followupIntent = e.target.value;
      scheduleDraftSave();
      renderKeep();
    }
    return;
  }
  if (e.target.id === "lib-status" || e.target.id === "pk-status") {
    WriterState.state[e.target.id === "lib-status" ? "libStatus" : "pickerStatus"] = e.target.value;
    if (e.target.id === "lib-status") render();
    else refreshOverlay();
    return;
  }
  if (e.target.id === "correction-type" || (e.target.dataset || {}).correctionOutcome) {
    const d = doc(WriterState.state.docId);
    if (!d || !d.correction || d.pendingAmendment) return;
    if (e.target.id === "correction-type") {
      const src = correctionSource(d);
      if (!correctionTypeAllowed(src, e.target.value)) return;
      d.type = e.target.value;
      d.correction.body = d.type === src.type ? docBody(src) : DOCBODY[d.type] || DOCBODY.notice;
      d.items.forEach((it) => {
        if (isHistoryDoc(d)) it.hist = d.authoringVersion >= 14 ? it.hist || itemInspectionHistory(d, it) : itemHistory(d.caseId, it.no);
      });
    } else {
      const it = d.items.find((x) => x.id === e.target.dataset.correctionOutcome);
      if (it) {
        d.correction.outcomes = d.correction.outcomes || {};
        d.correction.outcomes[it.id] = e.target.value;
        it.done = e.target.value === "corrected";
        it.doneOn = it.done ? it.doneOn || d.inspDate || recordDay(today) : "";
      }
    }
    d.correction.reviewed = false;
    WriterState.DIRTY = true;
    saveDrafts();
    render();
    return;
  }
  if (e.target.id === "keep-adding") {
    WriterState.state.keepAdding = e.target.checked;
    return;
  }
  if (e.target.id === "case-filter" || e.target.id === "case-inspector") {
    WriterState.state.metric = "";
    // Returning More views to its placeholder restores the default Needs attention view.
    WriterState.state[e.target.id === "case-filter" ? "caseFilter" : "caseInspector"] =
      e.target.id === "case-filter" ? e.target.value || "attention" : e.target.value;
    render();
    if (e.target.id === "case-filter") document.querySelector("#case-filter")?.focus();
    return;
  }
  if ((e.target.id === "acc-date" || e.target.id === "acc-time") && WriterState.state.acc) {
    WriterState.state.acc[e.target.id === "acc-date" ? "manualDate" : "manualTime"] = e.target.value;
    scheduleDraftSave();
    renderKeep();
    return;
  }
  if (e.target.dataset && e.target.dataset.em) {
    const dd = doc(WriterState.state.docId);
    if (dd) {
      const k = docCase(dd),
        p = e.target.dataset.em.split("|");
      k.emails = emailList(k);
      if (k.emails[+p[0]]) k.emails[+p[0]][p[1]] = e.target.value;
      WriterState.DIRTY = true;
      render();
    }
    return;
  }
  const rr = reinsp(WriterState.state.reinspId),
    ds = e.target.dataset || {};
  if (rr && rr.draft && !rr.docId && (ds.ridate || ds.ridue || (ds.ricite && (rr.importRule?.cite || !e.target.checked)))) {
    const id = ds.ridate || ds.ridue || ds.ricite,
      res = rr.results[id];
    if (res) {
      if (ds.ridate) {
        res.on = e.target.value;
        res.manualDate = true;
      } else if (ds.ridue) res.due = e.target.value;
      else res.cite = e.target.checked;
      WriterState.DIRTY = true;
      renderKeep();
    }
    return;
  }
  if (e.target.id === "ri-date") {
    const r = reinsp(WriterState.state.reinspId);
    if (r && r.draft && !r.docId) {
      changeVisitDate(r, e.target.value);
      WriterState.DIRTY = true;
      renderKeep();
    }
    return;
  }
  if (e.target.id === "ri-time") {
    const r = reinsp(WriterState.state.reinspId);
    if (r && r.draft && !r.docId) {
      r.time = e.target.value;
      WriterState.DIRTY = true;
      saveDrafts();
    }
    return;
  }
  if (e.target.id === "ri-insp") {
    const r = reinsp(WriterState.state.reinspId);
    if (r && r.draft && !r.docId) {
      r.inspectorId = e.target.value;
      WriterState.DIRTY = true;
      scheduleDraftSave();
    }
    return;
  }
  if (e.target.id === "pk-grp") {
    const [ci, gi] = e.target.value.split(":").map(Number);
    WriterState.state.cl = ci;
    WriterState.state.grp = gi;
    WriterState.state.q = "";
    refreshOverlay();
    return;
  }
  const d = doc(WriterState.state.docId);
  if (!d) return;
  if (e.target.dataset && e.target.dataset.doc === "inspectorId" && !isLocked(d)) {
    d.inspectorId = e.target.value;
    Object.values(d.cits || {}).forEach((c) => (c.deptId = docInsp(d).badge || ""));
    WriterState.DIRTY = true;
    refreshSheet();
  }
});

document.addEventListener("keydown", (e) => {
  if (
    e.key === "Escape" &&
    (WriterState.state.picker || WriterState.state.modal) &&
    !WriterState.AMENDMENT_BUSY &&
    !WriterState.LOOKUP_BUSY &&
    !WriterState.RESOLUTION_BUSY
  ) {
    WriterState.state.picker = false;
    WriterState.state.modal = null;
    render();
  }
});

render();

// Preserve the legacy audit constant only in the fixture build.
if (__TEST_BUILD__) globalThis.SUMMARY_VERSION = SUMMARY_VERSION;

document.addEventListener("click", (e) => languageClick(e));
document.addEventListener("input", (e) => {
  if (e.target.id === "catalog-filter") {
    WriterState.state.catalogAdminQ = e.target.value;
    render();
  }
});
document.addEventListener("change", (e) => {
  if (e.target.id === "catalog-status") {
    WriterState.state.catalogAdminStatus = e.target.value;
    render();
    document.getElementById("catalog-status")?.focus();
  }
  if (e.target.id === "lib-checklist") {
    WriterState.state.libCl = Number(e.target.value);
    render();
    document.getElementById("lib-checklist")?.focus();
  }
});

export function citationPricingDate(c, d) {
  return policyCitationPricingDate(c, d, inspAt(d).date);
}

if (__TEST_BUILD__) globalThis.__DW_TEST_REFERENCES = { deposits: DEPOSITS, safety: safetyCaseStatus };
