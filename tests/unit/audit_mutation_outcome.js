/* A failed mutation test must actually have run: a timeout/signal/spawn failure is inconclusive. */
const assert = require("node:assert/strict");
const { normalOutcome, compileOwner } = require("../fixtures/mutation_outcome.cjs");
for (const result of [
  { status: null, signal: "SIGTERM" },
  { status: null, signal: null },
  { status: null, signal: null, error: Object.assign(new Error("timeout"), { code: "ETIMEDOUT" }) },
  { status: null, signal: null, error: Object.assign(new Error("spawn failed"), { code: "ENOENT" }) },
])
  assert.throws(() => normalOutcome(result, "probe"));
assert.equal(normalOutcome({ status: 0, signal: null }, "clean"), 0);
assert.equal(normalOutcome({ status: 1, signal: null }, "mutation"), 1);
console.log("PASS mutation results refuse timeouts, signals and spawn failures; normal pass/fail outcomes retained");

assert.throws(() => compileOwner("return ???"), /Invalid owner bundle:/);
const evaluate = compileOwner('throw new SyntaxError("runtime parsing failure")');
assert.throws(() => evaluate(), /runtime parsing failure/);

const createBoundedServices = require("../fixtures/bounded_services.cjs");
const services = createBoundedServices();
for (const name of ["constructor", "toString", "missing"]) assert.throws(() => services.peer(name)(), /unbounded service/);
const partial = services.partial("ui", { known: () => "real" });
assert.equal(partial.known(), "real");
for (const name of ["constructor", "toString", "missing"]) assert.throws(() => partial[name](), /unbounded service/);
services.bound.toString = () => "explicit";
assert.equal(services.peer("toString")(), "explicit");
const live = services.peer("port");
services.bound.port = () => "first";
assert.equal(live(), "first");
services.bound.port = () => "second";
assert.equal(live(), "second");
