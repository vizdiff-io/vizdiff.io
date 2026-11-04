// Regression coverage for the Yarn patch: deepmerge has no upstream release fixing
// prototype poisoning (https://github.com/advisories/GHSA-gcqx-w48m-w2h4).
const assert = require("node:assert/strict")
const merge = require("deepmerge")
const payload = JSON.parse('{"__proto__":{"poisoned":true},"safe":1}')
for (const result of [merge(payload, {}), merge(Object.create(null), payload)]) {
  assert.equal(result.poisoned, undefined)
  assert.equal(Object.getPrototypeOf(result), Object.prototype)
  assert.equal(result.safe, 1)
}
assert.deepEqual(merge({ nested: { a: 1 }, items: [1] }, { nested: { b: 2 }, items: [2] }), {
  nested: { a: 1, b: 2 },
  items: [1, 2],
})
