import { LIBRARY } from "./data/library.js";

export function allItems() {
  const out = [];
  LIBRARY.forEach((c, ci) => c.groups.forEach((g, gi) => g.items.forEach((i) => out.push({ ...i, ci, gi, cl: c.name, grp: g.name }))));
  return out;
}
