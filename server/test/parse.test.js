import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  categorize,
  findDates,
  landStatus,
  minuteBase,
  ownershipGroup,
  parseDateCell,
  parseTarget,
  parseTiming,
  parseTransfer,
  purchaseChannel,
  serialToIso,
} from '../src/import/parse.js'

test('Excel serials convert to ISO dates', () => {
  assert.equal(serialToIso(39686), '2008-08-26')
  assert.equal(serialToIso(40155), '2009-12-08')
})

test('date cells: serial, bare year, text with several dates', () => {
  assert.deepEqual(parseDateCell(39686), { date: '2008-08-26', year: 2008, raw: null })
  assert.deepEqual(parseDateCell(2008), { date: null, year: 2008, raw: null })
  assert.deepEqual(parseDateCell('13-1-2008'), { date: '2008-01-13', year: 2008, raw: '13-1-2008' })
  assert.equal(parseDateCell('15-2-2007   \r\n14-3-2007  \r\n 24-9-2007').date, '2007-02-15')
  assert.deepEqual(parseDateCell('2006'), { date: null, year: 2006, raw: '2006' })
  assert.deepEqual(parseDateCell(null), { date: null, year: null, raw: null })
  assert.equal(parseDateCell('مباعه لفريد جواله من قبل العسلي').date, null)
})

test('findDates reads both d-m-y and y-m-d and rejects impossible dates', () => {
  assert.deepEqual(findDates('2008-1-28 حكم 2008-09-16 فراغة'), ['2008-01-28', '2008-09-16'])
  assert.deepEqual(findDates('29/1/2007'), ['2007-01-29'])
  assert.deepEqual(findDates('31-2-2008'), [])
})

test('transfer cell: judgment, transfer or both', () => {
  assert.deepEqual(parseTransfer('فراغة 10-6-2008'), {
    method: 'transfer',
    transferDate: '2008-06-10',
    judgmentDate: null,
    raw: 'فراغة 10-6-2008',
  })
  const both = parseTransfer('2008-1-28 حكم \r\n2008-09-16 فراغة')
  assert.equal(both.method, 'judgment_then_transfer')
  assert.equal(both.judgmentDate, '2008-01-28')
  assert.equal(both.transferDate, '2008-09-16')
  assert.equal(parseTransfer('حكم 25-6-2008').method, 'judgment')
  assert.equal(parseTransfer(null).method, null)
})

test('annotation category: sheet type wins, otherwise derived from the text', () => {
  assert.deepEqual(categorize('x', 'تحكيم'), { code: 'arbitration', source: 'sheet' })
  assert.deepEqual(categorize('دعوى تحكيمية', null), { code: 'arbitration', source: 'derived' })
  assert.equal(categorize('فسخ تسجيل لمصلحة د. سنكري', null).code, 'cancellation')
  assert.equal(categorize('حل وتصفية شركة لمصلحة د. سنكري', null).code, 'liquidation')
  assert.equal(categorize('منع تصرف لصالح محافظ حلب', null).code, 'security')
  assert.equal(categorize('فلان الفلاني', null).code, 'private_claim')
})

test('target party and shares', () => {
  assert.deepEqual(parseTarget('د. سنكري 1800 سهم و عسلي 600 سهم'), { party: 'both', shares: 2400 })
  assert.deepEqual(parseTarget('عسلي 2400 سهم / د. سنكري وعسلي'), { party: 'asali', shares: 2400 })
  assert.deepEqual(parseTarget('عسلي'), { party: 'asali', shares: null })
  assert.deepEqual(parseTarget('فلانة الفلانية 2272.249 سهم'), { party: 'other', shares: 2272.249 })
  assert.deepEqual(parseTarget(null), { party: null, shares: null })
})

test('timing, channel, status, ownership group, minute number', () => {
  assert.equal(parseTiming('بعد الفراغة لـ د. سنكري'), 'after_transfer')
  assert.equal(parseTiming('قبل الحكم لـ د. سنكري'), 'before_judgment')
  assert.equal(parseTiming('قبل الشراء'), 'before_purchase')
  assert.equal(purchaseChannel('فلان الفلاني (دلال)'), 'broker')
  assert.equal(purchaseChannel('فلان الفلاني (وكيل)'), 'agent')
  assert.equal(purchaseChannel('فلان الفلاني عن عسلي'), 'agent')
  assert.equal(purchaseChannel('رياض عسلي'), 'principal')
  assert.equal(purchaseChannel('لايوجد عقد / التاريخ من المحاسبة'), 'accounting')
  assert.equal(landStatus('اميري /التمام'), 'full')
  assert.equal(landStatus('اميري / الشيوع'), 'joint')
  assert.equal(ownershipGroup('د. سنكري 75% + عسلي 25%'), 'joint_75_25')
  assert.equal(ownershipGroup('أراضي ذات مشاكل'), 'problem')
  assert.equal(ownershipGroup(null), 'unclassified')
  assert.equal(minuteBase('71 / 16+33+35+36 متضرر'), 71)
  assert.equal(minuteBase(1431), 1431)
})
