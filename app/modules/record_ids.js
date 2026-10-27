/* Existing record-ID suffix generator; native randomness and fallback semantics are retained. */

export function rnd12() {
  const b = new Uint8Array(8);
  if (typeof crypto !== "undefined" && crypto.getRandomValues) crypto.getRandomValues(b);
  else for (let i = 0; i < 8; i++) b[i] = Math.floor(Math.random() * 256);
  return Array.prototype.map.call(b, (x) => ("0" + x.toString(16)).slice(-2)).join("");
}
