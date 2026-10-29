import { html as screen, raw } from "./screen_html.js";
import { workspaceState as workspace } from "./workspace_state.js";
import { editorState as editor } from "./editor_state.js";
/* Core supplies named UI/peer dependencies; construction does not read them. */
import { continuingItemsForVisits } from "./case_projection.js";
import { NEW_TYPES, DOC_TYPES } from "./document_types.js";
import {
  alignedExtension,
  DATED_EXTENSIONS,
  simplifiedBestInterest,
  datedExtension,
  ALL_ITEM_EXTENSIONS,
  allItemExtension,
  simpleVacancy,
  specialType,
  supplemental,
  activeRestrictions,
  isEffective,
} from "./document_rules.js";
import { recordDay } from "../assets/shared.js";

import { stableJSON, clone } from "./record_values.js";

import { addDays, daysBetween } from "./calendar.js";
import { checkAttr, checkTarget, esc, itemSelector } from "./presentation_format.js";
import {
  doc,
  docCase,
  docInsp,
  docsFor,
  draftDocFor,
  insp,
  isReferredCase,
  kase,
  openItems,
  originalNotice,
  recordHead,
  recordNow,
  reinsp,
  reinspFor,
} from "./writer_queries.js";

import { INSPECTORS } from "./data/inspectors.js";

const outstandingNumbers = (d) => (d.items || []).filter((i) => !i.done && !i.withdrawn).map((i) => String(i.no));
/* The affected list is derived for authoring 16, so the stored record and helper checks still name the items. */
const syncAffected = (d) => {
  if (allItemExtension(d)) (d.special ||= {}).affected = outstandingNumbers(d);
};
const requireDated = (type, s, version = DATED_EXTENSIONS) => {
  // Authoring 13-15 Vacancy is always dated; authoring 16 has no repair-deadline model, so a cached one is dropped.
  if (type === "vacancyExtension") {
    if (version < ALL_ITEM_EXTENSIONS) s.deadlineMode = "dated";
    else delete s.deadlineMode;
  }
  return s;
};
/* R26 scoped actions. Supplemental letters never replace continuing item state. */
const REFERRED_MESSAGE = "This case is with the City Attorney. Only an Update for Case Referral or a Compliance Letter can be written.";

const NUISANCES = [
  ["junk", "Junk, trash and debris", "27.05(3)(b)4"],
  ["sidewalk", "Trees or shrubs obstructing a sidewalk", "27.05(3)(b)1"],
  ["tree", "Dead or hazardous tree", "27.05(3)(b)3"],
  ["secure", "Secure a vacant building", "27.085(2)(a)"],
  ["custom", "Custom nuisance with verified authority", ""],
];
const REMEDY =
  "Remedy from Order. The Building Code, Fire Code, Conveyance Code & Licensing Appeals Board, created by Section 29.18 of these Ordinances, shall have no authority to act on orders issued under this subsection. Any person affected by orders issued under this subsection shall, within thirty (30) days of service or publication of the order, apply to the Circuit Court for an order restraining the City and the Director of Building Inspection from entering on the premises and abating or removing the nuisance, or be forever barred. The court shall determine the reasonableness of the order for abatement of the nuisance.";

function specialVacancyScope({ add, s, need }) {
  add(s.scope === "building" || s.scope === "unit", "Choose building or apartment / unit scope.", "scope");
  if (s.scope === "unit") need("unit", "the apartment / unit identifier");
}

function specialReviewedScope({ need, add, services, s, day }) {
  ["reviewer", "reviewRef", "codeSource", "codeRevision", "authority", "signerName", "signerTitle", "delegation"].forEach((k) =>
    need(
      k,
      {
        reviewer: "the division reviewer",
        reviewRef: "the approved current ordinance and wording reference",
        codeSource: "the verified current-code source URL / official source reference",
        codeRevision: "the code revision / effective information and amendment review",
        authority: "the verified authority",
        signerName: "the authorized signer",
        signerTitle: "the signer’s title",
        delegation: "the signer’s authorization / delegation reference",
      }[k],
    ),
  );
  add(services.validISO(s.reviewDateLegal) && s.reviewDateLegal <= day(), "Record the current-code review date.", "reviewDateLegal");
  add(s.reviewed === true, "Division review must confirm this variant, wording, procedure and authority.", "reviewed");
  add(s.scope === "building" || s.scope === "unit", "Choose building or apartment / unit scope.", "scope");
  if (s.scope === "unit") need("unit", "the apartment / unit identifier");
}

function specialScopeReadiness(context) {
  const { d } = context;
  if (simpleVacancy(d)) {
    specialVacancyScope(context);
  } else if (!simplifiedBestInterest(d)) {
    specialReviewedScope(context);
  }
}

function securingReadiness({ need, s }) {
  need("securingConditions", "the reviewed securing / animal / material conditions");
  if (s.boarding) need("boardingRef", "the prior written boarding approval");
}

function nuisanceReadiness({ add, s, d, need, services }) {
  add(
    NUISANCES.some((v) => v[0] === s.variant && (d.type === "summaryAbatement" || v[0] !== "secure")),
    "Choose an approved nuisance preset.",
    "variant",
  );
  need("findings", "the specific conditions and locations");
  need("work", "the corrective work");
  if (d.type === "summaryAbatement") need("summaryBasis", "the factual basis for immediate summary action");
  else {
    add(services.validISO(s.orderDue) && s.orderDue > d.mailed, "Enter the approved future order compliance date.", "orderDue");
    need("servicePlan", "the approved service / publication plan");
    add(s.remedyReviewed === true, "Confirm the distinct Circuit Court remedy against current code.", "remedyReviewed");
  }
  if (s.variant === "custom") need("customReviewRef", "the custom condition’s verified authority and approved wording reference");
  if (s.variant === "tree") need("forestryRef", "the forestry report or reviewed factual tree assessment");
  if (s.variant === "secure") {
    securingReadiness({ need, s });
  }
}

function externalReleaseReadiness({ need, add, s }) {
  need("releaseInspectionRef", "the verified external reinspection record reference");
  add(!!insp(s.releaseInspectorId).name, "Select the inspector who performed the release reinspection.", "releaseInspectorId");
}

function releaseScopeAndDate({ old, s, add, text, services, day }) {
  add(
    old && old.special.scope === s.scope && (s.scope !== "unit" || text(old.special.unit) === text(s.unit)),
    "Select the active restriction for this exact scope.",
    "releases",
  );
  add(
    services.validISO(s.releaseInspection) &&
      s.releaseInspection <= day() &&
      s.releaseInspection <= s.effective &&
      (!old || s.releaseInspection >= old.special.effective),
    "Record the verified release reinspection date.",
    "releaseInspection",
  );
}

function releaseReadiness({ d, s, add, text, services, day, need }) {
  const old = activeRestrictions(docsFor(d.caseId)).find((x) => x.id === s.releases);
  releaseScopeAndDate({ old, s, add, text, services, day });
  need("releaseFacts", "the confirmed corrections and reinspection record");
  add(
    s.placardRemoved && services.validISO(s.removalDate) && s.removalDate <= day() && s.removalDate <= s.effective,
    "Record actual placard removal before permission to reoccupy.",
    "removalDate",
  );
  need("releaseFormRef", "the division-approved written release form / procedure");
  const visit = reinsp(s.releaseVisitId);
  if (s.releaseVisitId === "external") {
    externalReleaseReadiness({ need, add, s });
  } else
    add(
      visit && visit.caseId === d.caseId && !visit.draft && visit.date === s.releaseInspection,
      "Select the recorded visit confirming release, or record the verified external inspection.",
      "releaseVisitId",
    );
}

function restrictionReadiness({ need, add, s, services, day, d }) {
  need("findings", "the restriction findings");
  need("releaseConditions", "the conditions necessary for release");
  add(["posted", "pending"].includes(s.posting), "Record posting status.", "posting");
  if (s.posting === "posted")
    add(services.validISO(s.postedDate) && s.postedDate <= day() && s.postedDate <= d.mailed, "Record the actual posting date.", "postedDate");
  else need("prePostingRef", "the approved pre-posting order wording / procedure");
}

function occupancyReadiness({ add, services, s, d, day, text, need }) {
  add(
    services.validISO(s.effective) && s.effective >= docCase(d).date && s.effective <= d.mailed && s.effective <= day(),
    "Enter a valid effective order / release date.",
    "effective",
  );
  add(["restrict", "release"].includes(s.mode), "Choose restriction or documented release.", "mode");
  if (s.mode === "release") {
    releaseReadiness({ d, s, add, text, services, day, need });
  } else {
    restrictionReadiness({ need, add, s, services, day, d });
  }
}

function bestInterestDueReadiness({ need, selected, d, s, services, day, add }) {
  need("reason", "the reasons for additional time");
  // The same due-date rules as a normal Extension: a future date for each uncorrected item, at most three
  // outstanding dates, at least seven days apart.
  const missing = selected(d, s).filter((i) => !(services.validISO(i.due) && i.due > (d.mailed || day())));
  add(
    !missing.length,
    "Enter a future due date in Violation items for each uncorrected item.",
    "affected",
    missing.map((i) => checkTarget(itemSelector(i.id, "due"), "Item " + i.no + " due date")),
  );
  const dates = [
    ...new Set(
      selected(d, s)
        .map((i) => i.due)
        .filter(Boolean),
    ),
  ].sort();
  add(
    dates.length <= 3 && dates.every((v, n) => !n || daysBetween(dates[n - 1], v) >= 7),
    "Use at most three outstanding dates, at least seven days apart.",
    "affected",
  );
}

