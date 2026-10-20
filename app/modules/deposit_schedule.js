import { render as dep_render } from "./reports_services.js";
import { esc as dep_esc } from "./reports_core.js";
/* Read-only dated legislation explorer; descriptions never determine a charge. */
import { recordDay } from "../assets/shared.js";
import { policyAt, formatDeposit, pricingDateBasis } from "./citation_policy.js";
export function describeDepositRule(e) {
  const money = (c) => formatDeposit((c / 100).toFixed(2)),
    r = e.rule;
  if (!r)
    return e.status === "verified"
      ? e.tiers.map((t) => `${t.ordinal}${t.openEnded ? " and later" : ""}: ${money(t.amountCents)}`).join("; ")
      : "Manual approval required";
  if (r.kind === "tiers")
    return r.amountsCents.map((c, i) => `${i + 1}${i === r.amountsCents.length - 1 && r.lastOpenEnded ? " and later" : ""}: ${money(c)}`).join("; ");
  if (r.kind === "mandatory") return "Mandatory court appearance; no cash deposit. New issuance is held for approved defendant instructions.";
  if (r.kind === "per-inch") return money(r.perInchCents) + " per whole inch of tree diameter";
  if (r.kind === "tree-alternative")
    return money(r.offenseCents) + " per offense; if removed, " + money(r.perInchCents) + " per whole inch of tree diameter";
  if (r.kind === "tree-increment")
    return (
      money(r.initialCents) +
      " plus " +
      money(r.firstInchCents) +
      " per inch through " +
      r.threshold +
      " inches, plus " +
      money(r.laterInchCents) +
      " for each additional inch"
    );
  if (r.kind === "building-duration")
    return (
      "Floor area below " +
      `${r.areaThreshold.toLocaleString("en-US")}` +
      " sq ft: " +
      `${money(r.smallCents[0])}` +
      " for fewer than " +
      `${r.daysThreshold}` +
      " days; " +
      `${money(r.smallCents[1])}` +
      " from " +
      `${r.daysThreshold}` +
      " days. At or above that area: " +
      `${money(r.largeCents[0])}` +
      ", then " +
      `${money(r.largeCents[1])}` +
      " on the same duration basis."
    );
  if (r.kind === "bands")
    return (
      "Measured " +
      (e.measurements?.find((m) => m.key === r.field)?.label || r.field) +
      ": " +
      r.bands
        .map(
          (b) =>
            (b.minExclusive ? "over " : "from ") +
            b.min +
            (b.max == null ? " upward" : (b.maxInclusive ? " through " : " to below ") + b.max) +
            " → " +
            money(b.cents),
        )
        .join("; ") +
      ". Values in an unstated gap require an approved manual basis."
    );
  return "Approved manual basis required; review the source and technical rule.";
}
export function initDepositSchedule() {
  let date = recordDay(new Date()),
    query = "",
    page = 0;
  const pageSize = 40;
  function html() {
    let p;
    try {
      p = policyAt(date);
    } catch (e) {
      return (
        '<label class="f"><span>Schedule on date</span><input id="deposit-schedule-date" type="date" value="' +
        dep_esc(date) +
        '"></label><p role="alert">Enter a valid date.</p>'
      );
    }
    const terms = query.toLowerCase().trim().split(/\s+/).filter(Boolean),
      entries = p.entries.filter((e) =>
        terms.every((t) => (e.ordinance + " " + e.description + " " + (e.classification || e.status)).toLowerCase().includes(t)),
      );
    page = Math.min(page, Math.max(0, Math.ceil(entries.length / pageSize) - 1));
    const navigation =
      '<div class="schedule-pages"><p id="deposit-matches" role="status">' +
      entries.length +
      " matching schedule rows · " +
      (entries.length ? "showing " + (page * pageSize + 1) + "–" + Math.min(entries.length, (page + 1) * pageSize) : "no matches") +
      '</p><button class="btn" data-schedule-page="previous" aria-disabled="' +
      (page === 0) +
      '">Previous rows</button> <button class="btn" data-schedule-page="next" aria-disabled="' +
      ((page + 1) * pageSize >= entries.length) +
      '">Next rows</button></div>';
    const counts = p.entries.reduce((a, e) => {
      const k = e.classification || e.status;
      a[k] = (a[k] || 0) + 1;
      return a;
    }, {});
    return (
      '<label class="f"><span>Schedule on date</span><input id="deposit-schedule-date" type="date" value="' +
      dep_esc(date) +
      ('"></label><label class="f"><span>Find ordinance or description</span><in' + 'put type="search" id="deposit-schedule-search" value="') +
      dep_esc(query) +
      '"></label><p>Base deposits below exclude assessments and court costs. ' +
      dep_esc(
        Object.entries(counts)
          .map(([k, n]) => n + " " + k)
          .join(" · "),
      ) +
      ". Pricing date basis: " +
      dep_esc(pricingDateBasis) +
      (" (pending City Attorney). Retained baseline start dates are unknown; no " +
        'legal date was invented.</p><details id="deposit-policy"><summary>Policy' +
        " and calculation details</summary><p>Policy ") +
      dep_esc(p.versionHash) +
      " · court costs " +
      dep_esc(formatDeposit((p.fees.courtRates.at(-1).cents / 100).toFixed(2))) +
      ". This explorer does not authorize a charge or an override.</p></details>" +
      navigation +
      ('<div class="tw"><table class="rep"><caption>Deposit schedule, base amoun' +
        'ts and retained legal sources</caption><thead><tr><th scope="col">Ordina' +
        'nce</th><th scope="col">Description</th><th scope="col">Base amount and ' +
        'measurements</th><th scope="col">Dates and source</th></tr></thead><tbod' +
        "y>") +
      entries
        .slice(page * pageSize, (page + 1) * pageSize)
        .map(
          (e) =>
            '<tr><th scope="row">' +
            dep_esc(e.ordinance) +
            "</th><td>" +
            dep_esc(e.description) +
            "</td><td>" +
            dep_esc(describeDepositRule(e)) +
            '<p class="small">' +
            dep_esc(
              e.window?.years
                ? "Prior-offense window: " + e.window.years + " years."
                : e.window?.months
                  ? "Prior-offense window: " + e.window.months + " months."
                  : e.window?.kind === "site-season"
                    ? "Same site and season, starting " + e.window.startMonthDay + "."
                    : typeof e.window === "string" && e.window !== "none"
                      ? "Prior-offense window: " + e.window + "."
                      : "No rolling year window stated.",
            ) +
            " " +
            dep_esc(e.measurements?.map((m) => m.label).join("; ") || "No measurements required.") +
            "</p></td><td>" +
            dep_esc((e.from || "Retained baseline") + " to " + (e.to || "open")) +
            "<p>" +
            dep_esc((e.classification || e.status) + " · " + e.source.codification + " · " + (e.source.ordinance || e.source.subsection)) +
            "</p><details><summary>Source and technical details</summary><p>" +
            dep_esc((e.notice || "") + " " + e.rawText) +
            "</p><pre>" +
            dep_esc(
              JSON.stringify(
                {
                  rule: e.rule,
                  authorization: e.authorization,
                  review: e.review,
                  window: e.window,
                  countBasis: e.countBasis,
                  measurements: e.measurements,
                },
                null,
                2,
              ),
            ) +
            "</pre></details></td></tr>",
        )
        .join("") +
      "</tbody></table></div>" +
      (!entries.length ? "<p>No schedule rows match this search.</p>" : "")
    );
  }
  document.addEventListener("change", (e) => {
    if (e.target.id === "deposit-schedule-date") {
      date = e.target.value;
      page = 0;
      dep_render();
    }
  });
  document.addEventListener("input", (e) => {
    if (e.target.id === "deposit-schedule-search") {
      query = e.target.value;
      page = 0;
      dep_render();
    }
  });
  document.addEventListener("click", (e) => {
    const t = e.target.closest?.("[data-schedule-page]");
    if (!t || t.getAttribute("aria-disabled") === "true") return;
    page += t.dataset.schedulePage === "next" ? 1 : -1;
    dep_render();
    document.getElementById("deposit-matches")?.scrollIntoView({ block: "nearest" });
  });
  return { html };
}
