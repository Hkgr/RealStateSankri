import { useMemo } from 'react'
import { DonutChart, HBarChart, HStackedChart, StackedChart, type ChartItem } from '../../../components/charts/BasicCharts'
import { Card } from '../../../components/ui/Card'
import { formatNumber, formatPercent, share } from '../../../lib/format'
import { CATEGORY_COLORS, TARGET_COLORS, TARGET_LABELS, TIMING_LABELS } from '../../../lib/labels'
import type { Overview } from '../../../services/types'
import type { FilterKey, Filters } from '../useDashboardFilters'
import { useYearSeries } from '../useYearSeries'
import { AnnotationsTable } from './AnnotationsTable'

interface PanelProps {
  data: Overview
  filters: Filters
  toggle: (key: FilterKey, value: string) => void
  onReset: () => void
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
