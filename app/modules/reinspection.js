import { recordDay, validCaseNumber } from "../assets/shared.js";
import { stableJSON, clone } from "./record_values.js";
import { DOC_TYPES, OUTCOMES, REFERRED_ONLY, courtTime } from "./document_types.js";
import {
  doc,
  docCase,
  doneItems,
  insp,
  isReferredCase,
  kase,
  originalNotice,
  reinsp,
  unchecked,
  openItems,
  reinspFor,
  recordHead,
} from "./writer_queries.js";
import { daysBetween } from "./calendar.js";
import { esc, checkTarget, itemSelector, checkAttr, citSelector, markBlanks } from "./presentation_format.js";
import { ocOf, dueItems, distinctDues, itemLibraryKey, isEffective, supplemental } from "./document_rules.js";
import { isLLC } from "./mailing_rules.js";
import { INSPECTORS } from "./data/inspectors.js";
import { WriterState } from "./state.js";
import { canonicalOrdinance } from "./citation_policy.js";

/* Explicit lazy UI/peer adapters preserve worksheet and walkthrough state at call time. */
export function createReinspection(services) {
  /* app functions; direct dependencies use explicit shared state. */

  function walkIdentity(r) {
    return r && r.caseId + "|" + r.id + "|" + r.sourceDocId;
  }

  function clearWalk() {
    WriterState.state.riWalk = false;
    WriterState.state.riWalkContext = null;
    WriterState.state.riWalkItem = null;
    WriterState.state.riWalkUndo = null;
    WriterState.state.riWalkSkipped = [];
    WriterState.state.riWalkStage = "outcome";
  }

  function restoreWalkFor(r) {
    const saved = WriterState.WORK.walk;
    if (saved?.context !== walkIdentity(r)) {
      WriterState.WORK.walk = null;
      return;
    }
    WriterState.state.riWalk = true;
    WriterState.state.riWalkContext = saved.context;
    WriterState.state.riWalkItem = saved.item;
    WriterState.state.riWalkUndo = saved.undo || null;
    WriterState.state.riWalkMode = saved.mode === "details" ? "details" : "quick";
    WriterState.state.riWalkSkipped = Array.isArray(saved.skipped) ? saved.skipped : [];
    WriterState.state.riWalkStage = saved.stage === "details" ? "details" : "outcome";
    if (!ensureWalkContext()) WriterState.WORK.walk = null;
  }

  function ensureWalkContext() {
    const r = WriterState.state.screen === "reinspect" && reinsp(WriterState.state.reinspId);
    if (!r || !r.draft || r.docId || WriterState.state.riWalkContext !== walkIdentity(r)) {
      clearWalk();
      return false;
    }
    const src = doc(r.sourceDocId);
    if (!src || src.caseId !== r.caseId) {
      clearWalk();
      return false;
    }
    if (
      WriterState.state.riWalkItem &&
      !src.items.some((it) => it.id === WriterState.state.riWalkItem && !it.withdrawn && !(r.results[it.id] || {}).carried)
    ) {
      clearWalk();
      return false;
    }
    if (WriterState.state.riWalkUndo && !src.items.some((it) => it.id === WriterState.state.riWalkUndo.itemId && !it.withdrawn))
      WriterState.state.riWalkUndo = null;
    WriterState.state.riWalkSkipped = WriterState.state.riWalkSkipped.filter((id) =>
      src.items.some((it) => it.id === id && !it.withdrawn && !(r.results[id] || {}).carried),
    );
    return true;
  }

  function nextWalkItem(r) {
    const src = r && doc(r.sourceDocId);
    return (src && src.items.find((it) => !it.withdrawn && !(r.results[it.id] || {}).carried && !ocOf(r, it.id))) || null;
  }

  function focusWalkItem() {
    const current = document.querySelector('[data-ri-walk-current="true"]');
    if (!current) {
      document.querySelector('[data-riwalk="off"]')?.focus();
      return;
    }
    const action = current.querySelector("[data-setoc]:not([disabled])");
    if (action) action.focus();
    else current.focus();
    if (current.scrollIntoView) current.scrollIntoView({ block: "center", behavior: "smooth" });
  }

  function focusWalkDetails() {
    const current = document.querySelector('[data-ri-walk-current="true"]');
    const el = current?.querySelector("[data-rinote], [data-ridate]");
    if (el) {
      el.focus();
      el.scrollIntoView?.({ block: "center" });
    } else focusWalkItem();
  }

  function walkItemReady(r, id) {
    if (!editableWalkItem(r, id)) return false;
    const result = r.results[id] || {},
      intent = r.followupIntent || "undecided";
    const source = doc(r.sourceDocId),
      on = result.manualDate ? result.on : result.on || r.date;
    if (!result.oc || !services.validISO(on) || on < docCase(source).date || on > r.date) return false;
    if (result.oc === "corrected") return true;
    return !["extension", "bestInterestExtension", "citation"].includes(intent) || dueCheck(result.due, r.date).ok;
  }

  function advanceWalk(r) {
    if (!WriterState.state.riWalk || !ensureWalkContext()) return false;
    if (
      WriterState.state.riWalkStage === "details" &&
      WriterState.state.riWalkItem &&
      !walkItemReady(r, WriterState.state.riWalkItem) &&
      !WriterState.state.riWalkSkipped.includes(WriterState.state.riWalkItem)
    ) {
      services.toast("This item needs a valid date and, for an extension or citation, a new due date. Use Skip for now to continue.");
      focusWalkDetails();
      return false;
    }
    const next = nextWalkItem(r);
    WriterState.state.riWalkItem = next?.id || null;
    WriterState.state.riWalkStage = "outcome";
    services.scheduleDraftSave();
    services.render();
    focusWalkItem();
    return true;
  }

  function skipWalkDetails(r) {
    if (!WriterState.state.riWalk || !ensureWalkContext() || WriterState.state.riWalkStage !== "details") return false;
    if (!WriterState.state.riWalkSkipped.includes(WriterState.state.riWalkItem)) WriterState.state.riWalkSkipped.push(WriterState.state.riWalkItem);
    services.scheduleDraftSave();
    return advanceWalk(r);
  }

  function returnWalkDetails(r) {
    if (!WriterState.state.riWalk || !ensureWalkContext()) return false;
    const src = doc(r.sourceDocId),
      item = src.items.find((it) => editableWalkItem(r, it.id) && (!walkItemReady(r, it.id) || WriterState.state.riWalkSkipped.includes(it.id)));
    if (!item) return false;
    WriterState.state.riWalkItem = item.id;
    WriterState.state.riWalkStage = ocOf(r, item.id) ? "details" : "outcome";
    WriterState.state.riWalkSkipped = WriterState.state.riWalkSkipped.filter((id) => id !== item.id);
    services.scheduleDraftSave();
    services.render();
    WriterState.state.riWalkStage === "details" ? focusWalkDetails() : focusWalkItem();
    return true;
  }

  function previousWalk(r) {
    if (!WriterState.state.riWalk || !ensureWalkContext()) return false;
    const src = doc(r.sourceDocId),
      eligible = src.items.filter((i) => editableWalkItem(r, i.id));
    const ix = eligible.findIndex((i) => i.id === WriterState.state.riWalkItem),
      prior = eligible[ix < 0 ? eligible.length - 1 : ix - 1];
    if (!prior) return false;
    WriterState.state.riWalkItem = prior.id;
    WriterState.state.riWalkStage = ocOf(r, prior.id) ? "details" : "outcome";
    services.scheduleDraftSave();
    services.render();
    WriterState.state.riWalkStage === "details" ? focusWalkDetails() : focusWalkItem();
    return true;
  }

  function editableWalkItem(r, id) {
    const src = r && doc(r.sourceDocId),
      it = src && src.caseId === r.caseId && src.items.find((x) => x.id === id);
    return !!(
      WriterState.state.screen === "reinspect" &&
      r &&
      r.id === WriterState.state.reinspId &&
      r.draft &&
      !r.docId &&
      it &&
      !it.withdrawn &&
      !(r.results[id] || {}).carried
    );
  }

  function recordReinspectionOutcome(id, outcome) {
    const r = reinsp(WriterState.state.reinspId);
    if (!editableWalkItem(r, id) || !OUTCOMES.some((o) => o.id === outcome)) return false;
    if (WriterState.state.riWalk && (!ensureWalkContext() || !WriterState.state.riWalk)) return false;
    const cur = r.results[id] || {};
    if (cur.oc === outcome) return false;
    const before = Object.prototype.hasOwnProperty.call(r.results, id) ? clone(cur) : null;
    const result = {
      oc: outcome,
      on: cur.on || r.date,
      manualDate: !!cur.manualDate,
      due: outcome === "corrected" ? "" : cur.due || "",
      note: cur.note || "",
      cite: outcome === "corrected" ? false : !!cur.cite,
    };
    if (WriterState.state.riWalk) WriterState.state.riWalkUndo = { context: walkIdentity(r), itemId: id, before, after: clone(result) };
    else WriterState.state.riWalkUndo = null;
    r.results[id] = result;
    WriterState.state.riWalkSkipped = WriterState.state.riWalkSkipped.filter((x) => x !== id);
    if (WriterState.state.riWalk) {
      if (WriterState.state.riWalkMode === "details") {
        WriterState.state.riWalkItem = id;
        WriterState.state.riWalkStage = "details";
      } else {
        const next = nextWalkItem(r);
        WriterState.state.riWalkItem = (next && next.id) || null;
        WriterState.state.riWalkStage = "outcome";
      }
    }
    WriterState.DIRTY = true;
    services.scheduleDraftSave();
    if (WriterState.state.riWalk) {
      services.render();
      WriterState.state.riWalkStage === "details" ? focusWalkDetails() : focusWalkItem();
    } else services.renderKeep();
    return true;
  }

  function undoWalkOutcome() {
    const r = reinsp(WriterState.state.reinspId),
      undo = WriterState.state.riWalkUndo;
    if (!WriterState.state.riWalk || !ensureWalkContext() || !undo || undo.context !== walkIdentity(r) || !editableWalkItem(r, undo.itemId))
      return false;
    const current = r.results[undo.itemId];
    if (!current || current.oc !== undo.after.oc) {
      services.toast("The outcome changed since Undo was recorded. Review the item before changing it.");
      return false;
    }
    if (stableJSON(current) === stableJSON(undo.after)) {
      if (undo.before) r.results[undo.itemId] = clone(undo.before);
      else delete r.results[undo.itemId];
    } else {
      r.results[undo.itemId] = { ...clone(current), oc: undo.before?.oc || "" };
      services.toast("Outcome undone; later note, date and due details were kept on this item.");
    }
    WriterState.state.riWalkUndo = null;
    WriterState.state.riWalkItem = undo.itemId;
    WriterState.state.riWalkStage = "outcome";
    WriterState.DIRTY = true;
    services.scheduleDraftSave();
    services.render();
    focusWalkItem();
    return true;
  }

  function narrativeFor(r, it) {
    const k = kase(r.caseId),
      src = doc(r.sourceDocId),
      oc = ocOf(r, it.id),
      res = r.results[it.id] || {};
    const first = originalNotice(r.caseId),
      firstDate = (first && k.date) || k.date || (first || {}).created;
    const what = String(it.title || "the violation").replace(/\.$/, "");
    const label = (DOC_TYPES.find((t) => t.id === (src || {}).type) || {}).label || "notice";
    const art = /^[AEIOU]/i.test(label) ? "An " : "A ";
    return (
      "Initial inspection on " +
      services.fmtDate(firstDate) +
      " documented the following violation: " +
      what +
      ". " +
      art +
      label.toLowerCase() +
      " was issued with a compliance date of " +
      services.fmtDate(it.due) +
      ". " +
      "Re-inspection on " +
      services.fmtDate(res.on || r.date) +
      " found " +
      ((OUTCOMES.find((o) => o.id === oc) || {}).found || "the violation uncorrected") +
      "." +
      (res.note ? " " + String(res.note).trim().replace(/\s+/g, " ") : "")
    );
  }

  function attachCheckTargets(d, c) {
    if (c.ok || c.targets?.length) return c;
    const t = c.t.toLowerCase(),
      targets = [],
      add = (s, l, a) => targets.push(checkTarget(s, l, a));
    const visit = () => add("#btn-editvisit", "Review inspection", "visit");
    // The parcel comes only from the Accela import; its check names that correction instead of a field.
    if (/parcel/.test(t)) return c;
    else if (/registered agent/.test(t))
      ["name", "addr", "city"].forEach((f) => add('[data-agent="' + f + '"]', "Registered agent " + f, "contacts"));
    else if (/mailing block/.test(t)) add('[data-case="ownerBlock"]', "Mailing block");
    else if (/case number/.test(t)) {
      if (!validCaseNumber(docCase(d).number)) add('[data-case="number"]', "Case number");
      if (!docCase(d).address) add('[data-case="address"]', "Property address");
    } else if (/signing/.test(t)) add('[data-doc="inspectorId"]', "Signing inspector");
    else if (/explain the error/.test(t)) add("#correction-reason", "Correction reason");
    else if (/amendment instructions/.test(t)) add("#correction-external", "Amendment reference");
    else if (/original action date/.test(t)) add("#correction-action-date", "Original action date");
    else if (/mailing date|mailed date/.test(t)) add('[data-doc="mailed"]', "Mailed date");
    else if (/inspection|outcome|result date|compliance date|marked corrected/.test(t) && d.fromReinspId && !d.correction) visit();
    else if (/inspection date/.test(t)) add(d.inspDate !== undefined ? '[data-doc="inspDate"]' : '[data-case="date"]', "Inspection date");
    else if (/three distinct due dates/.test(t)) dueItems(d).forEach((i) => add(itemSelector(i.id, "due"), "Item " + i.no + " due date"));
    else if (/duplicate items|only once/.test(t)) d.items.forEach((i) => add('[data-del="' + checkAttr(i.id) + '"]', "Item " + i.no));
    else if (/citation|deposit|court|officer/.test(t)) {
      d.items
        .filter((i) => i.cite && !i.withdrawn)
        .forEach((i) => {
          const cc = (d.cits || {})[i.id] || {};
          let fields = /court date/.test(t)
            ? ["courtDate"]
            : /badge|officer/.test(t)
              ? ["deptId"]
              : /unique citation|citation number/.test(t)
                ? ["num"]
                : /issue dates/.test(t)
                  ? ["issued"]
                  : /deposit/.test(t)
                    ? [
                        "depositMode",
                        "ord",
                        ...(cc.depositMode === "total" ? ["amount"] : ["base", "cc"]),
                        ...(cc.depositMode && cc.depositMode !== "schedule" ? ["depositSource"] : []),
                      ]
                    : ["num", "courtDate", "amount", "ord", "desc"].filter((f) => !String(cc[f] || "").trim());
          fields.forEach((f) => add(citSelector(i.id, f), "Item " + i.no + " · " + f));
        });
    } else if (/withdrawn item needs/.test(t))
      d.items
        .filter((i) => i.withdrawn && String(i.withdrawalReason || "").trim().length < 10)
        .forEach((i) => add('[data-withdraw="' + checkAttr(i.id) + '"]', "Item " + i.no + " withdrawal reason"));
    else if (/compliance dates/.test(t))
      d.items
        .filter((i) => i.done && !i.withdrawn && (!services.validISO(i.doneOn) || i.doneOn > recordDay(today) || i.doneOn < docCase(d).date))
        .forEach((i) => add(itemSelector(i.id, "doneOn"), "Item " + i.no + " compliance date"));
    // Record conflicts have no editable field. Direct the inspector to the existing case.
    if (!targets.length) add('[data-nav="cases"]', "Open case in Workspace", "workspace");
    return { ...c, targets };
  }

  function checkRowHTML(c, ix, worksheet = false) {
    return (
      '<div class="check ' +
      `${c.ok ? "pass" : c.soft ? "note" : "fail"}` +
      '"><span class="m">' +
      `${c.ok ? "✓" : c.soft ? "·" : "!"}` +
      '</span><div><span id="check-msg-' +
      `${worksheet ? "visit" : "doc"}` +
      "-" +
      `${ix}` +
      '">' +
      `${esc(c.t)}` +
      "</span>" +
      "".concat(
        !c.ok
          ? '<div class="check-links">' +
              "".concat(
                (c.targets || [])
                  .map(
                    (target, n) =>
                      '<button type="button" class="check-link" data-check-index="' +
                      `${ix}` +
                      '" data-check-target="' +
                      `${n}` +
                      '" ' +
                      `${worksheet === true ? 'data-check-worksheet="1"' : ""}` +
                      ">" +
                      `${esc(target.label)}` +
                      "</button>",
                  )
                  .join(""),
              ) +
              "</div>"
          : "",
      ) +
      "</div></div>"
    );
  }

  function worksheetChecks(r) {
    const src = doc(r.sourceDocId);
    if (!src) return [];
    const out = [],
      add = (t, selector, label) => out.push({ ok: false, t, targets: [checkTarget(selector, label)] });
    const dueRelevant =
      !r.followupIntent || r.followupIntent === "undecided" || ["extension", "bestInterestExtension", "citation"].includes(r.followupIntent);
    const initial = docCase(src).date || "",
      earliest = services.inspAt(src).date || initial;
    if (!services.validISO(r.date) || r.date > recordDay(today) || r.date < earliest)
      add("Inspection date must be between the source inspection and today.", "#ri-date", "Reinspection date");
    if (!services.parseTime(r.time)) add("Enter the reinspection time before generating a document.", "#ri-time", "Reinspection time");
    if (!insp(r.inspectorId).name) add("Select the inspector who performed this inspection.", "#ri-insp", "Inspector");
    src.items.forEach((i) => {
      const res = r.results[i.id] || {},
        on = res.manualDate ? res.on : res.on || r.date;
      if (i.done || i.withdrawn) return;
      if (!OUTCOMES.some((o) => o.id === res.oc))
        add("Item " + i.no + ": choose an outcome.", '[data-setoc][data-item="' + checkAttr(i.id) + '"]', "Item " + i.no + " outcome");
      else {
        if (!services.validISO(on) || on < initial || on > r.date)
          add(
            "Item " + i.no + ": result date must be between the initial inspection and this visit.",
            '[data-ridate="' + checkAttr(i.id) + '"]',
            "Item " + i.no + " result date",
          );
        if (dueRelevant && res.oc !== "corrected" && !dueCheck(res.due, recordDay(today)).ok)
          out.push({
            ok: false,
            soft: true,
            t: "Item " + i.no + ": set a future due date for an extension or citation. Referrals need no due date.",
            targets: [checkTarget('[data-ridue="' + checkAttr(i.id) + '"]', "Item " + i.no + " new due date")],
          });
      }
    });
    if (dueRelevant && distinctDues(services.dueContext(r, true)).length > 3)
      out.push({
        ok: false,
        t: "Use no more than three distinct due dates for an extension or citation.",
        targets: services.dueContext(r, true).map((i) => checkTarget('[data-ridue="' + checkAttr(i.id) + '"]', "Item " + i.no + " new due date")),
      });
    const spacing = services.dueDateSpacingConflicts(services.dueContext(r, true));
    if (dueRelevant && spacing.length) {
      const items = [...new Map(spacing.flatMap((x) => x.items).map((i) => [i.id, i])).values()];
      out.push({
        ok: false,
        t: "Keep distinct due dates at least seven days apart.",
        targets: items.map((i) => checkTarget('[data-ridue="' + checkAttr(i.id) + '"]', "Item " + i.no + " new due date")),
      });
    }
    for (const t of services.worksheetFaults(r))
      if (!out.some((c) => c.t === t) && !/outcome|Result dates/.test(t))
        out.push({ ok: false, t, targets: [checkTarget('[data-nav="cases"]', "Open case in Workspace", "workspace")] });
    return out;
  }

  function worksheetCheckPanel(r) {
    const list = worksheetChecks(r);
    return list.length
      ? '<section class="card no-print"><div class="card-h"><h2>Inspection checks' +
          '</h2></div><div class="card-b">' +
          `${list.map((c, ix) => checkRowHTML(c, ix, true)).join("")}` +
          "</div></section>"
      : "";
  }

  function highlightOpenChecks() {
    document.querySelectorAll(".check-open").forEach((el) => {
      el.classList.remove("check-open");
      el.removeAttribute("data-open-check");
      if (el.dataset.checkDesc) {
        el.removeAttribute("data-check-desc");
        el.removeAttribute("aria-describedby");
      }
      el.removeAttribute("aria-invalid");
    });
    const d = doc(WriterState.state.docId),
      r = reinsp(WriterState.state.reinspId);
    const list =
      WriterState.state.screen === "write" && d && !services.isLocked(d)
        ? services.checks(d)
        : WriterState.state.screen === "reinspect" && r && r.draft && !r.docId
          ? worksheetChecks(r)
          : [];
    list.forEach((c, ix) => {
      if (c.ok) return;
      (c.targets || []).forEach((t) => {
        if (t.action && !["contacts"].includes(t.action) && !t.action.startsWith("recipient:")) return;
        document.querySelectorAll(t.selector).forEach((el) => {
          el.classList.add("check-open");
          el.setAttribute("data-open-check", c.t);
          const id =
            (WriterState.state.screen === "write" && !WriterState.state.modal ? "editor-" : "") +
            "check-msg-" +
            (WriterState.state.screen === "reinspect" ? "visit" : "doc") +
            "-" +
            ix;
          if (document.getElementById(id) && !el.getAttribute("aria-describedby")) {
            el.setAttribute("aria-describedby", id);
            el.dataset.checkDesc = id;
          }
          if (!c.soft) el.setAttribute("aria-invalid", "true");
        });
      });
    });
  }

  function focusCheckTarget(target, message) {
    const d = doc(WriterState.state.docId);
    services.captureWork();
    WriterState.state.modal = null;
    WriterState.state.picker = false;
    if (target.action === "workspace") {
      services.openImportWorkspace(d?.caseId || reinsp(WriterState.state.reinspId)?.caseId);
      return;
    }
    if (target.action === "catalog") {
      WriterState.state.screen = "library";
      WriterState.state.languageMode = "admin";
      WriterState.state.catalogAdminStatus = "review";
      const it = doc(WriterState.state.docId)?.items.find((i) => i.id === target.itemId);
      if (it) WriterState.state.catalogAdminKey = itemLibraryKey(it);
      services.render();
      return;
    }
    if (target.action?.startsWith("recipient:")) {
      const k = d && docCase(d);
      if (!k) return;
      WriterState.state.ccProblem = services.validateAndStandardizeAddresses(k, d.type === "citation" && isLLC(k), false);
      WriterState.state.modal = "cc";
      services.render();
      const parts = target.action.split(":");
      const exact = parts[1] === "agent" ? '[data-agent="' + parts[3] + '"]' : '[data-cc="' + parts[2] + "|" + parts[3] + '"]';
      const field = document.querySelector(WriterState.state.ccProblem?.selector || exact);
      field?.focus();
      field?.scrollIntoView?.({ block: "center" });
      return;
    }
    if (target.action === "visit") {
      if (!d || !services.returnToWorksheet(d)) {
        services.toast("Open the existing case in Workspace to review its recorded inspection.");
        return;
      }
      const r = reinsp(WriterState.state.reinspId);
      WriterState.state.riFilter = "";
      clearWalk();
      WriterState.WORK.walk = null;
      services.render();
      const check = worksheetChecks(r).find((c) => !c.soft) || worksheetChecks(r)[0];
      target = check?.targets[0] || checkTarget("#ri-date", "Reinspection date");
    } else {
      if (WriterState.state.screen === "reinspect") {
        WriterState.state.riFilter = "";
        clearWalk();
        WriterState.WORK.walk = null;
      }
      if (target.action === "contacts") WriterState.state.modal = "cc";
      services.render();
    }
    if (target.action === "guidance") {
      services.toast(message);
      return;
    }
    const el = document.querySelector(target.selector);
    if (!el) {
      services.toast(message + " Open the existing case to review the retained record.");
      return;
    }
    for (let parent = el.parentElement; parent; parent = parent.parentElement) if (parent.tagName === "DETAILS") parent.open = true;
    el.classList.add("check-focus");
    el.setAttribute("tabindex", el.getAttribute("tabindex") || "0");
    el.scrollIntoView?.({ behavior: "smooth", block: "center" });
    el.focus({ preventScroll: true });
    setTimeout(() => el.classList.remove("check-focus"), 2200);
  }

  function dueCheck(due, from) {
    if (!due) return { ok: false, msg: "Needs a new due date" };
    if (!services.validISO(due) || !services.validISO(from || recordDay(today))) return { ok: false, msg: "Enter a real calendar date" };
    const n = daysBetween(from || recordDay(today), due);
    if (n < 1) return { ok: false, msg: "Must be a future date" };
    if (n < 7) return { ok: true, warn: true, msg: n + " day" + (n === 1 ? "" : "s") + " — unusually short" };
    if (n > 180) return { ok: true, warn: true, msg: n + " days — unusually long" };
    return { ok: true, msg: n + " days" };
  }

  function screenReinspect() {
    const r = reinsp(WriterState.state.reinspId);
    if (!r) {
      WriterState.state.screen = "cases";
      return services.screenCases();
    }
    const k = kase(r.caseId),
      src = doc(r.sourceDocId);
    if (!src) {
      WriterState.state.screen = "cases";
      return services.screenCases();
    }
    const srcLabel = (DOC_TYPES.find((t) => t.id === src.type) || {}).label || src.type;
    const closed = !!r.docId,
      readOnly = closed || !r.draft;

    const shown = (it) => {
      const oc = ocOf(r, it.id);
      if (WriterState.state.riFilter === "corrected") return oc === "corrected";
      if (WriterState.state.riFilter === "open") return oc && oc !== "corrected" && oc !== "withdrawn";
      if (WriterState.state.riFilter === "todo") return !oc;
      return true;
    };
    const rows = src.items
      .filter(shown)
      .map((it) => {
        const ix = src.items.indexOf(it);
        const res = r.results[it.id] || {},
          oc = res.oc || "";
        const walkCurrent = !readOnly && WriterState.state.riWalk && WriterState.state.riWalkItem === it.id;
        const late = it.due && daysBetween(it.due, r.date) > 0;
        const open = oc && oc !== "corrected" && oc !== "withdrawn";
        const carried = !!res.carried,
          lock = readOnly || carried;
        const dc = open ? dueCheck(res.due, r.date) : null;
        const walkHidden = !readOnly && WriterState.state.riWalk && WriterState.state.riWalkItem && !walkCurrent;
        return (
          '<div class="ri-item ' +
          `${walkCurrent ? "ri-walk-current" : ""}` +
          '" data-ri-item="' +
          `${esc(it.id)}` +
          '" data-oc="' +
          `${esc(oc)}` +
          '" ' +
          `${walkHidden ? "hidden" : ""}` +
          " " +
          `${walkCurrent ? 'data-ri-walk-current="true" aria-current="step" tabindex="-1"' : ""}` +
          '>\n      <div class="ri-top">\n        <span class="ri-no">' +
          `${esc(it.no || String(ix + 1))}` +
          '.</span>\n        <span class="ri-ttl">' +
          `${esc(it.title || "Violation item")}` +
          "</span>\n        " +
          `${(it.sections || []).map((x) => `<span class="cite-sec">${esc(x)}</span>`).join("")}` +
          '\n        <span class="ri-due ' +
          `${late ? "over" : ""}` +
          '">Was due ' +
          `${services.fmtDate(it.due)}` +
          '</span>\n      </div>\n      <div class="ri-body">' +
          `${markBlanks(it.text || "")}` +
          '</div>\n      <div class="seg" role="group" aria-label="Result for item ' +
          `${esc(it.no || String(ix + 1))}` +
          '">\n        ' +
          "".concat(
            OUTCOMES.map(
              (o) =>
                '<button data-setoc="' +
                `${esc(o.id)}` +
                '" data-item="' +
                `${esc(it.id)}` +
                '" ' +
                `${lock ? "disabled" : ""}` +
                ' aria-pressed="' +
                `${oc === o.id ? "true" : "false"}` +
                '">' +
                `${esc(o.label)}` +
                "</button>",
            ).join(""),
          ) +
          "\n      </div>\n      " +
          "".concat(
            carried
              ? '<p class="ri-carried">' +
                  "".concat(
                    oc === "withdrawn"
                      ? "Withdrawn as entered in error; excluded from compliance counts."
                      : "Cleared on " + esc(services.fmtDate(res.on)) + " and carried forward.",
                  ) +
                  "</p>"
              : "",
          ) +
          "\n      " +
          "".concat(
            oc
              ? '<div class="ri-fields">\n        <label class="f"><span>Result date</span' +
                  '>\n          <input type="date" data-ridate="' +
                  `${esc(it.id)}` +
                  '" value="' +
                  `${esc(res.on || r.date)}` +
                  '" max="' +
                  `${recordDay(today)}` +
                  '" ' +
                  `${lock ? "disabled" : ""}` +
                  '><span class="hint">When this result was observed; no later than this vi' +
                  "sit.</span></label>\n        " +
                  "".concat(
                    open &&
                      (!r.followupIntent ||
                        r.followupIntent === "undecided" ||
                        ["extension", "bestInterestExtension", "citation"].includes(r.followupIntent))
                      ? '<label class="f"><span>Next due date</span>\n          <input type="date"' +
                          ' data-ridue="' +
                          `${esc(it.id)}` +
                          '" value="' +
                          `${esc(res.due || "")}` +
                          '" min="' +
                          `${services.MINDUE()}` +
                          '" ' +
                          `${lock ? "disabled" : ""}` +
                          '>\n          <span class="hint ' +
                          `${dc.ok ? (dc.warn ? "warnt" : "") : "badt"}` +
                          '">' +
                          `${esc(dc.msg)}` +
                          "</span></label>"
                      : "<div></div>",
                  ) +
                  '\n      </div>\n      <label class="f ri-note"><span>' +
                  `${oc === "noaccess" ? "Access attempt and observations" : "Notes " + (open ? "" : "(optional)")}` +
                  '</span>\n        <textarea rows="2" data-rinote="' +
                  `${esc(it.id)}` +
                  '" placeholder="What you observed, who you spoke to, anything worth havin' +
                  'g on the file" ' +
                  `${lock ? "disabled" : ""}` +
                  ">" +
                  `${esc(res.note || "")}` +
                  "</textarea>" +
                  "".concat(
                    oc === "noaccess"
                      ? '<span class="hint">Describe the access attempted, contact made and areas' +
                          " you could not inspect. No access is not a finding of compliance.</span>"
                      : "",
                  ) +
                  "</label>\n      " +
                  "".concat(
                    open && (r.importRule?.cite || res.cite)
                      ? '<label class="ri-cite"><input type="checkbox" data-ricite="' +
                          `${esc(it.id)}` +
                          '" ' +
                          `${res.cite ? "checked" : ""}` +
                          " " +
                          `${lock ? "disabled" : ""}` +
                          ">\n        <span>Issue a citation for this item</span></label>"
                      : "",
                  ) +
                  ""
              : "",
          ) +
          "\n      </div>"
        );
      })
      .join("");

    const done = doneItems(r).length,
      open = openItems(r).length,
      left = unchecked(r).length;
    const activeCount = src.items.filter((it) => !it.withdrawn).length;
    const recorded = activeCount - left,
      withdrawn = src.items.length - activeCount;
    const next = WriterState.state.riWalk ? nextWalkItem(r) : null;
    const rowsShown = src.items.filter((it) => {
      const oc = ocOf(r, it.id);
      if (WriterState.state.riFilter === "corrected") return oc === "corrected";
      if (WriterState.state.riFilter === "open") return oc && oc !== "corrected" && oc !== "withdrawn";
      if (WriterState.state.riFilter === "todo") return !oc;
      return true;
    }).length;
    const cited = openItems(r).filter((i) => (r.results[i.id] || {}).cite);
    const badDue = openItems(r).filter((i) => !dueCheck((r.results[i.id] || {}).due, r.date).ok);
    const prior = reinspFor(r.caseId).filter((x) => x.id !== r.id && x.docId);
    const referred = isReferredCase(r.caseId);
    const walkOn = WriterState.state.riWalk;
    // Current step of one-item review, from the existing walk state; outcomes are only ever chosen by the inspector.
    const walkStep = !walkOn
      ? 0
      : !WriterState.state.riWalkItem
        ? 4
        : WriterState.state.riWalkStage === "details"
          ? walkItemReady(r, WriterState.state.riWalkItem)
            ? 3
            : 2
          : 1;
    const walkSteps = [
      "Record the outcome",
      "Complete required details",
      "Continue to the next item",
      "Review the inspection and permitted follow-up",
    ];
    const walkKeys = OUTCOMES.map((o, ix) => "<kbd>" + (ix + 1) + "</kbd> " + esc(o.label)).join(" · ") + " · <kbd>U</kbd> Undo the last outcome";
    const walkPanel = !readOnly
      ? '<div class="ri-walk-panel ' +
        `${walkOn ? "active" : ""}` +
        '" role="group" aria-label="Reinspection review mode">\n    <div class="ri-walk-modes" role="group" aria-label="How to review items">' +
        '<button type="button" class="btn btn-sm ' +
        `${walkOn ? "" : "btn-primary"}` +
        '" data-riwalk="off" aria-pressed="' +
        `${walkOn ? "false" : "true"}` +
        '">Review all items</button><button type="button" class="btn btn-sm ' +
        `${walkOn ? "btn-primary" : ""}` +
        '" data-riwalk="on" aria-pressed="' +
        `${walkOn ? "true" : "false"}` +
        '">One item at a time</button></div>\n    <div class="ri-walk-copy">' +
        "<strong>" +
        `${walkOn ? "One item at a time" : "Review all items"}` +
        '</strong>\n      <span aria-live="polite">' +
        "".concat(
          walkOn
            ? WriterState.state.riWalkStage === "details"
              ? "Complete item " +
                `${esc(src.items.find((i) => i.id === WriterState.state.riWalkItem)?.no || "")}` +
                " details, then choose Next item. " +
                `${left}` +
                " without outcomes."
              : next
                ? "Next: item " +
                  `${esc(next.no || String(src.items.indexOf(next) + 1))}` +
                  " of " +
                  `${src.items.length}` +
                  " · " +
                  `${left}` +
                  " left to result."
                : "All items have a result. Review the dates, notes and due dates before creating a document."
            : "Every item is shown. Choose One item at a time to bring the next unanswered item into focus.",
        ) +
        "</span>\n    </div>\n    " +
        "".concat(
          walkOn
            ? '<ol class="ri-walk-steps" aria-label="One item at a time steps">' +
                walkSteps
                  .map(
                    (label, ix) =>
                      '<li data-walk-step="' +
                      (ix + 1) +
                      '"' +
                      (walkStep === ix + 1 ? ' aria-current="step" class="current"' : "") +
                      ">" +
                      label +
                      "</li>",
                  )
                  .join("") +
                "</ol>"
            : "",
        ) +
        '\n    <label class="f"><span>After an outcome</span><select id' +
        '="ri-walk-mode" ' +
        `${walkOn ? "" : "disabled"}` +
        '><option value="quick" ' +
        `${WriterState.state.riWalkMode === "quick" ? "selected" : ""}` +
        '>Go to next unanswered item</option><option value="details" ' +
        `${WriterState.state.riWalkMode === "details" ? "selected" : ""}` +
        ">Complete details first</option></select></label>\n    " +
        "".concat(walkOn ? '<button class="btn btn-sm" data-riwalk-prev>Previous item</button>' : "") +
        "\n    " +
        "".concat(
          walkOn && WriterState.state.riWalkStage === "details"
            ? '<button class="btn btn-primary btn-sm" data-riwalk-next>Next item</butto' +
                'n><button class="btn btn-sm" data-riwalk-skip>Skip for now</button>'
            : "",
        ) +
        "\n    " +
        "".concat(
          walkOn &&
            src.items.some((it) => editableWalkItem(r, it.id) && (!walkItemReady(r, it.id) || WriterState.state.riWalkSkipped.includes(it.id)))
            ? '<button class="btn btn-sm" data-riwalk-return>Return to unfinished details</button>'
            : "",
        ) +
        "\n    " +
        "".concat(
          walkOn && WriterState.state.riWalkUndo
            ? '<button class="btn btn-sm" data-riwalk-undo title="Undo the last walk-th' + 'rough result (U)">Undo last result <kbd>U</kbd></button>'
            : "",
        ) +
        '\n    <details class="ri-walk-tips"><summary>Keyboard shortcuts and tips</summary>' +
        "<p>In One item at a time: " +
        walkKeys +
        ".</p><p>Shortcuts are ignored while typing in a field. Nothing is recorded until you choose an outcome; " +
        "follow-up choices stay limited to those the imported inspection result permits.</p><p>After an outcome: Go to next unanswered item moves on at once; " +
        "Complete details first keeps the item open for its date, notes and any new due date.</p></details>\n  </div>"
      : "";

    let verdict;
    if (closed) {
      const nd = doc(r.docId),
        ndl = (DOC_TYPES.find((t) => t.id === (nd || {}).type) || {}).label || "follow-up";
      verdict =
        '<div class="banner ok"><div><strong>' +
        "".concat(doc(r.docId) && doc(r.docId).draft ? "A follow-up document is being drafted." : "This reinspection is finished.") +
        "</strong> " +
        `${esc(ndl)}` +
        " written from " +
        `${open}` +
        " outstanding item" +
        `${open === 1 ? "" : "s"}` +
        ". Compatible additional scoped actions can use this same inspection.</di" +
        "v></div>";
    } else if (left) {
      verdict =
        '<div class="banner info"><div><strong>' +
        `${left}` +
        " item" +
        `${left === 1 ? "" : "s"}` +
        " still to result.</strong> Every item on the " +
        `${esc(srcLabel.toLowerCase())}` +
        " needs an outcome before you create a draft.</div></div>";
    } else if (!open) {
      verdict =
        '<div class="banner ok"><div><strong>Everything on this ' +
        `${esc(srcLabel.toLowerCase())}` +
        " was corrected.</strong> Write the compliance letter to tell the owner t" +
        "he case is closed. It records the visit and carries the date each item w" +
        "as met.</div></div>";
    } else if (badDue.length && ["extension", "bestInterestExtension", "citation"].includes(r.followupIntent)) {
      verdict =
        '<div class="banner warn"><div><strong>' +
        `${badDue.length}` +
        " outstanding item" +
        `${badDue.length === 1 ? "" : "s"}` +
        " need" +
        `${badDue.length === 1 ? "s" : ""}` +
        " a due date in the future.</strong> Set one on each item that was not co" +
        "rrected &mdash; unless you are referring the case for prosecution, which" +
        " sets no new date.</div></div>";
    } else {
      verdict =
        '<div class="banner info"><div><strong>' +
        `${open}` +
        " item" +
        `${open === 1 ? "" : "s"}` +
        " carr" +
        `${open === 1 ? "ies" : "y"}` +
        " forward" +
        `${done ? ", " + done + " corrected" : ""}` +
        ".</strong> " +
        "".concat(
          referred
            ? "This case is with the City Attorney, so the only documents left are an u" +
                "pdated referral or, once everything is put right, a compliance letter. E" +
                "xtensions and citations are no longer the division&rsquo;s to give."
            : r.importRule
              ? "The Accela status " +
                esc(r.importRule.status) +
                " sets the next document: " +
                esc(r.importRule.label) +
                "." +
                (r.importRule.cite ? " Tick the items you are citing." : "") +
                (r.importRule.allCorrected ? " Every item must be marked Corrected." : "")
              : "Choose the next action: an extension to allow more time, a referral to s" +
                "end the case to the City Attorney, or a citation. Citations are at your " +
                "discretion for any item past its due date — tick the items you are citin" +
                "g.",
        ) +
        " Item numbers stay as they are on the " +
        `${esc(srcLabel.toLowerCase())}` +
        ".</div></div>";
    }

    return services.shell(
      k.address,
      `${k.number} · Reinspection · working off the ${srcLabel.toLowerCase()}`,
      '<button class="btn" id="btn-savework">Save draft &amp; return to Workspace</button>',
      '<div class="reinspection-workspace" data-worksheet-context="' +
        `${esc(walkIdentity(r))}` +
        '"><p class="ri-source">Inspecting against the ' +
        `${esc(srcLabel.toLowerCase())}` +
        " issued " +
        `${services.fmtDate(src.mailed || src.created)}` +
        ". Original item numbers and wording stay with the issued document.</p>\n " +
        '    <div class="card ri-visit" style="margin-bottom:16px"><div class="ca' +
        'rd-b">\n       <div class="grid g2">\n         <label class="f"><span>Actu' +
        'al inspection date and time</span><span class="ri-when"><input type="dat' +
        'e" id="ri-date" value="' +
        `${esc(r.date)}` +
        '" max="' +
        `${recordDay(today)}` +
        '" ' +
        `${readOnly ? "disabled" : ""}` +
        '><input type="time" id="ri-time" value="' +
        `${esc(r.time || "")}` +
        '" aria-label="Reinspection time" ' +
        `${readOnly ? "disabled" : ""}` +
        '></span><span class="hint">The physical visit. Item result dates and fut' +
        'ure deadlines are separate below.</span></label>\n         <label class="' +
        'f"><span>Inspector</span><select id="ri-insp" ' +
        `${readOnly ? "disabled" : ""}` +
        ">" +
        "".concat(INSPECTORS.map((x) => `<option value="${x.id}" ${r.inspectorId === x.id ? "selected" : ""}>${esc(x.name)}</option>`).join("")) +
        '</select></label>\n       </div>\n       <div class="ri-progress" role="st' +
        'atus"><strong>' +
        `${recorded}` +
        " of " +
        `${activeCount}` +
        " active items have a result</strong><span>" +
        `${left}` +
        " unresolved" +
        `${withdrawn ? " · " + withdrawn + " withdrawn (excluded)" : ""}` +
        ". Previously cleared items remain carried forward.</span><progress value" +
        '="' +
        `${recorded}` +
        '" max="' +
        `${activeCount || 1}` +
        '" aria-label="Active items with a result"></progress></div>\n       <div ' +
        'class="ri-sum" ' +
        `${WriterState.state.riWalk ? "hidden" : ""}` +
        '>\n         <button class="cchip ' +
        `${done ? "good" : ""}` +
        '" data-rifilter="corrected" aria-pressed="' +
        `${WriterState.state.riFilter === "corrected"}` +
        '" ' +
        `${WriterState.state.riWalk ? "disabled" : ""}` +
        ">" +
        `${done}` +
        ' corrected</button>\n         <button class="cchip ' +
        `${open ? "bad" : ""}` +
        '" data-rifilter="open" aria-pressed="' +
        `${WriterState.state.riFilter === "open"}` +
        '" ' +
        `${WriterState.state.riWalk ? "disabled" : ""}` +
        ">" +
        `${open}` +
        " outstanding</button>\n         " +
        "".concat(
          left
            ? '<button class="cchip" data-rifilter="todo" aria-pressed="' +
                `${WriterState.state.riFilter === "todo"}` +
                '" ' +
                `${WriterState.state.riWalk ? "disabled" : ""}` +
                ">" +
                `${left}` +
                " not yet resulted</button>"
            : "",
        ) +
        "\n         " +
        `${cited.length ? `<span class="cchip bad">${cited.length} to cite</span>` : ""}` +
        "\n         " +
        "".concat(
          WriterState.state.riFilter
            ? '<button class="lnk" data-rifilter="" ' +
                `${WriterState.state.riWalk ? "disabled" : ""}` +
                ">Show all " +
                `${src.items.length}` +
                "</button>"
            : "",
        ) +
        "\n       </div>\n       " +
        `${walkPanel}` +
        "\n       " +
        "".concat(
          WriterState.state.riFilter
            ? '<p class="ri-filtered">Showing ' +
                `${rowsShown}` +
                " of " +
                `${src.items.length}` +
                " items. This only changes what you are looking at &mdash; every item sti" +
                "ll goes on the document.</p>"
            : "",
        ) +
        "\n       </div></div>\n     " +
        "".concat(
          prior.length
            ? '<div class="card" style="margin-bottom:16px"><div class="card-h"><h2>Ear' +
                'lier visits</h2></div><div class="card-b"><ul class="hist">' +
                "".concat(
                  prior
                    .map(
                      (x) =>
                        "<li><strong>" +
                        `${services.fmtDate(x.date)}` +
                        "</strong> — " +
                        `${doneItems(x).length}` +
                        " corrected, " +
                        `${openItems(x).length}` +
                        " outstanding · " +
                        `${esc(insp(x.inspectorId).name)}` +
                        "</li>",
                    )
                    .join(""),
                ) +
                "</ul></div></div>"
            : "",
        ) +
        '\n     <h2 class="ri-items-heading">' +
        "".concat(
          WriterState.state.riWalk && WriterState.state.riWalkItem
            ? "Current item · " + (left ? "next unresolved remains in order" : "reviewing recorded details")
            : WriterState.state.riFilter
              ? rowsShown + " of " + src.items.length + " items"
              : "Review all " + src.items.length + " items",
        ) +
        "</h2>\n     " +
        "".concat(
          r.previousDraft
            ? '<div class="banner info"><div>Previous document draft retained. <button ' +
                'class="btn" id="btn-previousdraft">Restore previous draft and inspection' +
                '</button><button class="btn" id="btn-exportprevious">Download previous d' +
                "raft</button></div></div>"
            : "",
        ) +
        "\n     " +
        `${!r.followupIntent || ["undecided", "extension", "bestInterestExtension", "citation"].includes(r.followupIntent) ? services.duePanel(r, true) : ""}` +
        `${rows}` +
        "\n\n     " +
        "".concat(
          !readOnly
            ? '<details class="ri-checks"><summary>Inspection checks · ' +
                worksheetChecks(r).filter((c) => !c.soft).length +
                " to resolve before a document</summary>" +
                worksheetCheckPanel(r) +
                "</details>"
            : "",
        ) +
        "\n     " +
        `${verdict}` +
        "\n     " +
        "".concat(!closed ? services.newDocuments.chooser(r) : `<button class="btn" data-open="${esc(r.docId)}">Open the document</button>`) +
        '\n     <div class="ri-foot"><button class="btn" id="btn-risave">Save draft &amp; return to Workspace</button></div></div>',
    );
  }

  function docFromReinspection(r, type) {
    // only an existing document closes the worksheet; a discarded one leaves
    // it open to write the follow-up again
    if (r.docId && !doc(r.docId)) r.docId = null;
    if (r.docId && (doc(r.docId)?.draft || !supplemental(doc(r.docId)))) {
      WriterState.state.docId = r.docId;
      WriterState.state.screen = "write";
      services.render();
      return;
    }
    const src = doc(r.sourceDocId),
      carry = openItems(r);
    if (!src || !isEffective(src) || (!r.draft && !r.recordedAt)) {
      services.toast("Open a current reinspection worksheet first");
      return;
    }
    if (!["extension", "citation", "referral", "referralUpdate", "compliance"].includes(type)) {
      services.toast("Choose an available follow-up type.");
      return;
    }
    const unavailable = services.newDocuments.eligibility?.(r, type);
    if (unavailable) {
      services.toast(unavailable);
      return;
    }
    const faults = services.worksheetFaults(r, type);
    if (faults.length) {
      services.toast(faults[0]);
      return;
    }
    if (unchecked(r).length) {
      services.toast("Choose an outcome for every item first");
      return;
    }
    if (!services.validISO(r.date) || r.date > recordDay(today)) {
      services.toast("Enter a valid inspection date");
      return;
    }
    if (type !== "compliance" && !carry.length) {
      services.toast("Nothing outstanding to carry forward");
      return;
    }
    if (type === "compliance" && carry.length) {
      services.toast("Items are still outstanding — a compliance letter closes every item");
      return;
    }
    const pos = new Map(src.items.map((it, i) => [it.id, i]));
    const hasHistory = !!(DOC_TYPES.find((t) => t.id === type) || {}).history || type === "compliance";
    const nd = {
      id: services.uid("d"),
      caseId: r.caseId,
      type: type,
      created: recordDay(today),
      status: "Draft",
      draft: true,
      mailed: recordDay(today),
      cc: "",
      cits: {},
      ...(hasHistory || type === "citation" ? { authoringVersion: 16 } : {}),
      fromReinspId: r.id,
      fromDocId: src.id,
      expectedHead: r.draft ? r.expectedHead || recordHead(r.caseId) : recordHead(r.caseId),
      replaces: r.replaces || "",
      ...(r.importInspection ? { importInspection: clone(r.importInspection) } : {}),
      inspectorId: r.inspectorId || kase(r.caseId).inspectorId,
      inspDate: r.date || "",
      inspTime: r.time || "",
      items: src.items.map((it) => {
        const res = r.results[it.id] || {},
          cleared = res.oc === "corrected";
        return {
          ...it,
          id: services.uid("x"),
          no: it.no || String((pos.get(it.id) || 0) + 1),
          due: (hasHistory && type !== "compliance") || it.withdrawn ? "" : cleared || type === "compliance" ? it.due : res.due,
          done: cleared,
          doneOn: cleared ? res.on || r.date : "",
          note: !cleared && String(res.note || "").trim() ? String(res.note).trim() : "",
          noteOn: !cleared && String(res.note || "").trim() ? res.on || r.date : "",
          hist: hasHistory ? services.itemHistory(r.caseId, it.no || String((pos.get(it.id) || 0) + 1)) : null,
          cite: type === "citation" && !cleared && !!res.cite,
          srcItemId: it.id,
        };
      }),
    };
    // a citation is filed per ordinance, so each ticked item gets its own form
    // register the document before its citations are numbered, so each number is
    // checked against the ones already issued on this document too
    if (hasHistory) nd.items.forEach((it) => (it.hist = services.itemInspectionHistory(nd, it)));
    WriterState.DOCS.unshift(nd);
    if (REFERRED_ONLY.indexOf(type) < 0 && isReferredCase(r.caseId)) {
      WriterState.DOCS = WriterState.DOCS.filter((x) => x.id !== nd.id);
      services.toast("This case is with the City Attorney — only an updated referral or a compliance letter can be written now");
      return;
    }
    if (type === "citation") {
      if (!nd.items.some((i) => i.cite)) {
        WriterState.DOCS = WriterState.DOCS.filter((x) => x.id !== nd.id);
        services.toast("Select the items to cite on the inspection worksheet.");
        return;
      }
      nd.items
        .filter((i) => i.cite)
        .forEach((i) => {
          const sections = (i.sections || []).map(canonicalOrdinance),
            ord = sections.length === 1 ? sections[0] : "";
          nd.cits[i.id] = {
            deptId: insp(nd.inspectorId).badge || "",
            num: services.citationNumber(),
            courtTime: courtTime(),
            comment: narrativeFor(r, src.items.find((x) => x.id === i.srcItemId) || i),
            ord,
            preparedSections: sections,
            autoFilledCharge: !!ord,
            desc: String(i.title || "").toUpperCase(),
            issued: recordDay(today),
            courtDate: services.nextCourtDate(recordDay(today)),
            depositMode: "schedule",
          };
          services.applyDeposit(nd, i.id, ord);
        });
    }
    r.docId = nd.id;
    WriterState.state.docId = nd.id;
    WriterState.state.screen = "write";
    WriterState.DIRTY = true;
    services.saveDrafts();
    services.render();
    if (type === "citation") services.depositStep.openNext(nd);
    const n = nd.items.filter((i) => i.cite).length,
      cl = nd.items.filter((i) => i.done).length;
    services.toast(
      type === "compliance"
        ? "Compliance letter drafted — review and issue it to close the case"
        : type === "referral" || type === "referralUpdate"
          ? (DOC_TYPES.find((t) => t.id === type) || {}).label +
            " started \u2014 " +
            carry.length +
            " item" +
            (carry.length === 1 ? "" : "s") +
            " still outstanding"
          : ((DOC_TYPES.find((t) => t.id === type) || {}).label || type) +
            " started \u2014 " +
            carry.length +
            " outstanding" +
            (cl ? ", " + cl + " shown as corrected" : "") +
            (n ? ", " + n + " citation" + (n === 1 ? "" : "s") : ""),
    );
  }
  return {
    walkIdentity,
    clearWalk,
    restoreWalkFor,
    ensureWalkContext,
    nextWalkItem,
    focusWalkItem,
    walkItemReady,
    advanceWalk,
    skipWalkDetails,
    returnWalkDetails,
    previousWalk,
    editableWalkItem,
    recordReinspectionOutcome,
    undoWalkOutcome,
    narrativeFor,
    attachCheckTargets,
    worksheetChecks,
    highlightOpenChecks,
    focusCheckTarget,
    dueCheck,
    checkRowHTML,
    screenReinspect,
    docFromReinspection,
    focusWalkDetails,
    worksheetCheckPanel,
  };
}
