import { RotateCcw, Search, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { SelectField } from '../../../components/ui/SelectField'
import { Button } from '../../../components/ui/Button'
import { LAND_STATUS_LABELS } from '../../../lib/labels'
import type { Meta } from '../../../services/types'
import type { FilterKey, Filters } from '../useDashboardFilters'

interface ExplorerBarProps {
  meta: Meta | undefined
  filters: Filters
  activeCount: number
  onChange: (key: FilterKey, value: string) => void
  onReset: () => void
}

/** Search box that waits for a pause in typing before it filters. */
function MinuteSearch({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const [text, setText] = useState(value)
  useEffect(() => {
    if (text === value) return
    const timer = setTimeout(() => onChange(text.trim()), 350)
    return () => clearTimeout(timer)
  }, [text, value, onChange])

  return (
    <div className="relative">
      <label htmlFor="minute-search" className="mb-1 block text-xs font-bold text-ink-soft">
        بحث برقم المحضر أو الكشف 16
      </label>
      <div className={`flex h-10 items-center rounded-xl border bg-white ${value ? 'border-brand/60 bg-brand-wash' : 'border-line-strong'}`}>
        <Search className="mx-2.5 size-4 shrink-0 text-ink-muted" aria-hidden="true" />
        <input
          id="minute-search"
          type="search"
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="مثال: 1431 أو 29+63"
          className="h-full min-w-0 flex-1 bg-transparent pe-3 text-sm font-semibold text-ink outline-none placeholder:font-normal placeholder:text-ink-muted"
        />
      </div>
    </div>
  )
}

export function ExplorerBar({ meta, filters, activeCount, onChange, onReset }: ExplorerBarProps) {
  const regionName = meta?.regions.find((r) => String(r.id) === filters.region)?.name
  const groupName = meta?.groups.find((g) => g.code === filters.group)?.name
  const categoryName = meta?.categories.find((c) => c.code === filters.category)?.name

  const chips: { key: FilterKey; label: string }[] = [
    filters.region && { key: 'region' as const, label: `المنطقة: ${regionName ?? filters.region}` },
    filters.group && { key: 'group' as const, label: `الملكية: ${groupName ?? filters.group}` },
    filters.category && { key: 'category' as const, label: `نوع الإشارة: ${categoryName ?? filters.category}` },
    filters.year && { key: 'year' as const, label: `سنة الإشارة: ${filters.year}` },
    filters.status && { key: 'status' as const, label: `الوضع: ${LAND_STATUS_LABELS[filters.status] ?? filters.status}` },
    filters.damaged && { key: 'damaged' as const, label: filters.damaged === '1' ? 'متضرر فقط' : 'غير متضرر' },
    filters.q && { key: 'q' as const, label: `بحث: ${filters.q}` },
  ].filter((chip): chip is { key: FilterKey; label: string } => Boolean(chip))

  return (
    <section aria-label="مستكشف البيانات" className="no-print rounded-2xl border border-line bg-surface p-4 shadow-card">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
        <SelectField
          variant="bar"
          label="المنطقة"
          allLabel="كل المناطق"
          value={filters.region}
          onChange={(value) => onChange('region', value)}
          options={(meta?.regions ?? []).map((r) => ({ value: String(r.id), label: `${r.name} (${r.parcels})` }))}
        />
        <SelectField
          variant="bar"
          label="الملكية"
          allLabel="كل المجموعات"
          value={filters.group}
          onChange={(value) => onChange('group', value)}
          options={(meta?.groups ?? []).map((g) => ({ value: g.code, label: `${g.name} (${g.parcels})` }))}
        />
        <SelectField
          variant="bar"
          label="نوع الإشارة"
          allLabel="كل الأنواع"
          value={filters.category}
          onChange={(value) => onChange('category', value)}
          options={(meta?.categories ?? []).map((c) => ({ value: c.code, label: `${c.name} (${c.annotations})` }))}
        />
        <SelectField
          variant="bar"
          label="سنة الإشارة"
          allLabel="كل السنوات"
          value={filters.year}
          onChange={(value) => onChange('year', value)}
          options={(meta?.years ?? []).map((y) => ({ value: String(y.year), label: `${y.year} (${y.annotations})` }))}
        />
        <SelectField
          variant="bar"
          label="وضع العقار عند الشراء"
          allLabel="الكل"
          value={filters.status}
          onChange={(value) => onChange('status', value)}
          options={[
            { value: 'full', label: LAND_STATUS_LABELS.full },
            { value: 'joint', label: LAND_STATUS_LABELS.joint },
          ]}
        />
        <SelectField
          variant="bar"
          label="الضرر"
          allLabel="الكل"
          value={filters.damaged}
          onChange={(value) => onChange('damaged', value)}
          options={[
            { value: '1', label: 'متضرر' },
            { value: '0', label: 'غير متضرر' },
          ]}
        />
        <MinuteSearch key={filters.q} value={filters.q} onChange={(value) => onChange('q', value)} />
      </div>

      {activeCount > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-line pt-3">
          <span className="text-xs font-bold text-ink-muted">الفلاتر المطبّقة:</span>
          {chips.map((chip) => (
            <button
              key={chip.key}
              type="button"
              onClick={() => onChange(chip.key, '')}
              className="inline-flex min-h-8 cursor-pointer items-center gap-1.5 rounded-full bg-brand-soft px-3 text-sm font-semibold text-brand-ink transition-colors hover:bg-brand hover:text-white"
              aria-label={`إزالة الفلتر ${chip.label}`}
            >
              {chip.label}
              <X className="size-3.5" aria-hidden="true" />
            </button>
          ))}
          <Button variant="ghost" onClick={onReset} className="min-h-8 px-2.5">
            <RotateCcw className="size-3.5" aria-hidden="true" />
            مسح الكل
          </Button>
        </div>
      )}
    </section>
  )
}
