import assert from 'node:assert/strict'
import { test } from 'node:test'
import { bucketize, quantile, summary } from '../src/stats.js'

test('quantile interpolates and handles empty input', () => {
  assert.equal(quantile([], 0.5), null)
  assert.equal(quantile([5], 0.5), 5)
  assert.equal(quantile([1, 2, 3, 4], 0.5), 2.5)
  assert.equal(quantile([10, 0, 20], 0.5), 10)
  assert.equal(quantile([1, 2, 3, 4, 5], 0.25), 2)
})

test('summary of a list and of nothing', () => {
  assert.deepEqual(summary([]), { n: 0, min: null, p25: null, median: null, p75: null, max: null, mean: null })
  const s = summary([2, 4, 6])
  assert.equal(s.n, 3)
  assert.equal(s.median, 4)
  assert.equal(s.mean, 4)
  assert.equal(s.min, 2)
  assert.equal(s.max, 6)
})

test('bucketize puts each value in the first matching bucket', () => {
  const buckets = [
    ['neg', 'قبل', (d) => d < 0],
    ['lt10', 'حتى 10', (d) => d <= 10],
    ['more', 'أكثر', () => true],
  ]
  const out = bucketize([-5, 0, 10, 11, 100], buckets)
  assert.deepEqual(out.map((b) => b.count), [1, 2, 2])
  assert.equal(out[0].label, 'قبل')
})
