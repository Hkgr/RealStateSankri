import { Printer } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { ErrorState, NoDataState } from '../../components/ui/StateViews'
import { TabPanel, Tabs, type TabItem } from '../../components/ui/Tabs'
import { SiteHeader } from '../../layout/SiteHeader'
import { AcquisitionPanel } from './components/AcquisitionPanel'
import { AdvancedPanel } from './components/AdvancedPanel'
import { AnnotationsPanel } from './components/AnnotationsPanel'
import { ExplorerBar } from './components/ExplorerBar'
import { FiguresBand } from './components/FiguresBand'
import { OverviewPanel } from './components/OverviewPanel'
import { ParcelsPanel } from './components/ParcelsPanel'
import { QualityPanel } from './components/QualityPanel'
import { useMeta, useOverview } from './queries'
import { useDashboardFilters, type TabValue } from './useDashboardFilters'

export function DashboardPage() {
  const { filters, tab, update, toggle, reset, activeCount } = useDashboardFilters()
  const meta = useMeta()
  const overview = useOverview(filters)
  const data = overview.data

  const tabs: TabItem<TabValue>[] = [
    { value: 'overview', label: 'نظرة عامة' },
    { value: 'parcels', label: 'العقارات', count: data?.figures.parcels },
    { value: 'annotations', label: 'الإشارات', count: data?.figures.annotations },
    { value: 'acquisition', label: 'الشراء والتملّك' },
    { value: 'analytics', label: 'التحليل المتقدّم' },
    { value: 'quality', label: 'جودة البيانات' },
  ]

  const empty = data && data.figures.parcels === 0

  return (
    <div className="min-h-screen">
      <SiteHeader importedAt={meta.data?.imported_at ?? null} />
      <main className="mx-auto grid max-w-7xl gap-4 px-4 py-5 sm:px-6">
        <ExplorerBar meta={meta.data} filters={filters} activeCount={activeCount} onChange={(key, value) => update({ [key]: value }, key === 'q')} onReset={reset} />
        <FiguresBand figures={data?.figures} loading={overview.isFetching} />

        <div className="no-print flex flex-wrap items-center justify-between gap-3">
          <div className="max-w-full overflow-x-auto scrollbar-none">
            <Tabs label="أقسام اللوحة" idPrefix="dash" items={tabs} value={tab} onChange={(value) => update({ tab: value })} />
          </div>
          <Button variant="secondary" onClick={() => window.print()}>
            <Printer className="size-4" aria-hidden="true" />
            طباعة / PDF
          </Button>
        </div>

        <TabPanel idPrefix="dash" value={tab}>
          {overview.isError && !data ? (
            <ErrorState message={overview.error.message} onRetry={() => void overview.refetch()} />
          ) : !data ? (
            <div className="grid gap-4 lg:grid-cols-3" aria-busy="true">
              {Array.from({ length: 6 }, (_, i) => (
                <div key={i} className="skeleton h-80" aria-hidden="true" />
              ))}
            </div>
          ) : empty ? (
            <NoDataState onReset={reset} />
          ) : (
            <div className={`transition-opacity ${overview.isFetching ? 'opacity-70' : ''}`}>
              {tab === 'overview' && <OverviewPanel data={data} filters={filters} toggle={toggle} />}
              {tab === 'parcels' && <ParcelsPanel filters={filters} onReset={reset} />}
              {tab === 'annotations' && <AnnotationsPanel data={data} filters={filters} toggle={toggle} onReset={reset} />}
              {tab === 'acquisition' && <AcquisitionPanel data={data} filters={filters} toggle={toggle} />}
              {tab === 'analytics' && <AdvancedPanel filters={filters} figures={data.figures} onReset={reset} />}
              {tab === 'quality' && <QualityPanel filters={filters} />}
            </div>
          )}
        </TabPanel>

        <footer className="pb-6 pt-2 text-center text-xs leading-6 text-ink-muted">
          المصدر: ملف «تجميع اراضي.xlsx». الأسهم من 2400 سهم للعقار الواحد؛ والقيم بالدولار بحسب الكشف 16 لكل عملية شراء (تُكتب على أول محضر فيها).
        </footer>
      </main>
    </div>
  )
}
