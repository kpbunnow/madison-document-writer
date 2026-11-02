-- Fixed read-only query: the people who have open enforcement cases assigned to them.
-- Derived from the division's Open_Enforcement_Cases report (InspectorList dataset, last modified 2026-11-01).
-- The open-case rules below must stay identical to inspector_cases.sql. The report's hard-coded staff
-- exclusions are not applied here; the helper applies the administrator's excludeInspectors setting.
-- Display names come only from the two workflow views and only for people who have open cases: scanning the
-- inspection view for names as well took about 25 seconds in the City database. A person with no name there
-- is shown by user ID.
WITH Assigned AS (
    SELECT LTRIM(RTRIM(r.ASSIGNED_USERID)) AS UserId, COUNT(*) AS OpenCases
    FROM AccelaReporting.dbo.BI_ENF_RECORD AS r
    WHERE r.RECORD_ID LIKE 'CB%'
      AND LTRIM(RTRIM(r.ASSIGNED_USERID)) <> ''
      AND r.RECORD_STATUS NOT LIKE '%Close%'
      AND r.RECORD_STATUS NOT LIKE '%Compliance%'
      AND r.RECORD_STATUS NOT IN ('No Violation', 'Void', 'Withdrawn')
    GROUP BY LTRIM(RTRIM(r.ASSIGNED_USERID))
),
WorkflowNames AS (
    SELECT UserId, MAX(FullName) AS FullName
    FROM (
        SELECT LTRIM(RTRIM([ASSIGNED_USERID#]))      AS UserId,
               LTRIM(RTRIM([ASSIGNED_NAME_FML#]))    AS FullName
        FROM AccelaReporting.dbo.BI_ENF_WORKFLOW
        UNION ALL
        SELECT LTRIM(RTRIM([ASSIGNED_USERID#])),
               LTRIM(RTRIM([ASSIGNED_NAME_FML#]))
        FROM AccelaReporting.dbo.BI_ENF_WORKFLOW_HISTORY
    ) AS src
    WHERE UserId IN (SELECT UserId FROM Assigned)
      AND FullName IS NOT NULL AND FullName <> ''
    GROUP BY UserId
)
SELECT
    a.UserId                                 AS UserId,
    COALESCE(w.FullName, a.UserId)           AS InspectorName,
    a.OpenCases                              AS OpenCases
FROM Assigned AS a
LEFT JOIN WorkflowNames AS w
       ON w.UserId = a.UserId
ORDER BY InspectorName;
