/* Presentation/search only; catalog eligibility, adoption and persistence retain their owners. */
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
  return choices.map(([value, label]) => `<option value="${value}" ${selected === value ? "selected" : ""}>${R.esc(label)}</option>`).join("");
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
  return `<span class="tag ${s.code === "ready" ? "ok" : "warn"}">${R.esc(label || s.label)}</span>`;
}
function languageDetails(R, item, working = null) {
  const e = R.effectiveCatalog(item),
    s = R.catalogStatus(item),
    review = s.review,
    preferred = s.replacement && R.catalogItem(s.replacement.key);
  return (
    '<details class="language-details"><summary>Full wording and guidance</su' +
    "mmary><p>" +
    `${R.markBlanks(e.a)}` +
    "</p>\n " +
    "".concat(
      working
        ? "<p><strong>Retained draft wording:</strong> " +
            `${R.esc(working.text)}` +
            " · " +
            `${R.esc((working.sections || []).join("; "))}` +
            ". Deselecting removes the item; reselecting restores this draft item and" +
            " its edits.</p>"
        : "",
    ) +
    "\n " +
    `${item.fillIn ? `<p><strong>Fill in:</strong> ${R.esc(item.fillIn)}</p>` : ""}` +
    "" +
    `${item.guidance ? `<p>${R.esc(item.guidance)}</p>` : ""}` +
    "\n " +
    "".concat(
      review
        ? "<p>Recorded " +
            `${R.esc(review.status)}` +
            " v" +
            `${review.version}` +
            " · " +
            `${R.esc(review.reviewer || "")}` +
            " · " +
            `${R.esc(review.at?.slice(0, 10) || "")}` +
            ". Source: " +
            `${R.esc(review.source || "Not recorded")}` +
            ".</p>"
        : "",
    ) +
    "\n " +
    "".concat(
      s.code === "legacy"
        ? "<p>This standard source remains available under the existing selection r" +
            "ules. Formal catalog approval has not been recorded; this is not an Appr" +
            "oved badge.</p>"
        : "",
    ) +
    "\n " +
    "".concat(
      preferred
        ? "<p>Preferred entry: <strong>" +
            `${R.esc(preferred.t)}` +
            "</strong> · " +
            `${R.esc(R.effectiveCatalog(preferred).s.join("; "))}` +
            '.</p><button class="btn btn-sm" data-language-replacement="' +
            `${R.esc(s.replacement.key)}` +
            '">Find approved replacement</button>'
        : "",
    ) +
    "\n " +
    "".concat(
      ["review", "incomplete", "retired", "unknown"].includes(s.code)
        ? "<p>Unavailable for a new selection until the existing catalog review requirements are met.</p>"
        : "",
    ) +
    "</details>"
  );
}
const catalogState = (R) =>
  "" +
  `${R.CATALOG_ERROR ? `<div class="banner warn" role="alert">${R.esc(R.CATALOG_ERROR)}</div>` : ""}` +
  '<p class="hint">' +
  "".concat(
    R.CATALOG_FROM_CACHE
      ? R.CATALOG_ERROR
        ? "Review status from cache · refresh unavailable"
        : "Review status from cache · refreshing"
      : "Review status last verified: " + R.esc(R.CATALOG_AT || "never") + ".",
  ) +
  " Cached reviews are last-known facts; new issuance still checks the shar" +
  "e.</p>";
