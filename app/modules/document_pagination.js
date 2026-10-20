import { recordDay as dep_recordDay } from "../assets/shared.js";
import {
  applyDeposit as dep_applyDeposit,
  citationNumber as dep_citationNumber,
  nextCourtDate as dep_nextCourtDate,
  toast as dep_toast,
  validISO as dep_validISO,
} from "./court_and_deposits.js";
import { saveDrafts as dep_saveDrafts, scheduleDraftSave as dep_scheduleDraftSave } from "./case_files.js";
import { narrativeFor as dep_narrativeFor } from "./reinspection_walkthrough.js";
import { itemHistory as dep_itemHistory } from "./issuance_and_corrections.js";
import { worksheetFaults as dep_worksheetFaults } from "./draft_recovery.js";
import {
  documentHTML as dep_documentHTML,
  editorSync as dep_editorSync,
  highlightOpenChecks as dep_highlightOpenChecks,
  overlayHTML as dep_overlayHTML,
  render as dep_render,
} from "./inspection_import.js";
import {
  A11Y as dep_A11Y,
  DOC_TYPES as dep_DOC_TYPES,
  PAGE_PX as dep_PAGE_PX,
  REFERRED_ONLY as dep_REFERRED_ONLY,
  clone as dep_clone,
  courtTime as dep_courtTime,
  depositStep as dep_depositStep,
  doc as dep_doc,
  docCase as dep_docCase,
  docsFor as dep_docsFor,
  esc as dep_esc,
  insp as dep_insp,
  isEffective as dep_isEffective,
  isHistoryDoc as dep_isHistoryDoc,
  kase as dep_kase,
  newDocuments as dep_newDocuments,
  openItems as dep_openItems,
  recordHead as dep_recordHead,
  snow as dep_snow,
  uid as dep_uid,
  unchecked as dep_unchecked,
} from "./app_core.js";
import { app_languagediscoveryContext } from "./app_view_contexts.js";
import { canonicalOrdinance as dep_canonicalOrdinance } from "./citation_policy.js";
import { supplemental as dep_supplemental } from "./new_documents.js";
import { WriterState } from "./state.js";
import { rememberLanguageFocus, restoreLanguageFocus } from "./language_discovery.js";
/* app functions; direct dependencies use explicit shared state. */

/* R34: pages are measured with screen styles but printed with print styles, which can lay out a few pixels taller
   (a borderline page measured 1056 on screen and 1062.8 in print). Authoring-10 documents keep a one-line allowance;
   earlier documents paginate exactly as before. */
const PRINT_SAFETY_PX = 16;
function pageLimit(d) {
  return dep_PAGE_PX - (d && d.authoringVersion >= 10 ? PRINT_SAFETY_PX : 0);
}

