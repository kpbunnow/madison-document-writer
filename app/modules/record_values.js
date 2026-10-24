/* JSON snapshot copying and stable event ordering; no live state, UI or persistence. */
export const clone = (o) => JSON.parse(JSON.stringify(o));

export const byTime = (a, b) => (Date.parse(a.at) || 0) - (Date.parse(b.at) || 0) || (a.id === b.id ? 0 : a.id < b.id ? -1 : 1);
