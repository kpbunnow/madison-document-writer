/* Scoped UI/peer services are supplied by core; read them only when an action runs. */
import { citSelector, esc as dep_esc } from "./presentation_format.js";

import { doc } from "./writer_queries.js";
import { itemLibraryKey } from "./document_rules.js";
import { CITATION_POLICY, assessmentCents, canonicalOrdinance, cents, courtCents, resolveCitationAmount } from "./citation_policy.js";
import { WriterState } from "./state.js";
/* Required completion is stored as a request, never as a blank citation. */
export function initDepositStep(services) {
  let active = null;
  function close() {
    active = null;
  }
  function complete(d, id, values) {
    const request = d.depositRequests?.[id];
    if (!request) return false;
    const i = d.items.find((x) => x.id === id),
      c = { ...request, ...values },
      ord = canonicalOrdinance(c.ord);
    delete c.ordEditingFrom;
    if (!ord) return false;
    c.ord = ord;
    const priced = resolveCitationAmount({
      ordinance: ord,
      libraryItem: itemLibraryKey(i),
      tier: c.tier || 1,
      date: services.citationPricingDate(c, d),
      entryId: c.scheduleEntryId,
      measurements: c.measurements || {},
    });
    if (c.depositMode === "schedule") {
      if (priced.kind !== "priced") {
        if (priced.kind === "needs-basis" && c.measurements) {
          Object.assign(request, { measurements: c.measurements, reason: priced.reason, measurementFields: [], depositMode: "base" });
        }
        return false;
      }
      Object.assign(c, priced);
      delete c.kind;
    } else {
      if (!["base", "total"].includes(c.depositMode) || String(c.depositSource || "").trim().length < 10) return false;
      c.cc = courtCents(services.citationPricingDate(c, d)) / 100;
      if (c.depositMode === "base") {
        if (cents(c.base) === null || (cents(c.base) === 0 && !CITATION_POLICY.allowZeroBaseDeposits)) return false;
        const v = assessmentCents(cents(c.base), cents(c.cc), services.citationPricingDate(c, d));
        c.amount = (v.total / 100).toFixed(2);
        c.assessments = v;
      } else {
        if (!(cents(c.amount) > 0)) return false;
        delete c.assessments;
      }
      c.resolvedVia = "approved-" + c.depositMode;
      c.pricedOn = services.citationPricingDate(c, d);
      c.policyVersionHash = CITATION_POLICY.versionHash;
    }
    delete c.reason;
    delete c.reconfirmDeposit;
    c.preparedSections = (i.sections || []).map(canonicalOrdinance);
    c.differentChargeSource = c.preparedSections.includes(ord) ? c.differentChargeSource : c.depositSource;
    d.authoringVersion = Math.max(11, d.authoringVersion || 0);
    d.cits = d.cits || {};
    d.cits[id] = c;
    delete d.depositRequests[id];
    WriterState.DIRTY = true;
    return true;
  }
  function form(d, i, c) {
    const esc = dep_esc,
      measured = !!c.measurementFields?.length,
      mode = ["base", "total"].includes(c.depositMode) ? c.depositMode : "base";
    const input = (key, label, type = "text", extra = "", value = c[key] ?? "") =>
      '<label class="f"><span>' +
      esc(label) +
      '</span><input name="' +
      key +
      '" type="' +
      type +
      '" aria-label="' +
      esc(label + " for item " + i.no) +
      '" value="' +
      esc(value) +
      '" ' +
      extra +
      "></label>";
    // R59: several item sections → choose exactly one; a charge outside them stays a secondary, sourced entry.
    const chargeSelect = (i, c) => {
      const choices = services.chargeChoices(i),
        chosen = canonicalOrdinance(c.ord) || String(c.ord || "").trim(),
        listed = choices.some((x) => x.value === chosen);
      return (
        '<label class="f"><span>Charged ordinance</span><select name="ord" aria-label="' +
        esc("Charged ordinance for item " + i.no) +
        '"' +
        (listed || !chosen ? " required" : "") +
        '><option value="">Choose the charged ordinance</option>' +
        choices
          .map((x) => '<option value="' + esc(x.value) + '" ' + (listed && x.value === chosen ? "selected" : "") + ">" + esc(x.label) + "</option>")
          .join("") +
        "</select></label>" +
        input("ordOther", "Different charge — ordinance outside the item’s sections", "text", "", listed ? "" : c.ord || "")
      );
    };
    // An ordinance with several schedule rows needs its scheduled offense, as on the charge card.
    const offenseSelect = (i, c) => {
      const entries = CITATION_POLICY.entries.filter((e) => e.ordinance === canonicalOrdinance(c.ord));
      return entries.length > 1
        ? '<label class="f"><span>Scheduled offense</span><select name="scheduleEntryId" aria-label="' +
            esc("Scheduled offense for item " + i.no) +
            '"><option value="">Choose the charged offense</option>' +
            entries
              .map(
                (e) => '<option value="' + esc(e.id) + '" ' + (c.scheduleEntryId === e.id ? "selected" : "") + ">" + esc(e.description) + "</option>",
              )
              .join("") +
            "</select></label>"
        : "";
    };
    const measurements = (c.measurementFields || [])
      .map((f) =>
        f.boolean
          ? '<label class="f"><span>' +
            esc(f.label) +
            '</span><select name="measure-' +
            f.key +
            '" aria-label="' +
            esc(f.label + " for item " + i.no) +
            '" required><option value="">Choose</option><option value="true" ' +
            (c.measurements?.[f.key] === true ? "selected" : "") +
            '>Yes</option><option value="false" ' +
            (c.measurements?.[f.key] === false ? "selected" : "") +
            ">No</option></select></label>"
          : input(
              "measure-" + f.key,
              f.label,
              "number",
              'min="' +
                (f.min ?? 0) +
                '" ' +
                (f.max == null ? "" : 'max="' + f.max + '"') +
                ' step="' +
                (f.whole ? "1" : "any") +
                '" ' +
                (f.key === "diameter" && c.measurements?.removed === false ? "disabled" : "required"),
              c.measurements?.[f.key] ?? "",
            ),
      )
      .join("");
    // Keep the same required completion contract; no citation is created until complete succeeds.
    return (
      '<form data-deposit-form="' +
      esc(i.id) +
      '" data-deposit-doc="' +
      esc(d.id) +
      '"><h3>' +
      (measured ? "Complete measurements" : "Complete approved deposit") +
      "</h3><p>" +
      esc(c.reason || "Choose an approved deposit basis.") +
      '</p><div class="grid g2">' +
      (services.choosesCharge(i) ? chargeSelect(i, c) : input("ord", "Charged ordinance", "text", "required")) +
      offenseSelect(i, c) +
      (measured
        ? measurements
        : '<label class="f"><span>Deposit method</span><select name="depositMode" aria-label="Deposit method for item ' +
          esc(i.no) +
          '"><option value="schedule">Verified schedule</option><option value="base" ' +
          (mode === "base" ? "selected" : "") +
          '>Approved base + assessments</option><option value="total" ' +
          (mode === "total" ? "selected" : "") +
          '>Approved total, assessments included</option></select></label><div data-deposit-mode="base" ' +
          (mode === "base" ? "" : "hidden") +
          ">" +
          input("base", "Approved base", "number", 'min="0" step="0.01" ' + (mode === "base" ? "required" : "disabled")) +
          '</div><div data-deposit-mode="total" ' +
          (mode === "total" ? "" : "hidden") +
          ">" +
          input("amount", "Approved total", "number", 'min="0.01" step="0.01" ' + (mode === "total" ? "required" : "disabled")) +
          ('</div><label class="f" data-deposit-source><span>Approved source / reaso' +
            'n</span><textarea name="depositSource" aria-label="Approved source / rea' +
            "son for item ") +
          esc(i.no) +
          '" rows="2" minlength="10" required>' +
          esc(c.depositSource || "") +
          "</textarea></label>") +
      '</div><p class="hint">' +
      (measured
        ? "Measurements calculate the approved scheduled amount. They do not authorize a manual amount."
        : "A base adds the approved assessments. A total already includes them. Rec" +
          "ord the approval source; the program does not authorize an amount.") +
      ('</p><p role="alert" data-deposit-error></p><button class="btn btn-primar' +
        'y" type="submit">Complete charge</button> <button class="btn" type="butt' +
        'on" data-deposit-later>Save unfinished draft</button></form>')
    );
  }
  function findForm(id) {
    return [...document.querySelectorAll("[data-deposit-form]")].find((el) => el.dataset.depositForm === id);
  }
  function open(d, id) {
    if (!d?.depositRequests?.[id] || services.isLocked(d) || d.pendingAmendment) return;
    active = { d, id };
    const el = findForm(id);
    if (!el) return;
    el.scrollIntoView?.({ block: "center" });
    el.querySelector("input:not([disabled]),select:not([disabled])")?.focus({ preventScroll: true });
  }
  function openNext(d) {
    const id = Object.keys(d?.depositRequests || {})[0];
    if (id) open(d, id);
  }
  function context(el) {
    const node = el.closest?.("[data-deposit-form]");
    if (!node) return null;
    const d = doc(node.dataset.depositDoc) || WriterState.DOCS.find((x) => x.initialCitationId === node.dataset.depositDoc),
      id = node.dataset.depositForm;
    return d?.draft && !services.isLocked(d) && !d.pendingAmendment && d.depositRequests?.[id] ? { node, d, id, c: d.depositRequests[id] } : null;
  }
  function values(node, c) {
    const result = Object.fromEntries(new FormData(node));
    if (Object.hasOwn(result, "ordOther")) {
      const other = String(result.ordOther || "").trim();
      if (other) result.ord = other;
      delete result.ordOther;
    }
    if (c.measurementFields?.length) {
      result.depositMode = "schedule";
      result.measurements = Object.fromEntries(
        c.measurementFields.map((f) => [
          f.key,
          f.boolean
            ? result["measure-" + f.key] === "true"
              ? true
              : result["measure-" + f.key] === "false"
                ? false
                : null
            : result["measure-" + f.key] == null || result["measure-" + f.key] === ""
              ? null
              : Number(result["measure-" + f.key]),
        ]),
      );
      for (const f of c.measurementFields) delete result["measure-" + f.key];
    }
    return result;
  }
  function update(e) {
    const ctx = context(e.target);
    if (!ctx) return;
    const { node, c } = ctx;
    const method = node.querySelector("[name=depositMode]");
    if (method) {
      for (const group of node.querySelectorAll("[data-deposit-mode]")) {
        group.hidden = group.dataset.depositMode !== method.value;
        for (const input of group.querySelectorAll("input")) {
          input.disabled = group.hidden;
          input.required = !group.hidden;
        }
      }
      const source = node.querySelector("[data-deposit-source]");
      source.hidden = method.value === "schedule";
      source.querySelector("textarea").required = !source.hidden;
      source.querySelector("textarea").disabled = source.hidden;
    }
    const choice = node.querySelector("[name=measure-removed]"),
      diameter = node.querySelector("[name=measure-diameter]");
    if (choice && diameter) {
      diameter.required = choice.value !== "false";
      diameter.disabled = choice.value === "false";
    }
    const ordField = /^(ord|ordOther)$/.test(e.target.name || "");
    if (ordField && e.type === "change" && e.target.name === "ord" && node.querySelector("[name=ordOther]"))
      node.querySelector("[name=ordOther]").value = "";
    const next = values(node, c),
      typed = next.ord;
    // R59: the charge commits only on its change event, through changeCharge. While it is typed, the text is kept
    // (ordEditingFrom, as on the charge card) so a repaint never loses it and pricing waits for the commit.
    delete next.ord;
    Object.assign(c, next);
    WriterState.DIRTY = true;
    if (ordField && e.type === "input") {
      if (!Object.hasOwn(c, "ordEditingFrom")) c.ordEditingFrom = c.ord;
      c.ord = String(typed || "");
    }
    if (ordField && e.type === "change") {
      changeCharge(ctx, typed);
      return;
    }
    // Choosing the scheduled offense of an ordinance with several rows prices the charge at once.
    if (e.target.name === "scheduleEntryId" && e.type === "change") {
      services.citationPricing.refresh(ctx.d);
      settle(ctx);
      return;
    }
    services.scheduleDraftSave();
  }
  function settle({ d, id }) {
    services.saveDrafts();
    services.render();
    const target = d.depositRequests?.[id] ? findForm(id)?.querySelector("[name=ord]") : document.querySelector(citSelector(id, "ord"));
    target?.focus({ preventScroll: true });
  }
  /* R59: a changed charge clears every value priced, measured or approved for the previous one, then runs
     the ordinary pricing (changeCharge); focus returns to the charge wherever it is now shown. */
  function changeCharge(ctx, value) {
    if (Object.hasOwn(ctx.c, "ordEditingFrom")) ctx.c.ord = ctx.c.ordEditingFrom;
    delete ctx.c.ordEditingFrom;
    if (!services.changeChargeBasis(ctx.d, ctx.id, value)) {
      services.scheduleDraftSave();
      return;
    }
    settle(ctx);
  }
  document.addEventListener("input", update);
  document.addEventListener("change", update);
  document.addEventListener("submit", (e) => {
    if (!e.target.matches?.("[data-deposit-form]")) return;
    e.preventDefault();
    const ctx = context(e.target);
    if (!ctx) return;
    const { node, d, id, c } = ctx;
    const submitted = values(node, c);
    if (Object.hasOwn(c, "ordEditingFrom")) c.ord = c.ordEditingFrom;
    delete c.ordEditingFrom;
    // A charge changed without its change event is re-priced from nothing first, never completed with stale values.
    if ((canonicalOrdinance(submitted.ord) || String(submitted.ord || "").trim()) !== (canonicalOrdinance(c.ord) || String(c.ord || "").trim())) {
      changeCharge(ctx, submitted.ord);
      return;
    }
    Object.assign(c, submitted);
    const wasMeasured = !!c.measurementFields?.length;
    if (!complete(d, id, values(node, c))) {
      if (wasMeasured && !c.measurementFields?.length) {
        services.saveDrafts();
        services.render();
        open(d, id);
        return;
      }
      node.querySelector("[data-deposit-error]").textContent =
        "Complete the ordinance, required measurements or positive approved amoun" +
        "t, and an approval source of at least 10 characters. A zero forfeiture n" +
        "eeds City Attorney approval.";
      return;
    }
    active = null;
    services.saveDrafts();
    services.render();
    const card = [...document.querySelectorAll("[data-charge]")].find((el) => el.dataset.charge === id);
    if (card) {
      card.setAttribute("tabindex", "-1");
      card.focus({ preventScroll: true });
      card.scrollIntoView?.({ block: "center" });
    }
  });
  document.addEventListener("click", (e) => {
    const later = e.target.closest?.("[data-deposit-later]");
    if (later) {
      const ctx = context(later);
      if (ctx) services.saveAndContinue();
      return;
    }
    const t = e.target.closest?.("[data-open-deposit],[data-confirm-deposit]");
    if (!t) return;
    const [docId, id] = String(t.dataset.openDeposit || t.dataset.confirmDeposit).split("|"),
      d = doc(docId) || WriterState.DOCS.find((x) => x.initialCitationId === docId);
    if (!d || services.isLocked(d) || d.pendingAmendment) return;
    if (t.dataset.confirmDeposit) {
      const c = d.cits?.[id];
      if (!c || String(c.depositSource || "").trim().length < 10 || !(cents(c.amount) > 0)) {
        services.toast("Enter the approved source and amount before confirming.");
        return;
      }
      delete c.reconfirmDeposit;
      if (
        services.citationDepositFault(
          c,
          d,
          d.items.find((i) => i.id === id),
        )
      ) {
        c.reconfirmDeposit = true;
        services.toast("Correct the deposit basis before confirming.");
        return;
      }
      services.saveDrafts();
      services.render();
    } else if (id) open(d, id);
    else openNext(d);
  });
  return {
    form,
    open,
    openNext,
    complete,
    close,
    get active() {
      return active;
    },
  };
}
