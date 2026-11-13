import { html as screen, raw } from "./screen_html.js";
import { languageSearch, canonicalSection } from "./language_search.js";
import { activeShortcutList, isFavorite, shortcutKeys } from "./language_shortcuts.js";
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

/* The consolidated catalog replaces the earlier checklists (owner direction 2026-11-10) and is shown as Violation
   Categories with title-case group names (owner direction 2026-11-11). It is listed first; the picker's group list
   shows only its categories, while a search still reaches the earlier checklists' language. */
const CONSOLIDATED = "ENF_ORDER_CATALOG";
const CATEGORIES = "Violation Categories";
const MINOR_WORDS = new Set(["a", "an", "and", "as", "at", "by", "for", "in", "of", "on", "or", "the", "to"]);
const titleCase = (name) =>
  String(name).replace(/[A-Za-z][\w']*/g, (word, at) => (at && MINOR_WORDS.has(word.toLowerCase()) ? word : word[0].toUpperCase() + word.slice(1)));
const checklistName = (R, ci) => (R.LIBRARY[ci].code === CONSOLIDATED ? CATEGORIES : R.LIBRARY[ci].name);
const groupName = (R, ci, gi) => (R.LIBRARY[ci].code === CONSOLIDATED ? titleCase : String)(R.LIBRARY[ci].groups[gi].name);
const checklistOrder = (R) => {
  const all = R.LIBRARY.map((_, ci) => ci);
  return all.filter((ci) => R.LIBRARY[ci].code === CONSOLIDATED).concat(all.filter((ci) => R.LIBRARY[ci].code !== CONSOLIDATED));
};
const earlier = (R, ci) => R.LIBRARY[ci].code !== CONSOLIDATED;
// The checklists the picker browses: Violation Categories, or every checklist if a library has no consolidated catalog.
const pickerChecklists = (R) => (R.LIBRARY.some((c) => c.code === CONSOLIDATED) ? checklistOrder(R).slice(0, 1) : checklistOrder(R));
// Groups in the order given: by first appearance when ranked (a search), otherwise by checklist order and group.
function groupedResults(R, items, ranked) {
  const groups = new Map();
  const order = checklistOrder(R);
  const sorted = ranked ? items : items.slice().sort((a, b) => order.indexOf(a.ci) - order.indexOf(b.ci) || a.gi - b.gi);
  for (const i of sorted) {
    const key = i.ci + ":" + i.gi;
    if (!groups.has(key)) groups.set(key, { ci: i.ci, gi: i.gi, items: [] });
    groups.get(key).items.push(i);
  }
  return [...groups.values()];
}
function groupHeading(R, g, level) {
  return screen`<${raw(level)} class="language-group-h"><span class="language-group-cl">${raw(R.esc(checklistName(R, g.ci)))}${raw(earlier(R, g.ci) ? " · earlier checklist" : "")}</span><span class="language-group-name">${raw(R.esc(groupName(R, g.ci, g.gi)))}</span><span class="n">${String(g.items.length)}</span></${raw(level)}>`;
}
// The cited sections as tags at the front of an entry.
function sectionTags(R, sections) {
  return sections.length
    ? sections.map((x) => screen`<span class="cite-sec">${raw(R.esc(x))}</span>`).join("")
    : '<span class="cite-sec none">Ordinance needed</span>';
}
// An earlier-checklist entry whose ordinances a Consolidated entry cites exactly names that entry.
function consolidatedEquivalents(R, all) {
  const key = (i) => (R.effectiveCatalog(i).s || []).map(canonicalSection).sort().join("|");
  const found = new Map();
  for (const i of all) if (!earlier(R, i.ci) && key(i) && !found.has(key(i))) found.set(key(i), i);
  return (i) => (earlier(R, i.ci) ? found.get(key(i)) || null : null);
}
function alsoNote(R, equivalent) {
  return equivalent ? '<p class="language-also">Violation Categories also has language for this ordinance.</p>' : "";
}
// Entries in checklist order (Consolidated first), so equally good search results list Consolidated language first.
const inChecklistOrder = (R, items) => {
  const order = checklistOrder(R);
  return items.slice().sort((a, b) => order.indexOf(a.ci) - order.indexOf(b.ci));
};
const BLOCKED = ["review", "incomplete", "retired", "superseded", "unknown"];
function unavailableNote(R, item) {
  return BLOCKED.includes(R.catalogStatus(item).code)
    ? '<p class="language-unavailable">Not available for a new selection until division review is recorded.</p>'
    : "";
}
function countLine(query, sections, n, label) {
  if (sections.length) return String(n) + " " + (n === 1 ? "entry cites " : "entries cite ") + sections.join(" and ");
  return (query ? "Search results across all checklists" : label) + " · " + String(n) + " matching entries";
}
// Related entries (parent or sibling ordinances) stay folded until asked for.
function relatedBlock(R, related, render) {
  if (!related.length) return "";
  return screen`<section class="language-related" data-language-key="related-sections"><details class="language-details language-related-list"><summary>Show related sections (${String(related.length)})</summary><p class="hint">These entries cite the parent or a neighbouring part of the ordinance you searched for.</p>${raw(render(related))}</details></section>`;
}

function languageBrowseScreen(R, found, query, filter) {
  const items = found.matches,
    equivalent = consolidatedEquivalents(R, R.allItems());
  const card = (i) =>
    screen`<article class="language-row" data-language-key="${raw(R.esc(R.catalogKey(i)))}"><div class="language-row-heading language-entry-head">${raw(sectionTags(R, R.effectiveCatalog(i).s))}<h3>${raw(R.esc(i.t))}</h3></div><p class="language-preview">${raw(R.markBlanks(R.effectiveCatalog(i).a))}</p>${raw(unavailableNote(R, i))}${raw(alsoNote(R, equivalent(i)))}${raw(languageDetails(R, i))}</article>`;
  const groups = (list) =>
    groupedResults(R, list, !!query)
      .map((g) => screen`<section class="language-group">${raw(groupHeading(R, g, "h2"))}${raw(g.items.map(card).join(""))}</section>`)
      .join("");
  return R.shell(
    "Browse language",
    "Order language · find language for the condition you observed",
    '<button class="btn" data-language-mode="admin">Review catalog</button>',
    screen`<div class="language-browser" data-language-context="browse"><p>Search across every checklist by ordinary terms, ordinance or wording. Violation Categories are listed first; the earlier checklists follow. Approved and standard language is shown by default. Standard sources and proposed or retired entries are available through the status filter.</p>${raw(catalogState(R))}
 <div class="language-controls"><label class="f"><span>Search all order language</span><input type="search" id="lib-filter" value="${raw(R.esc(query))}" placeholder="For example: garbage, handrail, 27.05"></label><label class="f"><span>Language status</span><select id="lib-status">${raw(languageFilterOptions(R, filter))}</select></label><label class="f"><span>Browse checklist</span><select id="lib-checklist"><option value="-1" ${String(R.state.libCl < 0 ? "selected" : "")}>All checklists</option>${raw(
   checklistOrder(R)
     .map(
       (ci) => screen`<option value="${String(ci)}" ${String(ci === R.state.libCl ? "selected" : "")}>${raw(R.esc(checklistName(R, ci)))}</option>`,
     )
     .join(""),
 )}</select></label><button class="btn" data-language-refresh>Refresh review status</button></div>
 <p class="language-count" role="status">${raw(R.esc(countLine(query, found.sections, items.length, "Language entries")))}</p>
 ${raw(
   groups(items) ||
     screen`<div class="empty"><h2>${String(filter === "approved" ? "No approved language matches" : "No matching language")}</h2><p>Try another term or status. No approval is inferred from bundled or proposed wording.</p>${raw(filter === "approved" ? '<button class="btn" data-language-standard>Include standard language</button>' : "")}</div>`,
 )}${raw(relatedBlock(R, found.related, groups))}</div>`,
  );
}

// Favorites and Recently used head the group list once they hold something that can be shown now.
const SHORTCUT_LABELS = { favorites: "Favorites", recent: "Recently used" };
function shortcutItems(R, all, visible, name) {
  const keys = shortcutKeys(name);
  return all
    .filter((i) => visible(i) && keys.includes(R.catalogKey(i)))
    .sort((a, b) => keys.indexOf(R.catalogKey(a)) - keys.indexOf(R.catalogKey(b)));
}
function languageShortcutButtons(R, all, visible) {
  const active = activeShortcutList(R.state);
  return Object.keys(SHORTCUT_LABELS)
    .map((name) => [name, shortcutItems(R, all, visible, name).length])
    .filter(([, count]) => count)
    .map(
      ([name, count]) =>
        screen`<button class="tree-g tree-shortcut" data-language-list="${name}" aria-current="${String(active === name)}"><span>${SHORTCUT_LABELS[name]}</span><span class="n">${String(count)}</span></button>`,
    )
    .join("");
}
function favoriteButton(R, i) {
  const key = R.catalogKey(i),
    on = isFavorite(key);
  return screen`<button type="button" class="btn btn-sm language-favorite" data-language-favorite="${key}" aria-pressed="${String(on)}" aria-label="Favorite: ${raw(R.esc(i.t))}">${on ? "★" : "☆"} Favorite</button>`;
}

function languagePickerTree(R, all, visible, q) {
  return pickerChecklists(R)
    .map(
      (ci) =>
        screen`<div class="tree-cl">${raw(R.esc(checklistName(R, ci)))}</div>${raw(
          R.LIBRARY[ci].groups
            .map((g, gi) => ({ gi, count: all.filter((i) => i.ci === ci && i.gi === gi && visible(i)).length }))
            // A category with nothing to offer under the current status is left out, unless it is the one open.
            .filter(({ gi, count }) => count || (R.state.cl === ci && R.state.grp === gi))
            .map(
              ({ gi, count }) =>
                screen`<button class="tree-g" data-grp="${String(ci)}:${String(gi)}" aria-current="${String(!q && ci === R.state.cl && gi === R.state.grp ? "true" : "false")}"><span>${raw(R.esc(groupName(R, ci, gi)))}</span><span class="n">${String(count)}</span></button>`,
            )
            .join(""),
        )}`,
    )
    .join("");
}

function languagePickerGroupOptions(R, all, visible, q) {
  return pickerChecklists(R)
    .map(
      (ci) =>
        screen`<optgroup label="${raw(R.esc(checklistName(R, ci)))}">${raw(
          R.LIBRARY[ci].groups
            .map(
              (g, gi) =>
                screen`<option value="${String(ci)}:${String(gi)}" ${String(!q && ci === R.state.cl && gi === R.state.grp ? "selected" : "")}>${raw(R.esc(groupName(R, ci, gi)))} (${String(all.filter((i) => i.ci === ci && i.gi === gi && visible(i)).length)})</option>`,
            )
            .join(""),
        )}</optgroup>`,
    )
    .join("");
}

// What a selected entry's card says: once, or on the notice several times (each copy removed in Violation Items).
function selectedLabel(copies) {
  if (copies > 1) return screen`<span class="added-label">On this notice ×${String(copies)} · remove copies in Violation Items</span>`;
  return copies ? '<span class="added-label">Selected · remove from notice</span>' : "";
}

// Another copy with the stock language (owner direction 2026-11-10); not for the snow item or an entry needing review.
function addAgainButton(R, i, pick, show) {
  return show && R.LIBRARY[i.ci].groups[i.gi].code !== "SNOW"
    ? screen`<button type="button" class="btn btn-sm language-add-again" data-pick-again="${pick}" aria-label="Add again: another copy of ${raw(R.esc(i.t))}">Add again</button>`
    : "";
}

function languagePickerCard(R, i, selected, current, equivalent) {
  const key = R.catalogKey(i),
    copies = (current?.items || []).filter((it) => R.itemLibraryKey(it) === key).length,
    added = selected.has(key),
    working = current?.items.find((it) => R.itemLibraryKey(it) === key) || current?.selectionCache?.[key],
    e = R.effectiveCatalog(i),
    blocked = BLOCKED.includes(R.catalogStatus(i).code),
    pick = String(i.ci) + ":" + String(i.gi) + ":" + String(i.o);
  return screen`<article class="language-pick-row" data-language-key="${raw(R.esc(key))}"><button class="gitem ${String(added ? "added" : "")}" data-pick="${pick}" aria-pressed="${String(added)}" ${String(blocked && !added ? "disabled" : "")}><div class="gitem-main"><div class="language-entry-head">${raw(sectionTags(R, working?.sections || e.s))}<h4>${raw(R.esc(i.t))} ${raw(selectedLabel(added ? copies : 0))}</h4></div><p class="language-preview">${raw(R.markBlanks(working?.text || e.a))}</p>${raw(blocked && !added ? unavailableNote(R, i) : "")}${raw(alsoNote(R, equivalent(i)))}${raw(working ? '<div class="chipbar"><span class="tag">Draft item retained</span></div>' : "")}</div></button><div class="language-card-actions">${raw(addAgainButton(R, i, pick, added && !blocked))}${raw(favoriteButton(R, i))}</div>${raw(languageDetails(R, i, working))}</article>`;
}

function languagePickerResults(R, found, ranked, selected, current, filter) {
  const equivalent = consolidatedEquivalents(R, R.allItems());
  const groups = (list) =>
    groupedResults(R, list, ranked)
      .map(
        (g) =>
          screen`<section class="language-pick-group">${raw(groupHeading(R, g, "h3"))}${raw(g.items.map((i) => languagePickerCard(R, i, selected, current, equivalent)).join(""))}</section>`,
      )
      .join("");
  return (
    (groups(found.matches) ||
      screen`<div class="empty"><h3>${String(filter === "approved" ? "No approved language matches" : "No matching language")}</h3><p>Try another term or status. Proposed wording is not approved by selecting or editing it.</p>${raw(filter === "approved" ? '<button class="btn" data-language-standard>Include standard language</button>' : "")}</div>`) +
    relatedBlock(R, found.related, groups)
  );
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
    preferred = s.replacement && R.catalogItem(s.replacement.key);
  return screen`<details class="language-details"><summary>Full wording and guidance</summary><p>${raw(R.markBlanks(e.a))}</p>
 ${raw(
   working
     ? screen`<p><strong>Retained draft wording:</strong> ${raw(R.esc(working.text))} · ${raw(R.esc((working.sections || []).join("; ")))}. Deselecting removes the item; reselecting restores this draft item and its edits.</p>`
     : "",
 )}
 ${raw(item.fillIn ? screen`<p><strong>Fill in:</strong> ${raw(R.esc(item.fillIn))}</p>` : "")}${raw(item.guidance ? screen`<p>${raw(R.esc(item.guidance))}</p>` : "")}
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
  const found = languageSearch(
    R,
    inChecklistOrder(
      R,
      R.allItems().filter((i) => R.catalogVisible(i, filter) && (admin || query || R.state.libCl < 0 || i.ci === R.state.libCl)),
    ),
    query,
  );
  if (admin) return languageAdminScreen(R, found.matches, query, filter);
  return languageBrowseScreen(R, found, query, filter);
}
export function languagePicker(R) {
  if (!R.state.picker) return "";
  const current = R.doc(R.state.docId),
    all = R.allItems(),
    q = R.state.q.trim(),
    filter = R.state.pickerStatus || "usable",
    selected = new Set((current?.items || []).map((i) => R.itemLibraryKey(i)).filter(Boolean));
  const visible = (i) => (filter === "selected" ? selected.has(R.catalogKey(i)) : R.catalogVisible(i, filter)),
    browsed = pickerChecklists(R);
  const list = filter === "selected" ? "" : activeShortcutList(R.state);
  const found = list
      ? { matches: shortcutItems(R, all, visible, list), related: [], sections: [] }
      : languageSearch(
          R,
          inChecklistOrder(
            R,
            all.filter(
              (i) =>
                visible(i) && (q || filter === "selected" || (R.state.cl < 0 ? browsed.includes(i.ci) : i.ci === R.state.cl && i.gi === R.state.grp)),
            ),
          ),
          q,
        ),
    items = found.matches;
  // Selecting language for the open draft, distinct from browsing or reviewing the catalog.
  const pickerTitle = "Select for this " + (current?.type === "notice" ? "notice" : "document");
  const group = R.LIBRARY[R.state.cl]?.groups[R.state.grp] ? groupName(R, R.state.cl, R.state.grp) : "",
    label = countLine(
      q,
      found.sections,
      items.length,
      group || SHORTCUT_LABELS[list] || (filter === "selected" ? "Selected on this notice" : "All violation categories"),
    );
  const tree = languagePickerTree(R, all, visible, q);
  return screen`<div class="picker" id="picker-bg"><div class="picker-box" role="dialog" aria-modal="true" aria-label="${String(pickerTitle)}" data-language-context="picker|${raw(R.esc(R.state.docId))}">
 <div class="picker-h"><h2>${String(pickerTitle)}</h2><button class="btn btn-sm" data-close="picker">Close</button></div>
 <div class="picker-search"><label class="f"><span>Search all order language</span><input type="search" id="pk-q" value="${raw(R.esc(R.state.q))}" placeholder="Title, ordinance or ordinary terms"></label><label class="f"><span>Language status</span><select id="pk-status">${raw(languageFilterOptions(R, filter, true))}</select></label>
 <select id="pk-grp" class="pk-grp" aria-label="Browse violation category" style="display:none;margin-top:10px"><option value="-1:0" ${String(R.state.cl < 0 ? "selected" : "")}>All violation categories</option>${raw(languagePickerGroupOptions(R, all, visible, q))}</select></div>
 <div class="picker-cols"><div class="picker-tree">${raw(languageShortcutButtons(R, all, visible))}<button class="tree-g" data-language-all>All violation categories <span class="n">${String(all.filter((i) => visible(i) && browsed.includes(i.ci)).length)}</span></button>${raw(tree)}</div><div class="picker-list"><div class="pane-h" role="status">${raw(R.esc(label))}</div>
 ${raw(languagePickerResults(R, found, !!q || !!list, selected, current, filter))}
 </div></div><div class="picker-footer"><span data-language-selected role="status">${String(selected.size)} selected from library · ${String(current?.items.length || 0)} item${String(current?.items.length === 1 ? "" : "s")} on this notice</span><button class="btn btn-primary" data-close="picker">Done adding</button></div></div></div>`;
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
    "data-language-favorite",
    "data-language-list",
    "data-pick-again",
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
