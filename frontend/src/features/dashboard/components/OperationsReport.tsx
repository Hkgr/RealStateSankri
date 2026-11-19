import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react'
import { useMemo, useState, type ReactNode } from 'react'
import { StackedChart } from '../../../components/charts/BasicCharts'
import { Card } from '../../../components/ui/Card'
import { SearchInput } from '../../../components/ui/SearchInput'
import { SelectField } from '../../../components/ui/SelectField'
import { NoMatchRow, TableToolbar, ToolbarItem } from '../../../components/ui/TableToolbar'
import { formatNumber, formatPercent, formatUsd, share } from '../../../lib/format'
import { matchesSearch } from '../../../lib/search'
import type { OperationRow, OperationsReport as Report } from '../../../services/types'
import { SERIES_COLOR, SERIES_COLOR_ALT } from '../../../lib/labels'

type SortKey = 'ref' | 'minutes' | 'value_usd' | 'sankari_value_usd' | 'asali_value_usd' | 'k16_area' | 'price' | 'purchase_year'

const COLUMNS: { key: SortKey | null; label: string }[] = [
  { key: 'ref', label: 'رقم الكشف 16' },
  { key: null, label: 'المناطق' },
  { key: 'minutes', label: 'عدد المحاضر' },
  { key: 'value_usd', label: 'القيمة $' },
  { key: 'sankari_value_usd', label: 'حصة د. سنكري $' },
  { key: 'asali_value_usd', label: 'حصة عسلي $' },
  { key: 'k16_area', label: 'المساحة (م²)' },
  { key: 'price', label: 'سعر المتر $' },
  { key: 'purchase_year', label: 'سنة أول عقد' },
  { key: null, label: 'الملكية' },
]

function Stat({ label, value, hint }: { label: string; value: ReactNode; hint?: ReactNode }) {
  return (
    <div className="min-w-0 rounded-xl bg-paper px-3.5 py-3">
      <p className="text-xs font-bold text-ink-muted">{label}</p>
      <p className="num mt-0.5 text-xl font-extrabold leading-tight text-ink">{value}</p>
      {hint && <p className="mt-0.5 text-xs leading-5 text-ink-muted">{hint}</p>}
    </div>
  )
}

const compare = (a: OperationRow, b: OperationRow, key: SortKey) => {
  if (key === 'ref') return a.ref.localeCompare(b.ref, 'en', { numeric: true })
  const x = a[key]
  const y = b[key]
  if (x == null && y == null) return 0
  if (x == null) return 1
  if (y == null) return -1
  return x - y
}

const sumOf = (items: OperationRow[], pick: (item: OperationRow) => number | null) => items.reduce((total, item) => total + (pick(item) ?? 0), 0)

