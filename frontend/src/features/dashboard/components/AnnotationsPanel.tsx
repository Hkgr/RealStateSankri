import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { DonutChart, HBarChart, HStackedChart, StackedChart, type ChartItem } from '../../../components/charts/BasicCharts'
import { Card } from '../../../components/ui/Card'
import { Pagination } from '../../../components/ui/Pagination'
import { ErrorState, NoDataState } from '../../../components/ui/StateViews'
import { formatDate, formatNumber, formatPercent, share } from '../../../lib/format'
import { CATEGORY_COLORS, TARGET_COLORS, TARGET_LABELS, TIMING_LABELS } from '../../../lib/labels'
import type { Overview } from '../../../services/types'
import { useAnnotations, type TableState } from '../queries'
import type { FilterKey, Filters } from '../useDashboardFilters'
import { useYearSeries } from '../useYearSeries'

interface PanelProps {
  data: Overview
  filters: Filters
  toggle: (key: FilterKey, value: string) => void
  onReset: () => void
}

const SORTS = [
  { sort: 'date', label: 'التاريخ' },
  { sort: 'region', label: 'المنطقة' },
  { sort: 'minute', label: 'المحضر' },
  { sort: 'category', label: 'النوع' },
  { sort: 'placed_by', label: 'واضع الإشارة' },
]

export function CategoryPill({ code, name }: { code: string; name: string }) {
  const color = CATEGORY_COLORS[code] ?? '#64748b'
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-bold" style={{ background: `${color}1a`, color }}>
      <i className="size-2 rounded-full" style={{ background: color }} aria-hidden="true" />
      {name}
    </span>
  )
}