function vacancyDueReadiness({ add, services, s, d, day, selected }) {
  add(
    services.validISO(s.reviewDate) && daysBetween(d.mailed || day(), s.reviewDate) >= 7,
    "Enter a next review inspection date at least seven days after the mailing date.",
    "reviewDate",
  );
  add(
    selected(d, s).every((i) => !i.due),
    "Uncorrected items on a Vacancy Extension have no due date.",
    "affected",
  );
}

function allItemReadiness({ add, selected, d, s, need, services, day }) {
  // R62: every uncorrected item is covered; there is no selection or safety confirmation.
  add(selected(d, s).length > 0, "There are no uncorrected items to extend.", "affected");
  if (d.type === "bestInterestExtension") {
    bestInterestDueReadiness({ need, selected, d, s, services, day, add });
  } else {
    vacancyDueReadiness({ add, services, s, d, day, selected });
  }
  add(
    d.items.filter((i) => i.done || i.withdrawn).every((i) => i.due === (s.originalDues?.[i.no] ?? i.due)),
    "Corrected items keep their dates.",
    "affected",
  );
}

function legacyBestInterestReadiness({ need, add, s, selected, d }) {
  need("noticeRef", "the prior Official Notice reference");
  need("reason", "the reasons for additional time");
  need("intentions", "the owner’s intended corrective work");
  need("supervisor", "the supervisory reviewer");
  add(["administrative", "supervisory"].includes(s.stage), "Record the actual internal review stage.", "stage");
  if (s.stage === "supervisory")
    add(
      selected(d, s).every((i) => s.originalDues?.[i.no] && s.originalDues[i.no] < d.mailed),
      "Supervisory prosecution-review language requires passed compliance dates.",
      "stage",
    );
}

function legacyVacancyReadiness({ need, add, services, s, d }) {
  need("vacancyFacts", "the verified vacancy basis");
  need("requestRef", "the extension request");
  need("conditions", "the approved continuing conditions");
  need("expiryPolicyRef", "the approved expiration / review policy");
  need("transferClause", "the reviewed sale / transfer and applicable disclosure wording");
  add(services.validISO(s.reviewDate) && s.reviewDate > d.mailed, "Enter the next scheduled review inspection date.", "reviewDate");
  if (s.reviewDate && addDays(s.reviewDate, -7) < d.mailed) need("shortNoticeRef", "the approved short-notice contact procedure");
  add(["fixed", "review"].includes(s.expiryMode), "Choose the approved expiration / review model.", "expiryMode");
  if (s.expiryMode === "fixed")
    add(services.validISO(s.expiryDate) && s.expiryDate > d.mailed, "Enter a separate future expiration date.", "expiryDate");
  add(["dated", "conditional"].includes(s.deadlineMode), "Choose the approved repair deadline model.", "deadlineMode");
}

function laterDueReadiness({ services, d, s, add, selected }) {
  const laterDue = (i) => services.validISO(i.due) && i.due > d.mailed && i.due > (s.originalDues?.[i.no] || "");
  // Authoring 13 enters these dates in Violation items; link each affected item's due-date field there.
  add(
    selected(d, s).every(laterDue),
    datedExtension(d)
      ? "Enter a later future due date in Violation items for each affected item."
      : "Enter later future deadlines for all affected items.",
    "affected",
    datedExtension(d)
      ? selected(d, s)
          .filter((i) => !laterDue(i))
          .map((i) => checkTarget(itemSelector(i.id, "due"), "Item " + i.no + " due date"))
      : [],
  );
  const dates = [
    ...new Set(
      d.items
        .filter((i) => !i.done && !i.withdrawn)
        .map((i) => i.due)
        .filter(Boolean),
    ),
  ].sort();
  add(
    dates.length <= 3 && dates.every((v, n) => !n || daysBetween(dates[n - 1], v) >= 7),
    "Use at most three outstanding dates, at least seven days apart.",
    "affected",
  );
}

function selectedItemSafetyReadiness({ add, selected, d, s, text }) {
  add(selected(d, s).length > 0, "Select at least one outstanding affected item.", "affected");
  add(
    s.noSafety === true && (simplifiedBestInterest(d) || text(s.safetyBasis)),
    simplifiedBestInterest(d)
      ? "Confirm affected items exclude safety, security and urgent obligations."
      : "Confirm the reviewed factual basis excluding safety, security and urgent obligations.",
    simplifiedBestInterest(d) ? "noSafety" : "safetyBasis",
  );
}

function selectedExtensionReadiness({ add, selected, d, s, text, need, services }) {
  selectedItemSafetyReadiness({ add, selected, d, s, text });
  if (simplifiedBestInterest(d)) {
    need("reason", "the reasons for additional time");
  } else if (d.type === "bestInterestExtension") {
    legacyBestInterestReadiness({ need, add, s, selected, d });
  } else {
    legacyVacancyReadiness({ need, add, services, s, d });
  }
  if (d.type === "bestInterestExtension" || s.deadlineMode === "dated") {
    laterDueReadiness({ services, d, s, add, selected });
  }
  if (d.type === "vacancyExtension" && s.deadlineMode === "conditional")
    add(
      selected(d, s).every((i) => i.due === s.originalDues?.[i.no]),
      "Conditional extensions retain source repair dates; do not invent a replacement deadline.",
      "deadlineMode",
    );
  add(
    d.items.filter((i) => !(s.affected || []).includes(String(i.no))).every((i) => i.due === (s.originalDues?.[i.no] ?? i.due)),
    "Unselected items must retain their deadlines.",
    "affected",
  );
}

const specialFamilyRules = [
  { id: "nuisanceReadiness", applies: ({ d }) => ["summaryAbatement", "nonSummaryAbatement"].includes(d.type), run: nuisanceReadiness },
  { id: "occupancyReadiness", applies: ({ d }) => d.type === "noOccupancy", run: occupancyReadiness },
  { id: "allItemReadiness", applies: ({ d }) => allItemExtension(d), run: allItemReadiness },
  { id: "selectedExtensionReadiness", applies: () => true, run: selectedExtensionReadiness },
];

function specialFamilyReadiness(context) {
  for (const rule of specialFamilyRules) {
    if (rule.applies(context)) {
      rule.run(context);
      return;
    }
  }
}

function editCaseAndVisitSelection(services, refreshControls, el, d, r) {
  if (el.dataset.caseActionGroup) {
    editor.WORK.currentAction.group = el.dataset.caseActionGroup;
    editor.WORK.currentAction.type = "";
    services.saveDrafts();
    refreshControls(el);
    return true;
  }
  if (el.dataset.caseActionType) {
    editor.WORK.currentAction.type = el.dataset.caseActionType;
    services.saveDrafts();
    refreshControls(el);
    return true;
  }
  if (el.dataset.serviceField && d) {
    const key = "service:" + d.id;
    editor.WORK.recordForms[key] = editor.WORK.recordForms[key] || {};
    editor.WORK.recordForms[key][el.dataset.serviceField] = el.value;
    services.scheduleDraftSave();
    return true;
  }
  if (el.dataset.actionGroup && r) {
    r.actionGroup = el.dataset.actionGroup;
    r.followupIntent = "";
    editor.WORK.actionChoices = editor.WORK.actionChoices || {};
    editor.WORK.actionChoices[r.id] = { intent: "", group: r.actionGroup };
    services.saveDrafts();
    refreshControls(el);
    return true;
  }
  if (el.dataset.actionType && r) {
    r.followupIntent = el.dataset.actionType;
    editor.WORK.actionChoices = editor.WORK.actionChoices || {};
    editor.WORK.actionChoices[r.id] = { intent: r.followupIntent, group: r.actionGroup };
    services.saveDrafts();
    refreshControls(el);
    return true;
  }
  return false;
}

function switchAdministrativeFamily(services, refreshControls, restoreDues, el, d) {
  if (el.dataset.special === "administrativeType" && d && d.draft) {
    d.selectionCache = d.selectionCache || {};
    d.selectionCache[d.type] = clone(d.special || {});
    // Switching families never adopts the simplified Best Interest format; that remains an explicit choice.
    d.authoringCache = d.authoringCache || {};
    d.authoringCache[d.type] = d.authoringVersion;
    d.items.forEach((i) => (i.due = d.special?.originalDues?.[i.no] ?? i.due));
    d.type = el.value;
    // A family already visited keeps its own version, so an older Best Interest draft never silently adopts the
    // signer-free format. A first visit uses the R61 defaults on the dated model; older drafts keep their version.
    // R62: an authoring-16 draft stays on the all-item model in both families.
    d.authoringVersion =
      d.authoringCache[d.type] ??
      (d.authoringVersion >= ALL_ITEM_EXTENSIONS
        ? ALL_ITEM_EXTENSIONS
        : d.authoringVersion >= DATED_EXTENSIONS
          ? d.type === "bestInterestExtension"
            ? 15
            : DATED_EXTENSIONS
          : d.authoringVersion);
    d.special = clone(d.selectionCache[d.type] || { originalDues: Object.fromEntries(d.items.map((i) => [i.no, i.due || ""])) });
    if (datedExtension(d)) requireDated(d.type, d.special, d.authoringVersion);
    restoreDues(d);
    services.saveDrafts();
    refreshControls(el);
    return true;
  }
  return false;
}

function editScopedSpecialField({ services, refreshControls, restoreDues, specialBody, ev, el, d, s }) {
  if (el.dataset.special) {
    const k = el.dataset.special;
    if (k !== "reviewed") {
      s.reviewed = false;
      const box = document.querySelector('[data-special="reviewed"]');
      if (box) box.checked = false;
    }
    s[k] = el.type === "checkbox" ? el.checked : el.value;
    if (d.correction && (allItemExtension(d) || (k === "reason" && simplifiedBestInterest(d)))) d.correction.body = specialBody(d);
    if (k === "deadlineMode") restoreDues(d);
    if (k === "variant") s.authority = NUISANCES.find((v) => v[0] === s.variant)?.[2] || "";
    if (d.fromReinspId) {
      const visit = reinsp(d.fromReinspId);
      if (visit) {
        visit.actionDetails = visit.actionDetails || {};
        visit.actionDetails[d.type] = clone(s);
      }
    }
    services.scheduleDraftSave();
    if (
      ev.type === "change" &&
      ["scope", "variant", "mode", "posting", "boarding", "stage", "expiryMode", "deadlineMode", "releaseVisitId"].includes(k)
    ) {
      refreshControls(el);
    } else services.refreshSheet();
    return true;
  }
  return false;
}

