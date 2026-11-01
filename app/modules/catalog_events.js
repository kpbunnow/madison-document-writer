import { workspaceState as workspace } from "./workspace_state.js";
import { editorState as editor } from "./editor_state.js";
import { catalogState as catalog } from "./catalog_state.js";
/* Catalog event ownership. Construction is inert; core registers at the original startup positions. */
import { registerEventOnce } from "./event_registration.js";
import { nowISO } from "./calendar.js";
import { doc } from "./writer_queries.js";
import { LIBRARY } from "./data/library.js";
import { itemLibraryKey } from "./document_rules.js";
const REVIEW_FIELDS = ["reviewer", "wording", "ordinances", "source", "replaces"];

function rebaseReviewBasis(services, rebase) {
  const key = rebase.dataset.catalogRebase,
    r = services.catalogReview(key),
    form = catalog.CATALOG_FORMS[key];
  if (!r || !form) return;
  if (
    confirm(
      "Use reviewed v" + r.version + " as the basis for this new review? Your unsubmitted values are kept. Compare both versions before recording.",
    )
  ) {
    form.baseVersion = r.version;
    form.error = "Review basis updated to v" + r.version + ". Confirm your entered wording and ordinance before recording.";
    services.keepCatalogForms();
    services.render();
  }
}

// What the reviewer entered, read once: the record to send and the raw values to keep if it fails.
function readReview(services, t, key, i) {
  const host = t.closest("details"),
    field = (name) => host.querySelector('[data-catalog-field="' + name + '"]')?.value.trim() || "";
  const status = t.dataset.catalogStatus,
    form = catalog.CATALOG_FORMS[key] || services.catalogForm(key, i, services.catalogReview(key));
  const data = {
    key,
    status,
    reviewer: field("reviewer"),
    wording: field("wording"),
    ordinances: field("ordinances")
      .split(";")
      .map((x) => x.trim())
      .filter(Boolean),
    source: field("source"),
    replaces: field("replaces"),
    expectedVersion: form.baseVersion,
  };
  const submitted = Object.fromEntries(REVIEW_FIELDS.map((n) => [n, field(n)]));
  return { key, form, data, submitted };
}

function reviewFault(services, data, key) {
  if (!data.reviewer) return "Reviewer is required.";
  if (!data.source) return "Source or authority is required.";
  if (data.status === "approved" && (!data.wording || !data.ordinances.length)) return "Approved wording and ordinance references are required.";
  if (data.replaces && (!services.catalogItem(data.replaces) || data.replaces === key)) return "Choose a different catalog entry.";
  return "";
}

function failReview(services, review, message) {
  const { key, form, submitted } = review;
  catalog.CATALOG_FORMS[key] = { ...form, ...submitted, ...catalog.CATALOG_FORMS[key], open: true, error: message };
  services.keepCatalogForms();
  if (editor.state.screen === "library") services.render();
  else services.toast(message, { severity: "warning" });
}

function cacheCatalogEvents() {
  try {
    localStorage.setItem("madison-catalog-events-v1", JSON.stringify({ at: catalog.CATALOG_AT, events: catalog.CATALOG_EVENTS }));
  } catch (error) {
    catalog.CATALOG_ERROR = "Review recorded on the share, but this browser could not cache it.";
  }
}

async function recordReview(services, review) {
  const { key, data, submitted } = review;
  const response = await services.helperJSON("/catalog/review", data);
  const known = new Set(catalog.CATALOG_EVENTS.map((event) => event.id)),
    incoming = new Set(response.events.map((event) => event.id));
  if (!(catalog.CATALOG_EVENTS.some((event) => !incoming.has(event.id)) && response.events.every((event) => known.has(event.id))))
    catalog.CATALOG_EVENTS = response.events;
  catalog.CATALOG_VERIFIED = true;
  catalog.CATALOG_FROM_CACHE = false;
  catalog.CATALOG_AT = nowISO();
  catalog.CATALOG_ERROR = "";
  cacheCatalogEvents();
  const later = catalog.CATALOG_FORMS[key],
    changed = later && REVIEW_FIELDS.some((n) => String(later[n] || "").trim() !== submitted[n]);
  if (changed)
    catalog.CATALOG_FORMS[key] = {
      ...later,
      open: true,
      error:
        "Review v" +
        response.event.version +
        " was recorded. Your later edits are retained; compare and update the review basis before recording again.",
    };
  else delete catalog.CATALOG_FORMS[key];
  services.keepCatalogForms();
  if (editor.state.screen === "library") services.render();
  services.toast("Catalog review v" + response.event.version + " recorded. Existing drafts were not changed.");
}

/* ---------- picking order language onto a notice ----------
   An unissued notice, or a new draft whose picked snow item can still be undone (the snow item turns the draft into a
   snow citation; picking it again restores the notice). */
const pickable = (services, d) => services.structEditable(d) || services.snow.pickedDraft(d);
const BLOCKED_STATUS = ["review", "incomplete", "retired", "superseded", "unknown"];

