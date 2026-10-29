/* Actual stopped-session registration, Reports rendering guard and authenticated transport. */
module.exports = async function createReportStop() {
  const compiled = await require("esbuild").build({
      stdin: {
        contents:
          'export {listenForReportStop} from "./report_connection.js";export {createReportsServices} from "./reports_services.js";export {authFetch} from "./helper_transport.js";',
        resolveDir: require("path").resolve("app/modules"),
      },
      bundle: true,
      write: false,
      format: "cjs",
      define: { __TEST_BUILD__: "false" },
    }),
    box = { exports: {} };
  new Function("module", "exports", compiled.outputFiles[0].text)(box, box.exports);
  const { listenForReportStop, createReportsServices, authFetch } = box.exports,
    { render } = createReportsServices({});
  listenForReportStop();
  return { render, authFetch };
};
