// Data-quality coverage: for each field, how many records have it out of the records it applies to,
// and which records are missing it (with their Excel row) so the figures can be checked against the sheet.
import { annotationClause, parcelClause } from './filters.js'
import { loadOperations } from './operations.js'

const OWNED = `p.ownership_group IN ('sankari_100', 'joint_75_25', 'asali_100')`
const SANKARI = `p.ownership_group IN ('sankari_100', 'joint_75_25')`
const LAND = `p.property_type = 'land'`

/**
 * Parcel fields. `have` and `applies` are SQL conditions on `parcels p`. `pending` marks fields whose
 * remaining gaps are known and waiting for data collection.
 */
export const PARCEL_METRICS = [
  {
    key: 'total_area',
    label: 'المساحة الإجمالية',
    have: 'p.total_area IS NOT NULL',
    applies: LAND,
    appliesTo: 'الأراضي (الشقق السكنية حالة خاصة: لا مساحة أرض لها)',
  },
  {
    key: 'minute_area',
    label: 'المساحة المملوكة (الملكية من مساحة المحضر)',
    have: 'p.minute_area IS NOT NULL',
    applies: `${OWNED} AND ${LAND}`,
    appliesTo: 'الأراضي المملوكة (بدون الأراضي ذات المشاكل والشقق)',
  },
  {
    key: 'shares',
    label: 'الحصة السهمية',
    have: '(p.total_shares IS NOT NULL OR p.sankari_shares IS NOT NULL OR p.asali_shares IS NOT NULL)',
    applies: OWNED,
    appliesTo: 'العقارات المملوكة؛ أسهم الأراضي ذات المشاكل تخص المالكين المسجّلين. الشقق: 2400 سهم',
  },
  {
    key: 'land_status',
    label: 'وضع العقار عند الشراء (التمام / الشيوع)',
    have: 'p.land_status IS NOT NULL',
    applies: LAND,
    appliesTo: 'الأراضي (الشقق حالة خاصة)',
    pending: true,
  },
  {
    key: 'purchase',
    label: 'عقد شراء بتاريخ',
    have: 'p.first_purchase_date IS NOT NULL',
    applies: OWNED,
    appliesTo: 'العقارات المملوكة',
  },
  {
    key: 'acquisition',
    label: 'طريقة انتقال الملكية (فراغة / حكم)',
    have: 'p.acquisition_method IS NOT NULL',
    applies: SANKARI,
    appliesTo: 'عقارات د. سنكري (عقارات عسلي لا فراغة ولا حكم لمصلحة سنكري فيها)',
  },
]

/** Annotation fields. Conditions on `annotations a JOIN parcels p`. Dates are counted by year; the detailed dates stay stored. */
export const ANNOTATION_METRICS = [
  { key: 'ann_year', label: 'سنة الإشارة', have: 'a.ref_year IS NOT NULL', applies: '1=1', appliesTo: null, pending: true },
  {
    key: 'ann_timing',
    label: 'توقيت الإشارة (قبل/بعد الفراغة أو الحكم)',
    have: 'a.timing IS NOT NULL',
    applies: OWNED,
    appliesTo: 'إشارات العقارات المملوكة',
  },
  {
    key: 'ann_category',
    label: 'نوع الإشارة',
    have: `a.category_source = 'sheet'`,
    applies: '1=1',
    appliesTo: null,
    pending: true,
    note: 'النوع غير متوفر حاليًا ويحتاج جمع بيانات؛ المكتوب في الملف فقط محسوب. أما التصنيف المستنتج من نص الإشارة فيظهر في الرسوم موسومًا «مستنتج».',
  },
]

const MISSING_LIMIT = 300