function editScopedSpecialItem({ services, refreshControls, restoreDues, invalidateSafety, cacheDetails, el, d, s }) {
  if (el.dataset.specialItem) {
    s.reviewed = false;
    const box = document.querySelector('[data-special="reviewed"]');
    if (box) box.checked = false;
    const no = el.dataset.specialItem;
    s.affected = s.affected || [];
    s.affected = el.checked ? [...new Set([...s.affected, no])] : s.affected.filter((x) => x !== no);
    restoreDues(d);
    invalidateSafety(d);
    cacheDetails(d);
    services.saveDrafts();
    refreshControls(el);
    return true;
  }
  return false;
}

const e = (v) => esc(v),
  text = (v) => String(v || "").trim(),
  p = (t) => "<p>" + e(t).replace(/◯|\(\s{0,8}\)/g, '<span class="blank" role="img" aria-label="fill-in bubble"></span>') + "</p>",
  val = (s, k) => text(s[k]) || "◯",
  clause = (v) => text(v).replace(/[.\s]+$/, ""),
  scope = (d, s) =>
    docCase(d).address +
    (s.scope === "unit"
      ? " — " + (/^(?:apartment|apt\.?|unit|suite|room)\b/i.test(text(s.unit)) ? "" : "Apartment / unit ") + val(s, "unit")
      : " — Entire building"),
  contact = (d) => {
    const i = insp(docCase(d).inspectorId);
    return i.name + " at " + i.phone + (i.email ? " or " + i.email : "");
  },
  selected = (d, s) => (d.items || []).filter((i) => (s.affected || []).includes(String(i.no)) && !i.done && !i.withdrawn);

// Bound narrative rows so long findings paginate without an oversized row.
function narrativeParagraphs(paras) {
  return paras
    .flatMap((t) => {
      const words = t.split(/\s+/);
      if (words.length <= 100) return [p(t)];
      const out = [];
      for (let n = 0; n < words.length; n += 100) out.push(p(words.slice(n, n + 100).join(" ")));
      return out;
    })
    .join("");
}

/* Printed narrative by document family. Each builder takes the shared context and returns its paragraphs in print order. */
function abatementParagraphs(c) {
  const { s, type, at, address, date } = c,
    paras = [];
  paras.push("An inspection of " + address + " on " + date(at.date) + " identified the following conditions:");
  paras.push(...val(s, "findings").split(/\n+/));
  paras.push("These conditions constitute a public nuisance under Madison General Ordinances " + val(s, "authority") + ".");
  paras.push(
    "You are ordered to " +
      (type === "summaryAbatement" ? "immediately abate the nuisance" : "abate the nuisance no later than " + date(s.orderDue)) +
      ". Required corrective work: " +
      clause(val(s, "work")) +
      ".",
  );
  if (s.variant === "tree" && s.removeTree) paras.push("Remove the tree flush with the ground and properly dispose of all limbs and branches.");
  if (s.variant === "secure") paras.push("Securing conditions: " + clause(val(s, "securingConditions")) + ".");
  if (s.variant === "secure" && s.boarding)
    paras.push(
      "Boarding requires prior written approval from the Director of Building Inspection. Approval reference: " + val(s, "boardingRef") + ".",
    );
  paras.push(
    "If you do not " +
      (type === "summaryAbatement" ? "immediately " : "") +
      "abate the nuisance as ordered, the City will abate it. The costs will be assessed against the property as a special charge. Additional charges or penalties may apply.",
  );
  if (type === "nonSummaryAbatement") paras.push(REMEDY);

  return paras;
}

function noOccupancyParagraphs(c) {
  const { s, address, date } = c,
    paras = [];
  if (s.mode === "release") {
    paras.push(
      "Building Inspection grants written permission to reoccupy " +
        address +
        " effective " +
        date(s.effective) +
        ", releasing the No Occupancy order " +
        val(s, "releases") +
        ".",
    );
    paras.push(
      "The premises were reinspected on " +
        date(s.releaseInspection) +
        ". Required release conditions have been verified: " +
        clause(val(s, "releaseFacts")) +
        ".",
    );
    paras.push(
      s.placardRemoved
        ? "The No Occupancy placard was removed on " + date(s.removalDate) + "."
        : "Placard removal status: " + val(s, "removalFacts") + ".",
    );
  } else {
    paras.push(
      "Pursuant to Madison General Ordinances " +
        val(s, "authority") +
        ", " +
        address +
        (s.posting === "posted" ? " was posted “No Occupancy” on " + date(s.postedDate) : " is ordered to remain vacant, with posting pending") +
        " and shall not be used for human habitation. This order is effective " +
        date(s.effective) +
        ".",
    );
    paras.push("The restriction is based on the following findings: " + clause(val(s, "findings")) + ".");
    paras.push(
      "The premises must remain vacant. Required release conditions: " +
        clause(val(s, "releaseConditions")) +
        ". Before occupancy is allowed, the City of Madison Building Inspection Division must reinspect the premises, remove the placard, and give written permission to reoccupy.",
    );
    if (text(s.access)) paras.push("Approved access conditions: " + s.access);
  }

  return paras;
}

function allItemBestInterestParagraphs(c) {
  const { s } = c,
    paras = [];
  paras.push("Additional time is granted for the uncorrected items for the following reasons: " + clause(val(s, "reason")) + ".");

  return paras;
}

function simplifiedBestInterestParagraphs(c) {
  const { s } = c,
    paras = [];
  paras.push("Additional time is granted for the selected items for the following reasons: " + clause(val(s, "reason")) + ".");

  return paras;
}

function legacyBestInterestParagraphs(c) {
  const { s, refs } = c,
    paras = [];
  if (s.stage === "supervisory")
    paras.push(
      "The uncorrected violations in Official Notice " +
        val(s, "noticeRef") +
        " have been referred for supervisory review of possible prosecution. The compliance date has passed.",
    );
  paras.push(
    "We find that granting additional time is in the City’s best interest and yours. Reasons supporting this extension: " +
      clause(val(s, "reason")) +
      ". You have indicated that you intend to correct the listed violations, and no safety items are included in this extension.",
  );
  paras.push("The compliance dates for Item(s) " + refs + " are extended as shown below. Unlisted items retain their existing deadlines.");
  if (s.stage === "supervisory" && s.prosecutionClause)
    paras.push("If the work is not completed by the extended date, the case will be forwarded to the City Attorney for legal action.");

  return paras;
}

function simpleVacancyParagraphs(c) {
  const { d, s, address, date } = c,
    paras = [];
  const place = s.scope === "unit" ? "apartment / unit" : "building";
  paras.push(
    "Your request for additional time to correct the violations at " +
      address +
      " has been reviewed. While the " +
      place +
      " remains vacant and the conditions below are met, we grant an extension for the uncorrected item(s).",
  );
  paras.push(
    "The " +
      place +
      " must remain secure. The exterior" +
      (s.scope === "unit" ? " and building common areas" : "") +
      " must be maintained, including removal of trash and debris, grass cutting, sidewalk snow removal, and general exterior maintenance. The property may be inspected periodically, including unscheduled inspections.",
  );
  paras.push(
    "The next scheduled review inspection is " +
      date(s.reviewDate) +
      ". This appointment is separate from repair deadlines and does not grant permission to occupy.",
  );
  paras.push(
    "Contact " +
      contact(d) +
      " at least one week before that inspection (by " +
      date(s.reviewDate ? addDays(s.reviewDate, -7) : "") +
      "), or before occupancy, to arrange a reinspection. Occupancy without prior Building Inspection approval may result in a citation or referral to the City Attorney. Failure to maintain the required areas may void this extension and result in enforcement action.",
  );
  paras.push("A further extension will be considered after the next inspection, provided vacancy and the extension conditions continue.");

  return paras;
}

function vacancyParagraphs(c) {
  const { d, s, address, refs, date } = c,
    paras = [];
  paras.push(
    "Your request for additional time to correct the violations at " +
      address +
      " has been reviewed. While the " +
      (s.scope === "unit" ? "apartment / unit" : "building") +
      " remains vacant and the conditions below are met, we grant an extension for Item(s) " +
      refs +
      ".",
  );
  paras.push(
    "The " +
      (s.scope === "unit" ? "apartment / unit" : "building") +
      " must remain secure. The exterior" +
      (s.scope === "unit" ? " and building common areas" : "") +
      " must be maintained, including removal of trash and debris, grass cutting, sidewalk snow removal, and general exterior maintenance. The property may be inspected periodically, including unscheduled inspections.",
  );
  paras.push(
    "The next scheduled review inspection is " +
      date(s.reviewDate) +
      ". This appointment is separate from repair deadlines and does not grant permission to occupy. " +
      (s.expiryMode === "fixed"
        ? "This conditional extension expires on " + date(s.expiryDate) + "."
        : "The extension is subject to review under the approved conditions below."),
  );
  paras.push(
    "Contact " +
      contact(d) +
      " at least one week before that inspection (by " +
      date(s.reviewDate ? addDays(s.reviewDate, -7) : "") +
      "), or before occupancy, to arrange a reinspection. Occupancy without prior Building Inspection approval may result in a citation or referral to the City Attorney. Failure to maintain the required areas may void this extension and result in enforcement action.",
  );
  paras.push(
    "A further extension will be considered after the next inspection, provided vacancy and the extension conditions continue. Contact Building Inspection before a sale or transfer to arrange review of the outstanding violations and case responsibility.",
  );
  paras.push("Approved conditions: " + val(s, "conditions"));
  paras.push(val(s, "transferClause"));
  paras.push(
    "Security, urgent safety obligations and unlisted items are not extended. Any existing No Occupancy order continues until explicitly released in writing.",
  );

  return paras;
}

