import { caseNumberAllowed } from "./case_records.js";
import { inspAt } from "./inspection_facts.js";
import { normParcel, recordDay } from "../assets/shared.js";
import { specialType, isHistoryDoc } from "./document_rules.js";
import { checkTarget, citSelector, countBlanks, esc, itemSelector } from "./presentation_format.js";
import { docCase, docInsp } from "./writer_queries.js";
import { validISO, parseTime, daysBetween } from "./calendar.js";
import { isLLC, ownerLines } from "./mailing_rules.js";

function readinessComp({ d }) {
  return d.type === "compliance";
}

function readinessSpecial({ d }) {
  return !!specialType(d.type);
}

function readinessNoDates({ comp, special, d, services }) {
  return comp || special || isHistoryDoc(d) || services.snow.is(d);
}

function readinessLive({ comp, d }) {
  return comp ? d.items.filter((i) => !i.withdrawn) : d.items.filter((i) => !i.done && !i.withdrawn);
}

function readinessNoComply({ comp, d, services }) {
  return comp
    ? d.items
        .filter((i) => !i.withdrawn)
        .filter((i) => !validISO(i.doneOn) || i.doneOn > recordDay(services.today) || i.doneOn < (docCase(d).date || "")).length
    : 0;
}

function readinessNotAllDone({ comp, d }) {
  return comp ? d.items.filter((i) => !i.done && !i.withdrawn).length : 0;
}

function readinessBlanks({ live }) {
  return live.reduce((n, i) => n + countBlanks(i.text), 0);
}

function readinessNoDue({ noDates, live }) {
  return noDates ? 0 : live.filter((i) => !i.due).length;
}

function readinessPast({ noDates, live, services, d }) {
  return noDates
    ? 0
    : live.filter(
        (i) => i.due && validISO(i.due) && !services.unchangedCorrectionValue(d, i.id, "due") && daysBetween(recordDay(services.today), i.due) < 1,
      ).length;
}

function readinessBadDue({ noDates, live }) {
  return noDates ? 0 : live.filter((i) => i.due && !validISO(i.due)).length;
}

function readinessNoSec({ live }) {
  return live.filter((i) => !i.sections.length).length;
}

function readinessOwn({ d }) {
  return ownerLines(docCase(d));
}

function readinessAddrOk({ own }) {
  return own.length >= 3 && /\b[A-Z]{2}\.?\s+\d{5}(-\d{4})?$/.test(own[own.length - 1] || "");
}

function readinessCited({ d }) {
  return d.items.filter((i) => i.cite && !i.withdrawn);
}

function readinessCitMissing({ d, cited }) {
  return d.type !== "citation"
    ? 0
    : cited.reduce(
        (n, i) =>
          n +
          ["num", "courtDate", "amount", "desc", "ord"].filter(
            (f) => !(f === "amount" && d.cits?.[i.id]?.mandatoryAppearance) && !String(((d.cits || {})[i.id] || {})[f] || "").trim(),
          ).length,
        0,
      );
}

function readinessCitBad({ d, cited, services }) {
  return d.type !== "citation"
    ? 0
    : cited.filter((i) => {
        const cd = ((d.cits || {})[i.id] || {}).courtDate;
        return !cd || !validISO(cd) || (!services.unchangedCourtDate(d, i.id) && daysBetween(recordDay(services.today), cd) < 1);
      }).length;
}

function readinessNoAgent({ d, services }) {
  return d.type === "citation" && isLLC(docCase(d))
    ? services.addressProblem(...["name", "addr", "city"].map((key) => (docCase(d).agent || {})[key]))
    : "";
}

function readinessNoBadge({ d, cited }) {
  return d.type !== "citation" ? 0 : cited.filter((i) => !String(((d.cits || {})[i.id] || {}).deptId || "").trim()).length;
}

function readinessNoBase({ d, cited, services }) {
  return d.type !== "citation"
    ? 0
    : cited.filter((i) => {
        const cc = (d.cits || {})[i.id] || {};
        return services.citationDepositFault(cc, d, i) !== "";
      }).length;
}

