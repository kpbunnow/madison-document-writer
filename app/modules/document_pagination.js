import { editorState as editor } from "./editor_state.js";
/* Physical page layout only; feature workflows and editor/dialog actions retain their own owners. */
import { DOC_TYPES } from "./document_types.js";
import { doc, docCase } from "./writer_queries.js";
import { esc } from "./presentation_format.js";
import { alignedExtension } from "./document_rules.js";

/* Authoring 10+ retains the original one-line print allowance; earlier formats keep their exact limit. */
const PRINT_SAFETY_PX = 16;
function splitHistoryNote({ current, p, over, restNotes }) {
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

function splitHistoryObservation({ p, over, note, observation, rest }) {
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

function prepareHistoryContinuation({ continuation, r, restNotes, rest }) {
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
}

function paginateRowHistory({ r, p, over, newPage }) {
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
      splitHistoryNote({ current, p, over, restNotes });
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
      splitHistoryObservation({ p, over, note, observation, rest });
    }
    if (!rest.length && !restNotes.length) break;
    prepareHistoryContinuation({ continuation, r, restNotes, rest });
    p = newPage(true);
    p._tb.appendChild(continuation);
    current = continuation;
  }
  return p;
}

function numberSnowPages(pages) {
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

function pageLimitFor(services, d) {
  return services.PAGE_PX - (d && d.authoringVersion >= 10 ? PRINT_SAFETY_PX : 0);
}

function contHead(d) {
  const k = docCase(d),
    ty = (DOC_TYPES.find((t) => t.id === d.type) || {}).label || "";
  const h = document.createElement("div");
  h.className = "n-cont";
  h.innerHTML =
    "<strong>" + esc(k.address || "") + "</strong><span>" + esc(ty) + ' &middot; continued</span><span class="r">' + esc(k.number || "") + "</span>";
  return h;
}

/* Everything one notice pagination reads before it moves a node, or null when the sheet has no table and footer. */
function noticeLayout(services, desk, src, d) {
  const table = src.querySelector("table.notice");
  const foot = src.querySelector(".n-foot");
  if (!table || !foot) return null;
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
  const over = (p) => p.scrollHeight > pageLimitFor(services, d);
  return { desk, src, d, table, foot, pre, aligned, language, languageAt, post, postUI, thead, rows, over, pages: [] };
}

/* Every page is built complete — running head, table header and footer all
   present — before anything is measured into it, so the fill never runs a
   page over by the height of furniture added afterwards. */
function newPage(layout, withTable) {
  const { desk, src, d, table, foot, pre, language, languageAt, thead, pages } = layout;
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

const putOn = (p, node) => p.insertBefore(node, p._foot);

/* An aligned extension's language flows paragraph by paragraph, then the blocks after it, then the table starts. */
function fillLanguage(layout, first) {
  const { language, languageAt, pre, table, thead, over } = layout;
  let p = first;
  let body = language.cloneNode(false);
  putOn(p, body);
  for (const paragraph of [...language.children]) {
    body.appendChild(paragraph);
    if (over(p)) {
      paragraph.remove();
      if (!body.children.length) body.remove();
      p = newPage(layout, false);
      body = language.cloneNode(false);
      body.appendChild(paragraph);
      putOn(p, body);
    }
  }
  for (const node of pre.slice(languageAt + 1)) {
    putOn(p, node);
    if (over(p)) {
      node.remove();
      p = newPage(layout, false);
      putOn(p, node);
    }
  }
  const t = table.cloneNode(false);
  t.appendChild(thead.cloneNode(true));
  p._tb = document.createElement("tbody");
  t.appendChild(p._tb);
  putOn(p, t);
  return p;
}

/* Moves a row that will not fit to a new page, taking a trailing group heading along with it. */
function carryRow(layout, p, r) {
  const { aligned } = layout;
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
  p = newPage(layout, true);
  if (carry) p._tb.appendChild(carry);
  p._tb.appendChild(r);
  return p;
}

function fillRows(services, layout, first) {
  const { rows, aligned, d, over } = layout;
  let p = first;
  rows.forEach((r) => {
    p._tb.appendChild(r);
    // one row that will not fit anywhere still has to live somewhere
    if (over(p) && (p._tb.children.length > 1 || aligned)) p = carryRow(layout, p, r);
    if (services.hasItemInspectionHistory(d)) {
      p = paginateRowHistory({ r, p, over, newPage: (withTable) => newPage(layout, withTable) });
    }
  });
  return p;
}

// the closing blocks follow the table, spilling to a page of their own only
// if they will not fit under it
function fillClosing(layout, first) {
  const { post, postUI, rows, over } = layout;
  let p = first;
  if (post.length) {
    post.forEach((n) => putOn(p, n));
    if (over(p) && rows.length) {
      p = newPage(layout, false);
      post.forEach((n) => putOn(p, n));
    }
  }
  // the controls ride along on the last page without ever creating one
  postUI.forEach((n) => putOn(p, n));
  return p;
}

function numberPages(pages) {
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

function paginateNotice(services, desk, src, d) {
  const layout = noticeLayout(services, desk, src, d);
  if (!layout) return;
  let p = newPage(layout, !layout.language);
  if (layout.language) p = fillLanguage(layout, p);
  p = fillRows(services, layout, p);
  fillClosing(layout, p);
  src.remove();
  numberPages(layout.pages);
}

export function createDocumentPagination(services) {
  const pageLimit = (d) => pageLimitFor(services, d);

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
      if (!node.matches("table.snow-sites")) {
        put(node);
        continue;
      }
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
    numberSnowPages(pages);
  }

  function paginate(deskOverride, documentOverride) {
    const desk = deskOverride || document.querySelector(".desk");
    if (!desk) return;
    const src = desk.querySelector(".sheet");
    if (!src) return;
    const d = documentOverride || doc(editor.state.docId);
    if (!d) return;
    // the fluid phone layout has no page geometry to divide
    if (desk.clientWidth && desk.clientWidth < 8.5 * 96) {
      src.classList.add("flow");
      return;
    }
    if (services.snow.is(d) && d.authoringVersion >= 9) {
      paginateSnow(desk, src, d);
      return;
    }
    paginateNotice(services, desk, src, d);
  }
  return { paginate, pageLimit, contHead };
}
