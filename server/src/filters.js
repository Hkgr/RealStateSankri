// Turns the query string into SQL conditions. The same filters drive every chart (cross-filtering):
// a chart passes its own dimension in `omit`, so it still shows the other choices next to the selected one.

const CODE = /^[a-z0-9_]+$/

export const DIMENSIONS = ['region', 'group', 'damaged', 'status', 'category', 'year', 'q']

/** Reads and validates the filter query parameters; unknown or malformed values are dropped. */
export function readFilters(query) {
  const filters = {}
  const text = (key) => (typeof query[key] === 'string' ? query[key].trim() : '')

  const region = Number(text('region'))
  if (Number.isInteger(region) && region > 0) filters.region = region
  const group = text('group')
  if (CODE.test(group)) filters.group = group
  const damaged = text('damaged')
  if (damaged === '1' || damaged === '0') filters.damaged = Number(damaged)
  const status = text('status')
  if (status === 'full' || status === 'joint') filters.status = status
  const category = text('category')
  if (CODE.test(category)) filters.category = category
  const year = Number(text('year'))
  if (Number.isInteger(year) && year >= 1900 && year <= 2100) filters.year = year
  const q = text('q').slice(0, 60)
  if (q) filters.q = q
  return filters
}

/**
 * Conditions on `parcels p`. Annotation filters (category, year) keep the parcels that have at
 * least one matching annotation.
 */
export function parcelClause(filters, omit = []) {
  const where = []
  const params = []
  const use = (key) => filters[key] !== undefined && !omit.includes(key)

  if (use('region')) (where.push('p.region_id = ?'), params.push(filters.region))
  if (use('group')) (where.push('p.ownership_group = ?'), params.push(filters.group))
  if (use('damaged')) (where.push('p.is_damaged = ?'), params.push(filters.damaged))
  if (use('status')) (where.push('p.land_status = ?'), params.push(filters.status))
  if (use('q')) {
    where.push('(p.minute_no LIKE ? OR p.kashf16_ref LIKE ?)')
    params.push(`%${filters.q}%`, `%${filters.q}%`)
  }

  const inner = []
  if (use('category')) (inner.push('x.category = ?'), params.push(filters.category))
  if (use('year')) (inner.push('x.ref_year = ?'), params.push(filters.year))
  if (inner.length) where.push(`EXISTS (SELECT 1 FROM annotations x WHERE x.parcel_id = p.id AND ${inner.join(' AND ')})`)

  return { sql: where.length ? where.join(' AND ') : '1=1', params }
}

/** Conditions on `annotations a JOIN parcels p`: the parcel filters plus the annotation's own category / year. */
export function annotationClause(filters, omit = []) {
  const parcel = parcelClause(filters, [...omit, 'category', 'year'])
  const where = [parcel.sql]
  const params = [...parcel.params]
  const use = (key) => filters[key] !== undefined && !omit.includes(key)
  if (use('category')) (where.push('a.category = ?'), params.push(filters.category))
  if (use('year')) (where.push('a.ref_year = ?'), params.push(filters.year))
  return { sql: where.join(' AND '), params }
}
