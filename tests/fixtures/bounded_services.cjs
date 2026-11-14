/* Bounded peers for owner workflow fixtures. `bound` holds the test's implementation of each peer, which the test may
   replace at any time; owners call `peer(name)` when they need it, so the current binding is read at call time. A peer
   with no binding fails naming itself, so a scenario's real dependencies are always explicit. */
module.exports = function createBoundedServices(defaults = {}) {
  const bound = { ...defaults },
    calls = [];
  const peer = (name) =>
    function (...args) {
      calls.push(name);
      if (typeof bound[name] !== "function") throw new Error("owner workflow: unbounded service " + name);
      return bound[name](...args);
    };
  // A grouped peer: each member is bounded separately (bound["A11Y.utility"], ...).
  const group = (name) => new Proxy({}, { get: (_, key) => (typeof key === "string" ? peer(name + "." + key) : undefined) });
  // Named real members, with every other member of the group bounded.
  const partial = (name, real) =>
    new Proxy(real, { get: (target, key) => (key in target ? target[key] : typeof key === "string" ? peer(name + "." + key) : undefined) });
  return { bound, calls, peer, group, partial };
};
