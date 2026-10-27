import { languageScreen, languagePicker } from "./language_discovery.js";

export function createLanguageViews(services) {
  function screenLibrary() {
    return languageScreen(services.app_languagediscoveryContext());
  }

  function pickerHTML() {
    return languagePicker(services.app_languagediscoveryContext());
  }
  return { screenLibrary, pickerHTML };
}
