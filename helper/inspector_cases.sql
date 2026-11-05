-- Fixed read-only query: the open enforcement cases assigned to one user ID (@UserId).
-- Derived from the division's Open_Enforcement_Cases report (DataSet1, last modified 2026-11-01). The report
-- selects by display name; this selects by Accela user ID, and the hard-coded staff exclusions are applied by
-- the helper from the administrator's excludeInspectors setting.
-- Only what the list shows is returned: the case number, the address (up to the first comma) and the detailed
-- description. The open-case rules in the WHERE clause must stay identical to inspector_list.sql.
SELECT
    LTRIM(RTRIM(r.ASSIGNED_USERID))        AS UserId,
    r.RECORD_ID                            AS CaseNumber,
    CASE WHEN CHARINDEX(',', r.[ADDR_FULL_LINE#]) > 0
         THEN LTRIM(RTRIM(LEFT(r.[ADDR_FULL_LINE#],
                               CHARINDEX(',', r.[ADDR_FULL_LINE#]) - 1)))
         ELSE r.[ADDR_FULL_LINE#]
    END                                    AS ShortAddress,
    r.DESCRIPTION                          AS CaseDescription
FROM dbo.BI_ENF_RECORD AS r
WHERE r.RECORD_ID LIKE 'CB%'
  AND LTRIM(RTRIM(r.ASSIGNED_USERID)) <> ''
  AND r.RECORD_STATUS NOT LIKE '%Close%'
  AND r.RECORD_STATUS NOT LIKE '%Compliance%'
  AND r.RECORD_STATUS NOT IN ('No Violation', 'Void', 'Withdrawn')
  AND LTRIM(RTRIM(r.ASSIGNED_USERID)) = @UserId
ORDER BY r.DATE_OPENED_ORIGINAL ASC;
