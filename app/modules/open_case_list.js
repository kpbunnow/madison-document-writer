/* Import inspection: the open enforcement cases assigned to one inspector. The list comes from the helper's
   read-only /inspector-cases routes. Choosing a case only supplies its case number to the existing case-number
   lookup, so every import rule stays where it was. Markup builders and the filter are pure; the owner at the end
   talks to the helper and to the screen. */
import { editorState as editor } from "./editor_state.js";
import { importsState as imports } from "./imports_state.js";
import { fmtDate } from "./presentation_format.js";
import { html, raw } from "./screen_html.js";

/* In-session only: nothing here is saved to a draft, a backup or the shared folder. */
export const openList = {
  inspectors: null,
  loading: false,
  error: "",
  selected: "",
  cases: null,
  casesFor: null,
  casesLoading: false,
  casesError: "",
  query: "",
  loadedAt: "",
};
const WAIT_MS = 100000;

export function filterOpenCases(cases, query) {
  const terms = String(query || "")
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);
  if (!terms.length) return cases;
  return cases.filter((c) => {
    const text = [c.caseNumber, c.address, c.description].join(" ").toLowerCase();
    return terms.every((term) => text.includes(term));
  });
}

function openCaseLatestText(c) {
  const { type, status, date, scheduled } = c.latest;
  if (!type && !status) return "No inspection result yet";
  const when = date ? fmtDate(date) : scheduled ? "scheduled " + fmtDate(scheduled) : "";
  return [type, status, when].filter(Boolean).join(" · ");
}

function openCaseRowHTML(c, off) {
  return html`<li class="open-case"><div><strong>${c.caseNumber}</strong> · ${c.address || "No address"}</div>${raw(c.description ? html`<div class="hint">${c.description}</div>` : "")}<div class="hint">Latest inspection: ${openCaseLatestText(c)}</div><button class="btn btn-sm" type="button" data-open-case-pick="${c.caseNumber}" aria-label="Import inspection for ${c.caseNumber}, ${c.address}" ${raw(off ? "disabled" : "")}>Import</button></li>`;
}

export function openCaseRowsHTML(state, off) {
  const shown = filterOpenCases(state.cases || [], state.query);
  if (!shown.length)
    return html`<p class="hint">${state.cases && state.cases.length ? "No open case matches this search." : "This inspector has no open cases."}</p>`;
  return '<ul class="open-case-list">' + shown.map((c) => openCaseRowHTML(c, off)).join("") + "</ul>";
}

export function openCaseCountText(state) {
  const total = (state.cases || []).length,
    shown = filterOpenCases(state.cases || [], state.query).length;
  const who = (state.inspectors || []).find((p) => p.id === state.casesFor)?.name || "this inspector";
  return (
    (shown === total ? total + " open " + (total === 1 ? "case" : "cases") : shown + " of " + total + " open cases") +
    " for " +
    who +
    (state.loadedAt ? ". Loaded " + state.loadedAt + "." : ".")
  );
}

function openCasePickerHTML(state, busy) {
  const options = state.inspectors
    .map((p) => html`<option value="${p.id}" ${raw(p.id === state.selected ? "selected" : "")}>${p.name} (${p.openCases})</option>`)
    .join("");
  return html`<form id="open-cases-form" class="lookup-row"><label class="f"><span>Inspector</span><select id="open-cases-inspector" required><option value="">Choose an inspector</option>${raw(options)}</select></label><button class="btn btn-primary" type="submit" ${raw(busy ? "disabled" : "")}>${state.casesLoading ? "Loading open cases…" : "Show open cases"}</button>${raw(state.cases ? '<button class="btn" type="button" id="open-cases-refresh">Refresh</button>' : "")}</form>`;
}

function openCaseListHTML(state, off) {
  if (!state.cases) return "";
  return html`<label class="f"><span>Search these cases</span><input type="search" id="open-cases-search" value="${state.query}" autocomplete="off" placeholder="Case number, address or description"></label><p id="open-cases-count" class="hint" role="status">${openCaseCountText(state)}</p><div id="open-cases-results">${raw(openCaseRowsHTML(state, off))}</div>`;
}

function openCaseProblemHTML(message, retry) {
  return html`<div class="banner alert"><div>${message} <button class="btn btn-sm" type="button" id="${retry}">Try again</button></div></div>`;
}