export function languageScreen(R) {
  const admin = R.state.languageMode === "admin",
    query = admin ? R.state.catalogAdminQ || "" : R.state.libFilter || "",
    filter = admin ? R.state.catalogAdminStatus || "review" : R.state.libStatus || "approved";
  const items = R.allItems().filter(
    (i) => R.catalogVisible(i, filter) && languageMatches(R, i, query) && (admin || query || R.state.libCl < 0 || i.ci === R.state.libCl),
  );
  if (admin) {
    const selected = R.catalogItem(R.state.catalogAdminKey),
      context = "admin|" + (selected ? R.catalogKey(selected) : "");
    return R.shell(
      "Review catalog",
      "Order language · versioned division review",
      '<button class="btn" data-language-mode="browse">Browse language</button>',
      '<div class="language-admin" data-language-context="' +
        `${R.esc(context)}` +
        '"><p>Review wording, ordinance sources and replacement relationships her' +
        "e. Reviewer names are operator-supplied; shared-folder permissions gover" +
        "n access. Existing drafts require deliberate adoption, and issued docume" +
        "nts stay frozen.</p>" +
        `${catalogState(R)}` +
        '\n <div class="language-controls"><label class="f"><span>Find an entry</s' +
        'pan><input type="search" id="catalog-filter" value="' +
        `${R.esc(query)}` +
        '" placeholder="Title, ordinance or wording"></label><label class="f"><sp' +
        'an>Review status</span><select id="catalog-status">' +
        `${languageFilterOptions(R, filter)}` +
        '</select></label><button class="btn" data-language-refresh>Refresh revie' +
        'w status</button></div>\n <div class="language-admin-layout"><section ari' +
        'a-label="Catalog review entries"><p class="language-count" role="status"' +
        ">" +
        `${items.length}` +
        ' matching entries</p><div class="language-admin-list">' +
        "".concat(
          items
            .map(
              (i) =>
                '<button class="language-entry" data-catalog-open="' +
                `${R.esc(R.catalogKey(i))}` +
                '" aria-pressed="' +
                `${selected && R.catalogKey(selected) === R.catalogKey(i) ? "true" : "false"}` +
                '"><strong>' +
                `${R.esc(i.t)}` +
                "</strong><span>" +
                `${R.esc(R.effectiveCatalog(i).s.join("; ") || "Ordinance needed")}` +
                "</span>" +
                `${languageBadge(R, i)}` +
                "</button>",
            )
            .join("") || "<p>No entries match these filters.</p>",
        ) +
        '</div></section>\n <section class="language-review-entry" aria-label="Sel' +
        'ected entry review">' +
        "".concat(
          selected
            ? '<h2 id="catalog-entry-title" tabindex="-1">' +
                `${R.esc(selected.t)}` +
                "</h2>" +
                `${languageBadge(R, selected)}` +
                "" +
                `${R.catalogReviewPanel(selected)}` +
                ""
            : "<h2>Select an entry to review</h2><p>The search list stays separate from" +
                " the review form. Unsubmitted forms are retained on this device.</p>",
        ) +
        "</section></div></div>",
    );
  }
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
    '<div class="language-browser" data-language-context="browse"><p>Search a' +
      "cross every checklist by ordinary terms, ordinance or wording. Approved " +
      "language is shown by default. Standard sources and proposed or retired e" +
      "ntries are available through the status filter.</p>" +
      `${catalogState(R)}` +
      '\n <div class="language-controls"><label class="f"><span>Search all order' +
      ' language</span><input type="search" id="lib-filter" value="' +
      `${R.esc(query)}` +
      '" placeholder="For example: garbage, handrail, 27.05"></label><label cla' +
      'ss="f"><span>Language status</span><select id="lib-status">' +
      `${languageFilterOptions(R, filter)}` +
      '</select></label><label class="f"><span>Browse checklist</span><select i' +
      'd="lib-checklist"><option value="-1" ' +
      `${R.state.libCl < 0 ? "selected" : ""}` +
      ">All checklists</option>" +
      "".concat(R.LIBRARY.map((c, ci) => `<option value="${ci}" ${ci === R.state.libCl ? "selected" : ""}>${R.esc(c.name)}</option>`).join("")) +
      '</select></label><button class="btn" data-language-refresh>Refresh revie' +
      'w status</button></div>\n <p class="language-count" role="status">' +
      `${query ? "Search results across all checklists" : "Language entries"}` +
      " · " +
      `${items.length}` +
      " matching " +
      `${filter === "approved" ? "approved " : ""}` +
      "entries</p>\n " +
      "".concat(
        [...groups.values()]
          .map(
            (g) =>
              '<section class="language-group"><h2>' +
              `${R.esc(g.title)}` +
              "</h2>" +
              "".concat(
                g.items
                  .map(
                    (i) =>
                      '<article class="language-row" data-language-key="' +
                      `${R.esc(R.catalogKey(i))}` +
                      '"><div class="language-row-heading"><h3>' +
                      `${R.esc(i.t)}` +
                      "</h3>" +
                      `${languageBadge(R, i)}` +
                      '</div><p class="language-ordinance">' +
                      `${R.esc(R.effectiveCatalog(i).s.join("; ") || "Ordinance needed")}` +
                      '</p><p class="language-preview">' +
                      `${R.markBlanks(R.effectiveCatalog(i).a)}` +
                      "</p>" +
                      `${languageDetails(R, i)}` +
                      "</article>",
                  )
                  .join(""),
              ) +
              "</section>",
          )
          .join("") ||
          '<div class="empty"><h2>' +
            `${filter === "approved" ? "No approved language matches" : "No matching language"}` +
            "</h2><p>Try another term or status. No approval is inferred from bundled" +
            " or proposed wording.</p>" +
            "".concat(filter === "approved" ? '<button class="btn" data-language-standard>Include standard language</button>' : "") +
            "</div>",
      ) +
      "</div>",
  );
}
export function languagePicker(R) {
  if (!R.state.picker) return "";
  const current = R.doc(R.state.docId),
    all = R.allItems(),
    q = R.state.q.trim(),
    filter = R.state.pickerStatus || "approved",
    selected = new Set((current?.items || []).map((i) => R.itemLibraryKey(i)).filter(Boolean));
  const visible = (i) => (filter === "selected" ? selected.has(R.catalogKey(i)) : R.catalogVisible(i, filter));
  const items = all.filter((i) => visible(i) && languageMatches(R, i, q) && (q || R.state.cl < 0 || (i.ci === R.state.cl && i.gi === R.state.grp)));
  // Selecting language for the open draft, distinct from browsing or reviewing the catalog.
  const pickerTitle = "Select for this " + (current?.type === "notice" ? "notice" : "document");
  const group = R.LIBRARY[R.state.cl]?.groups[R.state.grp],
    label = q ? "Search results across all checklists" : group ? group.name : "All checklists";
  const tree = R.LIBRARY.map((c, ci) => {
    const groups = c.groups
      .map((g, gi) => ({ g, gi, count: all.filter((i) => i.ci === ci && i.gi === gi && visible(i)).length }))
      .filter((x) => x.count || (R.state.cl === ci && R.state.grp === x.gi));
    return groups.length
      ? `<div class="tree-cl">${R.esc(c.name)}</div>` +
          groups
            .map(
              ({ g, gi, count }) =>
                '<button class="tree-g" data-grp="' +
                `${ci}` +
                ":" +
                `${gi}` +
                '" aria-current="' +
                `${!q && ci === R.state.cl && gi === R.state.grp ? "true" : "false"}` +
                '"><span>' +
                `${R.esc(g.name)}` +
                '</span><span class="n">' +
                `${count}` +
                "</span></button>",
            )
            .join("")
      : "";
  }).join("");
  return (
    '<div class="picker" id="picker-bg"><div class="picker-box" role="dialog"' +
    ' aria-modal="true" aria-label="' +
    pickerTitle +
    '" data-language-context' +
    '="picker|' +
    `${R.esc(R.state.docId)}` +
    '">\n <div class="picker-h"><h2>' +
    pickerTitle +
    '</h2><button class="btn ' +
    'btn-sm" data-close="picker">Close</button></div>\n <div class="picker-sea' +
    'rch"><label class="f"><span>Search all order language</span><input type=' +
    '"search" id="pk-q" value="' +
    `${R.esc(R.state.q)}` +
    '" placeholder="Title, ordinance or ordinary terms"></label><label class=' +
    '"f"><span>Language status</span><select id="pk-status">' +
    `${languageFilterOptions(R, filter, true)}` +
    '</select></label>\n <select id="pk-grp" class="pk-grp" aria-label="Browse' +
    ' checklist group" style="display:none;margin-top:10px"><option value="-1' +
    ':0" ' +
    `${R.state.cl < 0 ? "selected" : ""}` +
    ">All checklists</option>" +
    "".concat(
      R.LIBRARY.map(
        (c, ci) =>
          `<optgroup label="${R.esc(c.name)}">` +
          c.groups
            .map(
              (g, gi) =>
                '<option value="' +
                `${ci}` +
                ":" +
                `${gi}` +
                '" ' +
                `${!q && ci === R.state.cl && gi === R.state.grp ? "selected" : ""}` +
                ">" +
                `${R.esc(g.name)}` +
                " (" +
                `${all.filter((i) => i.ci === ci && i.gi === gi && visible(i)).length}` +
                ")</option>",
            )
            .join("") +
          "</optgroup>",
      ).join(""),
    ) +
    '</select></div>\n <div class="picker-cols"><div class="picker-tree"><butt' +
    'on class="tree-g" data-language-all>All checklists <span class="n">' +
    `${all.filter(visible).length}` +
    "</span></button>" +
    `${tree}` +
    '</div><div class="picker-list"><div class="pane-h" role="status">' +
    `${R.esc(label)}` +
    " · " +
    `${items.length}` +
    " matching entries</div>\n " +
    "".concat(
      items
        .map((i) => {
          const key = R.catalogKey(i),
            added = selected.has(key),
            working = current?.items.find((it) => R.itemLibraryKey(it) === key) || current?.selectionCache?.[key],
            e = R.effectiveCatalog(i),
            s = R.catalogStatus(i),
            blocked = ["review", "incomplete", "retired", "superseded", "unknown"].includes(s.code);
          return (
            '<article class="language-pick-row" data-language-key="' +
            `${R.esc(key)}` +
            '"><button class="gitem ' +
            `${added ? "added" : ""}` +
            '" data-pick="' +
            `${i.ci}` +
            ":" +
            `${i.gi}` +
            ":" +
            `${i.o}` +
            '" aria-pressed="' +
            `${added}` +
            '" ' +
            `${blocked && !added ? "disabled" : ""}` +
            '><div class="gitem-main"><h4>' +
            `${R.esc(i.t)}` +
            " " +
            `${added ? '<span class="added-label">Selected · remove from notice</span>' : ""}` +
            '</h4><p class="language-ordinance">' +
            `${R.esc((working?.sections || e.s).join("; ") || "Ordinance needed")}` +
            '</p><p class="language-preview">' +
            `${R.markBlanks(working?.text || e.a)}` +
            '</p><div class="chipbar">' +
            `${languageBadge(R, i)}` +
            "" +
            `${working ? '<span class="tag">Draft item retained</span>' : ""}` +
            "</div></div></button>" +
            `${languageDetails(R, i, working)}` +
            "</article>"
          );
        })
        .join("") ||
        '<div class="empty"><h3>' +
          `${filter === "approved" ? "No approved language matches" : "No matching language"}` +
          "</h3><p>Try another term or status. Proposed wording is not approved by " +
          "selecting or editing it.</p>" +
          "".concat(filter === "approved" ? '<button class="btn" data-language-standard>Include standard language</button>' : "") +
          "</div>",
    ) +
    '\n </div></div><div class="picker-footer"><label><input type="checkbox" i' +
    'd="keep-adding" ' +
    `${R.state.keepAdding ? "checked" : ""}` +
    '> Keep adding items</label><span data-language-selected role="status">' +
    `${selected.size}` +
    " selected from library · " +
    `${current?.items.length || 0}` +
    " item" +
    `${current?.items.length === 1 ? "" : "s"}` +
    ' on this notice</span><button class="btn" id="btn-savework">Save draft &amp; return to Workspace' +
    '</button><button class="btn btn-primary" data-close="picker' +
    '">Done adding</button></div></div></div>'
  );
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