function docFromReinspection(r, type) {
  // only an existing document closes the worksheet; a discarded one leaves
  // it open to write the follow-up again
  if (r.docId && !dep_doc(r.docId)) r.docId = null;
  if (r.docId && (dep_doc(r.docId)?.draft || !dep_supplemental(dep_doc(r.docId)))) {
    WriterState.state.docId = r.docId;
    WriterState.state.screen = "write";
    dep_render();
    return;
  }
  const src = dep_doc(r.sourceDocId),
    carry = dep_openItems(r);
  if (!src || !dep_isEffective(src) || (!r.draft && !r.recordedAt)) {
    dep_toast("Open a current reinspection worksheet first");
    return;
  }
  if (!["extension", "citation", "referral", "referralUpdate", "compliance"].includes(type)) {
    dep_toast("Choose an available follow-up type.");
    return;
  }
  const unavailable = dep_newDocuments.eligibility?.(r, type);
  if (unavailable) {
    dep_toast(unavailable);
    return;
  }
  const faults = dep_worksheetFaults(r, type);
  if (faults.length) {
    dep_toast(faults[0]);
    return;
  }
  if (dep_unchecked(r).length) {
    dep_toast("Choose an outcome for every item first");
    return;
  }
  if (!dep_validISO(r.date) || r.date > dep_recordDay(today)) {
    dep_toast("Enter a valid inspection date");
    return;
  }
  if (type !== "compliance" && !carry.length) {
    dep_toast("Nothing outstanding to carry forward");
    return;
  }
  if (type === "compliance" && carry.length) {
    dep_toast("Items are still outstanding — a compliance letter closes every item");
    return;
  }
  const pos = new Map(src.items.map((it, i) => [it.id, i]));
  const hasHistory = !!(dep_DOC_TYPES.find((t) => t.id === type) || {}).history;
  const nd = {
    id: dep_uid("d"),
    caseId: r.caseId,
    type: type,
    created: dep_recordDay(today),
    status: "Draft",
    draft: true,
    mailed: dep_recordDay(today),
    cc: "",
    cits: {},
    fromReinspId: r.id,
    fromDocId: src.id,
    expectedHead: r.draft ? r.expectedHead || dep_recordHead(r.caseId) : dep_recordHead(r.caseId),
    replaces: r.replaces || "",
    ...(r.importInspection ? { importInspection: dep_clone(r.importInspection) } : {}),
    inspectorId: r.inspectorId || dep_kase(r.caseId).inspectorId,
    inspDate: r.date || "",
    inspTime: r.time || "",
    items: src.items.map((it) => {
      const res = r.results[it.id] || {},
        cleared = res.oc === "corrected";
      return {
        ...it,
        id: dep_uid("x"),
        no: it.no || String((pos.get(it.id) || 0) + 1),
        due: hasHistory || it.withdrawn ? "" : cleared || type === "compliance" ? it.due : res.due,
        done: cleared,
        doneOn: cleared ? res.on || r.date : "",
        note: !cleared && String(res.note || "").trim() ? String(res.note).trim() : "",
        noteOn: !cleared && String(res.note || "").trim() ? res.on || r.date : "",
        hist: hasHistory ? dep_itemHistory(r.caseId, it.no || String((pos.get(it.id) || 0) + 1)) : null,
        cite: type === "citation" && !cleared && !!res.cite,
        srcItemId: it.id,
      };
    }),
  };
  // a citation is filed per ordinance, so each ticked item gets its own form
  // register the document before its citations are numbered, so each number is
  // checked against the ones already issued on this document too
  WriterState.DOCS.unshift(nd);
  if (dep_REFERRED_ONLY.indexOf(type) < 0 && dep_docsFor(r.caseId).some((x) => !x.draft && !x.void && !x.superseded && dep_isHistoryDoc(x))) {
    WriterState.DOCS = WriterState.DOCS.filter((x) => x.id !== nd.id);
    dep_toast("This case is with the City Attorney — only an updated referral or a compliance letter can be written now");
    return;
  }
  if (type === "citation") {
    if (!nd.items.some((i) => i.cite)) {
      WriterState.DOCS = WriterState.DOCS.filter((x) => x.id !== nd.id);
      dep_toast("Select the items to cite on the inspection worksheet.");
      return;
    }
    nd.items
      .filter((i) => i.cite)
      .forEach((i) => {
        const sections = (i.sections || []).map(dep_canonicalOrdinance),
          ord = sections.length === 1 ? sections[0] : "";
        nd.cits[i.id] = {
          deptId: dep_insp(nd.inspectorId).badge || "",
          num: dep_citationNumber(),
          courtTime: dep_courtTime(),
          comment: dep_narrativeFor(r, src.items.find((x) => x.id === i.srcItemId) || i),
          ord,
          preparedSections: sections,
          autoFilledCharge: !!ord,
          desc: String(i.title || "").toUpperCase(),
          issued: dep_recordDay(today),
          courtDate: dep_nextCourtDate(dep_recordDay(today)),
          depositMode: "schedule",
        };
        dep_applyDeposit(nd, i.id, ord);
      });
  }
  r.docId = nd.id;
  WriterState.state.docId = nd.id;
  WriterState.state.screen = "write";
  WriterState.DIRTY = true;
  dep_saveDrafts();
  dep_render();
  if (type === "citation") dep_depositStep.openNext(nd);
  const n = nd.items.filter((i) => i.cite).length,
    cl = nd.items.filter((i) => i.done).length;
  dep_toast(
    type === "compliance"
      ? "Compliance letter drafted — review and issue it to close the case"
      : type === "referral" || type === "referralUpdate"
        ? (dep_DOC_TYPES.find((t) => t.id === type) || {}).label +
          " started \u2014 " +
          carry.length +
          " item" +
          (carry.length === 1 ? "" : "s") +
          " still outstanding"
        : ((dep_DOC_TYPES.find((t) => t.id === type) || {}).label || type) +
          " started \u2014 " +
          carry.length +
          " outstanding" +
          (cl ? ", " + cl + " shown as corrected" : "") +
          (n ? ", " + n + " citation" + (n === 1 ? "" : "s") : ""),
  );
}

