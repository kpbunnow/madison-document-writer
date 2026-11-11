/* Independently specified owner-requested addition. Keep the original frozen overlay bytes intact and require
   precisely this safe link before comparing every other byte, state change, adapter call and refusal. */
const assert = require("node:assert/strict");
const lookup =
  '<p><a href="https://apps.dfi.wi.gov/apps/corpsearch/search.aspx" target="_blank" rel="noopener noreferrer">Look up a registered agent at Wisconsin DFI (opens in a new tab)</a></p>';

function withRegisteredAgentLookup(expected, actual) {
  if (typeof expected !== "string" || !expected.includes('<h3 class="rec-h">Registered agent')) return expected;
  assert.equal(typeof actual, "string", "Recipients renders successfully");
  assert.equal(actual.split(lookup).length - 1, 1, "Recipients offers exactly one safe DFI lookup link");
  return expected.replace(/(<h3 class="rec-h">Registered agent.*?<\/h3>)/, "$1\n      " + lookup);
}
module.exports = { withRegisteredAgentLookup };
