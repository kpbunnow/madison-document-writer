/* Runs a migrated feature-suite scenario and ends it exactly as bundle_test.cjs ended a whole-application one:
   exit 0 once its work completes, or report the error and exit 1. */
module.exports = function ownerScenario(body) {
  Promise.resolve()
    .then(body)
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
};
