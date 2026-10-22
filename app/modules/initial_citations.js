import { applyDeposit, checks as dep_checks, citationNumber, fmtDate, freezeSources, inspAt, nextCourtDate } from "./court_and_deposits.js";
import { evid } from "./workspace_shell.js";
import { citationTier } from "./issuance_and_corrections.js";
import { citationReview } from "./case_timeline.js";
import { editorSync } from "./inspection_import.js";
import { citationFaces } from "./document_render.js";
import { checkTarget, citSelector, citationPricing, clone, courtTime, docInsp, docsFor, libraryReview, uid } from "./app_core.js";
import { canonicalOrdinance } from "./citation_policy.js";
/* Initial-visit notices and citations share one review and one atomic save. */
export function initInitialCitations() {
  const enabled = (d) => !!d && d.type === "notice" && d.draft && !d.correction && d.items.some((i) => i.cite && !i.withdrawn);
  function prepare(d) {
    if (!enabled(d) || d.pendingAmendment) return;
    libraryReview.refresh(d);
    d.cits = d.cits || {};
    d.initialCitationId = d.initialCitationId || uid("d");
    for (const i of d.items.filter((i) => i.cite && !i.done && !i.withdrawn)) {
      const sections = (i.sections || []).map(canonicalOrdinance).filter(Boolean),
        existing = d.cits[i.id];
      if (d.depositRequests?.[i.id]) continue;
      if (existing) {
        if (existing.preparedSections && JSON.stringify(existing.preparedSections) !== JSON.stringify(sections)) {
          if (existing.autoFilledCharge) {
            existing.ord = "";
            existing.reconfirmDeposit = true;
          }
          existing.chargeStale = true;
          existing.preparedSections = sections;
          delete existing.differentChargeSource;
        }
        continue;
      }
      const at = inspAt(d),
        ord = sections.length === 1 ? sections[0] : "";
      d.cits[i.id] = {
        num: citationNumber(),
        ord,
        autoFilledCharge: !!ord,
        preparedSections: sections,
        desc: String(i.title || "").toUpperCase(),
        deptId: docInsp(d).badge || "",
        issued: d.mailed,
        issuedAutomatic: true,
        courtDate: nextCourtDate(d.mailed),
        courtTime: courtTime(),
        tier: citationTier(d.caseId, i.no),
        depositMode: "schedule",
        comment: "Initial inspection on " + fmtDate(at.date) + " documented " + String(i.title || "the violation") + ".",
      };
      applyDeposit(d, i.id, ord);
    }
    citationPricing.refresh(d);
  }
  function preview(d) {
    prepare(d);
    const at = inspAt(d);
    return {
      ...d,
      authoringVersion: d.authoringVersion || 9,
      type: "citation",
      id: d.initialCitationId || d.id,
      fromDocId: d.id,
      inspDate: at.date,
      inspTime: at.time,
      initialPreview: true,
      frozen: null,
      items: d.items.map((i) => ({ ...i, srcItemId: i.id })),
      cits: d.cits || {},
    };
  }
  function checks(d) {
    if (!enabled(d)) return [];
    const p = preview(d),
      out = dep_checks(p).filter((c) => !c.ok);
    const numbers = p.items
      .filter((i) => i.cite && !i.withdrawn)
      .map((i) => p.cits[i.id]?.num)
      .filter(Boolean);
    if (
      new Set(numbers).size !== numbers.length ||
      docsFor(d.caseId).some((x) => !x.draft && Object.values(x.cits || {}).some((c) => numbers.includes(c.num)))
    )
      out.push({
        ok: false,
        t: "Each selected initial citation needs a distinct, unused citation number.",
        targets: p.items.filter((i) => i.cite).map((i) => checkTarget(citSelector(i.id, "num"), "Item " + i.no + " · citation number")),
      });
    return out;
  }
  function mailed(d, value) {
    const old = d.mailed;
    d.mailed = value;
    if (enabled(d)) for (const c of Object.values(d.cits || {})) if (c.issuedAutomatic && c.issued === old) c.issued = value;
  }
  function group(d, noticeEvent) {
    const p = preview(d);
    p.initialPreview = false;
    p.authoringVersion = Math.max(11, p.authoringVersion || 0);
    p.status = "Final";
    p.items = p.items.map((i) => ({ ...i, id: uid("x"), srcItemId: i.id }));
    p.cits = Object.fromEntries(p.items.filter((i) => i.cite && !i.withdrawn).map((i) => [i.id, clone(d.cits[i.srcItemId])]));
    for (const key of [
      "draft",
      "pendingAmendment",
      "publicationEvents",
      "expectedHead",
      "publicationError",
      "emailSelection",
      "selectionCache",
      "dueWork",
      "initialCitationId",
      "initialPreview",
    ])
      delete p[key];
    const identity = { id: noticeEvent.id, noticeId: d.id, citationId: p.id };
    p.issuanceGroup = identity; // set before freezing so the replacing citation freezes the notice's order furniture
    p.frozen = freezeSources(p);
    noticeEvent.payload.snapshot.issuanceGroup = identity;
    noticeEvent.payload.snapshot.authoringVersion = Math.max(11, noticeEvent.payload.snapshot.authoringVersion || 0);
    noticeEvent.payload.snapshot.cits = {};
    delete noticeEvent.payload.snapshot.initialCitationId;
    p.issuanceGroup = identity;
    const event = {
      id: evid(),
      at: new Date(Date.parse(noticeEvent.at) + 1).toISOString(),
      by: noticeEvent.by,
      type: "citation.issued",
      payload: {
        docId: p.id,
        snapshot: p,
        fromDocId: d.id,
        fromReinspId: "",
        expectedHead: noticeEvent.payload.expectedHead.concat(noticeEvent.id).sort(),
        lifecycle: 1,
      },
    };
    d.publicationEvents = [noticeEvent];
    return event;
  }
  function refresh(d) {
    const panel = document.getElementById("citation-review");
    if (!panel) return;
    const container = document.createElement("div");
    container.innerHTML = citationReview(d);
    function patch(old, next, active) {
      if (old.nodeType !== next.nodeType || old.nodeName !== next.nodeName || old.dataset?.reviewCit !== next.dataset?.reviewCit) {
        old.replaceWith(next);
        return;
      }
      if (old.nodeType === 3) {
        if (old.nodeValue !== next.nodeValue) old.nodeValue = next.nodeValue;
        return;
      }
      if (old.nodeType !== 1) return;
      for (const attr of [...old.attributes]) if (!next.hasAttribute(attr.name)) old.removeAttribute(attr.name);
      for (const attr of next.attributes) if (old.getAttribute(attr.name) !== attr.value) old.setAttribute(attr.name, attr.value);
      if (old === active) {
        old.readOnly = next.readOnly;
        old.disabled = next.disabled;
        return;
      }
      const children = [...next.childNodes];
      children.forEach((child, index) => {
        if (old.childNodes[index]) patch(old.childNodes[index], child, active);
        else old.append(child);
      });
      while (old.childNodes.length > children.length) old.lastChild.remove();
      if (/^(INPUT|SELECT|TEXTAREA)$/.test(old.tagName)) old.value = next.value;
    }
    for (const old of panel.querySelectorAll("[data-charge]")) {
      const replacement = [...container.querySelectorAll("[data-charge]")].find((el) => el.dataset.charge === old.dataset.charge);
      if (!replacement) continue;
      for (const detail of old.querySelectorAll("[data-review-details]")) {
        const next = replacement.querySelector('[data-review-details="' + detail.dataset.reviewDetails + '"]');
        if (next) next.open = detail.open;
      }
      // Never detach a focused text control: native blur would commit a half-typed ordinance.
      const active = document.activeElement,
        focused = old.contains(active);
      patch(old, replacement, active);
      if (focused && !active.isConnected) old.querySelector("input:not([disabled]),summary")?.focus({ preventScroll: true });
    }
    const copies = document.querySelector(".initial-citation-previews");
    if (copies && enabled(d)) {
      copies.innerHTML = citationFaces(preview(d), true);
      editorSync();
    }
  }
  return { enabled, prepare, preview, checks, mailed, group, refresh };
}