function itemReferenceParagraphs(c, paras) {
  const { s, type, items, refs, date } = c;
  if (items.length) {
    paras.push("Affected item references: " + refs + ".");
    if (["bestInterestExtension", "vacancyExtension"].includes(type))
      items.forEach((i) =>
        paras.push(
          "Item " +
            i.no +
            " — " +
            i.text +
            "\nPrevious deadline: " +
            date(s.originalDues?.[i.no]) +
            "; " +
            (type === "vacancyExtension" && s.deadlineMode === "conditional"
              ? "conditional extension; no replacement repair date."
              : "extended deadline: " + date(i.due) + "."),
        ),
      );
  }
}

function closingParagraphs(c, paras) {
  const { d, s, type } = c;
  paras.push("For questions" + (type === "noOccupancy" ? ", or to arrange reinspection" : "") + ", contact " + contact(d) + ".");
  paras.push(val(s, "signerName") + "\n" + val(s, "signerTitle"));
}

const NARRATIVE_BUILDERS = [
  [({ type }) => type === "summaryAbatement" || type === "nonSummaryAbatement", abatementParagraphs],
  [({ type }) => type === "noOccupancy", noOccupancyParagraphs],
  [({ type, d }) => type === "bestInterestExtension" && allItemExtension(d), allItemBestInterestParagraphs],
  [({ type, d }) => type === "bestInterestExtension" && simplifiedBestInterest(d), simplifiedBestInterestParagraphs],
  [({ type }) => type === "bestInterestExtension", legacyBestInterestParagraphs],
  [({ d }) => simpleVacancy(d), simpleVacancyParagraphs],
  [({ type }) => type === "vacancyExtension", vacancyParagraphs],
];

/* Details form sections. Each builds its fields from the document; the shell wraps them in the order shown. */
const formField = (s, k, label, type = "text") =>
  screen`<label class="f"><span>${raw(e(label))}</span><${raw(type === "textarea" ? 'textarea rows="3"' : 'input type="' + type + '"')} aria-label="${raw(e(label))}" data-special="${String(k)}" ${raw(type === "textarea" ? "" : 'value="' + e(s[k] || "") + '"')}>${raw(type === "textarea" ? e(s[k] || "") + "</textarea>" : "")}</label>`;

const formSelect = (s, k, label, opts) =>
  screen`<label class="f"><span>${String(label)}</span><select data-special="${String(k)}"><option value="">Choose…</option>${raw(opts.map(([v, l]) => screen`<option value="${String(v)}" ${raw(s[k] === v ? "selected" : "")}>${raw(e(l))}</option>`).join(""))}</select></label>`;

const formCheck = (s, k, l) => screen`<label><input type="checkbox" data-special="${String(k)}" ${raw(s[k] ? "checked" : "")}> ${raw(e(l))}</label>`;

const formTools = (s) => ({
  f: (k, label, type) => formField(s, k, label, type),
  sel: (k, label, opts) => formSelect(s, k, label, opts),
  ck: (k, l) => formCheck(s, k, l),
});

function allItemDetails(d, s) {
  const { f, sel } = formTools(s);
  const family =
    d.administrativeAction && !d.correction
      ? sel(
          "administrativeType",
          "Document family",
          NEW_TYPES.map((t) => [t.id, t.label]),
        )
      : "";
  return screen`<section class="card no-print" id="r26-details"><div class="card-h"><h2>${raw(e(specialType(d.type).label))} details</h2></div><div class="card-b">${raw(
    d.type === "bestInterestExtension"
      ? screen`<p class="hint">Every uncorrected item is extended. Enter or change each due date in Violation items.</p>${raw(family)}${raw(f("reason", "Reasons for Additional Time", "textarea"))}`
      : screen`<p class="hint">Every uncorrected item is extended while the property remains vacant; uncorrected items have no due date. Corrected items keep their dates.</p><div class="grid g2">${raw(family)}${raw(
          sel("scope", "Scope", [
            ["building", "Entire building"],
            ["unit", "Apartment / unit"],
          ]),
        )}${raw(s.scope === "unit" ? f("unit", "Apartment / unit identifier") : "")}${raw(f("reviewDate", "Next scheduled review inspection", "date"))}</div>`,
  )}</div></section>`;
}

function simplifiedDetails(d, s) {
  const { f, ck } = formTools(s);
  return screen`<section class="card no-print" id="r26-details"><div class="card-h"><h2>Best Interest Extension details</h2></div><div class="card-b"><p class="hint">Select affected items and enter later deadlines in Violation items. Other items retain their dates.</p>${raw(f("reason", "Reasons for Additional Time", "textarea"))}${raw(ck("noSafety", "Affected items exclude safety, security and urgent obligations"))}</div></section>`;
}

function leadFields(d, s) {
  const { f, sel } = formTools(s);
  return (
    (d.importRule
      ? screen`<p class="f"><span>Document from the Accela status</span><strong>${raw(e(d.importRule.label))}</strong> (Initial Inspection status ${raw(e(d.importRule.status))})</p>`
      : d.initialAction
        ? screen`<label class="f"><span>Initial inspection action</span><select data-initial-action><option value="notice">Official Notice</option>${raw(
            NEW_TYPES.filter((t) => t.effect === "supplemental")
              .map((t) => screen`<option value="${String(t.id)}" ${raw(d.type === t.id ? "selected" : "")}>${String(t.label)}</option>`)
              .join(""),
          )}</select></label>`
        : "") +
    (d.administrativeAction
      ? sel(
          "administrativeType",
          "Document family",
          NEW_TYPES.map((t) => [t.id, t.label]),
        )
      : "") +
    sel("scope", "Scope", [
      ["building", "Entire building"],
      ["unit", "Apartment / unit"],
    ]) +
    (s.scope === "unit" ? f("unit", "Apartment / unit identifier") : "")
  );
}

function abatementFields(d, s) {
  const { f, sel, ck } = formTools(s);
  let fields = "";
  fields +=
    sel(
      "variant",
      "Nuisance preset",
      NUISANCES.filter((v) => d.type === "summaryAbatement" || v[0] !== "secure"),
    ) +
    f("findings", "Specific findings and locations", "textarea") +
    f("work", "Required corrective work", "textarea");
  fields +=
    d.type === "summaryAbatement"
      ? f("summaryBasis", "Factual basis for immediate summary action", "textarea")
      : f("orderDue", "Order compliance date", "date") +
        f("servicePlan", "Service / publication plan", "textarea") +
        ck("remedyReviewed", "Circuit Court remedy reviewed against current code");
  if (s.variant === "custom") fields += f("customReviewRef", "Custom authority and wording approval");
  if (s.variant === "tree")
    fields +=
      f("forestryRef", "Forestry report / factual assessment") + ck("removeTree", "Tree removal ordered: flush with ground and dispose of branches");
  if (s.variant === "secure")
    fields +=
      f("securingConditions", "Required securing, animals and materials conditions", "textarea") +
      ck("boarding", "Boarding is required") +
      (s.boarding ? f("boardingRef", "Prior written boarding approval") : "");
  return fields;
}

function noOccupancyFields(d, s, date) {
  const { f, sel, ck } = formTools(s);
  let fields = "";
  fields +=
    sel("mode", "Action", [
      ["restrict", "Restrict human habitation"],
      ["release", "Documented written release"],
    ]) + f("effective", "Effective date", "date");
  if (s.mode === "release")
    fields +=
      sel(
        "releases",
        "Restriction being released",
        activeRestrictions(docsFor(d.caseId)).map((x) => [x.id, scope(x, x.special) + " · " + date(x.special.effective)]),
      ) +
      f("releaseInspection", "Verified reinspection date", "date") +
      f("releaseFacts", "Corrections and reinspection record", "textarea") +
      ck("placardRemoved", "Placard actually removed") +
      f("removalDate", "Actual placard removal date", "date") +
      f("releaseFormRef", "Approved written release form / procedure") +
      sel("releaseVisitId", "Verified physical reinspection", [
        ...reinspFor(d.caseId)
          .filter((r) => !r.draft)
          .map((r) => [r.id, date(r.date) + " · " + insp(r.inspectorId).name]),
        ["external", "Verified external inspection not recorded here"],
      ]) +
      (s.releaseVisitId === "external"
        ? f("releaseInspectionRef", "Verified external reinspection record reference") +
          sel(
            "releaseInspectorId",
            "Inspector who performed release reinspection",
            INSPECTORS.map((i) => [i.id, i.name]),
          ) +
          f("releaseInspectionTime", "Actual reinspection time (if known)", "time")
        : "");
  else
    fields +=
      f("findings", "Restriction findings", "textarea") +
      f("releaseConditions", "Required release conditions", "textarea") +
      sel("posting", "Posting status", [
        ["posted", "Actually posted"],
        ["pending", "Posting pending"],
      ]) +
      (s.posting === "posted" ? f("postedDate", "Actual posting date", "date") : f("prePostingRef", "Approved pre-posting order procedure")) +
      f("access", "Approved access conditions (optional)", "textarea");
  return fields;
}

