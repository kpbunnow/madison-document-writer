-- Fixed read-only query: full names for Accela user IDs, from the inspection view.
-- Run only after the inspector list is on screen, to replace the user IDs shown for people whose name is not in
-- the workflow views. Scanning the inspection view takes several seconds in the City database, so the inspector
-- list itself does not wait for it.
SELECT UserId, MAX(FullName) AS InspectorName
FROM (
    SELECT LTRIM(RTRIM(INSPECTOR_USERID))        AS UserId,
           LTRIM(RTRIM([INSPECTOR_NAME_FML#]))   AS FullName
    FROM AccelaReporting.dbo.BI_ENF_INSPECTION
) AS src
WHERE UserId IS NOT NULL AND UserId <> ''
  AND FullName IS NOT NULL AND FullName <> ''
GROUP BY UserId;
