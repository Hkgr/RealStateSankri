import { useMemo, useState, type ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'
import { DonutChart, HBarChart, type ChartItem } from '../../components/charts/BasicCharts'
import { TimelineChart, type TimelineEvent } from '../../components/charts/TimelineChart'
import { Card } from '../../components/ui/Card'
import { ErrorState } from '../../components/ui/StateViews'
import { SiteHeader } from '../../layout/SiteHeader'
import { formatDate, formatDecimal, formatNumber, formatPercent, formatUsd, share } from '../../lib/format'
import { ACQUISITION_LABELS, CATEGORY_COLORS, CHANNEL_LABELS, LAND_STATUS_LABELS, TARGET_LABELS, TIMING_LABELS } from '../../lib/labels'
import type { ParcelDetail } from '../../services/types'
import { CategoryPill } from '../dashboard/components/AnnotationsPanel'
import { GroupPill } from '../dashboard/components/ParcelsPanel'
import { useParcel } from '../dashboard/queries'

const TOTAL_SHARES = 2400
const CRITICAL = ['arbitration', 'security', 'state']
const OWNER_COLORS = ['#4f46e5', '#0284c7', '#9333ea', '#d97706', '#be123c', '#0f766e', '#65a30d', '#c2410c']
const dash = '—'

const utc = (iso: string) => Date.parse(`${iso.slice(0, 10)}T00:00:00Z`)
const midYear = (year: number) => Date.UTC(year, 6, 1)

function Kpi({ label, value, hint, tone = 'brand' }: { label: string; value: ReactNode; hint?: ReactNode; tone?: 'brand' | 'gold' | 'danger' }) {
  const bar = tone === 'gold' ? 'bg-gold' : tone === 'danger' ? 'bg-danger' : 'bg-brand'
  return (
    <div className="relative min-w-0 overflow-hidden rounded-2xl border border-line bg-surface p-4 shadow-card">
      <span className={`absolute inset-y-0 start-0 w-1 ${bar}`} aria-hidden="true" />
      <p className="text-sm font-semibold text-ink-muted">{label}</p>
      <p className="num mt-0.5 text-2xl font-extrabold leading-tight text-ink">{value}</p>
      {hint && <p className="mt-1 text-xs leading-5 text-ink-muted">{hint}</p>}
    </div>
  )
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0 rounded-xl bg-paper px-3.5 py-2.5">
      <dt className="text-xs font-bold text-ink-muted">{label}</dt>
      <dd className="mt-0.5 break-words text-sm font-semibold text-ink">{children}</dd>
    </div>
  )
}

/** One measure of this parcel against the average of its region, as two bars on a shared scale. */
function Compare({ label, mine, reference, referenceLabel, format }: { label: string; mine: number | null; reference: number | null; referenceLabel: string; format: (value: number) => string }) {
  if (mine == null || reference == null) return null
  const max = Math.max(mine, reference, 1e-9)
  return (
    <li className="grid gap-1.5">
      <p className="text-sm font-bold text-ink">{label}</p>
      {[
        { name: 'هذا العقار', value: mine, color: 'bg-brand' },
        { name: referenceLabel, value: reference, color: 'bg-line-strong' },
      ].map((row) => (
        <div key={row.name} className="grid grid-cols-[6.5rem_1fr_auto] items-center gap-2 text-xs">
          <span className="text-ink-muted">{row.name}</span>
          <span className="h-2.5 overflow-hidden rounded-full bg-paper-deep" role="presentation">
            <span className={`block h-full rounded-full ${row.color}`} style={{ width: `${(row.value / max) * 100}%` }} />
          </span>
          <span className="num font-bold text-ink">{format(row.value)}</span>
        </div>
      ))}
    </li>
  )
}

export function ParcelPage() {
  const { id = '' } = useParams()
  const query = useParcel(id)

  return (
    <div className="min-h-screen">
      <SiteHeader back />
      <main className="mx-auto grid max-w-7xl gap-4 px-4 py-5 sm:px-6">
        {query.isError ? (
          <ErrorState message={query.error.message} onRetry={() => void query.refetch()} />
        ) : !query.data ? (
          <div className="grid gap-4" aria-busy="true">
            <div className="skeleton h-12" />
            <div className="skeleton h-28" />
            <div className="skeleton h-96" />
          </div>
        ) : (
          <ParcelDashboard detail={query.data} />
        )}
      </main>
    </div>
  )
}

