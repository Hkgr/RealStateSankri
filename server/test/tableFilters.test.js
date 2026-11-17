import assert from 'node:assert/strict'
import { test } from 'node:test'
import { annotationTableClause, likeTerm, parcelTableClause, searchTerms } from '../src/tableFilters.js'

test('LIKE wildcards typed by the user are searched literally', () => {
  assert.equal(likeTerm('50%'), '%50\\%%')
  assert.equal(likeTerm('a_b'), '%a\\_b%')
  assert.equal(likeTerm('x\\y'), '%x\\\\y%')
})

test('search words are split, trimmed and capped', () => {
  assert.deepEqual(searchTerms('  ماير   1431 '), ['ماير', '1431'])
  assert.equal(searchTerms('a b c d e f g h').length, 6)
  assert.deepEqual(searchTerms(''), [])
})

test('parcels: no filters means no condition', () => {
  assert.deepEqual(parcelTableClause({}), { sql: '1=1', params: [] })
})

test('parcels: every word must match one of the searched columns', () => {
  const { sql, params } = parcelTableClause({ tq: 'ماير 1431' })
  assert.equal((sql.match(/ AND /g) ?? []).length, 1)
  assert.equal(params.length, 8)
  assert.ok(params.every((p) => p === '%ماير%' || p === '%1431%'))
})

test('parcels: column filters accept only known values', () => {
  assert.match(parcelTableClause({ ann: 'with' }).sql, /^EXISTS/)
  assert.match(parcelTableClause({ ann: 'without' }).sql, /^NOT EXISTS/)
  assert.equal(parcelTableClause({ ann: "x'; DROP TABLE parcels" }).sql, '1=1')
  assert.deepEqual(parcelTableClause({ method: 'judgment' }).params, ['judgment'])
  assert.equal(parcelTableClause({ method: 'none' }).sql, 'p.acquisition_method IS NULL')
  assert.equal(parcelTableClause({ method: 'bogus' }).sql, '1=1')
  assert.deepEqual(parcelTableClause({ buy_year: '2007' }).params, [2007])
  assert.equal(parcelTableClause({ buy_year: 'abc' }).sql, '1=1')
})

test('annotations: timing, target and source filters', () => {
  assert.deepEqual(annotationTableClause({ timing: 'after_transfer' }).params, ['after_transfer'])
  assert.equal(annotationTableClause({ timing: 'none' }).sql, 'a.timing IS NULL')
  assert.equal(annotationTableClause({ target: 'nobody' }).sql, '1=1')
  assert.deepEqual(annotationTableClause({ source: 'derived' }).params, ['derived'])
  const both = annotationTableClause({ tq: 'x', source: 'sheet' })
  assert.equal(both.params.length, 6)
})
