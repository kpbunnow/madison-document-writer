import { startupState as startup } from "./startup_state.js";
import { workspaceState as workspace } from "./workspace_state.js";
/* Core supplies named UI/peer dependencies; construction does not read them. */

import { stableJSON } from "./record_values.js";

import { docCase } from "./writer_queries.js";
import { esc as dep_esc } from "./presentation_format.js";
import { itemLibraryKey } from "./document_rules.js";
import { canonicalOrdinance, cents, resolveCitationAmount, tierOrdinal } from "./citation_policy.js";
/* Administrative deposit exceptions and seasonal letter review live only in Tools. */
function overrideAuthorizationFault(b) {
  if (
    b.version !== 1 ||
    !b.confirmed ||
    String(b.administrator || "").trim().length < 2 ||
    String(b.reason || "").trim().length < 20 ||
    !String(b.sourceReference || "").trim() ||
    !/^[0-9a-f]{32}$/.test(b.authorizationId || "") ||
    !/^[0-9a-f]{64}$/.test(b.authorizationHash || "")
  )
    return "Administrator override needs its named, confirmed helper authorization.";
  return "";
}

function overrideCitationFault(b, c, k) {
  if (
    b.caseNumber !== k.number ||
    b.citationNumber !== c.num ||
    b.ordinance !== canonicalOrdinance(c.ord) ||
    b.pricingDate !== (c.pricedOn || c.issued) ||
    b.mode !== c.depositMode ||
    b.totalCents !== cents(c.amount) ||
    b.policyVersionHash !== c.policyVersionHash ||
    (b.mode === "base" && (b.baseCents !== cents(c.base) || b.courtCents !== cents(c.cc)))
  )
    return "Administrator override no longer matches this citation; authorize it again.";
  return "";
}

function overrideHistoryFault(b, c) {
  if (
    b.approvedTier !== tierOrdinal(c.tier) ||
    b.approvedTier !== (c.computedTier || tierOrdinal(c.tier)) ||
    (b.scheduleEntryId || "") !== (c.scheduleEntryId || "") ||
    stableJSON(b.measurements || {}) !== stableJSON(c.measurements || {})
  )
    return "Administrator override pricing facts or citation history changed; authorize it again.";
  return "";
}

function actorFields() {
  return (
    '<label class="f"><span>Named administrator</span><input name="administra' +
    'tor" required minlength="2"></label><label class="f"><span>Reason (at le' +
    'ast 20 characters)</span><textarea name="reason" required minlength="20"' +
    ' rows="3"></textarea></label><label class="f"><span>Court / division sou' +
    'rce reference</span><input name="sourceReference" required></label><labe' +
    'l><input type="checkbox" name="confirmed" required> I confirm this admin' +
    "istrative decision and its source.</label>"
  );
}

const LETTER_FIELDS = ["season", "reviewedOn", "webAddress", "westPhone", "eastPhone", "closing"];

function siteRows(sites) {
  return sites
    .map(
      ([a, b], n) =>
        '<div class="grid g2"><label class="f"><span>West Side · row ' +
        (n + 1) +
        '</span><textarea name="west-' +
        n +
        '" rows="2">' +
        dep_esc(a) +
        '</textarea></label><label class="f"><span>East Side · row ' +
        (n + 1) +
        '</span><textarea name="east-' +
        n +
        '" rows="2">' +
        dep_esc(b) +
        "</textarea></label></div>",
    )
    .join("");
}

function letterFormHTML(letter) {
  return (
    '<form id="admin-snow-letter-form"><p>Review the seasonal sand sites, con' +
    "tacts and web address. New citations use this review; issued copies keep" +
    ' their frozen content.</p><div class="grid g2"><label class="f"><span>Sn' +
    'ow season</span><input name="season" value="' +
    dep_esc(letter.season) +
    ('" required placeholder="2026–27"></label><label class="f"><span>Reviewed' + ' on</span><input type="date" name="reviewedOn" value="') +
    dep_esc(letter.reviewedOn || "") +
    ('" required></label></div><label class="f"><span>Snow-removal web address' + '</span><input type="url" name="webAddress" value="') +
    dep_esc(letter.webAddress) +
    ('" required></label><div class="grid g2"><label class="f"><span>Streets W' + 'est phone</span><input name="westPhone" value="') +
    dep_esc(letter.westPhone) +
    '" required></label><label class="f"><span>Streets East phone</span><input name="eastPhone" value="' +
    dep_esc(letter.eastPhone) +
    '" required></label></div><fieldset><legend>Sand sites · West Side / East Side</legend>' +
    siteRows(letter.sites) +
    ('</fieldset><label class="f"><span>Community assistance / closing line</s' + 'pan><textarea name="closing" rows="3" required>') +
    dep_esc(letter.closing) +
    "</textarea></label>" +
    actorFields() +
    '<p role="alert"></p><button class="btn btn-primary">Save reviewed seasonal content</button></form>'
  );
}

/* The reviewed letter: entered values, the confirmed status, and phone lines rewritten in every west-side row. */
function reviewedLetter(letter, v) {
  const updated = {
    ...letter,
    ...Object.fromEntries(LETTER_FIELDS.map((k) => [k, v[k]])),
    reviewStatus: "Confirmed by named administrator",
    sites: letter.sites.map((_, n) => [v["west-" + n], v["east-" + n]]),
  };
  updated.sites = updated.sites.map(([a, b]) => [
    a.replace(/Streets West: [\d-]+/, "Streets West: " + updated.westPhone).replace(/Streets East: [\d-]+/, "Streets East: " + updated.eastPhone),
    b,
  ]);
  return updated;
}

