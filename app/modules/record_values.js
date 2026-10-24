/* JSON snapshot copying and stable event ordering; no live state, UI or persistence. */
export const clone = (o) => JSON.parse(JSON.stringify(o));

export const byTime = (a, b) => (Date.parse(a.at) || 0) - (Date.parse(b.at) || 0) || (a.id === b.id ? 0 : a.id < b.id ? -1 : 1);

export function caseDetails(k) {
  const copy = clone(k);
  delete copy.savedAt;
  return copy;
}

export function stableJSON(value) {
  return JSON.stringify(value, function (key, v) {
    if (v && typeof v === "object" && !Array.isArray(v)) {
      const out = {};
      Object.keys(v)
        .sort()
        .forEach((k) => (out[k] = v[k]));
      return out;
    }
    return v;
  });
}