function pickStillCurrent(services, d, context) {
  return (
    editor.state.picker &&
    editor.state.screen === context.screen &&
    editor.state.docId === context.docId &&
    doc(editor.state.docId) === d &&
    pickable(services, d)
  );
}

/* The library entry the button names, or null when it cannot be picked now (with the reason shown). */
function pickSource(services, d, t) {
  const [ci, gi, o] = t.dataset.pick.split(":").map(Number);
  const raw = LIBRARY[ci]?.groups[gi]?.items.find((x) => x.o === o);
  if (!raw) return null;
  const indexed = { ...raw, ci, gi },
    status = services.catalogStatus(indexed);
  if (BLOCKED_STATUS.includes(status.code) && !d.items.some((it) => itemLibraryKey(it) === services.catalogKey(indexed))) {
    services.toast(status.label + "; division review is needed.");
    return null;
  }
  const src = services.catalogSelection(indexed),
    key = JSON.stringify([LIBRARY[ci].code, LIBRARY[ci].groups[gi].code, src.o]);
  if (!d.items.some((i) => itemLibraryKey(i) === key) && !services.snow.canAdd(d, key)) return null;
  return { ci, gi, src };
}

function focusNewItem() {
  // drop the cursor straight into the new corrective action
  const cells = document.querySelectorAll('[data-field="text"]');
  const last = cells[cells.length - 1];
  if (!last) return;
  last.focus();
  const r = document.createRange();
  r.selectNodeContents(last);
  r.collapse(true);
  const s = getSelection();
  s.removeAllRanges();
  s.addRange(r);
  last.scrollIntoView({ block: "center" });
}

function afterPick(services, d, src, added) {
  if (added && services.snow.pickedDraft(d)) {
    // The picker stays open so the change of workflow can be undone right away.
    services.refreshOverlay();
    services.toast("Changed to a snow removal citation (MGO 10.28). To undo, pick the snow item again.");
    return;
  }
  if (editor.state.keepAdding || !added) {
    services.refreshOverlay();
    services.toast((added ? "Added: " : "Removed: ") + src.t);
    return;
  }
  editor.state.picker = false;
  services.render();
  focusNewItem();
  services.toast("Added: " + src.t);
}

async function pickLibraryItem(services, d, t) {
  if (!d || !pickable(services, d)) {
    if (d) services.toast("Order language can be added only to an Official Notice draft that has not been issued.");
    return;
  }
  const context = { docId: editor.state.docId, screen: editor.state.screen };
  await services.refreshCatalog();
  if (!pickStillCurrent(services, d, context)) return;
  const picked = pickSource(services, d, t);
  if (!picked) return;
  const added = services.toggleLibraryItem(d, picked.ci, picked.gi, picked.src);
  services.renumber(d);
  workspace.DIRTY = true;
  services.saveDrafts();
  afterPick(services, d, picked.src, added);
}

