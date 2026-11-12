// Turns the sheet's rows into parcels, owners, purchases and annotations.
//
// The sheet is a flat list: each parcel ("محضر") starts a block of rows that share the same
// region, minute number, Kashf-16 reference and ownership label. The first data row of a block
// holds the parcel's figures; the rows under it carry the registry annotations ("إشارات") and,
// for some parcels, further purchase contracts. For the "problem lands" and the unclassified
// parcels the rows list the registered owners instead.
import { mergeRepeatedMinutes } from './merge.js'
import {
  categorize,
  clean,
  landStatus,
  minuteBase,
  ownershipGroup,
  parseDateCell,
  parseTarget,
  parseTiming,
  parseTransfer,
  purchaseChannel,
  toNumber,
} from './parse.js'

// 0-based column indexes of the sheet.
const C = {
  ownership: 0,
  kashf16: 1,
  minute: 3,
  region: 4,
  annNo: 5,
  annDate: 6,
  placedBy: 7,
  annType: 8,
  placedOn: 9,
  asaliRegistered: 10,
  transfer: 11,
  timing: 12,
  purchaseDate: 13,
  purchasedBy: 14,
  landStatus: 15,
  registryStatus: 16,
  minuteArea: 17,
  totalArea: 18,
  totalShares: 19,
  sankariShares: 20,
  asaliShares: 21,
  k16Area: 22,
  k16Syp: 23,
  k16Usd: 24,
  sankariUsd: 25,
  asaliUsd: 26,
  notes: 27,
}

const HEADER_ROWS = 2
const filled = (row, col) => row[col] != null && row[col] !== ''
const anyFilled = (row, cols) => cols.some((col) => filled(row, col))

// Cells that describe the parcel itself (not an annotation or a purchase).
const PARCEL_COLS = [C.asaliRegistered, C.landStatus, C.registryStatus, C.minuteArea, C.totalArea, C.totalShares,
  C.sankariShares, C.asaliShares, C.k16Area, C.k16Syp, C.k16Usd, C.sankariUsd, C.asaliUsd, C.notes]
const ANNOTATION_COLS = [C.annNo, C.annDate, C.placedBy, C.annType, C.placedOn, C.timing]
const PURCHASE_COLS = [C.purchaseDate, C.purchasedBy]
// Parcel columns an annotation row may legitimately carry (shares written next to that annotation).
const ROW_SHARE_COLS = [C.sankariShares, C.asaliShares]

const firstFilled = (rows, col) => rows.find((row) => filled(row, col))?.[col] ?? null

function groupBlocks(rows) {
  const blocks = []
  let current = null
  rows.forEach((row, offset) => {
    const sourceRow = HEADER_ROWS + offset + 1
    if (!row.some((cell) => cell != null && cell !== '')) return
    // The sheet ends with a totals row (figures only, no region or minute number).
    if (!filled(row, C.region) && !filled(row, C.minute)) return
    const key = [C.region, C.minute, C.kashf16, C.ownership].map((col) => clean(row[col])).join('|')
    if (!current || current.key !== key) {
      current = { key, rows: [] }
      blocks.push(current)
    }
    current.rows.push({ row, sourceRow })
  })
  return blocks
}

/**
 * @param {unknown[][]} sheetRows all rows of the sheet, header included (header: 1 layout)
 * @returns the parsed model plus warnings about anything the importer could not place
 */
