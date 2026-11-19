import { Link } from 'react-router-dom'
import logoColor from '../assets/brand/sankari-logo.svg'
import logoReversed from '../assets/brand/sankari-logo-reversed.svg'

/** App bar: the logo, the title and the import time of the data. The way back is the breadcrumb bar (NavTrail). */
export function SiteHeader({ importedAt }: { importedAt?: string | null }) {
  return (
    <header className="site-header">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-x-6 gap-y-3 px-4 py-4 sm:px-6 sm:py-5">
        <Link to="/" className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-2.5 no-underline sm:flex-nowrap sm:gap-5" aria-label="Sankari Investment: العودة إلى اللوحة الرئيسية">
          {/* Reversed (white lettering) on the dark header; the colour version replaces it in print. */}
          <img src={logoReversed} alt="Sankari Investment" className="h-11 w-auto shrink-0 print:hidden sm:h-14" />
          <img src={logoColor} alt="Sankari Investment" className="hidden h-12 w-auto shrink-0 print:block" />
          <span className="hidden h-10 w-px bg-white/20 sm:block print:bg-line-strong" aria-hidden="true" />
          <span className="w-full min-w-0 sm:w-auto">
            <span className="block text-lg font-extrabold leading-tight sm:text-2xl">إحصاءات تجميع الأراضي</span>
            <span className="mt-0.5 block text-xs font-semibold text-white/65 sm:text-sm print:text-ink-muted">المحاضر · الإشارات · عقود الشراء · قيم الكشف 16</span>
          </span>
        </Link>
        {importedAt && (
          <span className="no-print rounded-full border border-white/15 bg-white/5 px-3.5 py-1.5 text-xs text-white/70">
            آخر استيراد للبيانات: <span className="num font-semibold text-white">{importedAt.slice(0, 16).replace('T', ' ')}</span>
          </span>
        )}
      </div>
    </header>
  )
}
