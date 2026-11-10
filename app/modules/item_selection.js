/* Library item selection retains private wording/cache and supplied snow/identity operations. */
import { clone } from "./record_values.js";
import { itemLibraryKey, libraryKey } from "./document_rules.js";
import { LIBRARY } from "./data/library.js";
export function createItemSelection(services) {
  function newItem(src, lib, key) {
    return {
      id: services.uid("x"),
      group: "",
      sections: [...src.s],
      title: src.t,
      abate: false,
      due: "",
      text: src.a,
      prov: src.p || "export",
      lib,
      libraryKey: key,
      catalogVersion: src.catalogVersion || 0,
      catalogReviewId: src.catalogReviewId || "",
    };
  }
  /* Picking an entry adds it, or removes it when it is on the draft once (keeping its edits in the selection cache).
     With `again` another copy with the stock language is added (owner direction 2026-11-10). An entry on the draft more
     than once is not toggled off here (null): each copy is removed from Violation Items, so the right one goes. */
  function toggleLibraryItem(d, ci, gi, src, again = false) {
    const lib = { c: LIBRARY[ci].code, g: LIBRARY[ci].groups[gi].code, o: src.o },
      key = libraryKey(lib);
    d.selectionCache = d.selectionCache || {};
    const copies = d.items.filter((i) => itemLibraryKey(i) === key);
    if (again) {
      if (!copies.length || !services.snow.canAdd(d, key)) return false;
      d.items.push(newItem(src, lib, key));
      return true;
    }
    if (copies.length > 1) return null;
    const found = copies[0];
    if (found) {
      d.selectionCache[key] = clone(found);
      d.items = d.items.filter((i) => itemLibraryKey(i) !== key);
      services.snow.removed(d);
      return false;
    }
    if (!services.snow.canAdd(d, key)) return false;
    const restored = d.selectionCache[key];
    delete d.selectionCache[key];
    d.items.push(restored || newItem(src, lib, key));
    services.snow.added(d, d.items[d.items.length - 1]);
    return true;
  }
  return { toggleLibraryItem };
}
