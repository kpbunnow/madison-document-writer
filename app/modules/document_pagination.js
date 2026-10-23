import { recordDay } from "../assets/shared.js";
import { applyDeposit, citationNumber, nextCourtDate, toast, validISO } from "./court_and_deposits.js";
import { saveDrafts, scheduleDraftSave } from "./case_files.js";
import { narrativeFor } from "./reinspection_walkthrough.js";
import { itemHistory, itemInspectionHistory, hasItemInspectionHistory } from "./issuance_and_corrections.js";
import { worksheetFaults } from "./draft_recovery.js";
import { editorSync, highlightOpenChecks, overlayHTML, render } from "./inspection_import.js";
import { documentHTML } from "./document_render.js";
import {
  A11Y,
  DOC_TYPES,
  PAGE_PX,
  REFERRED_ONLY,
  clone,
  courtTime,
  depositStep,
  doc,
  docCase,
  docsFor,
  esc,
  insp,
  isEffective,
  isHistoryDoc,
  kase,
  newDocuments,
  openItems,
  recordHead,
  snow,
  uid,
  unchecked,
} from "./app_core.js";
import { app_languagediscoveryContext } from "./app_view_contexts.js";
import { canonicalOrdinance } from "./citation_policy.js";
import { alignedExtension, supplemental } from "./new_documents.js";
import { WriterState } from "./state.js";
import { rememberLanguageFocus, restoreLanguageFocus } from "./language_discovery.js";
/* app functions; direct dependencies use explicit shared state. */

/* R34: pages are measured with screen styles but printed with print styles, which can lay out a few pixels taller
   (a borderline page measured 1056 on screen and 1062.8 in print). Authoring-10 documents keep a one-line allowance;
   earlier documents paginate exactly as before. */
const PRINT_SAFETY_PX = 16;
function pageLimit(d) {
  return PAGE_PX - (d && d.authoringVersion >= 10 ? PRINT_SAFETY_PX : 0);
}

