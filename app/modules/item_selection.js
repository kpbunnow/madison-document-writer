/* Library item selection retains private wording/cache and supplied snow/identity operations. */
import { clone } from "./record_values.js";
import { itemLibraryKey, libraryKey } from "./document_rules.js";
import { LIBRARY } from "./data/library.js";
export function createItemSelection(services) {
  function toggleLibraryItem(d, ci, gi, src) {
    const lib = { c: LIBRARY[ci].code, g: LIBRARY[ci].groups[gi].code, o: src.o },
      key = libraryKey(lib);
    d.selectionCache = d.selectionCache || {};
    const found = d.items.find((i) => itemLibraryKey(i) === key);
    if (found) {
      d.selectionCache[key] = clone(found);
      d.items = d.items.filter((i) => itemLibraryKey(i) !== key);
      services.snow.removed(d);
      return false;
    }
    if (!services.snow.canAdd(d, key)) return false;
    const restored = d.selectionCache[key];
    delete d.selectionCache[key];
    d.items.push(
      restored || {
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
      },
    );
    services.snow.added(d, d.items[d.items.length - 1]);
    return true;
  }
  return { toggleLibraryItem };
}
