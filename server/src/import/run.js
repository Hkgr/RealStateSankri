// Rebuilds the database from the Excel sheet:  npm run db:import  (add -- --dry-run to only parse)
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import mysql from 'mysql2/promise'
import XLSX from 'xlsx'
import { dbConfig } from '../db.js'
import { buildModel, sheetTotals } from './build.js'

const dryRun = process.argv.includes('--dry-run')
const OWNER_VALUES = ['sankariValueUsd', 'asaliValueUsd']
const OWNER_VALUE_TOLERANCE = 25 // dollars across the whole file
const here = path.dirname(fileURLToPath(import.meta.url))
const source = path.resolve(here, '../..', process.env.SOURCE_XLSX ?? '../تجميع اراضي.xlsx')

const workbook = XLSX.readFile(source)
const sheetRows = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { header: 1, defval: null })
const { parcels, excluded, warnings } = buildModel(sheetRows)
const totals = sheetTotals(sheetRows)

const count = (pick) => parcels.reduce((total, parcel) => total + pick(parcel).length, 0)
console.log(`الملف: ${source}`)
console.log(`عقارات: ${parcels.length} · إشارات: ${count((p) => p.annotations)} · عقود شراء: ${count((p) => p.purchases)} · مالكون مسجلون: ${count((p) => p.owners)}`)
for (const warning of warnings) console.warn(`تحذير: ${warning}`)
if (dryRun) process.exit(0)

