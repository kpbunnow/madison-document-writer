// @ts-check
/** @typedef {{id:string,at:string,by?:string,type:string,payload:Record<string,unknown>}} CaseEvent */
/** @typedef {{id:string,number:string,address?:string,owner?:string,[key:string]:unknown}} CaseIdentity */
/** @typedef {{format:'madison-case-file',schema:4|5,case:CaseIdentity,events:CaseEvent[],inspectors:Record<string,unknown>[]}} CaseFile */
/** @typedef {{name:string,file:CaseFile,baseRevision:string,baseCase:CaseIdentity|null,idempotencyEvent?:string}} CaseStoreRequest */
/** @typedef {{ok:true,file:CaseFile,name:string,revision:string}|{ok:false,error:string,missing?:boolean}} CaseStoreResult */
/** @param {string} id @param {string} at @param {string} by @param {string} type @param {Record<string,unknown>} payload @returns {CaseEvent} */
export function makeEvent(id, at, by, type, payload) {
  return { id, at, by, type, payload };
}
/** Preserve the existing transport shape; validation remains in the helper.
 * @param {CaseStoreRequest} request @returns {CaseStoreRequest} */
export function caseStoreRequest(request) {
  return request;
}

/** @typedef {{report:string,ci:number,dir:1|-1}} ReportSort */
/** Normalize optional preference sort without changing case/report records.
 * @param {unknown} value @param {string} report @returns {ReportSort|null} */
export function reportSort(value, report) {
  if (!value || typeof value !== "object" || !("report" in value) || !("ci" in value) || !("dir" in value)) return null;
  return value.report === report &&
    typeof value.ci === "number" &&
    Number.isInteger(value.ci) &&
    value.ci >= 0 &&
    (value.dir === 1 || value.dir === -1)
    ? { report, ci: value.ci, dir: value.dir }
    : null;
}
