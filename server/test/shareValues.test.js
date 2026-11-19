import assert from 'node:assert/strict'
import { test } from 'node:test'
import { splitByShares } from '../src/import/shareValues.js'

const base = { k16ValueUsd: null, totalShares: null, sankariShares: null, asaliShares: null, ownershipGroup: 'joint_75_25', sankariValueUsd: null, asaliValueUsd: null }

test('a joint parcel splits the value by its exact shares, not by 75/25', () => {
  const result = splitByShares({ ...base, k16ValueUsd: 131130, totalShares: 115.819, sankariShares: 86.864, asaliShares: 28.955, sankariValueUsd: 98347.5, asaliValueUsd: 32782.5 })
  assert.equal(result.fromShares, true)
  assert.equal(result.sankariValueUsd, 98347.217)
  assert.equal(result.asaliValueUsd, 32782.783)
})

test('whole shares give the usual 75% and 25%', () => {
  const result = splitByShares({ ...base, k16ValueUsd: 251100, totalShares: 2400, sankariShares: 1800, asaliShares: 600 })
  assert.equal(result.sankariValueUsd, 188325)
  assert.equal(result.asaliValueUsd, 62775)
})

test('full ownership by one party gives the whole value to it', () => {
  const result = splitByShares({ ...base, ownershipGroup: 'sankari_100', k16ValueUsd: 1000, totalShares: 2400, sankariShares: 2400, asaliShares: null })
  assert.equal(result.sankariValueUsd, 1000)
  assert.equal(result.asaliValueUsd, null)
})

test('shares that contradict the ownership label keep the sheet figures and are flagged', () => {
  const result = splitByShares({ ...base, k16ValueUsd: 259970, totalShares: 2400, sankariShares: null, asaliShares: 2400, sankariValueUsd: 194977.5, asaliValueUsd: 64992.5 })
  assert.equal(result.conflict, true)
  assert.equal(result.fromShares, false)
  assert.equal(result.sankariValueUsd, 194977.5)
  assert.equal(result.asaliValueUsd, 64992.5)
})

test('shares that do not add up to the total are flagged', () => {
  const result = splitByShares({ ...base, k16ValueUsd: 1000, totalShares: 2400, sankariShares: 1800, asaliShares: 500, sankariValueUsd: 750, asaliValueUsd: 250 })
  assert.equal(result.conflict, true)
  assert.equal(result.sankariValueUsd, 750)
})

test('without shares or a value the sheet figures stay and nothing is flagged', () => {
  const noShares = splitByShares({ ...base, k16ValueUsd: 500, sankariValueUsd: 500 })
  assert.equal(noShares.fromShares, false)
  assert.equal(noShares.conflict, false)
  assert.equal(noShares.sankariValueUsd, 500)
  const noValue = splitByShares({ ...base, totalShares: 2400, sankariShares: 1800, asaliShares: 600 })
  assert.equal(noValue.fromShares, false)
  assert.equal(noValue.sankariValueUsd, null)
})
