/* Recently used and favorite order-language entries for the picker (owner direction 2026-11-13). A browser-profile
   convenience only: nothing here reaches a case record, a draft or an issued document, and a storage failure simply
   leaves the lists empty. */
import { editorState as editor } from "./editor_state.js";

const KEY = "madison-language-shortcuts-v1",
  RECENT_LIMIT = 12,
  FAVORITE_LIMIT = 60;
let lists = null;

function load() {
  if (lists) return lists;
  lists = { recent: [], favorites: [] };
  try {
    const stored = JSON.parse(localStorage.getItem(KEY) || "null");
    for (const name of ["recent", "favorites"])
      if (Array.isArray(stored?.[name])) lists[name] = stored[name].filter((key) => typeof key === "string").slice(0, FAVORITE_LIMIT);
  } catch {
    /* Unreadable or unavailable storage: start with empty lists. */
  }
  return lists;
}

function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(lists));
  } catch {
    /* The lists still work for this session. */
  }
}

export const shortcutKeys = (name) => (name === "recent" || name === "favorites" ? load()[name] : []);
export const isFavorite = (key) => load().favorites.includes(key);

// Newest first, without repeats.
export function noteLanguageUsed(key) {
  if (!key) return;
  load().recent = [key, ...lists.recent.filter((k) => k !== key)].slice(0, RECENT_LIMIT);
  save();
}

export function toggleFavorite(key) {
  const on = !isFavorite(key);
  lists.favorites = on ? [key, ...lists.favorites].slice(0, FAVORITE_LIMIT) : lists.favorites.filter((k) => k !== key);
  save();
  return on;
}

// The list the picker is showing: only while browsing (no search, no category chosen).
export const activeShortcutList = (state) =>
  !String(state.q || "").trim() && state.cl < 0 && shortcutKeys(state.pickerList).length ? state.pickerList : "";

/* Picker clicks for the two lists and the star. The picker is repainted through the supplied refresh. */
export function createLanguageShortcuts(services) {
  document.addEventListener("click", (event) => {
    const t = event.target.closest?.(".picker-box [data-language-list],.picker-box [data-language-favorite]");
    if (!t || !editor.state.picker) return;
    let focus = "";
    if (t.dataset.languageFavorite) {
      toggleFavorite(t.dataset.languageFavorite);
      focus = '[data-language-favorite="' + CSS.escape(t.dataset.languageFavorite) + '"]';
    } else if (t.dataset.languageList) {
      Object.assign(editor.state, { pickerList: t.dataset.languageList, q: "", cl: -1 });
      focus = '[data-language-list="' + t.dataset.languageList + '"]';
    }
    services.refreshOverlay();
    if (focus) document.querySelector(".picker-box " + focus)?.focus();
  });
}
