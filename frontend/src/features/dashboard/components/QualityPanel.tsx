import { ChevronDown } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Card } from '../../../components/ui/Card'
import { SearchInput } from '../../../components/ui/SearchInput'
import { ErrorState } from '../../../components/ui/StateViews'
import { NoMatchRow, TableToolbar, ToolbarItem } from '../../../components/ui/TableToolbar'
import { formatNumber, formatPercent, share } from '../../../lib/format'
import { matchesSearch } from '../../../lib/search'
import type { MissingRecord, QualityMetric } from '../../../services/types'
import { useMissing, useOperations, useQuality } from '../queries'
import type { Filters } from '../useDashboardFilters'
import { OperationsReport } from './OperationsReport'

// Lists shorter than this are read at a glance; longer ones get a search box.
const SEARCH_FROM = 10

/** The records that lack the field, with their Excel row, so the count can be checked against the sheet. */
function MissingTable({ items, total, annotation }: { items: MissingRecord[]; total: number; annotation: boolean }) {
  const [search, setSearch] = useState('')
  // Bumped to clear the search box, which keeps its own text while typing.
  const [resetCount, setResetCount] = useState(0)
  const matching = useMemo(
    () => items.filter((item) => matchesSearch(`${item.source_row} ${item.region} ${item.minute_no} ${item.group_name ?? ''} ${item.reason ?? ''} ${item.placed_by ?? ''} ${item.ref_no ?? ''}`, search)),
    [items, search],
  )

  return (
    <div className="mt-3">
      {items.length > SEARCH_FROM && (
        <TableToolbar label="فلاتر قائمة الناقص" matching={matching.length} total={items.length} active={search !== ''}
          onReset={() => {
            setSearch('')
            setResetCount((count) => count + 1)
          }}
        >
          <ToolbarItem wide>
            <SearchInput key={resetCount} label="بحث في القائمة" placeholder="صف، منطقة، محضر، سبب" value={search} onChange={setSearch} delay={150} />
          </ToolbarItem>
        </TableToolbar>
      )}
      <div className="overflow-x-auto rounded-xl border border-line">
        <table className="w-full min-w-[32rem] border-collapse text-sm">
          <thead>
            <tr className="bg-paper-deep text-ink-soft">
              <th className="px-3 py-2 text-start font-bold">صف الإكسل</th>
              <th className="px-3 py-2 text-start font-bold">المنطقة</th>
              <th className="px-3 py-2 text-start font-bold">المحضر</th>
              <th className="px-3 py-2 text-start font-bold">{annotation ? 'واضع الإشارة' : 'الملكية / السبب'}</th>
            </tr>
          </thead>
          <tbody>
            {matching.length === 0 && <NoMatchRow columns={4} />}
            {matching.map((item, index) => (
              <tr key={`${item.source_row}-${index}`} className="border-t border-line">
                <td className="num px-3 py-2 font-bold text-ink">
                  {item.source_row}
                  {item.source_row_end && item.source_row_end !== item.source_row ? `–${item.source_row_end}` : ''}
                </td>
                <td className="px-3 py-2 font-semibold">{item.region}</td>
                <td className="px-3 py-2">
                  <Link to={`/parcels/${item.parcel_id}`} className="font-bold text-brand-ink underline-offset-4 hover:underline">
                    <span className="num">{item.minute_no}</span>
                  </Link>
                </td>
                <td className="px-3 py-2 text-ink-soft">{annotation ? (item.placed_by ?? '—') : item.reason ? <span className="text-ink">{item.reason}</span> : item.group_name}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {total > items.length && <p className="mt-2 text-xs text-ink-muted">يُعرض أول {formatNumber(items.length)} من {formatNumber(total)}.</p>}
    </div>
  )
}

function MissingList({ filters, metric }: { filters: Filters; metric: string }) {
  const query = useMissing(filters, metric, true)
  if (query.isError) return <ErrorState message={query.error.message} onRetry={() => void query.refetch()} compact />
  if (!query.data) return <div className="skeleton h-24" aria-busy="true" />
  return <MissingTable items={query.data.items} total={query.data.total} annotation={query.data.kind === 'annotation'} />
}

function Coverage({ metric, filters, operationsOpen, onToggleOperations }: { metric: QualityMetric; filters: Filters; operationsOpen: boolean; onToggleOperations: () => void }) {
  const [listOpen, setListOpen] = useState(false)
  const missing = metric.applicable - metric.have
  const percent = share(metric.have, metric.applicable) ?? 0
  const tone = percent >= 90 ? 'bg-brand' : percent >= 60 ? 'bg-gold' : 'bg-danger'
  const operations = metric.drill === 'operations'
  const canOpen = operations || missing > 0
  const open = operations ? operationsOpen : listOpen
  const toggle = operations ? onToggleOperations : () => setListOpen((value) => !value)

  return (
    <li className="grid gap-1.5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
        <span className="flex flex-wrap items-center gap-2 font-bold text-ink">
          {metric.label}
          {metric.pending && missing > 0 && <span className="rounded-full bg-gold-soft px-2 py-0.5 text-xs font-bold text-gold">قيد جمع البيانات</span>}
        </span>
        <span className="text-sm text-ink-muted">
          <span className="num font-bold text-ink">{formatNumber(metric.have)}</span> من <span className="num">{formatNumber(metric.applicable)}</span> {metric.unit} ·{' '}
          <span className="num font-bold">{formatPercent(percent)}</span>
        </span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-paper-deep" role="presentation">
        <div className={`h-full rounded-full ${tone}`} style={{ width: `${percent}%` }} />
      </div>
      {metric.applies_to && <p className="text-xs text-ink-muted">ينطبق على: {metric.applies_to}</p>}
      {metric.note && <p className="text-xs leading-5 text-ink-muted">{metric.note}</p>}
      {canOpen ? (
        <>
          <button
            type="button"
            aria-expanded={open}
            onClick={toggle}
            className="inline-flex w-fit cursor-pointer items-center gap-1 rounded-lg text-sm font-bold text-brand-ink hover:underline"
          >
            {open ? 'إخفاء' : 'عرض'} {operations ? 'عمليات الشراء والمحاضر والقيمة' : <>الناقص (<span className="num">{formatNumber(missing)}</span>)</>}
            <ChevronDown className={`size-4 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
          </button>
          {open && !operations && <MissingList filters={filters} metric={metric.key} />}
        </>
      ) : (
        <p className="text-xs font-bold text-brand-ink">مكتمل</p>
      )}
    </li>
  )
}

/** How complete the sheet is for the current selection, measured against the records each field applies to. */
export function QualityPanel({ filters }: { filters: Filters }) {
  const [operationsOpen, setOperationsOpen] = useState(false)
  const query = useQuality(filters)
  const operations = useOperations(filters, operationsOpen)
  if (query.isError && !query.data) return <ErrorState message={query.error.message} onRetry={() => void query.refetch()} />
  if (!query.data) return <div className="skeleton h-96" aria-busy="true" />
  const report = query.data

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card title="اكتمال بيانات العقارات" hint={`${formatNumber(report.parcels_total)} عقارًا ضمن الاختيار الحالي`}>
        <ul className="grid gap-5">
          {report.parcels.map((metric) => (
            <Coverage key={metric.key} metric={metric} filters={filters} operationsOpen={operationsOpen} onToggleOperations={() => setOperationsOpen((value) => !value)} />
          ))}
        </ul>
      </Card>

      <Card title="اكتمال بيانات الإشارات" hint={`${formatNumber(report.annotations_total)} إشارة ضمن الاختيار الحالي`}>
        <ul className="grid gap-5">
          {report.annotations.map((metric) => (
            <Coverage key={metric.key} metric={metric} filters={filters} operationsOpen={operationsOpen} onToggleOperations={() => setOperationsOpen((value) => !value)} />
          ))}
        </ul>
      </Card>

      {operationsOpen && (
        <Card className="lg:col-span-2" title="عمليات الشراء بحسب الكشف 16" hint="كل عملية بعدد محاضرها وقيمتها الإجمالية">
          {operations.isError && !operations.data ? (
            <ErrorState message={operations.error.message} onRetry={() => void operations.refetch()} compact />
          ) : !operations.data ? (
            <div className="skeleton h-40" aria-busy="true" />
          ) : (
            <OperationsReport report={operations.data} charts={false} />
          )}
        </Card>
      )}

      <p className="rounded-xl bg-gold-soft px-4 py-3 text-sm leading-7 text-ink-soft lg:col-span-2">
        كل نسبة تُقاس على السجلات التي ينطبق عليها الحقل: الشقق السكنية حالة خاصة (لا مساحة أرض لها وحصتها 2400 سهم)، ولا يُنتظر عقد شراء لأرض ذات مشاكل لم تُشترَ بعد. القيمة تُقاس لكل عملية شراء في الكشف 16 لأنها تُكتب مرة واحدة على أول محضر فيها. وكل نقص يُعرض مع رقم صفه في ملف الإكسل، وما وُسم «قيد جمع البيانات» ينتظر استكمال الملف. التواريخ تُحسب بالسنة، والتفاصيل (يوم وشهر) محفوظة في القاعدة.
      </p>
    </div>
  )
}