function readinessTight({ noDates, live, services }) {
  return noDates
    ? 0
    : live.filter((i) => i.due && daysBetween(recordDay(services.today), i.due) > 0 && daysBetween(recordDay(services.today), i.due) < 7).length;
}

function readinessFar({ noDates, live, services, d }) {
  return noDates
    ? 0
    : live.filter((i) => i.due && !services.unchangedCorrectionValue(d, i.id, "due") && daysBetween(recordDay(services.today), i.due) > 180).length;
}

function readinessDraft({ live, services }) {
  return live.filter(services.catalogDraftBlocked).length;
}

function readinessContext(d, services) {
  const context = { d, services };
  context.comp = readinessComp(context);
  context.special = readinessSpecial(context);
  context.noDates = readinessNoDates(context);
  context.live = readinessLive(context);
  context.noComply = readinessNoComply(context);
  context.notAllDone = readinessNotAllDone(context);
  context.blanks = readinessBlanks(context);
  context.noDue = readinessNoDue(context);
  context.past = readinessPast(context);
  context.badDue = readinessBadDue(context);
  context.noSec = readinessNoSec(context);
  context.own = readinessOwn(context);
  context.addrOk = readinessAddrOk(context);
  context.cited = readinessCited(context);
  context.citMissing = readinessCitMissing(context);
  context.citBad = readinessCitBad(context);
  context.noAgent = readinessNoAgent(context);
  context.noBadge = readinessNoBadge(context);
  context.noBase = readinessNoBase(context);
  context.tight = readinessTight(context);
  context.far = readinessFar(context);
  context.draft = readinessDraft(context);
  return context;
}

function readinessRows(rules, context) {
  return rules.map((rule) => ({ ok: rule.ok(context), ...(rule.soft === undefined ? {} : { soft: rule.soft }), t: rule.message(context) }));
}

const baseReadinessRules = [
  {
    id: "mailing-format",
    ok: ({ addrOk }) => addrOk,
    message: ({ own, addrOk }) =>
      !own[0]
        ? "No defendant name on the mailing block"
        : own.length < 3
          ? "Mailing block needs a name, a street line and a city, state and ZIP"
          : addrOk
            ? "Mailing block has the required address format"
            : "Last line of the mailing block does not end in a state and ZIP",
  },
  {
    id: "mailing-length",
    ok: ({ own }) => own.length <= 5,
    message: ({ own }) =>
      own.length > 5 ? own.length + " lines in the mailing block — the envelope window fits five" : "Mailing block fits the envelope window",
  },
  {
    id: "items",
    ok: ({ live, d }) => live.length > 0 || !!(d.correction && d.items.length && d.items.every((i) => i.withdrawn)),
    message: ({ comp, live, d }) =>
      comp
        ? live.length
          ? live.length + " item" + (live.length === 1 ? "" : "s") + " on the letter"
          : "No items on the letter"
        : live.length
          ? live.length +
            " item" +
            (live.length === 1 ? "" : "s") +
            " outstanding" +
            (d.items.length > live.length ? ", " + (d.items.length - live.length) + " shown as corrected" : "")
          : d.items.length
            ? "Every item is already corrected — nothing for this document to order"
            : "No violation items yet — add at least one",
  },
  {
    id: "blanks",
    ok: ({ blanks }) => blanks === 0,
    message: ({ blanks }) =>
      blanks ? blanks + " unfilled bubble" + (blanks === 1 ? "" : "s") + " in the corrective action text" : "No unfilled blanks",
  },
  {
    id: "missing-due",
    ok: ({ noDue }) => noDue === 0,
    message: ({ services, d, noDue }) =>
      services.snow.is(d)
        ? "Snow item is exempt from due dates"
        : noDue
          ? noDue + " item" + (noDue === 1 ? " has" : "s have") + " no due date"
          : "Every item has a due date",
  },
  {
    id: "past-due",
    ok: ({ past }) => past === 0,
    message: ({ past }) => (past ? past + " due date" + (past === 1 ? " is" : "s are") + " today or in the past" : "Due dates are in the future"),
  },
  {
    id: "invalid-due",
    ok: ({ badDue }) => badDue === 0,
    message: ({ badDue }) =>
      badDue ? badDue + " due date" + (badDue === 1 ? " is not" : "s are not") + " a real calendar date" : "Every due date reads as a calendar date",
  },
  {
    id: "sections",
    ok: ({ noSec }) => noSec === 0,
    message: ({ noSec }) => (noSec ? noSec + " item" + (noSec === 1 ? " has" : "s have") + " no ordinance section" : "Every item cites an ordinance"),
  },
  {
    id: "catalog-review",
    ok: ({ draft }) => draft === 0,
    message: ({ draft }) =>
      draft
        ? draft +
          (draft === 1 ? " item uses" : " items use") +
          " draft language or retired catalog language; division review is required. Open Order language or choose a reviewed item. Editing text alone cannot approve it."
        : "No unreviewed or retired catalog language",
  },
  {
    id: "far-due",
    ok: ({ far }) => far === 0,
    message: ({ far }) =>
      far ? far + " due date" + (far === 1 ? " is" : "s are") + " more than six months out" : "Due dates fall in a normal range",
  },
  {
    id: "short-due",
    ok: ({ tight }) => tight === 0,
    soft: true,
    message: ({ tight }) =>
      tight
        ? tight + " due date" + (tight === 1 ? " is" : "s are") + " less than a week out — confirm that is intended"
        : "No unusually short compliance windows",
  },
];

