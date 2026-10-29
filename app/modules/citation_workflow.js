/* Citation editing, readiness and review consume existing pricing/history/authority services. */
import { dueDateSpacingConflicts } from "./deadline_assignment.js";
import { inspAt } from "./inspection_facts.js";
import { recordDay } from "../assets/shared.js";
import { stableJSON } from "./record_values.js";
import { CITFEES, DOCBODY } from "./document_types.js";
import { parseDate, parseTime, validISO } from "./calendar.js";
import { checkAttr, checkTarget, citSelector, countBlanks, esc as dep_esc, itemSelector, money, validMoney } from "./presentation_format.js";
import { correctionSource, docCase } from "./writer_queries.js";
import { distinctDues, dueItems, itemLibraryKey } from "./document_rules.js";
import {
  CITATION_POLICY,
  canonicalOrdinance,
  cents,
  courtCents,
  formatDeposit,
  policyAt,
  resolveCitationAmount,
  resolveOrdinance,
  respondentKey,
  tierLabel,
  tierOrdinal,
} from "./citation_policy.js";
const retainedDepositFields = [
  "amount",
  "base",
  "cc",
  "depositMode",
  "tier",
  "scheduleEntryId",
  "assessments",
  "pricedOn",
  "policyVersionHash",
  "depositSource",
  "measurements",
  "mandatoryAppearance",
  "overrideBasis",
];
function depositAmountContext({ c, i }, tier = c.tier || 1) {
  return {
    ordinance: c.ord,
    libraryItem: i ? itemLibraryKey(i) : "",
    entryId: c.scheduleEntryId,
    tier,
    date: c.pricedOn || c.issued,
    measurements: c.measurements || {},
  };
}
function matchingSchedule(ctx) {
  const { c, f, ordinal, pick } = ctx;
  if (f?.rule) {
    const result = resolveCitationAmount(depositAmountContext(ctx, ordinal));
    if (result.kind !== "priced" || money(result.base) !== money(c.base)) return false;
  } else if (!pick || money(pick.a) !== money(c.base)) return false;
  return cents(c.cc) === courtCents(c.pricedOn || c.issued);
}
// Rules are ordered refusal precedence. A terminal success deliberately skips later rules.
const depositRules = [
  { id: "ordinance", ok: ({ c }) => !!canonicalOrdinance(c.ord), message: () => "Choose one complete citation ordinance." },
  { id: "issue-date", ok: ({ c }) => !c.issued || validISO(c.issued), message: () => "Enter a valid citation issue date." },
  { id: "pricing-date-shape", ok: ({ c }) => !c.pricedOn || validISO(c.pricedOn), message: () => "Enter a valid pricing date." },
  { id: "edited-deposit", ok: ({ c }) => !c.depositEditInvalid, message: () => "Correct the deposit field before confirming." },
  { id: "reconfirmation", ok: ({ c }) => !c.reconfirmDeposit, message: () => "Re-confirm deposit after the charge or basis changed." },
  {
    id: "stale-weeds",
    ok: ({ c }) => !(canonicalOrdinance(c.ord) === "27.05(2)(s)" && /noxious\s+weeds/i.test(c.desc || "")),
    message: () => "27.05(2)(s) is Removal of Debris; it cannot print the stale weeds description.",
  },
  {
    id: "method",
    ok: (ctx) => {
      ctx.mode = ctx.c.depositMode || "schedule";
      return ["schedule", "base", "total"].includes(ctx.mode);
    },
    message: () => "Choose a deposit method.",
  },
  {
    id: "manual-source",
    ok: ({ c, mode }) => mode === "schedule" || String(c.depositSource || "").trim().length >= 10,
    message: () => "Record the approved schedule, court instruction or other authority (at least 10 characters).",
  },
  {
    id: "mandatory",
    applies: ({ c, d }) => c.mandatoryAppearance && d?.authoringVersion >= 8,
    terminal: true,
    ok: ({ c, i }) => {
      const f = resolveOrdinance(c.ord, i ? itemLibraryKey(i) : "", c.scheduleEntryId, c.pricedOn || c.issued);
      return f?.rule?.kind === "mandatory" && !c.amount;
    },
    message: () => "Mandatory appearance permits no deposit.",
  },
  {
    id: "positive-amount",
    ok: ({ c }) => validMoney(c.amount) && +c.amount > 0,
    message: () => "Enter a positive cash deposit with at most two decimal places.",
  },
  {
    id: "retained-correction",
    applies: (ctx) => {
      const { c, d, i, services } = ctx;
      ctx.original = d && i && services.citationPricing.unchangedCorrection(d, i, c);
      return !!ctx.original;
    },
    terminal: true,
    ok: ({ c, original }) => retainedDepositFields.every((key) => stableJSON(original[key]) === stableJSON(c[key])),
    message: () => "An unchanged charge retains its original deposit and pricing basis.",
  },
  {
    id: "override",
    applies: ({ c, d }) => d?.authoringVersion >= 9 && c.overrideBasis,
    ok: (ctx) => {
      const { services } = ctx;
      ctx.overrideFault = services.administration.overrideFault(ctx.c, ctx.d);
      return !ctx.overrideFault;
    },
    message: (ctx) => ctx.overrideFault,
  },
  {
    id: "calculated-method",
    applies: ({ c, d, mode }) => d?.authoringVersion >= 8 && mode !== "schedule" && !c.overrideBasis,
    ok: (ctx) => resolveCitationAmount(depositAmountContext(ctx)).kind !== "priced",
    message: () => "This charge has a calculated deposit. Use Scheduled deposit.",
  },
  {
    id: "required-pricing-date",
    applies: ({ d }) => d?.authoringVersion >= 7,
    ok: ({ c }) => validISO(c.pricedOn),
    message: () => "Enter a valid pricing date.",
  },
  { id: "effective-pricing-date", ok: ({ c }) => validISO(c.pricedOn || c.issued), message: () => "Enter a valid pricing date." },
  {
    id: "zero-base",
    ok: ({ c, d, mode }) => !(d?.authoringVersion >= 8 && mode !== "total" && cents(c.base) === 0 && !CITATION_POLICY.allowZeroBaseDeposits),
    message: () => "A zero forfeiture needs City Attorney approval",
  },
  {
    id: "approved-total",
    applies: ({ mode }) => mode === "total",
    terminal: true,
    ok: ({ c }) => !c.assessments,
    message: () => "An approved total must not retain a calculated assessment breakdown. Choose the deposit method again.",
  },
  {
    id: "base-and-costs",
    ok: ({ c }) =>
      validMoney(c.base) && validMoney(c.cc) && +c.cc >= CITFEES.ccMin && +c.cc <= policyAt(c.pricedOn || c.issued).fees.ccMaxCents / 100,
    message: () => "Enter a valid base deposit and court costs between $15 and $48.",
  },
  {
    id: "assessment-total",
    ok: ({ c, services }) => money(services.feeLines(c.base, c.cc, c.pricedOn || c.issued).total) === money(c.amount),
    message: () => "The deposit does not match its recorded base and assessments.",
  },
  {
    id: "tier-integer",
    applies: ({ mode }) => mode === "schedule",
    ok: ({ c }) => !(c.tierOverrideSource && String(c.tierOverrideSource).trim().length >= 10 && !/^[1-9]\d*$/.test(String(c.tierOverride || ""))),
    message: () => "An approved offense tier must be a positive whole number.",
  },
  {
    id: "tier-source",
    applies: ({ mode }) => mode === "schedule",
    ok: ({ c }) =>
      !((c.tierOverride && !String(c.tierOverrideSource || "").trim()) || (c.tierOverrideSource && String(c.tierOverrideSource).trim().length < 10)),
    message: () => "An approved tier override requires its recorded source (at least 10 characters).",
  },
  {
    id: "respondent",
    applies: ({ mode }) => mode === "schedule",
    ok: (ctx) => {
      const { c, d, i } = ctx;
      ctx.f = resolveOrdinance(c.ord, i ? itemLibraryKey(i) : "", c.scheduleEntryId, c.pricedOn || c.issued);
      ctx.ordinal = tierOrdinal(c.tier);
      ctx.pick = ctx.f?.tiers?.[Math.min(ctx.ordinal, ctx.f.tiers.length) - 1];
      return scheduleRespondent(d, ctx.f);
    },
    message: () => "Scheduled pricing needs the respondent name and mailing address, or an approved manual basis.",
  },
  {
    id: "scheduled-match",
    applies: ({ mode }) => mode === "schedule",
    ok: matchingSchedule,
    message: () => "No matching scheduled deposit. Correct the ordinance or enter an approved deposit and source.",
  },
  {
    id: "computed-tier",
    applies: ({ mode }) => mode === "schedule",
    ok: ({ c, ordinal }) => !(c.computedTier && ordinal !== c.computedTier && !c.tierOverrideSource),
    message: ({ c }) => "Expected tier " + tierLabel(c.computedTier) + ". Review the counted citations.",
  },
];
function scheduleRespondent(d, f) {
  return !(d && f && f.window !== "site" && f.window?.kind !== "site-season" && !respondentKey(docCase(d)));
}
function depositRuleFault(context) {
  for (const rule of depositRules) {
    if (rule.applies && !rule.applies(context)) continue;
    if (!rule.ok(context)) return rule.message(context);
    if (rule.terminal) return "";
  }
  return "";
}

