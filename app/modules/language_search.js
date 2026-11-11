/* Order-language search. An ordinance in the query (27.04(2)(g), MGO 27.05, SPS 321.125) is compared with each entry's
   cited sections as a whole section number: an entry matches when it cites that section or a narrower part of it
   (27.04(2)(g)5). Entries citing the parent or a sibling section (27.04(2), 27.04(2)(c)) are related, not matches.
   Digits inside wording never match an ordinance. Other words match the start of a word in the entry, and matches are
   ranked: title first, then ordinance and checklist names, then wording and guidance. */

const ALIASES = [
  ["trash", "garbage", "rubbish", "refuse", "debris"],
  ["handrail", "railing", "banister"],
  ["sidewalk", "walkway"],
  ["feces", "faeces"],
  ["detector", "alarm"],
  ["outlet", "receptacle"],
];
// A section number: digits, a dot and digits, then any number of parenthesized parts and an optional trailing digit run.
const CITATION = /(?:\b(?:mgo|sps)\s*|§\s*)?(\d+\.\d+[a-z]?(?:\([a-z0-9]+\))*\d*)/gi;

const words = (value) =>
  String(value || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean);

/* One cited section in a comparable form: lower case, no spaces, no MGO/SPS/§ prefix and no trailing period. */
export function canonicalSection(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/^(?:mgo|sps|§|sec\.?|section)+/, "")
    .replace(/\.+$/, "");
}

// The query split into ordinances and remaining words; spaces inside parentheses are closed up first.
export function parseQuery(query) {
  const compact = String(query || "")
    .replace(/\s*\(\s*/g, "(")
    .replace(/\s*\)/g, ")");
  const sections = [];
  const rest = compact.replace(CITATION, (whole, section) => {
    sections.push(canonicalSection(section));
    return " ";
  });
  const terms = words(rest.replace(/\b(?:mgo|sps|section|sec)\b/gi, " ")).filter((term) => term.length > 1 || /\d/.test(term));
  return { sections, terms };
}

// Whether `inner` is `outer` itself or a narrower part of it: 27.04(2)(g) within 27.04(2), 27.04(2)(g)5 within 27.04(2)(g).
function within(inner, outer) {
  if (inner === outer) return true;
  if (!inner.startsWith(outer)) return false;
  const next = inner[outer.length];
  return next === "(" || (outer.endsWith(")") && /[a-z0-9]/.test(next));
}

// The section one level up: 27.04(2)(g) -> 27.04(2); 27.04(2)(g)5 -> 27.04(2)(g); 27.04 has none.
function parent(section) {
  const trailing = section.match(/^(.*\))\d+$/);
  if (trailing) return trailing[1];
  const paren = section.match(/^(.*)\([a-z0-9]+\)$/);
  return paren ? paren[1] : "";
}

/* "match" when the entry cites the section or a narrower part, "related" when it cites the parent, a sibling or a broader
   section, otherwise "". */
export function sectionRelation(cited, wanted) {
  const list = cited.map(canonicalSection).filter(Boolean);
  if (list.some((s) => within(s, wanted))) return "match";
  const up = parent(wanted);
  if (list.some((s) => within(wanted, s) || (up && within(s, up)))) return "related";
  return "";
}

function fields(R, item) {
  const e = R.effectiveCatalog(item),
    c = R.LIBRARY[item.ci],
    g = c.groups[item.gi];
  return {
    sections: e.s || [],
    weighted: [
      [3, words(item.t)],
      [2, words([...(e.s || []), c.name, c.code, g.name, g.code, item.catalogId].join(" "))],
      [1, words([e.a, item.fillIn, item.guidance, item.synonyms].join(" "))],
    ],
  };
}

// The score of one word: the heaviest field holding a word that starts with it (or an alias); 0 when none does.
function termChoices(term) {
  const singular = term.length > 4 && term.endsWith("s") ? term.slice(0, -1) : term;
  return ALIASES.find((group) => group.includes(singular)) || [term, singular];
}

/* Screen highlighting uses the same ordinary-term aliases as matching; eligibility/ranking is unchanged. */
export function languageHighlightTerms(query) {
  const { sections, terms } = parseQuery(query);
  return [...sections, ...terms.flatMap(termChoices)];
}

function termScore(weighted, term) {
  const choices = termChoices(term);
  let best = 0;
  for (const [weight, list] of weighted) if (weight > best && list.some((w) => choices.some((c) => w.startsWith(c)))) best = weight;
  return best;
}

/* The entries that match the query, ranked, and (for an ordinance) the related entries. With no query everything
   matches in library order. */
export function languageSearch(R, items, query) {
  const { sections, terms } = parseQuery(query);
  if (!sections.length && !terms.length) return { matches: items.slice(), related: [], sections };
  const matches = [],
    related = [];
  items.forEach((item, order) => {
    const f = fields(R, item);
    let score = 0;
    for (const term of terms) {
      const s = termScore(f.weighted, term);
      if (!s) return;
      score += s;
    }
    let tier = "match";
    for (const wanted of sections) {
      const relation = sectionRelation(f.sections, wanted);
      if (!relation) return;
      if (relation === "related") tier = "related";
      else score += 4;
    }
    (tier === "match" ? matches : related).push({ item, score, order });
  });
  const ranked = (list) => list.sort((a, b) => b.score - a.score || a.order - b.order).map((x) => x.item);
  return { matches: ranked(matches), related: ranked(related), sections };
}

// Whether one entry matches the query (ordinance matches only, not related entries).
export function languageMatches(R, item, query) {
  return languageSearch(R, [item], query).matches.length === 1;
}
