/* Scoped UI/peer services are supplied by core; read them only when an action runs. */
import { WriterState } from "./state.js";
export function createLanguageActions(services) {
  async function languageClick(event) {
    const button = event.target.closest?.(
      "[data-language-mode],[data-catalog-open],[data-language-standard],[data-" +
        "language-replacement],[data-language-refresh],[data-language-all]",
    );
    if (!button) return;
    if (button.dataset.languageMode) {
      await services.navigation.leave(() => {
        WriterState.state.screen = "library";
        WriterState.state.picker = false;
        WriterState.state.modal = null;
        WriterState.state.languageMode = button.dataset.languageMode === "admin" ? "admin" : "browse";
        services.render();
        window.scrollTo(0, 0);
        const h = document.querySelector(".main h1");
        if (h) {
          h.tabIndex = -1;
          h.focus({ preventScroll: true });
        }
      });
      return;
    }
    if (button.dataset.catalogOpen) {
      const i = services.catalogItem(button.dataset.catalogOpen);
      if (!i || WriterState.state.screen !== "library" || WriterState.state.languageMode !== "admin") return;
      WriterState.state.catalogAdminKey = services.catalogKey(i);
      WriterState.CATALOG_FORMS[WriterState.state.catalogAdminKey] = {
        ...services.catalogForm(WriterState.state.catalogAdminKey, i, services.catalogReview(WriterState.state.catalogAdminKey)),
        open: true,
      };
      services.keepCatalogForms();
      services.render();
      document.getElementById("catalog-entry-title")?.focus();
      return;
    }
    if (button.hasAttribute("data-language-refresh")) {
      if (button.getAttribute("aria-disabled") === "true") return;
      button.setAttribute("aria-disabled", "true");
      button.textContent = "Refreshing review status…";
      await services.refreshCatalog();
      if (button.isConnected) {
        button.removeAttribute("aria-disabled");
        button.textContent = "Refresh review status";
      }
      return;
    }
    const picker = !!button.closest(".picker-box");
    if (button.dataset.languageReplacement) {
      const i = services.catalogItem(button.dataset.languageReplacement);
      if (!i) return;
      if (picker) {
        WriterState.state.q = i.t;
        WriterState.state.pickerStatus = "approved";
        WriterState.state.cl = -1;
      } else {
        WriterState.state.libFilter = i.t;
        WriterState.state.libStatus = "approved";
        WriterState.state.libCl = -1;
      }
    } else if (button.hasAttribute("data-language-standard")) {
      if (picker) WriterState.state.pickerStatus = "usable";
      else WriterState.state.libStatus = "usable";
    } else if (button.hasAttribute("data-language-all")) {
      WriterState.state.cl = -1;
      WriterState.state.q = "";
    }
    if (picker) services.refreshOverlay();
    else services.render();
    document.getElementById(picker ? "pk-q" : "lib-filter")?.focus();
  }

  return languageClick;
}