export function buildModel(sheetRows) {
  const dataRows = sheetRows.slice(HEADER_ROWS, sheetRows.length)
  const blocks = groupBlocks(dataRows)
  const warnings = []
  const parcels = []

  for (const block of blocks) {
    const rows = block.rows.map((entry) => entry.row)
    const first = rows[0]
    const regionName = clean(first[C.region])
    if (!regionName) {
      warnings.push(`صف ${block.rows[0].sourceRow}: بلا اسم منطقة، تم تجاهله`)
      continue
    }

    const group = ownershipGroup(first[C.ownership])
    const listsOwners = group === 'problem' || group === 'unclassified'
    const mainEntry = listsOwners
      ? block.rows[0]
      : (block.rows.find(({ row }) => anyFilled(row, PARCEL_COLS)) ?? block.rows[0])
    const main = mainEntry.row
    // Parcels that list owners spread their figures over the rows; the others keep them on the main row.
    const pick = (col) => (listsOwners ? firstFilled(rows, col) : main[col])

    const minuteNo = String(clean(first[C.minute]) ?? '')
    const transfer = parseTransfer(first[C.transfer])
    const registered = parseDateCell(pick(C.asaliRegistered))
    const parcel = {
      regionName,
      minuteNo,
      minuteBase: minuteBase(minuteNo),
      propertyType: /^شقة/.test(minuteNo) ? 'apartment' : 'land',
      isDamaged: /متضرر/.test(minuteNo),
      ownershipGroup: group,
      kashf16Ref: clean(first[C.kashf16]) == null ? null : String(clean(first[C.kashf16])).replace(/\s*\+\s*/g, '+'),
      landStatus: landStatus(pick(C.landStatus)),
      registryStatus: listsOwners ? null : clean(main[C.registryStatus]),
      asaliRegisteredOn: registered.date,
      asaliRegisteredRaw: registered.raw ?? (registered.year ? String(registered.year) : null),
      acquisitionMethod: transfer.method,
      transferDate: transfer.transferDate,
      judgmentDate: transfer.judgmentDate,
      transferRaw: transfer.raw,
      minuteArea: toNumber(pick(C.minuteArea)),
      totalArea: toNumber(pick(C.totalArea)),
      // On parcels that list owners the "shares" column belongs to each registered owner (see parcel_owners).
      totalShares: listsOwners ? null : toNumber(main[C.totalShares]),
      sankariShares: toNumber(pick(C.sankariShares)),
      asaliShares: toNumber(pick(C.asaliShares)),
      k16Area: toNumber(pick(C.k16Area)),
      k16ValueSyp: toNumber(pick(C.k16Syp)),
      k16ValueUsd: toNumber(pick(C.k16Usd)),
      sankariValueUsd: toNumber(pick(C.sankariUsd)),
      asaliValueUsd: toNumber(pick(C.asaliUsd)),
      notes: clean(pick(C.notes)),
      sourceRowStart: block.rows[0].sourceRow,
      sourceRowEnd: block.rows[block.rows.length - 1].sourceRow,
      owners: [],
      purchases: [],
      annotations: [],
    }

    for (const { row, sourceRow } of block.rows) {
      // Registered owners (parcels with problems / unclassified).
      if (listsOwners && filled(row, C.registryStatus)) {
        parcel.owners.push({
          seq: parcel.owners.length + 1,
          name: clean(row[C.registryStatus]),
          shares: toNumber(row[C.totalShares]),
          area: toNumber(row[C.totalArea]),
          sourceRow,
        })
      }

      // Purchase contracts.
      if (anyFilled(row, PURCHASE_COLS)) {
        const date = parseDateCell(row[C.purchaseDate])
        const by = clean(row[C.purchasedBy])
        parcel.purchases.push({
          seq: parcel.purchases.length + 1,
          date: date.date,
          dateRaw: date.raw ?? (date.year && !date.date ? String(date.year) : null),
          purchasedBy: by == null ? null : String(by).replace(/\s*\/\s*/g, ' / '),
          channel: purchaseChannel(by),
          sourceRow,
        })
      }

      // Registry annotations.
      if (anyFilled(row, ANNOTATION_COLS)) {
        const date = parseDateCell(row[C.annDate])
        const category = categorize(row[C.placedBy], row[C.annType])
        const target = parseTarget(row[C.placedOn])
        parcel.annotations.push({
          seq: parcel.annotations.length + 1,
          refNo: toNumber(row[C.annNo]),
          refDate: date.date,
          refYear: date.year,
          refDateRaw: date.raw,
          placedBy: clean(row[C.placedBy]),
          category: category.code,
          categorySource: category.source,
          placedOn: clean(row[C.placedOn]),
          targetParty: target.party,
          targetShares: target.shares,
          timing: parseTiming(row[C.timing]),
          rowSankariShares: row === main ? null : toNumber(row[C.sankariShares]),
          rowAsaliShares: row === main ? null : toNumber(row[C.asaliShares]),
          sourceRow,
        })
      }

      // Parcel figures that sit on some other row than the main one: only shares beside an annotation are expected.
      if (row !== main && !listsOwners) {
        const stray = PARCEL_COLS.filter((col) => filled(row, col) && !(ROW_SHARE_COLS.includes(col) && anyFilled(row, ANNOTATION_COLS)))
        if (stray.length) warnings.push(`صف ${sourceRow}: خلايا عقار خارج الصف الرئيسي (أعمدة ${stray.join(', ')}) لم تُستورد`)
      }
    }

    // An apartment has no land area; its share is the whole 2400 (stated by the data owner, not written in the sheet).
    if (parcel.propertyType === 'apartment' && parcel.totalShares == null && parcel.sankariShares == null && parcel.asaliShares == null) {
      const split = { sankari_100: [2400, null], joint_75_25: [1800, 600], asali_100: [null, 2400] }[group]
      if (split) {
        parcel.totalShares = 2400
        ;[parcel.sankariShares, parcel.asaliShares] = split
        parcel.notes = [parcel.notes, 'شقة سكنية: الحصة السهمية 2400 بحسب صاحب البيانات (غير مكتوبة في الملف)'].filter(Boolean).join(' · ')
      }
    }

    const dates = parcel.purchases.map((p) => p.date).filter(Boolean).sort()
    parcel.firstPurchaseDate = dates[0] ?? null
    parcels.push(parcel)
  }

  const merged = mergeRepeatedMinutes(parcels)
  return { parcels: merged.parcels, excluded: merged.excluded, warnings }
}

/** Column totals straight from the sheet, used to prove the database holds the same figures. */
export function sheetTotals(sheetRows) {
  const rows = sheetRows.slice(HEADER_ROWS).filter((row) => filled(row, C.region))
  const sum = (col) => rows.reduce((total, row) => total + (toNumber(row[col]) ?? 0), 0)
  return {
    k16ValueUsd: sum(C.k16Usd),
    sankariValueUsd: sum(C.sankariUsd),
    asaliValueUsd: sum(C.asaliUsd),
    k16ValueSyp: sum(C.k16Syp),
    k16Area: sum(C.k16Area),
    minuteArea: sum(C.minuteArea),
    annotationRows: rows.filter((row) => anyFilled(row, ANNOTATION_COLS)).length,
    purchaseRows: rows.filter((row) => anyFilled(row, PURCHASE_COLS)).length,
  }
}
