// A minute ("محضر") is one parcel, and the first row of a minute holds its data. The sheet sometimes
// starts a second block of rows for a minute that was already listed (for instance under another
// ownership label). That block is not a new parcel: its annotation, purchase and owner rows join the
// first block, and the parcel's own figures stay those of its first row.
//
// If the repeated block carries a different Kashf 16 number with a value, that line is a purchase
// operation of its own: it is kept as an "operation line" under the minute, so the total value still
// equals the sheet's. Anything else in the block is left out, written in the parcel's notes, and returned
// so the totals can be proven.

const GROUP_LABELS = {
  sankari_100: 'د. سنكري 100%',
  joint_75_25: 'د. سنكري 75% + عسلي 25%',
  asali_100: 'عسلي 100%',
  problem: 'أراضي ذات مشاكل',
  unclassified: 'غير مصنّف',
}

// Figures the importer proves against the sheet's column totals.
export const PROVEN_FIGURES = ['minuteArea', 'k16Area', 'k16ValueSyp', 'k16ValueUsd', 'sankariValueUsd', 'asaliValueUsd']
// What an operation line keeps; the rest of the proven figures can only be left out.
const LINE_FIGURES = ['k16Area', 'k16ValueSyp', 'k16ValueUsd', 'sankariValueUsd', 'asaliValueUsd']
// Figures listed in the note when a block's numbers are left out, so nothing is hidden.
const NOTED_FIGURES = [
  ['totalArea', 'مساحة', 'م²'],
  ['minuteArea', 'الملكية من مساحة المحضر', 'م²'],
  ['k16Area', 'مساحة الكشف 16', 'م²'],
  ['k16ValueUsd', 'قيمة', '$'],
]

const rowsLabel = (parcel) =>
  parcel.sourceRowStart === parcel.sourceRowEnd ? String(parcel.sourceRowStart) : `${parcel.sourceRowStart}–${parcel.sourceRowEnd}`
const format = (value) => Math.round(value).toLocaleString('en-US')

function describe(extra, asLine) {
  const parts = [GROUP_LABELS[extra.ownershipGroup] ?? extra.ownershipGroup]
  if (extra.kashf16Ref) parts.push(`الكشف 16 رقم ${extra.kashf16Ref}`)
  for (const [key, label, unit] of NOTED_FIGURES) {
    if (extra[key] != null) parts.push(unit === '$' ? `${label} $${format(extra[key])}` : `${label} ${format(extra[key])} ${unit}`)
  }
  const what = asLine
    ? 'قيد ثانٍ لنفس المحضر: بيانات المحضر من أول صف له، وسطره يُحتسب عملية شراء مستقلة'
    : 'قيد ثانٍ لنفس المحضر، أرقامه غير محتسبة لأن بيانات المحضر في أول صف له'
  return `صف ${rowsLabel(extra)}: ${what} (${parts.join('، ')})`
}

/** A different Kashf 16 number with a value: a purchase operation of its own. */
const isOwnOperation = (main, extra) =>
  extra.kashf16Ref != null && extra.kashf16Ref !== main.kashf16Ref && (extra.k16ValueUsd != null || extra.k16ValueSyp != null)

function absorb(main, extra, asLine) {
  main.isDamaged = main.isDamaged || extra.isDamaged
  main.notes = [main.notes, describe(extra, asLine)].filter(Boolean).join(' · ')
  main.mergedSourceRows = [main.mergedSourceRows, rowsLabel(extra)].filter(Boolean).join('، ')
  for (const list of ['owners', 'purchases', 'annotations']) {
    main[list].push(...extra[list])
    main[list].forEach((item, index) => (item.seq = index + 1))
  }
  const dates = main.purchases.map((p) => p.date).filter(Boolean).sort()
  main.firstPurchaseDate = dates[0] ?? null
}

/**
 * Folds repeated blocks of a minute into its first block.
 * @returns the kept parcels and the proven figures left out (to subtract from the sheet totals)
 */
export function mergeRepeatedMinutes(parcels) {
  const byMinute = new Map()
  const kept = []
  const excluded = Object.fromEntries(PROVEN_FIGURES.map((key) => [key, 0]))
  for (const parcel of parcels) {
    parcel.mergedSourceRows = null
    parcel.operationLines ??= []
    const key = `${parcel.regionName}|${parcel.minuteNo}`
    const main = byMinute.get(key)
    if (!main) {
      byMinute.set(key, parcel)
      kept.push(parcel)
      continue
    }
    const asLine = isOwnOperation(main, parcel)
    if (asLine) {
      main.operationLines.push({
        kashf16Ref: parcel.kashf16Ref,
        ownershipGroup: parcel.ownershipGroup,
        totalArea: parcel.totalArea,
        sourceRow: parcel.sourceRowStart,
        sourceRowEnd: parcel.sourceRowEnd,
        ...Object.fromEntries(LINE_FIGURES.map((figure) => [figure, parcel[figure]])),
      })
    }
    for (const figure of PROVEN_FIGURES) if (!asLine || !LINE_FIGURES.includes(figure)) excluded[figure] += parcel[figure] ?? 0
    absorb(main, parcel, asLine)
  }
  return { parcels: kept, excluded }
}
