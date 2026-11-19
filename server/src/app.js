import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import express from 'express'
import { buildAnalytics } from './analytics.js'
import { basicAuth, registerDocumentRoutes } from './documents.js'
import { annotationClause, parcelClause, readFilters } from './filters.js'
import { buildOperations, linesOf, operationOf } from './operations.js'
import { buildQuality, missingRecords } from './quality.js'
import { annotationTableClause, parcelTableClause } from './tableFilters.js'

const here = path.dirname(fileURLToPath(import.meta.url))
const DIST = path.resolve(here, '../../frontend/dist')

const PARCEL_SORTS = {
  minute: 'p.minute_base',
  region: 'r.name_ar',
  group: 'g.sort_order',
  owned_area: 'p.minute_area',
  total_area: 'p.total_area',
  value: 'operation_value',
  sankari_value: 'p.sankari_value_usd',
  asali_value: 'p.asali_value_usd',
  annotations: 'annotation_count',
  purchase: 'p.first_purchase_date',
}

const ANNOTATION_SORTS = {
  date: 'COALESCE(a.ref_date, MAKEDATE(a.ref_year, 1))',
  region: 'r.name_ar',
  minute: 'p.minute_base',
  category: 'c.sort_order',
  placed_by: 'a.placed_by',
}

const toInt = (value, fallback, min, max) => {
  const n = Number.parseInt(value, 10)
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback
}


