/* Compose real shell, case actions and editor screen; unrelated peer output is controlled at its existing boundary. */
const path = require("node:path"),
  esbuild = require("esbuild");
module.exports = async function createWriterShell() {
  const built = await esbuild.build({
      stdin: {
        contents: `export {WriterState} from './state.js';
      export {createWorkspaceShell} from './workspace_shell.js';
      export {createEditorScreens} from './editor_screens.js';
      export {initNewDocuments} from './new_documents.js';
      export {kase,sourceDocFor} from './writer_queries.js';
      export {esc} from './presentation_format.js';`,
        resolveDir: path.resolve("app/modules"),
      },
      bundle: true,
      write: false,
      format: "cjs",
      define: { __TEST_BUILD__: "false" },
      plugins: [
        {
          name: "data",
          setup(b) {
            b.onResolve({ filter: /\/data\// }, (a) => ({ path: path.resolve("build/generated/modules/data", path.basename(a.path)) }));
          },
        },
      ],
    }),
    box = { exports: {} };
  new Function("module", "exports", "today", built.outputFiles[0].text)(box, box.exports, new Date());
  const { WriterState, createWorkspaceShell, createEditorScreens, initNewDocuments, kase, sourceDocFor, esc } = box.exports;
  Object.assign(WriterState, {
    CASES: [{ id: "k1", number: "QA-SHELL", address: "Synthetic property" }],
    DOCS: [],
    REINSP: [],
    EVENTS: {},
    PENDING: [],
    WORK: { entry: {}, recordForms: {} },
    RECORD_ATTEMPTS: {},
    state: {},
    LOCAL_SAVE: { ok: true },
  });
  const context = () => ({ esc, LOCAL_SAVE: WriterState.LOCAL_SAVE, PENDING: [], storageMode: () => "download" });
  const { shell } = createWorkspaceShell({ navigation: { rail: () => "" }, recordIntegrity: { banner: () => "" }, app_savedworkContext: context });
  const newDocuments = initNewDocuments({ shell, sourceDocFor, snow: { is: () => false } });
  const nothing = () => "",
    quiet = () => {};
  const editor = createEditorScreens({
    ui: { shell, render: quiet, toast: quiet },
    edit: { uid: () => "shell-document", saveDrafts: async () => true, isLocked: () => false, structEditable: () => true },
    record: {
      snow: { isCase: () => false, prepare: quiet, factsForm: nothing },
      recordIntegrity: { blocked: () => false, status: () => ({ valid: true }) },
      checks: () => [],
      newDocuments,
      initialCitations: { enabled: () => false },
      citationReview: nothing,
      documentHTML: nothing,
      duePanel: nothing,
      correctionPanel: nothing,
      recordHistoryHTML: nothing,
      publicationPanel: nothing,
      filingPanel: nothing,
      citationRecoveryPanel: nothing,
      app_savedworkContext: context,
    },
  });
  return { WriterState, kase, shell, newDocuments, newDoc: editor.newDoc, screenWrite: editor.screenWrite };
};
