import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Card } from '../../../components/ui/Card'
import { Pagination } from '../../../components/ui/Pagination'
import { SearchInput } from '../../../components/ui/SearchInput'
import { SelectField } from '../../../components/ui/SelectField'
import { ErrorState, NoDataState } from '../../../components/ui/StateViews'
import { NoMatchRow, TableToolbar, ToolbarItem } from '../../../components/ui/TableToolbar'
import { formatDate } from '../../../lib/format'
import { CATEGORY_COLORS, TARGET_LABELS, TIMING_LABELS } from '../../../lib/labels'
import { useAnnotations, type AnnotationTableFilters, type TableState } from '../queries'
import type { Filters } from '../useDashboardFilters'

const SORTS = [
  { sort: 'date', label: 'التاريخ' },
  { sort: 'region', label: 'المنطقة' },
  { sort: 'minute', label: 'المحضر' },
  { sort: 'category', label: 'النوع' },
  { sort: 'placed_by', label: 'واضع الإشارة' },
]

const NO_FILTERS: AnnotationTableFilters = { tq: '', timing: '', target: '', source: '' }

const withUnknown = (labels: Record<string, string>) => [
  ...Object.entries(labels)
    .filter(([code]) => code !== 'unknown')
    .map(([value, label]) => ({ value, label })),
  { value: 'none', label: 'غير محدد' },
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

/** The annotations log: sortable, paged on the server, with its own search and filters on top of the dashboard's. */
export function AnnotationsTable({ filters, onReset }: { filters: Filters; onReset: () => void }) {
  const [table, setTable] = useState<TableState>({ sort: 'date', dir: 'desc', page: 1 })
  const [own, setOwn] = useState<AnnotationTableFilters>(NO_FILTERS)
  // Bumped to clear the search box, which keeps its own text while typing.
  const [resetCount, setResetCount] = useState(0)
  const query = useAnnotations(filters, table, own)

  const sortBy = (sort: string) =>
    setTable((current) => ({ sort, dir: current.sort === sort && current.dir === 'desc' ? 'asc' : 'desc', page: 1 }))
  const setFilter = (key: keyof AnnotationTableFilters, value: string) => {
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
    <Card title="سجل الإشارات" hint="كل إشارة بمحضرها ومنطقتها، بحسب الفلاتر المطبّقة">
      <TableToolbar label="فلاتر سجل الإشارات" matching={query.data?.total ?? 0} active={ownActive} onReset={clearFilters}>
        <ToolbarItem wide>
          <SearchInput key={resetCount} label="بحث في السجل" placeholder="واضع الإشارة، على من وُضعت، محضر، منطقة، رقم الإشارة" value={own.tq} onChange={(value) => setFilter('tq', value)} />
        </ToolbarItem>
        <ToolbarItem>
          <SelectField variant="bar" label="التوقيت" allLabel="الكل" value={own.timing} onChange={(value) => setFilter('timing', value)} options={withUnknown(TIMING_LABELS)} />
        </ToolbarItem>
        <ToolbarItem>
          <SelectField variant="bar" label="على من وُضعت" allLabel="الكل" value={own.target} onChange={(value) => setFilter('target', value)} options={withUnknown(TARGET_LABELS)} />
        </ToolbarItem>
        <ToolbarItem>
          <SelectField
            variant="bar"
            label="مصدر النوع"
            allLabel="الكل"
            value={own.source}
            onChange={(value) => setFilter('source', value)}
            options={[
              { value: 'sheet', label: 'مكتوب في الملف' },
              { value: 'derived', label: 'مستنتج' },
            ]}
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
                  <th scope="col" className="px-3 py-2.5 text-start font-bold">
                    على من وضعت
                  </th>
                  <th scope="col" className="px-3 py-2.5 text-start font-bold">
                    التوقيت
                  </th>
                </tr>
              </thead>
              <tbody>
                {query.data.items.length === 0 && <NoMatchRow columns={SORTS.length + 2} />}
                {query.data.items.map((a) => (
                  <tr key={a.id} className="border-t border-line align-top transition-colors hover:bg-brand-wash">
                    <td className="px-3 py-2 text-ink-soft">{a.ref_date ? <span className="num">{formatDate(a.ref_date)}</span> : a.ref_year ? <span className="num">{a.ref_year}</span> : '—'}</td>
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
