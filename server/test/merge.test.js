import assert from 'node:assert/strict'
import { test } from 'node:test'
import { mergeRepeatedMinutes } from '../src/import/merge.js'

const parcel = (over) => ({
  regionName: 'عندان',
  minuteNo: '281',
  ownershipGroup: 'sankari_100',
  kashf16Ref: '61+73',
  isDamaged: false,
  minuteArea: null,
  totalArea: null,
  k16Area: null,
  k16ValueSyp: null,
  k16ValueUsd: null,
  sankariValueUsd: null,
  asaliValueUsd: null,
  notes: null,
  sourceRowStart: 20,
  sourceRowEnd: 32,
  owners: [],
  purchases: [],
  annotations: [],
  ...over,
})

test('a repeated block joins the first one: its rows are kept, its figures are not counted', () => {
  const first = parcel({ totalArea: 55044, minuteArea: 29545, k16ValueUsd: 9528932, k16ValueSyp: 476446600, annotations: [{ seq: 1 }, { seq: 2 }] })
  const second = parcel({ ownershipGroup: 'problem', kashf16Ref: '74', totalArea: 1025, k16ValueUsd: 65600, k16ValueSyp: 3280000, sourceRowStart: 982, sourceRowEnd: 982, annotations: [{ seq: 1 }] })
  const other = parcel({ minuteNo: '5', sourceRowStart: 40, sourceRowEnd: 41 })

  const { parcels, excluded } = mergeRepeatedMinutes([first, other, second])
  assert.equal(parcels.length, 2)
  const main = parcels[0]
  assert.equal(main.totalArea, 55044)
  assert.equal(main.k16ValueUsd, 9528932, 'the first row keeps its own value')
  assert.equal(main.kashf16Ref, '61+73', 'the operation reference is not changed')
  assert.equal(main.ownershipGroup, 'sankari_100')
  assert.equal(main.mergedSourceRows, '982')
  assert.deepEqual(main.annotations.map((a) => a.seq), [1, 2, 3])
  assert.match(main.notes, /صف 982/)
  assert.match(main.notes, /\$65,600/)
  assert.equal(excluded.k16ValueUsd, 65600, 'what was left out is reported so totals can be proven')
  assert.equal(excluded.k16ValueSyp, 3280000)
})

test('same minute number in different regions stays separate', () => {
  const { parcels, excluded } = mergeRepeatedMinutes([parcel({ regionName: 'ماير' }), parcel({ regionName: 'كفر بسين' })])
  assert.equal(parcels.length, 2)
  assert.equal(excluded.k16ValueUsd, 0)
})
