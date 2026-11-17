// Filters that belong to one table (its search box and column selects). They narrow the rows on top of the
// dashboard-wide filters in filters.js, and are checked against fixed lists before they reach SQL.

const MAX_TERMS = 6
const ACQUISITION = new Set(['transfer', 'judgment', 'judgment_then_transfer', 'none'])
const TIMING = new Set(['before_purchase', 'before_transfer', 'after_transfer', 'before_judgment', 'after_judgment', 'none'])
const TARGET = new Set(['sankari', 'asali', 'both', 'other', 'none'])
const SOURCE = new Set(['sheet', 'derived'])

const text = (query, key) => (typeof query[key] === 'string' ? query[key].trim() : '')

/** Escapes the characters LIKE treats specially, so a typed "%" or "_" is searched for literally. */
export function likeTerm(term) {
  return `%${term.replace(/[\\%_]/g, '\\$&')}%`
}

/** Words of a search box: every word has to match somewhere in the row. */
export function searchTerms(value) {
  return value.slice(0, 80).split(/\s+/).filter(Boolean).slice(0, MAX_TERMS)
}

/** `(col1 LIKE ? OR col2 LIKE ?) AND ...` with one group per typed word. */
function textClause(columns, value) {
  const terms = searchTerms(value)
  const where = terms.map(() => `(${columns.map((column) => `${column} LIKE ?`).join(' OR ')})`)
  const params = terms.flatMap((term) => columns.map(() => likeTerm(term)))
  return { where, params }
}

/** Parcels table: `parcels p JOIN regions r` must be in the query. */
export function parcelTableClause(query) {
  const where = []
  const params = []

  const search = textClause(['p.minute_no', 'p.kashf16_ref', 'r.name_ar', 'p.notes'], text(query, 'tq'))
  where.push(...search.where)
  params.push(...search.params)

  const annotations = text(query, 'ann')
  if (annotations === 'with') where.push('EXISTS (SELECT 1 FROM annotations t WHERE t.parcel_id = p.id)')
  if (annotations === 'without') where.push('NOT EXISTS (SELECT 1 FROM annotations t WHERE t.parcel_id = p.id)')

  const method = text(query, 'method')
  if (method === 'none') where.push('p.acquisition_method IS NULL')
  else if (ACQUISITION.has(method)) (where.push('p.acquisition_method = ?'), params.push(method))

  const year = Number(text(query, 'buy_year'))
  if (Number.isInteger(year) && year >= 1900 && year <= 2100) (where.push('YEAR(p.first_purchase_date) = ?'), params.push(year))

  return { sql: where.length ? where.join(' AND ') : '1=1', params }
}

/** Annotations table: `annotations a JOIN parcels p JOIN regions r` must be in the query. */
export function annotationTableClause(query) {
  const where = []
  const params = []

  const search = textClause(['a.placed_by', 'a.placed_on', 'p.minute_no', 'r.name_ar', 'CAST(a.ref_no AS CHAR)'], text(query, 'tq'))
  where.push(...search.where)
  params.push(...search.params)

  const timing = text(query, 'timing')
  if (timing === 'none') where.push('a.timing IS NULL')
  else if (TIMING.has(timing)) (where.push('a.timing = ?'), params.push(timing))

  const target = text(query, 'target')
  if (target === 'none') where.push('a.target_party IS NULL')
  else if (TARGET.has(target)) (where.push('a.target_party = ?'), params.push(target))

  const source = text(query, 'source')
  if (SOURCE.has(source)) (where.push('a.category_source = ?'), params.push(source))

  return { sql: where.length ? where.join(' AND ') : '1=1', params }
}