export async function buildQuality(rows, filters) {
  const parcels = parcelClause(filters)
  const annotations = annotationClause(filters)

  const [pc] = await rows(
    `SELECT ${PARCEL_METRICS.map((m) => `SUM(${m.applies}) AS ${m.key}_applicable, SUM(${m.applies} AND ${m.have}) AS ${m.key}_have`).join(', ')}, COUNT(*) AS total
     FROM parcels p WHERE ${parcels.sql}`,
    parcels.params,
  )
  const [ac] = await rows(
    `SELECT ${ANNOTATION_METRICS.map((m) => `SUM(${m.applies}) AS ${m.key}_applicable, SUM(${m.applies} AND ${m.have}) AS ${m.key}_have`).join(', ')}, COUNT(*) AS total
     FROM annotations a JOIN parcels p ON p.id = a.parcel_id WHERE ${annotations.sql}`,
    annotations.params,
  )
  const shape = (metrics, counts, unit) =>
    metrics.map((m) => ({
      key: m.key,
      label: m.label,
      unit,
      applies_to: m.appliesTo,
      note: m.note ?? null,
      pending: Boolean(m.pending),
      drill: 'missing',
      applicable: Number(counts[`${m.key}_applicable`] ?? 0),
      have: Number(counts[`${m.key}_have`] ?? 0),
    }))

  // The value is written per purchase operation of Kashf 16, so it is measured per operation, not per minute.
  const { items: operations } = await loadOperations(rows, filters)
  const valueMetric = {
    key: 'value',
    label: 'القيمة بحسب الكشف 16',
    unit: 'عملية شراء',
    applies_to: 'عمليات الشراء (رقم في الكشف 16): القيمة تُكتب مرة واحدة على أول محضر في العملية',
    note: null,
    pending: false,
    drill: 'operations',
    applicable: operations.length,
    have: operations.filter((o) => o.valued_minutes > 0).length,
  }

  const parcelMetrics = shape(PARCEL_METRICS, pc, 'عقار')
  parcelMetrics.splice(3, 0, valueMetric)
  return {
    parcels_total: Number(pc.total),
    annotations_total: Number(ac.total),
    parcels: parcelMetrics,
    annotations: shape(ANNOTATION_METRICS, ac, 'إشارة'),
  }
}

/** Why a parcel lacks a value, when the sheet itself explains it. */
function parcelReason(key, row) {
  if (row.property_type === 'apartment') return 'شقة سكنية: حالة خاصة'
  if (key === 'land_status') {
    if (row.ownership_group === 'unclassified') return 'غير مصنّف حاليًا'
    if (row.ownership_group === 'problem') return 'أرض ذات مشاكل: البيانات قيد الجمع'
  }
  if (key === 'total_area') {
    if (row.minute_area != null) return `المساحة مكتوبة فقط في «الملكية من مساحة المحضر» (${Math.round(row.minute_area).toLocaleString('en-US')} م²)`
    if (row.ownership_group === 'problem') return 'أرض ذات مشاكل: صفوفها تسرد المالكين دون مساحة'
  }
  return null
}

/** The records that lack one field, with their Excel row. */
export async function missingRecords(rows, filters, key) {
  const parcelMetric = PARCEL_METRICS.find((m) => m.key === key)
  if (parcelMetric) {
    const clause = parcelClause(filters)
    const where = `${clause.sql} AND ${parcelMetric.applies} AND NOT (${parcelMetric.have})`
    const [count] = await rows(`SELECT COUNT(*) n FROM parcels p WHERE ${where}`, clause.params)
    const items = await rows(
      `SELECT p.id, r.name_ar region, p.minute_no, p.ownership_group, p.property_type, g.name_ar group_name, p.minute_area,
              p.source_row_start, p.source_row_end
       FROM parcels p JOIN regions r ON r.id = p.region_id JOIN ownership_groups g ON g.code = p.ownership_group
       WHERE ${where} ORDER BY p.source_row_start LIMIT ${MISSING_LIMIT}`,
      clause.params,
    )
    return {
      kind: 'parcel',
      total: Number(count.n),
      items: items.map((row) => ({
        parcel_id: row.id,
        region: row.region,
        minute_no: row.minute_no,
        group_name: row.group_name,
        source_row: row.source_row_start,
        source_row_end: row.source_row_end,
        reason: parcelReason(key, row),
      })),
    }
  }

  const annotationMetric = ANNOTATION_METRICS.find((m) => m.key === key)
  if (annotationMetric) {
    const clause = annotationClause(filters)
    const where = `${clause.sql} AND ${annotationMetric.applies} AND NOT (${annotationMetric.have})`
    const from = `FROM annotations a JOIN parcels p ON p.id = a.parcel_id JOIN regions r ON r.id = p.region_id WHERE ${where}`
    const [count] = await rows(`SELECT COUNT(*) n ${from}`, clause.params)
    const items = await rows(
      `SELECT a.parcel_id, r.name_ar region, p.minute_no, a.placed_by, a.ref_no, a.ref_year, a.source_row ${from}
       ORDER BY a.source_row LIMIT ${MISSING_LIMIT}`,
      clause.params,
    )
    return {
      kind: 'annotation',
      total: Number(count.n),
      items: items.map((row) => ({
        parcel_id: row.parcel_id,
        region: row.region,
        minute_no: row.minute_no,
        placed_by: row.placed_by,
        ref_no: row.ref_no,
        ref_year: row.ref_year,
        source_row: row.source_row,
      })),
    }
  }
  return null
}
