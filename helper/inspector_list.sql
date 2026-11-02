-- Fixed read-only query: the people who have open enforcement cases assigned to them.
-- Derived from the division's Open_Enforcement_Cases report (InspectorList dataset, last modified 2026-11-01).
-- The open-case rules below must stay identical to inspector_cases.sql. The report's hard-coded staff
-- exclusions are not applied here; the helper applies the administrator's excludeInspectors setting.
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
    LTRIM(RTRIM(r.ASSIGNED_USERID))                          AS UserId,
    COALESCE(un.FullName, LTRIM(RTRIM(r.ASSIGNED_USERID)))   AS InspectorName,
    COUNT(*)                                                 AS OpenCases
FROM AccelaReporting.dbo.BI_ENF_RECORD AS r
LEFT JOIN UserNames AS un
       ON un.UserId = LTRIM(RTRIM(r.ASSIGNED_USERID))
WHERE r.RECORD_ID LIKE 'CB%'
  AND LTRIM(RTRIM(r.ASSIGNED_USERID)) <> ''
  AND r.RECORD_STATUS NOT LIKE '%Close%'
  AND r.RECORD_STATUS NOT LIKE '%Compliance%'
  AND r.RECORD_STATUS NOT IN ('No Violation', 'Void', 'Withdrawn')
GROUP BY LTRIM(RTRIM(r.ASSIGNED_USERID)),
         COALESCE(un.FullName, LTRIM(RTRIM(r.ASSIGNED_USERID)))
ORDER BY InspectorName;
