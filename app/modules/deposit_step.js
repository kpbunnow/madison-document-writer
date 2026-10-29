import { html as screen, raw } from "./screen_html.js";
/* Scoped UI/peer services are supplied by core; read them only when an action runs. */
import { citSelector, esc as dep_esc } from "./presentation_format.js";

import { doc } from "./writer_queries.js";
import { itemLibraryKey } from "./document_rules.js";
import { CITATION_POLICY, assessmentCents, canonicalOrdinance, cents, courtCents, resolveCitationAmount } from "./citation_policy.js";
import { workspaceState } from "./workspace_state.js";
/* Required completion is stored as a request, never as a blank citation. */
function applyApprovedDeposit(services, c, d) {
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
  return true;
}

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
    } else if (!applyApprovedDeposit(services, c, d)) return false;
    delete c.reason;
    delete c.reconfirmDeposit;
    c.preparedSections = (i.sections || []).map(canonicalOrdinance);
    c.differentChargeSource = c.preparedSections.includes(ord) ? c.differentChargeSource : c.depositSource;
    d.authoringVersion = Math.max(11, d.authoringVersion || 0);
    d.cits = d.cits || {};
    d.cits[id] = c;
    delete d.depositRequests[id];
    workspaceState.DIRTY = true;
    return true;
  }
  function form(d, i, c) {
    const esc = dep_esc,
      measured = !!c.measurementFields?.length,
      mode = ["base", "total"].includes(c.depositMode) ? c.depositMode : "base";
    const input = (key, label, type = "text", extra = "", value = c[key] ?? "") =>
      screen`<label class="f"><span>${raw(esc(label))}</span><input name="${String(key)}" type="${String(type)}" aria-label="${raw(esc(label + " for item " + i.no))}" value="${raw(esc(value))}" ${raw(extra)}></label>`;
    // R59: several item sections → choose exactly one; a charge outside them stays a secondary, sourced entry.
    const chargeSelect = (i, c) => {
      const choices = services.chargeChoices(i),
        chosen = canonicalOrdinance(c.ord) || String(c.ord || "").trim(),
        listed = choices.some((x) => x.value === chosen);
      return screen`<label class="f"><span>Charged ordinance</span><select name="ord" aria-label="${raw(esc("Charged ordinance for item " + i.no))}"${raw(listed || !chosen ? " required" : "")}><option value="">Choose the charged ordinance</option>${raw(
        choices
          .map(
            (x) => screen`<option value="${raw(esc(x.value))}" ${raw(listed && x.value === chosen ? "selected" : "")}>${raw(esc(x.label))}</option>`,
          )
          .join(""),
      )}</select></label>${raw(input("ordOther", "Different charge — ordinance outside the item’s sections", "text", "", listed ? "" : c.ord || ""))}`;
    };
    // An ordinance with several schedule rows needs its scheduled offense, as on the charge card.
    const offenseSelect = (i, c) => {
      const entries = CITATION_POLICY.entries.filter((e) => e.ordinance === canonicalOrdinance(c.ord));
      return entries.length > 1
        ? screen`<label class="f"><span>Scheduled offense</span><select name="scheduleEntryId" aria-label="${raw(esc("Scheduled offense for item " + i.no))}"><option value="">Choose the charged offense</option>${raw(
            entries
              .map(
                (e) =>
                  screen`<option value="${raw(esc(e.id))}" ${raw(c.scheduleEntryId === e.id ? "selected" : "")}>${raw(esc(e.description))}</option>`,
              )
              .join(""),
          )}</select></label>`
        : "";
    };
    const measurements = (c.measurementFields || [])
      .map((f) =>
        f.boolean
          ? screen`<label class="f"><span>${raw(esc(f.label))}</span><select name="measure-${String(f.key)}" aria-label="${raw(esc(f.label + " for item " + i.no))}" required><option value="">Choose</option><option value="true" ${raw(c.measurements?.[f.key] === true ? "selected" : "")}>Yes</option><option value="false" ${raw(c.measurements?.[f.key] === false ? "selected" : "")}>No</option></select></label>`
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
    return screen`<form data-deposit-form="${raw(esc(i.id))}" data-deposit-doc="${raw(esc(d.id))}"><h3>${raw(measured ? "Complete measurements" : "Complete approved deposit")}</h3><p>${raw(esc(c.reason || "Choose an approved deposit basis."))}</p><div class="grid g2">${raw(services.choosesCharge(i) ? chargeSelect(i, c) : input("ord", "Charged ordinance", "text", "required"))}${raw(offenseSelect(i, c))}${raw(
      measured
        ? measurements
        : screen`<label class="f"><span>Deposit method</span><select name="depositMode" aria-label="Deposit method for item ${raw(esc(i.no))}"><option value="schedule">Verified schedule</option><option value="base" ${raw(mode === "base" ? "selected" : "")}>Approved base + assessments</option><option value="total" ${raw(mode === "total" ? "selected" : "")}>Approved total, assessments included</option></select></label><div data-deposit-mode="base" ${raw(mode === "base" ? "" : "hidden")}>${raw(input("base", "Approved base", "number", 'min="0" step="0.01" ' + (mode === "base" ? "required" : "disabled")))}</div><div data-deposit-mode="total" ${raw(mode === "total" ? "" : "hidden")}>${raw(input("amount", "Approved total", "number", 'min="0.01" step="0.01" ' + (mode === "total" ? "required" : "disabled")))}</div><label class="f" data-deposit-source><span>Approved source / reason</span><textarea name="depositSource" aria-label="Approved source / reason for item ${raw(esc(i.no))}" rows="2" minlength="10" required>${raw(esc(c.depositSource || ""))}</textarea></label>`,
    )}</div><p class="hint">${raw(
      measured
        ? "Measurements calculate the approved scheduled amount. They do not authorize a manual amount."
        : "A base adds the approved assessments. A total already includes them. Record the approval source; the program does not authorize an amount.",
    )}</p><p role="alert" data-deposit-error></p><button class="btn btn-primary" type="submit">Complete charge</button> <button class="btn" type="button" data-deposit-later>Save unfinished draft</button></form>`;
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
    const d = doc(node.dataset.depositDoc) || workspaceState.DOCS.find((x) => x.initialCitationId === node.dataset.depositDoc),
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
    workspaceState.DIRTY = true;
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
        "Complete the ordinance, required measurements or positive approved amount, and an approval source of at least 10 characters. A zero forfeiture needs City Attorney approval.";
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
      d = doc(docId) || workspaceState.DOCS.find((x) => x.initialCitationId === docId);
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
