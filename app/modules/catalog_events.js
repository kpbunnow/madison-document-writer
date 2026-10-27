import { catalogState as catalog } from "./catalog_state.js";
/* Catalog event ownership. Construction is inert; core registers at the original startup positions. */
import { registerEventOnce } from "./event_registration.js";
import { WriterState } from "./state.js";
import { nowISO } from "./calendar.js";
import { doc } from "./writer_queries.js";
import { LIBRARY } from "./data/library.js";
import { itemLibraryKey } from "./document_rules.js";
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
        const key = rebase.dataset.catalogRebase,
          r = services.catalogReview(key),
          form = catalog.CATALOG_FORMS[key];
        if (!r || !form) return;
        if (
          confirm(
            "Use reviewed v" +
              r.version +
              " as the basis for this new review? Your unsubmitted values are kept. Compare both versions before recording.",
          )
        ) {
          form.baseVersion = r.version;
          form.error = "Review basis updated to v" + r.version + ". Confirm your entered wording and ordinance before recording.";
          services.keepCatalogForms();
          services.render();
        }
        return;
      }
      const t = e.target.closest?.("[data-catalog-save]");
      if (!t) return;
      const key = t.dataset.catalogSave,
        i = services.catalogItem(key);
      if (!i) return;
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
      const fields = ["reviewer", "wording", "ordinances", "source", "replaces"],
        submitted = Object.fromEntries(fields.map((n) => [n, field(n)]));
      const fail = (message) => {
        catalog.CATALOG_FORMS[key] = { ...form, ...submitted, ...catalog.CATALOG_FORMS[key], open: true, error: message };
        services.keepCatalogForms();
        if (WriterState.state.screen === "library") services.render();
        else services.toast(message, { severity: "warning" });
      };
      if (!data.reviewer) {
        fail("Reviewer is required.");
        return;
      }
      if (!data.source) {
        fail("Source or authority is required.");
        return;
      }
      if (status === "approved" && (!data.wording || !data.ordinances.length)) {
        fail("Approved wording and ordinance references are required.");
        return;
      }
      if (data.replaces && (!services.catalogItem(data.replaces) || data.replaces === key)) {
        fail("Choose a different catalog entry.");
        return;
      }
      if (!confirm("Record " + status + " review for " + i.t + " by " + data.reviewer + "? This adds a permanent catalog version.")) return;
      t.disabled = true;
      try {
        const response = await services.helperJSON("/catalog/review", data);
        const known = new Set(catalog.CATALOG_EVENTS.map((event) => event.id)),
          incoming = new Set(response.events.map((event) => event.id));
        if (!(catalog.CATALOG_EVENTS.some((event) => !incoming.has(event.id)) && response.events.every((event) => known.has(event.id))))
          catalog.CATALOG_EVENTS = response.events;
        catalog.CATALOG_VERIFIED = true;
        catalog.CATALOG_FROM_CACHE = false;
        catalog.CATALOG_AT = nowISO();
        catalog.CATALOG_ERROR = "";
        try {
          localStorage.setItem("madison-catalog-events-v1", JSON.stringify({ at: catalog.CATALOG_AT, events: catalog.CATALOG_EVENTS }));
        } catch (error) {
          catalog.CATALOG_ERROR = "Review recorded on the share, but this browser could not cache it.";
        }
        const later = catalog.CATALOG_FORMS[key],
          changed = later && fields.some((n) => String(later[n] || "").trim() !== submitted[n]);
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
        if (WriterState.state.screen === "library") services.render();
        services.toast("Catalog review v" + response.event.version + " recorded. Existing drafts were not changed.");
      } catch (err) {
        t.disabled = false;
        fail("Review save was not confirmed: " + err.message + ". Your form is retained. Refresh review status before retrying.");
      }
    });
  }

  const closePickerBackground = () => {
    WriterState.state.picker = false;
    services.render();
    return;
  };

  const closePicker = () => {
    WriterState.state.picker = false;
    services.render();
    window.scrollTo(0, 0);
    return;
  };

  const selectChecklist = (t) => {
    WriterState.state.libCl = +t.dataset.libcl;
    services.render();
    return;
  };

  const selectGroup = (t) => {
    const [ci, gi] = t.dataset.grp.split(":").map(Number);
    WriterState.state.cl = ci;
    WriterState.state.grp = gi;
    WriterState.state.q = "";
    services.refreshOverlay();
    return;
  };

  const adoptReview = (d, t) => {
    const it = d?.items.find((x) => x.id === t.dataset.adoptCatalog);
    if (services.adoptCatalogReview(d, it)) services.toast("Reviewed catalog version applied to this draft item.");
    return;
  };

  const pickItem = async (d, t) => {
    if (!d || !services.structEditable(d)) return;
    const selectionContext = { docId: WriterState.state.docId, screen: WriterState.state.screen };
    await services.refreshCatalog();
    if (
      !WriterState.state.picker ||
      WriterState.state.screen !== selectionContext.screen ||
      WriterState.state.docId !== selectionContext.docId ||
      doc(WriterState.state.docId) !== d ||
      !services.structEditable(d)
    )
      return;
    const [ci, gi, o] = t.dataset.pick.split(":").map(Number);
    const raw = LIBRARY[ci]?.groups[gi]?.items.find((x) => x.o === o);
    if (!raw) return;
    const indexed = { ...raw, ci, gi },
      status = services.catalogStatus(indexed);
    if (
      ["review", "incomplete", "retired", "superseded", "unknown"].includes(status.code) &&
      !d.items.some((it) => itemLibraryKey(it) === services.catalogKey(indexed))
    ) {
      services.toast(status.label + "; division review is needed.");
      return;
    }
    const src = services.catalogSelection(indexed);
    if (
      !d.items.some((i) => itemLibraryKey(i) === JSON.stringify([LIBRARY[ci].code, LIBRARY[ci].groups[gi].code, src.o])) &&
      !services.snow.canAdd(d, JSON.stringify([LIBRARY[ci].code, LIBRARY[ci].groups[gi].code, src.o]))
    )
      return;
    const added = services.toggleLibraryItem(d, ci, gi, src);
    services.renumber(d);
    WriterState.DIRTY = true;
    services.saveDrafts();
    if (WriterState.state.keepAdding || !added) {
      services.refreshOverlay();
      services.toast((added ? "Added: " : "Removed: ") + src.t);
      return;
    }
    WriterState.state.picker = false;
    services.render();
    // drop the cursor straight into the new corrective action
    const cells = document.querySelectorAll('[data-field="text"]');
    const last = cells[cells.length - 1];
    if (last) {
      last.focus();
      const r = document.createRange();
      r.selectNodeContents(last);
      r.collapse(true);
      const s = getSelection();
      s.removeAllRanges();
      s.addRange(r);
      last.scrollIntoView({ block: "center" });
    }
    services.toast("Added: " + src.t);
    return;
  };

  const openPicker = (d) => {
    if (!services.structEditable(d)) return;
    if (WriterState.state.pickerDoc !== d.id) {
      WriterState.state.pickerStatus = "approved";
      WriterState.state.cl = -1;
      WriterState.state.grp = 0;
      WriterState.state.pickerDoc = d.id;
    }
    WriterState.state.picker = true;
    WriterState.state.q = "";
    services.render();
    return;
  };

  const editPickerSearch = (el) => {
    WriterState.state.q = el.value;
    services.refreshOverlay();
    return;
  };

  const editLibrarySearch = (el) => {
    const p = el.selectionStart;
    WriterState.state.libFilter = el.value;
    services.render();
    const f = document.getElementById("lib-filter");
    if (f) {
      f.focus();
      f.setSelectionRange(p, p);
    }
    return;
  };

  const changeLibraryStatus = (e) => {
    WriterState.state[e.target.id === "lib-status" ? "libStatus" : "pickerStatus"] = e.target.value;
    if (e.target.id === "lib-status") services.render();
    else services.refreshOverlay();
    return;
  };

  const changeKeepAdding = (e) => {
    WriterState.state.keepAdding = e.target.checked;
    return;
  };

  const changePickerGroup = (e) => {
    const [ci, gi] = e.target.value.split(":").map(Number);
    WriterState.state.cl = ci;
    WriterState.state.grp = gi;
    WriterState.state.q = "";
    services.refreshOverlay();
    return;
  };

  function registerLanguageActions(target = document) {
    return registerEventOnce(target, "catalog.registerLanguageActions", "click", (e) => services.languageClick(e));
  }

  function registerFilterInput(target = document) {
    return registerEventOnce(target, "catalog.registerFilterInput", "input", (e) => {
      if (e.target.id === "catalog-filter") {
        WriterState.state.catalogAdminQ = e.target.value;
        services.render();
      }
    });
  }

  function registerFilterChange(target = document) {
    return registerEventOnce(target, "catalog.registerFilterChange", "change", (e) => {
      if (e.target.id === "catalog-status") {
        WriterState.state.catalogAdminStatus = e.target.value;
        services.render();
        document.getElementById("catalog-status")?.focus();
      }
      if (e.target.id === "lib-checklist") {
        WriterState.state.libCl = Number(e.target.value);
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
