/* Consolidation Phase 4 (B3): the authoring version a newly created document of each family uses under the current
   release, pinned here independently of application code. A test that means "the current format for this family"
   reads it here; a test that means a specific historical format keeps its literal version. When the release
   authoring version changes, the check below fails until this table is reviewed and updated once, so application
   code and tests cannot both pass by reading the same incorrect constant. */
"use strict";
const fs = require("fs"),
  path = require("path");

const CURRENT_AUTHORING = Object.freeze({
  release: 16, // version.json authoringVersion
  initialNotice: 16, // newDoc: an Official Notice and its initial citations
  followUp: 16, // a referral, referral update, compliance letter or citation generated from a reinspection
  allItemExtension: 16, // Best Interest and Vacancy Extensions
  scopedOrder: 13, // abatements, No Occupancy and administrative scoped orders keep the dated model
});

const release = JSON.parse(fs.readFileSync(path.join(__dirname, "../../version.json"), "utf8")).authoringVersion;
if (release !== CURRENT_AUTHORING.release)
  throw new Error(
    "version.json authoringVersion is " +
      release +
      " but tests/fixtures/authoring_expectations.cjs pins " +
      CURRENT_AUTHORING.release +
      ". Review which document families use the new version and update the table.",
  );

module.exports = CURRENT_AUTHORING;