function extensionFields(d, s, rowAffectedSelection) {
  const { f, sel, ck } = formTools(s);
  let fields = "";
  fields +=
    (rowAffectedSelection(d)
      ? '<p class="hint">Select affected items and enter their new due dates in Violation items. Other items keep their original dates.</p>'
      : screen`<fieldset class="r26-items"><legend>Affected outstanding items</legend>${raw(
          d.items
            .filter((i) => !i.done && !i.withdrawn)
            .map(
              (i) =>
                screen`<label><input type="checkbox" data-special-item="${raw(e(i.no))}" ${raw((s.affected || []).includes(String(i.no)) ? "checked" : "")}> Item ${raw(e(i.no))} · ${raw(e(i.title || i.text.slice(0, 60)))}</label>${raw(
                  (s.affected || []).includes(String(i.no)) &&
                    !datedExtension(d) &&
                    (d.type === "bestInterestExtension" || s.deadlineMode === "dated")
                    ? screen`<label class="f"><span>Extended deadline for item ${raw(e(i.no))}</span><input type="date" data-special-due="${raw(e(i.no))}" value="${raw(e(i.due || ""))}"></label>`
                    : "",
                )}`,
            )
            .join(""),
        )}</fieldset>`) +
    ck("noSafety", "Affected items exclude safety, security and urgent obligations") +
    f("safetyBasis", "Reviewed factual basis for excluding safety items", "textarea");
  if (d.type === "bestInterestExtension")
    fields +=
      f("noticeRef", "Prior Official Notice reference") +
      f("reason", "Reasons for additional time", "textarea") +
      f("intentions", "Owner’s intended corrective work", "textarea") +
      f("supervisor", "Supervisory reviewer") +
      sel("stage", "Actual internal review stage", [
        ["administrative", "Administrative extension review"],
        ["supervisory", "Internal supervisory prosecution review"],
      ]) +
      (s.stage === "supervisory" ? ck("prosecutionClause", "Approved prosecution consequence applies") : "");
  else
    fields +=
      f("requestRef", "Extension request reference") +
      f("vacancyFacts", "Verified vacancy basis", "textarea") +
      f("conditions", "Approved continuing conditions", "textarea") +
      f("reviewDate", "Next scheduled review inspection", "date") +
      (datedExtension(d)
        ? ""
        : sel("deadlineMode", "Repair deadline model", [
            ["dated", "Specific repair deadlines"],
            ["conditional", "Conditional; no replacement repair dates"],
          ])) +
      sel("expiryMode", "Expiration / review model", [
        ["fixed", "Fixed expiration"],
        ["review", "Reviewed at next inspection"],
      ]) +
      (s.expiryMode === "fixed" ? f("expiryDate", "Separate extension expiration", "date") : "") +
      f("expiryPolicyRef", "Approved expiration / review policy") +
      f("shortNoticeRef", "Approved short-notice procedure (if needed)") +
      f("transferClause", "Reviewed sale / transfer and applicable disclosure wording", "textarea");
  return fields;
}

function supplementalFields(d, s) {
  let fields = "";
  fields += screen`<fieldset class="r26-items"><legend>Referenced source items (optional)</legend>${raw(
    d.items
      .map(
        (i) =>
          screen`<label><input type="checkbox" data-special-item="${raw(e(i.no))}" ${raw((s.affected || []).includes(String(i.no)) ? "checked" : "")}> Item ${raw(e(i.no))} · ${raw(e(i.title || "Source violation"))}</label>`,
      )
      .join(""),
  )}</fieldset>`;
  return fields;
}

function reviewFields(s) {
  const { f, ck } = formTools(s);
  return (
    f("authority", "Verified ordinance authority") +
    f("codeSource", "Verified current-code source URL / official reference") +
    f("codeRevision", "Code revision / effective information and amendment review") +
    f("reviewer", "Division reviewer") +
    f("reviewDateLegal", "Current-code review date", "date") +
    f("reviewRef", "Approved ordinance, wording and procedure reference", "textarea") +
    f("signerName", "Authorized signer name") +
    f("signerTitle", "Authorized signer title") +
    f("delegation", "Authorization / delegation reference") +
    ck("reviewed", "Division review confirms this variant, wording, procedure and authority")
  );
}

function detailsShell(d, fields, review) {
  return screen`<section class="card no-print" id="r26-details"><div class="card-h"><h2>${raw(e(specialType(d.type).label))} details</h2></div><div class="card-b"><p class="hint">Drafts can be saved unfinished. Issuance requires recorded division review of current law, wording and signer authority. Review entries are supplied by the operator; they are not authenticated role checks.</p><div class="grid g2">${raw(
    d.type === "bestInterestExtension"
      ? '<div class="banner">This draft retains the earlier reviewed extension format. <button class="btn" data-adopt-best-interest>Use simplified Reasons-only format (no signer)</button></div>'
      : "",
  )}${raw(fields)}</div><details><summary>Authority, wording and signer review</summary><div class="grid g2">${raw(review)}</div></details></div></section>`;
}

/* Eligibility of a recorded inspection for a scoped action, and the lifecycle checks built on it. */
// R62: on a referred case only Update for Case Referral and Compliance Letter are offered.
function referredOnly(referred, list) {
  return referred ? list.filter((c) => ["referralUpdate", "compliance"].includes(c[0])) : list;
}
function allowedByStatus(r) {
  return r.importRule ? r.importRule.choose || [r.importRule.doc] : null;
}
function statusFault(r, type) {
  const rule = r.importRule;
  if (!rule) return "";
  if (!allowedByStatus(r).includes(type)) return "The Accela status " + rule.status + " calls for " + rule.label + ".";
  const open = openItems(r);
  if (rule.allCorrected && open.length)
    return (
      "The Accela status is " +
      rule.status +
      ", but item" +
      (open.length > 1 ? "s " : " ") +
      open.map((i) => i.no).join(", ") +
      (open.length > 1 ? " are" : " is") +
      " not marked Corrected. Correct the results, or correct the status in Accela and import this inspection again."
    );
  if (rule.cite && !open.some((i) => r.results[i.id]?.cite))
    return "The Accela status is Citation, but no item is marked for citation. Mark the items to cite, or correct the status in Accela and import this inspection again.";
  return "";
}
function eligibility(r, type) {
  const fault = statusFault(r, type);
  if (fault) return fault;
  const src = doc(r.sourceDocId),
    open = openItems(r),
    referred = isReferredCase(r.caseId);
  if (type === "notice") return "Official Notice is created from an initial imported inspection.";
  if (!src || !isEffective(src)) return "The inspection source is no longer effective.";
  const issued = docsFor(r.caseId).filter((d) => !d.draft && d.fromReinspId === r.id);
  if (issued.some((d) => d.type === type)) return "This inspection already has that action. Open the existing document.";
  if (!supplemental({ type }) && issued.some((d) => !supplemental(d)))
    return "This inspection already has a primary follow-up. Add a compatible scoped order.";
  if (referred && !["referralUpdate", "compliance"].includes(type)) return REFERRED_MESSAGE;
  if (type === "compliance" && open.length) return "Some violation items remain outstanding.";
  if (!supplemental({ type }) && type !== "compliance" && !open.length) return "No outstanding items for this action.";
  if (type === "citation" && !open.some((i) => r.results[i.id]?.cite)) return "Select the outstanding items to cite on the worksheet.";
  return "";
}

function lifecycleSourceFaults(services, d, src, r) {
  const faults = [];
  if (!src || !isEffective(src)) faults.push("The factual source is no longer effective.");
  const current = services.sourceDocFor(d.caseId);
  if (current && src && current.id !== src.id && !(supplemental(d) && r && current.fromReinspId === r.id))
    faults.push("The source changed. Review the current case before issuing.");
  if (d.administrativeAction && d.type !== "noOccupancy" && src?.type === "compliance")
    faults.push("A completed case cannot receive a new extension or ordinary enforcement action.");
  return faults;
}

function lifecycleVisitFaults(services, d, src, r) {
  const faults = [];
  if (r) {
    faults.push(...services.worksheetFaults(r));
    if (r.sourceDocId !== src?.id || d.inspDate !== r.date || d.inspTime !== r.time) faults.push("The action must match its recorded inspection.");
  } else if (!d.administrativeAction) faults.push("Select the actual inspection for this action.");
  if (src && stableJSON(d.items.map((i) => [i.srcItemId, i.no])) !== stableJSON(src.items.map((i) => [i.id, i.no])))
    faults.push("Retain every source item identity, number and order.");
  if (r) {
    const why = eligibility(r, d.type);
    if (why) faults.push(why);
  }
  return faults;
}

function lifecycleFaults(services, d, src, r) {
  const faults = [];
  if (stableJSON(d.expectedHead) !== stableJSON(recordHead(d.caseId)))
    faults.push("The case changed after this draft began. Review the current case before issuing.");
  if (d.initialAction) {
    if (docsFor(d.caseId).some((x) => isEffective(x) && !supplemental(x))) faults.push("Use the current issued case facts for this action.");
  } else faults.push(...lifecycleSourceFaults(services, d, src, r), ...lifecycleVisitFaults(services, d, src, r));
  return faults;
}

/* Click actions in priority order: the first whose attribute is present on the element handles it. */
const CLICK_TARGETS =
  "[data-create-action],[data-another-action],[data-case-action],[data-save-service],[data-create-case-action],[data-initial-notice],[data-adopt-best-interest]";

function adoptCurrentBestInterest({ services, restoreDues }) {
  const d = doc(editor.state.docId);
  if (d?.type === "bestInterestExtension" && d.draft && !services.isLocked(d) && !d.correction && !d.pendingAmendment) {
    // R62: adoption moves to the current all-item format (Reasons, no safety confirmation or signer).
    d.authoringVersion = ALL_ITEM_EXTENSIONS;
    restoreDues(d);
    // Keep earlier review data for recovery; it is not asserted as new authorization.
    services.saveDrafts();
    services.render();
    document.querySelector('[data-special="reason"]')?.focus();
  }
}

