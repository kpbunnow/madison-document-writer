/* Nullable retained copy slots are supported; consumers must keep the remaining contact indices. */
const assert = require("node:assert/strict"),
  path = require("node:path"),
  esbuild = require("esbuild"),
  { JSDOM } = require("jsdom");
(async () => {
  const built = await esbuild.build({
    stdin: {
      contents: `export {caseFileFault} from './case_file_rules.js';
      export {initAddressParser} from './address_parser.js';
      export {createRecipientWorkflow} from './recipient_workflow.js';
      export {createScreenOverlays} from './screen_overlays.js';
      export {WriterState} from './state.js';`,
      resolveDir: path.resolve("app/modules"),
    },
    bundle: true,
    write: false,
    format: "cjs",
    plugins: [
      {
        name: "data",
        setup(b) {
          b.onResolve({ filter: /\/data\// }, (a) => ({ path: path.resolve("build/generated/modules/data", path.basename(a.path)) }));
        },
      },
    ],
  });
  const box = { exports: {} };
  new Function("module", "exports", built.outputFiles[0].text)(box, box.exports);
  const { caseFileFault, initAddressParser, createRecipientWorkflow, createScreenOverlays, WriterState: s } = box.exports;
  const dom = new JSDOM('<div id="app"></div>');
  Object.assign(global, { window: dom.window, document: dom.window.document });
  const parser = initAddressParser({}),
    recipient = createRecipientWorkflow({ addressParser: parser }),
    overlays = createScreenOverlays({ recipientPreview: recipient.recipientPreview });
  const contact = () => ({ name: "Synthetic copy", addr: "123 Main St", city: "Madison, WI 53703" });
  for (const copies of [[null, contact()], [contact(), null, contact()], [null]]) {
    const k = { id: "k", number: "QA-NULL-COPY", owner: "Synthetic owner", ccList: copies },
      file = { format: "madison-case-file", case: k, events: [] },
      original = structuredClone(k);
    assert.equal(caseFileFault(file), "", "retain the supported legacy case shape");
    Object.assign(s, { CASES: [k], DOCS: [{ id: "d", caseId: "k", draft: true, type: "notice" }], state: { docId: "d", modal: "cc" } });
    assert.doesNotThrow(() => parser.fault(k), "empty retained slots must not crash address readiness");
    assert.equal(recipient.validateAndStandardizeAddresses(k, false, false), null);
    document.getElementById("app").innerHTML = overlays.overlayHTML();
    copies.forEach((c, ix) => assert.equal(!!document.querySelector('[data-cc="' + ix + '|name"]'), !!c));
    assert.deepEqual(k, original, "readiness/rendering cannot rewrite retained contacts");
    if (copies.some(Boolean)) {
      const ix = copies.findLastIndex(Boolean),
        c = copies[ix];
      c.addressParsed = { type: "ambiguous", accepted: false, raw: c.addr + "\n" + c.city };
      assert.equal(parser.fault(k).index, ix, "null slots must not reindex later contact faults");
      assert.equal(recipient.validateAndStandardizeAddresses(k, false, false).selector, '[data-cc="' + ix + '|addr"]');
    }
  }
  dom.window.close();
  console.log("PASS supported nullable copy slots: readiness, Recipients rendering, unchanged data and stable contact/fault indices");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
