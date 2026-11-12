// Purchase operations. The sheet's "م ك16" is the item of Kashf 16 a minute was bought under: one operation
// covers several minutes, and its value and area are written once, on the operation's first minute.
import { parcelClause } from './filters.js'

/**
 * Every operation that has at least one minute in the current selection, with its whole figures
 * (an operation is always counted entire, whatever filter cuts through its minutes).
 */
export async function loadOperations(rows, filters) {
  const clause = parcelClause(filters)
  const items = await rows(
    `SELECT p.kashf16_ref ref, COUNT(*) minutes, SUM(p.k16_value_usd IS NOT NULL) valued_minutes,
            SUM(p.k16_value_usd) value_usd, SUM(p.k16_value_syp) value_syp, SUM(p.k16_area) k16_area,
            SUM(p.total_area) total_area, SUM(p.minute_area) owned_area, MIN(p.first_purchase_date) first_purchase_date,
            GROUP_CONCAT(DISTINCT r.name_ar ORDER BY r.name_ar SEPARATOR ' ، ') regions,
            GROUP_CONCAT(DISTINCT g.name_ar ORDER BY g.sort_order SEPARATOR ' ، ') owners
     FROM parcels p JOIN regions r ON r.id = p.region_id JOIN ownership_groups g ON g.code = p.ownership_group
     WHERE p.kashf16_ref IN (SELECT chosen.ref FROM (SELECT DISTINCT q.kashf16_ref ref FROM parcels q
                              JOIN parcels p ON p.id = q.id WHERE q.kashf16_ref IS NOT NULL AND ${clause.sql}) chosen)
     GROUP BY p.kashf16_ref`,
    clause.params,
  )
  const loose = await rows(
    `SELECT COUNT(*) minutes, SUM(p.k16_value_usd IS NOT NULL) valued_minutes, SUM(p.k16_value_usd) value_usd,
            SUM(p.k16_value_syp) value_syp
     FROM parcels p WHERE p.kashf16_ref IS NULL AND ${clause.sql}`,
    clause.params,
  )
  return {
    items: items.map((item) => ({
      ...item,
      price: item.value_usd != null && item.k16_area > 0 ? Math.round((item.value_usd / item.k16_area) * 100) / 100 : null,
      purchase_year: item.first_purchase_date ? Number(String(item.first_purchase_date).slice(0, 4)) : null,
    })),
    loose: loose[0],
  }
}

/** The purchases report: how many operations, how many minutes in each, and what they are worth. */
export async function buildOperations(rows, filters) {
  const { items, loose } = await loadOperations(rows, filters)
  const sum = (pick) => items.reduce((total, item) => total + (pick(item) ?? 0), 0)
  const byYear = new Map()
  for (const item of items) {
    const key = item.purchase_year ?? 0
    const entry = byYear.get(key) ?? { year: item.purchase_year, operations: 0, minutes: 0, value_usd: 0 }
    entry.operations += 1
    entry.minutes += item.minutes
    entry.value_usd += item.value_usd ?? 0
    byYear.set(key, entry)
  }
  return {
    summary: {
      operations: items.length,
      valued_operations: items.filter((i) => i.valued_minutes > 0).length,
      minutes: sum((i) => i.minutes),
      value_usd: sum((i) => i.value_usd),
      value_syp: sum((i) => i.value_syp),
      k16_area: sum((i) => i.k16_area),
    },
    loose,
    by_year: [...byYear.values()].sort((a, b) => (a.year ?? 9999) - (b.year ?? 9999)),
    items: items.sort((a, b) => (b.value_usd ?? -1) - (a.value_usd ?? -1) || b.minutes - a.minutes),
  }
}

/** One operation with the minutes it covers, for the parcel page. */
export async function operationOf(rows, ref) {
  if (!ref) return null
  const [totals] = await rows(
    `SELECT COUNT(*) minutes, SUM(k16_value_usd IS NOT NULL) valued_minutes, SUM(k16_value_usd) value_usd,
            SUM(k16_value_syp) value_syp, SUM(k16_area) k16_area
     FROM parcels WHERE kashf16_ref = ?`,
    [ref],
  )
  const minutes = await rows(
    `SELECT p.id, r.name_ar region, p.minute_no, p.source_row_start source_row, (p.k16_value_usd IS NOT NULL) carries_value
     FROM parcels p JOIN regions r ON r.id = p.region_id WHERE p.kashf16_ref = ? ORDER BY p.source_row_start`,
    [ref],
  )
  return {
    ref,
    ...totals,
    price: totals.value_usd != null && totals.k16_area > 0 ? Math.round((totals.value_usd / totals.k16_area) * 100) / 100 : null,
    minutes_list: minutes,
  }
}
