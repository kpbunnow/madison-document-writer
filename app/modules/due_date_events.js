/* DueDate event ownership. Construction is inert; core registers at the original startup positions. */
import { registerEventOnce } from "./event_registration.js";
import { WriterState } from "./state.js";
export function createDueDateEvents(services) {
  const editBulkDate = (el) => {
    const { target } = services.activeDueTarget();
    if (target) {
      target.dueWork = target.dueWork || {};
      target.dueWork.date = el.value;
      WriterState.DIRTY = true;
      services.scheduleDraftSave();
    }
    return;
  };

  const changeDueSelection = (e, ds) => {
    const { target, visit } = services.activeDueTarget();
    if (!target || (!visit && services.isLocked(target))) return;
    target.dueWork = target.dueWork || {};
    const selected = new Set(target.dueWork.selected || []);
    if (e.target.checked) selected.add(ds.dueSelect);
    else selected.delete(ds.dueSelect);
    target.dueWork.selected = [...selected];
    // Notice rows select in the items table; keep the compact bar's count current without a repaint.
    const count = document.querySelector("[data-due-selected]");
    if (count) count.textContent = services.dueSelectedText(services.dueContext(target, visit), selected);
    WriterState.DIRTY = true;
    services.saveDrafts();
  };

  function registerBulkAssignment(target = document) {
    return registerEventOnce(target, "dueDate.registerBulkAssignment", "click", (e) => {
      const el = e.target.closest("[data-due-all],#btn-bulkdue");
      if (!el) return;
      const { target, visit } = services.activeDueTarget();
      if (!target || (!visit && services.isLocked(target)) || (visit && (!target.draft || target.docId))) return;
      target.dueWork = target.dueWork || {};
      if (el.dataset.dueAll !== undefined) {
        target.dueWork.selected = el.dataset.dueAll === "1" ? services.dueContext(target, visit).map((i) => i.id) : [];
      } else {
        const before = Object.fromEntries(services.dueContext(target, visit).map((i) => [i.id, i.due || ""]));
        // An item that has since been corrected, withdrawn or carried has no checkbox any more; drop it from the
        // selection rather than refusing a choice the inspector can no longer see.
        target.dueWork.selected = (target.dueWork.selected || []).filter((id) => Object.hasOwn(before, id));
        const fault = services.assignDue(target, visit, target.dueWork.date, target.dueWork.selected);
        if (fault) {
          services.toast(fault);
          return;
        }
        const applied = Object.fromEntries(services.dueContext(target, visit).map((i) => [i.id, i.due || ""]));
        services.toastUndo("Due date applied to selected items.", () => {
          const active = services.activeDueTarget();
          const current = services.dueContext(target, visit);
          if (
            active.target !== target ||
            active.visit !== visit ||
            (visit ? !target.draft || target.docId : services.isLocked(target)) ||
            current.length !== Object.keys(before).length ||
            current.some((i) => !Object.hasOwn(before, i.id) || i.due !== applied[i.id])
          ) {
            services.toast("This draft changed. Reopen its dates to make a new adjustment.");
            return;
          }
          for (const [id, due] of Object.entries(before)) {
            if (visit) target.results[id].due = due;
            else target.items.find((x) => x.id === id).due = due;
          }
          WriterState.DIRTY = true;
          services.saveDrafts();
          services.render();
        });
      }
      WriterState.DIRTY = true;
      services.saveDrafts();
      services.render();
    });
  }
  return { editBulkDate, changeDueSelection, registerBulkAssignment };
}
