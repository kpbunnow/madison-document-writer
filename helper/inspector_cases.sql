-- Fixed read-only query: the open enforcement cases assigned to one user ID (@UserId).
-- Derived from the division's Open_Enforcement_Cases report (DataSet1, last modified 2026-11-01). The report
-- selects by display name; this selects by Accela user ID, and the hard-coded staff exclusions are applied by
-- the helper from the administrator's excludeInspectors setting. The columns after DateOpened add the parcel,
-- owner, record category and the latest inspection so the list can say what an import will find.
-- The open-case rules in the WHERE clause must stay identical to inspector_list.sql.
WITH UserNames AS (
    SELECT UserId, MAX(FullName) AS FullName
    FROM (
        SELECT LTRIM(RTRIM(INSPECTOR_USERID))        AS UserId,
               LTRIM(RTRIM([INSPECTOR_NAME_FML#]))   AS FullName
        FROM AccelaReporting.dbo.BI_ENF_INSPECTION
        UNION ALL
        SELECT LTRIM(RTRIM([ASSIGNED_USERID#])),
               LTRIM(RTRIM([ASSIGNED_NAME_FML#]))
        FROM AccelaReporting.dbo.BI_ENF_WORKFLOW
        UNION ALL
        SELECT LTRIM(RTRIM([ASSIGNED_USERID#])),
               LTRIM(RTRIM([ASSIGNED_NAME_FML#]))
        FROM AccelaReporting.dbo.BI_ENF_WORKFLOW_HISTORY
    ) AS src
    WHERE UserId IS NOT NULL AND UserId <> ''
      AND FullName IS NOT NULL AND FullName <> ''
    GROUP BY UserId
)
SELECT
    COALESCE(un.FullName, LTRIM(RTRIM(r.ASSIGNED_USERID))) AS AssignedInspector,
    LTRIM(RTRIM(r.ASSIGNED_USERID))        AS UserId,
    r.RECORD_ID                            AS CaseNumber,
    CASE WHEN CHARINDEX(',', r.[ADDR_FULL_LINE#]) > 0
         THEN LTRIM(RTRIM(LEFT(r.[ADDR_FULL_LINE#],
                               CHARINDEX(',', r.[ADDR_FULL_LINE#]) - 1)))
         ELSE r.[ADDR_FULL_LINE#]
    END                                    AS ShortAddress,
    r.APO_PARCEL_NUMBER                    AS ParcelNumber,
    r.PARCEL_OWNER_Name                    AS OwnerName,
    r.RECORD_TYPE_CATEGORY                 AS RecordCategory,
    r.DESCRIPTION                          AS CaseDescription,
    r.RECORD_STATUS                        AS Status,
    r.DATE_OPENED_ORIGINAL                 AS DateOpened,
    li.INSPECTION_TYPE                     AS LatestInspectionType,
    li.INSP_STATUS                         AS LatestInspectionStatus,
    li.INSP_DATE_INSPECTION                AS LatestInspectionDate,
    li.INSP_DATE_SCHEDULED                 AS LatestScheduledDate
FROM AccelaReporting.dbo.BI_ENF_RECORD AS r
LEFT JOIN UserNames AS un
       ON un.UserId = LTRIM(RTRIM(r.ASSIGNED_USERID))
OUTER APPLY (
    SELECT TOP 1 i.INSPECTION_TYPE, i.INSP_STATUS, i.INSP_DATE_INSPECTION, i.INSP_DATE_SCHEDULED
    FROM AccelaReporting.dbo.BI_ENF_INSPECTION AS i
    WHERE i.RECORD_ID = r.RECORD_ID
    ORDER BY COALESCE(i.INSP_DATE_INSPECTION, i.INSP_DATE_SCHEDULED) DESC, i.INSP_DATE_SCHEDULED DESC
) AS li
WHERE r.RECORD_ID LIKE 'CB%'
  AND LTRIM(RTRIM(r.ASSIGNED_USERID)) <> ''
  AND r.RECORD_STATUS NOT LIKE '%Close%'
  AND r.RECORD_STATUS NOT LIKE '%Compliance%'
  AND r.RECORD_STATUS NOT IN ('No Violation', 'Void', 'Withdrawn')
  AND LTRIM(RTRIM(r.ASSIGNED_USERID)) = @UserId
ORDER BY r.DATE_OPENED_ORIGINAL ASC;
