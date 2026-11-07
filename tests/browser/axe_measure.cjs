/* Evidence capture for axe "needs review" color-contrast items (DW_AXE_DETAIL=1 only; never part of an assertion).
   Axe cannot compute a background when text sits on a gradient, image, overlapping element or a character outside its
   font checks. This measures the painted result instead: the element's own text is made transparent, the pixels under
   the text box are captured from the real page, and the text color (with ancestor opacity) is composited over every
   pixel. Nothing is dismissed here: each item gets a measured ratio and a verdict for a human to read. */
const STYLE = "[data-axe-hide],[data-axe-hide] *{color:transparent!important;-webkit-text-fill-color:transparent!important;text-shadow:none!important}";

module.exports = async function measureContrast(page, nodes) {
  await page.evaluate((css) => {
    if (!document.getElementById("axe-hide-style")) {
      const style = document.createElement("style");
      style.id = "axe-hide-style";
      style.textContent = css;
      document.head.append(style);
    }
  }, STYLE);
  const out = [];
  const seen = new Set();
  for (const node of nodes) {
    const selector = node.target.length === 1 ? node.target[0] : null;
    if (!selector || seen.has(selector)) continue;
    seen.add(selector);
    const info = await page.evaluate((sel) => {
      const el = document.querySelector(sel);
      if (!el) return { skipped: "not found" };
      const cs = getComputedStyle(el);
      const rgba = (s) => (s.match(/[\d.]+/g) || []).map(Number);
      let opacity = 1;
      for (let n = el; n && n.nodeType === 1; n = n.parentElement) opacity *= parseFloat(getComputedStyle(n).opacity);
      const range = document.createRange();
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      let box = null;
      for (let t = walker.nextNode(); t; t = walker.nextNode()) {
        if (!t.nodeValue.trim()) continue;
        const parent = t.parentElement;
        if (parent.closest("[aria-hidden='true'], [hidden]") && !el.closest("[aria-hidden='true']")) continue;
        range.selectNodeContents(t);
        for (const r of range.getClientRects()) {
          if (!r.width || !r.height) continue;
          box = box
            ? { l: Math.min(box.l, r.left), t: Math.min(box.t, r.top), r: Math.max(box.r, r.right), b: Math.max(box.b, r.bottom) }
            : { l: r.left, t: r.top, r: r.right, b: r.bottom };
        }
      }
      if (!box) return { skipped: "no text box" };
      const clip = {
        x: Math.max(0, Math.floor(box.l)),
        y: Math.max(0, Math.floor(box.t)),
        width: Math.ceil(Math.min(box.r, innerWidth)) - Math.max(0, Math.floor(box.l)),
        height: Math.ceil(Math.min(box.b, innerHeight)) - Math.max(0, Math.floor(box.t)),
      };
      if (clip.width < 1 || clip.height < 1) return { skipped: "outside viewport" };
      // Who is painted on top of the text box? Sample its center and corners.
      const cover = new Set();
      for (const [fx, fy] of [[0.5, 0.5], [0.1, 0.2], [0.9, 0.2], [0.1, 0.8], [0.9, 0.8]]) {
        const top = document.elementFromPoint(clip.x + clip.width * fx, clip.y + clip.height * fy);
        if (top && top !== el && !el.contains(top) && !top.contains(el)) cover.add(top.tagName.toLowerCase() + (top.className && typeof top.className === "string" ? "." + top.className.trim().split(/\s+/).join(".") : ""));
      }
      const size = parseFloat(cs.fontSize),
        weight = parseInt(cs.fontWeight, 10) || 400;
      return {
        text: (el.textContent || "").trim().slice(0, 60),
        fg: rgba(cs.color),
        opacity,
        size,
        weight,
        large: size >= 24 || (size >= 18.66 && weight >= 700),
        clip,
        coveredBy: [...cover],
        label: cs.backgroundImage !== "none" ? "gradient/image" : "",
      };
    }, selector);
    if (info.skipped) {
      out.push({ selector, skipped: info.skipped });
      continue;
    }
    await page.evaluate((sel) => document.querySelector(sel).setAttribute("data-axe-hide", ""), selector);
    let png;
    try {
      png = await page.screenshot({ clip: info.clip, animations: "disabled" });
    } finally {
      await page.evaluate((sel) => document.querySelector(sel)?.removeAttribute("data-axe-hide"), selector);
    }
    const stats = await page.evaluate(
      async ({ b64, fg, opacity }) => {
        const bitmap = await createImageBitmap(await (await fetch("data:image/png;base64," + b64)).blob());
        const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        ctx.drawImage(bitmap, 0, 0);
        const data = ctx.getImageData(0, 0, bitmap.width, bitmap.height).data;
        const lum = (r, g, b) => {
          const f = [r, g, b].map((v) => v / 255).map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
          return 0.2126 * f[0] + 0.7152 * f[1] + 0.0722 * f[2];
        };
        const alpha = (fg[3] === undefined ? 1 : fg[3]) * opacity;
        const ratios = [];
        const modes = new Map();
        for (let i = 0; i < data.length; i += 4) {
          const bg = [data[i], data[i + 1], data[i + 2]];
          const mix = [0, 1, 2].map((k) => fg[k] * alpha + bg[k] * (1 - alpha));
          const a = lum(...mix) + 0.05,
            b = lum(...bg) + 0.05;
          ratios.push(Math.max(a, b) / Math.min(a, b));
          const key = bg.join(",");
          modes.set(key, (modes.get(key) || 0) + 1);
        }
        ratios.sort((x, y) => x - y);
        const mode = [...modes.entries()].sort((x, y) => y[1] - x[1])[0][0];
        return { min: ratios[0], p5: ratios[Math.floor(ratios.length * 0.05)], median: ratios[Math.floor(ratios.length / 2)], mode, pixels: ratios.length };
      },
      { b64: png.toString("base64"), fg: info.fg, opacity: info.opacity },
    );
    const need = info.large ? 3 : 4.5;
    const verdict = stats.min >= need ? "pass" : stats.p5 >= need ? "edge-pixels-only" : "below-minimum";
    out.push({ selector, text: info.text, size: info.size, weight: info.weight, large: info.large, need, fg: info.fg, opacity: info.opacity, coveredBy: info.coveredBy, ...stats, verdict });
  }
  return out;
};