function startNoticeFromInitial({ services, el }) {
  const src = doc(el.dataset.initialNotice);
  if (src && !originalNotice(src.caseId) && !draftDocFor(src.caseId)) {
    services.newDoc(src.caseId, "notice");
    const d = doc(editor.state.docId);
    d.items = src.items.map((i) => ({ ...clone(i), id: services.uid("x"), srcItemId: i.id }));
    services.saveDrafts();
    services.render();
  }
}

function createCurrentCaseAction({ caseAction }) {
  const c = editor.WORK.currentAction;
  if (c?.type) caseAction(c.cid, c.type);
}

function createWorksheetAction({ services, createSpecial }) {
  const r = reinsp(editor.state.reinspId);
  if (r && r.followupIntent) {
    if (specialType(r.followupIntent)) createSpecial(r, r.followupIntent);
    else services.docFromReinspection(r, r.followupIntent);
  }
}

function showAnotherAction({ services, el }) {
  const r = reinsp(el.dataset.anotherAction);
  if (r) {
    editor.state.reinspId = r.id;
    editor.state.screen = "actions";
    services.render();
  }
}

const CLICK_ACTIONS = [
  [(el) => el.hasAttribute("data-adopt-best-interest"), adoptCurrentBestInterest],
  [(el) => el.dataset.initialNotice, startNoticeFromInitial],
  [(el) => el.hasAttribute("data-create-case-action"), createCurrentCaseAction],
  [(el) => el.dataset.saveService, ({ el, saveService }) => saveService(el.dataset.saveService)],
  [(el) => el.hasAttribute("data-create-action"), createWorksheetAction],
  [(el) => el.dataset.anotherAction, showAnotherAction],
  [(el) => el.dataset.caseAction, ({ el, caseAction }) => caseAction(el.dataset.caseAction)],
];

