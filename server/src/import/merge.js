// A minute ("محضر") is one parcel, and the first row of a minute holds its data. The sheet sometimes
// starts a second block of rows for a minute that was already listed (for instance under another
// ownership label). That block is not a new parcel: its annotation, purchase and owner rows join the
// first block, but its parcel figures are not counted, because figures only count on a minute's first
// row. What was left out is written in the parcel's notes and returned so the totals can be proven.

const GROUP_LABELS = {
  sankari_100: 'د. سنكري 100%',
  joint_75_25: 'د. سنكري 75% + عسلي 25%',
  asali_100: 'عسلي 100%',
  problem: 'أراضي ذات مشاكل',
  unclassified: 'غير مصنّف',
}

// Figures the importer proves against the sheet's column totals.
export const PROVEN_FIGURES = ['minuteArea', 'k16Area', 'k16ValueSyp', 'k16ValueUsd', 'sankariValueUsd', 'asaliValueUsd']
// Other figures that would be ignored along with them, listed in the note so nothing is hidden.
const NOTED_FIGURES = [
  ['totalArea', 'مساحة', 'م²'],
  ['minuteArea', 'الملكية من مساحة المحضر', 'م²'],
  ['k16Area', 'مساحة الكشف 16', 'م²'],
  ['k16ValueUsd', 'قيمة', '$'],
]

const rowsLabel = (parcel) =>
  parcel.sourceRowStart === parcel.sourceRowEnd ? String(parcel.sourceRowStart) : `${parcel.sourceRowStart}–${parcel.sourceRowEnd}`
const format = (value) => Math.round(value).toLocaleString('en-US')

function describe(extra) {
  const parts = [GROUP_LABELS[extra.ownershipGroup] ?? extra.ownershipGroup]
  if (extra.kashf16Ref) parts.push(`الكشف 16 رقم ${extra.kashf16Ref}`)
  for (const [key, label, unit] of NOTED_FIGURES) {
    if (extra[key] != null) parts.push(unit === '$' ? `${label} $${format(extra[key])}` : `${label} ${format(extra[key])} ${unit}`)
  }
  return `صف ${rowsLabel(extra)}: قيد ثانٍ لنفس المحضر، أرقامه غير محتسبة لأن بيانات المحضر في أول صف له (${parts.join('، ')})`
}

function absorb(main, extra) {
  main.isDamaged = main.isDamaged || extra.isDamaged
  main.notes = [main.notes, describe(extra)].filter(Boolean).join(' · ')
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
 * @returns the kept parcels and the proven figures that were left out (to subtract from the sheet totals)
 */
export function mergeRepeatedMinutes(parcels) {
  const byMinute = new Map()
  const kept = []
  const excluded = Object.fromEntries(PROVEN_FIGURES.map((key) => [key, 0]))
  for (const parcel of parcels) {
    parcel.mergedSourceRows = null
    const key = `${parcel.regionName}|${parcel.minuteNo}`
    const main = byMinute.get(key)
    if (!main) {
      byMinute.set(key, parcel)
      kept.push(parcel)
      continue
    }
    for (const figure of PROVEN_FIGURES) excluded[figure] += parcel[figure] ?? 0
    absorb(main, parcel)
  }
  return { parcels: kept, excluded }
}