/** Purchase operations of Kashf 16: how many, how many minutes in each, and what each is worth. */
export function OperationsReport({ report, charts = true }: { report: Report; charts?: boolean }) {
  const [sort, setSort] = useState<{ key: SortKey; dir: 'asc' | 'desc' }>({ key: 'value_usd', dir: 'desc' })
  const [search, setSearch] = useState('')
  const [year, setYear] = useState('')
  const [size, setSize] = useState('')
  // Bumped to clear the search box, which keeps its own text while typing.
  const [resetCount, setResetCount] = useState(0)
  const { summary, loose, by_year: byYear } = report

  const items = useMemo(() => {
    const matching = report.items.filter(
      (item) =>
        matchesSearch(`${item.ref} ${item.regions} ${item.owners}`, search) &&
        (year === '' || (year === 'none' ? item.purchase_year == null : String(item.purchase_year) === year)) &&
        (size === '' || (size === 'single' ? item.minutes <= 1 : item.minutes > 1)),
    )
    const sorted = [...matching].sort((a, b) => compare(a, b, sort.key))
    return sort.dir === 'desc' ? sorted.reverse() : sorted
  }, [report.items, sort, search, year, size])

  const years = useMemo(() => {
    const categories = byYear.map((row) => ({ key: String(row.year ?? 'none'), label: row.year == null ? 'بلا تاريخ' : String(row.year) }))
    return {
      categories,
      count: [{ key: 'operations', name: 'عمليات الشراء', color: SERIES_COLOR, data: byYear.map((row) => row.operations) }],
      value: [{ key: 'value', name: 'القيمة $', color: SERIES_COLOR_ALT, data: byYear.map((row) => Math.round(row.value_usd)) }],
    }
  }, [byYear])

  const toggleSort = (key: SortKey) => setSort((current) => ({ key, dir: current.key === key && current.dir === 'desc' ? 'asc' : 'desc' }))
  const filtersActive = search !== '' || year !== '' || size !== ''
  const clearFilters = () => {
    setSearch('')
    setYear('')
    setSize('')
    setResetCount((count) => count + 1)
  }
  const yearOptions = [...byYear.filter((row) => row.year != null).map((row) => ({ value: String(row.year), label: String(row.year) })), ...(byYear.some((row) => row.year == null) ? [{ value: 'none', label: 'بلا تاريخ' }] : [])]

  return (
    <div className="grid grid-cols-1 gap-4">
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
        <Stat label="عمليات الشراء" value={formatNumber(summary.operations)} hint={`${formatNumber(summary.valued_operations)} منها مقيَّمة`} />
        <Stat label="المحاضر ضمنها" value={formatNumber(summary.minutes)} hint={summary.operations ? `بمتوسط ${formatNumber(Math.round((summary.minutes / summary.operations) * 10) / 10)} محضر للعملية` : undefined} />
        <Stat label="القيمة الإجمالية" value={formatUsd(summary.value_usd)} hint={`${formatNumber(summary.value_syp)} ل.س`} />
        <Stat label="المساحة بحسب الكشف 16 (م²)" value={formatNumber(summary.k16_area)} />
        <Stat label="حصة د. سنكري" value={formatUsd(summary.sankari_value_usd)} hint={`${formatPercent(share(summary.sankari_value_usd, summary.value_usd))} من القيمة`} />
        <Stat label="حصة عسلي" value={formatUsd(summary.asali_value_usd)} hint={`${formatPercent(share(summary.asali_value_usd, summary.value_usd))} من القيمة`} />
      </div>

      {charts && byYear.length > 0 && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card title="عمليات الشراء بحسب السنة" hint="سنة أول عقد شراء في العملية">
            <StackedChart categories={years.categories} series={years.count} unit="عملية" ariaLabel="عدد عمليات الشراء في كل سنة" className="h-56" />
          </Card>
          <Card title="قيمة عمليات الشراء بحسب السنة" hint="بالدولار">
            <StackedChart categories={years.categories} series={years.value} unit="دولار" ariaLabel="قيمة عمليات الشراء في كل سنة" className="h-56" />
          </Card>
        </div>
      )}

      <div>
        <TableToolbar label="فلاتر جدول عمليات الشراء" matching={items.length} total={report.items.length} active={filtersActive} onReset={clearFilters}>
          <ToolbarItem wide>
            <SearchInput key={resetCount} label="بحث في الجدول" placeholder="رقم الكشف، منطقة، مجموعة ملكية" value={search} onChange={setSearch} delay={150} />
          </ToolbarItem>
          <ToolbarItem>
            <SelectField variant="bar" label="سنة أول عقد" allLabel="كل السنوات" value={year} onChange={setYear} options={yearOptions} />
          </ToolbarItem>
          <ToolbarItem>
            <SelectField
              variant="bar"
              label="حجم العملية"
              allLabel="الكل"
              value={size}
              onChange={setSize}
              options={[
                { value: 'single', label: 'محضر واحد' },
                { value: 'multi', label: 'أكثر من محضر' },
              ]}
            />
          </ToolbarItem>
        </TableToolbar>

        <div className="overflow-x-auto rounded-xl border border-line">
          <table className="w-full min-w-[52rem] border-collapse text-sm">
            <thead>
              <tr className="bg-paper-deep text-ink-soft">
                {COLUMNS.map((column) => {
                  const active = column.key !== null && sort.key === column.key
                  return (
                    <th key={column.label} scope="col" aria-sort={active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : undefined} className="px-3 py-2.5 text-start font-bold">
                      {column.key === null ? (
                        column.label
                      ) : (
                        <button type="button" onClick={() => toggleSort(column.key as SortKey)} className="inline-flex cursor-pointer items-center gap-1 whitespace-nowrap hover:text-ink">
                          {column.label}
                          {active ? sort.dir === 'asc' ? <ArrowUp className="size-3.5" aria-hidden="true" /> : <ArrowDown className="size-3.5" aria-hidden="true" /> : <ArrowUpDown className="size-3.5 opacity-40" aria-hidden="true" />}
                        </button>
                      )}
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody>
              {items.length === 0 && <NoMatchRow columns={COLUMNS.length} />}
              {items.map((item) => (
                <tr key={item.ref} className="border-t border-line transition-colors hover:bg-brand-wash">
                  <td className="num px-3 py-2 font-bold text-ink">{item.ref}</td>
                  <td className="px-3 py-2 text-ink-soft">{item.regions}</td>
                  <td className="num px-3 py-2 font-bold">
                    {item.listed_under ? (
                      <span className="text-xs font-semibold text-ink-muted">
                        تحت محضر <span className="num">{item.listed_under}</span>
                      </span>
                    ) : (
                      formatNumber(item.minutes)
                    )}
                  </td>
                  <td className="num px-3 py-2">{item.valued_minutes > 0 ? formatUsd(item.value_usd) : <span className="rounded bg-danger-soft px-1.5 py-0.5 text-xs font-bold text-danger">بلا قيمة</span>}</td>
                  <td className="num px-3 py-2">{formatUsd(item.sankari_value_usd)}</td>
                  <td className="num px-3 py-2">{formatUsd(item.asali_value_usd)}</td>
                  <td className="num px-3 py-2">{formatNumber(item.k16_area)}</td>
                  <td className="num px-3 py-2">{formatUsd(item.price)}</td>
                  <td className="num px-3 py-2 text-ink-soft">{item.purchase_year ?? '—'}</td>
                  <td className="px-3 py-2 text-xs text-ink-muted">{item.owners}</td>
                </tr>
              ))}
              {items.length > 0 && (
                <tr className="border-t-2 border-line-strong bg-paper font-extrabold text-ink">
                  <td className="px-3 py-2.5">{filtersActive ? 'إجمالي المعروض' : 'الإجمالي'}</td>
                  <td className="px-3 py-2.5" />
                  <td className="num px-3 py-2.5">{formatNumber(sumOf(items, (i) => i.minutes))}</td>
                  <td className="num px-3 py-2.5">{formatUsd(sumOf(items, (i) => i.value_usd))}</td>
                  <td className="num px-3 py-2.5">{formatUsd(sumOf(items, (i) => i.sankari_value_usd))}</td>
                  <td className="num px-3 py-2.5">{formatUsd(sumOf(items, (i) => i.asali_value_usd))}</td>
                  <td className="num px-3 py-2.5">{formatNumber(sumOf(items, (i) => i.k16_area))}</td>
                  <td className="px-3 py-2.5" />
                  <td className="px-3 py-2.5" />
                  <td className="px-3 py-2.5" />
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {loose.minutes > 0 && (
        <p className="rounded-xl bg-gold-soft px-3.5 py-2.5 text-sm leading-7 text-ink-soft">
          خارج عمليات الشراء: <span className="num font-bold">{formatNumber(loose.minutes)}</span> محضرًا بلا رقم في الكشف 16
          {loose.valued_minutes ? (
            <>
              ، منها <span className="num font-bold">{formatNumber(loose.valued_minutes)}</span> لها قيمة مباشرة مجموعها <span className="num font-bold">{formatUsd(loose.value_usd)}</span>، وهي محسوبة في القيمة الإجمالية للوحة.
            </>
          ) : (
            '.'
          )}
        </p>
      )}
    </div>
  )
}