export function createCatalogEvents(services) {
  function registerGuidanceToggle(target = document) {
    return registerEventOnce(
      target,
      "catalog.registerGuidanceToggle",
      "toggle",
      (e) => {
        const details = e.target.closest?.(".lib-guidance");
        if (!details) return;
        const key = details.querySelector("[data-catalog-key]")?.dataset.catalogKey;
        if (!key) return;
        catalog.CATALOG_FORMS[key] = { ...services.catalogForm(key, services.catalogItem(key), services.catalogReview(key)), open: details.open };
        services.keepCatalogForms();
        if (details.open) {
          const selector = details.querySelector('[data-catalog-field="replaces"]');
          if (selector)
            selector.innerHTML = services.catalogReplacementOptions(
              key,
              catalog.CATALOG_FORMS[key].replaces,
              catalog.CATALOG_FORMS[key].replacementQuery,
            );
        }
      },
      true,
    );
  }

  function registerReviewInput(target = document) {
    return registerEventOnce(target, "catalog.registerReviewInput", "input", (e) => {
      const el = e.target.closest?.("[data-catalog-field]");
      if (!el) return;
      const key = el.dataset.catalogKey;
      catalog.CATALOG_FORMS[key] = {
        ...services.catalogForm(key, services.catalogItem(key), services.catalogReview(key)),
        ...catalog.CATALOG_FORMS[key],
        [el.dataset.catalogField]: el.value,
        open: true,
      };
      services.keepCatalogForms();
    });
  }

  function registerReplacementQuery(target = document) {
    return registerEventOnce(target, "catalog.registerReplacementQuery", "input", (e) => {
      const el = e.target.closest?.("[data-catalog-replacement-query]");
      if (!el) return;
      const key = el.dataset.catalogReplacementQuery;
      catalog.CATALOG_FORMS[key] = {
        ...services.catalogForm(key, services.catalogItem(key), services.catalogReview(key)),
        ...catalog.CATALOG_FORMS[key],
        replacementQuery: el.value,
        open: true,
      };
      services.keepCatalogForms();
      const selector = el.closest("details")?.querySelector('[data-catalog-field="replaces"]');
      if (selector) selector.innerHTML = services.catalogReplacementOptions(key, catalog.CATALOG_FORMS[key].replaces, el.value);
    });
  }

  function registerReviewChange(target = document) {
    return registerEventOnce(target, "catalog.registerReviewChange", "change", (e) => {
      if (e.target.matches?.("[data-catalog-field]")) e.target.dispatchEvent(new Event("input", { bubbles: true }));
    });
  }

  function registerReviewActions(target = document) {
    return registerEventOnce(target, "catalog.registerReviewActions", "click", async (e) => {
      const rebase = e.target.closest?.("[data-catalog-rebase]");
      if (rebase) {
        rebaseReviewBasis(services, rebase);
        return;
      }
      const t = e.target.closest?.("[data-catalog-save]");
      if (!t) return;
      const key = t.dataset.catalogSave,
        i = services.catalogItem(key);
      if (!i) return;
      const review = readReview(services, t, key, i);
      const message = reviewFault(services, review.data, key);
      if (message) {
        failReview(services, review, message);
        return;
      }
      if (
        !confirm("Record " + review.data.status + " review for " + i.t + " by " + review.data.reviewer + "? This adds a permanent catalog version.")
      )
        return;
      t.disabled = true;
      try {
        await recordReview(services, review);
      } catch (err) {
        t.disabled = false;
        failReview(
          services,
          review,
          "Review save was not confirmed: " + err.message + ". Your form is retained. Refresh review status before retrying.",
        );
      }
    });
  }

  const closePickerBackground = () => {
    editor.state.picker = false;
    services.render();
    return;
  };

  const closePicker = () => {
    editor.state.picker = false;
    services.render();
    window.scrollTo(0, 0);
    return;
  };

  const selectChecklist = (t) => {
    editor.state.libCl = +t.dataset.libcl;
    services.render();
    return;
  };

  const selectGroup = (t) => {
    const [ci, gi] = t.dataset.grp.split(":").map(Number);
    editor.state.cl = ci;
    editor.state.grp = gi;
    editor.state.q = "";
    services.refreshOverlay();
    return;
  };

  const adoptReview = (d, t) => {
    const it = d?.items.find((x) => x.id === t.dataset.adoptCatalog);
    if (services.adoptCatalogReview(d, it)) services.toast("Reviewed catalog version applied to this draft item.");
    return;
  };

  const pickItem = (d, t) => pickLibraryItem(services, d, t);

  const openPicker = (d) => {
    if (!services.structEditable(d)) return;
    if (editor.state.pickerDoc !== d.id) {
      editor.state.pickerStatus = "usable";
      editor.state.cl = -1;
      editor.state.grp = 0;
      editor.state.pickerDoc = d.id;
    }
    editor.state.picker = true;
    editor.state.q = "";
    services.render();
    return;
  };

  const editPickerSearch = (el) => {
    editor.state.q = el.value;
    services.refreshOverlay();
    return;
  };

  const editLibrarySearch = (el) => {
    const p = el.selectionStart;
    editor.state.libFilter = el.value;
    services.render();
    const f = document.getElementById("lib-filter");
    if (f) {
      f.focus();
      f.setSelectionRange(p, p);
    }
    return;
  };

  const changeLibraryStatus = (e) => {
    editor.state[e.target.id === "lib-status" ? "libStatus" : "pickerStatus"] = e.target.value;
    if (e.target.id === "lib-status") services.render();
    else services.refreshOverlay();
    return;
  };

  const changeKeepAdding = (e) => {
    editor.state.keepAdding = e.target.checked;
    return;
  };

  const changePickerGroup = (e) => {
    const [ci, gi] = e.target.value.split(":").map(Number);
    editor.state.cl = ci;
    editor.state.grp = gi;
    editor.state.q = "";
    services.refreshOverlay();
    return;
  };

  function registerLanguageActions(target = document) {
    return registerEventOnce(target, "catalog.registerLanguageActions", "click", (e) => services.languageClick(e));
  }

  function registerFilterInput(target = document) {
    return registerEventOnce(target, "catalog.registerFilterInput", "input", (e) => {
      if (e.target.id === "catalog-filter") {
        editor.state.catalogAdminQ = e.target.value;
        services.render();
      }
    });
  }

  function registerFilterChange(target = document) {
    return registerEventOnce(target, "catalog.registerFilterChange", "change", (e) => {
      if (e.target.id === "catalog-status") {
        editor.state.catalogAdminStatus = e.target.value;
        services.render();
        document.getElementById("catalog-status")?.focus();
      }
      if (e.target.id === "lib-checklist") {
        editor.state.libCl = Number(e.target.value);
        services.render();
        document.getElementById("lib-checklist")?.focus();
      }
    });
  }
  return {
    registerGuidanceToggle,
    registerReviewInput,
    registerReplacementQuery,
    registerReviewChange,
    registerReviewActions,
    closePickerBackground,
    closePicker,
    selectChecklist,
    selectGroup,
    adoptReview,
    pickItem,
    openPicker,
    editPickerSearch,
    editLibrarySearch,
    changeLibraryStatus,
    changeKeepAdding,
    changePickerGroup,
    registerLanguageActions,
    registerFilterInput,
    registerFilterChange,
  };
}
