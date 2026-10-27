import { caseNumberAllowed } from "./case_records.js";
import { inspAt } from "./inspection_facts.js";
import { normParcel, recordDay } from "../assets/shared.js";
import { specialType, isHistoryDoc } from "./document_rules.js";
import { checkTarget, citSelector, countBlanks, esc, itemSelector } from "./presentation_format.js";
import { docCase, docInsp } from "./writer_queries.js";
import { validISO, parseTime, daysBetween } from "./calendar.js";
import { isLLC, ownerLines } from "./mailing_rules.js";

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
    // a compliance letter reports on every item; elsewhere the cleared ones are
    // history and are not checked again
    const comp = d.type === "compliance";
    // neither a compliance letter nor a referral carries due dates: one reports
    // dates already met, the other stops setting them altogether
    const special = !!specialType(d.type);
    const noDates = comp || special || isHistoryDoc(d) || services.snow.is(d);
    const live = comp ? d.items.filter((i) => !i.withdrawn) : d.items.filter((i) => !i.done && !i.withdrawn);
    const noComply = comp
      ? d.items
          .filter((i) => !i.withdrawn)
          .filter((i) => !validISO(i.doneOn) || i.doneOn > recordDay(services.today) || i.doneOn < (docCase(d).date || "")).length
      : 0;
    const notAllDone = comp ? d.items.filter((i) => !i.done && !i.withdrawn).length : 0;
    const blanks = live.reduce((n, i) => n + countBlanks(i.text), 0);
    const noDue = noDates ? 0 : live.filter((i) => !i.due).length;
    const past = noDates
      ? 0
      : live.filter(
          (i) => i.due && validISO(i.due) && !services.unchangedCorrectionValue(d, i.id, "due") && daysBetween(recordDay(services.today), i.due) < 1,
        ).length;
    const badDue = noDates ? 0 : live.filter((i) => i.due && !validISO(i.due)).length;
    const noSec = live.filter((i) => !i.sections.length).length;
    const own = ownerLines(docCase(d));
    const addrOk = own.length >= 3 && /\b[A-Z]{2}\.?\s+\d{5}(-\d{4})?$/.test(own[own.length - 1] || "");
    const cited = d.items.filter((i) => i.cite && !i.withdrawn);
    const citMissing =
      d.type !== "citation"
        ? 0
        : cited.reduce(
            (n, i) =>
              n +
              ["num", "courtDate", "amount", "desc", "ord"].filter(
                (f) => !(f === "amount" && d.cits?.[i.id]?.mandatoryAppearance) && !String(((d.cits || {})[i.id] || {})[f] || "").trim(),
              ).length,
            0,
          );
    const citBad =
      d.type !== "citation"
        ? 0
        : cited.filter((i) => {
            const cd = ((d.cits || {})[i.id] || {}).courtDate;
            return !cd || !validISO(cd) || (!services.unchangedCourtDate(d, i.id) && daysBetween(recordDay(services.today), cd) < 1);
          }).length;
    const noAgent =
      d.type === "citation" && isLLC(docCase(d))
        ? services.addressProblem(...["name", "addr", "city"].map((key) => (docCase(d).agent || {})[key]))
        : "";
    // every citation carries its own officer I.D. — one completed form does
    // not speak for the others on the same document
    const noBadge = d.type !== "citation" ? 0 : cited.filter((i) => !String(((d.cits || {})[i.id] || {}).deptId || "").trim()).length;
    const noBase =
      d.type !== "citation"
        ? 0
        : cited.filter((i) => {
            const cc = (d.cits || {})[i.id] || {};
            return services.citationDepositFault(cc, d, i) !== "";
          }).length;
    const tight = noDates
      ? 0
      : live.filter((i) => i.due && daysBetween(recordDay(services.today), i.due) > 0 && daysBetween(recordDay(services.today), i.due) < 7).length;
    const far = noDates
      ? 0
      : live.filter((i) => i.due && !services.unchangedCorrectionValue(d, i.id, "due") && daysBetween(recordDay(services.today), i.due) > 180).length;
    const draft = live.filter(services.catalogDraftBlocked).length;
    const base = [
      {
        ok: addrOk,
        t: !own[0]
          ? "No defendant name on the mailing block"
          : own.length < 3
            ? "Mailing block needs a name, a street line and a city, state and ZIP"
            : addrOk
              ? "Mailing block has the required address format"
              : "Last line of the mailing block does not end in a state and ZIP",
      },
      {
        ok: own.length <= 5,
        t: own.length > 5 ? own.length + " lines in the mailing block — the envelope window fits five" : "Mailing block fits the envelope window",
      },
      {
        ok: live.length > 0 || !!(d.correction && d.items.length && d.items.every((i) => i.withdrawn)),
        t: comp
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
        ok: blanks === 0,
        t: blanks ? blanks + " unfilled bubble" + (blanks === 1 ? "" : "s") + " in the corrective action text" : "No unfilled blanks",
      },
      {
        ok: noDue === 0,
        t: services.snow.is(d)
          ? "Snow item is exempt from due dates"
          : noDue
            ? noDue + " item" + (noDue === 1 ? " has" : "s have") + " no due date"
            : "Every item has a due date",
      },
      { ok: past === 0, t: past ? past + " due date" + (past === 1 ? " is" : "s are") + " today or in the past" : "Due dates are in the future" },
      {
        ok: badDue === 0,
        t: badDue
          ? badDue + " due date" + (badDue === 1 ? " is not" : "s are not") + " a real calendar date"
          : "Every due date reads as a calendar date",
      },
      { ok: noSec === 0, t: noSec ? noSec + " item" + (noSec === 1 ? " has" : "s have") + " no ordinance section" : "Every item cites an ordinance" },
      {
        ok: draft === 0,
        t: draft
          ? draft +
            (draft === 1 ? " item uses" : " items use") +
            (" draft language or retired catalog language; division review is required" +
              ". Open Order language or choose a reviewed item. Editing text alone cann" +
              "ot approve it.")
          : "No unreviewed or retired catalog language",
      },
      {
        ok: far === 0,
        t: far ? far + " due date" + (far === 1 ? " is" : "s are") + " more than six months out" : "Due dates fall in a normal range",
      },
      {
        ok: tight === 0,
        soft: true,
        t: tight
          ? tight + " due date" + (tight === 1 ? " is" : "s are") + " less than a week out — confirm that is intended"
          : "No unusually short compliance windows",
      },
    ];

    const itemTargets = (items, field) => items.map((i) => checkTarget(itemSelector(i.id, field), "Item " + i.no));
    [
      [checkTarget('[data-case="ownerBlock"]', "Mailing block")],
      [checkTarget('[data-case="ownerBlock"]', "Mailing block")],
      [checkTarget("#btn-add-top", "Violation Items")],
      itemTargets(
        live.filter((i) => countBlanks(i.text)),
        "text",
      ),
      itemTargets(
        live.filter((i) => !i.due),
        "due",
      ),
      itemTargets(
        live.filter(
          (i) => i.due && validISO(i.due) && !services.unchangedCorrectionValue(d, i.id, "due") && daysBetween(recordDay(services.today), i.due) < 1,
        ),
        "due",
      ),
      itemTargets(
        live.filter((i) => i.due && !validISO(i.due)),
        "due",
      ),
      itemTargets(
        live.filter((i) => !i.sections.length),
        "sections",
      ),
      live.filter(services.catalogDraftBlocked).map((i) => checkTarget('[data-nav="library"]', "Review catalog for item " + i.no, "catalog")),
      itemTargets(
        live.filter((i) => i.due && !services.unchangedCorrectionValue(d, i.id, "due") && daysBetween(recordDay(services.today), i.due) > 180),
        "due",
      ),
      itemTargets(
        live.filter((i) => i.due && daysBetween(recordDay(services.today), i.due) > 0 && daysBetween(recordDay(services.today), i.due) < 7),
        "due",
      ),
    ].forEach((targets, ix) => (base[ix].targets = targets));
    const recipientProblem = services.validateAndStandardizeAddresses(docCase(d), false, false);
    base.push({
      ok: !recipientProblem,
      t: recipientProblem ? recipientProblem.message : "Copy and registered-agent addresses are complete",
      targets: recipientProblem
        ? [checkTarget("#btn-cc", "Recipients", "recipient:" + recipientProblem.scope + ":" + recipientProblem.index + ":" + recipientProblem.field)]
        : [],
    });
    const forComp = [
      {
        ok: notAllDone === 0,
        t: notAllDone
          ? notAllDone + " item" + (notAllDone === 1 ? " is" : "s are") + " not marked corrected — a compliance letter closes every item"
          : "Every item is corrected",
      },
      {
        ok: noComply === 0,
        t: noComply
          ? noComply + " item" + (noComply === 1 ? " has" : "s have") + " no date of compliance"
          : "Every item carries its date of compliance",
      },
    ];

    const forCit = [
      {
        ok: cited.length > 0 || !!(d.correction && d.items.length && d.items.every((i) => i.withdrawn)),
        t: cited.length ? cited.length + " item" + (cited.length === 1 ? "" : "s") + " cited" : "No item selected for citation",
      },
      {
        ok: citMissing === 0,
        t: citMissing
          ? citMissing + " court citation field" + (citMissing === 1 ? "" : "s") + " still blank (number, court date, amount, ordinance, description)"
          : "Court citation fields complete",
      },
      {
        ok: citBad === 0,
        t: citBad ? citBad + " court date" + (citBad === 1 ? " is" : "s are") + " not a real date in the future" : "Court dates are in the future",
      },
      {
        ok: noBase === 0,
        t: noBase
          ? noBase +
            " citation" +
            (noBase === 1 ? " has" : "s have") +
            " an unresolved deposit — use Citation review to correct the ordinance or enter an approved deposit and its source"
          : "Deposit calculated for every citation",
      },
      {
        ok: noBadge === 0,
        t: noBadge
          ? noBadge + " citation" + (noBadge === 1 ? " has" : "s have") + " no badge number in the I.D. No. field — enter it on each form"
          : "Officer I.D. number present",
      },
      { ok: !noAgent, t: noAgent ? esc(docCase(d).owner) + " is a company — " + noAgent : "Registered agent recorded" },
    ];

    const citTargets = (items, fields) => items.flatMap((i) => fields.map((f) => checkTarget(citSelector(i.id, f), "Item " + i.no + " · " + f)));
    forCit[1].targets = cited.flatMap((i) =>
      ["num", "courtDate", "amount", "desc", "ord"]
        .filter((f) => !(f === "amount" && d.cits?.[i.id]?.mandatoryAppearance) && !String(((d.cits || {})[i.id] || {})[f] || "").trim())
        .map((f) => checkTarget(citSelector(i.id, f === "amount" ? "depositMode" : f), "Item " + i.no + " · " + f)),
    );
    forCit[2].targets = citTargets(
      cited.filter((i) => {
        const c = (d.cits || {})[i.id] || {};
        return !validISO(c.courtDate) || (!services.unchangedCourtDate(d, i.id) && daysBetween(recordDay(services.today), c.courtDate) < 1);
      }),
      ["courtDate"],
    );
    forCit[3].targets = citTargets(
      cited.filter((i) => services.citationDepositFault((d.cits || {})[i.id] || {})),
      ["depositMode", "ord"],
    );
    forCit[4].targets = citTargets(
      cited.filter((i) => !String(((d.cits || {})[i.id] || {}).deptId || "").trim()),
      ["deptId"],
    );
    forCit[5].targets = noAgent ? [checkTarget("#btn-cc", "Recipients")] : [];
    // the inspection this document was written from
    const at = inspAt(d),
      forInsp = [
        { ok: validISO(d.mailed), t: validISO(d.mailed) ? "Mailed date recorded" : "Enter a valid mailed date" },
        {
          ok: caseNumberAllowed(docCase(d)) && !!String(docCase(d).address || "").trim(),
          t: "Case number must use 3–80 letters, numbers or hyphens; property address is required",
        },
        { ok: !!docInsp(d).name, t: "Select the inspector signing this document" },
      ];
    // a notice is what puts a case on the map: without a parcel it cannot be
    // located or reported by district (division, 09/18/2026)
    if (d.type === "notice") {
      const pk = normParcel(docCase(d).parcel);
      forInsp.push({
        ok: !!pk,
        t: pk
          ? "Parcel number recorded"
          : String(docCase(d).parcel || "").trim()
            ? "The parcel number is not 12 digits — correct it in Accela, then import this inspection again"
            : "No parcel number on the case — a notice cannot be issued without one. Add it in Accela, then import this inspection again",
      });
    }
    forInsp.push({
      ok: validISO(at.date) && at.date <= recordDay(services.today),
      t:
        validISO(at.date) && at.date <= recordDay(services.today)
          ? "Inspection date recorded"
          : "No inspection date — enter the date of the reinspection this document is written from",
      targets: [checkTarget(at.own ? '[data-doc="inspDate"]' : '[data-case="date"]', "Inspection date")],
    });
    if (at.own)
      forInsp.push({
        ok: !!parseTime(at.time),
        t: parseTime(at.time) ? "Inspection time recorded" : "Enter the inspection time before generating this document",
        targets: [checkTarget('[data-doc="inspTime"]', "Inspection time")],
      });
    // with no due dates on the document, the due-date checks have nothing to say
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
