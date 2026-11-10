/* Order-language search and grouping (owner direction 2026-11-10), against the real bundled library: an ordinance is
   matched as a whole section number (exact or narrower), never by digits in wording; parent and sibling sections are
   related and folded; word searches match word beginnings and are ranked; results sit under checklist and group headings
   with Consolidated Order Language first; status badges appear only on the catalog review screen. */
const assert = require("node:assert/strict");
const { compile } = require("../fixtures/equivalence_harness.cjs");

(async () => {
  const api = await compile(
    'export {languageSearch, parseQuery, sectionRelation, canonicalSection, languageMatches} from "./language_search.js"; export {LIBRARY} from "./data/library.js";',
  );
  const { LIBRARY } = api;
  const all = [];
  LIBRARY.forEach((c, ci) => c.groups.forEach((g, gi) => g.items.forEach((it) => all.push({ ...it, ci, gi }))));
  const R = { LIBRARY, effectiveCatalog: (i) => ({ a: i.a, s: i.s }) };
  const cites = (i, wanted) => i.s.some((s) => api.canonicalSection(s) === wanted || api.canonicalSection(s).startsWith(wanted));

  // Section parsing and relations.
  assert.deepEqual(api.parseQuery("27.04(2)(g)"), { sections: ["27.04(2)(g)"], terms: [] });
  assert.deepEqual(api.parseQuery("MGO 27.04 (2) (g) outlet"), { sections: ["27.04(2)(g)"], terms: ["outlet"] });
  assert.deepEqual(api.parseQuery("SPS 321.125(3)"), { sections: ["321.125(3)"], terms: [] });
  assert.deepEqual(api.parseQuery("g 2 trash"), { sections: [], terms: ["2", "trash"] }, "a lone letter is not a search term");
  assert.equal(api.sectionRelation(["27.04(2)(g)"], "27.04(2)(g)"), "match");
  assert.equal(api.sectionRelation(["27.04(2)(i)", "27.04(2)(g)5"], "27.04(2)(g)"), "match", "a narrower part matches");
  assert.equal(api.sectionRelation(["27.04(2)(c)"], "27.04(2)(g)"), "related", "a sibling is related");
  assert.equal(api.sectionRelation(["27.04(2)"], "27.04(2)(g)"), "related", "the parent is related");
  assert.equal(api.sectionRelation(["27.05(2)(g)1"], "27.04(2)(g)"), "", "the same letters in another chapter are unrelated");
  assert.equal(api.sectionRelation(["27.041(1)"], "27.04"), "", "27.041 is not part of 27.04");
  assert.equal(api.sectionRelation(["27.04(2)(g)"], "27.04"), "match");

  // The reported search: only entries citing 27.04(2)(g) (or a narrower part) match; the rest are related or absent.
  const found = api.languageSearch(R, all, "27.04(2)(g)");
  assert.equal(found.matches.length, 14);
  assert.ok(
    found.matches.every((i) => cites(i, "27.04(2)(g)")),
    "every match cites 27.04(2)(g)",
  );
  assert.ok(
    all.filter((i) => cites(i, "27.04(2)(g)")).every((i) => found.matches.includes(i)),
    "every entry citing it is found",
  );
  assert.ok(found.related.length > 0 && found.related.every((i) => !cites(i, "27.04(2)(g)")));
  assert.ok(
    found.related.every((i) => i.s.some((s) => api.canonicalSection(s).startsWith("27.04"))),
    "related entries share 27.04",
  );
  const before = all.filter((i) => {
    const text = [i.t, i.a, ...i.s]
      .join(" ")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ");
    return ["27", "04", "2", "g"].every((t) => text.includes(t));
  });
  assert.ok(before.length > found.matches.length, "the former digit-and-letter search returned " + before.length + " entries");
  const wide = api.languageSearch(R, all, "27.05(2)(c)");
  assert.equal(wide.matches.length, all.filter((i) => cites(i, "27.05(2)(c)")).length);
  assert.ok(wide.matches.length < 20);

  // Words: word beginnings, aliases, ranking by title.
  const smoke = api.languageSearch(R, all, "smoke detector");
  assert.ok(
    smoke.matches.slice(0, 2).every((i) => /smoke/i.test(i.t)),
    "detector finds smoke alarm language, title matches first",
  );
  const handrail = api.languageSearch(R, all, "handrail");
  assert.ok(/handrail/i.test(handrail.matches[0].t), "a title match is ranked first");
  const combined = api.languageSearch(R, all, "27.04(2)(g) outlet");
  assert.ok(combined.matches.length > 0 && combined.matches.every((i) => cites(i, "27.04(2)(g)")));
  assert.deepEqual(api.languageSearch(R, all, "").matches, all, "no query keeps every entry in order");
  assert.equal(api.languageMatches(R, found.matches[0], "27.04(2)(g)"), true);
  assert.equal(api.languageMatches(R, found.related[0], "27.04(2)(g)"), false);
  console.log(
    "PASS order-language search: 27.04(2)(g) returns " +
      found.matches.length +
      " citing entries (was " +
      before.length +
      " mixed results), " +
      found.related.length +
      " related folded; word, alias and ranking rules",
  );
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
