import { ArrowRight } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'

/** App bar: mark, title, and either the import time of the data or a way back to the dashboard. */
export function SiteHeader({ importedAt, back }: { importedAt?: string | null; back?: boolean }) {
  const navigate = useNavigate()
  return (
    <header className="border-b border-line bg-surface/90 backdrop-blur">
      <div className="brand-rule" aria-hidden="true" />
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <Link to="/" className="flex items-center gap-3 no-underline">
          <img src="/favicon.svg" alt="" className="size-10 rounded-xl" />
          <span>
            <span className="block text-lg font-extrabold leading-tight text-ink sm:text-xl">إحصاءات تجميع الأراضي</span>
            <span className="block text-xs font-semibold text-ink-muted">المحاضر · الإشارات · عقود الشراء · قيم الكشف 16</span>
          </span>
        </Link>
        {back ? (
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="no-print inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-xl border border-line-strong bg-white px-3.5 text-sm font-semibold text-ink-soft transition-colors hover:border-brand hover:text-brand-ink"
          >
            <ArrowRight className="size-4" aria-hidden="true" />
            رجوع
          </button>
        ) : (
          importedAt && (
            <span className="no-print text-xs text-ink-muted">
              آخر استيراد للبيانات: <span className="num font-semibold">{importedAt.slice(0, 16).replace('T', ' ')}</span>
            </span>
          )
        )}
      </div>
    </header>
  )
}