function refreshSheet() {
  const d = dep_doc(WriterState.state.docId),
    desk = document.querySelector(".desk");
  if (d && desk) {
    desk.innerHTML = dep_documentHTML(d);
    paginate();
    syncChip();
    dep_scheduleDraftSave();
  }
}

function contHead(d) {
  const k = dep_docCase(d),
    ty = (dep_DOC_TYPES.find((t) => t.id === d.type) || {}).label || "";
  const h = document.createElement("div");
  h.className = "n-cont";
  h.innerHTML =
    "<strong>" +
    dep_esc(k.address || "") +
    "</strong><span>" +
    dep_esc(ty) +
    " &middot; continued</span>" +
    '<span class="r">' +
    dep_esc(k.number || "") +
    "</span>";
  return h;
}

/* Snow covers have no notice table; preserve their body and footer across pages. */
function paginateSnow(desk, src, d) {
  const body = src.querySelector(".snow-cover"),
    foot = src.querySelector(".n-foot");
  if (!body || !foot) return;
  const kids = [...src.children],
    at = kids.indexOf(body),
    pre = kids.slice(0, at),
    post = kids.slice(at + 1).filter((n) => n !== foot),
    pages = [];
  let page,
    container,
    contentCount = 0;
  function fresh() {
    page = document.createElement("div");
    page.className = "sheet snow-sheet" + (pages.length ? " cont" : "");
    page.style.setProperty("min-height", "0", "important");
    if (pages.length) page.appendChild(contHead(d));
    else pre.forEach((n) => page.appendChild(n));
    container = body.cloneNode(false);
    page.appendChild(container);
    page._foot = foot.cloneNode(true);
    page.appendChild(page._foot);
    pages.push(page);
    desk.insertBefore(page, src);
    contentCount = 0;
  }
  const over = () => page.scrollHeight > pageLimit(d);
  function put(node, destination = container) {
    destination.appendChild(node);
    if (over() && contentCount) {
      node.remove();
      fresh();
      container.appendChild(node);
    }
    contentCount++;
  }
  fresh();
  for (const node of [...body.children]) {
    if (node.matches("table.snow-sites")) {
      const rows = [...node.querySelector("tbody").children];
      let table = node.cloneNode(false),
        tb = document.createElement("tbody");
      table.appendChild(node.querySelector("thead").cloneNode(true));
      table.appendChild(tb);
      container.appendChild(table);
      for (const row of rows) {
        tb.appendChild(row);
        if (over() && (contentCount || tb.children.length > 1)) {
          row.remove();
          if (!tb.children.length) table.remove();
          fresh();
          table = node.cloneNode(false);
          table.appendChild(node.querySelector("thead").cloneNode(true));
          tb = document.createElement("tbody");
          table.appendChild(tb);
          container.appendChild(table);
          tb.appendChild(row);
        }
        contentCount++;
      }
    } else put(node);
  }
  for (const node of post) {
    page.insertBefore(node, page._foot);
    if (over() && contentCount) {
      node.remove();
      fresh();
      page.insertBefore(node, page._foot);
    }
    contentCount++;
  }
  src.remove();
  pages.forEach((p, n) => {
    p.style.removeProperty("min-height");
    if (pages.length > 1) {
      const pg = document.createElement("span");
      pg.className = "pg";
      pg.textContent = "Page " + (n + 1) + " of " + pages.length;
      p._foot.appendChild(pg);
    }
  });
}

