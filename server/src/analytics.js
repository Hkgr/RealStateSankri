// Advanced indicators: unique cases, exposure to annotations, price per m², and time lags.
import { annotationClause, parcelClause } from './filters.js'
import { loadOperations } from './operations.js'
import { bucketize, quantile, summary } from './stats.js'

/** Annotation kinds that dispute the parcel or restrict dealing with it (the others are in د. سنكري's favour or private claims). */
export const CRITICAL = ['arbitration', 'security', 'state']

const TRANSFER_LAG_BUCKETS = [
  ['lt90', 'حتى 3 أشهر', (d) => d <= 90],
  ['lt180', '3 – 6 أشهر', (d) => d <= 180],
  ['lt365', '6 – 12 شهرًا', (d) => d <= 365],
  ['lt545', '12 – 18 شهرًا', (d) => d <= 545],
  ['gt545', 'أكثر من 18 شهرًا', () => true],
]

const ANNOTATION_LAG_BUCKETS = [
  ['before', 'قبل الفراغة / الحكم', (d) => d < 0],
  ['lt180', 'حتى 6 أشهر بعدها', (d) => d <= 180],
  ['lt365', '6 – 12 شهرًا', (d) => d <= 365],
  ['lt730', '1 – 2 سنة', (d) => d <= 730],
  ['gt730', 'أكثر من سنتين', () => true],
]

const round = (value, digits = 1) => (value == null ? null : Math.round(value * 10 ** digits) / 10 ** digits)

