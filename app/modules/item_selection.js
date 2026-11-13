/* Library item selection retains private wording/cache and supplied snow/identity operations. */
import { clone } from "./record_values.js";
import { itemLibraryKey, libraryKey } from "./document_rules.js";
import { LIBRARY } from "./data/library.js";
import { noteLanguageUsed } from "./language_shortcuts.js";
/* A new item starts under the previous item's location heading and with its due date (owner direction 2026-11-13):
   consecutive items usually share both. Each stays an ordinary editable value; the first item still starts blank, and
   a restored item keeps its own edits. */
function followPrevious(item, items) {
  const previous = items[items.length - 1];
  return previous ? Object.assign(item, { group: previous.group || "", due: previous.due || "" }) : item;
}

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
      d.items.push(followPrevious(newItem(src, lib, key), d.items));
      noteLanguageUsed(key);
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
    d.items.push(restored || followPrevious(newItem(src, lib, key), d.items));
    services.snow.added(d, d.items[d.items.length - 1]);
    noteLanguageUsed(key);
    return true;
  }
  return { toggleLibraryItem };
}