export function createApp(pool) {
  const app = express()
  app.disable('x-powered-by')
  // Optional password for the whole site (see documents.js): the documents are only served when it is set.
  if (process.env.BASIC_AUTH_USER && process.env.BASIC_AUTH_PASSWORD) app.use(basicAuth(process.env.BASIC_AUTH_USER, process.env.BASIC_AUTH_PASSWORD))
  const router = express.Router()
  const rows = async (sql, params = []) => (await pool.query(sql, params))[0]
  const one = async (sql, params = []) => (await rows(sql, params))[0]

  router.get('/health', async (_req, res) => {
    await pool.query('SELECT 1')
    res.json({ data: { status: 'ok' } })
  })

  // Filter choices and labels: everything the explorer bar needs.
  router.get('/meta', async (_req, res) => {
    const [regions, groups, categories, years, imported] = await Promise.all([
      rows(`SELECT r.id, r.name_ar AS name, COUNT(p.id) AS parcels FROM regions r
            LEFT JOIN parcels p ON p.region_id = r.id GROUP BY r.id ORDER BY parcels DESC, r.name_ar`),
      rows(`SELECT g.code, g.name_ar AS name, COUNT(p.id) AS parcels FROM ownership_groups g
            LEFT JOIN parcels p ON p.ownership_group = g.code GROUP BY g.code ORDER BY g.sort_order`),
      rows(`SELECT c.code, c.name_ar AS name, COUNT(a.id) AS annotations FROM annotation_categories c
            LEFT JOIN annotations a ON a.category = c.code GROUP BY c.code ORDER BY c.sort_order`),
      rows(`SELECT ref_year AS year, COUNT(*) AS annotations FROM annotations WHERE ref_year IS NOT NULL
            GROUP BY ref_year ORDER BY ref_year`),
      one(`SELECT MAX(create_time) AS at FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'parcels'`),
    ])
    res.json({
      data: {
        regions,
        groups,
        categories,
        years,
        imported_at: imported?.at ?? null,
      },
    })
  })

  router.get('/overview', async (req, res) => {
    const f = readFilters(req.query)
    const all = parcelClause(f)
    const ann = annotationClause(f)
    const without = (key) => parcelClause(f, [key])
    const annWithout = (key) => annotationClause(f, [key])

    const [lineTotals, lineRegions, lineGroups, figures, annFigures, byRegion, regionAnn, byGroup, annByCategory, annByYear, purchasesByMonth, transfers,
      judgments, landStatus, acquisition, timing, placers, target, regionCategory] = await Promise.all([
      // Kashf 16 lines written under a minute: their value counts with the minute they hang under.
      one(
        `SELECT COUNT(DISTINCT CASE WHEN NOT EXISTS (SELECT 1 FROM parcels x WHERE x.kashf16_ref = l.kashf16_ref) THEN l.kashf16_ref END) new_operations,
                COUNT(DISTINCT CASE WHEN p.kashf16_ref IS NULL THEN p.id END) new_minutes,
                SUM(l.k16_value_usd) value_usd, SUM(l.k16_value_syp) value_syp,
                SUM(l.sankari_value_usd) sankari_value_usd, SUM(l.asali_value_usd) asali_value_usd
         FROM operation_lines l JOIN parcels p ON p.id = l.parcel_id WHERE ${all.sql}`,
        all.params,
      ),
      rows(
        `SELECT p.region_id id, SUM(l.k16_value_usd) value_usd FROM operation_lines l JOIN parcels p ON p.id = l.parcel_id
         WHERE ${without('region').sql} GROUP BY p.region_id`,
        without('region').params,
      ),
      rows(
        `SELECT p.ownership_group code, SUM(l.k16_value_usd) value_usd FROM operation_lines l JOIN parcels p ON p.id = l.parcel_id
         WHERE ${without('group').sql} GROUP BY p.ownership_group`,
        without('group').params,
      ),
      one(
        `SELECT COUNT(*) parcels, SUM(p.is_damaged) damaged, SUM(p.minute_area) owned_area, SUM(p.total_area) total_area,
                SUM(p.k16_value_usd) value_usd, SUM(p.sankari_value_usd) sankari_value_usd, SUM(p.asali_value_usd) asali_value_usd,
                SUM(p.k16_value_syp) value_syp, COUNT(p.k16_value_usd) valued_parcels,
                COUNT(DISTINCT p.kashf16_ref) operations, SUM(p.kashf16_ref IS NOT NULL) operation_minutes,
                COUNT(DISTINCT CASE WHEN p.k16_value_usd IS NOT NULL THEN p.kashf16_ref END) valued_operations,
                SUM(p.first_purchase_date IS NOT NULL) purchased_parcels, COUNT(DISTINCT p.region_id) regions
         FROM parcels p WHERE ${all.sql}`,
        all.params,
      ),
      one(
        `SELECT COUNT(*) annotations, COUNT(DISTINCT a.parcel_id) parcels_with_annotations
         FROM annotations a JOIN parcels p ON p.id = a.parcel_id WHERE ${ann.sql}`,
        ann.params,
      ),
      rows(
        `SELECT r.id, r.name_ar name, COUNT(*) parcels, SUM(p.minute_area) owned_area, SUM(p.total_area) total_area,
                SUM(p.k16_value_usd) value_usd
         FROM parcels p JOIN regions r ON r.id = p.region_id WHERE ${without('region').sql}
         GROUP BY r.id, r.name_ar ORDER BY parcels DESC, r.name_ar`,
        without('region').params,
      ),
      rows(
        `SELECT p.region_id id, COUNT(*) annotations FROM annotations a JOIN parcels p ON p.id = a.parcel_id
         WHERE ${annWithout('region').sql} GROUP BY p.region_id`,
        annWithout('region').params,
      ),
      rows(
        `SELECT g.code, g.name_ar name, COUNT(*) parcels, SUM(p.minute_area) owned_area, SUM(p.total_area) total_area,
                SUM(p.k16_value_usd) value_usd
         FROM parcels p JOIN ownership_groups g ON g.code = p.ownership_group WHERE ${without('group').sql}
         GROUP BY g.code, g.name_ar, g.sort_order ORDER BY g.sort_order`,
        without('group').params,
      ),
      rows(
        `SELECT c.code, c.name_ar name, COUNT(*) annotations
         FROM annotations a JOIN parcels p ON p.id = a.parcel_id JOIN annotation_categories c ON c.code = a.category
         WHERE ${annWithout('category').sql} GROUP BY c.code, c.name_ar, c.sort_order ORDER BY c.sort_order`,
        annWithout('category').params,
      ),
      rows(
        `SELECT a.ref_year year, a.category, COUNT(*) annotations
         FROM annotations a JOIN parcels p ON p.id = a.parcel_id
         WHERE a.ref_year IS NOT NULL AND ${annWithout('year').sql} GROUP BY a.ref_year, a.category ORDER BY a.ref_year`,
        annWithout('year').params,
      ),
      rows(
        `SELECT YEAR(u.purchase_date) year, COALESCE(u.channel, 'unknown') channel, COUNT(*) purchases
         FROM purchases u JOIN parcels p ON p.id = u.parcel_id
         WHERE u.purchase_date IS NOT NULL AND ${all.sql} GROUP BY year, channel ORDER BY year`,
        all.params,
      ),
      rows(
        `SELECT YEAR(p.transfer_date) year, COUNT(*) n FROM parcels p
         WHERE p.transfer_date IS NOT NULL AND ${all.sql} GROUP BY year ORDER BY year`,
        all.params,
      ),
      rows(
        `SELECT YEAR(p.judgment_date) year, COUNT(*) n FROM parcels p
         WHERE p.judgment_date IS NOT NULL AND ${all.sql} GROUP BY year ORDER BY year`,
        all.params,
      ),
      rows(
        `SELECT CASE WHEN p.property_type = 'apartment' THEN 'apartment' ELSE COALESCE(p.land_status, 'unknown') END code, COUNT(*) parcels, SUM(p.total_area) total_area
         FROM parcels p WHERE ${without('status').sql} GROUP BY code`,
        without('status').params,
      ),
      rows(
        `SELECT COALESCE(p.acquisition_method, 'none') code, COUNT(*) parcels FROM parcels p
         WHERE ${all.sql} GROUP BY code`,
        all.params,
      ),
      rows(
        `SELECT COALESCE(a.timing, 'unknown') code, COUNT(*) annotations FROM annotations a
         JOIN parcels p ON p.id = a.parcel_id WHERE ${ann.sql} GROUP BY code`,
        ann.params,
      ),
      rows(
        `SELECT a.placed_by name, a.category, COUNT(*) annotations FROM annotations a
         JOIN parcels p ON p.id = a.parcel_id WHERE a.placed_by IS NOT NULL AND ${ann.sql}
         GROUP BY a.placed_by, a.category ORDER BY annotations DESC, a.placed_by LIMIT 15`,
        ann.params,
      ),
      rows(
        `SELECT COALESCE(a.target_party, 'unknown') code, COUNT(*) annotations FROM annotations a
         JOIN parcels p ON p.id = a.parcel_id WHERE ${ann.sql} GROUP BY code`,
        ann.params,
      ),
      rows(
        `SELECT p.region_id, a.category, COUNT(*) annotations FROM annotations a
         JOIN parcels p ON p.id = a.parcel_id WHERE ${annWithout('region').sql} GROUP BY p.region_id, a.category`,
        annWithout('region').params,
      ),
    ])

    const annotationsByRegion = new Map(regionAnn.map((r) => [r.id, r.annotations]))
    const years = new Map()
    for (const row of [...transfers, ...judgments]) years.set(row.year, { year: row.year, transfers: 0, judgments: 0 })
    transfers.forEach((r) => (years.get(r.year).transfers = r.n))
    judgments.forEach((r) => (years.get(r.year).judgments = r.n))

    const plus = (a, b) => (a == null && b == null ? null : (a ?? 0) + (b ?? 0))
    const lineRegionValue = new Map(lineRegions.map((r) => [r.id, r.value_usd]))
    const lineGroupValue = new Map(lineGroups.map((g) => [g.code, g.value_usd]))
    res.json({
      data: {
        figures: {
          ...figures,
          ...annFigures,
          value_usd: plus(figures.value_usd, lineTotals.value_usd),
          value_syp: plus(figures.value_syp, lineTotals.value_syp),
          sankari_value_usd: plus(figures.sankari_value_usd, lineTotals.sankari_value_usd),
          asali_value_usd: plus(figures.asali_value_usd, lineTotals.asali_value_usd),
          operations: figures.operations + lineTotals.new_operations,
          valued_operations: figures.valued_operations + lineTotals.new_operations,
          operation_minutes: figures.operation_minutes + lineTotals.new_minutes,
        },
        by_region: byRegion.map((r) => ({ ...r, value_usd: plus(r.value_usd, lineRegionValue.get(r.id)), annotations: annotationsByRegion.get(r.id) ?? 0 })),
        by_group: byGroup.map((g) => ({ ...g, value_usd: plus(g.value_usd, lineGroupValue.get(g.code)) })),
        annotations_by_category: annByCategory,
        annotations_by_year: annByYear,
        purchases_by_year: purchasesByMonth,
        acquisitions_by_year: [...years.values()].sort((a, b) => a.year - b.year),
        land_status: landStatus,
        acquisition_methods: acquisition,
        timing,
        top_placers: placers,
        target_party: target,
        region_category: regionCategory,
      },
    })
  })

  router.get('/quality', async (req, res) => {
    res.json({ data: await buildQuality(rows, readFilters(req.query)) })
  })

  router.get('/quality/missing', async (req, res) => {
    const result = await missingRecords(rows, readFilters(req.query), String(req.query.metric ?? ''))
    if (!result) return res.status(400).json({ message: 'مقياس غير معروف.' })
    res.json({ data: result })
  })

  router.get('/operations', async (req, res) => {
    res.json({ data: await buildOperations(rows, readFilters(req.query)) })
  })

  router.get('/analytics', async (req, res) => {
    res.json({ data: await buildAnalytics(rows, readFilters(req.query)) })
  })

  router.get('/parcels', async (req, res) => {
    const f = readFilters(req.query)
    const dashboard = parcelClause(f)
    const own = parcelTableClause(req.query)
    const clause = { sql: `${dashboard.sql} AND ${own.sql}`, params: [...dashboard.params, ...own.params] }
    const sort = PARCEL_SORTS[req.query.sort] ?? PARCEL_SORTS.minute
    const dir = req.query.dir === 'desc' ? 'DESC' : 'ASC'
    const per = toInt(req.query.per, 25, 5, 100)
    const page = toInt(req.query.page, 1, 1, 10000)

    const [total, items] = await Promise.all([
      one(`SELECT COUNT(*) n FROM parcels p JOIN regions r ON r.id = p.region_id WHERE ${clause.sql}`, clause.params),
      rows(
        `SELECT p.id, p.minute_no, p.is_damaged, p.kashf16_ref, p.land_status, p.minute_area, p.total_area, p.total_shares,
                p.k16_value_usd, p.sankari_value_usd, p.asali_value_usd, p.first_purchase_date, p.acquisition_method,
                r.id region_id, r.name_ar region, g.code group_code, g.name_ar group_name,
                p.property_type, p.kashf16_ref,
                (SELECT COUNT(*) FROM annotations a WHERE a.parcel_id = p.id) annotation_count,
                CASE WHEN p.kashf16_ref IS NULL THEN p.k16_value_usd
                     ELSE (SELECT SUM(x.k16_value_usd) FROM parcels x WHERE x.kashf16_ref = p.kashf16_ref) END operation_value,
                (SELECT COUNT(*) FROM parcels x WHERE x.kashf16_ref = p.kashf16_ref) operation_minutes
         FROM parcels p JOIN regions r ON r.id = p.region_id JOIN ownership_groups g ON g.code = p.ownership_group
         WHERE ${clause.sql}
         ORDER BY ${sort} IS NULL, ${sort} ${dir}, p.id
         LIMIT ? OFFSET ?`,
        [...clause.params, per, (page - 1) * per],
      ),
    ])
    res.json({ data: { total: total.n, page, per, items } })
  })

  router.get('/parcels/:id', async (req, res) => {
    const id = toInt(req.params.id, 0, 0, 1e9)
    const parcel = await one(
      `SELECT p.*, r.name_ar region, g.name_ar group_name FROM parcels p
       JOIN regions r ON r.id = p.region_id JOIN ownership_groups g ON g.code = p.ownership_group WHERE p.id = ?`,
      [id],
    )
    if (!parcel) return res.status(404).json({ message: 'العقار غير موجود.' })
    const [{ n: annotationCount }] = await rows('SELECT COUNT(*) n FROM annotations WHERE parcel_id = ?', [id])
    const [owners, purchases, annotations, regionStats] = await Promise.all([
      rows('SELECT seq, owner_name, shares, area FROM parcel_owners WHERE parcel_id = ? ORDER BY seq', [id]),
      rows('SELECT seq, purchase_date, date_raw, purchased_by, channel FROM purchases WHERE parcel_id = ? ORDER BY seq', [id]),
      rows(
        `SELECT a.seq, a.ref_no, a.ref_date, a.ref_year, a.ref_date_raw, a.placed_by, a.category, c.name_ar category_name,
                a.category_source, a.placed_on, a.target_party, a.target_shares, a.timing, a.row_sankari_shares, a.row_asali_shares,
                CASE WHEN a.ref_no IS NULL THEN 1 ELSE (SELECT COUNT(DISTINCT x.parcel_id) FROM annotations x JOIN parcels q ON q.id = x.parcel_id
                  WHERE q.region_id = ? AND x.ref_no = a.ref_no AND x.placed_by <=> a.placed_by) END case_parcels
         FROM annotations a JOIN annotation_categories c ON c.code = a.category WHERE a.parcel_id = ? ORDER BY a.seq`,
        [parcel.region_id, id],
      ),
      one(
        `SELECT COUNT(*) parcels, SUM(t.n) / COUNT(*) avg_annotations, SUM(t.n > ?) more_annotated,
                (SELECT SUM(k16_value_usd) / SUM(k16_area) FROM parcels WHERE region_id = ? AND k16_value_usd IS NOT NULL AND k16_area > 0) price
         FROM (SELECT p.id, COUNT(a.id) n FROM parcels p LEFT JOIN annotations a ON a.parcel_id = p.id WHERE p.region_id = ? GROUP BY p.id) t`,
        [annotationCount, parcel.region_id, parcel.region_id],
      ),
    ])
    const [operation, extraOperations] = await Promise.all([operationOf(rows, parcel.kashf16_ref), linesOf(rows, id)])
    res.json({ data: { parcel, owners, purchases, annotations, operation, extra_operations: extraOperations, region: { name: parcel.region, ...regionStats } } })
  })

  router.get('/annotations', async (req, res) => {
    const f = readFilters(req.query)
    const dashboard = annotationClause(f)
    const own = annotationTableClause(req.query)
    const clause = { sql: `${dashboard.sql} AND ${own.sql}`, params: [...dashboard.params, ...own.params] }
    const sort = ANNOTATION_SORTS[req.query.sort] ?? ANNOTATION_SORTS.date
    const dir = req.query.dir === 'asc' ? 'ASC' : 'DESC'
    const per = toInt(req.query.per, 25, 5, 100)
    const page = toInt(req.query.page, 1, 1, 10000)
    const from = `FROM annotations a JOIN parcels p ON p.id = a.parcel_id JOIN regions r ON r.id = p.region_id
                  JOIN annotation_categories c ON c.code = a.category WHERE ${clause.sql}`
    const [total, items] = await Promise.all([
      one(`SELECT COUNT(*) n ${from}`, clause.params),
      rows(
        `SELECT a.id, a.parcel_id, a.ref_no, a.ref_date, a.ref_year, a.placed_by, a.category, c.name_ar category_name,
                a.placed_on, a.target_party, a.target_shares, a.timing, p.minute_no, r.name_ar region
         ${from} ORDER BY ${sort} IS NULL, ${sort} ${dir}, a.id LIMIT ? OFFSET ?`,
        [...clause.params, per, (page - 1) * per],
      ),
    ])
    res.json({ data: { total: total.n, page, per, items } })
  })

  registerDocumentRoutes(router, rows)

  app.use('/api/v1', router)
  app.use('/api', (_req, res) => res.status(404).json({ message: 'المسار غير موجود.' }))

  // The built dashboard, when it exists (npm run build in /frontend); during development Vite serves it.
  if (existsSync(DIST)) {
    app.use(express.static(DIST))
    app.get('/{*splat}', (_req, res) => res.sendFile(path.join(DIST, 'index.html')))
  }

  // eslint-disable-next-line no-unused-vars
  app.use((error, _req, res, _next) => {
    console.error(error)
    res.status(500).json({ message: 'حدث خطأ في الخادم أثناء جلب البيانات.' })
  })
  return app
}
