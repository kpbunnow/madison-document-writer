import { html as screen, raw } from "./screen_html.js";
/* Presentation/search only; catalog eligibility, adoption and persistence retain their owners. */
function languageAdminScreen(R, items, query, filter) {
  const selected = R.catalogItem(R.state.catalogAdminKey),
    context = "admin|" + (selected ? R.catalogKey(selected) : "");
  return R.shell(
    "Review catalog",
    "Order language · versioned division review",
    '<button class="btn" data-language-mode="browse">Browse language</button>',
    screen`<div class="language-admin" data-language-context="${raw(R.esc(context))}"><p>Review wording, ordinance sources and replacement relationships here. Reviewer names are operator-supplied; shared-folder permissions govern access. Existing drafts require deliberate adoption, and issued documents stay frozen.</p>${raw(catalogState(R))}
 <div class="language-controls"><label class="f"><span>Find an entry</span><input type="search" id="catalog-filter" value="${raw(R.esc(query))}" placeholder="Title, ordinance or wording"></label><label class="f"><span>Review status</span><select id="catalog-status">${raw(languageFilterOptions(R, filter))}</select></label><button class="btn" data-language-refresh>Refresh review status</button></div>
 <div class="language-admin-layout"><section aria-label="Catalog review entries"><p class="language-count" role="status">${String(items.length)} matching entries</p><div class="language-admin-list">${raw(
   items
     .map(
       (i) =>
         screen`<button class="language-entry" data-catalog-open="${raw(R.esc(R.catalogKey(i)))}" aria-pressed="${String(selected && R.catalogKey(selected) === R.catalogKey(i) ? "true" : "false")}"><strong>${raw(R.esc(i.t))}</strong><span>${raw(R.esc(R.effectiveCatalog(i).s.join("; ") || "Ordinance needed"))}</span>${raw(languageBadge(R, i))}</button>`,
     )
     .join("") || "<p>No entries match these filters.</p>",
 )}</div></section>
 <section class="language-review-entry" aria-label="Selected entry review">${raw(
   selected
     ? screen`<h2 id="catalog-entry-title" tabindex="-1">${raw(R.esc(selected.t))}</h2>${raw(languageBadge(R, selected))}${raw(R.catalogReviewPanel(selected))}`
     : screen`<h2>Select an entry to review</h2><p>The search list stays separate from the review form. Unsubmitted forms are retained on this device.</p>`,
 )}</section></div></div>`,
  );
}

function languageBrowseScreen(R, items, query, filter) {
  const groups = new Map();
  for (const i of items) {
    const key = i.ci + ":" + i.gi;
    if (!groups.has(key)) groups.set(key, { title: i.cl + " · " + i.grp, items: [] });
    groups.get(key).items.push(i);
  }
  return R.shell(
    "Browse language",
    "Order language · find language for the condition you observed",
    '<button class="btn" data-language-mode="admin">Review catalog</button>',
    screen`<div class="language-browser" data-language-context="browse"><p>Search across every checklist by ordinary terms, ordinance or wording. Approved and standard language is shown by default. Standard sources and proposed or retired entries are available through the status filter.</p>${raw(catalogState(R))}
 <div class="language-controls"><label class="f"><span>Search all order language</span><input type="search" id="lib-filter" value="${raw(R.esc(query))}" placeholder="For example: garbage, handrail, 27.05"></label><label class="f"><span>Language status</span><select id="lib-status">${raw(languageFilterOptions(R, filter))}</select></label><label class="f"><span>Browse checklist</span><select id="lib-checklist"><option value="-1" ${String(R.state.libCl < 0 ? "selected" : "")}>All checklists</option>${raw(R.LIBRARY.map((c, ci) => screen`<option value="${String(ci)}" ${String(ci === R.state.libCl ? "selected" : "")}>${raw(R.esc(c.name))}</option>`).join(""))}</select></label><button class="btn" data-language-refresh>Refresh review status</button></div>
 <p class="language-count" role="status">${String(query ? "Search results across all checklists" : "Language entries")} · ${String(items.length)} matching ${String(filter === "approved" ? "approved " : "")}entries</p>
 ${raw(
   [...groups.values()]
     .map(
       (g) =>
         screen`<section class="language-group"><h2>${raw(R.esc(g.title))}</h2>${raw(
           g.items
             .map(
               (i) =>
                 screen`<article class="language-row" data-language-key="${raw(R.esc(R.catalogKey(i)))}"><div class="language-row-heading"><h3>${raw(R.esc(i.t))}</h3>${raw(languageBadge(R, i))}</div><p class="language-ordinance">${raw(R.esc(R.effectiveCatalog(i).s.join("; ") || "Ordinance needed"))}</p><p class="language-preview">${raw(R.markBlanks(R.effectiveCatalog(i).a))}</p>${raw(languageDetails(R, i))}</article>`,
             )
             .join(""),
         )}</section>`,
     )
     .join("") ||
     screen`<div class="empty"><h2>${String(filter === "approved" ? "No approved language matches" : "No matching language")}</h2><p>Try another term or status. No approval is inferred from bundled or proposed wording.</p>${raw(filter === "approved" ? '<button class="btn" data-language-standard>Include standard language</button>' : "")}</div>`,
 )}</div>`,
  );
}

