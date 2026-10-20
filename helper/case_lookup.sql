SELECT
    r.RECORD_ID                    AS CaseNumber,
    r.[ADDR_FULL_LINE#]            AS SiteAddress,
    r.APO_PARCEL_NUMBER            AS ParcelNumber,
    r.PARCEL_OWNER_Name            AS OwnerName,
    r.PARCEL_OWNER_Address         AS OwnerAddress,
    r.ASI_CASE_DESCRIPTION         AS CaseDescription,
    r.DESCRIPTION                  AS DetailedDescription,
    r.RECORD_TYPE_CATEGORY         AS RecordCategory,
    r.ZONING_DISTRICT               AS ZoningDistrict,
    CASE
        WHEN r.ZONING_DISTRICT LIKE '%HIS-MH%'
          OR r.ZONING_DISTRICT LIKE '%HIS-TL%'
          OR r.ZONING_DISTRICT LIKE '%HIS-UH%'
          OR r.ZONING_DISTRICT LIKE '%HIS-MB%'
          OR r.ZONING_DISTRICT LIKE '%HIS-FS%'
        THEN 'Yes' ELSE 'No'
    END                             AS HistoricDistrict,
    CASE
        WHEN r.ZONING_DISTRICT LIKE '%HIS-MH%' THEN 'Mansion Hill'
        WHEN r.ZONING_DISTRICT LIKE '%HIS-TL%' THEN 'Third Lake Ridge'
        WHEN r.ZONING_DISTRICT LIKE '%HIS-UH%' THEN 'University Heights'
        WHEN r.ZONING_DISTRICT LIKE '%HIS-MB%' THEN 'Marquette Bungalows'
        WHEN r.ZONING_DISTRICT LIKE '%HIS-FS%' THEN 'First Settlement'
        ELSE NULL
    END                             AS HistoricDistrictName,
    CASE WHEN r.ZONING_DISTRICT LIKE '%HIS-L%' THEN 'Yes' ELSE 'No' END AS IndividualLandmark,
    r.LANDMARK                     AS Landmark,
    insp.INSP_DATE_INSPECTION      AS InspectionDate,
    insp.INSP_DATE_SCHEDULED       AS InspectionScheduledDate,
    insp.INSPECTION_TYPE           AS InspectionType,
    insp.INSP_STATUS               AS InspectionStatus,
    insp.TIME_INSPECTION           AS InspectionTime,
    LTRIM(RTRIM(
        ISNULL(insp.INSPECTOR_NAME_F, '') + ' ' + ISNULL(insp.INSPECTOR_NAME_L, '')
    ))                              AS InspectorName
FROM dbo.BI_ENF_RECORD AS r
LEFT JOIN dbo.BI_ENF_INSPECTION AS insp
       ON insp.RECORD_ID = r.RECORD_ID
WHERE r.RECORD_ID = @CaseNumber
ORDER BY insp.INSP_DATE_INSPECTION;
