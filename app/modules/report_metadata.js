/* Shared report definitions and sheet scope; no runtime state or startup dependencies. */
export const DEFINITIONS = [
  [
    "Counted cases",
    "A case counts once its Official Notice or snow-only citation has been is" +
      "sued. Snow cases close on PDF filing when configured and are excluded fr" +
      "om Days to compliance. Drafts never reach the record and are never count" +
      "ed. Current period reports use current corrected facts, keep the origina" +
      "l action date and count each action once. Withdrawn items are excluded f" +
      "rom compliance totals. As-of reports retain earlier versions until their" +
      " recorded replacement or withdrawal day (end-of-day basis).",
  ],
  [
    "Case opened",
    "The initial inspection date. Reports with a period filter cases by this " +
      "date, except citations, referrals, overridden deposits and document actions, which filter by the date they were" +
      " issued. The workbook's Corrections sheet filters by the date each correction was recorded.",
  ],
  ["Open", 'A case with an issued notice and no compliance letter. "As of" a date means open on that date.'],
  [
    "Status",
    "The latest issued document: Notice, Extension, Cited, Referred, Closed (" +
      "compliant) or Withdrawn (all items entered in error). A referred case st" +
      "ays Referred until it is closed.",
  ],
  ["Violation", "One numbered item on the Official Notice. Item numbers never change, so " + "item 3 is the same violation on every later document."],
  ["Open violation", "An item not yet recorded as corrected, on the latest document or at a later visit."],
  [
    "Days to compliance",
    "From the initial inspection date to the date the item was recorded as co" + "rrected. Items still open are shown separately with their age.",
  ],
  [
    "Violation type",
    "The order-language library entry the item was picked from. Items written" +
      " before the library key existed are matched on the same title and sectio" +
      "ns; anything else is grouped as Unclassified by its first ordinance sect" +
      "ion.",
  ],
  ["Citation", "Each citation number on an issued, non-void citation, with the ordinance" + ", date and cash deposit printed on the MC-2000."],
  ["Referral", "A Referral for Prosecution. Updates to a referral are not counted again."],
  ["Owner", "The owner as the most recent issued document printed it."],
  [
    "Owner by mailing address",
    "One owner is recognized by the street line and 5-digit ZIP of the mailin" +
      "g address, with street types, directions and unit markers written one wa" +
      "y. Name and care-of lines are skipped. Owners sharing a property manager" +
      "’s address share one key; every name seen is shown.",
  ],
  [
    "Area",
    "Alder district comes from the city parcel layer for the case’s parcel. C" +
      "urrent uses the district as the parcel reads now; When opened uses the d" +
      "istrict as it read when the case opened, as far as the parcel had been l" +
      "ooked up by then. ZIP comes from the Accela site address, else from ZIP " +
      "outlines if provided. Cases with neither are Unlocated.",
  ],
];
export const EXPORT_SCOPE = [
  [
    "Cases",
    "Counted cases opened in the period (case opening date). Area, inspector (the inspector on the case), owner and current " +
      "status apply. Violation type and ordinance keep cases with at least one matching item that is not withdrawn.",
  ],
  [
    "Violations",
    "Items on the cases in the Cases sheet that match the violation type and ordinance, including withdrawn items. The period " +
      "uses the case opening date.",
  ],
  [
    "Visits",
    "Every visit and item result on the cases in the Cases sheet. Visit date, visit inspector, violation type and ordinance are " +
      "not applied to the visits, so a visit can fall outside the period.",
  ],
  [
    "Citations",
    "Citations issued in the period (issue date) on any counted case, whenever it opened. Inspector means the issuing inspector " +
      "and ordinance the cited ordinance. Violation type is not applied. Area, owner and current status apply to the case.",
  ],
  [
    "Referrals",
    "Referrals issued in the period (issue date) on any counted case, whenever it opened. Inspector means the referring " +
      "inspector. Area, owner, current status, violation type and ordinance apply to the case (at least one matching item).",
  ],
  [
    "Corrections",
    "Corrections recorded in the period (date recorded, Central time) on any counted case, whenever it opened. Area, inspector " +
      "(the inspector on the case), owner, current status, violation type and ordinance apply to the case.",
  ],
  [
    "Numbered report sheets",
    "The same rows as each report on screen. Reports 1 and 3 use the As of date instead of the period; reports 2 and 4–7 use " +
      "the case opening date; reports 8–11 use the date issued and the issuing inspector. Report 8 applies violation type to " +
      "the cited item, reports 9 and 10 apply it to the case and report 11 does not apply it.",
  ],
];

export const STATUSES = [
  "Notice",
  "Extension",
  "Best Interest Extension",
  "Vacancy Extension",
  "Summary Abatement",
  "Non-Summary Abatement",
  "Occupancy restricted",
  "Restriction released",
  "Cited",
  "Referred",
  "Closed",
  "Withdrawn",
  "Cited – snow",
];
export const STATUS_COL = { Notice: "#14567F", Extension: "#C26A00", Cited: "#A8201A", Referred: "#5A3C8C", Closed: "#1B6045" };

export const TILE = {
  labels: "https://maps.cityofmadison.com/arcgis/rest/services/BaseMaps/Color_basemap/MapServer/tile/{z}/{y}/{x}",
  plain: "https://maps.cityofmadison.com/arcgis/rest/services/BaseMaps/Color_base_No_Names/MapServer/tile/{z}/{y}/{x}",
};