const itemTargets = (items, field) => items.map((i) => checkTarget(itemSelector(i.id, field), "Item " + i.no));

const baseTargetRules = [
  () => [checkTarget('[data-case="ownerBlock"]', "Mailing block")],
  () => [checkTarget('[data-case="ownerBlock"]', "Mailing block")],
  () => [checkTarget("#btn-add-top", "Violation Items")],
  ({ live }) =>
    itemTargets(
      live.filter((i) => countBlanks(i.text)),
      "text",
    ),
  ({ live }) =>
    itemTargets(
      live.filter((i) => !i.due),
      "due",
    ),
  ({ live, services, d }) =>
    itemTargets(
      live.filter(
        (i) => i.due && validISO(i.due) && !services.unchangedCorrectionValue(d, i.id, "due") && daysBetween(recordDay(services.today), i.due) < 1,
      ),
      "due",
    ),
  ({ live }) =>
    itemTargets(
      live.filter((i) => i.due && !validISO(i.due)),
      "due",
    ),
  ({ live }) =>
    itemTargets(
      live.filter((i) => !i.sections.length),
      "sections",
    ),
  ({ live, services }) =>
    live.filter(services.catalogDraftBlocked).map((i) => checkTarget('[data-nav="library"]', "Review catalog for item " + i.no, "catalog")),
  ({ live, services, d }) =>
    itemTargets(
      live.filter((i) => i.due && !services.unchangedCorrectionValue(d, i.id, "due") && daysBetween(recordDay(services.today), i.due) > 180),
      "due",
    ),
  ({ live, services }) =>
    itemTargets(
      live.filter((i) => i.due && daysBetween(recordDay(services.today), i.due) > 0 && daysBetween(recordDay(services.today), i.due) < 7),
      "due",
    ),
];

function recipientReadiness({ services, d }) {
  const recipientProblem = services.validateAndStandardizeAddresses(docCase(d), false, false);
  return {
    ok: !recipientProblem,
    t: recipientProblem ? recipientProblem.message : "Copy and registered-agent addresses are complete",
    targets: recipientProblem
      ? [checkTarget("#btn-cc", "Recipients", "recipient:" + recipientProblem.scope + ":" + recipientProblem.index + ":" + recipientProblem.field)]
      : [],
  };
}

const complianceReadinessRules = [
  {
    id: "corrected-items",
    ok: ({ notAllDone }) => notAllDone === 0,
    message: ({ notAllDone }) =>
      notAllDone
        ? notAllDone + " item" + (notAllDone === 1 ? " is" : "s are") + " not marked corrected — a compliance letter closes every item"
        : "Every item is corrected",
  },
  {
    id: "compliance-dates",
    ok: ({ noComply }) => noComply === 0,
    message: ({ noComply }) =>
      noComply ? noComply + " item" + (noComply === 1 ? " has" : "s have") + " no date of compliance" : "Every item carries its date of compliance",
  },
];