const { database, ...server } = dbConfig
const connection = await mysql.createConnection({ ...server, charset: 'utf8mb4', multipleStatements: true, decimalNumbers: true })
try {
  await connection.query(`CREATE DATABASE IF NOT EXISTS \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`)
  await connection.query(`USE \`${database}\``)
  await connection.query(readFileSync(path.join(here, '../../sql/schema.sql'), 'utf8'))

  await connection.beginTransaction()
  const regionIds = new Map()
  for (const name of [...new Set(parcels.map((p) => p.regionName))].sort((a, b) => a.localeCompare(b, 'ar'))) {
    const [result] = await connection.execute('INSERT INTO regions (name_ar) VALUES (?)', [name])
    regionIds.set(name, result.insertId)
  }

  for (const p of parcels) {
    const [result] = await connection.execute(
      `INSERT INTO parcels (region_id, minute_no, minute_base, property_type, is_damaged, ownership_group, kashf16_ref, land_status,
         registry_status, asali_registered_on, asali_registered_raw, first_purchase_date, acquisition_method,
         transfer_date, judgment_date, transfer_raw, minute_area, total_area, total_shares, sankari_shares,
         asali_shares, k16_area, k16_value_syp, k16_value_usd, sankari_value_usd, asali_value_usd, notes,
         source_row_start, source_row_end, merged_source_rows)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [regionIds.get(p.regionName), p.minuteNo, p.minuteBase, p.propertyType, p.isDamaged ? 1 : 0, p.ownershipGroup, p.kashf16Ref,
        p.landStatus, p.registryStatus, p.asaliRegisteredOn, p.asaliRegisteredRaw, p.firstPurchaseDate,
        p.acquisitionMethod, p.transferDate, p.judgmentDate, p.transferRaw, p.minuteArea, p.totalArea, p.totalShares,
        p.sankariShares, p.asaliShares, p.k16Area, p.k16ValueSyp, p.k16ValueUsd, p.sankariValueUsd, p.asaliValueUsd,
        p.notes, p.sourceRowStart, p.sourceRowEnd, p.mergedSourceRows],
    )
    const parcelId = result.insertId
    for (const l of p.operationLines ?? []) {
      await connection.execute(
        `INSERT INTO operation_lines (parcel_id, kashf16_ref, ownership_group, total_area, k16_area, k16_value_syp, k16_value_usd,
           sankari_value_usd, asali_value_usd, source_row, source_row_end) VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
        [parcelId, l.kashf16Ref, l.ownershipGroup, l.totalArea, l.k16Area, l.k16ValueSyp, l.k16ValueUsd, l.sankariValueUsd,
          l.asaliValueUsd, l.sourceRow, l.sourceRowEnd],
      )
    }
    for (const o of p.owners) {
      await connection.execute(
        'INSERT INTO parcel_owners (parcel_id, seq, owner_name, shares, area, source_row) VALUES (?,?,?,?,?,?)',
        [parcelId, o.seq, o.name, o.shares, o.area, o.sourceRow],
      )
    }
    for (const u of p.purchases) {
      await connection.execute(
        'INSERT INTO purchases (parcel_id, seq, purchase_date, date_raw, purchased_by, channel, source_row) VALUES (?,?,?,?,?,?,?)',
        [parcelId, u.seq, u.date, u.dateRaw, u.purchasedBy, u.channel, u.sourceRow],
      )
    }
    for (const a of p.annotations) {
      await connection.execute(
        `INSERT INTO annotations (parcel_id, seq, ref_no, ref_date, ref_year, ref_date_raw, placed_by, category,
           category_source, placed_on, target_party, target_shares, timing, row_sankari_shares, row_asali_shares, source_row)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [parcelId, a.seq, a.refNo, a.refDate, a.refYear, a.refDateRaw, a.placedBy, a.category, a.categorySource,
          a.placedOn, a.targetParty, a.targetShares, a.timing, a.rowSankariShares, a.rowAsaliShares, a.sourceRow],
      )
    }
  }
  await connection.commit()

  // Prove the database holds exactly what the sheet holds.
  // Totals count the parcels and the Kashf 16 lines kept under them.
  const [[db]] = await connection.query(`
    SELECT
      (SELECT SUM(k16_value_usd) FROM parcels) + (SELECT COALESCE(SUM(k16_value_usd), 0) FROM operation_lines) k16ValueUsd,
      (SELECT SUM(sankari_value_usd) FROM parcels) + (SELECT COALESCE(SUM(sankari_value_usd), 0) FROM operation_lines) sankariValueUsd,
      (SELECT SUM(asali_value_usd) FROM parcels) + (SELECT COALESCE(SUM(asali_value_usd), 0) FROM operation_lines) asaliValueUsd,
      (SELECT SUM(k16_value_syp) FROM parcels) + (SELECT COALESCE(SUM(k16_value_syp), 0) FROM operation_lines) k16ValueSyp,
      (SELECT SUM(k16_area) FROM parcels) + (SELECT COALESCE(SUM(k16_area), 0) FROM operation_lines) k16Area,
      (SELECT SUM(minute_area) FROM parcels) minuteArea,
      (SELECT COUNT(*) FROM annotations) annotationRows, (SELECT COUNT(*) FROM purchases) purchaseRows`)
  let ok = true
  // Figures on a minute's later rows are not counted (the first row holds the data), so they are taken off the sheet totals.
  const left = (key) => excluded[key] ?? 0
  for (const key of Object.keys(totals)) {
    const expected = totals[key] - left(key)
    // Each owner's value is computed from the shares, so it may differ a little from the sheet's rounded 75/25 columns.
    const tolerance = OWNER_VALUES.includes(key) ? OWNER_VALUE_TOLERANCE : 0.01
    const gap = Number(db[key]) - expected
    const same = Math.abs(gap) < tolerance
    ok &&= same
    const note = OWNER_VALUES.includes(key) ? ` · فرق ${gap.toFixed(2)} (الحساب بالأسهم)` : ''
    console.log(`${same ? '✓' : '✗'} ${key}: الملف ${totals[key]}${left(key) ? ` − مستبعد ${left(key)}` : ''} · القاعدة ${Number(db[key])}${note}`)
  }
  const sum = (key) => parcels.reduce((total, parcel) => total + (parcel[key] ?? 0), 0)
  console.log(`قيمة المالكين بالأسهم لـ ${parcels.filter((p) => p.valueByShares).length} عقارًا، والباقي من أعمدة الملف. سنكري + عسلي = ${(sum('sankariValueUsd') + sum('asaliValueUsd')).toFixed(2)}`)
  if (!ok) throw new Error('إجماليات القاعدة لا تطابق الملف')
  console.log(`تم الاستيراد إلى ${database}`)
} catch (error) {
  await connection.rollback().catch(() => {})
  throw error
} finally {
  await connection.end()
}
