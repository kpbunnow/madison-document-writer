import { editorState as editor } from "./editor_state.js";
import { catalogState as catalog } from "./catalog_state.js";
/* Scoped UI/peer services are supplied by core; read them only when an action runs. */
export function createLanguageActions(services) {
  async function languageClick(event) {
    const button = event.target.closest?.(
      "[data-language-mode],[data-catalog-open],[data-language-standard],[data-" +
        "language-replacement],[data-language-refresh],[data-language-all]",
    );
    if (!button) return;
    if (button.dataset.languageMode) {
      await services.navigation.leave(() => {
        editor.state.screen = "library";
        editor.state.picker = false;
        editor.state.modal = null;
        editor.state.languageMode = button.dataset.languageMode === "admin" ? "admin" : "browse";
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
      if (!i || editor.state.screen !== "library" || editor.state.languageMode !== "admin") return;
      editor.state.catalogAdminKey = services.catalogKey(i);
      catalog.CATALOG_FORMS[editor.state.catalogAdminKey] = {
        ...services.catalogForm(editor.state.catalogAdminKey, i, services.catalogReview(editor.state.catalogAdminKey)),
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
        editor.state.q = i.t;
        editor.state.pickerStatus = "approved";
        editor.state.cl = -1;
      } else {
        editor.state.libFilter = i.t;
        editor.state.libStatus = "approved";
        editor.state.libCl = -1;
      }
    } else if (button.hasAttribute("data-language-standard")) {
      if (picker) editor.state.pickerStatus = "usable";
      else editor.state.libStatus = "usable";
    } else if (button.hasAttribute("data-language-all")) {
      editor.state.cl = -1;
      editor.state.q = "";
    }
    if (picker) services.refreshOverlay();
    else services.render();
    document.getElementById(picker ? "pk-q" : "lib-filter")?.focus();
  }

  return languageClick;
}