const citationReadinessRules = [
  {
    id: "cited-items",
    ok: ({ cited, d }) => cited.length > 0 || !!(d.correction && d.items.length && d.items.every((i) => i.withdrawn)),
    message: ({ cited }) => (cited.length ? cited.length + " item" + (cited.length === 1 ? "" : "s") + " cited" : "No item selected for citation"),
  },
  {
    id: "court-fields",
    ok: ({ citMissing }) => citMissing === 0,
    message: ({ citMissing }) =>
      citMissing
        ? citMissing + " court citation field" + (citMissing === 1 ? "" : "s") + " still blank (number, court date, amount, ordinance, description)"
        : "Court citation fields complete",
  },
  {
    id: "court-dates",
    ok: ({ citBad }) => citBad === 0,
    message: ({ citBad }) =>
      citBad ? citBad + " court date" + (citBad === 1 ? " is" : "s are") + " not a real date in the future" : "Court dates are in the future",
  },
  {
    id: "deposit",
    ok: ({ noBase }) => noBase === 0,
    message: ({ noBase }) =>
      noBase
        ? noBase +
          " citation" +
          (noBase === 1 ? " has" : "s have") +
          " an unresolved deposit — use Citation review to correct the ordinance or enter an approved deposit and its source"
        : "Deposit calculated for every citation",
  },
  {
    id: "badge",
    ok: ({ noBadge }) => noBadge === 0,
    message: ({ noBadge }) =>
      noBadge
        ? noBadge + " citation" + (noBadge === 1 ? " has" : "s have") + " no badge number in the I.D. No. field — enter it on each form"
        : "Officer I.D. number present",
  },
  {
    id: "agent",
    ok: ({ noAgent }) => !noAgent,
    message: ({ noAgent, d }) => (noAgent ? esc(docCase(d).owner) + " is a company — " + noAgent : "Registered agent recorded"),
  },
];

const citTargets = (items, fields) => items.flatMap((i) => fields.map((f) => checkTarget(citSelector(i.id, f), "Item " + i.no + " · " + f)));

function missingCitationTargets({ cited, d }) {
  return cited.flatMap((i) =>
    ["num", "courtDate", "amount", "desc", "ord"]
      .filter((f) => !(f === "amount" && d.cits?.[i.id]?.mandatoryAppearance) && !String(((d.cits || {})[i.id] || {})[f] || "").trim())
      .map((f) => checkTarget(citSelector(i.id, f === "amount" ? "depositMode" : f), "Item " + i.no + " · " + f)),
  );
}

function courtDateTargets({ cited, d, services }) {
  return citTargets(
    cited.filter((i) => {
      const c = (d.cits || {})[i.id] || {};
      return !validISO(c.courtDate) || (!services.unchangedCourtDate(d, i.id) && daysBetween(recordDay(services.today), c.courtDate) < 1);
    }),
    ["courtDate"],
  );
}

function depositTargets({ cited, services, d }) {
  return citTargets(
    cited.filter((i) => services.citationDepositFault((d.cits || {})[i.id] || {})),
    ["depositMode", "ord"],
  );
}

function badgeTargets({ cited, d }) {
  return citTargets(
    cited.filter((i) => !String(((d.cits || {})[i.id] || {}).deptId || "").trim()),
    ["deptId"],
  );
}

function agentTargets({ noAgent }) {
  return noAgent ? [checkTarget("#btn-cc", "Recipients")] : [];
}

const inspectionReadinessRules = [
  {
    id: "mailed-date",
    ok: ({ d }) => validISO(d.mailed),
    message: ({ d }) => (validISO(d.mailed) ? "Mailed date recorded" : "Enter a valid mailed date"),
  },
  {
    id: "case-identity",
    ok: ({ d }) => caseNumberAllowed(docCase(d)) && !!String(docCase(d).address || "").trim(),
    message: () => "Case number must use 3–80 letters, numbers or hyphens; property address is required",
  },
  { id: "inspector", ok: ({ d }) => !!docInsp(d).name, message: () => "Select the inspector signing this document" },
];