function languagePickerTree(R, all, visible, q) {
  return R.LIBRARY.map((c, ci) => {
    const groups = c.groups
      .map((g, gi) => ({ g, gi, count: all.filter((i) => i.ci === ci && i.gi === gi && visible(i)).length }))
      .filter((x) => x.count || (R.state.cl === ci && R.state.grp === x.gi));
    return groups.length
      ? screen`<div class="tree-cl">${raw(R.esc(c.name))}</div>${raw(
          groups
            .map(
              ({ g, gi, count }) =>
                screen`<button class="tree-g" data-grp="${String(ci)}:${String(gi)}" aria-current="${String(!q && ci === R.state.cl && gi === R.state.grp ? "true" : "false")}"><span>${raw(R.esc(g.name))}</span><span class="n">${String(count)}</span></button>`,
            )
            .join(""),
        )}`
      : "";
  }).join("");
}

function languagePickerGroupOptions(R, all, visible, q) {
  return R.LIBRARY.map(
    (c, ci) =>
      screen`<optgroup label="${raw(R.esc(c.name))}">${raw(
        c.groups
          .map(
            (g, gi) =>
              screen`<option value="${String(ci)}:${String(gi)}" ${String(!q && ci === R.state.cl && gi === R.state.grp ? "selected" : "")}>${raw(R.esc(g.name))} (${String(all.filter((i) => i.ci === ci && i.gi === gi && visible(i)).length)})</option>`,
          )
          .join(""),
      )}</optgroup>`,
  ).join("");
}

function languagePickerResults(R, items, selected, current, filter) {
  return (
    items
      .map((i) => {
        const key = R.catalogKey(i),
          added = selected.has(key),
          working = current?.items.find((it) => R.itemLibraryKey(it) === key) || current?.selectionCache?.[key],
          e = R.effectiveCatalog(i),
          s = R.catalogStatus(i),
          blocked = ["review", "incomplete", "retired", "superseded", "unknown"].includes(s.code);
        return screen`<article class="language-pick-row" data-language-key="${raw(R.esc(key))}"><button class="gitem ${String(added ? "added" : "")}" data-pick="${String(i.ci)}:${String(i.gi)}:${String(i.o)}" aria-pressed="${String(added)}" ${String(blocked && !added ? "disabled" : "")}><div class="gitem-main"><h4>${raw(R.esc(i.t))} ${raw(added ? '<span class="added-label">Selected · remove from notice</span>' : "")}</h4><p class="language-ordinance">${raw(R.esc((working?.sections || e.s).join("; ") || "Ordinance needed"))}</p><p class="language-preview">${raw(R.markBlanks(working?.text || e.a))}</p><div class="chipbar">${raw(languageBadge(R, i))}${raw(working ? '<span class="tag">Draft item retained</span>' : "")}</div></div></button>${raw(languageDetails(R, i, working))}</article>`;
      })
      .join("") ||
    screen`<div class="empty"><h3>${String(filter === "approved" ? "No approved language matches" : "No matching language")}</h3><p>Try another term or status. Proposed wording is not approved by selecting or editing it.</p>${raw(filter === "approved" ? '<button class="btn" data-language-standard>Include standard language</button>' : "")}</div>`
  );
}

