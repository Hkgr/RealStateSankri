import { useMemo } from 'react'
import { DonutChart, StackedChart, type ChartItem } from '../../../components/charts/BasicCharts'
import { Card } from '../../../components/ui/Card'
import { ErrorState } from '../../../components/ui/StateViews'
import { ACQUISITION_COLORS, ACQUISITION_LABELS, CHANNEL_COLORS, CHANNEL_LABELS, LAND_STATUS_COLORS, LAND_STATUS_LABELS } from '../../../lib/labels'
import type { Overview } from '../../../services/types'
import { useOperations } from '../queries'
import type { FilterKey, Filters } from '../useDashboardFilters'
import { OperationsReport } from './OperationsReport'

interface PanelProps {
  data: Overview
  filters: Filters
  toggle: (key: FilterKey, value: string) => void
}

const CHANNEL_ORDER = ['broker', 'agent', 'principal', 'accounting', 'other', 'unknown']

export function AcquisitionPanel({ data, filters, toggle }: PanelProps) {
  const operations = useOperations(filters)

  // Dates are counted by whole year; the detailed dates stay in the database for when months are needed.
  const purchases = useMemo(() => {
    const years = [...new Set(data.purchases_by_year.map((r) => r.year))].sort((a, b) => a - b)
    const categories = years.map((year) => ({ key: String(year), label: String(year) }))
    const channels = CHANNEL_ORDER.filter((code) => data.purchases_by_year.some((r) => r.channel === code))
    const series = channels.map((code) => ({
      key: code,
      name: CHANNEL_LABELS[code],
      color: CHANNEL_COLORS[code],
      data: years.map((year) => data.purchases_by_year.find((r) => r.year === year && r.channel === code)?.purchases ?? 0),
    }))
    const channelItems: ChartItem[] = channels.map((code) => ({
      key: code,
      label: CHANNEL_LABELS[code],
      value: data.purchases_by_year.filter((r) => r.channel === code).reduce((sum, r) => sum + r.purchases, 0),
      color: CHANNEL_COLORS[code],
    }))
    return { categories, series, channelItems }
  }, [data.purchases_by_year])

  const transfers = useMemo(() => {
    const categories = data.acquisitions_by_year.map((r) => ({ key: String(r.year), label: String(r.year) }))
    return {
      categories,
      series: [
        { key: 'transfers', name: ACQUISITION_LABELS.transfer, color: ACQUISITION_COLORS.transfer, data: data.acquisitions_by_year.map((r) => r.transfers) },
        { key: 'judgments', name: ACQUISITION_LABELS.judgment, color: ACQUISITION_COLORS.judgment, data: data.acquisitions_by_year.map((r) => r.judgments) },
      ],
    }
  }, [data.acquisitions_by_year])

  const statusItems: ChartItem[] = data.land_status.map((s) => ({ key: s.code, label: LAND_STATUS_LABELS[s.code] ?? s.code, value: s.parcels, color: LAND_STATUS_COLORS[s.code] ?? '#94a3b8' }))
  const methodItems: ChartItem[] = data.acquisition_methods.map((s) => ({ key: s.code, label: ACQUISITION_LABELS[s.code] ?? s.code, value: s.parcels, color: ACQUISITION_COLORS[s.code] ?? '#94a3b8' }))

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Card className="lg:col-span-3" title="عمليات الشراء بحسب الكشف 16" hint="كل رقم في الكشف 16 عملية شراء تضم عدة محاضر؛ قيمتها ومساحتها مكتوبتان مرة واحدة على أول محضر فيها">
        {operations.isError && !operations.data ? (
          <ErrorState message={operations.error.message} onRetry={() => void operations.refetch()} compact />
        ) : !operations.data ? (
          <div className="skeleton h-72" aria-busy="true" />
        ) : (
          <OperationsReport report={operations.data} />
        )}
      </Card>

      <Card className="lg:col-span-2" title="عقود الشراء بحسب السنة" hint="كل عقد بسنته، موزّعًا على من أجرى الشراء (التواريخ التفصيلية محفوظة في القاعدة)">
        <StackedChart categories={purchases.categories} series={purchases.series} unit="عقد" ariaLabel="عدد عقود الشراء في كل سنة بحسب من أجرى الشراء" className="h-72" />
      </Card>

      <Card title="من أجرى الشراء" hint="الدلال أم الوكيل أم الأصيل">
        <DonutChart items={purchases.channelItems} unit="عقد" ariaLabel="عقود الشراء بحسب من أجرى الشراء" />
      </Card>

      <Card className="lg:col-span-2" title="انتقال الملكية إلى د. سنكري بحسب السنة" hint="عدد العقارات التي سُجّلت فراغتها أو حكمها في كل سنة">
        <StackedChart categories={transfers.categories} series={transfers.series} unit="عقار" ariaLabel="عدد العقارات التي انتقلت ملكيتها بالفراغة أو بالحكم في كل سنة" className="h-72" />
      </Card>

      <Card title="طريقة انتقال الملكية" hint="فراغة أو حكم قضائي">
        <DonutChart items={methodItems} unit="عقار" ariaLabel="العقارات بحسب طريقة انتقال الملكية" />
      </Card>

      <Card title="وضع العقار عند الشراء" hint="التمام أم الشيوع (اضغط للتصفية)">
        <DonutChart items={statusItems} selected={filters.status} onSelect={(key) => (key === 'full' || key === 'joint') && toggle('status', key)} unit="عقار" ariaLabel="العقارات بحسب وضعها عند الشراء" />
      </Card>

      <Card className="lg:col-span-2" title="كيف تُقرأ هذه الصفحة" hint="مصطلحات الملف">
        <dl className="grid gap-x-6 gap-y-3 text-sm leading-7 sm:grid-cols-2">
          <div>
            <dt className="font-bold text-ink">عملية الشراء (الكشف 16)</dt>
            <dd className="text-ink-muted">رقم البند في الكشف 16 الذي اشتُريت به المحاضر. القيمة تخص العملية كلها لا المحضر الأول وحده.</dd>
          </div>
          <div>
            <dt className="font-bold text-ink">التمام / الشيوع</dt>
            <dd className="text-ink-muted">«اميري / التمام» عقار مفرز بملكية كاملة، و«اميري / الشيوع» عقار على الشيوع مع شركاء. الشقق السكنية حالة خاصة.</dd>
          </div>
          <div>
            <dt className="font-bold text-ink">فراغة / حكم</dt>
            <dd className="text-ink-muted">الفراغة تسجيل البيع لدى السجل العقاري، والحكم قرار قضائي بتثبيت البيع. بعض العقارات سُجّل لها حكم ثم فراغة.</dd>
          </div>
          <div>
            <dt className="font-bold text-ink">عقود الشراء</dt>
            <dd className="text-ink-muted">عقد لكل محضر بتاريخه ومن أجراه؛ «بلا عقد» تعني أن التاريخ أُخذ من المحاسبة.</dd>
          </div>
        </dl>
      </Card>
    </div>
  )
}
