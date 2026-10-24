/* One feature listener per target and stable key; importing this module never registers anything. */
const registeredEvents = new WeakMap();
export function registerEventOnce(target, key, type, listener, options) {
  let keys = registeredEvents.get(target);
  if (keys?.has(key)) return false;
  target.addEventListener(type, listener, options);
  if (!keys) registeredEvents.set(target, (keys = new Set()));
  keys.add(key);
  return true;
}
