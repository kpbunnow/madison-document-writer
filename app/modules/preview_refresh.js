/* Screen-only pagination reuse. DOM, document identity and layout must all match; never used for print jobs. */
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
  return (desk, identity, html, paginate) => {
    const view = desk.ownerDocument?.defaultView;
    if (!desk.isConnected || !view) {
      desk.innerHTML = html;
      paginate();
      return true;
    }
    const style = view.getComputedStyle(desk),
      root = desk.ownerDocument.documentElement;
    const layout = [
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
    const old = previous.get(desk);
    if (old?.identity === identity && old.html === html && old.layout === layout && old.dom === desk.innerHTML) return false;
    previous.delete(desk);
    desk.innerHTML = html;
    paginate();
    previous.set(desk, { identity, html, layout, dom: desk.innerHTML });
    return true;
  };
}
