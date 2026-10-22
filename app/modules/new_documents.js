import { recordDay } from "../assets/shared.js";
import { fmtDate, inspAt, toast, validISO } from "./court_and_deposits.js";
import { evid, shell, sourceDocFor, stableJSON } from "./workspace_shell.js";
import { saveDrafts, scheduleDraftSave } from "./case_files.js";
import { screenCases } from "./reinspection_walkthrough.js";
import { commitRecordAttempt } from "./issuance_and_corrections.js";
import { worksheetFaults } from "./draft_recovery.js";
import { newDoc, render, renderKeep } from "./inspection_import.js";
import { docFromReinspection, refreshSheet } from "./document_pagination.js";
import {
  DOC_TYPES,
  addDays,
  checkAttr,
  checkTarget,
  clone,
  daysBetween,
  doc,
  docBody,
  docCase,
  docInsp,
  docsFor,
  draftDocFor,
  esc,
  insp,
  isEffective,
  isHistoryDoc,
  isLocked,
  itemSelector,
  kase,
  openItems,
  originalNotice,
  recordHead,
  recordNow,
  reinsp,
  reinspFor,
  snow,
  uid,
} from "./app_core.js";
import { INSPECTORS } from "./data/inspectors.js";
import { WriterState } from "./state.js";
export const alignedExtension = (d) => d?.authoringVersion >= 12 && ["bestInterestExtension", "vacancyExtension"].includes(d.type);
/* Authoring 13 (R56): every extended Best Interest or Vacancy item carries a later repair due date, entered in
   Items and due dates; the conditional Vacancy model remains only for authoring-12 and earlier reprints. */
export const DATED_EXTENSIONS = 13;
export const datedExtension = (d) => (d?.authoringVersion || 0) >= DATED_EXTENSIONS && ["bestInterestExtension", "vacancyExtension"].includes(d.type);
const requireDated = (type, s) => {
  if (type === "vacancyExtension") s.deadlineMode = "dated";
  return s;
};
/* R26 scoped actions. Supplemental letters never replace continuing item state. */
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
const NUISANCES = [
  ["junk", "Junk, trash and debris", "27.05(3)(b)4"],
  ["sidewalk", "Trees or shrubs obstructing a sidewalk", "27.05(3)(b)1"],
  ["tree", "Dead or hazardous tree", "27.05(3)(b)3"],
  ["secure", "Secure a vacant building", "27.085(2)(a)"],
  ["custom", "Custom nuisance with verified authority", ""],
];
const REMEDY =
  "Remedy from Order. The Building Code, Fire Code, Conveyance Code & Licen" +
  "sing Appeals Board, created by Section 29.18 of these Ordinances, shall " +
  "have no authority to act on orders issued under this subsection. Any per" +
  "son affected by orders issued under this subsection shall, within thirty" +
  " (30) days of service or publication of the order, apply to the Circuit " +
  "Court for an order restraining the City and the Director of Building Ins" +
  "pection from entering on the premises and abating or removing the nuisan" +
  "ce, or be forever barred. The court shall determine the reasonableness o" +
  "f the order for abatement of the nuisance.";
export const specialType = (type) => NEW_TYPES.find((t) => t.id === type);
export const supplemental = (d) => specialType(d?.type)?.effect === "supplemental";
export function activeRestrictions(documents) {
  const live = documents.filter((d) => !d.draft && !d.void && !d.superseded && d.type === "noOccupancy");
  const released = new Set(live.filter((d) => d.special?.mode === "release").map((d) => d.special.releases));
  return live.filter((d) => d.special?.mode !== "release" && !released.has(d.id));
}

