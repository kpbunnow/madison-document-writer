const assert = require("node:assert/strict"),
  path = require("node:path"),
  { JSDOM } = require("jsdom"),
  esbuild = require("esbuild");
(async () => {
  const build = await esbuild.build({ entryPoints: [path.resolve("app/modules/character_count.js")], bundle: true, write: false, format: "cjs" });
  const module = { exports: {} };
  new Function("module", "exports", build.outputFiles[0].text)(module, module.exports);
  const { enhanceCharacterCounts } = module.exports;
  const dom = new JSDOM(
    '<form><p id="reason-error">Existing error</p><label>Reason<textarea id="reason" maxlength="1000" aria-describedby="reason-error">abc</textarea></label><textarea id="uncapped"></textarea></form>',
  );
  const document = dom.window.document,
    field = document.getElementById("reason");
  let bindings = 0;
  const add = field.addEventListener.bind(field);
  field.addEventListener = (...args) => {
    bindings++;
    return add(...args);
  };
  for (let n = 0; n < 100; n++) enhanceCharacterCounts(document);
  assert.equal(bindings, 1, "enhancement cannot accumulate listeners");
  assert.equal(document.querySelectorAll("[data-character-count]").length, 1);
  const counter = () => document.getElementById(field.getAttribute("aria-describedby").split(" ").at(-1));
  assert.equal(counter().textContent, "3 / 1,000 characters");
  assert.equal(field.closest("label").textContent, "Reasonabc", "counter is a description, not a changing accessible name");
  assert.ok(field.getAttribute("aria-describedby").startsWith("reason-error "));
  assert.equal(document.getElementById("uncapped").getAttribute("aria-describedby"), null);
  field.value = "a".repeat(1000);
  field.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
  assert.equal(counter().textContent, "1,000 / 1,000 characters");
  field.value = "a".repeat(1001);
  field.dispatchEvent(new dom.window.Event("input"));
  assert.match(counter().textContent, /exceeds the limit/);
  assert.equal(field.value.length, 1001, "never truncate retained programmatic values");
  assert.equal(field.getAttribute("aria-invalid"), null, "domain validation retains ownership");
  field.value = "🙂";
  field.dispatchEvent(new dom.window.Event("input"));
  assert.equal(counter().textContent, "2 / 1,000 characters", "count matches native maxlength UTF-16 units");
  const old = counter(),
    label = document.createElement("label");
  label.textContent = "Repainted reason";
  document.querySelector("form").append(label);
  label.append(field);
  enhanceCharacterCounts(document);
  assert.equal(bindings, 1);
  assert.equal(old.isConnected, false);
  assert.equal(counter().previousElementSibling, label);
  assert.equal(counter().textContent, "2 / 1,000 characters");
  counter().remove();
  enhanceCharacterCounts(document);
  assert.ok(counter().isConnected);
  field.value = "x";
  field.dispatchEvent(new dom.window.Event("input"));
  assert.equal(counter().textContent, "1 / 1,000 characters");
  field.disabled = true;
  enhanceCharacterCounts(document);
  assert.equal(field.disabled, true);
  dom.window.close();
  console.log("PASS character limits: live descriptions, preserved errors/names/data, UTF-16 limits, single binding and repainted fields");
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
