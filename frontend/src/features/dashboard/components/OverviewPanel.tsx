import { useMemo, useState } from 'react'
import { DonutChart, HBarChart, StackedChart, type ChartItem } from '../../../components/charts/BasicCharts'
import { Card } from '../../../components/ui/Card'
import { formatNumber, formatUsd } from '../../../lib/format'
import {
  ACQUISITION_COLORS,
  ACQUISITION_LABELS,
  CATEGORY_COLORS,
  GROUP_COLORS,
  LAND_STATUS_COLORS,
  LAND_STATUS_LABELS,
} from '../../../lib/labels'
import type { Overview } from '../../../services/types'
import { useYearSeries } from '../useYearSeries'
import type { FilterKey, Filters } from '../useDashboardFilters'

type RegionMetric = 'parcels' | 'annotations' | 'total_area' | 'owned_area' | 'value_usd'

const METRICS: { value: RegionMetric; label: string; unit: string; money?: boolean }[] = [
  { value: 'parcels', label: 'عدد العقارات', unit: 'عقار' },
  { value: 'annotations', label: 'الإشارات', unit: 'إشارة' },
  { value: 'total_area', label: 'المساحة الإجمالية', unit: 'م²' },
  { value: 'owned_area', label: 'المساحة المملوكة', unit: 'م²' },
  { value: 'value_usd', label: 'القيمة $', unit: 'دولار', money: true },
]

interface PanelProps {
  data: Overview
  filters: Filters
  toggle: (key: FilterKey, value: string) => void
}

export function OverviewPanel({ data, filters, toggle }: PanelProps) {
  const [metric, setMetric] = useState<RegionMetric>('parcels')
  const metricInfo = METRICS.find((m) => m.value === metric) ?? METRICS[0]

  const regionItems: ChartItem[] = useMemo(
    () =>
      data.by_region
        .map((r) => ({ key: String(r.id), label: r.name, value: r[metric] ?? 0, color: '#0f766e' }))
        .filter((item) => item.value > 0)
        .sort((a, b) => b.value - a.value),
    [data.by_region, metric],
  )
  const groupItems: ChartItem[] = data.by_group.map((g) => ({ key: g.code, label: g.name, value: g.parcels, color: GROUP_COLORS[g.code] ?? '#94a3b8' }))
  const groupValueItems: ChartItem[] = data.by_group
    .filter((g) => (g.value_usd ?? 0) > 0)
    .map((g) => ({ key: g.code, label: g.name, value: g.value_usd ?? 0, color: GROUP_COLORS[g.code] ?? '#94a3b8' }))
  const categoryItems: ChartItem[] = data.annotations_by_category.map((c) => ({ key: c.code, label: c.name, value: c.annotations, color: CATEGORY_COLORS[c.code] ?? '#64748b' }))
  const statusItems: ChartItem[] = data.land_status.map((s) => ({ key: s.code, label: LAND_STATUS_LABELS[s.code] ?? s.code, value: s.parcels, color: LAND_STATUS_COLORS[s.code] ?? '#94a3b8' }))
  const methodItems: ChartItem[] = data.acquisition_methods.map((s) => ({ key: s.code, label: ACQUISITION_LABELS[s.code] ?? s.code, value: s.parcels, color: ACQUISITION_COLORS[s.code] ?? '#94a3b8' }))
  const { categories, series } = useYearSeries(data)

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Card
        className="lg:col-span-2"
        title="المناطق"
        hint="اضغط على منطقة لتصفية اللوحة بها"
        actions={
          <div role="group" aria-label="مقياس الرسم" className="flex flex-wrap gap-1 rounded-xl bg-paper-deep p-1">
            {METRICS.map((m) => (
              <button
                key={m.value}
                type="button"
                aria-pressed={metric === m.value}
                onClick={() => setMetric(m.value)}
                className={`min-h-8 cursor-pointer rounded-lg px-3 text-sm font-bold transition-colors ${metric === m.value ? 'bg-white text-ink shadow-sm' : 'text-ink-muted hover:text-ink'}`}
              >
                {m.label}
              </button>
            ))}
          </div>
        }
      >
        <HBarChart
          items={regionItems}
          selected={filters.region}
          onSelect={(key) => toggle('region', key)}
          unit={metricInfo.unit}
          format={metricInfo.money ? formatUsd : formatNumber}
          className="h-96"
          ariaLabel={`المناطق بحسب ${metricInfo.label}`}
        />
      </Card>

      <Card title="مجموعات الملكية" hint="عدد العقارات في كل مجموعة">
        <DonutChart items={groupItems} selected={filters.group} onSelect={(key) => toggle('group', key)} unit="عقار" ariaLabel="العقارات بحسب مجموعة الملكية" />
      </Card>

      <Card title="أنواع الإشارات" hint="اضغط على نوع لعرض عقاراته فقط">
        <HBarChart items={categoryItems} selected={filters.category} onSelect={(key) => toggle('category', key)} unit="إشارة" ariaLabel="الإشارات بحسب النوع" className="h-72" />
      </Card>

      <Card className="lg:col-span-2" title="الإشارات عبر السنوات" hint="سنة تسجيل الإشارة، موزّعة على أنواعها">
        <StackedChart
          categories={categories}
          series={series}
          selected={filters.year}
          onSelect={(key) => toggle('year', key)}
          unit="إشارة"
          ariaLabel="عدد الإشارات في كل سنة بحسب النوع"
        />
      </Card>

      <Card title="القيمة بحسب الملكية" hint="قيمة عمليات الشراء بالدولار، منسوبة إلى مجموعة أول محضر في كل عملية">
        <HBarChart items={groupValueItems} selected={filters.group} onSelect={(key) => toggle('group', key)} unit="دولار" format={formatUsd} ariaLabel="قيمة الكشف 16 بحسب مجموعة الملكية" className="h-60" />
      </Card>

      <Card title="وضع العقار عند الشراء" hint="التمام أم الشيوع">
        <DonutChart items={statusItems} selected={filters.status} onSelect={(key) => (key === 'full' || key === 'joint') && toggle('status', key)} unit="عقار" ariaLabel="العقارات بحسب وضعها عند الشراء" />
      </Card>

      <Card title="طريقة انتقال الملكية إلى د. سنكري" hint="فراغة أو حكم قضائي">
        <DonutChart items={methodItems} unit="عقار" ariaLabel="العقارات بحسب طريقة انتقال الملكية" />
      </Card>
    </div>
  )
}