export function initNewDocuments() {
  const e = (v) => esc(v),
    text = (v) => String(v || "").trim(),
    day = () => recordDay(today);
  const p = (t) => "<p>" + e(t).replace(/◯|\(\s{0,8}\)/g, '<span class="blank" role="img" aria-label="fill-in bubble"></span>') + "</p>",
    date = (v) => fmtDate(v) || "◯",
    val = (s, k) => text(s[k]) || "◯";
  const clause = (v) => text(v).replace(/[.\s]+$/, "");
  const scope = (d, s) =>
    docCase(d).address +
    (s.scope === "unit"
      ? " — " + (/^(?:apartment|apt\.?|unit|suite|room)\b/i.test(text(s.unit)) ? "" : "Apartment / unit ") + val(s, "unit")
      : " — Entire building");
  const contact = (d) => {
    const i = insp(docCase(d).inspectorId);
    return i.name + " at " + i.phone + (i.email ? " or " + i.email : "");
  };
  const selected = (d, s) => (d.items || []).filter((i) => (s.affected || []).includes(String(i.no)) && !i.done && !i.withdrawn);
  function continuingItems(source, visits = reinspFor(source.caseId)) {
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
  function restoreDues(d) {
    const s = d.special || {},
      dated = d.type === "bestInterestExtension" || (d.type === "vacancyExtension" && s.deadlineMode === "dated");
    d.items.forEach((i) => {
      i.due = dated && (s.affected || []).includes(String(i.no)) && s.extendedDues?.[i.no] ? s.extendedDues[i.no] : (s.originalDues?.[i.no] ?? i.due);
    });
  }
  function refreshControls(el) {
    const attr = [...el.attributes].find((a) => a.name.startsWith("data-")),
      selector = attr ? "[" + attr.name + '="' + checkAttr(attr.value) + '"]' : null,
      wasOpen = !!document.querySelector("#r26-details details[open]");
    renderKeep();
    if (wasOpen) {
      const details = document.querySelector("#r26-details details");
      if (details) details.open = true;
    }
    if (selector) document.querySelector(selector)?.focus({ preventScroll: true });
  }
  function specialBody(d) {
    const s = d.special || {},
      type = d.type,
      at = inspAt(d),
      address = scope(d, s),
      items = selected(d, s);
    const refs = items.map((i) => i.no).join(", ") || "◯";
    let paras = [];
    if (type === "summaryAbatement" || type === "nonSummaryAbatement") {
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
          ("abate the nuisance as ordered, the City will abate it. The costs will be" +
            " assessed against the property as a special charge. Additional charges o" +
            "r penalties may apply."),
      );
      if (type === "nonSummaryAbatement") paras.push(REMEDY);
    } else if (type === "noOccupancy") {
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
            (". Before occupancy is allowed, the City of Madison Building Inspection D" +
              "ivision must reinspect the premises, remove the placard, and give writte" +
              "n permission to reoccupy."),
        );
        if (text(s.access)) paras.push("Approved access conditions: " + s.access);
      }
    } else if (type === "bestInterestExtension") {
      if (s.stage === "supervisory")
        paras.push(
          "The uncorrected violations in Official Notice " +
            val(s, "noticeRef") +
            " have been referred for supervisory review of possible prosecution. The compliance date has passed.",
        );
      paras.push(
        "We find that granting additional time is in the City’s best interest and" +
          " yours. Reasons supporting this extension: " +
          clause(val(s, "reason")) +
          (". You have indicated that you intend to correct the listed violations, a" + "nd no safety items are included in this extension."),
      );
      paras.push("The compliance dates for Item(s) " + refs + " are extended as shown below. Unlisted items retain their existing deadlines.");
      if (s.stage === "supervisory" && s.prosecutionClause)
        paras.push("If the work is not completed by the extended date, the case will be forw" + "arded to the City Attorney for legal action.");
    } else if (type === "vacancyExtension") {
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
          (" must be maintained, including removal of trash and debris, grass cuttin" +
            "g, sidewalk snow removal, and general exterior maintenance. The property" +
            " may be inspected periodically, including unscheduled inspections."),
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
          ("), or before occupancy, to arrange a reinspection. Occupancy without pri" +
            "or Building Inspection approval may result in a citation or referral to " +
            "the City Attorney. Failure to maintain the required areas may void this " +
            "extension and result in enforcement action."),
      );
      paras.push(
        "A further extension will be considered after the next inspection, provid" +
          "ed vacancy and the extension conditions continue. Contact Building Inspe" +
          "ction before a sale or transfer to arrange review of the outstanding vio" +
          "lations and case responsibility.",
      );
      paras.push("Approved conditions: " + val(s, "conditions"));
      paras.push(val(s, "transferClause"));
      paras.push(
        "Security, urgent safety obligations and unlisted items are not extended." +
          " Any existing No Occupancy order continues until explicitly released in " +
          "writing.",
      );
    }
    if (alignedExtension(d)) return narrativeParagraphs(paras);
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
    paras.push("For questions" + (type === "noOccupancy" ? ", or to arrange reinspection" : "") + ", contact " + contact(d) + ".");
    paras.push(val(s, "signerName") + "\n" + val(s, "signerTitle"));
    return narrativeParagraphs(paras);
  }
  function narrativeParagraphs(paras) {
    // Bound narrative rows so long findings paginate without an oversized row.
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
  function specialChecks(d) {
    if (!specialType(d.type)) return [];
    const s = d.special || {},
      out = [],
      // Affected items are checkboxes (data-special-item) in the Affected outstanding items fieldset, not data-special fields.
      affectedTarget = d.items.some((i) => !i.done && !i.withdrawn) ? "#r26-details [data-special-item]" : "#r26-details fieldset.r26-items",
      add = (ok, t, key, targets) =>
        out.push({
          ok: !!ok,
          t,
          targets: targets?.length ? targets : key ? [checkTarget(key === "affected" ? affectedTarget : '[data-special="' + key + '"]', t)] : [],
        });
    const need = (k, label) => add(text(s[k]) && !/◯|\(\s{0,8}\)/.test(s[k]), "Enter " + label + ".", k);
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
    add(validISO(s.reviewDateLegal) && s.reviewDateLegal <= day(), "Record the current-code review date.", "reviewDateLegal");
    add(s.reviewed === true, "Division review must confirm this variant, wording, procedure and authority.", "reviewed");
    add(s.scope === "building" || s.scope === "unit", "Choose building or apartment / unit scope.", "scope");
    if (s.scope === "unit") need("unit", "the apartment / unit identifier");
    if (docsFor(d.caseId).some((x) => isEffective(x) && isHistoryDoc(x))) {
      add(
        specialType(d.type).effect === "supplemental" && s.emergencyApproved === true && text(s.referralCoordination),
        "A referred case needs an approved emergency / occupancy exception and City Attorney coordination reference.",
        "referralCoordination",
      );
    }
    if (["summaryAbatement", "nonSummaryAbatement"].includes(d.type)) {
      add(
        NUISANCES.some((v) => v[0] === s.variant && (d.type === "summaryAbatement" || v[0] !== "secure")),
        "Choose an approved nuisance preset.",
        "variant",
      );
      need("findings", "the specific conditions and locations");
      need("work", "the corrective work");
      if (d.type === "summaryAbatement") need("summaryBasis", "the factual basis for immediate summary action");
      else {
        add(validISO(s.orderDue) && s.orderDue > d.mailed, "Enter the approved future order compliance date.", "orderDue");
        need("servicePlan", "the approved service / publication plan");
        add(s.remedyReviewed === true, "Confirm the distinct Circuit Court remedy against current code.", "remedyReviewed");
      }
      if (s.variant === "custom") need("customReviewRef", "the custom condition’s verified authority and approved wording reference");
      if (s.variant === "tree") need("forestryRef", "the forestry report or reviewed factual tree assessment");
      if (s.variant === "secure") {
        need("securingConditions", "the reviewed securing / animal / material conditions");
        if (s.boarding) need("boardingRef", "the prior written boarding approval");
      }
    } else if (d.type === "noOccupancy") {
      add(
        validISO(s.effective) && s.effective >= docCase(d).date && s.effective <= d.mailed && s.effective <= day(),
        "Enter a valid effective order / release date.",
        "effective",
      );
      add(["restrict", "release"].includes(s.mode), "Choose restriction or documented release.", "mode");
      if (s.mode === "release") {
        const old = activeRestrictions(docsFor(d.caseId)).find((x) => x.id === s.releases);
        add(
          old && old.special.scope === s.scope && (s.scope !== "unit" || text(old.special.unit) === text(s.unit)),
          "Select the active restriction for this exact scope.",
          "releases",
        );
        add(
          validISO(s.releaseInspection) &&
            s.releaseInspection <= day() &&
            s.releaseInspection <= s.effective &&
            (!old || s.releaseInspection >= old.special.effective),
          "Record the verified release reinspection date.",
          "releaseInspection",
        );
        need("releaseFacts", "the confirmed corrections and reinspection record");
        add(
          s.placardRemoved && validISO(s.removalDate) && s.removalDate <= day() && s.removalDate <= s.effective,
          "Record actual placard removal before permission to reoccupy.",
          "removalDate",
        );
        need("releaseFormRef", "the division-approved written release form / procedure");
        const visit = reinsp(s.releaseVisitId);
        if (s.releaseVisitId === "external") {
          need("releaseInspectionRef", "the verified external reinspection record reference");
          add(!!insp(s.releaseInspectorId).name, "Select the inspector who performed the release reinspection.", "releaseInspectorId");
        } else
          add(
            visit && visit.caseId === d.caseId && !visit.draft && visit.date === s.releaseInspection,
            "Select the recorded visit confirming release, or record the verified external inspection.",
            "releaseVisitId",
          );
      } else {
        need("findings", "the restriction findings");
        need("releaseConditions", "the conditions necessary for release");
        add(["posted", "pending"].includes(s.posting), "Record posting status.", "posting");
        if (s.posting === "posted")
          add(validISO(s.postedDate) && s.postedDate <= day() && s.postedDate <= d.mailed, "Record the actual posting date.", "postedDate");
        else need("prePostingRef", "the approved pre-posting order wording / procedure");
      }
    } else {
      add(selected(d, s).length > 0, "Select at least one outstanding affected item.", "affected");
      add(
        s.noSafety === true && text(s.safetyBasis),
        "Confirm the reviewed factual basis excluding safety, security and urgent obligations.",
        "safetyBasis",
      );
      if (d.type === "bestInterestExtension") {
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
      } else {
        need("vacancyFacts", "the verified vacancy basis");
        need("requestRef", "the extension request");
        need("conditions", "the approved continuing conditions");
        need("expiryPolicyRef", "the approved expiration / review policy");
        need("transferClause", "the reviewed sale / transfer and applicable disclosure wording");
        add(validISO(s.reviewDate) && s.reviewDate > d.mailed, "Enter the next scheduled review inspection date.", "reviewDate");
        if (s.reviewDate && addDays(s.reviewDate, -7) < d.mailed) need("shortNoticeRef", "the approved short-notice contact procedure");
        add(["fixed", "review"].includes(s.expiryMode), "Choose the approved expiration / review model.", "expiryMode");
        if (s.expiryMode === "fixed")
          add(validISO(s.expiryDate) && s.expiryDate > d.mailed, "Enter a separate future expiration date.", "expiryDate");
        add(["dated", "conditional"].includes(s.deadlineMode), "Choose the approved repair deadline model.", "deadlineMode");
      }
      if (d.type === "bestInterestExtension" || s.deadlineMode === "dated") {
        const laterDue = (i) => validISO(i.due) && i.due > d.mailed && i.due > (s.originalDues?.[i.no] || "");
        // Authoring 13 enters these dates in Items and due dates; link each affected item's due-date field there.
        add(
          selected(d, s).every(laterDue),
          datedExtension(d)
            ? "Enter a later future due date in Items and due dates for each affected item."
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
    add(!/◯|\(\s{0,8}\)|class="blank"/.test(docBody(d)), "Fill every placeholder in the printed document before issuance.");
    return out;
  }
  function details(d) {
    if (!specialType(d.type) || isLocked(d) || d.correction) return "";
    const s = d.special || (d.special = {}),
      f = (k, label, type = "text") =>
        '<label class="f"><span>' +
        e(label) +
        "</span><" +
        (type === "textarea" ? 'textarea rows="3"' : 'input type="' + type + '"') +
        ' data-special="' +
        k +
        '" ' +
        (type === "textarea" ? "" : 'value="' + e(s[k] || "") + '"') +
        ">" +
        (type === "textarea" ? e(s[k] || "") + "</textarea>" : "") +
        "</label>",
      sel = (k, label, opts) =>
        '<label class="f"><span>' +
        label +
        '</span><select data-special="' +
        k +
        '"><option value="">Choose…</option>' +
        opts.map(([v, l]) => '<option value="' + v + '" ' + (s[k] === v ? "selected" : "") + ">" + e(l) + "</option>").join("") +
        "</select></label>",
      ck = (k, l) => '<label><input type="checkbox" data-special="' + k + '" ' + (s[k] ? "checked" : "") + "> " + e(l) + "</label>";
    let fields =
      (d.importRule
        ? '<p class="f"><span>Document from the Accela status</span><strong>' +
          e(d.importRule.label) +
          "</strong> (Initial Inspection status " +
          e(d.importRule.status) +
          ")</p>"
        : d.initialAction
          ? '<label class="f"><span>Initial inspection action</span><select data-init' +
            'ial-action><option value="notice">Official Notice</option>' +
            NEW_TYPES.filter((t) => t.effect === "supplemental")
              .map((t) => '<option value="' + t.id + '" ' + (d.type === t.id ? "selected" : "") + ">" + t.label + "</option>")
              .join("") +
            "</select></label>"
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
      (s.scope === "unit" ? f("unit", "Apartment / unit identifier") : "");
    if (["summaryAbatement", "nonSummaryAbatement"].includes(d.type)) {
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
          f("forestryRef", "Forestry report / factual assessment") +
          ck("removeTree", "Tree removal ordered: flush with ground and dispose of branches");
      if (s.variant === "secure")
        fields +=
          f("securingConditions", "Required securing, animals and materials conditions", "textarea") +
          ck("boarding", "Boarding is required") +
          (s.boarding ? f("boardingRef", "Prior written boarding approval") : "");
    } else if (d.type === "noOccupancy") {
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
    } else {
      fields +=
        '<fieldset class="r26-items"><legend>Affected outstanding items</legend>' +
        d.items
          .filter((i) => !i.done && !i.withdrawn)
          .map(
            (i) =>
              '<label><input type="checkbox" data-special-item="' +
              e(i.no) +
              '" ' +
              ((s.affected || []).includes(String(i.no)) ? "checked" : "") +
              "> Item " +
              e(i.no) +
              " · " +
              e(i.title || i.text.slice(0, 60)) +
              "</label>" +
              ((s.affected || []).includes(String(i.no)) && !datedExtension(d) && (d.type === "bestInterestExtension" || s.deadlineMode === "dated")
                ? '<label class="f"><span>Extended deadline for item ' +
                  e(i.no) +
                  '</span><input type="date" data-special-due="' +
                  e(i.no) +
                  '" value="' +
                  e(i.due || "") +
                  '"></label>'
                : ""),
          )
          .join("") +
        "</fieldset>" +
        (datedExtension(d)
          ? '<p class="hint">Enter each affected item\u2019s new due date in Items and due dates. Other items keep their original dates.</p>'
          : "") +
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
    }
    if (supplemental(d) && d.items.length)
      fields +=
        '<fieldset class="r26-items"><legend>Referenced source items (optional)</legend>' +
        d.items
          .map(
            (i) =>
              '<label><input type="checkbox" data-special-item="' +
              e(i.no) +
              '" ' +
              ((s.affected || []).includes(String(i.no)) ? "checked" : "") +
              "> Item " +
              e(i.no) +
              " · " +
              e(i.title || "Source violation") +
              "</label>",
          )
          .join("") +
        "</fieldset>";
    if (docsFor(d.caseId).some((x) => isEffective(x) && isHistoryDoc(x)))
      fields +=
        ck("emergencyApproved", "Approved emergency / occupancy exception on referred case") +
        f("referralCoordination", "City Attorney coordination / approved exception reference");
    const review =
      f("authority", "Verified ordinance authority") +
      f("codeSource", "Verified current-code source URL / official reference") +
      f("codeRevision", "Code revision / effective information and amendment review") +
      f("reviewer", "Division reviewer") +
      f("reviewDateLegal", "Current-code review date", "date") +
      f("reviewRef", "Approved ordinance, wording and procedure reference", "textarea") +
      f("signerName", "Authorized signer name") +
      f("signerTitle", "Authorized signer title") +
      f("delegation", "Authorization / delegation reference") +
      ck("reviewed", "Division review confirms this variant, wording, procedure and authority");
    return (
      '<section class="card no-print" id="r26-details"><div class="card-h"><h2>' +
      e(specialType(d.type).label) +
      (' details</h2></div><div class="card-b"><p class="hint">Drafts can be sav' +
        "ed unfinished. Issuance requires recorded division review of current law" +
        ", wording and signer authority. Review entries are supplied by the opera" +
        'tor; they are not authenticated role checks.</p><div class="grid g2">') +
      fields +
      '</div><details><summary>Authority, wording and signer review</summary><div class="grid g2">' +
      review +
      "</div></details></div></section>"
    );
  }
  const groups = [
    ["time", "Give more time"],
    ["enforcement", "Take enforcement action"],
    ["occupancy", "Restrict occupancy"],
    ["compliance", "Confirm compliance"],
  ];
  function choices(r) {
    const referred = docsFor(r.caseId).some((x) => isEffective(x) && isHistoryDoc(x));
    return [
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
    ];
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
      referred = docsFor(r.caseId).some((x) => isEffective(x) && isHistoryDoc(x));
    if (type === "notice") return "Official Notice is created from an initial imported inspection.";
    if (!src || !isEffective(src)) return "The inspection source is no longer effective.";
    const issued = docsFor(r.caseId).filter((d) => !d.draft && d.fromReinspId === r.id);
    if (issued.some((d) => d.type === type)) return "This inspection already has that action. Open the existing document.";
    if (!supplemental({ type }) && issued.some((d) => !supplemental(d)))
      return "This inspection already has a primary follow-up. Add a compatible scoped order.";
    if (referred && !["referralUpdate", "compliance"].includes(type) && !supplemental({ type }))
      return "The case is with the City Attorney. Extensions and new citations are unavailable.";
    if (type === "compliance" && open.length) return "Some violation items remain outstanding.";
    if (!supplemental({ type }) && type !== "compliance" && !open.length) return "No outstanding items for this action.";
    if (type === "citation" && !open.some((i) => r.results[i.id]?.cite)) return "Select the outstanding items to cite on the worksheet.";
    return "";
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
    const faults = picked ? [...worksheetFaults(r, picked), eligibility(r, picked)].filter(Boolean) : ["Choose the extension type."];
    const label = (DOC_TYPES.find((t) => t.id === picked) || {}).label || rule.label;
    return (
      '<section class="card no-print r26-chooser" aria-label="Document from the Accela status"><div class="card-h"><h2>Document from the Accela status</h2></div><div class="card-b">' +
      "<p>Accela status <strong>" +
      e(rule.status) +
      "</strong> \u2192 " +
      e(rule.label) +
      ".</p>" +
      (allowed.length > 1
        ? "<fieldset><legend>Choose the extension type</legend>" +
          list
            .map(
              (c) =>
                '<label class="r26-choice"><input type="radio" name="action-type" data-action-type="' +
                c[0] +
                '" ' +
                (picked === c[0] ? "checked" : "") +
                "><span><strong>" +
                e(c[1]) +
                "</strong><small>" +
                e(c[3]) +
                "</small></span></label>",
            )
            .join("") +
          "</fieldset>"
        : "") +
      '<p aria-live="polite">' +
      (picked
        ? e(label) + ": " + (faults.length ? e(faults[0]) : "Ready to create a draft. Review document details before issuance.")
        : e(faults[0])) +
      '</p><button class="btn btn-primary" data-create-action ' +
      (faults.length ? "disabled" : "") +
      ">Create draft</button></div></section>"
    );
  }
  function chooser(r) {
    if (r.importRule) return statusChooser(r);
    const saved = WriterState.WORK.actionChoices?.[r.id];
    if (saved && !r.draft) {
      r.followupIntent = saved.intent;
      r.actionGroup = saved.group;
    }
    const picked = r.followupIntent || "",
      list = choices(r),
      group = list.find((c) => c[0] === picked)?.[2] || r.actionGroup || "",
      faults = picked ? [...worksheetFaults(r, picked), eligibility(r, picked)].filter(Boolean) : ["Choose the next action."];
    const available = list.filter((c) => !eligibility(r, c[0])),
      options = available.filter((c) => c[2] === group);
    return (
      '<section class="card no-print r26-chooser" aria-label="Choose next actio' +
      'n"><div class="card-h"><h2>Choose next action</h2></div><div class="card' +
      '-b"><p>Use this physical inspection for one primary follow-up and compat' +
      "ible additional scoped documents. Each document has its own review; addi" +
      "ng one does not record another visit.</p><fieldset><legend>What should h" +
      'appen next?</legend><div class="r26-groups">' +
      groups
        .map(
          ([v, l]) =>
            '<label class="r26-choice"><input type="radio" name="action-group" data-action-group="' +
            v +
            '" ' +
            (group === v ? "checked" : "") +
            "> " +
            l +
            "</label>",
        )
        .join("") +
      "</div></fieldset>" +
      (group
        ? "<fieldset><legend>Available documents</legend>" +
          ["primary", "supplemental"]
            .map((kind) => {
              const items = options.filter((c) => (supplemental({ type: c[0] }) ? "supplemental" : "primary") === kind);
              return items.length
                ? '<h3 class="ri-action-heading">' +
                    (kind === "primary" ? "Primary follow-up" : "Additional scoped documents") +
                    "</h3>" +
                    items
                      .map(
                        (c) =>
                          '<label class="r26-choice"><input type="radio" name="action-type" data-action-type="' +
                          c[0] +
                          '" ' +
                          (picked === c[0] ? "checked" : "") +
                          "><span><strong>" +
                          e(c[1]) +
                          "</strong><small>" +
                          e(c[3]) +
                          "</small></span></label>",
                      )
                      .join("")
                : "";
            })
            .join("") +
          (!options.length
            ? "<p>No documents in this group are available for these results. Review th" + "e reasons below or choose another group.</p>"
            : "") +
          "</fieldset>"
        : "") +
      '<p aria-live="polite">' +
      (picked
        ? e((DOC_TYPES.find((t) => t.id === picked) || {}).label) +
          ": " +
          (faults.length ? e(faults[0]) : "Ready to create a draft. Review document details before issuance.")
        : "No action selected. Your outcomes stay on this worksheet; check the save status before leaving.") +
      '</p><button class="btn btn-primary" data-create-action ' +
      (faults.length ? "disabled" : "") +
      (">Create draft</button><details><summary>All document types (10 families)" +
        " / why unavailable</summary><ul><li>Official Notice — initial imported i" +
        "nspection only.</li>") +
      list
        .map(
          (c) =>
            "<li><strong>" +
            e(c[1]) +
            "</strong> (" +
            (supplemental({ type: c[0] }) ? "additional scoped document" : "primary follow-up") +
            "): " +
            e(eligibility(r, c[0]) || c[3]) +
            "</li>",
        )
        .join("") +
      "</ul></details></div></section>"
    );
  }
  function createSpecial(r, type) {
    if (r.docId && doc(r.docId)?.draft) {
      WriterState.state.docId = r.docId;
      WriterState.state.screen = "write";
      render();
      return;
    }
    const why = eligibility(r, type),
      faults = worksheetFaults(r, type);
    if (why || faults.length) {
      toast(why || faults[0]);
      return;
    }
    const existing = draftDocFor(r.caseId);
    if (existing) {
      WriterState.state.docId = existing.id;
      WriterState.state.screen = "write";
      render();
      toast("Resume the unfinished document before starting another.");
      return;
    }
    const src = doc(r.sourceDocId),
      s = requireDated(type, clone(r.actionDetails?.[type] || {}));
    s.originalDues = Object.fromEntries(src.items.map((i) => [i.no, i.due || ""]));
    const d = {
      id: uid("d"),
      caseId: r.caseId,
      type,
      authoringVersion: DATED_EXTENSIONS,
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
          id: uid("x"),
          srcItemId: i.id,
          due:
            (s.affected || []).includes(String(i.no)) &&
            s.extendedDues?.[i.no] &&
            (type === "bestInterestExtension" || (type === "vacancyExtension" && s.deadlineMode === "dated"))
              ? s.extendedDues[i.no]
              : i.due,
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
    WriterState.DOCS.unshift(d);
    if (r.draft) r.docId = d.id;
    WriterState.state.docId = d.id;
    WriterState.state.screen = "write";
    saveDrafts();
    render();
  }
  function specialLifecycle(d) {
    if (!specialType(d.type) || !d.draft || d.correction) return [];
    const faults = [],
      src = doc(d.fromDocId),
      r = reinsp(d.fromReinspId);
    if (stableJSON(d.expectedHead) !== stableJSON(recordHead(d.caseId)))
      faults.push("The case changed after this draft began. Review the current case before issuing.");
    if (d.initialAction) {
      if (docsFor(d.caseId).some((x) => isEffective(x) && !supplemental(x))) faults.push("Use the current issued case facts for this action.");
    } else {
      if (!src || !isEffective(src)) faults.push("The factual source is no longer effective.");
      const current = sourceDocFor(d.caseId);
      if (current && src && current.id !== src.id && !(supplemental(d) && r && current.fromReinspId === r.id))
        faults.push("The source changed. Review the current case before issuing.");
      if (d.administrativeAction && d.type !== "noOccupancy" && src?.type === "compliance")
        faults.push("A completed case cannot receive a new extension or ordinary enforcement action.");
      if (r) {
        faults.push(...worksheetFaults(r));
        if (r.sourceDocId !== src?.id || d.inspDate !== r.date || d.inspTime !== r.time)
          faults.push("The action must match its recorded inspection.");
      } else if (!d.administrativeAction) faults.push("Select the actual inspection for this action.");
      if (src && stableJSON(d.items.map((i) => [i.srcItemId, i.no])) !== stableJSON(src.items.map((i) => [i.id, i.no])))
        faults.push("Retain every source item identity, number and order.");
      if (r) {
        const why = eligibility(r, d.type);
        if (why) faults.push(why);
      }
    }
    return faults.map((t) => ({ ok: false, t }));
  }
  function servicePanel(d) {
    if (d.type !== "nonSummaryAbatement" || d.draft || !isEffective(d)) return "";
    const records = d.serviceRecords || [],
      latest = records[records.length - 1],
      key = "service:" + d.id,
      form = WriterState.WORK.recordForms[key] || {},
      field = (k, l, type = "text") =>
        '<label class="f"><span>' + l + '</span><input type="' + type + '" data-service-field="' + k + '" value="' + e(form[k] || "") + '"></label>';
    return (
      '<section class="card no-print"><div class="card-h"><h2>Service and court' +
      ' evidence</h2></div><div class="card-b"><p>Issuance does not establish s' +
      "ervice or publication. The remedy period is distinct from the order comp" +
      "liance date. Court restrictions and City abatement require separate exte" +
      "rnal decisions.</p>" +
      (latest
        ? "<p><strong>Latest recorded evidence:</strong> " +
          e(latest.method) +
          " on " +
          date(latest.date) +
          " — " +
          e(latest.reference) +
          (latest.courtRestriction ? " · Court restriction: " + e(latest.courtReference) : "") +
          "</p>"
        : "<p>No completed service / publication recorded.</p>") +
      '<fieldset class="grid g2" aria-label="Service evidence" ' +
      (WriterState.state.publicationBusy === d.id ? "disabled" : "") +
      ('><label class="f"><span>Actual method</span><select data-service-field="' +
        'method"><option value="">Choose…</option><option value="service" ') +
      (form.method === "service" ? "selected" : "") +
      '>Service</option><option value="publication" ' +
      (form.method === "publication" ? "selected" : "") +
      ">Publication</option></select></label>" +
      field("date", "Actual service / publication date", "date") +
      field("reference", "Supporting record / evidence") +
      field("courtReference", "Court restriction reference (if applicable)") +
      '</fieldset><button class="btn" ' +
      (WriterState.state.publicationBusy === d.id ? "disabled" : "") +
      ' data-save-service="' +
      e(d.id) +
      '">' +
      (latest ? "Record corrected / additional evidence" : "Record completed service / publication") +
      "</button></div></section>"
    );
  }
  async function saveService(docId) {
    const d = doc(docId),
      key = "service:" + docId,
      form = WriterState.WORK.recordForms[key] || {},
      old = (d?.serviceRecords || []).at(-1);
    if (
      !d ||
      !["service", "publication"].includes(form.method) ||
      !validISO(form.date) ||
      form.date < d.mailed ||
      form.date > day() ||
      text(form.reference).length < 10
    ) {
      toast("Enter the actual past service / publication date, method and supporting evidence.");
      return;
    }
    const attempt = {
      id: evid(),
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
    if (await commitRecordAttempt(d.caseId, attempt)) {
      delete WriterState.WORK.recordForms[key];
      saveDrafts();
      render();
    }
  }
  function releaseVisit(d) {
    const s = d.special || {};
    if (d.type !== "noOccupancy" || s.mode !== "release" || s.releaseVisitId !== "external") return null;
    d.releaseVisitIdentity = d.releaseVisitIdentity || uid("r");
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
    if (snow.is(d)) return "";
    if (d.draft) return "";
    const restrictions = activeRestrictions(docsFor(d.caseId));
    return (
      servicePanel(d) +
      '<section class="card no-print"><div class="card-b">' +
      (restrictions.length
        ? '<p class="r26-restriction"><strong>Continuing No Occupancy restriction:</strong> ' +
          restrictions.map((x) => e(scope(x, x.special))).join("; ") +
          ". Compliance and extension letters do not release it.</p>"
        : "") +
      (d.initialAction && !originalNotice(d.caseId) && isEffective(d)
        ? '<button class="btn" data-initial-notice="' + e(d.id) + '">Create Official Notice from this initial inspection</button>'
        : "") +
      (d.fromReinspId && isEffective(d)
        ? '<button class="btn" data-another-action="' + e(d.fromReinspId) + '">Add another document for this inspection</button>'
        : "") +
      (isEffective(d)
        ? '<button class="btn" data-case-action="' + e(d.caseId) + '">Create a scoped order / administrative letter from current case facts</button>'
        : "") +
      "</div></section>"
    );
  }
  function caseAction(cid, type) {
    if (snow.isCase(kase(cid))) {
      toast("Snow cases offer only the snow citation. Import a new inspection or correct the issued citation.");
      return null;
    }
    if (!type) {
      WriterState.WORK.currentAction = { cid, type: "", group: "" };
      WriterState.state.screen = "caseactions";
      saveDrafts();
      render();
      return;
    }
    const pending = draftDocFor(cid);
    if (pending) {
      WriterState.state.docId = pending.id;
      WriterState.state.screen = "write";
      render();
      return;
    }
    const src = sourceDocFor(cid) || docsFor(cid).find(isEffective);
    if (!src) return;
    WriterState.state.modal = null;
    WriterState.state.screen = "write";
    const factual = reinspFor(cid)
      .filter((r) => !r.draft && r.sourceDocId === src.id)
      .sort((a, b) => b.date.localeCompare(a.date) || String(b.recordedAt || "").localeCompare(String(a.recordedAt || "")))[0];
    const d = {
      id: uid("d"),
      caseId: cid,
      type,
      draft: true,
      status: "Draft",
      created: day(),
      mailed: "",
      cc: "",
      cits: {},
      authoringVersion: DATED_EXTENSIONS,
      administrativeAction: true,
      fromDocId: src.id,
      expectedHead: recordHead(cid),
      factualVisitId: factual?.id || "",
      inspectorId: factual?.inspectorId || docInsp(src).id,
      inspDate: factual?.date || inspAt(src).date,
      inspTime: factual?.time || inspAt(src).time,
      special: requireDated(type, { originalDues: Object.fromEntries(src.items.map((i) => [i.no, i.due || ""])) }),
      items: continuingItems(src).map((i) => ({ ...clone(i), id: uid("x"), srcItemId: i.id, cite: false })),
    };
    WriterState.DOCS.unshift(d);
    WriterState.state.docId = d.id;
    saveDrafts();
    render();
  }
  function caseActionScreen() {
    const choice = WriterState.WORK.currentAction || {},
      k = kase(choice.cid),
      referred = docsFor(choice.cid).some((d) => isEffective(d) && isHistoryDoc(d)),
      closed = sourceDocFor(choice.cid)?.type === "compliance";
    const why = (t) =>
      t.effect === "items" && (referred || closed)
        ? referred
          ? "Case is with the City Attorney; extensions remain unavailable."
          : "The case’s violations are complete."
        : "";
    return shell(
      k.address || "Current case action",
      k.number || "",
      '<button class="btn" data-nav="cases">Workspace</button>',
      '<section class="card no-print r26-chooser"><div class="card-h"><h2>Choos' +
        'e next action from current case facts</h2></div><div class="card-b"><p>A' +
        "dministrative letters cite the actual existing inspection. New observati" +
        "ons require a real recorded inspection. Existing restrictions continue u" +
        "ntil a documented release.</p><fieldset><legend>Action group</legend><di" +
        'v class="r26-groups">' +
        groups
          .filter((g) => g[0] !== "compliance")
          .map(
            ([v, l]) =>
              '<label class="r26-choice"><input type="radio" name="case-action-group" data-case-action-group="' +
              v +
              '" ' +
              (choice.group === v ? "checked" : "") +
              "> " +
              l +
              "</label>",
          )
          .join("") +
        "</div></fieldset>" +
        (choice.group
          ? "<fieldset><legend>Document</legend>" +
            NEW_TYPES.filter((t) => t.group === choice.group)
              .map(
                (t) =>
                  '<label class="r26-choice"><input type="radio" name="case-action-type" data-case-action-type="' +
                  t.id +
                  '" ' +
                  (choice.type === t.id ? "checked" : "") +
                  " " +
                  (why(t) ? "disabled" : "") +
                  "><span>" +
                  e(t.label) +
                  (why(t) ? "<small>" + e(why(t)) + "</small>" : "") +
                  "</span></label>",
              )
              .join("") +
            "</fieldset>"
          : "") +
        '<button class="btn btn-primary" data-create-case-action ' +
        (!choice.type ? "disabled" : "") +
        ">Create draft</button></div></section>",
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
      d = doc(WriterState.state.docId),
      r = reinsp(WriterState.state.reinspId);
    if (el.dataset.caseActionGroup) {
      WriterState.WORK.currentAction.group = el.dataset.caseActionGroup;
      WriterState.WORK.currentAction.type = "";
      saveDrafts();
      refreshControls(el);
      return true;
    }
    if (el.dataset.caseActionType) {
      WriterState.WORK.currentAction.type = el.dataset.caseActionType;
      saveDrafts();
      refreshControls(el);
      return true;
    }
    if (el.dataset.serviceField && d) {
      const key = "service:" + d.id;
      WriterState.WORK.recordForms[key] = WriterState.WORK.recordForms[key] || {};
      WriterState.WORK.recordForms[key][el.dataset.serviceField] = el.value;
      scheduleDraftSave();
      return true;
    }
    if (el.dataset.actionGroup && r) {
      r.actionGroup = el.dataset.actionGroup;
      r.followupIntent = "";
      WriterState.WORK.actionChoices = WriterState.WORK.actionChoices || {};
      WriterState.WORK.actionChoices[r.id] = { intent: "", group: r.actionGroup };
      saveDrafts();
      refreshControls(el);
      return true;
    }
    if (el.dataset.actionType && r) {
      r.followupIntent = el.dataset.actionType;
      WriterState.WORK.actionChoices = WriterState.WORK.actionChoices || {};
      WriterState.WORK.actionChoices[r.id] = { intent: r.followupIntent, group: r.actionGroup };
      saveDrafts();
      refreshControls(el);
      return true;
    }
    if (el.dataset.special === "administrativeType" && d && d.draft) {
      d.selectionCache = d.selectionCache || {};
      d.selectionCache[d.type] = clone(d.special || {});
      d.items.forEach((i) => (i.due = d.special?.originalDues?.[i.no] ?? i.due));
      d.type = el.value;
      d.special = clone(d.selectionCache[d.type] || { originalDues: Object.fromEntries(d.items.map((i) => [i.no, i.due || ""])) });
      if (datedExtension(d)) requireDated(d.type, d.special);
      restoreDues(d);
      saveDrafts();
      refreshControls(el);
      return true;
    }
    if (!d || isLocked(d) || !specialType(d.type)) return false;
    const s = d.special || (d.special = {});
    if (el.dataset.special) {
      const k = el.dataset.special;
      if (k !== "reviewed") {
        s.reviewed = false;
        const box = document.querySelector('[data-special="reviewed"]');
        if (box) box.checked = false;
      }
      s[k] = el.type === "checkbox" ? el.checked : el.value;
      if (k === "deadlineMode") restoreDues(d);
      if (k === "variant") s.authority = NUISANCES.find((v) => v[0] === s.variant)?.[2] || "";
      if (d.fromReinspId) {
        const visit = reinsp(d.fromReinspId);
        if (visit) {
          visit.actionDetails = visit.actionDetails || {};
          visit.actionDetails[d.type] = clone(s);
        }
      }
      scheduleDraftSave();
      if (
        ev.type === "change" &&
        ["scope", "variant", "mode", "posting", "boarding", "stage", "expiryMode", "deadlineMode", "releaseVisitId"].includes(k)
      ) {
        refreshControls(el);
      } else refreshSheet();
      return true;
    }
    if (el.dataset.specialItem) {
      s.reviewed = false;
      const box = document.querySelector('[data-special="reviewed"]');
      if (box) box.checked = false;
      const no = el.dataset.specialItem;
      s.affected = s.affected || [];
      s.affected = el.checked ? [...new Set([...s.affected, no])] : s.affected.filter((x) => x !== no);
      restoreDues(d);
      cacheDetails(d);
      saveDrafts();
      refreshControls(el);
      return true;
    }
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
  function invalidateItemReview(d) {
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
    scheduleDraftSave();
    refreshSheet();
  }
  function clickEvent(ev) {
    const el = ev.target.closest(
      "[data-create-action],[data-another-action],[data-case-action],[data-save" + "-service],[data-create-case-action],[data-initial-notice]",
    );
    if (!el) return false;
    if (el.dataset.initialNotice) {
      const src = doc(el.dataset.initialNotice);
      if (src && !originalNotice(src.caseId) && !draftDocFor(src.caseId)) {
        newDoc(src.caseId, "notice");
        const d = doc(WriterState.state.docId);
        d.items = src.items.map((i) => ({ ...clone(i), id: uid("x"), srcItemId: i.id }));
        saveDrafts();
        render();
      }
      return true;
    }
    if (el.hasAttribute("data-create-case-action")) {
      const c = WriterState.WORK.currentAction;
      if (c?.type) caseAction(c.cid, c.type);
      return true;
    }
    if (el.dataset.saveService) {
      saveService(el.dataset.saveService);
      return true;
    }
    if (el.hasAttribute("data-create-action")) {
      const r = reinsp(WriterState.state.reinspId);
      if (r && r.followupIntent) {
        if (specialType(r.followupIntent)) createSpecial(r, r.followupIntent);
        else docFromReinspection(r, r.followupIntent);
      }
      return true;
    }
    if (el.dataset.anotherAction) {
      const r = reinsp(el.dataset.anotherAction);
      if (r) {
        WriterState.state.reinspId = r.id;
        WriterState.state.screen = "actions";
        render();
      }
      return true;
    }
    if (el.dataset.caseAction) {
      caseAction(el.dataset.caseAction);
      return true;
    }
    return false;
  }
  function actionScreen() {
    const r = reinsp(WriterState.state.reinspId);
    return r
      ? shell(
          "Add document for this inspection",
          kase(r.caseId).number + " · " + date(r.date),
          '<button class="btn" data-nav="cases">Workspace</button>',
          chooser(r),
        )
      : screenCases();
  }
  return {
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
