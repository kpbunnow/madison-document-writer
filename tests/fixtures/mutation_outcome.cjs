/* Mutation evidence requires a normal process outcome. Infrastructure errors, signals and timeouts are not kills. */
const assert = require("node:assert/strict");
function normalOutcome(result, label) {
  assert.ifError(result.error);
  assert.equal(result.signal, null, label + ": child was terminated");
  assert.ok(Number.isInteger(result.status), label + ": child did not exit normally");
  return result.status;
}
function compileOwner(text) {
  try {
    return new Function("today", "module", "exports", text);
  } catch (error) {
    throw new Error("Invalid owner bundle: " + error.message, { cause: error });
  }
}
module.exports = { normalOutcome, compileOwner };
