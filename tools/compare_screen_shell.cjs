/* Read-only visual comparison of captured synthetic DOM under before/after shell CSS. Run serially. */
const fs = require("fs"),
  path = require("path"),
  assert = require("assert/strict"),
  crypto = require("crypto");
const { chromium } = require("playwright");
const args = process.argv.slice(2),
  options = {};
for (let i = 0; i < args.length; i += 2) {
  assert.ok(/^--(before|after|snapshots|output)$/.test(args[i]) && args[i + 1], "--before --after --snapshots --output are required");
  options[args[i].slice(2)] = path.resolve(args[i + 1]);
}
for (const name of ["before", "after", "snapshots", "output"]) assert.ok(options[name], name + " is required");
const styles = (folder, name) =>
  [...fs.readFileSync(path.join(folder, name), "utf8").matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/g)].map((m) => m[1]);
const files = { writer: "madison-document-writer.html", reports: "madison-reports.html" },
  css = {};
for (const [kind, name] of Object.entries(files)) {
  css[kind] = { before: styles(options.before, name), after: styles(options.after, name) };
  assert.equal(css[kind].before.length, css[kind].after.length);
  assert.ok(css[kind].before.length);
}
const sha = (v) => crypto.createHash("sha256").update(v).digest("hex");
(async () => {
  fs.mkdirSync(options.output, { recursive: true });
  const browser = await chromium.launch({
    executablePath: process.env.DW_BROWSER || undefined,
    headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu"],
  });
  const page = await browser.newPage();
  await page.route("http://**/*", (route) => route.abort());
  await page.route("https://**/*", (route) => route.abort());
  const checks = [];
  try {
    for (const file of fs
      .readdirSync(options.snapshots)
      .filter((f) => /^\d+\.json$/.test(f))
      .sort()) {
      const snapshot = JSON.parse(fs.readFileSync(path.join(options.snapshots, file), "utf8")),
        sheet = css[snapshot.kind];
      for (const forcedColors of snapshot.media.forcedColors === "active" ? ["active"] : ["none", "active"]) {
        const media = { ...snapshot.media, forcedColors };
        await page.setViewportSize(snapshot.viewport);
        await page.emulateMedia(media);
        await page.setContent(
          "<!doctype html><html><head><meta charset=\"utf-8\"><meta http-equiv=\"Content-Security-Policy\" content=\"script-src 'none'; object-src 'none'; connect-src 'none'\">" +
            sheet.before.map((s) => "<style data-compare-sheet>" + s + "</style>").join("") +
            "<style>*,:before,:after{animation:none!important;transition:none!important;caret-color:transparent!important}</style></head>" +
            snapshot.body +
            "</html>",
        );
        await page.evaluate(async (s) => {
          for (const [name, value] of s.attributes) document.documentElement.setAttribute(name, value);
          await document.fonts.ready;
          await Promise.all([...document.images].map((img) => img.decode().catch(() => {})));
          const elements = [...document.body.querySelectorAll("*")];
          elements[s.focus]?.focus({ preventScroll: true });
          window.scrollTo(...s.scroll);
        }, snapshot);
        if (snapshot.hover >= 0) {
          const box = await page.evaluate((i) => {
            const r = document.body.querySelectorAll("*")[i]?.getBoundingClientRect();
            return r && { x: r.x + r.width / 2, y: r.y + r.height / 2 };
          }, snapshot.hover);
          if (box && box.x >= 0 && box.y >= 0 && box.x < snapshot.viewport.width && box.y < snapshot.viewport.height)
            await page.mouse.move(box.x, box.y);
        }
        // Use the same stylesheet-repaint path on both sides; first-paint outline antialiasing differs in forced colors.
        await page.evaluate((sheets) => {
          [...document.querySelectorAll("[data-compare-sheet]")].forEach((el, i) => {
            el.textContent = sheets[i];
          });
        }, sheet.before);
        await page.evaluate(async () => {
          await document.fonts.ready;
          await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        });
        const inspect = () =>
          page.evaluate(() => {
            const properties = [
              "display",
              "visibility",
              "position",
              "top",
              "right",
              "bottom",
              "left",
              "width",
              "height",
              "min-width",
              "max-width",
              "min-height",
              "max-height",
              "color",
              "background-color",
              "background-image",
              "font-family",
              "font-size",
              "font-weight",
              "font-style",
              "line-height",
              "letter-spacing",
              "white-space",
              "text-align",
              "text-decoration",
              "text-transform",
              "border-top",
              "border-right",
              "border-bottom",
              "border-left",
              "border-radius",
              "outline",
              "outline-offset",
              "box-shadow",
              "padding",
              "margin",
              "gap",
              "grid-template-columns",
              "grid-template-rows",
              "flex-direction",
              "flex-wrap",
              "align-items",
              "justify-content",
              "overflow-x",
              "overflow-y",
              "opacity",
              "transform",
              "z-index",
              "cursor",
              "list-style-type",
            ];
            return JSON.stringify(
              [...document.body.querySelectorAll("*")].map((el) => {
                const style = getComputedStyle(el),
                  r = el.getBoundingClientRect();
                const pseudo = (name) => {
                  const s = getComputedStyle(el, name);
                  return [s.content, s.display, s.color, s.backgroundColor, s.font, s.width, s.height];
                };
                return [
                  el.tagName,
                  [r.x, r.y, r.width, r.height],
                  properties.map((p) => style.getPropertyValue(p)),
                  pseudo("::before"),
                  pseudo("::after"),
                ];
              }),
            );
          });
        await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
        const before = await inspect(),
          beforeImage = await page.screenshot({ animations: "disabled" });
        await page.evaluate((sheets) => {
          [...document.querySelectorAll("[data-compare-sheet]")].forEach((el, i) => {
            el.textContent = sheets[i];
          });
        }, sheet.after);
        await page.evaluate(async () => {
          await document.fonts.ready;
          await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        });
        const after = await inspect(),
          afterImage = await page.screenshot({ animations: "disabled" });
        const artifactPrefix = file + "." + forcedColors;
        const row = {
          artifactPrefix,
          screen: snapshot.screen,
          kind: snapshot.kind,
          viewport: snapshot.viewport,
          media,
          stylesAndGeometry: before === after,
          pixels: beforeImage.equals(afterImage),
          snapshotSha256: sha(fs.readFileSync(path.join(options.snapshots, file))),
          beforeStylesSha256: sha(before),
          afterStylesSha256: sha(after),
          beforePixelsSha256: sha(beforeImage),
          afterPixelsSha256: sha(afterImage),
        };
        checks.push(row);
        if (!row.stylesAndGeometry || !row.pixels) {
          fs.writeFileSync(path.join(options.output, artifactPrefix + ".before.json"), before);
          fs.writeFileSync(path.join(options.output, artifactPrefix + ".after.json"), after);
          fs.writeFileSync(path.join(options.output, artifactPrefix + ".before.png"), beforeImage);
          fs.writeFileSync(path.join(options.output, artifactPrefix + ".after.png"), afterImage);
        }
        fs.writeFileSync(
          path.join(options.output, "comparison.json"),
          JSON.stringify({ passed: checks.every((x) => x.stylesAndGeometry && x.pixels), browserVersion: browser.version(), checks }, null, 2),
        );
        assert.ok(row.stylesAndGeometry, snapshot.screen + " screen CSS changed computed styles or geometry; inspect comparison evidence");
      }
    }
    assert.ok(checks.length, "captured screens are required");
    const pixelMismatches = checks.filter((row) => !row.pixels).length;
    console.log(JSON.stringify({ passed: pixelMismatches === 0, screens: checks.length, styleAndGeometryParity: true, pixelMismatches }));
    if (pixelMismatches) process.exitCode = 1;
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
