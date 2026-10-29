/* SpecialDocument event ownership. Construction is inert; core registers at the original startup positions. */
import { registerEventOnce } from "./event_registration.js";
export function createSpecialDocumentEvents(services) {
  function registerActionClicks(target = document) {
    return registerEventOnce(target, "specialDocument.registerActionClicks", "click", (e) => services.newDocuments.clickEvent(e));
  }

  function registerActionInput(target = document) {
    return registerEventOnce(target, "specialDocument.registerActionInput", "input", (e) => {
      if (e.target.matches("[data-special],[data-special-due],[data-service-field]")) services.newDocuments.editEvent(e);
    });
  }

  function registerActionChange(target = document) {
    return registerEventOnce(target, "specialDocument.registerActionChange", "change", (e) => {
      if (
        e.target.matches(
          '[data-case-action-group],[data-case-action-type],[data-service-field],[data-action-group],[data-action-type],[data-special],[data-special-item],[data-special-due],[data-administrative-type],[data-special="administrativeType"]',
        )
      )
        services.newDocuments.editEvent(e);
    });
  }
  return { registerActionClicks, registerActionInput, registerActionChange };
}