const aliases = [
  ["trash", "garbage", "rubbish", "refuse"],
  ["handrail", "railing", "banister"],
  ["sidewalk", "walkway"],
  ["feces", "faeces"],
];
const normalize = (value) =>
  String(value || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
function languageMatches(R, item, query) {
  const e = R.effectiveCatalog(item),
    c = R.LIBRARY[item.ci],
    g = c.groups[item.gi];
  const text = normalize([item.t, e.a, ...e.s, item.fillIn, item.guidance, item.catalogId, item.synonyms, c.name, c.code, g.name, g.code].join(" "));
  return normalize(query)
    .split(/\s+/)
    .filter(Boolean)
    .every((term) => {
      const word = term.length > 4 && term.endsWith("s") ? term.slice(0, -1) : term;
      return (aliases.find((group) => group.includes(word)) || [term]).some((value) => text.includes(value));
    });
}
function languageFilterOptions(R, selected, picker = false) {
  const choices = [
    ["approved", "Approved language"],
    ["usable", "Approved and standard"],
    ["review", "Needs review"],
    ["legacy", "Standard and retired"],
    ["all", "All language"],
  ];
  if (picker) choices.push(["selected", "Selected on this notice"]);
  return choices
    .map(([value, label]) => screen`<option value="${String(value)}" ${String(selected === value ? "selected" : "")}>${raw(R.esc(label))}</option>`)
    .join("");
}
function languageBadge(R, item) {
  const s = R.catalogStatus(item),
    label = {
      ready: "Approved",
      legacy: "Standard · formal approval not recorded",
      review: "Needs review",
      incomplete: "Needs review · ordinance missing",
      retired: "Retired",
      superseded: "Replaced",
      unknown: "Status unavailable",
    }[s.code];
  return screen`<span class="tag ${String(s.code === "ready" ? "ok" : "warn")}">${raw(R.esc(label || s.label))}</span>`;
}
function languageDetails(R, item, working = null) {
  const e = R.effectiveCatalog(item),
    s = R.catalogStatus(item),
    review = s.review,
    preferred = s.replacement && R.catalogItem(s.replacement.key);
  return screen`<details class="language-details"><summary>Full wording and guidance</summary><p>${raw(R.markBlanks(e.a))}</p>
 ${raw(
   working
     ? screen`<p><strong>Retained draft wording:</strong> ${raw(R.esc(working.text))} · ${raw(R.esc((working.sections || []).join("; ")))}. Deselecting removes the item; reselecting restores this draft item and its edits.</p>`
     : "",
 )}
 ${raw(item.fillIn ? screen`<p><strong>Fill in:</strong> ${raw(R.esc(item.fillIn))}</p>` : "")}${raw(item.guidance ? screen`<p>${raw(R.esc(item.guidance))}</p>` : "")}
 ${raw(
   review
     ? screen`<p>Recorded ${raw(R.esc(review.status))} v${String(review.version)} · ${raw(R.esc(review.reviewer || ""))} · ${raw(R.esc(review.at?.slice(0, 10) || ""))}. Source: ${raw(R.esc(review.source || "Not recorded"))}.</p>`
     : "",
 )}
 ${raw(
   s.code === "legacy"
     ? screen`<p>This standard source remains available under the existing selection rules. Formal catalog approval has not been recorded; this is not an Approved badge.</p>`
     : "",
 )}
 ${raw(
   preferred
     ? screen`<p>Preferred entry: <strong>${raw(R.esc(preferred.t))}</strong> · ${raw(R.esc(R.effectiveCatalog(preferred).s.join("; ")))}.</p><button class="btn btn-sm" data-language-replacement="${raw(R.esc(s.replacement.key))}">Find approved replacement</button>`
     : "",
 )}
 ${raw(
   ["review", "incomplete", "retired", "unknown"].includes(s.code)
     ? "<p>Unavailable for a new selection until the existing catalog review requirements are met.</p>"
     : "",
 )}</details>`;
}
const catalogState = (R) =>
  screen`${raw(R.CATALOG_ERROR ? screen`<div class="banner warn" role="alert">${raw(R.esc(R.CATALOG_ERROR))}</div>` : "")}<p class="hint">${String(
    R.CATALOG_FROM_CACHE
      ? R.CATALOG_ERROR
        ? "Review status from cache · refresh unavailable"
        : "Review status from cache · refreshing"
      : "Review status last verified: " + R.esc(R.CATALOG_AT || "never") + ".",
  )} Cached reviews are last-known facts; new issuance still checks the share.</p>`;
export function languageScreen(R) {
  const admin = R.state.languageMode === "admin",
    query = admin ? R.state.catalogAdminQ || "" : R.state.libFilter || "",
    filter = admin ? R.state.catalogAdminStatus || "review" : R.state.libStatus || "usable";
  const items = R.allItems().filter(
    (i) => R.catalogVisible(i, filter) && languageMatches(R, i, query) && (admin || query || R.state.libCl < 0 || i.ci === R.state.libCl),
  );
  if (admin) return languageAdminScreen(R, items, query, filter);
  return languageBrowseScreen(R, items, query, filter);
}
export function languagePicker(R) {
  if (!R.state.picker) return "";
  const current = R.doc(R.state.docId),
    all = R.allItems(),
    q = R.state.q.trim(),
    filter = R.state.pickerStatus || "usable",
    selected = new Set((current?.items || []).map((i) => R.itemLibraryKey(i)).filter(Boolean));
  const visible = (i) => (filter === "selected" ? selected.has(R.catalogKey(i)) : R.catalogVisible(i, filter));
  const items = all.filter((i) => visible(i) && languageMatches(R, i, q) && (q || R.state.cl < 0 || (i.ci === R.state.cl && i.gi === R.state.grp)));
  // Selecting language for the open draft, distinct from browsing or reviewing the catalog.
  const pickerTitle = "Select for this " + (current?.type === "notice" ? "notice" : "document");
  const group = R.LIBRARY[R.state.cl]?.groups[R.state.grp],
    label = q ? "Search results across all checklists" : group ? group.name : "All checklists";
  const tree = languagePickerTree(R, all, visible, q);
  return screen`<div class="picker" id="picker-bg"><div class="picker-box" role="dialog" aria-modal="true" aria-label="${String(pickerTitle)}" data-language-context="picker|${raw(R.esc(R.state.docId))}">
 <div class="picker-h"><h2>${String(pickerTitle)}</h2><button class="btn btn-sm" data-close="picker">Close</button></div>
 <div class="picker-search"><label class="f"><span>Search all order language</span><input type="search" id="pk-q" value="${raw(R.esc(R.state.q))}" placeholder="Title, ordinance or ordinary terms"></label><label class="f"><span>Language status</span><select id="pk-status">${raw(languageFilterOptions(R, filter, true))}</select></label>
 <select id="pk-grp" class="pk-grp" aria-label="Browse checklist group" style="display:none;margin-top:10px"><option value="-1:0" ${String(R.state.cl < 0 ? "selected" : "")}>All checklists</option>${raw(languagePickerGroupOptions(R, all, visible, q))}</select></div>
 <div class="picker-cols"><div class="picker-tree"><button class="tree-g" data-language-all>All checklists <span class="n">${String(all.filter(visible).length)}</span></button>${raw(tree)}</div><div class="picker-list"><div class="pane-h" role="status">${raw(R.esc(label))} · ${String(items.length)} matching entries</div>
 ${raw(languagePickerResults(R, items, selected, current, filter))}
 </div></div><div class="picker-footer"><label><input type="checkbox" id="keep-adding" ${String(R.state.keepAdding ? "checked" : "")}> Keep adding items</label><span data-language-selected role="status">${String(selected.size)} selected from library · ${String(current?.items.length || 0)} item${String(current?.items.length === 1 ? "" : "s")} on this notice</span><button class="btn" id="btn-savework">Save draft &amp; return to Workspace</button><button class="btn btn-primary" data-close="picker">Done adding</button></div></div></div>`;
}

function currentContext(R, picker) {
  return picker
    ? R.state.picker && R.state.screen === "write"
      ? "picker|" + R.state.docId
      : null
    : R.state.screen === "library"
      ? R.state.languageMode === "admin"
        ? "admin|" + (R.state.catalogAdminKey || "")
        : "browse"
      : null;
}
function languageControlSelector(R, active) {
  let selector = "";
  for (const a of [
    "data-pick",
    "data-catalog-open",
    "data-catalog-field",
    "data-catalog-replacement-query",
    "data-language-refresh",
    "data-language-standard",
    "data-language-replacement",
    "data-language-all",
  ])
    if (active.hasAttribute(a)) {
      selector = "[" + a + '="' + R.checkAttr(active.getAttribute(a)) + '"]';
      if (a === "data-catalog-field") selector += '[data-catalog-key="' + R.checkAttr(active.dataset.catalogKey) + '"]';
      break;
    }
  return selector;
}

export function rememberLanguageFocus(R) {
  const root = document.querySelector(".picker-box[data-language-context],.language-browser,.language-admin");
  if (!root) return null;
  const picker = root.classList.contains("picker-box"),
    context = currentContext(R, picker);
  if (root.dataset.languageContext !== context) return null;
  const active = document.activeElement,
    inside = root.contains(active);
  let selector = "";
  if (inside) {
    if (active.id) selector = "#" + active.id;
    else selector = languageControlSelector(R, active);
    if (!selector && active.matches(".language-details>summary")) {
      const key = active.closest("[data-language-key]")?.dataset.languageKey;
      if (key) selector = '[data-language-key="' + R.checkAttr(key) + '"] .language-details>summary';
    }
  }
  return {
    context,
    picker,
    selector,
    start: inside ? active.selectionStart : null,
    end: inside ? active.selectionEnd : null,
    open: [...root.querySelectorAll(".language-details[open]")].map((d) => d.closest("[data-language-key]")?.dataset.languageKey).filter(Boolean),
  };
}
export function restoreLanguageFocus(R, kept) {
  if (!kept || currentContext(R, kept.picker) !== kept.context) return;
  const root = document.querySelector(".picker-box[data-language-context],.language-browser,.language-admin");
  if (!root || root.dataset.languageContext !== kept.context) return;
  for (const key of kept.open) {
    const d = root.querySelector('[data-language-key="' + R.checkAttr(key) + '"] .language-details');
    if (d) d.open = true;
  }
  if (kept.selector) {
    const f = root.querySelector(kept.selector) || root.querySelector("#pk-q");
    f?.focus({ preventScroll: true });
    if (f && Number.isInteger(kept.start) && Number.isInteger(kept.end) && f.setSelectionRange) f.setSelectionRange(kept.start, kept.end);
  }
}
