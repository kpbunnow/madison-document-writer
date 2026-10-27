import { catalogState as catalog } from "./catalog_state.js";
import { libraryKey } from "./document_rules.js";
import { LIBRARY } from "./data/library.js";

export function catalogKey(i) {
  return libraryKey({ c: LIBRARY[i.ci].code, g: LIBRARY[i.ci].groups[i.gi].code, o: i.o });
}

export function createCatalogForms(services) {
  function keepCatalogForms() {
    try {
      services.localStorage.setItem("madison-catalog-forms-v1", JSON.stringify(catalog.CATALOG_FORMS));
    } catch (e) {
      catalog.CATALOG_ERROR = "Review form could not be stored on this device.";
    }
  }

  return { keepCatalogForms };
}
