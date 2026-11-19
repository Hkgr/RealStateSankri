import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Card } from '../../../components/ui/Card'
import { Pagination } from '../../../components/ui/Pagination'
import { SearchInput } from '../../../components/ui/SearchInput'
import { SelectField } from '../../../components/ui/SelectField'
import { ErrorState, NoDataState } from '../../../components/ui/StateViews'
import { NoMatchRow, TableToolbar, ToolbarItem } from '../../../components/ui/TableToolbar'
import { formatDate, formatNumber, formatUsd } from '../../../lib/format'
import { ACQUISITION_LABELS, GROUP_COLORS, LAND_STATUS_LABELS } from '../../../lib/labels'
import { useParcels, type ParcelTableFilters, type TableState } from '../queries'
import type { Filters } from '../useDashboardFilters'

interface Column {
  sort: string
  label: string
  hint?: string
}

const COLUMNS: Column[] = [
  { sort: 'region', label: 'المنطقة' },
  { sort: 'minute', label: 'المحضر' },
  { sort: 'group', label: 'الملكية' },
  { sort: 'total_area', label: 'المساحة الإجمالية (م²)' },
  { sort: 'owned_area', label: 'المملوكة (م²)' },
  { sort: 'value', label: 'قيمة العملية (كشف 16) $' },
  { sort: 'sankari_value', label: 'حصة د. سنكري $', hint: 'قيمة الكشف 16 × أسهم سنكري ÷ أسهم العقار؛ تظهر في المحضر الذي كُتبت عليه قيمة العملية' },
  { sort: 'asali_value', label: 'حصة عسلي $', hint: 'قيمة الكشف 16 × أسهم عسلي ÷ أسهم العقار؛ تظهر في المحضر الذي كُتبت عليه قيمة العملية' },
  { sort: 'annotations', label: 'الإشارات' },
  { sort: 'purchase', label: 'أول شراء' },
]

const NO_FILTERS: ParcelTableFilters = { tq: '', ann: '', method: '', buy_year: '' }

export function GroupPill({ code, name }: { code: string; name: string }) {
  const color = GROUP_COLORS[code] ?? '#94a3b8'
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-paper-deep px-2.5 py-0.5 text-xs font-bold text-ink-soft">
      <i className="size-2.5 rounded-full" style={{ background: color }} aria-hidden="true" />
      {name}
    </span>
  )
}