export function openCaseCardHTML(state = openList) {
  const busy = state.casesLoading || imports.LOOKUP_BUSY;
  const waiting = editor.state.acc;
  const off = !!busy || !!waiting;
  let body;
  if (state.loading || (!state.inspectors && !state.error)) body = '<p role="status">Loading inspectors…</p>';
  else if (state.error) body = openCaseProblemHTML(state.error, "open-cases-retry");
  else if (!state.inspectors.length) body = openCaseProblemHTML("No inspector has open cases.", "open-cases-retry");
  else
    body =
      openCasePickerHTML(state, state.casesLoading) +
      (state.casesError ? openCaseProblemHTML(state.casesError, "open-cases-retry") : "") +
      (waiting
        ? '<div class="banner warn"><div>An import is waiting for review below. Finish or cancel it before choosing another case.</div></div>'
        : "") +
      openCaseListHTML(state, off);
  return html`<div class="card open-cases-card" id="open-cases"><div class="card-h"><h2>Open cases by inspector</h2><span class="pill">City database</span></div><div class="card-b"><p>Choose an inspector, then choose Import for a case. The import then works exactly as it does for a case number.</p><div aria-live="polite">${raw(body)}</div></div></div>`;
}

function openCaseWithLimit(promise) {
  let timer;
  const limit = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error("The list took too long to load. Check the City network and try again.")), WAIT_MS);
  });
  return Promise.race([promise, limit]).finally(() => clearTimeout(timer));
}

let serial = 0;
const redraw = (services) => editor.state.screen === "import" && services.render();
const BAD_ANSWER = "The helper sent an answer the list cannot use. Try again, or ask IT to check the installation.";

async function loadInspectors(services) {
  if (openList.loading) return;
  openList.loading = true;
  openList.error = "";
  const mine = ++serial;
  try {
    const result = await openCaseWithLimit(services.helperJSON("/inspector-cases/list", {}));
    if (mine !== serial) return;
    if (!Array.isArray(result.inspectors)) throw new Error(BAD_ANSWER);
    openList.inspectors = result.inspectors;
  } catch (error) {
    if (mine === serial) openList.error = error.message || "The inspector list could not be loaded.";
  } finally {
    if (mine === serial) openList.loading = false;
    redraw(services);
  }
}

async function showCases(services, id) {
  openList.selected = id;
  if (!id || openList.casesLoading) return;
  openList.casesLoading = true;
  openList.casesError = "";
  openList.query = "";
  const mine = ++serial;
  redraw(services);
  try {
    const result = await openCaseWithLimit(services.helperJSON("/inspector-cases/cases", { inspector: id }));
    if (mine !== serial) return;
    if (!Array.isArray(result.cases)) throw new Error(BAD_ANSWER);
    openList.cases = result.cases;
    openList.casesFor = id;
    openList.loadedAt = new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  } catch (error) {
    if (mine === serial) openList.casesError = error.message || "The open cases could not be loaded.";
  } finally {
    if (mine === serial) openList.casesLoading = false;
    redraw(services);
  }
}

/* Typing filters in place so the search box keeps focus. */
function search(value) {
  openList.query = value;
  const results = document.getElementById("open-cases-results"),
    count = document.getElementById("open-cases-count");
  if (results) results.innerHTML = openCaseRowsHTML(openList, !!imports.LOOKUP_BUSY || !!editor.state.acc);
  if (count) count.textContent = openCaseCountText(openList);
}

async function pick(services, number) {
  if (imports.LOOKUP_BUSY || editor.state.acc) return;
  editor.WORK.entry["lookup-number"] = number;
  imports.LOOKUP_ERROR = "";
  services.render();
  document.getElementById("lookup-form")?.scrollIntoView?.({ block: "center" });
  await services.findDatabaseCase();
}

export function createOpenCaseList(services) {
  /* Called while the Import screen draws: load once, never in a loop (an error waits for Try again). */
  const ensure = () => {
    if (openList.inspectors === null && !openList.loading && !openList.error) queueMicrotask(() => loadInspectors(services));
  };
  const retry = () => {
    openList.error = "";
    openList.casesError = "";
    if (openList.inspectors?.length) return showCases(services, openList.selected);
    openList.inspectors = null;
    return loadInspectors(services);
  };
  return {
    /* The card for the Import screen; it starts the first load. */
    card: () => {
      ensure();
      return openCaseCardHTML();
    },
    ensure,
    loadInspectors: () => loadInspectors(services),
    showCases: (id) => showCases(services, id),
    select: (id) => {
      openList.selected = id;
    },
    retry,
    refresh: () => showCases(services, openList.casesFor || openList.selected),
    search,
    pick: (number) => pick(services, number),
  };
}