function AnnotationsTable({ filters, onReset }: { filters: Filters; onReset: () => void }) {
  const [table, setTable] = useState<TableState>({ sort: 'date', dir: 'desc', page: 1 })
  const query = useAnnotations(filters, table)
  const sortBy = (sort: string) =>
    setTable((current) => ({ sort, dir: current.sort === sort && current.dir === 'desc' ? 'asc' : 'desc', page: 1 }))

  return (
    <Card title="سجل الإشارات" hint="كل إشارة بمحضرها ومنطقتها، بحسب الفلاتر المطبّقة">
      {query.isError ? (
        <ErrorState message={query.error.message} onRetry={() => void query.refetch()} compact />
      ) : !query.data ? (
        <div className="skeleton h-96" aria-busy="true" />
      ) : query.data.total === 0 ? (
        <NoDataState onReset={onReset} compact />
      ) : (
        <>
          <div className={`overflow-x-auto rounded-xl border border-line ${query.isFetching ? 'opacity-70' : ''}`}>
            <table className="w-full min-w-[56rem] border-collapse text-sm">
              <thead>
                <tr className="bg-paper-deep text-ink-soft">
                  {SORTS.map((column) => {
                    const active = table.sort === column.sort
                    return (
                      <th key={column.sort} scope="col" aria-sort={active ? (table.dir === 'asc' ? 'ascending' : 'descending') : 'none'} className="px-3 py-2.5 text-start font-bold">
                        <button type="button" onClick={() => sortBy(column.sort)} className="inline-flex cursor-pointer items-center gap-1 whitespace-nowrap hover:text-ink">
                          {column.label}
                          {active ? table.dir === 'asc' ? <ArrowUp className="size-3.5" aria-hidden="true" /> : <ArrowDown className="size-3.5" aria-hidden="true" /> : <ArrowUpDown className="size-3.5 opacity-40" aria-hidden="true" />}
                        </button>
                      </th>
                    )
                  })}
                  <th scope="col" className="px-3 py-2.5 text-start font-bold">على من وضعت</th>
                  <th scope="col" className="px-3 py-2.5 text-start font-bold">التوقيت</th>
                </tr>
              </thead>
              <tbody>
                {query.data.items.map((a) => (
                  <tr key={a.id} className="border-t border-line align-top transition-colors hover:bg-brand-wash">
                    <td className="px-3 py-2 text-ink-soft">
                      {a.ref_date ? <span className="num">{formatDate(a.ref_date)}</span> : a.ref_year ? <span className="num">{a.ref_year}</span> : '—'}
                    </td>
                    <td className="px-3 py-2 font-semibold text-ink">{a.region}</td>
                    <td className="px-3 py-2">
                      <Link to={`/parcels/${a.parcel_id}`} className="font-bold text-brand-ink underline-offset-4 hover:underline">
                        <span className="num">{a.minute_no}</span>
                      </Link>
                    </td>
                    <td className="px-3 py-2">
                      <CategoryPill code={a.category} name={a.category_name} />
                    </td>
                    <td className="px-3 py-2 text-ink">{a.placed_by ?? '—'}</td>
                    <td className="px-3 py-2 text-ink-soft">{a.placed_on ?? '—'}</td>
                    <td className="px-3 py-2 text-ink-muted">{a.timing ? TIMING_LABELS[a.timing] : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={table.page} per={query.data.per} total={query.data.total} onPage={(page) => setTable((current) => ({ ...current, page }))} />
        </>
      )}
    </Card>
  )
}

export function AnnotationsPanel({ data, filters, toggle, onReset }: PanelProps) {
  const total = data.figures.annotations
  const { categories, series } = useYearSeries(data)

  const placerItems: ChartItem[] = data.top_placers.map((p, i) => ({ key: `${i}-${p.name}`, label: p.name, value: p.annotations, color: CATEGORY_COLORS[p.category] ?? '#64748b' }))
  const timingItems: ChartItem[] = data.timing.map((t) => ({ key: t.code, label: TIMING_LABELS[t.code] ?? t.code, value: t.annotations, color: t.code === 'unknown' ? '#94a3b8' : '#0f766e' }))
  const targetItems: ChartItem[] = data.target_party.map((t) => ({ key: t.code, label: TARGET_LABELS[t.code] ?? t.code, value: t.annotations, color: TARGET_COLORS[t.code] ?? '#94a3b8' }))

  const regionRows = useMemo(() => data.by_region.filter((r) => r.annotations > 0).sort((a, b) => b.annotations - a.annotations), [data.by_region])
  const regionSeries = data.annotations_by_category.map((c) => ({
    key: c.code,
    name: c.name,
    color: CATEGORY_COLORS[c.code] ?? '#64748b',
    data: regionRows.map((r) => data.region_category.find((x) => x.region_id === r.id && x.category === c.code)?.annotations ?? 0),
  }))

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="grid gap-3 sm:grid-cols-2 lg:col-span-3 lg:grid-cols-6">
        {data.annotations_by_category.map((c) => {
          const selected = filters.category === c.code
          return (
            <button
              key={c.code}
              type="button"
              aria-pressed={selected}
              onClick={() => toggle('category', c.code)}
              className={`cursor-pointer rounded-2xl border bg-surface p-3.5 text-start shadow-card transition-all hover:-translate-y-0.5 hover:shadow-lift ${selected ? 'border-brand ring-2 ring-brand/30' : 'border-line'}`}
            >
              <span className="flex items-center gap-2 text-sm font-bold text-ink-soft">
                <i className="size-3 rounded-[4px]" style={{ background: CATEGORY_COLORS[c.code] }} aria-hidden="true" />
                {c.name}
              </span>
              <span className="num mt-1 block text-2xl font-extrabold text-ink">{formatNumber(c.annotations)}</span>
              <span className="num text-xs text-ink-muted">{formatPercent(share(c.annotations, total))} من الإشارات</span>
            </button>
          )
        })}
      </div>

      <Card className="lg:col-span-2" title="مسار الإشارات بالسنوات" hint="خطّ لكل نوع، اضغط على سنة لتصفيتها">
        <StackedChart kind="line" categories={categories} series={series} selected={filters.year} onSelect={(key) => toggle('year', key)} unit="إشارة" ariaLabel="عدد الإشارات في كل سنة بحسب النوع" />
      </Card>

      <Card title="على من وُضعت الإشارة" hint="حصة د. سنكري أم عسلي أم طرف آخر">
        <DonutChart items={targetItems} unit="إشارة" ariaLabel="الإشارات بحسب الطرف المتأثر" />
      </Card>

      <Card className="lg:col-span-2" title="أكثر واضعي الإشارات" hint="لون الشريط هو نوع الإشارة">
        <HBarChart items={placerItems} unit="إشارة" ariaLabel="أكثر واضعي الإشارات عددًا" className="h-[26rem]" />
      </Card>

      <Card title="توقيت الإشارة" hint="قبل/بعد انتقال الملكية إلى د. سنكري">
        <HBarChart items={timingItems} unit="إشارة" ariaLabel="الإشارات بحسب توقيتها" className="h-72" />
      </Card>

      <Card className="lg:col-span-3" title="الإشارات في كل منطقة" hint="موزّعة على الأنواع">
        <HStackedChart rows={regionRows.map((r) => ({ key: String(r.id), label: r.name }))} series={regionSeries} unit="إشارة" ariaLabel="الإشارات في كل منطقة بحسب النوع" className="h-96" />
      </Card>

      <div className="lg:col-span-3">
        <AnnotationsTable filters={filters} onReset={onReset} />
      </div>
    </div>
  )
}
