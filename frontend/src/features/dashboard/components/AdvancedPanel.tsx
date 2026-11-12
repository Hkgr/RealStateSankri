import { useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { DonutChart, HBarChart, HStackedChart, StackedChart, type ChartItem } from '../../../components/charts/BasicCharts'
import { Card } from '../../../components/ui/Card'
import { ErrorState, NoDataState } from '../../../components/ui/StateViews'
import { formatDecimal, formatNumber, formatPercent, formatUsd, share } from '../../../lib/format'
import { CATEGORY_COLORS } from '../../../lib/labels'
import type { Analytics, Figures } from '../../../services/types'
import { useAnalytics } from '../queries'
import type { Filters } from '../useDashboardFilters'
import { CategoryPill } from './AnnotationsPanel'

const MONTH_DAYS = 30.44
const months = (days: number | null) => (days == null ? null : days / MONTH_DAYS)

function Stat({ label, value, hint }: { label: string; value: ReactNode; hint?: ReactNode }) {
  return (
    <div className="min-w-0 rounded-xl bg-paper px-3.5 py-3">
      <p className="text-xs font-bold text-ink-muted">{label}</p>
      <p className="num mt-0.5 text-xl font-extrabold leading-tight text-ink">{value}</p>
      {hint && <p className="mt-0.5 text-xs leading-5 text-ink-muted">{hint}</p>}
    </div>
  )
}

function Section({ title, hint, children }: { title: string; hint: string; children: ReactNode }) {
  return (
    <section className="grid gap-4">
      <div className="border-s-4 border-brand ps-3">
        <h2 className="text-lg font-extrabold text-ink">{title}</h2>
        <p className="text-sm text-ink-muted">{hint}</p>
      </div>
      <div className="grid gap-4 lg:grid-cols-3">{children}</div>
    </section>
  )
}

type ExposureMetric = 'parcels' | 'total_area' | 'value_usd'
const EXPOSURE_METRICS: { value: ExposureMetric; label: string; unit: string }[] = [
  { value: 'parcels', label: 'عدد العقارات', unit: 'عقار' },
  { value: 'total_area', label: 'المساحة الإجمالية', unit: 'م²' },
  { value: 'value_usd', label: 'القيمة $', unit: 'دولار' },
]

function CasesSection({ cases }: { cases: Analytics['cases'] }) {
  return (
    <Section title="القضايا الفعلية" hint="الإشارة الواحدة تتكرر على عدة عقارات؛ هنا تُحسب القضية مرة واحدة (نفس الرقم والمنطقة والواضع)">
      <Card title="الصفوف مقابل القضايا">
        <div className="grid grid-cols-2 gap-2.5">
          <Stat label="صفوف الإشارات" value={formatNumber(cases.annotation_rows)} />
          <Stat label="قضايا فريدة" value={formatNumber(cases.cases)} />
          <Stat label="متوسط الصفوف لكل قضية" value={formatDecimal(cases.avg_rows_per_case)} />
          <Stat label="قضايا تطال أكثر من عقار" value={formatNumber(cases.multi_parcel_cases)} />
        </div>
      </Card>

      <Card className="lg:col-span-2" title="القضايا بحسب النوع" hint="عدد الصفوف الذي يراه الملف، وعدد القضايا خلفه">
        <div className="overflow-x-auto rounded-xl border border-line">
          <table className="w-full min-w-[28rem] border-collapse text-sm">
            <thead>
              <tr className="bg-paper-deep text-ink-soft">
                <th className="px-3 py-2 text-start font-bold">النوع</th>
                <th className="px-3 py-2 text-start font-bold">صفوف</th>
                <th className="px-3 py-2 text-start font-bold">قضايا</th>
                <th className="px-3 py-2 text-start font-bold">صفوف لكل قضية</th>
              </tr>
            </thead>
            <tbody>
              {cases.by_category.map((c) => (
                <tr key={c.code} className="border-t border-line">
                  <td className="px-3 py-2">
                    <CategoryPill code={c.code} name={c.name} />
                  </td>
                  <td className="num px-3 py-2">{formatNumber(c.rows)}</td>
                  <td className="num px-3 py-2 font-bold">{formatNumber(c.cases)}</td>
                  <td className="num px-3 py-2 text-ink-soft">{c.cases ? formatDecimal(Math.round((c.rows / c.cases) * 10) / 10) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="lg:col-span-3" title="أوسع القضايا انتشارًا" hint="القضايا التي تطال أكبر عدد من العقارات">
        <div className="overflow-x-auto rounded-xl border border-line">
          <table className="w-full min-w-[44rem] border-collapse text-sm">
            <thead>
              <tr className="bg-paper-deep text-ink-soft">
                <th className="px-3 py-2 text-start font-bold">رقم الإشارة</th>
                <th className="px-3 py-2 text-start font-bold">المنطقة</th>
                <th className="px-3 py-2 text-start font-bold">واضع الإشارة</th>
                <th className="px-3 py-2 text-start font-bold">النوع</th>
                <th className="px-3 py-2 text-start font-bold">السنة</th>
                <th className="px-3 py-2 text-start font-bold">عقارات</th>
                <th className="px-3 py-2 text-start font-bold">المساحة (م²)</th>
                <th className="px-3 py-2 text-start font-bold">القيمة $</th>
              </tr>
            </thead>
            <tbody>
              {cases.top.map((c) => (
                <tr key={`${c.region}-${c.ref_no}-${c.placed_by}`} className="border-t border-line">
                  <td className="num px-3 py-2 font-bold text-ink">{c.ref_no}</td>
                  <td className="px-3 py-2 font-semibold">{c.region}</td>
                  <td className="px-3 py-2 text-ink">{c.placed_by ?? '—'}</td>
                  <td className="px-3 py-2">
                    <CategoryPill code={c.category} name={c.category_name} />
                  </td>
                  <td className="num px-3 py-2 text-ink-soft">{c.year ?? '—'}</td>
                  <td className="num px-3 py-2 font-bold">{formatNumber(c.parcels)}</td>
                  <td className="num px-3 py-2">{formatNumber(c.total_area)}</td>
                  <td className="num px-3 py-2">{formatUsd(c.value_usd)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </Section>
  )
}

function ExposureSection({ exposure, totalValue }: { exposure: Analytics['exposure']; totalValue: number | null }) {
  const [metric, setMetric] = useState<ExposureMetric>('parcels')
  const info = EXPOSURE_METRICS.find((m) => m.value === metric) ?? EXPOSURE_METRICS[0]

  const categoryItems: ChartItem[] = exposure.by_category
    .map((c) => ({ key: c.code, label: c.name, value: c[metric] ?? 0, color: CATEGORY_COLORS[c.code] ?? '#64748b' }))
    .filter((i) => i.value > 0)
    .sort((a, b) => b.value - a.value)

  const regionRows = exposure.by_region.map((r) => ({ key: String(r.id), label: r.name }))
  const regionSeries = [
    { key: 'critical', name: 'عليها إشارة حرجة', color: '#be123c', data: exposure.by_region.map((r) => r.critical_parcels) },
    { key: 'other', name: 'إشارات أخرى فقط', color: '#d97706', data: exposure.by_region.map((r) => r.parcels - r.critical_parcels - r.clean_parcels) },
    { key: 'clean', name: 'نظيفة', color: '#0f766e', data: exposure.by_region.map((r) => r.clean_parcels) },
  ]

  return (
    <Section title="التعرّض للإشارات" hint="الإشارات الحرجة: دعوى تحكيمية وإشارة أمنية ودولة / استملاك. أما التصفية وفسخ التسجيل فمسجّلتان لمصلحة د. سنكري">
      <Card title="العقارات والقيمة بحسب الخطورة">
        <div className="grid gap-2.5">
          <Stat
            label="عليها إشارة حرجة"
            value={formatNumber(exposure.critical.parcels)}
            hint={`${formatPercent(share(exposure.critical.parcels, exposure.all.parcels))} من العقارات · ${formatUsd(exposure.critical.value_usd)} (${formatPercent(share(exposure.critical.value_usd, totalValue))} من القيمة)`}
          />
          <Stat
            label="نظيفة (بلا أي إشارة)"
            value={formatNumber(exposure.clean.parcels)}
            hint={`${formatPercent(share(exposure.clean.parcels, exposure.all.parcels))} من العقارات · مساحتها ${formatNumber(exposure.clean.total_area)} م²`}
          />
        </div>
      </Card>

      <Card
        className="lg:col-span-2"
        title="أثر كل نوع من الإشارات"
        hint="العقارات التي عليها إشارة واحدة على الأقل من النوع (العقار الواحد قد يظهر في أكثر من نوع)"
        actions={
          <div role="group" aria-label="مقياس الرسم" className="flex gap-1 rounded-xl bg-paper-deep p-1">
            {EXPOSURE_METRICS.map((m) => (
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
        <HBarChart items={categoryItems} unit={info.unit} format={metric === 'value_usd' ? formatUsd : formatNumber} ariaLabel={`أثر أنواع الإشارات بحسب ${info.label}`} className="h-72" />
      </Card>

      <Card className="lg:col-span-2" title="حالة العقارات في كل منطقة" hint="عدد العقارات: حرجة / أخرى / نظيفة">
        <HStackedChart rows={regionRows} series={regionSeries} unit="عقار" ariaLabel="حالة العقارات في كل منطقة بحسب الإشارات" className="h-96" />
      </Card>

      <Card title="الأكثر تعرّضًا" hint="بعدد الإشارات الحرجة">
        <ol className="grid gap-2">
          {exposure.top_parcels.map((p) => (
            <li key={p.id}>
              <Link to={`/parcels/${p.id}`} className="flex items-center justify-between gap-3 rounded-xl bg-paper px-3 py-2 text-sm transition-colors hover:bg-brand-soft">
                <span className="min-w-0">
                  <span className="block truncate font-bold text-ink">
                    {p.region} · <span className="num">{p.minute_no}</span>
                  </span>
                  <span className="block text-xs text-ink-muted">
                    تحكيم <span className="num">{p.arbitration}</span> · أمنية <span className="num">{p.security}</span> · دولة <span className="num">{p.state}</span>
                  </span>
                </span>
                <span className="num rounded-full bg-danger-soft px-2.5 py-0.5 font-extrabold text-danger">{p.critical}</span>
              </Link>
            </li>
          ))}
        </ol>
      </Card>
    </Section>
  )
}

function PricingSection({ pricing }: { pricing: Analytics['pricing'] }) {
  const regionItems: ChartItem[] = pricing.by_region.map((r) => ({ key: String(r.id), label: `${r.name} (${r.operations})`, value: r.price, color: '#0f766e' }))
  const stats = pricing.stats
  return (
    <Section title="سعر المتر" hint="قيمة عملية الشراء بحسب الكشف 16 مقسومة على مساحتها في الكشف نفسه (الرقم بين قوسين عدد عمليات الشراء)">
      <Card title="مؤشرات السعر ($ للمتر المربع)">
        <div className="grid grid-cols-2 gap-2.5">
          <Stat label="المتوسط المرجّح" value={formatUsd(pricing.weighted_price)} hint="مجموع القيمة ÷ مجموع المساحة" />
          <Stat label="الوسيط" value={formatUsd(stats.median)} hint={`${formatNumber(stats.n)} عملية شراء`} />
          <Stat label="النطاق الوسطي" value={`${formatUsd(stats.p25)} – ${formatUsd(stats.p75)}`} hint="الربيع الأدنى – الأعلى" />
          <Stat label="الأدنى – الأعلى" value={`${formatUsd(stats.min)} – ${formatUsd(stats.max)}`} />
        </div>
      </Card>

      <Card className="lg:col-span-2" title="سعر المتر بحسب المنطقة" hint="متوسط مرجّح بمساحة الكشف 16">
        <HBarChart items={regionItems} unit="دولار / م²" format={formatUsd} ariaLabel="سعر المتر المربع بحسب المنطقة" className="h-80" />
      </Card>

      <Card className="lg:col-span-3" title="تغطية التقييم">
        <div className="grid gap-2.5 sm:grid-cols-3">
          <Stat label="عمليات الشراء ضمن الاختيار" value={formatNumber(pricing.unvalued.total)} />
          <Stat label="عمليات بلا قيمة" value={formatNumber(pricing.unvalued.operations)} hint={pricing.unvalued.operations ? `تضم ${formatNumber(pricing.unvalued.minutes)} محضرًا` : 'كل العمليات مقيَّمة'} />
        </div>
        <p className="mt-3 rounded-xl bg-gold-soft px-3.5 py-2.5 text-sm leading-7 text-ink-soft">
          قيمة العملية ومساحتها تخصان كل محاضرها معًا وتُكتبان على أول محضر فيها؛ لذلك لا يُحسب سعر المتر لكل محضر على حدة بل لكل عملية.
        </p>
      </Card>
    </Section>
  )
}

function LagsSection({ lags }: { lags: Analytics['lags'] }) {
  const p = lags.purchase_to_transfer
  const t = lags.transfer_to_annotation
  const bucketsToChart = (buckets: { key: string; label: string; count: number }[], color: string) => ({
    categories: buckets.map((b) => ({ key: b.key, label: b.label })),
    series: [{ key: 'count', name: 'العدد', color, data: buckets.map((b) => b.count) }],
  })
  const purchase = bucketsToChart(p.buckets, '#0f766e')
  const annotation = bucketsToChart(t.buckets, '#be123c')
  const regionItems: ChartItem[] = p.by_region.map((r) => ({ key: String(r.id), label: `${r.name} (${r.parcels})`, value: r.median, color: '#4f46e5' }))

  return (
    <Section title="الفترات الزمنية" hint="كم يستغرق تسجيل العقار، ومتى تظهر الإشارات بعد انتقال الملكية">
      <Card title="من الشراء إلى الفراغة">
        <div className="grid grid-cols-2 gap-2.5">
          <Stat label="الوسيط (يوم)" value={formatNumber(p.median)} hint={p.median != null ? `≈ ${formatDecimal(Math.round((months(p.median) ?? 0) * 10) / 10)} شهرًا` : undefined} />
          <Stat label="المتوسط (يوم)" value={formatNumber(p.mean)} />
          <Stat label="النطاق الوسطي (يوم)" value={`${formatNumber(p.p25)} – ${formatNumber(p.p75)}`} />
          <Stat label="الأقصر – الأطول (يوم)" value={`${formatNumber(p.min)} – ${formatNumber(p.max)}`} hint={`${formatNumber(p.n)} عقارًا`} />
        </div>
      </Card>

      <Card className="lg:col-span-2" title="توزيع المدة من الشراء إلى الفراغة" hint="عدد العقارات في كل فئة زمنية">
        <StackedChart categories={purchase.categories} series={purchase.series} unit="عقار" ariaLabel="توزيع المدة بين الشراء والفراغة" className="h-64" />
      </Card>

      <Card className="lg:col-span-2" title="متى تُوضع الإشارة؟" hint={`المدة بين الفراغة (أو الحكم) وتاريخ الإشارة؛ ${formatNumber(t.n)} إشارة لها تاريخ كامل · الوسيط ${formatNumber(t.median)} يوم`}>
        {t.n === 0 ? (
          <p className="py-16 text-center text-sm text-ink-muted">لا توجد إشارات بتاريخ كامل ضمن الاختيار الحالي (الباقي مكتوب بالسنة فقط).</p>
        ) : (
          <StackedChart categories={annotation.categories} series={annotation.series} unit="إشارة" ariaLabel="توزيع الإشارات بحسب المدة بعد الفراغة" className="h-64" />
        )}
      </Card>

      <Card title="أبطأ المناطق تسجيلًا" hint="وسيط الأيام من الشراء إلى الفراغة (مناطق فيها 3 عقارات فأكثر)">
        <HBarChart items={regionItems} unit="يوم" ariaLabel="وسيط مدة التسجيل بحسب المنطقة" className="h-64" />
      </Card>
    </Section>
  )
}

function ValueSplit({ figures }: { figures: Figures }) {
  const rest = Math.round(((figures.value_usd ?? 0) - (figures.sankari_value_usd ?? 0) - (figures.asali_value_usd ?? 0)) * 100) / 100
  const items: ChartItem[] = useMemo(() => {
    const sankari = figures.sankari_value_usd ?? 0
    const asali = figures.asali_value_usd ?? 0
    return [
      { key: 'sankari', label: 'حصة د. سنكري', value: sankari, color: '#0f766e' },
      { key: 'asali', label: 'حصة عسلي', value: asali, color: '#c2410c' },
      { key: 'rest', label: 'غير منسوبة لأحد (أراضي ذات مشاكل)', value: rest, color: '#a16207' },
    ].filter((i) => i.value > 0)
  }, [figures, rest])

  return (
    <Section title="توزيع القيمة بين الأطراف" hint="القيمة بحسب الكشف 16 موزّعة على حصة كل شريك">
      <Card title="القيمة بالدولار">
        <DonutChart items={items} unit="دولار" format={formatUsd} ariaLabel="توزيع قيمة الكشف 16 بين الشريكين وغير المنسوب" />
      </Card>
      <Card className="lg:col-span-2" title="كيف تُقرأ">
        <p className="text-sm leading-8 text-ink-soft">
          {rest > 0
            ? 'مجموع حصتي د. سنكري وعسلي أقل من القيمة الإجمالية؛ الفارق هو قيمة العقارات المقيَّمة ضمن «أراضي ذات مشاكل»، وهي لا تُنسب في الملف إلى أي من الطرفين. تُعرض هنا كبند مستقل حتى لا تُحسب ضمن حصة أحدهما.'
            : 'لا توجد قيمة غير منسوبة ضمن الاختيار الحالي: مجموع الحصتين يساوي القيمة الإجمالية.'}
        </p>
      </Card>
    </Section>
  )
}

export function AdvancedPanel({ filters, figures, onReset }: { filters: Filters; figures: Figures; onReset: () => void }) {
  const query = useAnalytics(filters, true)
  const data = query.data

  if (query.isError && !data) return <ErrorState message={query.error.message} onRetry={() => void query.refetch()} />
  if (!data) {
    return (
      <div className="grid gap-4 lg:grid-cols-3" aria-busy="true">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="skeleton h-72" aria-hidden="true" />
        ))}
      </div>
    )
  }
  if (data.exposure.all.parcels === 0) return <NoDataState onReset={onReset} />

  return (
    <div className={`grid gap-8 transition-opacity ${query.isFetching ? 'opacity-70' : ''}`}>
      <CasesSection cases={data.cases} />
      <ExposureSection exposure={data.exposure} totalValue={figures.value_usd} />
      <PricingSection pricing={data.pricing} />
      <LagsSection lags={data.lags} />
      <ValueSplit figures={figures} />
    </div>
  )
}