async function saveLetter(services, letter, e) {
  e.preventDefault();
  const form = e.target,
    v = Object.fromEntries(new FormData(form));
  try {
    const updated = reviewedLetter(letter, v);
    const result = await services.helperJSON("/administration/snow-letter", {
      administrator: v.administrator,
      reason: v.reason,
      sourceReference: v.sourceReference,
      confirmed: v.confirmed === "on",
      letter: updated,
    });
    services.snow.setLetter(result.letter);
    document.getElementById("utility-dialog")?.close();
    services.toast("Seasonal content updated for new snow citations.");
    services.render();
  } catch (error) {
    form.querySelector("[role=alert]").textContent = error.message;
  }
}

export function initAdministration(services) {
  const esc = (value) => dep_esc(value);
  function overrideFault(c, d) {
    const b = c.overrideBasis,
      k = docCase(d);
    if (!b) return "";
    return overrideAuthorizationFault(b) || overrideCitationFault(b, c, k) || overrideHistoryFault(b, c);
  }
  async function openOverride() {
    if (!startup.HELPER?.ok || !workspace.CASEDIR?.helper) {
      services.toast("Connect the local helper and case folder first.");
      return;
    }
    const targets = [];
    for (const d of workspace.DOCS.filter((x) => x.draft && !x.pendingAmendment && !services.isLocked(x))) {
      services.citationPricing.refresh(d);
      for (const i of d.items || []) {
        const c = d.cits?.[i.id];
        if (!c || c.mandatoryAppearance) continue;
        const priced = resolveCitationAmount({
          ordinance: c.ord,
          libraryItem: itemLibraryKey(i),
          entryId: c.scheduleEntryId,
          tier: c.tier || 1,
          date: c.pricedOn || c.issued,
          measurements: c.measurements || {},
        });
        if (priced.kind === "priced") targets.push({ d, i, c });
      }
    }
    if (!targets.length) {
      services.toast("Open a draft with a determined money deposit before authorizing an exception.");
      return;
    }
    services.A11Y.utility(
      "Administrator deposit override",
      '<form id="admin-deposit-form"><p>Authorize a single exceptional deposit ' +
        "from a court or division instruction. The citation retains the administr" +
        'ator, reason, source and authorization receipt.</p><label class="f"><spa' +
        'n>Draft citation</span><select name="target">' +
        targets.map((x, n) => '<option value="' + n + '">' + esc(docCase(x.d).number + " · " + x.c.ord + " · " + x.c.num) + "</option>").join("") +
        ('</select></label><label class="f"><span>Approved method</span><select na' +
          'me="mode"><option value="total">Approved total, including assessments</o' +
          'ption><option value="base">Approved base plus scheduled assessments</opt' +
          'ion></select></label><label class="f"><span>Approved amount</span><input' +
          ' type="number" name="amount" min="0.01" step="0.01" required></label>') +
        actorFields() +
        '<p role="alert"></p><button class="btn btn-primary">Record administrator override</button></form>',
    );
    document.getElementById("admin-deposit-form").onsubmit = async (e) => {
      e.preventDefault();
      const form = e.target,
        v = Object.fromEntries(new FormData(form)),
        x = targets[Number(v.target)];
      try {
        const result = await services.helperJSON("/administration/deposit-override", {
          caseNumber: docCase(x.d).number,
          citationNumber: x.c.num,
          ordinance: x.c.ord,
          pricingDate: x.c.pricedOn || x.c.issued,
          tier: x.c.computedTier || x.c.tier,
          scheduleEntryId: x.c.scheduleEntryId || "",
          measurements: x.c.measurements || {},
          mode: v.mode,
          amount: v.amount,
          administrator: v.administrator,
          reason: v.reason,
          sourceReference: v.sourceReference,
          confirmed: v.confirmed === "on",
        });
        Object.assign(x.c, result);
        delete x.c.ok;
        if (v.mode === "total") delete x.c.assessments;
        delete x.c.reconfirmDeposit;
        x.c.pricedOn = x.c.overrideBasis.pricingDate;
        x.c.policyVersionHash = x.c.overrideBasis.policyVersionHash;
        workspace.DIRTY = true;
        await services.saveDrafts();
        document.getElementById("utility-dialog")?.close();
        services.toast("Administrator override recorded. Review the citation before issuance.");
        services.render();
      } catch (error) {
        form.querySelector("[role=alert]").textContent = error.message;
      }
    };
  }
  async function openLetter() {
    if (!startup.HELPER?.ok || !workspace.CASEDIR?.helper) {
      services.toast("Connect the local helper and case folder first.");
      return;
    }
    try {
      const { letter } = await services.helperJSON("/administration/snow-letter");
      services.A11Y.utility("Administrator snow-letter review", letterFormHTML(letter));
      document.getElementById("admin-snow-letter-form").onsubmit = (e) => saveLetter(services, letter, e);
    } catch (error) {
      services.toast(error.message);
    }
  }
  document.addEventListener("click", (e) => {
    if (e.target.closest?.("[data-admin-deposit]")) void openOverride();
    if (e.target.closest?.("[data-admin-snow-letter]")) void openLetter();
  });
  return { overrideFault, openOverride, openLetter };
}