function ParcelDashboard({ detail }: { detail: ParcelDetail }) {
  const { parcel: p, owners, purchases, annotations, region, operation } = detail
  const [category, setCategory] = useState('')

  const criticalCount = annotations.filter((a) => CRITICAL.includes(a.category)).length
  const ownedRatio = share(p.minute_area, p.total_area)
  const ours = p.total_shares ?? (p.sankari_shares != null || p.asali_shares != null ? (p.sankari_shares ?? 0) + (p.asali_shares ?? 0) : null)
  // The value belongs to the whole purchase operation (Kashf 16), written once on its first minute.
  const price = operation?.price ?? (p.k16_value_usd != null && p.k16_area ? p.k16_value_usd / p.k16_area : null)
  const value = operation?.value_usd ?? p.k16_value_usd
  const sharesOperation = operation != null && operation.minutes > 1
  const apartment = p.property_type === 'apartment'
  const lagDays = p.transfer_date && p.first_purchase_date ? Math.round((utc(p.transfer_date) - utc(p.first_purchase_date)) / 86_400_000) : null
  const rank = region.more_annotated != null ? region.more_annotated + 1 : null

  // --- ownership of the shares ----------------------------------------------------------------
  const shareItems: ChartItem[] = useMemo(() => {
    const items: ChartItem[] = []
    if (owners.length > 0) {
      owners.forEach((o, i) => o.shares && items.push({ key: `o${o.seq}`, label: o.owner_name, value: o.shares, color: OWNER_COLORS[i % OWNER_COLORS.length] }))
    } else {
      if (p.sankari_shares) items.push({ key: 'sankari', label: 'د. سنكري', value: p.sankari_shares, color: '#0f766e' })
      if (p.asali_shares) items.push({ key: 'asali', label: 'عسلي', value: p.asali_shares, color: '#c2410c' })
      if (!items.length && ours) items.push({ key: 'ours', label: 'حصتنا', value: ours, color: '#0f766e' })
    }
    const named = items.reduce((sum, i) => sum + i.value, 0)
    if (named > 0 && TOTAL_SHARES - named > 0.5) items.push({ key: 'rest', label: owners.length ? 'غير مسجّل في الملف' : 'الغير', value: Math.round((TOTAL_SHARES - named) * 1000) / 1000, color: '#cbd5e1' })
    return items
  }, [owners, p.sankari_shares, p.asali_shares, ours])

  const valueItems: ChartItem[] = [
    { key: 'sankari', label: 'حصة د. سنكري', value: p.sankari_value_usd ?? 0, color: '#0f766e' },
    { key: 'asali', label: 'حصة عسلي', value: p.asali_value_usd ?? 0, color: '#c2410c' },
  ].filter((i) => i.value > 0)

  // --- annotation breakdowns --------------------------------------------------------------------
  const categoryItems: ChartItem[] = useMemo(() => {
    const counts = new Map<string, { name: string; n: number }>()
    for (const a of annotations) counts.set(a.category, { name: a.category_name, n: (counts.get(a.category)?.n ?? 0) + 1 })
    return [...counts.entries()].map(([code, v]) => ({ key: code, label: v.name, value: v.n, color: CATEGORY_COLORS[code] ?? '#64748b' })).sort((a, b) => b.value - a.value)
  }, [annotations])

  const timingItems: ChartItem[] = useMemo(() => {
    const counts = new Map<string, number>()
    for (const a of annotations) counts.set(a.timing ?? 'unknown', (counts.get(a.timing ?? 'unknown') ?? 0) + 1)
    return [...counts.entries()].map(([code, n]) => ({ key: code, label: TIMING_LABELS[code] ?? code, value: n, color: code === 'unknown' ? '#94a3b8' : '#0f766e' })).sort((a, b) => b.value - a.value)
  }, [annotations])

  const placerItems: ChartItem[] = useMemo(() => {
    const counts = new Map<string, { n: number; category: string }>()
    for (const a of annotations) if (a.placed_by) counts.set(a.placed_by, { n: (counts.get(a.placed_by)?.n ?? 0) + 1, category: a.category })
    return [...counts.entries()]
      .map(([name, v]) => ({ key: name, label: name, value: v.n, color: CATEGORY_COLORS[v.category] ?? '#64748b' }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8)
  }, [annotations])

  // --- timeline -------------------------------------------------------------------------------
  const lanes = ['إشارات حرجة', 'إشارات أخرى', 'تسجيل عسلي', 'فراغة', 'حكم', 'شراء']
  const events: TimelineEvent[] = useMemo(() => {
    const list: TimelineEvent[] = []
    for (const u of purchases) if (u.purchase_date) list.push({ time: utc(u.purchase_date), lane: 'شراء', label: 'عقد شراء', color: '#0f766e', detail: u.purchased_by ?? undefined })
    if (p.judgment_date) list.push({ time: utc(p.judgment_date), lane: 'حكم', label: 'حكم قضائي', color: '#c2410c' })
    if (p.transfer_date) list.push({ time: utc(p.transfer_date), lane: 'فراغة', label: 'فراغة لـ د. سنكري', color: '#4f46e5' })
    if (p.asali_registered_on) list.push({ time: utc(p.asali_registered_on), lane: 'تسجيل عسلي', label: 'تسجيل للعسلي', color: '#d97706' })
    for (const a of annotations) {
      const critical = CRITICAL.includes(a.category)
      const base = { lane: critical ? 'إشارات حرجة' : 'إشارات أخرى', label: a.category_name, color: CATEGORY_COLORS[a.category] ?? '#64748b', detail: a.placed_by ?? undefined }
      if (a.ref_date) list.push({ ...base, time: utc(a.ref_date) })
      else if (a.ref_year) list.push({ ...base, time: midYear(a.ref_year), approximate: true })
    }
    return list
  }, [purchases, annotations, p.judgment_date, p.transfer_date, p.asali_registered_on])

  const shown = category ? annotations.filter((a) => a.category === category) : annotations

  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-extrabold text-ink">
          {p.region} · محضر <span className="num">{p.minute_no}</span>
        </h1>
        <GroupPill code={p.ownership_group} name={p.group_name} />
        {p.is_damaged ? <span className="rounded bg-danger-soft px-2 py-0.5 text-sm font-bold text-danger">متضرر</span> : null}
        <span className="text-sm text-ink-muted">
          الصفوف <span className="num">{p.source_row_start}</span>
          {p.source_row_end !== p.source_row_start && (
            <>
              –<span className="num">{p.source_row_end}</span>
            </>
          )}
          {p.merged_source_rows && (
            <>
              {' '}و<span className="num">{p.merged_source_rows}</span>
            </>
          )}{' '}
          في ملف الإكسل
        </span>
      </div>

      <section aria-label="مؤشرات العقار" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <Kpi label="المساحة الإجمالية (م²)" value={formatNumber(p.total_area)} hint={apartment ? 'شقة سكنية: حالة خاصة، لا مساحة أرض' : ownedRatio != null ? `المملوك منها ${formatNumber(p.minute_area)} م² (${formatPercent(ownedRatio)})` : p.minute_area != null ? `المملوك ${formatNumber(p.minute_area)} م²` : undefined} />
        <Kpi label="الحصة السهمية" value={ours != null ? formatDecimal(ours) : owners.length ? `${owners.length} ملّاك` : dash} hint={ours != null ? `${formatPercent(share(ours, TOTAL_SHARES))} من ${formatNumber(TOTAL_SHARES)} سهم` : owners.length ? 'أسهم المالكين المسجّلين' : undefined} />
        <Kpi
          tone="gold"
          label={sharesOperation ? 'قيمة عملية الشراء (كشف 16)' : 'القيمة بحسب الكشف 16'}
          value={formatUsd(value)}
          hint={
            sharesOperation
              ? `العملية رقم ${operation.ref} تضم ${formatNumber(operation.minutes)} محضرًا${price != null ? ` · ${formatUsd(Math.round(price * 100) / 100)} للمتر` : ''}`
              : price != null
                ? `${formatUsd(Math.round(price * 100) / 100)} للمتر المربع`
                : value == null
                  ? 'لا قيمة مسجّلة في الكشف 16'
                  : undefined
          }
        />
        <Kpi tone={criticalCount ? 'danger' : 'brand'} label="الإشارات" value={formatNumber(annotations.length)} hint={annotations.length ? `منها ${formatNumber(criticalCount)} حرجة (تحكيم / أمنية / دولة)` : 'لا إشارات على العقار'} />
        <Kpi label="عقود الشراء" value={formatNumber(purchases.length)} hint={p.first_purchase_date ? `الأول ${formatDate(p.first_purchase_date)}` : undefined} />
        <Kpi label="من الشراء إلى الفراغة" value={lagDays != null ? `${formatNumber(lagDays)} يومًا` : dash} hint={lagDays != null ? `≈ ${formatDecimal(Math.round((lagDays / 30.44) * 10) / 10)} شهرًا` : 'تاريخ الشراء أو الفراغة غير مسجّل'} />
      </section>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="توزيع الأسهم" hint={`العقار الواحد ${formatNumber(TOTAL_SHARES)} سهم`}>
          {shareItems.length ? <DonutChart items={shareItems} unit="سهم" ariaLabel="توزيع أسهم العقار" /> : <p className="py-16 text-center text-sm text-ink-muted">لا توجد أسهم مسجّلة لهذا العقار في الملف.</p>}
        </Card>

        <Card title="القيمة بين الشريكين" hint="بحسب الكشف 16">
          {valueItems.length ? <DonutChart items={valueItems} unit="دولار" format={formatUsd} ariaLabel="توزيع قيمة العقار بين الشريكين" /> : <p className="px-4 py-16 text-center text-sm leading-7 text-ink-muted">{p.k16_value_usd != null ? 'القيمة مسجّلة للعقار لكنها غير منسوبة لأي من الشريكين (أرض ذات مشاكل).' : 'لا توجد قيمة مسجّلة لهذا العقار.'}</p>}
        </Card>

        <Card title="مقارنة بمنطقة العقار" hint={`${region.name}: ${formatNumber(region.parcels)} عقارًا`}>
          <ul className="grid gap-4">
            <Compare label="عدد الإشارات" mine={annotations.length} reference={region.avg_annotations == null ? null : Math.round(region.avg_annotations * 10) / 10} referenceLabel="متوسط المنطقة" format={(v) => formatDecimal(v)} />
            <Compare label="سعر المتر ($)" mine={price == null ? null : Math.round(price * 100) / 100} reference={region.price == null ? null : Math.round(region.price * 100) / 100} referenceLabel="متوسط المنطقة" format={(v) => formatUsd(v)} />
          </ul>
          {rank != null && annotations.length > 0 && (
            <p className="mt-4 rounded-xl bg-paper px-3.5 py-2.5 text-sm leading-7 text-ink-soft">
              يحتل المرتبة <span className="num font-extrabold text-ink">{rank}</span> من <span className="num font-bold">{formatNumber(region.parcels)}</span> في عدد الإشارات داخل المنطقة.
            </p>
          )}
        </Card>
      </div>

      {operation && (
        <Card title="عملية الشراء (الكشف 16)" hint={`رقم ${operation.ref}: القيمة والمساحة مكتوبتان مرة واحدة على أول محضر في العملية`}>
          <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
            <div className="grid grid-cols-2 gap-2.5">
              <Fact label="عدد المحاضر في العملية">
                <span className="num">{formatNumber(operation.minutes)}</span>
              </Fact>
              <Fact label="القيمة الإجمالية">
                <span className="num">{formatUsd(operation.value_usd)}</span>
              </Fact>
              <Fact label="المساحة بحسب الكشف 16 (م²)">
                <span className="num">{formatNumber(operation.k16_area)}</span>
              </Fact>
              <Fact label="سعر المتر ($)">
                <span className="num">{formatUsd(operation.price)}</span>
              </Fact>
            </div>
            <ul className="flex max-h-40 flex-wrap content-start gap-1.5 overflow-y-auto" aria-label="محاضر العملية">
              {operation.minutes_list.map((m) => (
                <li key={m.id}>
                  <Link
                    to={`/parcels/${m.id}`}
                    aria-current={m.id === p.id ? 'page' : undefined}
                    className={`inline-flex min-h-8 items-center gap-1.5 rounded-lg border px-2.5 text-sm font-semibold transition-colors ${
                      m.id === p.id ? 'border-brand bg-brand-soft text-brand-ink' : 'border-line bg-paper text-ink-soft hover:border-brand hover:text-brand-ink'
                    }`}
                    title={m.carries_value ? 'عليه قيمة العملية' : undefined}
                  >
                    <span className="num">{m.minute_no}</span>
                    <span className="text-xs text-ink-muted">{m.region}</span>
                    {m.carries_value ? <span className="rounded bg-gold-soft px-1 text-xs font-bold text-gold">القيمة</span> : null}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </Card>
      )}

      <Card title="الخط الزمني للعقار" hint="الشراء والحكم والفراغة والإشارات؛ الدائرة الفارغة تعني أن السنة فقط معروفة">
        {events.length ? <TimelineChart events={events} lanes={lanes} ariaLabel="الخط الزمني لأحداث العقار" className="h-80" /> : <p className="py-16 text-center text-sm text-ink-muted">لا توجد تواريخ مسجّلة لهذا العقار.</p>}
      </Card>

      {annotations.length > 0 && (
        <div className="grid gap-4 lg:grid-cols-3">
          <Card title="الإشارات بحسب النوع">
            <DonutChart items={categoryItems} selected={category} onSelect={(key) => setCategory((current) => (current === key ? '' : key))} unit="إشارة" ariaLabel="إشارات العقار بحسب النوع" />
          </Card>
          <Card title="توقيت الإشارات" hint="قبل أو بعد الفراغة / الحكم">
            <HBarChart items={timingItems} unit="إشارة" ariaLabel="إشارات العقار بحسب التوقيت" className="h-56" />
          </Card>
          <Card title="واضعو الإشارات" hint="لون الشريط هو نوع الإشارة">
            <HBarChart items={placerItems} unit="إشارة" ariaLabel="واضعو الإشارات على العقار" className="h-72" />
          </Card>
        </div>
      )}

      <Card
        title="سجل الإشارات"
        hint={annotations.length ? `${formatNumber(shown.length)} من ${formatNumber(annotations.length)} إشارة بالترتيب الوارد في الملف` : undefined}
        actions={
          category ? (
            <button type="button" onClick={() => setCategory('')} className="min-h-8 cursor-pointer rounded-full bg-brand-soft px-3 text-sm font-semibold text-brand-ink hover:bg-brand hover:text-white">
              إزالة تصفية النوع ✕
            </button>
          ) : undefined
        }
      >
        {annotations.length === 0 ? (
          <p className="py-8 text-center text-sm text-ink-muted">لا توجد إشارات مسجّلة على هذا العقار.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-line">
            <table className="w-full min-w-[56rem] border-collapse text-sm">
              <thead>
                <tr className="bg-paper-deep text-ink-soft">
                  {['التاريخ', 'رقم الإشارة', 'واضع الإشارة', 'النوع', 'على من وُضعت', 'الأسهم', 'التوقيت', 'تطال'].map((h) => (
                    <th key={h} scope="col" className="px-3 py-2.5 text-start font-bold">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {shown.map((a) => (
                  <tr key={a.seq} className="border-t border-line align-top transition-colors hover:bg-brand-wash">
                    <td className="px-3 py-2 text-ink-soft">
                      <span className="num">{a.ref_date ? formatDate(a.ref_date) : (a.ref_year ?? dash)}</span>
                    </td>
                    <td className="num px-3 py-2">{a.ref_no ?? dash}</td>
                    <td className="px-3 py-2 font-semibold text-ink">{a.placed_by ?? dash}</td>
                    <td className="px-3 py-2">
                      <CategoryPill code={a.category} name={a.category_name} />
                      {a.category_source === 'derived' && <span className="ms-1 text-xs text-ink-muted" title="صُنّف تلقائيًا من نص الإشارة">(مستنتج)</span>}
                    </td>
                    <td className="px-3 py-2 text-ink-soft">{a.placed_on ?? (a.target_party ? TARGET_LABELS[a.target_party] : dash)}</td>
                    <td className="num px-3 py-2">{a.target_shares != null ? formatDecimal(a.target_shares) : dash}</td>
                    <td className="px-3 py-2 text-ink-muted">{a.timing ? TIMING_LABELS[a.timing] : dash}</td>
                    <td className="px-3 py-2 text-ink-soft">{a.case_parcels > 1 ? <span className="rounded-full bg-paper-deep px-2 py-0.5 text-xs font-bold"><span className="num">{a.case_parcels}</span> عقارًا</span> : 'هذا العقار'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="عقود الشراء" hint={purchases.length ? `${formatNumber(purchases.length)} عقد` : undefined}>
          {purchases.length === 0 ? (
            <p className="py-8 text-center text-sm text-ink-muted">لا توجد عقود شراء مسجّلة.</p>
          ) : (
            <ul className="grid gap-2.5 sm:grid-cols-2">
              {purchases.map((u) => (
                <li key={u.seq} className="rounded-xl border border-line bg-paper px-3.5 py-3">
                  <p className="num text-base font-extrabold text-ink">{u.purchase_date ? formatDate(u.purchase_date) : (u.date_raw ?? dash)}</p>
                  <p className="mt-0.5 text-sm text-ink-soft">{u.purchased_by ?? dash}</p>
                  {u.channel && <span className="mt-1.5 inline-block rounded-full bg-brand-soft px-2.5 py-0.5 text-xs font-bold text-brand-ink">{CHANNEL_LABELS[u.channel]}</span>}
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="بيانات الملكية والتسجيل">
          <dl className="grid gap-2.5 sm:grid-cols-2">
            <Fact label="وضع العقار عند الشراء">{p.land_status ? LAND_STATUS_LABELS[p.land_status] : dash}</Fact>
            <Fact label="طريقة انتقال الملكية">{p.acquisition_method ? ACQUISITION_LABELS[p.acquisition_method] : dash}</Fact>
            <Fact label="تاريخ الفراغة"><span className="num">{formatDate(p.transfer_date)}</span></Fact>
            <Fact label="تاريخ الحكم"><span className="num">{formatDate(p.judgment_date)}</span></Fact>
            <Fact label="تاريخ تسجيل العسلي">{p.asali_registered_on ? <span className="num">{formatDate(p.asali_registered_on)}</span> : (p.asali_registered_raw ?? dash)}</Fact>
            <Fact label="الوضع الراهن في الصحيفة العقارية">{p.registry_status ?? dash}</Fact>
            <Fact label="رقم الكشف 16"><span className="num">{p.kashf16_ref ?? dash}</span></Fact>
            <Fact label="المساحة بحسب الكشف 16 (م²)"><span className="num">{formatNumber(p.k16_area)}</span></Fact>
            <Fact label="القيمة بالليرة السورية"><span className="num">{formatNumber(p.k16_value_syp)}</span></Fact>
            <Fact label="أسهم سنكري / عسلي"><span className="num">{formatDecimal(p.sankari_shares)} / {formatDecimal(p.asali_shares)}</span></Fact>
          </dl>
          {p.notes && (
            <p className="mt-3 rounded-xl bg-gold-soft px-3.5 py-2.5 text-sm leading-7 text-ink-soft">
              <b>ملاحظات: </b>
              {p.notes}
            </p>
          )}
        </Card>
      </div>

      {owners.length > 0 && (
        <Card title="المالكون المسجّلون" hint="كما وردوا في الملف لهذا المحضر">
          <div className="overflow-x-auto rounded-xl border border-line">
            <table className="w-full min-w-[28rem] border-collapse text-sm">
              <thead>
                <tr className="bg-paper-deep text-ink-soft">
                  <th className="px-3 py-2 text-start font-bold">المالك</th>
                  <th className="px-3 py-2 text-start font-bold">الأسهم</th>
                  <th className="px-3 py-2 text-start font-bold">النسبة من 2400</th>
                  <th className="px-3 py-2 text-start font-bold">المساحة (م²)</th>
                </tr>
              </thead>
              <tbody>
                {owners.map((o) => (
                  <tr key={o.seq} className="border-t border-line">
                    <td className="px-3 py-2 font-semibold text-ink">{o.owner_name}</td>
                    <td className="num px-3 py-2">{formatDecimal(o.shares)}</td>
                    <td className="num px-3 py-2">{formatPercent(share(o.shares, TOTAL_SHARES))}</td>
                    <td className="num px-3 py-2">{formatNumber(o.area)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <p className="text-center text-xs text-ink-muted">
        <Link to="/" className="font-semibold text-brand-ink underline-offset-4 hover:underline">
          العودة إلى اللوحة الرئيسية
        </Link>
      </p>
    </>
  )
}
