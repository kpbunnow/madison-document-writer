# Reporting

Applies to the current release (summary version 6).

## 16 Run reports and interpret their dates

Open Reports from Writer. The common choices are visible in its rail; More reports lists the remaining reports. Every report describes its population and date basis. Filters act on retained verified summaries; drafts do not become issued report actions.

| Report | Principal date and counting basis |
| --- | --- |
| Open cases by area | Open on the selected as-of date after an issued notice or snow citation |
| Cases by inspector | Cases opened in the period, by case inspector and area |
| Open violations by area | Items still open on the as-of date after notice issuance |
| All cases | Cases opened by initial inspection date in the period, with current status |
| All violations | Non-withdrawn items on cases opened in the period |
| Days to compliance | Initial inspection to item correction; excludes snow cases |
| Repeat cases by owner | Two or more opened cases, grouped by usable owner mailing address |
| Citations by ordinance | Effective non-void citations issued in the period |
| Overridden deposits | Authorized exceptional determined deposits issued in the period |
| Referrals for prosecution | Referrals issued in the period, with owner facts as referred |
| Document actions | Effective issued actions in the period; includes scoped actions before a notice |

Use From/To for period reports and As of for historical open-state reports. Date shortcuts set the corresponding range. Open More filters for additional scope such as status, owner, violation type or ordinance. Applied-filter chips reveal active scope even when its control is collapsed. Reset filters returns to the current year, current district boundaries and unfiltered optional fields, and clears sorting.

Click a sortable column heading to set its order. The active screen, CSV, matching workbook report sheet and print use the same stable row order. Other named workbook sheets retain their own definitions; do not assume every sheet uses a citation issue date merely because the active report does.

Saved local views retain their report, dates, filters, map choice and sort. Relative local date choices recalculate on use. Shared views retain their established filter/date/map format without shared sort. Manual report switching clears the saved-view selection and old return notice while retaining the working filters and sort context.

Owner grouping by mailing address can combine owners represented by the same manager; names are shown for interpretation. Citation tiers count effective issued history, not an external conviction feed. Document action counts can exceed visit counts because compatible actions can share one physical visit.


## 17 Verify report coverage maps and exports

**Check coverage first.** Open Data and definitions. Review the read time, included case files and excluded summaries. Missing summaries, exact source-revision mismatches, earlier-format summaries, summaries not matching their verified case and unreadable or duplicate entries are explained separately. Categories can overlap; an unreadable-entry count is not a unique-case count. Do not add them together as a case total.

Each included current summary must match the independently read case bytes and integrity proof, and its reported facts must equal what the verified case itself shows. A summary that names the current case revision but reports different facts (for example an owner, status, date, document, violation or citation) is excluded as not matching its case. A rebuild regenerates summaries from the verified cases; it does not repair altered case history or grant legal approval. An administrator should first resolve the underlying record issue, then use Tools & settings → Saved work & connection → Connection checks and technical details → Storage diagnostics → Rebuild reporting index. Refresh Reports and recheck the exclusions before relying on totals.

**Maps.** Switch between table and map when the report supports a map. Select area/boundary and basemap choices deliberately. GIS enrichment depends on access to City services; records without a usable location remain disclosed. Use the map's table alternative for the same report population and review unlocated records. A missing point is not evidence that a case was excluded from the report count.

**Drill into data.** Open a count or case link to inspect its underlying cases. Open case in Writer continues its existing work in Writer. Back to Reports in the Writer rail returns to the open Reports tab, or opens Reports in this tab when none answers, and restores the report, filters, view, date mode and sort retained when the case was opened; relative date choices recalculate for today. Check dates and filters after a return or data refresh, especially when a source record has changed.

**Export.** Expand the export controls. Current report — CSV contains exactly the rows and columns of this table, with its filters, dates and sort. Reports workbook — Excel contains an About sheet, record sheets (Cases, Violations, Visits, Citations, Referrals, Corrections) and a sheet for every named report, with numeric/date values where appropriate. Sheets do not all apply the filters the same way; the About sheet's Sheet scope lists each one. Cases, Violations and Visits contain cases opened in the period; Visits lists every visit on those cases, so a visit date can fall outside the period. Citations and Referrals use the date issued on any counted case, and the inspector filter means the issuing or referring inspector; Citations does not apply the violation type filter. Corrections uses the date each correction was recorded, so it can list cases opened before the period. Violations applies violation type and ordinance to each item; other sheets apply them to the case (any matching item), except Citations, which applies the ordinance to the citation. Area, owner and status always apply to the case, and status is its current status. Numbered report sheets match each report on screen: reports 1 and 3 use the As of date, reports 2 and 4–7 the case opening date, and reports 8–11 the date issued. This report's sheet keeps the table sort and other report sheets use their default order. Print uses the active report presentation. Check the title, date range, applied filters, row order and coverage statement before distributing an export. An invalid date range clears stale report results so an earlier table is not exported as the new request.

**Deposit schedule.** The deposit explorer presents searchable human-readable rules, conditions, effective dates and source details. Pagination limits screen volume; it does not omit the retained schedule. A displayed row may be conditional or require an authorized manual amount. The explorer is not a new court policy.

**Refresh speed.** The helper overlaps at most four read-only file operations per request while retaining independent revision and integrity checks. A slow or stale read never authorizes trusting an older case. Actual City cold/warm performance, long histories, simultaneous users and approved budgets still require measurement.
