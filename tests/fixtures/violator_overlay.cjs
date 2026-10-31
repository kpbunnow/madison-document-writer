/* The Recipients dialog with the Violator additions taken out, for comparison with the retained original. The
   additions are one type selector per copy entry, one explanatory paragraph once there is an entry, and the owner-copy
   choice once a Violator is marked. Each must appear exactly as often as the retained output has entries, so nothing
   else in the retained comparison is loosened. */
const assert = require("node:assert/strict");

const SELECT = /\n {10}<select data-cc="\d+\|kind"[\s\S]*?<\/select>/g;
const HINT = /<p class="hint" id="violator-hint">[\s\S]*?<\/p>/g;
const OWNER = /<label class="sendrow rec-owner">[\s\S]*?<\/label><p class="hint">[\s\S]*?<\/p>/g;

function withoutViolatorAdditions(actual, retained) {
  if (typeof actual !== "string" || typeof retained !== "string" || !retained.includes("Copies, email and registered agent")) return actual;
  const entries = (retained.match(/data-cc="\d+\|name"/g) || []).length;
  assert.equal((actual.match(SELECT) || []).length, entries, "one type selector for each copy entry");
  assert.equal((actual.match(HINT) || []).length, entries ? 1 : 0, "the Violator paragraph appears once there is an entry");
  assert.ok((actual.match(OWNER) || []).length <= 1);
  return actual.replace(SELECT, "").replace(HINT, "").replace(OWNER, "");
}

module.exports = { withoutViolatorAdditions };
