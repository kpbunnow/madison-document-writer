/* Per-owner declarations, not a registry. Construction reads resolvers, never dependencies.
   Call targets and value identities are resolved at their original use checkpoint. */
export function deferredServices(bindings, valueKeys = []) {
  const scope = {},
    values = new Set(valueKeys);
  for (const [key, resolve] of Object.entries(bindings)) {
    const descriptor = { enumerable: true, configurable: true };
    if (values.has(key)) {
      Object.defineProperty(resolve, "name", { value: "get " + key, configurable: true });
      descriptor.get = resolve;
    } else {
      const forward = (...args) => resolve()(...args);
      Object.defineProperty(forward, "name", { value: key, configurable: true });
      descriptor.value = forward;
      descriptor.writable = true;
    }
    Object.defineProperty(scope, key, descriptor);
  }
  return scope;
}
