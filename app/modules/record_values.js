// @ts-check
/* JSON snapshot copying and stable event ordering; no live state, UI or persistence. */
/** @template T @param {T} o @returns {T} */
export const clone = (o) => JSON.parse(JSON.stringify(o));

/** @param {{at:string,id:string}} a @param {{at:string,id:string}} b */
export const byTime = (a, b) => (Date.parse(a.at) || 0) - (Date.parse(b.at) || 0) || (a.id === b.id ? 0 : a.id < b.id ? -1 : 1);

/** @param {Record<string, unknown>} k @returns {Record<string, unknown>} */
export function caseDetails(k) {
  const copy = clone(k);
  delete copy.savedAt;
  return copy;
}

/** @param {unknown} value @returns {string} */
export function stableJSON(value) {
  return JSON.stringify(value, function (/** @type {string} */ key, /** @type {unknown} */ v) {
    if (v && typeof v === "object" && !Array.isArray(v)) {
      /** @type {Record<string, unknown>} */
      const out = {};
      Object.keys(v)
        .sort()
        .forEach((k) => (out[k] = Reflect.get(v, k)));
      return out;
    }
    return v;
  });
}
