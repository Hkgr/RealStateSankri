import { ChevronLeft, ChevronRight } from 'lucide-react'
import { formatNumber } from '../../lib/format'

interface PaginationProps {
  page: number
  per: number
  total: number
  onPage: (page: number) => void
}

/** Previous / next with the visible range; in RTL "next" points left. */
export function Pagination({ page, per, total, onPage }: PaginationProps) {
  const pages = Math.max(1, Math.ceil(total / per))
  const from = total === 0 ? 0 : (page - 1) * per + 1
  const to = Math.min(total, page * per)
  const button =
    'inline-flex size-9 cursor-pointer items-center justify-center rounded-lg border border-line-strong bg-white text-ink-soft transition-colors enabled:hover:border-brand enabled:hover:text-brand-ink disabled:cursor-not-allowed disabled:opacity-40'
  return (
    <nav aria-label="التنقل بين الصفحات" className="no-print mt-3 flex flex-wrap items-center justify-between gap-2 text-sm text-ink-muted">
      <span>
        <span className="num font-bold text-ink">{formatNumber(from)}</span>–<span className="num font-bold text-ink">{formatNumber(to)}</span> من{' '}
        <span className="num font-bold text-ink">{formatNumber(total)}</span>
      </span>
      <span className="flex items-center gap-2">
        <button type="button" className={button} disabled={page <= 1} onClick={() => onPage(page - 1)} aria-label="الصفحة السابقة">
          <ChevronRight className="size-4" aria-hidden="true" />
        </button>
        <span className="num min-w-16 text-center font-semibold text-ink">
          {page} / {pages}
        </span>
        <button type="button" className={button} disabled={page >= pages} onClick={() => onPage(page + 1)} aria-label="الصفحة التالية">
          <ChevronLeft className="size-4" aria-hidden="true" />
        </button>
      </span>
    </nav>
  )
}
