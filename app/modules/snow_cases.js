/* Scoped UI/peer services are supplied by core; read them only when an action runs. */
import { SNOW_TYPE, courtTime } from "./document_types.js";
import { isSnowCase, itemLibraryKey } from "./document_rules.js";
import { recordDay } from "../assets/shared.js";

import { stableJSON, clone } from "./record_values.js";

import { addDays } from "./calendar.js";
import { checkTarget, esc } from "./presentation_format.js";

import { correctionSource, doc, docCase, docInsp, docsFor, kase, recordHead } from "./writer_queries.js";

import { CITATION_POLICY, formatDeposit, resolveCitationAmount } from "./citation_policy.js";
import { LIBRARY } from "./data/library.js";
import { WriterState } from "./state.js";
import { DEFAULT_SNOW_LETTER } from "./data/snow_letter.js";
const SNOW_KEY = '["ENF_PM_PROPMAINT","SNOW",1]';
export function initSnow(services) {
  let letter = JSON.parse(JSON.stringify(DEFAULT_SNOW_LETTER)),
    letterLoaded = false,
    loading = null;
  const mixed = "Snow removal cases cite only MGO 10.28. Create a separate case for other violations.";
  const WARNING = "There are no warnings given for this Ordinance violation.";
  const isCase = (k) => isSnowCase(k);
  const is = (d) => !!d && (d.caseType === SNOW_TYPE || isCase(docCase(d)));
  const season = (day) => {
    const start = CITATION_POLICY.snowSeasonStartMonthDay || "07-01",
      year = Number(day.slice(0, 4)) - (day.slice(5) < start ? 1 : 0);
    return year + "–" + String(year + 1).slice(-2);
  };
  const libraryItem = () =>
    LIBRARY.find((c) => c.code === "ENF_PM_PROPMAINT")
      .groups.find((g) => g.code === "SNOW")
      .items.find((i) => i.o === 1);
  function canAdd(d, key) {
    const snow = key === SNOW_KEY,
      other = d.items.some((i) => itemLibraryKey(i) !== SNOW_KEY);
    if ((snow && other) || (isCase(kase(d.caseId)) && !snow) || (snow && docsFor(d.caseId).some((x) => !x.draft && !is(x)))) {
      services.toast(mixed);
      return false;
    }
    return true;
  }
  function added(d, item) {
    if (itemLibraryKey(item) !== SNOW_KEY) return;
    kase(d.caseId).caseType = SNOW_TYPE;
    d.caseType = SNOW_TYPE;
    d.type = "citation";
    d.authoringVersion = 11;
    delete d.initialCitationId;
    delete d.fromDocId;
    delete d.fromReinspId;
    delete d.issuanceGroup;
    prepare(d);
    services.citationPricing.refresh(d);
  }
  function removed(d) {
    if (d.items.length) return;
    if (!docsFor(d.caseId).some((x) => !x.draft && is(x))) {
      delete kase(d.caseId).caseType;
      delete d.caseType;
      delete d.snow;
      delete d.snowInspectionId;
      d.type = "notice";
      d.cits = {};
    }
  }
  function addDefault(d) {
    const src = libraryItem();
    d.items = [
      {
        id: services.uid("x"),
        no: "1",
        sections: ["10.28"],
        title: src.t,
        text: src.a,
        libraryKey: SNOW_KEY,
        lib: { c: "ENF_PM_PROPMAINT", g: "SNOW", o: 1 },
        cite: true,
        due: null,
        dueExempt: SNOW_TYPE,
      },
    ];
    added(d, d.items[0]);
  }
  function prepare(d) {
    if (!d?.draft || !is(d) || d.pendingAmendment) return;
    if (WriterState.HELPER?.ok && !letterLoaded && !loading)
      void loadLetter().then((ok) => {
        if (ok && WriterState.state.docId === d.id) services.renderKeep();
      });
    d.authoringVersion = 11;
    d.caseType = SNOW_TYPE;
    d.snow = d.snow || { snowfallDate: "", inches: "", condition: "", photographed: false, cornerNotCleared: false };
    d.inspDate = d.inspDate || docCase(d).date || "";
    d.inspTime = d.inspTime || docCase(d).time || "";
    d.snowInspectionId = d.inspDate + "T" + d.inspTime;
    if (d.items.length !== 1) return;
    const i = d.items[0];
    if (itemLibraryKey(i) !== SNOW_KEY) return;
    i.due = null;
    i.dueExempt = SNOW_TYPE;
    i.cite = true;
    d.cits = d.cits || {};
    const c = d.cits[i.id] || {
      num: services.citationNumber(),
      ord: "10.28",
      preparedSections: ["10.28"],
      desc: CITATION_POLICY.snowDefaultDescription,
      deptId: docInsp(d).badge || "",
      issued: d.mailed,
      issuedAutomatic: true,
      courtDate: services.nextCourtDate(d.mailed),
      courtTime: courtTime(),
      depositMode: "schedule",
    };
    d.cits[i.id] = c;
    c.violDate = d.inspDate;
    c.violTime = d.inspTime;
    if (
      services.validISO(d.snow.snowfallDate) &&
      Number(d.snow.inches) > 0 &&
      ["snow covered", "ice covered", "snow and ice covered"].includes(d.snow.condition)
    )
      c.comment = comment(d);
    else c.comment = "";
  }
  function numberText(value) {
    let text = String(Number(value));
    if (!/e/i.test(text)) return text;
    const [coefficient, power] = text.split(/e/i),
      digits = coefficient.replace(".", ""),
      point = (coefficient.includes(".") ? coefficient.indexOf(".") : coefficient.length) + Number(power);
    return point <= 0
      ? "0." + "0".repeat(-point) + digits
      : point >= digits.length
        ? digits + "0".repeat(point - digits.length)
        : digits.slice(0, point) + "." + digits.slice(point);
  }
  function comment(d) {
    const f = d.snow,
      n = Number(f.inches);
    return (
      "On " +
      services.fmtDate(f.snowfallDate) +
      ", " +
      numberText(n) +
      (n === 1 ? " inch" : " inches") +
      " of snow fell. Inspection found the public sidewalk " +
      f.condition +
      "." +
      (f.cornerNotCleared ? " Snow and ice were not removed from both abutting sidewalks, including the curb ramp." : "")
    );
  }
  function checks(d) {
    if (!is(d)) return [];
    const f = d.snow || {},
      out = [],
      check = (ok, t, key) => out.push({ ok: !!ok, t, targets: key ? [checkTarget('[data-snow="' + key + '"]', t)] : [] });
    check(d.type === "citation" && d.items.length === 1 && itemLibraryKey(d.items[0]) === SNOW_KEY, mixed);
    check(services.validISO(f.snowfallDate), "Enter the snowfall / accumulation date.", "snowfallDate");
    check(
      typeof f.inches === "number" && Number.isFinite(f.inches) && f.inches > 0,
      "Snowfall inches must be a decimal greater than zero.",
      "inches",
    );
    check(["snow covered", "ice covered", "snow and ice covered"].includes(f.condition), "Choose the observed sidewalk condition.", "condition");
    check(f.photographed === true, "Confirm the violation was photographed before citation.", "photographed");
    check(services.validISO(d.inspDate) && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(d.inspTime || ""), "Enter the snow inspection date and time.");
    if (services.validISO(f.snowfallDate) && services.validISO(d.inspDate)) {
      const due = addDays(f.snowfallDate, 1);
      check(
        d.inspDate > due || (d.inspDate === due && d.inspTime >= "12:00"),
        "Under MGO 10.28(1) the owner has until noon on " + services.fmtDate(due) + "; inspect at or after that time.",
        "snowfallDate",
      );
    }
    const used = d.frozen?.snowLetter || correctionSource(d)?.frozen?.snowLetter || letter;
    if (used.season !== season(d.inspDate || recordDay(new Date())))
      out.push({ ok: false, soft: true, t: "Sand-site list was last confirmed for " + used.season + "." });
    return out;
  }
  function lifecycle(d) {
    const faults = checks(d)
        .filter((x) => !x.ok && !x.soft)
        .map((x) => x.t),
      ids = (docsFor(d.caseId) || []).filter((x) => !x.draft && !x.void && !x.superseded && is(x));
    if (!d.correction && ids.some((x) => (x.snowInspectionId || x.inspDate + "T" + x.inspTime) === d.snowInspectionId))
      faults.push("This snow inspection already has a citation. Use its correction history.");
    const c = Object.values(d.cits || {})[0];
    if (!d.correction && c?.countedOffenses?.some((x) => x.inspectionId === d.snowInspectionId))
      faults.push("This snow inspection at the property already has a citation.");
    if (d.fromDocId || d.fromReinspId || d.issuanceGroup) faults.push("Snow citations have no Official Notice or reinspection.");
    if (Array.isArray(d.expectedHead) && stableJSON(d.expectedHead) !== stableJSON(recordHead(d.caseId)))
      faults.push("The case record changed after this draft began. Reopen it before issuing.");
    return [...new Set(faults)].map((t) => ({ ok: false, t }));
  }
  function body(d) {
    if (d.frozen?.body) return d.frozen.body;
    if (d.correction?.body) return d.correction.body;
    const data = letter,
      c = Object.values(d.cits || {})[0] || {},
      at = c.pricedOn || c.issued || d.mailed;
    const totals = [1, 2].map((tier) => resolveCitationAmount({ ordinance: "10.28", tier, date: at })).map((x) => formatDeposit(x.amount));
    const paragraphs = [
      "Subject: Failure to Remove Snow and/or Ice from Public Sidewalk",
      "Madison City Ordinance 10.28(1) requires that sidewalks be cleared of al" +
        "l snow and ice not later than 12:00 noon of the day after the snow or ic" +
        "e has accumulated on the sidewalk or on a curb ramp that leads to the st" +
        "reet.",
      "When public walks are found in violation, the property owner is issued a Citation with an initial fine of " +
        totals[0] +
        ". All subsequent violations at the property during this snow season will result in a " +
        totals[1] +
        (" fine. After a City inspector photographs a sidewalk in violation and ci" +
          "tes the property, the owner has until 7:00 a.m. the following morning to" +
          " remove the hazard. Failure to do so will cause a snow removal contracto" +
          "r to do the work with costs assessed against the property. There are no " +
          "warnings given for this Ordinance violation. If you have questions about" +
          " snow removal Ordinances, please visit our website at ") +
        data.webAddress +
        ".",
      "In cases where ice has formed on the public sidewalk and cannot be remov" +
        "ed, the property owner must use sand to effectively eliminate dangerous " +
        "conditions. The City provides a mixture of sand and salt for public use " +
        "at the locations listed.",
    ];
    if (coverFormat(d) < 10)
      return (
        paragraphs.map((p) => "<p>" + esc(p) + "</p>").join("") +
        ('<table class="snow-sites"><thead><tr><th scope="col">West Side</th><th s' + 'cope="col">East Side</th></tr></thead><tbody>') +
        data.sites.map(([a, b]) => "<tr><td>" + esc(a) + "</td><td>" + esc(b) + "</td></tr>").join("") +
        "</tbody></table><p>" +
        esc(data.closing) +
        "</p>"
      );
    // Authoring 10: bold subject and warning sentence, one added line above the subject, a blank line between blocks, bold Streets contact cells.
    const phones = [data.westPhone, data.eastPhone].map((x) => String(x || "").trim()).filter(Boolean),
      cell = (v) => (phones.some((x) => String(v).includes(x)) ? "<td><strong>" + esc(v) + "</strong></td>" : "<td>" + esc(v) + "</td>");
    const second = esc(paragraphs[2]).replace(esc(WARNING), "<strong>" + esc(WARNING) + "</strong>");
    return (
      '<p class="snow-subject"><strong>' +
      esc(paragraphs[0]) +
      '</strong></p><p class="snow-para">' +
      esc(paragraphs[1]) +
      '</p><p class="snow-para">' +
      second +
      '</p><p class="snow-para">' +
      esc(paragraphs[3]) +
      ('</p><table class="snow-sites snow-sites-v10"><thead><tr><th scope="col">' +
        'West Side</th><th scope="col">East Side</th></tr></thead><tbody>') +
      data.sites.map(([a, b]) => "<tr>" + cell(a) + cell(b) + "</tr>").join("") +
      '</tbody></table><p class="snow-para snow-closing">' +
      esc(data.closing) +
      "</p>"
    );
  }
  function coverFormat(d) {
    const recorded = d?.frozen?.snowCoverFormat ?? correctionSource(d)?.frozen?.snowCoverFormat;
    if (recorded === 9 || recorded === 10) return recorded;
    return d?.correction || correctionSource(d) ? 9 : d?.authoringVersion >= 10 ? 10 : 9;
  }
  const freeze = (d) => ({
    snowLetter: clone(d.frozen?.snowLetter || correctionSource(d)?.frozen?.snowLetter || letter),
    snowSeason: season(d.inspDate),
    snowCloseOnFiling: CITATION_POLICY.snowCloseOnFiling !== false,
    ...(d.authoringVersion >= 10 ? { snowCoverFormat: coverFormat(d) } : {}),
  });
  async function loadLetter(force = false) {
    if (!WriterState.HELPER?.ok || !WriterState.CASEDIR?.helper) return false;
    if (letterLoaded && !force) return true;
    if (!loading)
      loading = services
        .helperJSON("/administration/snow-letter")
        .then((x) => {
          letter = clone(x.letter);
          letterLoaded = true;
          return true;
        })
        .catch(() => false)
        .finally(() => {
          loading = null;
        });
    return loading;
  }
  const setLetter = (data) => {
    letter = clone(data);
    letterLoaded = true;
  };
  function factsForm(d) {
    if (!is(d)) return "";
    const f = d.snow || {},
      locked = !d.draft || services.isLocked(d),
      disabled = locked ? "disabled" : "";
    return (
      '<section class="card no-print" id="snow-facts"><div class="card-h"><h2>S' +
      'now citation · MGO 10.28</h2></div><div class="card-b"><p>Snow removal c' +
      "ases issue a citation for one documented inspection. No warning notice, " +
      "due-date assignment or reinspection is required.</p>" +
      (!locked && !d.correction ? '<button class="btn btn-sm" type="button" data-remove-snow>Remove snow item</button>' : "") +
      ('<button class="btn btn-sm" type="button" data-refresh-snow-letter>Refres' +
        'h seasonal letter</button><p class="snow-action"><strong>Action:</strong' +
        '> Snow citation</p><div class="grid g2"><label class="f"><span>Snowfall ' +
        '/ accumulation date</span><input type="date" data-snow="snowfallDate" va' +
        'lue="') +
      esc(f.snowfallDate || "") +
      '" ' +
      disabled +
      ('></label><label class="f"><span>Snowfall amount (inches)</span><input ty' + 'pe="number" data-snow="inches" min="0" step="any" value="') +
      esc(f.inches ?? "") +
      '" ' +
      disabled +
      '></label><label class="f"><span>Condition observed</span><select data-snow="condition" ' +
      disabled +
      '><option value="">Choose the observed condition</option>' +
      ["snow covered", "ice covered", "snow and ice covered"]
        .map((x) => "<option " + (f.condition === x ? "selected" : "") + ">" + x + "</option>")
        .join("") +
      '</select></label></div><label><input type="checkbox" data-snow="photographed" ' +
      (f.photographed ? "checked" : "") +
      " " +
      disabled +
      '> Violation photographed before citation</label><label><input type="checkbox" data-snow="cornerNotCleared" ' +
      (f.cornerNotCleared ? "checked" : "") +
      " " +
      disabled +
      '> Corner lot, curb ramp or crosswalk border not cleared</label><p class="hint">Snow season: ' +
      esc(season(d.inspDate || recordDay(new Date()))) +
      (". Prior citations at this property in the season count, including a prev" + "ious owner by default.</p></div></section>")
    );
  }
  // R36: an SSRS Record Category of "Snow Removal" makes the import a snow case immediately (10.28 citation draft).
  function matchesImport(row) {
    const configured = CITATION_POLICY.snowAccelaCaseTypes || [],
      type = String(row?.caseType || row?.CaseType || row?.CaseTypeName || "").trim(),
      category = String(row?.recordCategory || row?.RecordCategory || "").trim();
    return (
      WriterState.WORK.entry?.["new-case-type"] === SNOW_TYPE ||
      /^snow removal$/i.test(category) ||
      configured.some((x) => String(x).toLowerCase() === type.toLowerCase())
    );
  }
  function imported(k, row) {
    if (matchesImport(row)) k.caseType = SNOW_TYPE;
  }
  function edit(e) {
    const el = e.target,
      key = el.dataset?.snow;
    if (!key) return;
    const d = doc(WriterState.state.docId);
    if (!d?.draft || services.isLocked(d) || d.pendingAmendment) return;
    d.snow = d.snow || {};
    d.snow[key] = el.type === "checkbox" ? el.checked : key === "inches" ? (el.value === "" ? "" : Number(el.value)) : el.value;
    WriterState.DIRTY = true;
    prepare(d);
    services.citationPricing.refresh(d);
    services.scheduleDraftSave();
    services.refreshSheet();
    services.initialCitations.refresh(d);
  }
  document.addEventListener("click", (e) => {
    if (e.target.closest?.("[data-refresh-snow-letter]")) {
      void loadLetter(true).then((ok) => {
        if (ok) services.renderKeep();
        else services.toast("Seasonal content could not be refreshed. Reconnect and try again.");
      });
      return;
    }
    if (!e.target.closest?.("[data-remove-snow]")) return;
    const d = doc(WriterState.state.docId);
    if (!d?.draft || d.correction || d.pendingAmendment) return;
    d.items = [];
    d.cits = {};
    removed(d);
    WriterState.DIRTY = true;
    services.saveDrafts();
    services.render();
  });
  document.addEventListener("change", (e) => {
    if (e.target.id === "new-case-type") {
      WriterState.WORK.entry = WriterState.WORK.entry || {};
      WriterState.WORK.entry["new-case-type"] = e.target.value;
      services.saveDrafts();
      services.renderKeep();
    }
  });
  document.addEventListener("input", edit);
  document.addEventListener("change", (e) => {
    if (e.target.type === "checkbox" || e.target.tagName === "SELECT") edit(e);
  });
  return {
    coverFormat,
    is,
    isCase,
    canAdd,
    added,
    removed,
    addDefault,
    prepare,
    checks,
    lifecycle,
    body,
    freeze,
    factsForm,
    season,
    comment,
    loadLetter,
    setLetter,
    imported,
    matchesImport,
  };
}
