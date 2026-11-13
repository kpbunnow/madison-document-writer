/* Reuse unchanged screen pagination, with conservative identity/DOM/layout/font/failure invalidation. */
const assert = require("node:assert/strict"),
  { JSDOM } = require("jsdom");
const { compile } = require("../fixtures/equivalence_harness.cjs");
(async () => {
  const { createPreviewRefresh } = await compile('export {createPreviewRefresh} from "./preview_refresh.js";');
  const dom = new JSDOM('<div class="desk"></div>', { pretendToBeVisual: true });
  const { document } = dom.window,
    desk = document.querySelector(".desk"),
    fonts = new dom.window.EventTarget();
  Object.defineProperty(document, "fonts", { value: fonts });
  let fontListeners = 0;
  const add = fonts.addEventListener.bind(fonts);
  fonts.addEventListener = (...args) => {
    fontListeners++;
    return add(...args);
  };
  let width = 1000;
  Object.defineProperty(desk, "clientWidth", { get: () => width });
  const refresh = createPreviewRefresh();
  let calls = 0;
  const html = "<section><button>Keep listener</button><p>Original text</p></section>";
  const paginate = () => {
    calls++;
    desk.querySelector("section").dataset.paginated = "true";
  };
  assert.equal(refresh(desk, "doc", html, paginate), true);
  const button = desk.querySelector("button");
  let clicks = 0;
  button.addEventListener("click", () => clicks++);
  for (let n = 0; n < 100; n++) assert.equal(refresh(desk, "doc", html, paginate), false);
  assert.equal(calls, 1);
  assert.equal(fontListeners, 2);
  button.click();
  assert.equal(clicks, 1);
  desk.querySelector("p").textContent = "Live edit";
  assert.equal(refresh(desk, "doc", html, paginate), true);
  width = 700;
  assert.equal(refresh(desk, "doc", html, paginate), true);
  document.documentElement.style.fontSize = "200%";
  assert.equal(refresh(desk, "doc", html, paginate), true);
  fonts.dispatchEvent(new dom.window.Event("loadingdone"));
  assert.equal(refresh(desk, "doc", html, paginate), true);
  fonts.dispatchEvent(new dom.window.Event("loadingerror"));
  assert.equal(refresh(desk, "doc", html, paginate), true);
  assert.equal(refresh(desk, JSON.stringify(["doc", "notice", 9]), html, paginate), true);
  assert.equal(
    refresh(desk, JSON.stringify(["doc", "notice", 10]), html, paginate),
    true,
    "pagination version is part of caller identity even if HTML matches",
  );
  assert.equal(refresh(desk, "other", html, paginate), true);
  assert.equal(refresh(desk, "other", html + "<p>Changed model</p>", paginate), true);
  assert.throws(
    () =>
      refresh(desk, "failed", html, () => {
        throw Error("interrupted pagination");
      }),
    /interrupted/,
  );
  assert.equal(refresh(desk, "failed", html, paginate), true, "failure cannot leave a reusable partial preview");
  assert.equal(refresh(desk, "failed", html, paginate), false);
  const replacement = document.createElement("div");
  document.body.append(replacement);
  assert.equal(
    refresh(replacement, "failed", html, () => {
      calls++;
      replacement.querySelector("section").dataset.paginated = "true";
    }),
    true,
  );
  assert.equal(
    refresh(replacement, "failed", html, () => assert.fail("replacement cache missed")),
    false,
  );
  dom.window.close();
  console.log(
    "PASS preview reuse: 100 unchanged refreshes / one pagination; edits, layout, fonts, identity, replacement and failure invalidate; listeners preserved",
  );
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