/* Construction is inert; dependencies and the live date are read at operation time. */
function editCitationOrdinance(services, d, id, c, value, phase) {
  if (phase === "input") {
    if (!Object.prototype.hasOwnProperty.call(c, "ordEditingFrom")) c.ordEditingFrom = c.ord;
    c.ord = String(value || "");
    if (d.correction) d.correction.reviewed = false;
    return;
  }
  if (Object.prototype.hasOwnProperty.call(c, "ordEditingFrom")) c.ord = c.ordEditingFrom;
  delete c.ordEditingFrom;
  // Nothing priced, measured or approved for the previous charge carries over to the new one.
  if (services.changeCharge(d, id, value) && d.correction) d.correction.reviewed = false;
  return;
}

function rejectCitationFieldEdit(services, d, c, field, value) {
  if (["tierOverride", "tierOverrideSource"].includes(field) && !String(value || "").trim()) {
    delete c[field];
    services.citationPricing.refresh(d);
    return true;
  }
  if (field === "amount" && !(cents(value) > 0)) {
    c.depositEditInvalid = true;
    c.reconfirmDeposit = true;
    return true;
  }
  return false;
}

function editCitationDepositMode(services, d, id, c, value) {
  if (value !== "schedule" && c.resolvedVia && !c.resolvedVia.startsWith("approved-")) delete c.depositSource;
  delete c.assessments;
  if (value === "schedule") services.applyDeposit(d, id, c.ord);
  else {
    if (value === "base" && validMoney(c.base) && validMoney(c.cc)) {
      const lines = services.feeLines(c.base, c.cc, c.pricedOn || c.issued);
      c.amount = money(lines.total);
      c.assessments = lines.cents;
    }
    c.reconfirmDeposit = String(c.depositSource || "").trim().length < 10;
  }
}