function noticeParcelReadiness({ d }) {
  const pk = normParcel(docCase(d).parcel);
  return {
    ok: !!pk,
    t: pk
      ? "Parcel number recorded"
      : String(docCase(d).parcel || "").trim()
        ? "The parcel number is not 12 digits — correct it in Accela, then import this inspection again"
        : "No parcel number on the case — a notice cannot be issued without one. Add it in Accela, then import this inspection again",
  };
}

function inspectionDateReadiness({ at, services }) {
  return {
    ok: validISO(at.date) && at.date <= recordDay(services.today),
    t:
      validISO(at.date) && at.date <= recordDay(services.today)
        ? "Inspection date recorded"
        : "No inspection date — enter the date of the reinspection this document is written from",
    targets: [checkTarget(at.own ? '[data-doc="inspDate"]' : '[data-case="date"]', "Inspection date")],
  };
}

function inspectionTimeReadiness({ at }) {
  return {
    ok: !!parseTime(at.time),
    t: parseTime(at.time) ? "Inspection time recorded" : "Enter the inspection time before generating this document",
    targets: [checkTarget('[data-doc="inspTime"]', "Inspection time")],
  };
}

function inspectionReadiness(context) {
  const { d } = context;
  const at = inspAt(d);
  const inspectionContext = { ...context, at };
  const rows = readinessRows(inspectionReadinessRules, inspectionContext);
  if (d.type === "notice") rows.push(noticeParcelReadiness(context));
  rows.push(inspectionDateReadiness(inspectionContext));
  if (at.own) rows.push(inspectionTimeReadiness(inspectionContext));
  return rows;
}

export function createDocumentReadiness(services) {
  function importStatusChecks(d) {
    const rule = d.importRule;
    if (!rule || rule.kind !== "initial" || !d.draft || d.correction) return [];
    const cited = d.items.some((i) => i.cite && !i.withdrawn);
    if (rule.cite && !cited)
      return [
        {
          ok: false,
          t: "The Accela status is Citation, but no item is marked for citation. Mark the items to cite, or correct the status in Accela and import this inspection again.",
        },
      ];
    if (!rule.cite && rule.doc === "notice" && cited)
      return [
        {
          ok: false,
          t: "The Accela status is Official Notice, so no item can be cited. Remove the citation marks, or correct the status in Accela and import this inspection again.",
        },
      ];
    return [{ ok: true, t: "Matches the Accela status: " + rule.status }];
  }

  function checks(d) {
    if (!d || !Array.isArray(d.items)) return [{ ok: false, t: "Open a document first" }];
    services.initialCitations.prepare(d);
    const context = readinessContext(d, services);
    const { special, noDates, comp } = context;
    const base = readinessRows(baseReadinessRules, context);
    baseTargetRules.map((rule) => rule(context)).forEach((targets, ix) => (base[ix].targets = targets));
    base.push(recipientReadiness(context));
    const forComp = readinessRows(complianceReadinessRules, context);
    const forCit = readinessRows(citationReadinessRules, context);
    forCit[1].targets = missingCitationTargets(context);
    forCit[2].targets = courtDateTargets(context);
    forCit[3].targets = depositTargets(context);
    forCit[4].targets = badgeTargets(context);
    forCit[5].targets = agentTargets(context);
    const forInsp = inspectionReadiness(context);
    return (special ? base.filter((c, n) => [0, 1, 3, base.length - 1].includes(n)) : noDates ? base.filter((c) => !/due date/i.test(c.t)) : base)
      .concat(comp ? forComp : [])
      .concat(d.type === "citation" ? forCit : [])
      .concat(forInsp)
      .concat(services.snow.checks(d))
      .concat(services.initialCitations.checks(d))
      .concat(importStatusChecks(d))
      .concat(services.newDocuments.specialChecks(d))
      .concat(services.authoringChecks(d))
      .concat(d.correction ? services.correctionChecks(d) : services.lifecycleChecks(d))
      .map((c) => services.attachCheckTargets(d, c));
  }

  return { checks };
}
