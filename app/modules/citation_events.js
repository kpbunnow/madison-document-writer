import { workspaceState as workspace } from "./workspace_state.js";
import { editorState as editor } from "./editor_state.js";
/* Citation event ownership. Construction is inert; core registers at the original startup positions. */
import { registerEventOnce } from "./event_registration.js";
import { doc } from "./writer_queries.js";
import { citeAllowed } from "./document_rules.js";
export function createCitationEvents(services) {
  function registerReviewInput(target = document) {
    return registerEventOnce(target, "citation.registerReviewInput", "input", (e) => {
      const el = e.target,
        ds = el.dataset || {};
      if (el.id === "bulk-due") {
        return services.dueDateEvents.editBulkDate(el);
      }
      if (ds.reviewCit) {
        const d = doc(editor.state.docId);
        if (!d || services.isLocked(d)) return;
        const [id, f] = ds.reviewCit.split("|");
        services.editCitation(d, id, f, el.value, "input");
        workspace.DIRTY = true;
        services.scheduleDraftSave();
        services.syncChip();
        services.initialCitations.refresh(d);
      }
    });
  }

  function registerReviewChange(target = document) {
    return registerEventOnce(target, "citation.registerReviewChange", "change", (e) => {
      const ds = e.target.dataset || {};
      if (ds.reviewCit) {
        const d = doc(editor.state.docId);
        if (d && !services.isLocked(d)) {
          const [id, field] = ds.reviewCit.split("|");
          services.editCitation(d, id, field, e.target.value);
          workspace.DIRTY = true;
          services.saveDrafts();
          services.refreshSheet();
          services.initialCitations.refresh(d);
          // R59: a charge that now needs its deposit basis keeps focus on that charge's completion form.
          if ((field === "ord" || field === "ordOther") && d.depositRequests?.[id]) services.depositStep.open(d, id);
        }
        return;
      }
      if (ds.dueSelect) {
        return services.dueDateEvents.changeDueSelection(e, ds);
      }
    });
  }

  const toggleCitation = (d, t) => {
    if (!services.structEditable(d)) return;
    const it = d.items.find((i) => i.id === t.dataset.notecite);
    // A mark that is no longer permitted can still be removed; a new one needs a Citation import.
    if (it && (it.cite || citeAllowed(d))) {
      it.cite = !it.cite;
      if (!it.cite) {
        delete d.depositRequests?.[it.id];
        delete d.cits?.[it.id];
      }
      services.initialCitations.prepare(d);
      workspace.DIRTY = true;
      services.render();
      if (it.cite) services.depositStep.openNext(d);
    }
    return;
  };

  const editCitationInput = (el, d, val) => {
    const parts = String(el.dataset.cit).split("|");
    d.cits = d.cits || {};
    d.cits[parts[0]] = d.cits[parts[0]] || {};
    services.editCitation(d, parts[0], parts[1], val, "input");
    services.syncChip();
    return;
  };
  return { registerReviewInput, registerReviewChange, toggleCitation, editCitationInput };
}