function docFromReinspection(r, type) {
  // only an existing document closes the worksheet; a discarded one leaves
  // it open to write the follow-up again
  if (r.docId && !doc(r.docId)) r.docId = null;
  if (r.docId && (doc(r.docId)?.draft || !supplemental(doc(r.docId)))) {
    WriterState.state.docId = r.docId;
    WriterState.state.screen = "write";
    render();
    return;
  }
  const src = doc(r.sourceDocId),
    carry = openItems(r);
  if (!src || !isEffective(src) || (!r.draft && !r.recordedAt)) {
    toast("Open a current reinspection worksheet first");
    return;
  }
  if (!["extension", "citation", "referral", "referralUpdate", "compliance"].includes(type)) {
    toast("Choose an available follow-up type.");
    return;
  }
  const unavailable = newDocuments.eligibility?.(r, type);
  if (unavailable) {
    toast(unavailable);
    return;
  }
  const faults = worksheetFaults(r, type);
  if (faults.length) {
    toast(faults[0]);
    return;
  }
  if (unchecked(r).length) {
    toast("Choose an outcome for every item first");
    return;
  }
  if (!validISO(r.date) || r.date > recordDay(today)) {
    toast("Enter a valid inspection date");
    return;
  }
  if (type !== "compliance" && !carry.length) {
    toast("Nothing outstanding to carry forward");
    return;
  }
  if (type === "compliance" && carry.length) {
    toast("Items are still outstanding — a compliance letter closes every item");
    return;
  }
  const pos = new Map(src.items.map((it, i) => [it.id, i]));
  const hasHistory = !!(DOC_TYPES.find((t) => t.id === type) || {}).history || type === "compliance";
  const nd = {
    id: uid("d"),
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
        id: uid("x"),
        no: it.no || String((pos.get(it.id) || 0) + 1),
        due: (hasHistory && type !== "compliance") || it.withdrawn ? "" : cleared || type === "compliance" ? it.due : res.due,
        done: cleared,
        doneOn: cleared ? res.on || r.date : "",
        note: !cleared && String(res.note || "").trim() ? String(res.note).trim() : "",
        noteOn: !cleared && String(res.note || "").trim() ? res.on || r.date : "",
        hist: hasHistory ? itemHistory(r.caseId, it.no || String((pos.get(it.id) || 0) + 1)) : null,
        cite: type === "citation" && !cleared && !!res.cite,
        srcItemId: it.id,
      };
    }),
  };
  // a citation is filed per ordinance, so each ticked item gets its own form
  // register the document before its citations are numbered, so each number is
  // checked against the ones already issued on this document too
  if (hasHistory) nd.items.forEach((it) => (it.hist = itemInspectionHistory(nd, it)));
  WriterState.DOCS.unshift(nd);
  if (REFERRED_ONLY.indexOf(type) < 0 && docsFor(r.caseId).some((x) => !x.draft && !x.void && !x.superseded && isHistoryDoc(x))) {
    WriterState.DOCS = WriterState.DOCS.filter((x) => x.id !== nd.id);
    toast("This case is with the City Attorney — only an updated referral or a compliance letter can be written now");
    return;
  }
  if (type === "citation") {
    if (!nd.items.some((i) => i.cite)) {
      WriterState.DOCS = WriterState.DOCS.filter((x) => x.id !== nd.id);
      toast("Select the items to cite on the inspection worksheet.");
      return;
    }
    nd.items
      .filter((i) => i.cite)
      .forEach((i) => {
        const sections = (i.sections || []).map(canonicalOrdinance),
          ord = sections.length === 1 ? sections[0] : "";
        nd.cits[i.id] = {
          deptId: insp(nd.inspectorId).badge || "",
          num: citationNumber(),
          courtTime: courtTime(),
          comment: narrativeFor(r, src.items.find((x) => x.id === i.srcItemId) || i),
          ord,
          preparedSections: sections,
          autoFilledCharge: !!ord,
          desc: String(i.title || "").toUpperCase(),
          issued: recordDay(today),
          courtDate: nextCourtDate(recordDay(today)),
          depositMode: "schedule",
        };
        applyDeposit(nd, i.id, ord);
      });
  }
  r.docId = nd.id;
  WriterState.state.docId = nd.id;
  WriterState.state.screen = "write";
  WriterState.DIRTY = true;
  saveDrafts();
  render();
  if (type === "citation") depositStep.openNext(nd);
  const n = nd.items.filter((i) => i.cite).length,
    cl = nd.items.filter((i) => i.done).length;
  toast(
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

function refreshSheet() {
  const d = doc(WriterState.state.docId),
    desk = document.querySelector(".desk");
  if (d && desk) {
    desk.innerHTML = documentHTML(d);
    paginate();
    syncChip();
    scheduleDraftSave();
  }
}

function contHead(d) {
  const k = docCase(d),
    ty = (DOC_TYPES.find((t) => t.id === d.type) || {}).label || "";
  const h = document.createElement("div");
  h.className = "n-cont";
  h.innerHTML =
    "<strong>" +
    esc(k.address || "") +
    "</strong><span>" +
    esc(ty) +
    " &middot; continued</span>" +
    '<span class="r">' +
    esc(k.number || "") +
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
  const d = documentOverride || doc(WriterState.state.docId);
  if (!d) return;
  // the fluid phone layout has no page geometry to divide
  if (desk.clientWidth && desk.clientWidth < 8.5 * 96) {
    src.classList.add("flow");
    return;
  }
  if (snow.is(d) && d.authoringVersion >= 9) {
    paginateSnow(desk, src, d);
    return;
  }
  const table = src.querySelector("table.notice");
  const foot = src.querySelector(".n-foot");
  if (!table || !foot) return;
  const kids = Array.prototype.slice.call(src.children);
  const ti = kids.indexOf(table);
  const pre = kids.slice(0, ti);
  const aligned = alignedExtension(d);
  const language = aligned ? src.querySelector(".n-body") : null;
  const languageAt = language ? pre.indexOf(language) : -1;
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
    else (language ? pre.slice(0, languageAt) : pre).forEach((n) => p.appendChild(n));
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

  let p = newPage(!language);
  if (language) {
    let body = language.cloneNode(false);
    put(p, body);
    for (const paragraph of [...language.children]) {
      body.appendChild(paragraph);
      if (over(p)) {
        paragraph.remove();
        if (!body.children.length) body.remove();
        p = newPage(false);
        body = language.cloneNode(false);
        body.appendChild(paragraph);
        put(p, body);
      }
    }
    for (const node of pre.slice(languageAt + 1)) {
      put(p, node);
      if (over(p)) {
        node.remove();
        p = newPage(false);
        put(p, node);
      }
    }
    const t = table.cloneNode(false);
    t.appendChild(thead.cloneNode(true));
    p._tb = document.createElement("tbody");
    t.appendChild(p._tb);
    put(p, t);
  }
  rows.forEach((r) => {
    p._tb.appendChild(r);
    // one row that will not fit anywhere still has to live somewhere
    if (over(p) && (p._tb.children.length > 1 || aligned)) {
      p._tb.removeChild(r);
      // a group heading travels with the first row under it rather than being
      // stranded at the foot of the page
      let carry = null,
        last = p._tb.lastChild;
      if (last && last.className === "grp" && (p._tb.children.length > 1 || aligned)) {
        carry = last;
        p._tb.removeChild(last);
      }
      if (aligned && !p._tb.children.length) p._tb.parentNode.remove();
      p = newPage(true);
      if (carry) p._tb.appendChild(carry);
      p._tb.appendChild(r);
    }
    if (hasItemInspectionHistory(d)) {
      let current = r;
      while (over(p)) {
        const history = current.querySelector(".visit-list"),
          notesOf = () => [...current.querySelectorAll(".corr [data-history-note]")];
        if ((!history || !history.children.length) && !notesOf().length) break;
        const continuation = current.cloneNode(true),
          rest = [],
          restNotes = [];
        // R62: authoring-16 notes sit under the violation; later notes continue on the next page, and one note
        // that does not fit is split at a word boundary, every character printed once.
        while (over(p) && notesOf().length) {
          const note = notesOf().at(-1);
          restNotes.unshift(note);
          note.remove();
        }
        if (restNotes.length && !over(p)) {
          const note = restNotes[0],
            body = note.lastChild,
            chars = Array.from(body?.nodeType === 3 ? body.textContent : "");
          if (chars.length) {
            const partial = note.cloneNode(true);
            current.querySelector(".corr").appendChild(partial);
            const text = partial.lastChild;
            let low = 0,
              high = chars.length;
            while (low < high) {
              const middle = Math.ceil((low + high) / 2);
              text.textContent = chars.slice(0, middle).join("");
              if (over(p)) high = middle - 1;
              else low = middle;
            }
            let split = low;
            while (split > 0 && split < chars.length && !/\s/.test(chars[split - 1])) split--;
            if (!split) split = low;
            if (split > 0) {
              text.textContent = chars.slice(0, split).join("");
              if (split < chars.length) body.textContent = chars.slice(split).join("");
              else restNotes.shift();
            } else partial.remove();
          }
        }
        while (history && over(p) && history.children.length > 1) {
          rest.unshift(history.lastElementChild);
          history.lastElementChild.remove();
        }
        // One observation can itself exceed a page. Split its note while
        // retaining the observation's date/outcome on each continuation.
        const observation = history?.firstElementChild,
          note = observation?.lastElementChild;
        if (over(p) && note?.tagName === "EM" && note.textContent.startsWith("Note: ")) {
          const chars = Array.from(note.textContent.slice(6));
          let low = 0,
            high = chars.length;
          while (low < high) {
            const middle = Math.ceil((low + high) / 2);
            note.textContent = "Note: " + chars.slice(0, middle).join("");
            if (over(p)) high = middle - 1;
            else low = middle;
          }
          if (low > 0 && low < chars.length) {
            // Prefer a word boundary, without dropping whitespace or characters.
            let split = low;
            while (split > 0 && !/\s/.test(chars[split - 1])) split--;
            if (!split) split = low;
            const remainder = observation.cloneNode(true);
            note.textContent = "Note: " + chars.slice(0, split).join("");
            remainder.lastElementChild.textContent = "Note: " + chars.slice(split).join("");
            rest.unshift(remainder);
          } else note.textContent = "Note: " + chars.join("");
        }
        if (!rest.length && !restNotes.length) break;
        continuation.removeAttribute("data-row");
        continuation.querySelectorAll("[contenteditable],[data-field],[data-id]").forEach((el) => {
          el.removeAttribute("contenteditable");
          el.removeAttribute("data-field");
          el.removeAttribute("data-id");
        });
        continuation.querySelector(".c-no").textContent = (r.querySelector(".num")?.textContent || "") + " (continued)";
        continuation.querySelector(".corr").textContent = "Inspection history continued.";
        continuation.querySelector(".corr").append(...restNotes);
        continuation.querySelector(".visit-list")?.replaceChildren(...rest);
        p = newPage(true);
        p._tb.appendChild(continuation);
        current = continuation;
      }
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
  editorSync();
  highlightOpenChecks();
}

function refreshOverlay() {
  const languageFocus = rememberLanguageFocus(app_languagediscoveryContext());
  A11Y.rememberFocus();
  document.getElementById("overlay").innerHTML = overlayHTML();
  enhanceDialog();
  A11Y.enhance();
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
  if (WriterState.state.modal === "final" || WriterState.state.modal === "review") {
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

export { docFromReinspection, refreshSheet, paginate, syncChip, refreshOverlay, enhanceDialog };
