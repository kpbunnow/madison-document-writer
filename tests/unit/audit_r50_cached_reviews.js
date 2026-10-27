/* Catalog refresh and its language view are composed without booting Writer. */
const assert = require("assert/strict"),
  path = require("path"),
  esbuild = require("esbuild");
(async () => {
  const compiled = await esbuild.build({
    stdin: {
      contents:
        'export {createLanguageCatalog} from "./app/modules/language_catalog.js";export {createLanguageDiscoveryContext} from "./app/modules/app_view_contexts.js";export {createLanguageViews} from "./app/modules/language_views.js";export {allItems} from "./app/modules/catalog_queries.js";export {catalogKey} from "./app/modules/catalog_forms.js";export {WriterState} from "./app/modules/state.js";',
      resolveDir: path.resolve("."),
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
  new Function("localStorage", "module", "exports", compiled.outputFiles[0].text)({ setItem: () => {} }, box, box.exports);
  const { createLanguageCatalog, createLanguageDiscoveryContext, createLanguageViews, allItems, catalogKey, WriterState } = box.exports;
  let helperJSON = async () => ({ events: [] });
  const catalog = createLanguageCatalog({ allItems, catalogKey, helperJSON: (...args) => helperJSON(...args), render: () => {} });
  const context = createLanguageDiscoveryContext({
    allItems,
    catalogKey,
    catalogItem: catalog.catalogItem,
    catalogReviewPanel: catalog.catalogReviewPanel,
    catalogStatus: catalog.catalogStatus,
    catalogVisible: catalog.catalogVisible,
    effectiveCatalog: catalog.effectiveCatalog,
    shell: (title, crumb, actions, body) => body,
  });
  const { screenLibrary } = createLanguageViews({ app_languagediscoveryContext: context });
  const { refreshCatalog } = catalog;
  Object.assign(WriterState, {
    CATALOG_FROM_CACHE: true,
    CATALOG_VERIFIED: true,
    CATALOG_EVENTS: [],
    CATALOG_ERROR: "",
    CATALOG_AT: "synthetic cached date",
    state: { languageMode: "browse", libCl: -1 },
  });
  assert.ok(screenLibrary().includes("Review status from cache · refreshing"));
  await refreshCatalog();
  assert.equal(WriterState.CATALOG_FROM_CACHE, false);
  assert.equal(WriterState.CATALOG_VERIFIED, true);
  assert.ok(screenLibrary().includes("Review status last verified:"));
  WriterState.CATALOG_FROM_CACHE = true;
  helperJSON = async () => {
    throw Error("offline");
  };
  await refreshCatalog();
  assert.equal(WriterState.CATALOG_FROM_CACHE, true);
  assert.ok(screenLibrary().includes("Review status from cache · refresh unavailable"));
  console.log("PASS cached status, current confirmation and outage caption");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
