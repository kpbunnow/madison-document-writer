/* Address acceptance through real editor, integrity, record and summary owners.
   Native UI, ID generation and persistence are controlled at their existing service boundaries. */
const path = require("node:path"),
  esbuild = require("esbuild");
module.exports = async function createAddressWorkflow() {
  const root = path.resolve(__dirname, "../.."),
    built = await esbuild.build({
      stdin: {
        contents: `
          export {WriterState} from './state.js';
          export * as queries from './writer_queries.js';
          export {createEditorScreens} from './editor_screens.js';
          export {initAddressParser} from './address_parser.js';
          export {initRecordIntegrity} from './record_integrity.js';
          export {createCaseSummaryAdapter} from './case_summary_adapter.js';
          export * as records from './case_records.js';
          export {TEST_CASES} from './test_fixtures.js';
          export {isSnowCase} from './document_rules.js';
          export {standardStreetAddress,standardCityStateZip} from './address_format.js';
          export {respondentKey} from './citation_policy.js';
          export {SUMMARY_VERSION} from '../assets/shared.js';`,
        resolveDir: path.join(root, "app/modules"),
      },
      bundle: true,
      format: "cjs",
      write: false,
      define: { __TEST_BUILD__: "false" },
      plugins: [
        {
          name: "generated-data",
          setup(b) {
            b.onResolve({ filter: /\/data\// }, (a) => ({ path: path.join(root, "build/generated/modules/data", path.basename(a.path)) }));
          },
        },
      ],
    }),
    box = { exports: {} };
  new Function("module", "exports", "today", built.outputFiles[0].text)(box, box.exports, new Date());
  const {
    WriterState,
    queries,
    createEditorScreens,
    initAddressParser,
    initRecordIntegrity,
    createCaseSummaryAdapter,
    records,
    TEST_CASES,
    isSnowCase,
    ...format
  } = box.exports;
  Object.assign(WriterState, {
    CASES: JSON.parse(JSON.stringify(TEST_CASES)),
    DOCS: [],
    REINSP: [],
    EVENTS: {},
    SAVE_CHECKPOINTS: {},
    PENDING: [],
    DIRTY: false,
    seq: 100,
    state: { screen: "cases", docId: null, caseId: null },
  });
  const adapters = {
      uid: (prefix) => prefix + ++WriterState.seq + "-address-test",
      saveDrafts: async () => true,
      render: () => {},
      toast: () => {},
      A11Y: { utility: () => {} },
      helperJSON: async () => {
        throw Error("No address helper supplied");
      },
    },
    recordIntegrity = initRecordIntegrity({ kase: queries.kase }),
    editor = createEditorScreens({
      record: {
        recordIntegrity,
        snow: {
          isCase: isSnowCase,
          addDefault() {
            throw Error("Snow is outside address workflow");
          },
        },
      },
      edit: { uid: adapters.uid, saveDrafts: (...args) => adapters.saveDrafts(...args) },
      ui: { render: (...args) => adapters.render(...args), toast: adapters.toast },
    }),
    addresses = initAddressParser({
      recordIntegrity,
      uid: adapters.uid,
      A11Y: adapters.A11Y,
      toast: adapters.toast,
      saveDrafts: (...args) => adapters.saveDrafts(...args),
      render: (...args) => adapters.render(...args),
      helperJSON: (...args) => adapters.helperJSON(...args),
    }),
    summary = createCaseSummaryAdapter({ recordIntegrity });
  return { WriterState, queries, editor, addresses, records, summary, format, adapters };
};