export function initNewDocuments(services) {
  /* R56 usability: an editable authoring-13 Best Interest or Vacancy draft selects its affected items in the items
   table, beside each due date (data-special-item); special.affected remains the source of truth. */
  const rowAffectedSelection = (d) => datedExtension(d) && !allItemExtension(d) && !services.isLocked(d) && !d.correction;
  const day = () => recordDay(today);
  const date = (v) => services.fmtDate(v) || "◯";
  function continuingItems(source, visits = reinspFor(source.caseId)) {
    return continuingItemsForVisits(source, visits);
  }
  function restoreDues(d) {
    syncAffected(d);
    const s = d.special || {},
      dated = d.type === "bestInterestExtension" || (d.type === "vacancyExtension" && s.deadlineMode === "dated");
    if (simpleVacancy(d)) {
      // Uncorrected items print no due date; their source deadlines stay in originalDues.
      d.items.forEach((i) => (i.due = !i.done && !i.withdrawn ? "" : (s.originalDues?.[i.no] ?? i.due)));
      return;
    }
    d.items.forEach((i) => {
      i.due = dated && (s.affected || []).includes(String(i.no)) && s.extendedDues?.[i.no] ? s.extendedDues[i.no] : (s.originalDues?.[i.no] ?? i.due);
    });
  }
  function refreshControls(el) {
    const attr = [...el.attributes].find((a) => a.name.startsWith("data-")),
      selector = attr ? "[" + attr.name + '="' + checkAttr(attr.value) + '"]' : null,
      wasOpen = !!document.querySelector("#r26-details details[open]");
    services.renderKeep();
    if (wasOpen) {
      const details = document.querySelector("#r26-details details");
      if (details) details.open = true;
    }
    if (selector) document.querySelector(selector)?.focus({ preventScroll: true });
  }
  function specialBody(d) {
    syncAffected(d);
    const s = d.special || {},
      type = d.type,
      at = services.inspAt(d),
      address = scope(d, s),
      items = selected(d, s);
    const refs = items.map((i) => i.no).join(", ") || "◯";
    const context = { d, s, type, at, address, items, refs, date };
    const build = NARRATIVE_BUILDERS.find(([applies]) => applies(context));
    const paras = build ? build[1](context) : [];
    if (alignedExtension(d)) return narrativeParagraphs(paras);
    itemReferenceParagraphs(context, paras);
    closingParagraphs(context, paras);
    return narrativeParagraphs(paras);
  }
  function specialChecks(d) {
    if (!specialType(d.type)) return [];
    syncAffected(d);
    const s = d.special || {},
      out = [],
      // Affected items are checkboxes (data-special-item), not data-special fields: beside each due date in the items
      // table for an editable authoring-13 draft, otherwise in the Affected outstanding items fieldset.
      outstanding = d.items.some((i) => !i.done && !i.withdrawn),
      affectedTarget = rowAffectedSelection(d)
        ? outstanding
          ? ".desk [data-special-item]"
          : ".desk table.notice"
        : outstanding
          ? "#r26-details [data-special-item]"
          : "#r26-details fieldset.r26-items",
      add = (ok, t, key, targets) =>
        out.push({
          ok: !!ok,
          t,
          targets: targets?.length ? targets : key ? [checkTarget(key === "affected" ? affectedTarget : '[data-special="' + key + '"]', t)] : [],
        });
    const need = (k, label) => add(text(s[k]) && !/◯|\(\s{0,8}\)/.test(s[k]), "Enter " + label + ".", k);
    const context = { d, s, out, add, need, services, selected, day, text };
    specialScopeReadiness(context);
    if (!d.correction && isReferredCase(d.caseId)) add(false, REFERRED_MESSAGE);
    specialFamilyReadiness(context);
    add(!/◯|\(\s{0,8}\)|class="blank"/.test(services.docBody(d)), "Fill every placeholder in the printed document before issuance.");
    return out;
  }
  function details(d) {
    if (!specialType(d.type) || services.isLocked(d) || (d.correction && !simplifiedBestInterest(d) && !allItemExtension(d))) return "";
    const s = d.special || (d.special = {});
    if (allItemExtension(d)) return allItemDetails(d, s);
    if (simplifiedBestInterest(d)) return simplifiedDetails(d, s);
    let fields = leadFields(d, s);
    if (["summaryAbatement", "nonSummaryAbatement"].includes(d.type)) fields += abatementFields(d, s);
    else if (d.type === "noOccupancy") fields += noOccupancyFields(d, s, date);
    else fields += extensionFields(d, s, rowAffectedSelection);
    if (supplemental(d) && d.items.length) fields += supplementalFields(d, s);
    return detailsShell(d, fields, reviewFields(s));
  }
  const groups = [
    ["time", "Give more time"],
    ["enforcement", "Take enforcement action"],
    ["occupancy", "Restrict occupancy"],
    ["compliance", "Confirm compliance"],
  ];
  function choices(r) {
    const referred = isReferredCase(r.caseId);
    return referredOnly(referred, [
      ["extension", "Extension", "time", "Allow more time for outstanding violations."],
      ["bestInterestExtension", "Best Interest Extension", "time", "Record a reviewed supervisory extension."],
      ["vacancyExtension", "Vacancy Extension", "time", "Grant time subject to verified vacancy and conditions."],
      ["citation", "Citation", "enforcement", "Create court citations for selected charge items."],
      [
        referred ? "referralUpdate" : "referral",
        referred ? "Update for Case Referral" : "Referral for Prosecution",
        "enforcement",
        "Prepare or update the City Attorney referral.",
      ],
      ["summaryAbatement", "Summary Abatement", "enforcement", "Order immediate nuisance abatement with reviewed authority."],
      ["nonSummaryAbatement", "Non-Summary Abatement", "enforcement", "Order nuisance abatement with a compliance date and Circuit Court remedy."],
      ["noOccupancy", "No Occupancy", "occupancy", "Restrict human habitation or document an approved release."],
      ["compliance", "Compliance Letter", "compliance", "Confirm correction of all active violation items."],
    ]);
  }
  function statusChooser(r) {
    const rule = r.importRule,
      allowed = allowedByStatus(r),
      list = choices(r).filter((c) => allowed.includes(c[0]));
    const picked = allowed.includes(r.followupIntent) ? r.followupIntent : allowed.length === 1 ? allowed[0] : "";
    if (picked !== (r.followupIntent || "")) {
      r.followupIntent = picked;
      r.actionGroup = (list.find((c) => c[0] === picked) || [])[2] || "";
    }
    const faults = picked ? [...services.worksheetFaults(r, picked), eligibility(r, picked)].filter(Boolean) : ["Choose the extension type."];
    const label = (DOC_TYPES.find((t) => t.id === picked) || {}).label || rule.label;
    return screen`<section class="card no-print r26-chooser" aria-label="Document from the Accela status"><div class="card-h"><h2>Document from the Accela status</h2></div><div class="card-b"><p>Accela status <strong>${raw(e(rule.status))}</strong> → ${raw(e(rule.label))}.</p>${raw(
      allowed.length > 1
        ? screen`<fieldset><legend>Choose the extension type</legend>${raw(
            list
              .map(
                (c) =>
                  screen`<label class="r26-choice"><input type="radio" name="action-type" data-action-type="${String(c[0])}" ${raw(picked === c[0] ? "checked" : "")}><span><strong>${raw(e(c[1]))}</strong><small>${raw(e(c[3]))}</small></span></label>`,
              )
              .join(""),
          )}</fieldset>`
        : "",
    )}<p aria-live="polite">${raw(
      picked ? e(label) + ": " + (faults.length ? e(faults[0]) : "Ready to create a draft. Review document details before issuance.") : e(faults[0]),
    )}</p><button class="btn btn-primary" data-create-action ${raw(faults.length ? "disabled" : "")}>Create draft</button></div></section>`;
  }
  function chooser(r) {
    if (r.importRule) return statusChooser(r);
    const saved = editor.WORK.actionChoices?.[r.id];
    if (saved && !r.draft) {
      r.followupIntent = saved.intent;
      r.actionGroup = saved.group;
    }
    const picked = r.followupIntent || "",
      list = choices(r),
      group = list.find((c) => c[0] === picked)?.[2] || r.actionGroup || "",
      faults = picked ? [...services.worksheetFaults(r, picked), eligibility(r, picked)].filter(Boolean) : ["Choose the next action."];
    const available = list.filter((c) => !eligibility(r, c[0])),
      options = available.filter((c) => c[2] === group);
    return screen`<section class="card no-print r26-chooser" aria-label="Choose next action"><div class="card-h"><h2>Choose next action</h2></div><div class="card-b"><p>Use this physical inspection for one primary follow-up and compatible additional scoped documents. Each document has its own review; adding one does not record another visit.</p><fieldset><legend>What should happen next?</legend><div class="r26-groups">${raw(
      groups
        .filter(([v]) => list.some((c) => c[2] === v))
        .map(
          ([v, l]) =>
            screen`<label class="r26-choice"><input type="radio" name="action-group" data-action-group="${String(v)}" ${raw(group === v ? "checked" : "")}> ${String(l)}</label>`,
        )
        .join(""),
    )}</div></fieldset>${raw(
      group
        ? screen`<fieldset><legend>Available documents</legend>${raw(
            ["primary", "supplemental"]
              .map((kind) => {
                const items = options.filter((c) => (supplemental({ type: c[0] }) ? "supplemental" : "primary") === kind);
                return items.length
                  ? screen`<h3 class="ri-action-heading">${raw(kind === "primary" ? "Primary follow-up" : "Additional scoped documents")}</h3>${raw(
                      items
                        .map(
                          (c) =>
                            screen`<label class="r26-choice"><input type="radio" name="action-type" data-action-type="${String(c[0])}" ${raw(picked === c[0] ? "checked" : "")}><span><strong>${raw(e(c[1]))}</strong><small>${raw(e(c[3]))}</small></span></label>`,
                        )
                        .join(""),
                    )}`
                  : "";
              })
              .join(""),
          )}${raw(
            !options.length
              ? screen`<p>No documents in this group are available for these results. Review the reasons below or choose another group.</p>`
              : "",
          )}</fieldset>`
        : "",
    )}<p aria-live="polite">${raw(
      picked
        ? e((DOC_TYPES.find((t) => t.id === picked) || {}).label) +
            ": " +
            (faults.length ? e(faults[0]) : "Ready to create a draft. Review document details before issuance.")
        : "No action selected. Your outcomes stay on this worksheet; check the save status before leaving.",
    )}</p><button class="btn btn-primary" data-create-action ${raw(faults.length ? "disabled" : "")}>Create draft</button><details><summary>All document types (10 families) / why unavailable</summary><ul><li>Official Notice — initial imported inspection only.</li>${raw(
      list
        .map(
          (c) =>
            screen`<li><strong>${raw(e(c[1]))}</strong> (${raw(supplemental({ type: c[0] }) ? "additional scoped document" : "primary follow-up")}): ${raw(e(eligibility(r, c[0]) || c[3]))}</li>`,
        )
        .join(""),
    )}</ul></details></div></section>`;
  }
  function createSpecial(r, type) {
    if (r.docId && doc(r.docId)?.draft) {
      editor.state.docId = r.docId;
      editor.state.screen = "write";
      services.render();
      return;
    }
    const why = eligibility(r, type),
      faults = services.worksheetFaults(r, type);
    if (why || faults.length) {
      services.toast(why || faults[0]);
      return;
    }
    const existing = draftDocFor(r.caseId);
    if (existing) {
      editor.state.docId = existing.id;
      editor.state.screen = "write";
      services.render();
      services.toast("Resume the unfinished document before starting another.");
      return;
    }
    const src = doc(r.sourceDocId),
      s = requireDated(type, clone(r.actionDetails?.[type] || {}), ALL_ITEM_EXTENSIONS);
    s.originalDues = Object.fromEntries(src.items.map((i) => [i.no, i.due || ""]));
    const extension = ["bestInterestExtension", "vacancyExtension"].includes(type),
      open = (i) => extension && (r.results[i.id] || {}).oc !== "corrected" && !i.done && !i.withdrawn;
    const d = {
      id: services.uid("d"),
      caseId: r.caseId,
      type,
      // R62: only the extension families change format; scoped orders keep authoring 13.
      authoringVersion: extension ? ALL_ITEM_EXTENSIONS : DATED_EXTENSIONS,
      draft: true,
      status: "Draft",
      created: day(),
      mailed: "",
      cc: "",
      cits: {},
      fromDocId: src.id,
      fromReinspId: r.id,
      expectedHead: recordHead(r.caseId),
      inspectorId: r.inspectorId,
      inspDate: r.date,
      inspTime: r.time,
      special: s,
      items: src.items.map((i) => {
        const res = r.results[i.id] || {};
        return {
          ...clone(i),
          id: services.uid("x"),
          srcItemId: i.id,
          // R62: like a normal Extension, Best Interest takes each uncorrected item's Next due date from the
          // worksheet; a Vacancy Extension prints no due date for uncorrected items.
          due: !open(i) ? i.due : type === "bestInterestExtension" ? (r.results[i.id] || {}).due || "" : "",
          done: res.oc === "corrected",
          doneOn: res.oc === "corrected" ? res.on || r.date : "",
          ...(["bestInterestExtension", "vacancyExtension"].includes(type)
            ? {
                note: res.oc !== "corrected" && String(res.note || "").trim() ? String(res.note).trim() : "",
                noteOn: res.oc !== "corrected" && String(res.note || "").trim() ? res.on || r.date : "",
              }
            : {}),
          cite: false,
        };
      }),
    };
    syncAffected(d);
    workspace.DOCS.unshift(d);
    if (r.draft) r.docId = d.id;
    editor.state.docId = d.id;
    editor.state.screen = "write";
    services.saveDrafts();
    services.render();
  }
  function specialLifecycle(d) {
    if (!specialType(d.type) || !d.draft || d.correction) return [];
    const src = doc(d.fromDocId),
      r = reinsp(d.fromReinspId);
    return lifecycleFaults(services, d, src, r).map((t) => ({ ok: false, t }));
  }
  function servicePanel(d) {
    if (d.type !== "nonSummaryAbatement" || d.draft || !isEffective(d)) return "";
    const records = d.serviceRecords || [],
      latest = records[records.length - 1],
      key = "service:" + d.id,
      form = editor.WORK.recordForms[key] || {},
      field = (k, l, type = "text") =>
        screen`<label class="f"><span>${String(l)}</span><input type="${String(type)}" data-service-field="${String(k)}" value="${raw(e(form[k] || ""))}"></label>`;
    return screen`<section class="card no-print"><div class="card-h"><h2>Service and court evidence</h2></div><div class="card-b"><p>Issuance does not establish service or publication. The remedy period is distinct from the order compliance date. Court restrictions and City abatement require separate external decisions.</p>${raw(
      latest
        ? screen`<p><strong>Latest recorded evidence:</strong> ${raw(e(latest.method))} on ${String(date(latest.date))} — ${raw(e(latest.reference))}${raw(latest.courtRestriction ? " · Court restriction: " + e(latest.courtReference) : "")}</p>`
        : "<p>No completed service / publication recorded.</p>",
    )}<fieldset class="grid g2" aria-label="Service evidence" ${raw(editor.state.publicationBusy === d.id ? "disabled" : "")}><label class="f"><span>Actual method</span><select data-service-field="method"><option value="">Choose…</option><option value="service" ${raw(form.method === "service" ? "selected" : "")}>Service</option><option value="publication" ${raw(form.method === "publication" ? "selected" : "")}>Publication</option></select></label>${raw(field("date", "Actual service / publication date", "date"))}${raw(field("reference", "Supporting record / evidence"))}${raw(field("courtReference", "Court restriction reference (if applicable)"))}</fieldset><button class="btn" ${raw(editor.state.publicationBusy === d.id ? "disabled" : "")} data-save-service="${raw(e(d.id))}">${raw(latest ? "Record corrected / additional evidence" : "Record completed service / publication")}</button></div></section>`;
  }
  async function saveService(docId) {
    const d = doc(docId),
      key = "service:" + docId,
      form = editor.WORK.recordForms[key] || {},
      old = (d?.serviceRecords || []).at(-1);
    if (
      !d ||
      !["service", "publication"].includes(form.method) ||
      !services.validISO(form.date) ||
      form.date < d.mailed ||
      form.date > day() ||
      text(form.reference).length < 10
    ) {
      services.toast("Enter the actual past service / publication date, method and supporting evidence.");
      return;
    }
    const attempt = {
      id: services.evid(),
      at: recordNow(d.caseId),
      by: kase(d.caseId).inspectorId,
      type: "document.served",
      payload: {
        docId,
        date: form.date,
        method: form.method,
        reference: form.reference,
        courtRestriction: !!text(form.courtReference),
        courtReference: form.courtReference || "",
        replacesService: old?.id || "",
        expectedHead: recordHead(d.caseId),
        lifecycle: 1,
      },
    };
    if (await services.commitRecordAttempt(d.caseId, attempt)) {
      delete editor.WORK.recordForms[key];
      services.saveDrafts();
      services.render();
    }
  }
  function releaseVisit(d) {
    const s = d.special || {};
    if (d.type !== "noOccupancy" || s.mode !== "release" || s.releaseVisitId !== "external") return null;
    d.releaseVisitIdentity = d.releaseVisitIdentity || services.uid("r");
    s.verifiedReleaseVisitId = d.releaseVisitIdentity;
    return {
      id: d.releaseVisitIdentity,
      caseId: d.caseId,
      sourceDocId: s.releases,
      purpose: "occupancyRelease",
      date: s.releaseInspection,
      time: s.releaseInspectionTime || "",
      inspectorId: s.releaseInspectorId,
      inspector: clone(insp(s.releaseInspectorId)),
      inspectionReference: s.releaseInspectionRef,
      scope: s.scope,
      unit: s.scope === "unit" ? s.unit : "",
      results: {},
      docId: d.id,
    };
  }
  function actionPanel(d) {
    if (services.snow.is(d)) return "";
    if (d.draft) return "";
    const restrictions = activeRestrictions(docsFor(d.caseId));
    return screen`${raw(servicePanel(d))}<section class="card no-print"><div class="card-b">${raw(
      restrictions.length
        ? screen`<p class="r26-restriction"><strong>Continuing No Occupancy restriction:</strong> ${raw(restrictions.map((x) => e(scope(x, x.special))).join("; "))}. Compliance and extension letters do not release it.</p>`
        : "",
    )}${raw(
      d.initialAction && !originalNotice(d.caseId) && isEffective(d)
        ? screen`<button class="btn" data-initial-notice="${raw(e(d.id))}">Create Official Notice from this initial inspection</button>`
        : "",
    )}${raw(
      d.fromReinspId && isEffective(d)
        ? screen`<button class="btn" data-another-action="${raw(e(d.fromReinspId))}">Add another document for this inspection</button>`
        : "",
    )}${raw(
      isEffective(d)
        ? screen`<button class="btn" data-case-action="${raw(e(d.caseId))}">Create a scoped order / administrative letter from current case facts</button>`
        : "",
    )}</div></section>`;
  }
  function caseAction(cid, type) {
    if (services.snow.isCase(kase(cid))) {
      services.toast("Snow cases offer only the snow citation. Import a new inspection or correct the issued citation.");
      return null;
    }
    if (type && isReferredCase(cid)) {
      services.toast(REFERRED_MESSAGE);
      return null;
    }
    if (!type) {
      editor.WORK.currentAction = { cid, type: "", group: "" };
      editor.state.screen = "caseactions";
      services.saveDrafts();
      services.render();
      return;
    }
    const pending = draftDocFor(cid);
    if (pending) {
      editor.state.docId = pending.id;
      editor.state.screen = "write";
      services.render();
      return;
    }
    const src = services.sourceDocFor(cid) || docsFor(cid).find(isEffective);
    if (!src) return;
    editor.state.modal = null;
    editor.state.screen = "write";
    const factual = reinspFor(cid)
      .filter((r) => !r.draft && r.sourceDocId === src.id)
      .sort((a, b) => b.date.localeCompare(a.date) || String(b.recordedAt || "").localeCompare(String(a.recordedAt || "")))[0];
    const d = {
      id: services.uid("d"),
      caseId: cid,
      type,
      draft: true,
      status: "Draft",
      created: day(),
      mailed: "",
      cc: "",
      cits: {},
      authoringVersion: ["bestInterestExtension", "vacancyExtension"].includes(type) ? ALL_ITEM_EXTENSIONS : DATED_EXTENSIONS,
      // Scoped orders retain authoring 13, so their version alone cannot date this new draft.
      // Seed current family defaults without upgrading any pre-existing draft's cached formats.
      authoringCache: Object.fromEntries(
        NEW_TYPES.map((family) => [
          family.id,
          ["bestInterestExtension", "vacancyExtension"].includes(family.id) ? ALL_ITEM_EXTENSIONS : DATED_EXTENSIONS,
        ]),
      ),
      administrativeAction: true,
      fromDocId: src.id,
      expectedHead: recordHead(cid),
      factualVisitId: factual?.id || "",
      inspectorId: factual?.inspectorId || docInsp(src).id,
      inspDate: factual?.date || services.inspAt(src).date,
      inspTime: factual?.time || services.inspAt(src).time,
      special: requireDated(type, { originalDues: Object.fromEntries(src.items.map((i) => [i.no, i.due || ""])) }, ALL_ITEM_EXTENSIONS),
      items: continuingItems(src).map((i) => ({ ...clone(i), id: services.uid("x"), srcItemId: i.id, cite: false })),
    };
    if (["bestInterestExtension", "vacancyExtension"].includes(type)) restoreDues(d);
    workspace.DOCS.unshift(d);
    editor.state.docId = d.id;
    services.saveDrafts();
    services.render();
  }
  function caseActionScreen() {
    const choice = editor.WORK.currentAction || {},
      k = kase(choice.cid),
      referred = isReferredCase(choice.cid),
      closed = services.sourceDocFor(choice.cid)?.type === "compliance";
    const why = (t) => (t.effect === "items" && closed ? "The case’s violations are complete." : "");
    if (referred)
      return services.shell(
        k.address || "Current case action",
        k.number || "",
        '<button class="btn" data-nav="cases">Workspace</button>',
        screen`<section class="card no-print r26-chooser"><div class="card-h"><h2>Choose next action from current case facts</h2></div><div class="card-b"><p>${raw(e(REFERRED_MESSAGE))} Import a CA Reinspection to write them.</p></div></section>`,
      );
    return services.shell(
      k.address || "Current case action",
      k.number || "",
      '<button class="btn" data-nav="cases">Workspace</button>',
      screen`<section class="card no-print r26-chooser"><div class="card-h"><h2>Choose next action from current case facts</h2></div><div class="card-b"><p>Administrative letters cite the actual existing inspection. New observations require a real recorded inspection. Existing restrictions continue until a documented release.</p><fieldset><legend>Action group</legend><div class="r26-groups">${raw(
        groups
          .filter((g) => g[0] !== "compliance")
          .map(
            ([v, l]) =>
              screen`<label class="r26-choice"><input type="radio" name="case-action-group" data-case-action-group="${String(v)}" ${raw(choice.group === v ? "checked" : "")}> ${String(l)}</label>`,
          )
          .join(""),
      )}</div></fieldset>${raw(
        choice.group
          ? screen`<fieldset><legend>Document</legend>${raw(
              NEW_TYPES.filter((t) => t.group === choice.group)
                .map(
                  (t) =>
                    screen`<label class="r26-choice"><input type="radio" name="case-action-type" data-case-action-type="${String(t.id)}" ${raw(choice.type === t.id ? "checked" : "")} ${raw(why(t) ? "disabled" : "")}><span>${raw(e(t.label))}${raw(why(t) ? screen`<small>${raw(e(why(t)))}</small>` : "")}</span></label>`,
                )
                .join(""),
            )}</fieldset>`
          : "",
      )}<button class="btn btn-primary" data-create-case-action ${raw(!choice.type ? "disabled" : "")}>Create draft</button></div></section>`,
    );
  }
  function cacheDetails(d) {
    const r = reinsp(d.fromReinspId);
    if (r) {
      r.actionDetails = r.actionDetails || {};
      r.actionDetails[d.type] = clone(d.special || {});
    }
  }
  function editEvent(ev) {
    const el = ev.target,
      d = doc(editor.state.docId),
      r = reinsp(editor.state.reinspId);
    if (editCaseAndVisitSelection(services, refreshControls, el, d, r)) return true;
    if (switchAdministrativeFamily(services, refreshControls, restoreDues, el, d)) return true;
    if (!d || services.isLocked(d) || !specialType(d.type)) return false;
    const s = d.special || (d.special = {});
    if (editScopedSpecialField({ services, refreshControls, restoreDues, specialBody, ev, el, d, s })) return true;
    if (editScopedSpecialItem({ services, refreshControls, restoreDues, invalidateSafety, cacheDetails, el, d, s })) return true;
    if (el.dataset.specialDue) {
      setSpecialDue(
        d,
        d.items.find((x) => String(x.no) === el.dataset.specialDue),
        el.value,
      );
      return true;
    }
    return false;
  }
  function invalidateSafety(d) {
    if (simplifiedBestInterest(d)) {
      (d.special ||= {}).noSafety = false;
      const box = document.querySelector('[data-special="noSafety"]');
      if (box) box.checked = false;
    }
    if (d.selectionCache?.bestInterestExtension) d.selectionCache.bestInterestExtension.noSafety = false;
  }
  function invalidateItemReview(d) {
    invalidateSafety(d);
    const s = d.special || (d.special = {});
    s.reviewed = false;
    document.querySelectorAll('[data-special="reviewed"]').forEach((box) => (box.checked = false));
    Object.values(d.selectionCache || {}).forEach((details) => (details.reviewed = false));
    if (d.selectionCache?.[d.type]) d.selectionCache[d.type] = clone(s);
    cacheDetails(d);
  }
  function setSpecialDue(d, item, value) {
    const s = d.special || (d.special = {});
    if (item) {
      item.due = value;
      s.extendedDues = s.extendedDues || {};
      s.extendedDues[item.no] = value;
      document.querySelectorAll('[data-special-due="' + checkAttr(String(item.no)) + '"]').forEach((input) => (input.value = value));
    }
    invalidateItemReview(d);
    services.scheduleDraftSave();
    services.refreshSheet();
  }
  function clickEvent(ev) {
    const el = ev.target.closest(CLICK_TARGETS);
    if (!el) return false;
    const action = CLICK_ACTIONS.find(([applies]) => applies(el));
    if (!action) return false;
    action[1]({ services, el, restoreDues, caseAction, saveService, createSpecial });
    return true;
  }
  function actionScreen() {
    const r = reinsp(editor.state.reinspId);
    return r
      ? services.shell(
          "Add document for this inspection",
          kase(r.caseId).number + " · " + date(r.date),
          '<button class="btn" data-nav="cases">Workspace</button>',
          chooser(r),
        )
      : services.screenCases();
  }
  return {
    rowAffectedSelection,
    releaseVisit,
    continuingItems,
    eligibility,
    specialBody,
    specialChecks,
    setSpecialDue,
    invalidateItemReview,
    details,
    chooser,
    createSpecial,
    specialLifecycle,
    actionPanel,
    caseAction,
    caseActionScreen,
    editEvent,
    clickEvent,
    actionScreen,
  };
}