export function ParcelsPanel({ filters, purchaseYears, onReset }: { filters: Filters; purchaseYears: number[]; onReset: () => void }) {
  const [table, setTable] = useState<TableState>({ sort: 'minute', dir: 'asc', page: 1 })
  const [own, setOwn] = useState<ParcelTableFilters>(NO_FILTERS)
  // Bumped to clear the search box, which keeps its own text while typing.
  const [resetCount, setResetCount] = useState(0)
  const query = useParcels(filters, table, own)

  const sortBy = (sort: string) =>
    setTable((current) => ({ sort, dir: current.sort === sort && current.dir === 'asc' ? 'desc' : 'asc', page: 1 }))
  const setFilter = (key: keyof ParcelTableFilters, value: string) => {
    setOwn((current) => ({ ...current, [key]: value }))
    setTable((current) => ({ ...current, page: 1 }))
  }
  const clearFilters = () => {
    setOwn(NO_FILTERS)
    setResetCount((count) => count + 1)
    setTable((current) => ({ ...current, page: 1 }))
  }
  const ownActive = Object.values(own).some((value) => value !== '')

  return (
    <Card title="قائمة العقارات" hint="اضغط على رأس العمود للفرز، وعلى العقار لعرض تفاصيله وإشاراته. القيمة تخص عملية الشراء كلها لا المحضر وحده">
      <TableToolbar label="فلاتر جدول العقارات" matching={query.data?.total ?? 0} active={ownActive} onReset={clearFilters}>
        <ToolbarItem wide>
          <SearchInput key={resetCount} label="بحث في الجدول" placeholder="محضر، منطقة، رقم كشف 16، ملاحظة" value={own.tq} onChange={(value) => setFilter('tq', value)} />
        </ToolbarItem>
        <ToolbarItem>
          <SelectField
            variant="bar"
            label="الإشارات"
            allLabel="الكل"
            value={own.ann}
            onChange={(value) => setFilter('ann', value)}
            options={[
              { value: 'with', label: 'لها إشارات' },
              { value: 'without', label: 'بلا إشارات' },
            ]}
          />
        </ToolbarItem>
        <ToolbarItem>
          <SelectField
            variant="bar"
            label="طريقة انتقال الملكية"
            allLabel="الكل"
            value={own.method}
            onChange={(value) => setFilter('method', value)}
            options={['transfer', 'judgment', 'judgment_then_transfer', 'none'].map((code) => ({ value: code, label: ACQUISITION_LABELS[code] }))}
          />
        </ToolbarItem>
        <ToolbarItem>
          <SelectField
            variant="bar"
            label="سنة أول شراء"
            allLabel="كل السنوات"
            value={own.buy_year}
            onChange={(value) => setFilter('buy_year', value)}
            options={purchaseYears.map((year) => ({ value: String(year), label: String(year) }))}
          />
        </ToolbarItem>
      </TableToolbar>

      {query.isError ? (
        <ErrorState message={query.error.message} onRetry={() => void query.refetch()} compact />
      ) : !query.data ? (
        <div className="skeleton h-96" aria-busy="true" />
      ) : query.data.total === 0 && !ownActive ? (
        <NoDataState onReset={onReset} compact />
      ) : (
        <>
          <div className={`overflow-x-auto rounded-xl border border-line ${query.isFetching ? 'opacity-70' : ''}`}>
            <table className="w-full min-w-[60rem] border-collapse text-sm">
              <thead>
                <tr className="bg-paper-deep text-ink-soft">
                  {COLUMNS.map((column) => {
                    const active = table.sort === column.sort
                    return (
                      <th key={column.sort} scope="col" aria-sort={active ? (table.dir === 'asc' ? 'ascending' : 'descending') : 'none'} className="px-3 py-2.5 text-start font-bold">
                        <button type="button" title={column.hint} onClick={() => sortBy(column.sort)} className="inline-flex cursor-pointer items-center gap-1 whitespace-nowrap hover:text-ink">
                          {column.label}
                          {active ? table.dir === 'asc' ? <ArrowUp className="size-3.5" aria-hidden="true" /> : <ArrowDown className="size-3.5" aria-hidden="true" /> : <ArrowUpDown className="size-3.5 opacity-40" aria-hidden="true" />}
                        </button>
                      </th>
                    )
                  })}
                </tr>
              </thead>
              <tbody>
                {query.data.items.length === 0 && <NoMatchRow columns={COLUMNS.length} />}
                {query.data.items.map((parcel) => (
                  <tr key={parcel.id} className="border-t border-line transition-colors hover:bg-brand-wash">
                    <td className="px-3 py-2 font-semibold text-ink">{parcel.region}</td>
                    <td className="px-3 py-2">
                      <Link to={`/parcels/${parcel.id}`} className="font-bold text-brand-ink underline-offset-4 hover:underline">
                        <span className="num">{parcel.minute_no}</span>
                      </Link>
                      {parcel.is_damaged ? <span className="ms-2 rounded bg-danger-soft px-1.5 py-0.5 text-xs font-bold text-danger">متضرر</span> : null}
                      {parcel.property_type === 'apartment' ? <span className="ms-2 rounded bg-brand-soft px-1.5 py-0.5 text-xs font-bold text-brand-ink">شقة</span> : null}
                    </td>
                    <td className="px-3 py-2">
                      <GroupPill code={parcel.group_code} name={parcel.group_name} />
                    </td>
                    <td className="num px-3 py-2">{formatNumber(parcel.total_area)}</td>
                    <td className="num px-3 py-2">{formatNumber(parcel.minute_area)}</td>
                    <td className="px-3 py-2">
                      <span className="num">{formatUsd(parcel.operation_value)}</span>
                      {parcel.operation_minutes > 1 && (
                        <span className="ms-1.5 text-xs text-ink-muted">
                          عملية <span className="num">{parcel.kashf16_ref}</span> · <span className="num">{parcel.operation_minutes}</span> محضرًا
                        </span>
                      )}
                    </td>
                    <td className="num px-3 py-2">{formatUsd(parcel.sankari_value_usd)}</td>
                    <td className="num px-3 py-2">{formatUsd(parcel.asali_value_usd)}</td>
                    <td className="num px-3 py-2 font-bold">{formatNumber(parcel.annotation_count)}</td>
                    <td className="px-3 py-2 text-ink-soft">
                      <span className="num">{formatDate(parcel.first_purchase_date)}</span>
                      {parcel.acquisition_method && <span className="ms-2 text-xs text-ink-muted">{ACQUISITION_LABELS[parcel.acquisition_method]}</span>}
                      {parcel.land_status && <span className="ms-2 text-xs text-ink-muted">{LAND_STATUS_LABELS[parcel.land_status]}</span>}
                    </td>
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