export async function buildAnalytics(rows, filters) {
  const parcels = parcelClause(filters)
  const annotations = annotationClause(filters)
  const categories = await rows('SELECT code, name_ar AS name FROM annotation_categories ORDER BY sort_order')
  const categoryName = new Map(categories.map((c) => [c.code, c.name]))

  const [caseRows, nullRef, parcelExposure, priced, operationValues, operationList, purchaseLags, annotationLags] = await Promise.all([
    // One row per (case, parcel): a case is the same annotation number, in the same region, from the same placer.
    rows(
      `SELECT p.id parcel_id, p.region_id, r.name_ar region, a.ref_no, a.placed_by, MIN(a.category) category, MIN(a.ref_year) ref_year,
              COUNT(*) n, MIN(p.total_area) total_area, MIN(p.kashf16_ref) ref16, MIN(p.k16_value_usd) own_value
       FROM annotations a JOIN parcels p ON p.id = a.parcel_id JOIN regions r ON r.id = p.region_id
       WHERE a.ref_no IS NOT NULL AND ${annotations.sql}
       GROUP BY p.id, p.region_id, r.name_ar, a.ref_no, a.placed_by`,
      annotations.params,
    ),
    rows(
      `SELECT a.category, COUNT(*) n FROM annotations a JOIN parcels p ON p.id = a.parcel_id
       WHERE a.ref_no IS NULL AND ${annotations.sql} GROUP BY a.category`,
      annotations.params,
    ),
    rows(
      `SELECT p.id, p.minute_no, p.region_id, r.name_ar region, p.total_area, p.minute_area, p.k16_value_usd, p.kashf16_ref ref16,
              COALESCE(SUM(a.category = 'arbitration'), 0) arbitration, COALESCE(SUM(a.category = 'security'), 0) security,
              COALESCE(SUM(a.category = 'state'), 0) state, COALESCE(SUM(a.category = 'liquidation'), 0) liquidation,
              COALESCE(SUM(a.category = 'cancellation'), 0) cancellation, COALESCE(SUM(a.category = 'private_claim'), 0) private_claim,
              COUNT(a.id) total
       FROM parcels p JOIN regions r ON r.id = p.region_id LEFT JOIN annotations a ON a.parcel_id = p.id
       WHERE ${parcels.sql} GROUP BY p.id, p.minute_no, p.region_id, r.name_ar, p.total_area, p.minute_area, p.k16_value_usd, p.kashf16_ref`,
      parcels.params,
    ),
    rows(
      `SELECT p.id, p.minute_no, p.region_id, r.name_ar region, p.k16_value_usd, p.k16_area
       FROM parcels p JOIN regions r ON r.id = p.region_id
       WHERE p.k16_value_usd IS NOT NULL AND p.k16_area > 0 AND ${parcels.sql}`,
      parcels.params,
    ),
    // Each operation's value sits on its first minute, so values are totalled per operation, never per minute.
    rows('SELECT kashf16_ref ref, SUM(k16_value_usd) value_usd FROM parcels WHERE kashf16_ref IS NOT NULL GROUP BY kashf16_ref'),
    loadOperations(rows, filters),
    rows(
      `SELECT p.region_id, DATEDIFF(p.transfer_date, p.first_purchase_date) days FROM parcels p
       WHERE p.transfer_date IS NOT NULL AND p.first_purchase_date IS NOT NULL AND ${parcels.sql}`,
      parcels.params,
    ),
    rows(
      `SELECT DATEDIFF(a.ref_date, COALESCE(p.transfer_date, p.judgment_date)) days
       FROM annotations a JOIN parcels p ON p.id = a.parcel_id
       WHERE a.ref_date IS NOT NULL AND COALESCE(p.transfer_date, p.judgment_date) IS NOT NULL AND ${annotations.sql}`,
      annotations.params,
    ),
  ])

  // Value of a set of minutes: each purchase operation counts once with its whole value; a minute with no
  // operation counts with its own value.
  const operationValue = new Map(operationValues.map((o) => [o.ref, o.value_usd]))
  const valueOf = (list) => {
    const refs = new Set()
    let loose = 0
    let known = false
    for (const item of list) {
      if (item.ref16) refs.add(item.ref16)
      else if (item.own_value != null) {
        loose += item.own_value
        known = true
      }
    }
    for (const ref of refs) {
      const value = operationValue.get(ref)
      if (value != null) {
        loose += value
        known = true
      }
    }
    return known ? loose : null
  }

  // --- Cases ---------------------------------------------------------------------------------
  const caseGroups = new Map()
  for (const row of caseRows) {
    const key = `${row.region_id}|${row.ref_no}|${row.placed_by ?? ''}`
    const group = caseGroups.get(key) ?? { region: row.region, ref_no: row.ref_no, placed_by: row.placed_by, category: row.category, ref_year: row.ref_year, annotation_rows: 0, items: [] }
    group.annotation_rows += row.n
    group.items.push(row)
    caseGroups.set(key, group)
  }
  const cases = [...caseGroups.values()].map((c) => ({
    ...c,
    category_name: categoryName.get(c.category) ?? c.category,
    parcels: c.items.length,
    total_area: c.items.reduce((s, i) => s + (i.total_area ?? 0), 0),
    value_usd: valueOf(c.items.map((i) => ({ ref16: i.ref16, own_value: i.own_value }))),
  }))
  const nullRefRows = nullRef.reduce((sum, r) => sum + r.n, 0)
  const totalRows = cases.reduce((sum, c) => sum + c.annotation_rows, 0) + nullRefRows
  const byCategory = categories.map((c) => ({
    code: c.code,
    name: c.name,
    rows: cases.filter((x) => x.category === c.code).reduce((s, x) => s + x.annotation_rows, 0) + (nullRef.find((r) => r.category === c.code)?.n ?? 0),
    cases: cases.filter((x) => x.category === c.code).length + (nullRef.find((r) => r.category === c.code)?.n ?? 0),
  }))
  const caseCount = cases.length + nullRefRows
  const topCases = [...cases]
    .sort((a, b) => b.parcels - a.parcels || b.total_area - a.total_area)
    .slice(0, 100)
    .map((c) => ({
      ref_no: c.ref_no,
      region: c.region,
      placed_by: c.placed_by,
      category: c.category,
      category_name: c.category_name,
      year: c.ref_year,
      parcels: c.parcels,
      annotation_rows: c.annotation_rows,
      total_area: c.total_area,
      value_usd: c.value_usd,
    }))

  // --- Exposure ------------------------------------------------------------------------------
  // A total over nothing is "unknown" (null), not zero.
  const total = (list, pick) => {
    const known = list.map(pick).filter((v) => v != null)
    return known.length ? known.reduce((s, v) => s + v, 0) : null
  }
  const sums = (list) => ({
    parcels: list.length,
    total_area: total(list, (p) => p.total_area),
    owned_area: total(list, (p) => p.minute_area),
    value_usd: valueOf(list.map((p) => ({ ref16: p.ref16, own_value: p.k16_value_usd }))),
  })
  const isCritical = (p) => CRITICAL.some((code) => p[code] > 0)
  const exposureByCategory = categories.map((c) => ({ code: c.code, name: c.name, ...sums(parcelExposure.filter((p) => p[c.code] > 0)) }))
  const regionIds = [...new Set(parcelExposure.map((p) => p.region_id))]
  const exposureByRegion = regionIds
    .map((id) => {
      const inRegion = parcelExposure.filter((p) => p.region_id === id)
      return {
        id,
        name: inRegion[0].region,
        parcels: inRegion.length,
        critical_parcels: inRegion.filter(isCritical).length,
        clean_parcels: inRegion.filter((p) => p.total === 0).length,
      }
    })
    .sort((a, b) => b.parcels - a.parcels)
  const topExposed = parcelExposure
    .map((p) => ({ ...p, critical: CRITICAL.reduce((s, code) => s + p[code], 0) }))
    .filter((p) => p.critical > 0)
    .sort((a, b) => b.critical - a.critical || (b.k16_value_usd ?? 0) - (a.k16_value_usd ?? 0))
    .slice(0, 10)
    .map((p) => ({
      id: p.id,
      region: p.region,
      minute_no: p.minute_no,
      critical: p.critical,
      arbitration: p.arbitration,
      security: p.security,
      state: p.state,
      total: p.total,
      total_area: p.total_area,
      value_usd: p.ref16 ? (operationValue.get(p.ref16) ?? p.k16_value_usd) : p.k16_value_usd,
    }))

  // --- Price per m² (the valuation's own basis: value ÷ "المساحة بحسب الكشف 16") --------------
  const prices = priced.map((p) => ({ ...p, price: p.k16_value_usd / p.k16_area }))
  const priceRegions = [...new Set(prices.map((p) => p.region_id))]
    .map((id) => {
      const inRegion = prices.filter((p) => p.region_id === id)
      const value = inRegion.reduce((s, p) => s + p.k16_value_usd, 0)
      const area = inRegion.reduce((s, p) => s + p.k16_area, 0)
      return { id, name: inRegion[0].region, operations: inRegion.length, price: round(value / area, 2), median: round(quantile(inRegion.map((p) => p.price), 0.5), 2) }
    })
    .sort((a, b) => b.price - a.price)
  const priceStats = summary(prices.map((p) => p.price))
  const totalValue = prices.reduce((s, p) => s + p.k16_value_usd, 0)
  const totalArea = prices.reduce((s, p) => s + p.k16_area, 0)

  // --- Lags ----------------------------------------------------------------------------------
  const purchaseDays = purchaseLags.map((r) => r.days)
  const lagRegions = [...new Set(purchaseLags.map((r) => r.region_id))]
  const regionNames = new Map(parcelExposure.map((p) => [p.region_id, p.region]))
  const lagByRegion = lagRegions
    .map((id) => {
      const days = purchaseLags.filter((r) => r.region_id === id).map((r) => r.days)
      return { id, name: regionNames.get(id) ?? String(id), parcels: days.length, median: round(quantile(days, 0.5), 0) }
    })
    .filter((r) => r.parcels >= 3)
    .sort((a, b) => b.median - a.median)
  const annotationDays = annotationLags.map((r) => r.days)

  return {
    cases: {
      annotation_rows: totalRows,
      cases: caseCount,
      avg_rows_per_case: caseCount ? round(totalRows / caseCount, 1) : null,
      multi_parcel_cases: cases.filter((c) => c.parcels > 1).length,
      by_category: byCategory,
      top: topCases,
    },
    exposure: {
      critical_codes: CRITICAL,
      all: sums(parcelExposure),
      critical: sums(parcelExposure.filter(isCritical)),
      clean: sums(parcelExposure.filter((p) => p.total === 0)),
      by_category: exposureByCategory,
      by_region: exposureByRegion,
      top_parcels: topExposed,
    },
    pricing: {
      operations: prices.length,
      weighted_price: totalArea ? round(totalValue / totalArea, 2) : null,
      stats: { ...priceStats, min: round(priceStats.min, 2), p25: round(priceStats.p25, 2), median: round(priceStats.median, 2), p75: round(priceStats.p75, 2), max: round(priceStats.max, 2), mean: round(priceStats.mean, 2) },
      by_region: priceRegions,
      unvalued: {
        operations: operationList.items.filter((o) => o.valued_minutes === 0).length,
        minutes: operationList.items.filter((o) => o.valued_minutes === 0).reduce((sum, o) => sum + o.minutes, 0),
        total: operationList.items.length,
      },
    },
    lags: {
      purchase_to_transfer: {
        ...summary(purchaseDays),
        median: round(quantile(purchaseDays, 0.5), 0),
        mean: purchaseDays.length ? round(purchaseDays.reduce((s, d) => s + d, 0) / purchaseDays.length, 0) : null,
        p25: round(quantile(purchaseDays, 0.25), 0),
        p75: round(quantile(purchaseDays, 0.75), 0),
        buckets: bucketize(purchaseDays, TRANSFER_LAG_BUCKETS),
        by_region: lagByRegion,
      },
      transfer_to_annotation: {
        n: annotationDays.length,
        median: round(quantile(annotationDays, 0.5), 0),
        before: annotationDays.filter((d) => d < 0).length,
        buckets: bucketize(annotationDays, ANNOTATION_LAG_BUCKETS),
      },
    },
  }
}
