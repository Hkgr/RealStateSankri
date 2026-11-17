import { FilterX } from 'lucide-react'
import type { ReactNode } from 'react'
import { formatNumber } from '../../lib/format'

interface TableToolbarProps {
  /** Names the filter group for screen readers, e.g. "فلاتر جدول العقارات". */
  label: string
  /** The search box and selects. */
  children: ReactNode
  /** Rows matching the filters. */
  matching: number
  /** Rows before the table's own filters, when known. */
  total?: number
  /** True when at least one of the table's filters is set. */
  active: boolean
  onReset: () => void
}

/** The row of filters above a table, with how many rows match and a way to clear them. */
export function TableToolbar({ label, children, matching, total, active, onReset }: TableToolbarProps) {
  return (
    <div role="search" aria-label={label} className="no-print mb-3 flex flex-wrap items-end gap-x-3 gap-y-2.5 rounded-xl bg-paper px-3 py-3">
      {children}
      <div className="ms-auto flex items-center gap-3 pb-2 text-sm text-ink-muted" aria-live="polite">
        <span>
          <span className="num font-bold text-ink">{formatNumber(matching)}</span>
          {total != null && total !== matching && (
            <>
              {' '}من <span className="num">{formatNumber(total)}</span>
            </>
          )}{' '}
          نتيجة
        </span>
        {active && (
          <button
            type="button"
            onClick={onReset}
            className="inline-flex min-h-8 cursor-pointer items-center gap-1.5 rounded-lg px-2.5 font-semibold text-brand-ink transition-colors hover:bg-brand-soft"
          >
            <FilterX className="size-4" aria-hidden="true" />
            مسح فلاتر الجدول
          </button>
        )}
      </div>
    </div>
  )
}

/** Width wrapper so a filter keeps a sensible size next to the others. */
export function ToolbarItem({ children, wide }: { children: ReactNode; wide?: boolean }) {
  return <div className={`w-full min-w-0 sm:w-auto ${wide ? 'sm:w-72' : 'sm:w-44'}`}>{children}</div>
}

/** Shown in a table body when the filters leave no rows. */
export function NoMatchRow({ columns }: { columns: number }) {
  return (
    <tr>
      <td colSpan={columns} className="px-3 py-10 text-center text-sm text-ink-muted">
        لا توجد صفوف تطابق هذه الفلاتر.
      </td>
    </tr>
  )
}
