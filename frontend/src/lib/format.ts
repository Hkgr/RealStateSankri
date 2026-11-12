// Latin digits with thousands separators everywhere.
const integer = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 })
const decimal = new Intl.NumberFormat('en-US', { maximumFractionDigits: 3 })
const percent = new Intl.NumberFormat('en-US', { maximumFractionDigits: 1, minimumFractionDigits: 1 })
const compact = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 })

export const NO_DATA = '—'

/** Absence (null) is shown as a dash, never as 0. */
export function formatNumber(value: number | null | undefined): string {
  return value == null ? NO_DATA : integer.format(value)
}

export function formatDecimal(value: number | null | undefined): string {
  return value == null ? NO_DATA : decimal.format(value)
}

export function formatCompact(value: number | null | undefined): string {
  return value == null ? NO_DATA : compact.format(value)
}

export function formatUsd(value: number | null | undefined): string {
  return value == null ? NO_DATA : `$${integer.format(value)}`
}

export function formatPercent(value: number | null | undefined): string {
  return value == null ? NO_DATA : `${percent.format(value)}%`
}

export function share(part: number | null | undefined, whole: number | null | undefined): number | null {
  return part == null || !whole ? null : (part / whole) * 100
}

const MONTH_NAMES = ['كانون الثاني', 'شباط', 'آذار', 'نيسان', 'أيار', 'حزيران', 'تموز', 'آب', 'أيلول', 'تشرين الأول', 'تشرين الثاني', 'كانون الأول']

/** "2008-09-16" → "16/09/2008". */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return NO_DATA
  const [year, month, day] = iso.slice(0, 10).split('-')
  return `${day}/${month}/${year}`
}

/** "2008-09" → "أيلول 2008". */
export function formatMonth(month: string): string {
  const [year, m] = month.split('-')
  return `${MONTH_NAMES[Number(m) - 1] ?? m} ${year}`
}
