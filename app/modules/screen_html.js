/* Screen markup only. Values use the existing text escape; raw marks trusted renderer output. */
import { esc } from "./presentation_format.js";
const fragments = new WeakMap();
export function raw(value) {
  const marker = Object.freeze({});
  fragments.set(marker, String(value));
  return marker;
}
function escapedScreenMarkup(strings, ...values) {
  let markup = strings[0];
  values.forEach((value, index) => {
    markup += fragments.has(value) ? fragments.get(value) : esc(value);
    markup += strings[index + 1];
  });
  return markup;
}

// Keep the public tag name while avoiding lexical collisions in retained bundle consumers.
export { escapedScreenMarkup as html };
