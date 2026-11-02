/* Import inspection: events for the open-case list. Construction is inert; core registers them. */
import { registerEventOnce } from "./event_registration.js";

export function createOpenCaseEvents(services) {
  const list = () => services.openCaseList;

  function registerOpenCaseSubmit(target = document) {
    return registerEventOnce(target, "openCases.registerSubmit", "submit", (e) => {
      if (e.target.id !== "open-cases-form") return;
      e.preventDefault();
      list().showCases(e.target.querySelector("#open-cases-inspector").value);
    });
  }

  function registerOpenCaseInputs(target = document) {
    registerEventOnce(target, "openCases.registerChange", "change", (e) => {
      if (e.target.id === "open-cases-inspector") list().select(e.target.value);
    });
    return registerEventOnce(target, "openCases.registerSearch", "input", (e) => {
      if (e.target.id === "open-cases-search") list().search(e.target.value);
    });
  }

  function registerOpenCaseClicks(target = document) {
    return registerEventOnce(target, "openCases.registerClicks", "click", (e) => {
      const button = e.target.closest?.("button");
      if (!button) return;
      if (button.dataset.openCasePick) list().pick(button.dataset.openCasePick);
      else if (button.id === "open-cases-refresh") list().refresh();
      else if (button.id === "open-cases-retry") list().retry();
    });
  }

  return { registerOpenCaseSubmit, registerOpenCaseInputs, registerOpenCaseClicks };
}