function updateCitationFees(services, c, field) {
  if (["base", "cc"].includes(field) && c.depositMode !== "total") {
    const lines = validMoney(c.base) && validMoney(c.cc) ? services.feeLines(c.base, c.cc, c.pricedOn || c.issued) : null;
    if (lines) {
      c.amount = money(lines.total);
      c.assessments = lines.cents;
    } else c.reconfirmDeposit = true;
  }
}

function confirmEditedDepositBasis(services, d, c, field) {
  if (
    ["base", "cc", "amount", "depositSource"].includes(field) &&
    c.depositMode !== "schedule" &&
    !c.depositEditInvalid &&
    validMoney(c.amount) &&
    String(c.depositSource || "").trim().length >= 10 &&
    (c.depositMode === "total" || (validMoney(c.base) && validMoney(c.cc)))
  ) {
    delete c.reconfirmDeposit;
    c.resolvedVia = "approved-" + c.depositMode;
    c.pricedOn = services.citationPricingDate(c, d);
    c.policyVersionHash = CITATION_POLICY.versionHash;
  }
}

export function createCitationWorkflow(services) {
  function depositComplete(d) {
    return (
      !Object.keys(d.depositRequests || {}).length &&
      (d.items || []).filter((i) => i.cite && !i.withdrawn).every((i) => !citationDepositFault(d.cits?.[i.id] || {}, d, i))
    );
  }

  function initialCitationBody(d) {
    // R35: an initial-inspection citation replaces the Official Notice, so its letter carries the notice's order language.
    if (services.initialOrderCitation(d)) return DOCBODY.initialCitation;
    return DOCBODY.citation
      .replace(
        "<p>A reinspection found that the work on one or more items is incomplete" +
          ". Below is a list of items that need further work and your new due date." +
          "</p>",
        "<p>An inspection documented the violations listed below. The compliance " + "deadlines remain those in the Official Notice.</p>",
      )
      .replace("We are issuing a citation for the unfinished work.", "We are issuing a citation for the documented violation.")
      .replace(
        " We may also charge a $75.00 reinspection fee since the work is incomple" + "te. The $75.00 fee is separate from the citation amount.",
        "",
      );
  }

  function citationDepositFault(c, d = null, i = null) {
    return depositRuleFault({ c, d, i, services });
  }

  const scheduledOffenseNeeded = (c) =>
    !c.scheduleEntryId && CITATION_POLICY.entries.filter((e) => e.ordinance === canonicalOrdinance(c.ord)).length > 1;

  function editCitation(d, id, field, value, phase = "commit") {
    // R59: the different-charge ordinance input edits the same stored charge as the section select, and a
    // charge awaiting its deposit basis keeps an editable ordinance.
    if (field === "ordOther") field = "ord";
    const c = d.cits[id] || (field === "ord" ? d.depositRequests?.[id] : null);
    if (!c) return;
    if (["courtDate", "issued", "violDate"].includes(field)) value = parseDate(value) || String(value || "").trim();
    if (["courtTime", "violTime"].includes(field)) value = parseTime(value) || String(value || "").trim();
    if (field === "ord") return editCitationOrdinance(services, d, id, c, value, phase);
    if (c[field] === value) return;
    if (rejectCitationFieldEdit(services, d, c, field, value)) return;
    c[field] = value;
    if (field === "amount") delete c.depositEditInvalid;
    if (field === "issued") delete c.issuedAutomatic;
    if (field === "desc") c.descEdited = true;
    if (["violDate", "issued", "scheduleEntryId", "tierOverride", "tierOverrideSource"].includes(field)) services.citationPricing.refresh(d);
    if (field === "depositMode") editCitationDepositMode(services, d, id, c, value);
    updateCitationFees(services, c, field);
    confirmEditedDepositBasis(services, d, c, field);
    if (d.correction) d.correction.reviewed = false;
  }

  function commitCitationEdits(d) {
    for (const [id, c] of Object.entries(d?.cits || {}))
      if (Object.prototype.hasOwnProperty.call(c, "ordEditingFrom")) editCitation(d, id, "ord", c.ord);
  }

  function authoringChecks(d) {
    services.citationPricing.refresh(d);
    const out = [];
    let targetItem = null;
    const check = (ok, t, fields = []) =>
      out.push({
        ok,
        t,
        ...(targetItem && fields.length
          ? { targets: fields.map((f) => checkTarget(citSelector(targetItem.id, f), "Item " + targetItem.no + " · " + f)) }
          : {}),
      });
    if (["notice", "extension", "citation"].includes(d.type))
      check(distinctDues(dueItems(d)).length <= 3, "Use no more than three distinct due dates for outstanding items.");
    if (["notice", "extension", "citation"].includes(d.type)) {
      const close = dueDateSpacingConflicts(dueItems(d)).filter(
        (pair) => !d.correction || pair.items.some((i) => !services.unchangedCorrectionValue(d, i.id, "due")),
      );
      const items = [...new Map(close.flatMap((pair) => pair.items).map((i) => [i.id, i])).values()];
      out.push({
        ok: close.length === 0,
        t: close.length ? "Keep distinct due dates at least seven days apart." : "Distinct due dates are at least seven days apart.",
        ...(items.length ? { targets: items.map((i) => checkTarget(itemSelector(i.id, "due"), "Item " + i.no + " · due date")) } : {}),
      });
    }
    if (d.type === "notice" && !d.correction) {
      const keys = d.items.map(itemLibraryKey).filter(Boolean);
      check(new Set(keys).size === keys.length, "Each library item can appear only once on an original notice. Remove duplicate items.");
    }
    if (d.type === "citation") check(depositComplete(d), "Citation needs deposit. Complete the required deposit step.");
    if (d.type === "citation")
      check(!services.citationPricing.historyFault(d), services.citationPricing.historyFault(d) || "Shared citation history has been checked.");
    if (d.type === "citation")
      d.items
        .filter((i) => i.cite && !i.withdrawn)
        .forEach((i) => {
          const c = (d.cits || {})[i.id] || {},
            prefix = "Citation for item " + i.no + ": ",
            old = correctionSource(d),
            original = old && (old.cits || {})[i.id];
          targetItem = i;
          const request = d.depositRequests?.[i.id];
          if (request) {
            out.push({
              ok: false,
              t:
                prefix +
                (services.choosesCharge(i) && !String(request.ord || "").trim()
                  ? "choose the charged ordinance from its sections."
                  : scheduledOffenseNeeded(request)
                    ? "choose the scheduled offense in Citation review."
                    : !canonicalOrdinance(request.ord)
                      ? "choose one complete ordinance and complete the approved deposit basis in Citation review."
                      : request.measurementFields?.length
                        ? "complete the required measurements in Citation review."
                        : "complete the approved deposit basis in Citation review."),
              targets: [
                checkTarget(
                  '[data-deposit-form="' +
                    checkAttr(i.id) +
                    '"] ' +
                    (request.measurementFields?.length
                      ? '[name^="measure-"]'
                      : canonicalOrdinance(request.ord) && scheduledOffenseNeeded(request)
                        ? '[name="scheduleEntryId"]'
                        : '[name="ord"]'),
                  "Item " + i.no + " · complete charge",
                ),
              ],
            });
            return;
          }
          check(
            !c.mandatoryAppearance,
            prefix +
              ("mandatory-appearance citations need division-approved defendant instruct" +
                "ions. Your draft is retained; ask the division to approve the wording be" +
                "fore issuance."),
            ["ord"],
          );
          check(!i.done, prefix + "only outstanding violations may be cited.");
          const unchosen = services.choosesCharge(i) && !String(c.ord || "").trim();
          check(
            !unchosen && !!canonicalOrdinance(c.ord),
            prefix + (unchosen ? "choose the charged ordinance from its sections." : "enter one complete ordinance number, not a list of sections."),
            ["ord"],
          );
          check(
            !services.citationPricing.chargeFault(d, i, c),
            prefix + (services.citationPricing.chargeFault(d, i, c) || "charge matches the current item."),
            ["ord", "differentChargeSource"],
          );
          check(
            !["desc", "comment", "statute", "deptId"].some((k) => countBlanks(String(c[k] || ""))),
            prefix + "complete all placeholder details in the citation fields.",
            ["desc", "comment"],
          );
          check(!citationDepositFault(c, d, i), prefix + (citationDepositFault(c, d, i) || "deposit and its basis agree."), [
            "depositMode",
            "ord",
            ...(c.depositMode === "total" ? ["amount"] : c.depositMode === "base" ? ["base", "cc"] : []),
            ...(c.depositMode && c.depositMode !== "schedule" ? ["depositSource"] : []),
          ]);
          check(!!parseTime(c.courtTime), prefix + "enter a valid court time in Citation review.", ["courtTime"]);
          check(!!parseTime(c.violTime || inspAt(d).time), prefix + "enter the inspection/violation time.", ["violTime"]);
          check(
            validISO(c.violDate || inspAt(d).date) &&
              (c.violDate || inspAt(d).date) >= (docCase(d).date || "") &&
              (c.violDate || inspAt(d).date) <= (c.issued || ""),
            prefix + "the violation date must be on or before issuance.",
            ["violDate"],
          );
          check(validISO(c.issued) && c.issued <= recordDay(services.today), prefix + "the issue date must be no later than today.", ["issued"]);
          check(
            validISO(c.issued) &&
              c.issued === (d.correction ? d.correction.actionDate : d.authoringVersion >= 9 ? d.revision?.actionDate || d.mailed : d.mailed),
            prefix +
              (d.correction
                ? "the issue date must match the original action date used in reports."
                : "the issue date must match this document’s mailed date."),
            ["issued"],
          );
          check(validISO(c.courtDate) && c.courtDate > c.issued, prefix + "the court date must follow issuance.", ["courtDate"]);
          check(/^[A-Za-z0-9-]+$/.test(c.num || ""), prefix + "use a citation number containing letters, numbers or hyphens.", ["num"]);
          if (original) check(c.num === original.num, prefix + "a correction retains the original citation number.", ["num"]);
        });
    return out;
  }

  function citationReview(d) {
    services.citationPricing.refresh(d);
    services.citationPricing.ensureShared(d);
    if (services.initialCitations.enabled(d)) d = services.initialCitations.preview(d);
    if (d.type !== "citation" || services.isLocked(d)) return "";
    services.citationPricing.refresh(d);
    const esc = dep_esc;
    const field = (i, c, key, label, type = "text", extra = "") =>
      '<label class="f"><span>' +
      `${label}` +
      '</span><input type="' +
      `${type}` +
      '" data-review-cit="' +
      `${esc(i.id)}` +
      "|" +
      `${key}` +
      '" aria-label="' +
      `${label}` +
      " for item " +
      `${esc(i.no)}` +
      '" value="' +
      `${esc(c[key] ?? "")}` +
      '" ' +
      `${extra}` +
      "></label>";
    // R59: several sections → a select of exactly those sections with no default; the different-charge path stays secondary.
    const chargeSelect = (i, c, readonly) => {
      const choices = services.chargeChoices(i),
        chosen = canonicalOrdinance(c.ord) || String(c.ord || "").trim(),
        listed = choices.some((x) => x.value === chosen);
      return (
        '<label class="f"><span>Ordinance</span><select data-review-cit="' +
        esc(i.id) +
        '|ord" aria-label="Ordinance for item ' +
        esc(i.no) +
        '" ' +
        (readonly ? "disabled" : "") +
        '><option value="">Choose the charged ordinance</option>' +
        choices
          .map((x) => '<option value="' + esc(x.value) + '" ' + (listed && x.value === chosen ? "selected" : "") + ">" + esc(x.label) + "</option>")
          .join("") +
        "</select></label>" +
        field(
          i,
          { ordOther: listed ? "" : c.ord || "" },
          "ordOther",
          "Different charge — ordinance outside the item’s sections",
          "text",
          readonly ? "readonly" : "",
        )
      );
    };
    const detail = (key, label, body, open = false) =>
      '<details data-review-details="' +
      `${key}` +
      '" ' +
      `${open ? "open" : ""}` +
      "><summary>" +
      `${label}` +
      '</summary><div class="charge-detail-body">' +
      `${body}` +
      "</div></details>";
    const cards = d.items
      .filter((i) => i.cite && !i.withdrawn)
      .map((i) => {
        const request = d.depositRequests?.[i.id],
          c = d.cits?.[i.id] || request;
        if (!c) return "";
        const mode = c.depositMode || "schedule",
          fault = request ? request.reason : citationDepositFault(c, d, i),
          determined = !request && services.citationPricing.determined(d, i, c);
        const held = !!c.mandatoryAppearance,
          status = request ? "Completion required" : held ? "Wording approval required" : fault ? "Review required" : "Deposit ready";
        const result = request ? "Deposit incomplete" : held ? "Mandatory appearance" : formatDeposit(c.amount);
        const summary =
          '<div class="charge-overview"><div><span class="charge-ordinance">' +
          `${esc(c.ord || "Choose an ordinance")}` +
          '</span><p class="charge-description">' +
          `${esc(c.desc || i.title || "Citation")}` +
          '</p><span class="hint">' +
          `${esc(c.num || "Citation number pending")}` +
          " · " +
          `${esc(c.tier || "1st")}` +
          ' offense</span></div><div class="charge-result"><strong>' +
          `${esc(result)}` +
          "</strong><span>" +
          `${esc(status)}` +
          '</span></div><div class="charge-session"><span class="hint">Court sessio' +
          "n</span><strong>" +
          `${esc(c.courtDate ? services.fmtDate(c.courtDate) : "Date required")}` +
          " · " +
          `${esc(c.courtTime || "Time required")}` +
          '</strong><span class="hint">Suggested session; confirm the court-approve' +
          "d schedule.</span></div></div>";
        let body = "";
        if (request) {
          body = services.depositStep.form(d, i, request);
        } else {
          const entries = CITATION_POLICY.entries.filter((e) => e.ordinance === canonicalOrdinance(c.ord));
          const chargeFields =
            "" +
            "".concat(
              services.choosesCharge(i)
                ? '<p class="hint">Item sections: ' +
                    esc(i.sections.join(", ")) +
                    ". Choose the one ordinance charged; a charge outside these sections needs its approved source.</p>"
                : "",
            ) +
            '<div class="grid g2">' +
            `${services.choosesCharge(i) ? chargeSelect(i, c, services.snow.is(d)) : field(i, c, "ord", "Ordinance", "text", services.snow.is(d) ? "readonly" : "")}` +
            "" +
            `${field(i, c, "differentChargeSource", "Different charge — approved source / confirmation")}` +
            "" +
            "".concat(
              entries.length > 1
                ? '<label class="f"><span>Scheduled offense</span><select data-review-cit="' +
                    `${esc(i.id)}` +
                    '|scheduleEntryId" aria-label="Scheduled offense for item ' +
                    `${esc(i.no)}` +
                    '"><option value="">Choose the charged offense</option>' +
                    "".concat(
                      entries
                        .map((e) => `<option value="${esc(e.id)}" ${c.scheduleEntryId === e.id ? "selected" : ""}>${esc(e.description)}</option>`)
                        .join(""),
                    ) +
                    "</select></label>"
                : "",
            ) +
            "" +
            `${field(i, c, "desc", "Violation description")}` +
            "" +
            `${field(i, c, "num", "Citation number", "text", d.correction ? "readonly" : "")}` +
            "" +
            "".concat(field(i, c, "comment", "Violation comment / inspection history", "text", services.snow.is(d) ? "readonly" : "")) +
            "" +
            `${field(i, c, "statute", "Adopted state statute (if applicable)")}` +
            "" +
            `${field(i, c, "deptId", "Officer ID")}` +
            "" +
            `${field(i, c, "courtDate", "Court date", "date")}` +
            "" +
            `${field(i, c, "courtTime", "Court time", "time")}` +
            "" +
            `${field(i, c, "issued", "Citation issue date", "date", 'max="' + recordDay(services.today) + '"')}` +
            "" +
            `${field(i, { ...c, violDate: c.violDate || inspAt(d).date }, "violDate", "Violation date", "date")}` +
            "" +
            `${field(i, { ...c, violTime: c.violTime || inspAt(d).time }, "violTime", "Violation time", "time")}` +
            '</div><p class="hint">Issue date must match the document’s mailed date' +
            `${d.correction ? " retained from the original action" : ""}` +
            ". Violation date records the inspection; court date follows issuance.</p" +
            ">";
          body += detail("charge", "Edit charge and dates", chargeFields);
          const pricing =
            '<p class="hint">' +
            "".concat(
              c.historicalDeposit
                ? "The original deposit is retained for this correction."
                : c.overrideBasis
                  ? "This amount has a recorded administrator authorization."
                  : determined
                    ? "The approved schedule determines this amount."
                    : "Use a court-approved amount and record its source.",
            ) +
            " " +
            `${mode === "total" ? "This total includes assessments; they are not added again." : ""}` +
            '</p><div class="grid g2"><label class="f"><span>Deposit method</span><se' +
            'lect data-review-cit="' +
            `${esc(i.id)}` +
            '|depositMode" aria-label="Deposit method for item ' +
            `${esc(i.no)}` +
            '" ' +
            `${c.overrideBasis ? "disabled" : ""}` +
            ">" +
            "".concat(
              [
                ["schedule", "Scheduled deposit"],
                ["base", "Approved base + assessments"],
                ["total", "Approved total (assessments included)"],
              ]
                .map(
                  ([v, l]) =>
                    `<option value="${v}" ${mode === v ? "selected" : ""} ${determined && v !== "schedule" ? "disabled" : ""}>${l}</option>`,
                )
                .join(""),
            ) +
            "</select></label>" +
            "".concat(
              mode === "total"
                ? field(i, c, "amount", "Approved total", "number", 'min="0.01" step="0.01" ' + (determined ? "readonly" : ""))
                : field(i, c, "base", "Base deposit", "number", 'min="0" step="0.01" ' + (mode === "schedule" || determined ? "readonly" : "")) +
                    field(
                      i,
                      c,
                      "cc",
                      "Court costs",
                      "number",
                      'min="15" max="48" step="0.01" ' + (mode === "schedule" || determined ? "readonly" : ""),
                    ),
            ) +
            "" +
            "".concat(
              mode === "schedule"
                ? field(i, c, "tier", "Computed offense tier", "text", "readonly") +
                    field(i, c, "tierOverride", "Approved tier override", "number", 'min="1" step="1"') +
                    field(i, c, "tierOverrideSource", "Tier override — approved source")
                : '<label class="f"><span>Offense tier</span><select data-review-cit="' +
                    `${esc(i.id)}` +
                    '|tier" aria-label="Offense tier for item ' +
                    `${esc(i.no)}` +
                    '">' +
                    "".concat(["1st", "2nd", "3rd+"].map((t) => `<option value="${t}" ${c.tier === t ? "selected" : ""}>${t}</option>`).join("")) +
                    "</select></label>" +
                    field(i, c, "depositSource", "Approved source / reason"),
            ) +
            "</div>" +
            "".concat(
              c.reconfirmDeposit
                ? '<button class="btn" data-confirm-deposit="' + esc(d.id) + "|" + esc(i.id) + '">Confirm current approved deposit</button>'
                : "",
            ) +
            '<p class="hint" data-deposit-schedule="' +
            `${esc(i.id)}` +
            '">' +
            `${esc(services.citationPricing.hint(d, i, c))}` +
            "</p>" +
            "".concat(
              c.measurements
                ? '<dl class="charge-factors">' +
                    Object.entries(c.measurements)
                      .map(
                        ([key, value]) =>
                          "<div><dt>" +
                          esc(
                            {
                              area: "Building area (square feet)",
                              days: "Days of noncompliance",
                              diameter: "Tree diameter (inches)",
                              removed: "Tree removed",
                            }[key] || key,
                          ) +
                          "</dt><dd>" +
                          esc(value === true ? "Yes" : value === false ? "No" : value) +
                          "</dd></div>",
                      )
                      .join("") +
                    "</dl>"
                : "",
            ) +
            '<p class="hint" data-deposit-breakdown="' +
            `${esc(i.id)}` +
            '">' +
            "".concat(
              mode !== "total" && validMoney(c.base)
                ? services
                    .feeLines(c.base, c.cc, c.pricedOn || c.issued)
                    .rows.map((row) => esc(row.k) + ": $" + money(row.v))
                    .join(" · ")
                : "",
            ) +
            "</p>";
          body += detail("pricing", "Pricing details and authorization", pricing, !!fault && !held);
        }
        return (
          '<fieldset class="citation-editor charge-card" data-charge="' +
          `${esc(i.id)}` +
          '" ' +
          `${request ? 'data-deposit-request="' + esc(i.id) + '"' : ""}` +
          "><legend>Item " +
          `${esc(i.no)}` +
          " · " +
          `${esc(i.title || "Citation")}` +
          "</legend>" +
          `${summary}` +
          "" +
          "".concat(
            held
              ? '<p class="banner alert charge-hold">Issuance on hold. Division-approved ' +
                  "defendant instructions are required. Save this draft and request wording" +
                  " approval.</p>"
              : "",
          ) +
          "" +
          "".concat(
            !request
              ? '<p class="deposit-summary ' +
                  `${fault ? "charge-fault" : ""}` +
                  '" data-deposit-summary="' +
                  `${esc(i.id)}` +
                  '">' +
                  "".concat(
                    esc(held ? "Mandatory appearance · wording approval required" : fault || "Total cash deposit: " + formatDeposit(c.amount)),
                  ) +
                  "</p>"
              : "",
          ) +
          "" +
          `${body}` +
          "</fieldset>"
        );
      })
      .join("");
    return (
      '<section class="card no-print authoring-panel" id="citation-review"><div' +
      ' class="card-h"><h2>' +
      `${d.initialPreview ? "Initial-inspection citations · complete before issuance" : "Citation review"}` +
      '</h2><div><button class="btn btn-sm" data-refresh-citation-history>Refre' +
      'sh citation history</button> <button class="btn btn-sm" id="btn-savework' +
      '">Save draft &amp; return to Workspace</button></div></div><div class="card-b"><p c' +
      'lass="hint">Review each charge, deposit and court session. ' +
      "".concat(d.initialPreview ? "All selected citations and the inspection are saved together after every check passes." : "") +
      " Each completed charge produces four matching court copies. Expand a cha" +
      "rge to edit its facts or inspect its pricing basis.</p>" +
      `${cards}` +
      "</div></section>"
    );
  }
  return { depositComplete, initialCitationBody, citationDepositFault, editCitation, commitCitationEdits, authoringChecks, citationReview };
}
