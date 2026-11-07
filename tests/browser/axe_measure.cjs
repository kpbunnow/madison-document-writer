/* Evidence capture for axe "needs review" color-contrast items (DW_AXE_DETAIL=1 only; never part of an assertion).
   Axe cannot compute a background when text sits on a gradient, image, overlapping element or a character outside its
   font checks. This measures the painted result instead: the element's own text is made transparent, the pixels under
   the text box are captured from the real page, and the text color (with ancestor opacity) is composited over every
   pixel. Nothing is dismissed here: each item gets a measured ratio and a verdict for a human to read. */
const STYLE =
  "[data-axe-hide],[data-axe-hide] *{color:transparent!important;-webkit-text-fill-color:transparent!important;text-shadow:none!important}";

module.exports = async function measureContrast(page, nodes, shots) {
  await page.evaluate((css) => {
    if (!document.getElementById("axe-hide-style")) {
      const style = document.createElement("style");
      style.id = "axe-hide-style";
      style.textContent = css;
      document.head.append(style);
    }
  }, STYLE);
  // The app's CSP blocks data: fetches, so pixels are decoded in a blank helper page of the same browser context.
  const aux = await (await page.context().browser().newContext()).newPage();
  const out = [];
  const seen = new Set();
  for (const node of nodes) {
    const selector = node.target.length === 1 ? node.target[0] : null;
    if (!selector || seen.has(selector)) continue;
    seen.add(selector);
    const scroll = await page.evaluate((sel) => {
      const el = document.querySelector(sel);
      const saved = [scrollX, scrollY];
      const r = el?.getBoundingClientRect();
      if (el && r && (r.bottom < 0 || r.top > innerHeight || r.right < 0 || r.left > innerWidth))
        el.scrollIntoView({ block: "center", inline: "center" });
      return saved;
    }, selector);
    const info = await page.evaluate((sel) => {
      const el = document.querySelector(sel);
      if (!el) return { skipped: "not found" };
      const cs = getComputedStyle(el);
      const rgba = (s) => (s.match(/[\d.]+/g) || []).map(Number);
      let opacity = 1;
      for (let n = el; n && n.nodeType === 1; n = n.parentElement) opacity *= parseFloat(getComputedStyle(n).opacity);
      const range = document.createRange();
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      const rects = [];
      for (let t = walker.nextNode(); t; t = walker.nextNode()) {
        if (!t.nodeValue.trim()) continue;
        const parent = t.parentElement;
        if (parent.closest("[aria-hidden='true'], [hidden]") && !el.closest("[aria-hidden='true']")) continue;
        // Each text node is judged with the color, opacity and size of the element that actually paints it.
        const ps = getComputedStyle(parent);
        let po = 1;
        for (let n = parent; n && n.nodeType === 1; n = n.parentElement) po *= parseFloat(getComputedStyle(n).opacity);
        const psize = parseFloat(ps.fontSize),
          pweight = parseInt(ps.fontWeight, 10) || 400;
        const style = { fg: rgba(ps.color), opacity: po, size: psize, weight: pweight, large: psize >= 24 || (psize >= 18.66 && pweight >= 700) };
        range.selectNodeContents(t);
        for (const r of range.getClientRects()) {
          if (!r.width || !r.height) continue;
          rects.push({ l: r.left, t: r.top, r: r.right, b: r.bottom, ...style });
        }
      }
      if (!rects.length) return { skipped: "no text box" };
      const clips = rects
        .slice(0, 12)
        .map((box) => ({
          fg: box.fg,
          opacity: box.opacity,
          large: box.large,
          x: Math.max(0, Math.floor(box.l)),
          y: Math.max(0, Math.floor(box.t)),
          width: Math.ceil(Math.min(box.r, innerWidth)) - Math.max(0, Math.floor(box.l)),
          height: Math.ceil(Math.min(box.b, innerHeight)) - Math.max(0, Math.floor(box.t)),
        }))
        .filter((c) => c.width >= 1 && c.height >= 1);
      if (!clips.length) return { skipped: "outside viewport" };
      const clip = clips[0];
      // Who is painted on top of the text box? Sample its center and corners.
      const cover = new Set();
      for (const [fx, fy] of [
        [0.5, 0.5],
        [0.1, 0.2],
        [0.9, 0.2],
        [0.1, 0.8],
        [0.9, 0.8],
      ]) {
        const top = document.elementFromPoint(clip.x + clip.width * fx, clip.y + clip.height * fy);
        if (top && top !== el && !el.contains(top) && !top.contains(el))
          cover.add(
            top.tagName.toLowerCase() + (top.className && typeof top.className === "string" ? "." + top.className.trim().split(/\s+/).join(".") : ""),
          );
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
        clips,
        coveredBy: [...cover],
        label: cs.backgroundImage !== "none" ? "gradient/image" : "",
      };
    }, selector);
    if (info.skipped) {
      await page.evaluate(([x, y]) => scrollTo(x, y), scroll);
      out.push({ selector, skipped: info.skipped });
      continue;
    }
    await page.evaluate((sel) => document.querySelector(sel).setAttribute("data-axe-hide", ""), selector);
    const pngs = [];
    try {
      for (const clip of info.clips) pngs.push(await page.screenshot({ clip, animations: "disabled" }));
    } finally {
      await page.evaluate((sel) => document.querySelector(sel)?.removeAttribute("data-axe-hide"), selector);
    }
    let context = null;
    if (shots) {
      const size = page.viewportSize() || { width: 1280, height: 900 };
      const c = info.clips[0];
      const x = Math.max(0, c.x - 24),
        y = Math.max(0, c.y - 16);
      context = await page.screenshot({
        clip: { x, y, width: Math.min(size.width - x, c.width + 48), height: Math.min(size.height - y, c.height + 32) },
        animations: "disabled",
      });
    }
    await page.evaluate(([x, y]) => scrollTo(x, y), scroll);
    const parts = [];
    for (const png of pngs)
      parts.push(
        await aux.evaluate(
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
            return {
              min: ratios[0],
              p5: ratios[Math.floor(ratios.length * 0.05)],
              median: ratios[Math.floor(ratios.length / 2)],
              mode,
              pixels: ratios.length,
            };
          },
          { b64: png.toString("base64"), fg: info.clips[parts.length].fg, opacity: info.clips[parts.length].opacity },
        ),
      );
    // The worst text line decides: a multi-line element is measured line by line.
    const needs = info.clips.map((c) => (c.large ? 3 : 4.5));
    const margin = parts.map((x, i) => x.min / needs[i]);
    const at = margin.indexOf(Math.min(...margin));
    const stats = { ...parts[at], p5: Math.min(...parts.map((x, i) => (x.p5 / needs[i]) * needs[at])), lines: parts.length };
    const need = needs[at];
    info.fg = info.clips[at].fg;
    info.opacity = info.clips[at].opacity;
    const verdict = stats.min >= need ? "pass" : stats.p5 >= need ? "edge-pixels-only" : "below-minimum";
    let shot;
    if (shots && context && verdict !== "pass") {
      const fs = require("node:fs");
      shot = shots.label.replace(/[^\w-]+/g, "_") + "-" + out.length + ".png";
      fs.mkdirSync(shots.dir, { recursive: true });
      fs.writeFileSync(require("node:path").join(shots.dir, shot), context);
    }
    out.push({
      selector,
      shot,
      text: info.text,
      size: info.size,
      weight: info.weight,
      large: info.large,
      need,
      fg: info.fg,
      opacity: info.opacity,
      coveredBy: info.coveredBy,
      ...stats,
      verdict,
    });
  }
  await aux.context().close();
  await page.bringToFront();
  return out;
};
