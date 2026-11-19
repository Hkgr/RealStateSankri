import { Download, ExternalLink, File, FileSpreadsheet, FileText, Image as ImageIcon, Lock, Users } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Card } from '../../components/ui/Card'
import { ErrorState } from '../../components/ui/StateViews'
import { TabPanel, Tabs, type TabItem } from '../../components/ui/Tabs'
import { formatBytes, formatDate, formatNumber } from '../../lib/format'
import { DOCUMENT_CATEGORY_LABELS } from '../../lib/labels'
import { documentUrl } from '../../services/api'
import type { DocumentCategory, ParcelDocument, ParcelDocuments } from '../../services/types'

// The order the headings are shown in: what is needed most first.
const ORDER: DocumentCategory[] = ['contracts', 'records', 'surveys', 'annotations', 'visits', 'other']

const ICONS = { pdf: FileText, image: ImageIcon, sheet: FileSpreadsheet, other: File } as const

function Notice({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 py-10 text-center">
      <div className="grid size-12 place-items-center rounded-2xl bg-paper-deep text-ink-muted" aria-hidden="true">
        {icon}
      </div>
      <h3 className="text-base font-bold text-ink">{title}</h3>
      <p className="max-w-lg text-sm leading-7 text-ink-muted">{children}</p>
    </div>
  )
}

function DocumentRow({ doc }: { doc: ParcelDocument }) {
  const Icon = ICONS[doc.kind]
  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-line bg-paper px-3.5 py-3">
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-night text-brand-bright" aria-hidden="true">
        <Icon className="size-5" />
      </span>
      <div className="min-w-0 flex-1 basis-40">
        <a href={documentUrl(doc.id)} target="_blank" rel="noopener noreferrer" className="block break-words text-sm font-bold text-ink underline-offset-4 hover:text-brand-ink hover:underline">
          {doc.title}
        </a>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-muted">
          {doc.doc_date && <span className="num">{formatDate(doc.doc_date)}</span>}
          <span className="num">{formatBytes(doc.size_bytes)}</span>
          {doc.shared_with > 1 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-brand-soft px-2 py-0.5 font-bold text-brand-ink" title="الملف نفسه محفوظ مرة واحدة ومرتبط بكل هذه المحاضر">
              <Users className="size-3" aria-hidden="true" />
              مشتركة مع <span className="num">{formatNumber(doc.shared_with)}</span> محضرًا
            </span>
          )}
        </p>
      </div>
      <div className="flex w-full shrink-0 gap-2 sm:w-auto">
        <a
          href={documentUrl(doc.id)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-line-strong bg-white px-3 text-sm font-semibold text-ink-soft transition-colors hover:border-brand hover:text-brand-ink"
        >
          <ExternalLink className="size-4" aria-hidden="true" />
          عرض
        </a>
        <a
          href={documentUrl(doc.id, true)}
          className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-line-strong bg-white px-3 text-sm font-semibold text-ink-soft transition-colors hover:border-brand hover:text-brand-ink"
        >
          <Download className="size-4" aria-hidden="true" />
          تنزيل
        </a>
      </div>
    </li>
  )
}

/** Photos as a grid; a click opens the full picture in a new tab. */
function Gallery({ photos }: { photos: ParcelDocument[] }) {
  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {photos.map((photo) => (
        <li key={photo.id}>
          <a href={documentUrl(photo.id)} target="_blank" rel="noopener noreferrer" className="group block overflow-hidden rounded-xl border border-line bg-paper">
            <img src={documentUrl(photo.id)} alt={photo.title} loading="lazy" className="aspect-[4/3] w-full object-cover transition-transform group-hover:scale-[1.03]" />
            <span className="flex items-center justify-between gap-2 px-2.5 py-1.5 text-xs font-semibold text-ink-soft">
              {photo.title}
              {photo.shared_with > 1 && <span className="num rounded-full bg-brand-soft px-1.5 text-brand-ink">{photo.shared_with}</span>}
            </span>
          </a>
        </li>
      ))}
    </ul>
  )
}

interface DocumentsCardProps {
  documents: ParcelDocuments | undefined
  loading: boolean
  error: Error | null
  onRetry: () => void
}

/** A parcel's documents by heading: contracts, land-registry and survey statements, annotations, field visits. */
export function DocumentsCard({ documents, loading, error, onRetry }: DocumentsCardProps) {
  const groups = useMemo(() => {
    const items = documents?.items ?? []
    return ORDER.map((category) => ({ category, items: items.filter((item) => item.category === category) })).filter((group) => group.items.length > 0)
  }, [documents])
  const [chosen, setChosen] = useState<DocumentCategory | ''>('')
  const active = groups.find((group) => group.category === chosen) ?? groups[0]

  const tabs: TabItem<DocumentCategory>[] = groups.map((group) => ({ value: group.category, label: DOCUMENT_CATEGORY_LABELS[group.category], count: group.items.length }))
  const photos = active?.items.filter((item) => item.kind === 'image') ?? []
  const files = active?.items.filter((item) => item.kind !== 'image') ?? []
  const total = documents?.items.length ?? 0

  return (
    <Card className="no-print" title="وثائق العقار" hint={total ? `${formatNumber(total)} ملفًا: عقود وبيانات وإشارات وصور الزيارات` : 'عقود الشراء والبيانات العقارية والمساحية والإشارات والزيارات الميدانية'}>
      {error ? (
        <ErrorState message={error.message} onRetry={onRetry} compact />
      ) : loading || !documents ? (
        <div className="skeleton h-40" aria-busy="true" />
      ) : !documents.enabled ? (
        <Notice icon={<Lock className="size-6" />} title="عرض الوثائق معطّل">
          الوثائق تُعرض فقط حين يكون الموقع محميًا بكلمة مرور. اضبط <span className="num font-bold">BASIC_AUTH_USER</span> و <span className="num font-bold">BASIC_AUTH_PASSWORD</span> على الخادم (راجع DEPLOY.md).
        </Notice>
      ) : !documents.available ? (
        <Notice icon={<File className="size-6" />} title="لم تُفهرس وثائق بعد">
          شغّل أمر فهرسة الوثائق ثم استورد القاعدة على هذا الخادم.
        </Notice>
      ) : total === 0 ? (
        <Notice icon={<File className="size-6" />} title="لا توجد وثائق مفهرسة لهذا العقار">
          لم يُعثر على ملفات لهذا المحضر في مجلد الوثائق.
        </Notice>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          <div className="max-w-full overflow-x-auto scrollbar-none">
            <Tabs label="أقسام الوثائق" idPrefix="docs" items={tabs} value={active.category} onChange={setChosen} />
          </div>
          <TabPanel idPrefix="docs" value={active.category}>
            <div className="grid grid-cols-1 gap-4">
              {files.length > 0 && (
                <ul className="grid grid-cols-1 gap-2.5">
                  {files.map((doc) => (
                    <DocumentRow key={doc.id} doc={doc} />
                  ))}
                </ul>
              )}
              {photos.length > 0 && <Gallery photos={photos} />}
            </div>
          </TabPanel>
        </div>
      )}
    </Card>
  )
}
