/* Screen-only pagination reuse. DOM, document identity and layout must all match; never used for print jobs. */

// Screen decorations added after painting: open-check highlighting (highlightOpenChecks) and the shared accessibility
// pass (role/label/tabindex on editable fields). They change no document content, so the DOM comparison ignores them;
// live text edits, structural changes and every other attribute still invalidate the reused preview.
const DECORATION =
  / (?:data-open-check|data-check-desc|aria-describedby|aria-invalid|aria-label|aria-multiline|role|tabindex|data-editor-extra-copy)="[^"]*"/g;
// The accessibility pass also names tables (a screen-reader caption) and header-cell scope; neither is document content.
const TABLE_DECORATION = /<caption class="sr-only">[^<]*<\/caption>| scope="(?:col|row)"/g;
const decorationFree = (markup) =>
  markup
    .replace(TABLE_DECORATION, "")
    .replace(DECORATION, "")
    .replace(/ class="([^"]*)"/g, (_, names) => {
      const kept = names.split(" ").filter((name) => name && name !== "check-open" && name !== "check-focus");
      return kept.length ? ' class="' + kept.join(" ") + '"' : "";
    });

export function createPreviewRefresh() {
  const previous = new WeakMap(),
    fonts = new WeakMap();
  const fontVersion = (document) => {
    if (!fonts.has(document)) {
      const state = { version: 0 };
      fonts.set(document, state);
      const changed = () => state.version++;
      document.fonts?.addEventListener("loadingdone", changed);
      document.fonts?.addEventListener("loadingerror", changed);
    }
    return fonts.get(document).version;
  };
  const layoutOf = (desk, view) => {
    const style = view.getComputedStyle(desk),
      root = desk.ownerDocument.documentElement;
    return [
      desk.clientWidth,
      view.innerWidth,
      view.devicePixelRatio,
      style.font,
      style.lineHeight,
      style.letterSpacing,
      root.style.cssText,
      root.dataset.theme,
      desk.ownerDocument.fonts?.status,
      fontVersion(desk.ownerDocument),
      root.className,
    ].join("|");
  };
  function refresh(desk, identity, html, paginate) {
    const view = desk.ownerDocument?.defaultView;
    if (!desk.isConnected || !view) {
      desk.innerHTML = html;
      paginate();
      return true;
    }
    const layout = layoutOf(desk, view);
    const old = previous.get(desk);
    if (old?.identity === identity && old.html === html && old.layout === layout && old.dom === decorationFree(desk.innerHTML)) return false;
    previous.delete(desk);
    desk.innerHTML = html;
    paginate();
    previous.set(desk, { identity, html, layout, dom: decorationFree(desk.innerHTML) });
    return true;
  }
  /* A full screen repaint builds a new, unpaginated desk. When the previous desk was painted from the same document,
     identity, HTML and layout, and has not been edited since, put it back instead of paginating again. */
  refresh.adopt = (previousDesk, desk, identity, html) => {
    const old = previousDesk && previous.get(previousDesk),
      view = desk.ownerDocument?.defaultView;
    if (!old || previousDesk === desk || previousDesk.isConnected || !desk.isConnected || !view) return false;
    if (old.identity !== identity || old.html !== html || old.layout !== layoutOf(desk, view)) return false;
    if (old.dom !== decorationFree(previousDesk.innerHTML)) return false;
    desk.replaceWith(previousDesk);
    return true;
  };
  /* After a full repaint that could not reuse the previous desk: paginate the freshly painted desk in place (its live
     editing node and focus stay) and record it, so later refreshes of the same document can reuse it. */
  refresh.paint = (desk, identity, html, paginate) => {
    previous.delete(desk);
    paginate();
    const view = desk.ownerDocument?.defaultView;
    if (desk.isConnected && view) previous.set(desk, { identity, html, layout: layoutOf(desk, view), dom: decorationFree(desk.innerHTML) });
  };
  return refresh;
}
