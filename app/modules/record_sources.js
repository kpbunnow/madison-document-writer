/* Frozen/correction precedence with an explicit fallback case list; never reads live workspace state. */
import { frozenOf, isSnowCase } from "./document_rules.js";
import { SNOW_TYPE } from "./document_types.js";

export const recordCase = (d, cases) =>
  (d && d.correction && d.correction.case) || (frozenOf(d) && frozenOf(d).case) || cases.find((k) => k.id === (d && d.caseId)) || {};
export const isSnowDocument = (d, cases) => !!d && (d.caseType === SNOW_TYPE || isSnowCase(recordCase(d, cases)));