function paginate(deskOverride, documentOverride) {
  const desk = deskOverride || document.querySelector(".desk");
  if (!desk) return;
  const src = desk.querySelector(".sheet");
  if (!src) return;
  const d = documentOverride || dep_doc(WriterState.state.docId);
  if (!d) return;
  // the fluid phone layout has no page geometry to divide
  if (desk.clientWidth && desk.clientWidth < 8.5 * 96) {
    src.classList.add("flow");
    return;
  }
  if (dep_snow.is(d) && d.authoringVersion >= 9) {
    paginateSnow(desk, src, d);
    return;
  }
  const table = src.querySelector("table.notice");
  const foot = src.querySelector(".n-foot");
  if (!table || !foot) return;
  const kids = Array.prototype.slice.call(src.children);
  const ti = kids.indexOf(table);
  const pre = kids.slice(0, ti);
  const rest = kids.slice(ti + 1).filter((n) => n !== foot);
  const isUI = (n) => n.classList && (n.classList.contains("no-print") || n.classList.contains("addrow"));
  const post = rest.filter((n) => !isUI(n)); // printed closing blocks
  const postUI = rest.filter(isUI); // on-screen controls, never paginated
  const thead = table.querySelector("thead");
  const rows = Array.prototype.slice.call(table.querySelector("tbody").children);

  const pages = [];
  /* Every page is built complete — running head, table header and footer all
     present — before anything is measured into it, so the fill never runs a
     page over by the height of furniture added afterwards. */
  function newPage(withTable) {
    const p = document.createElement("div");
    p.className = "sheet" + (pages.length ? " cont" : "") + (src.classList.contains("voided") ? " voided" : "");
    p.style.minHeight = "0";
    if (pages.length) p.appendChild(contHead(d));
    else pre.forEach((n) => p.appendChild(n));
    if (withTable) {
      const t = document.createElement("table");
      t.className = table.className;
      t.appendChild(thead.cloneNode(true));
      const tb = document.createElement("tbody");
      t.appendChild(tb);
      p.appendChild(t);
      p._tb = tb;
    }
    const f = foot.cloneNode(true);
    const n = document.createElement("span");
    n.className = "pg";
    f.appendChild(n);
    p.appendChild(f);
    p._foot = f;
    p._pg = n;
    pages.push(p);
    desk.insertBefore(p, src); // ahead of the citation copies
    return p;
  }
  const over = (p) => p.scrollHeight > pageLimit(d);
  const put = (p, node) => p.insertBefore(node, p._foot);

  let p = newPage(true);
  rows.forEach((r) => {
    p._tb.appendChild(r);
    // one row that will not fit anywhere still has to live somewhere
    if (over(p) && p._tb.children.length > 1) {
      p._tb.removeChild(r);
      // a group heading travels with the first row under it rather than being
      // stranded at the foot of the page
      let carry = null,
        last = p._tb.lastChild;
      if (last && last.className === "grp" && p._tb.children.length > 1) {
        carry = last;
        p._tb.removeChild(last);
      }
      p = newPage(true);
      if (carry) p._tb.appendChild(carry);
      p._tb.appendChild(r);
    }
  });
  // the closing blocks follow the table, spilling to a page of their own only
  // if they will not fit under it
  if (post.length) {
    post.forEach((n) => put(p, n));
    if (over(p) && rows.length) {
      p = newPage(false);
      post.forEach((n) => put(p, n));
    }
  }
  // the controls ride along on the last page without ever creating one
  postUI.forEach((n) => put(p, n));
  src.remove();
  pages.forEach((pg, n) => {
    pg.style.minHeight = "";
    // a single-page order carries no footer, as the division's own do not
    if (pages.length < 2) {
      pg._foot.remove();
      return;
    }
    pg._pg.textContent = "Page " + (n + 1) + " of " + pages.length;
  });
}

function syncChip() {
  dep_editorSync();
  dep_highlightOpenChecks();
}

function refreshOverlay() {
  const languageFocus = rememberLanguageFocus(app_languagediscoveryContext());
  dep_A11Y.rememberFocus();
  document.getElementById("overlay").innerHTML = dep_overlayHTML();
  enhanceDialog();
  dep_A11Y.enhance();
  const q = document.getElementById("pk-q");
  if (q) {
    q.focus();
    q.setSelectionRange(q.value.length, q.value.length);
  }
  restoreLanguageFocus(app_languagediscoveryContext(), languageFocus);
}

function enhanceDialog() {
  const box = document.querySelector('[role="dialog"]');
  const app = document.getElementById("app");
  if (app) app.inert = !!box;
  if (!box) return;
  const heading = box.querySelector("h2");
  if (heading) {
    heading.id = "dialog-title";
    box.setAttribute("aria-labelledby", "dialog-title");
  }
  box.tabIndex = -1;
  if (WriterState.state.modal === "final") {
    box.focus({ preventScroll: true });
    const body = box.querySelector(".modal-b");
    if (body) body.scrollTop = 0;
    return;
  }
  if (!box.contains(document.activeElement)) {
    const target = box.querySelector("#pk-q,button:not([disabled]),input:not([disabled])");
    (target || box).focus();
  }
}

export { docFromReinspection, refreshSheet, contHead, paginate, syncChip, refreshOverlay, enhanceDialog };
