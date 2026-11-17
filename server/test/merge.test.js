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

test('a repeated block with its own Kashf 16 number joins the first one and becomes an operation line', () => {
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
  assert.equal(excluded.k16ValueUsd, 0, 'the value is kept as an operation line, so nothing is left out')
  assert.equal(main.operationLines.length, 1)
  assert.deepEqual(
    { ref: main.operationLines[0].kashf16Ref, usd: main.operationLines[0].k16ValueUsd, syp: main.operationLines[0].k16ValueSyp, row: main.operationLines[0].sourceRow, group: main.operationLines[0].ownershipGroup },
    { ref: '74', usd: 65600, syp: 3280000, row: 982, group: 'problem' },
  )
  assert.match(main.notes, /عملية شراء مستقلة/)
})

test('same minute number in different regions stays separate', () => {
  const { parcels, excluded } = mergeRepeatedMinutes([parcel({ regionName: 'ماير' }), parcel({ regionName: 'كفر بسين' })])
  assert.equal(parcels.length, 2)
  assert.equal(excluded.k16ValueUsd, 0)
})

test('a repeated block with the same Kashf 16 number is not a new operation: its figures are left out', () => {
  const first = parcel({ k16ValueUsd: 1000, annotations: [{ seq: 1 }] })
  const again = parcel({ k16ValueUsd: 500, sourceRowStart: 90, sourceRowEnd: 90 })
  const { parcels, excluded } = mergeRepeatedMinutes([first, again])
  assert.equal(parcels.length, 1)
  assert.equal(parcels[0].operationLines.length, 0)
  assert.equal(excluded.k16ValueUsd, 500)
})
