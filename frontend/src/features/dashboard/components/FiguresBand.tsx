import { BadgeDollarSign, Building2, FileSignature, Landmark, Layers, Ruler, ScrollText, Scale } from 'lucide-react'
import type { ReactNode } from 'react'
import { formatNumber, formatPercent, formatUsd, share } from '../../../lib/format'
import type { Figures } from '../../../services/types'

interface FigureProps {
  icon: ReactNode
  label: string
  value: string
  hint?: string
  tone?: 'brand' | 'gold'
}

function Figure({ icon, label, value, hint, tone = 'brand' }: FigureProps) {
  const toneClass = tone === 'brand' ? 'bg-night text-brand-bright' : 'bg-brand-soft text-brand-ink'
  return (
    <div className="flex min-w-0 items-start gap-3 rounded-2xl border border-line bg-gradient-to-br from-surface to-brand-wash p-4 shadow-card">
      <div className={`grid size-10 shrink-0 place-items-center rounded-xl ${toneClass}`} aria-hidden="true">
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-ink-muted">{label}</p>
        <p className="num text-2xl font-extrabold leading-tight text-ink">{value}</p>
        {hint && <p className="mt-0.5 text-xs leading-5 text-ink-muted">{hint}</p>}
      </div>
    </div>
  )
}

export function FiguresBand({ figures, loading }: { figures: Figures | undefined; loading: boolean }) {
  if (!figures) {
    return (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-busy={loading}>
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} className="skeleton h-24" aria-hidden="true" />
        ))}
      </div>
    )
  }

  return (
    <div className={`grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 transition-opacity ${loading ? 'opacity-60' : ''}`} aria-busy={loading}>
      <Figure icon={<Building2 className="size-5" />} label="العقارات (المحاضر)" value={formatNumber(figures.parcels)} hint={`منها ${formatNumber(figures.damaged)} متضرر · ${formatNumber(figures.regions)} منطقة`} />
      <Figure icon={<Ruler className="size-5" />} label="المساحة الإجمالية (م²)" value={formatNumber(figures.total_area)} hint="مجموع «المساحة الإجمالية» للمحاضر" />
      <Figure icon={<Layers className="size-5" />} label="المساحة المملوكة (م²)" value={formatNumber(figures.owned_area)} hint="مجموع «الملكية من مساحة المحضر»" />
      <Figure
        icon={<BadgeDollarSign className="size-5" />}
        tone="gold"
        label="القيمة بحسب الكشف 16"
        value={formatUsd(figures.value_usd)}
        hint={`${formatNumber(figures.valued_operations)} من ${formatNumber(figures.operations)} عملية شراء (تضم ${formatNumber(figures.operation_minutes)} محضرًا)`}
      />
      <Figure icon={<Landmark className="size-5" />} tone="gold" label="حصة د. سنكري" value={formatUsd(figures.sankari_value_usd)} hint={`${formatPercent(share(figures.sankari_value_usd, figures.value_usd))} من القيمة`} />
      <Figure icon={<Scale className="size-5" />} tone="gold" label="حصة عسلي" value={formatUsd(figures.asali_value_usd)} hint={`${formatPercent(share(figures.asali_value_usd, figures.value_usd))} من القيمة`} />
      <Figure
        icon={<ScrollText className="size-5" />}
        label="الإشارات المسجّلة"
        value={formatNumber(figures.annotations)}
        hint={`على ${formatNumber(figures.parcels_with_annotations)} عقارًا (${formatPercent(share(figures.parcels_with_annotations, figures.parcels))})`}
      />
      <Figure
        icon={<FileSignature className="size-5" />}
        label="عقارات لها عقد شراء"
        value={formatNumber(figures.purchased_parcels)}
        hint={`${formatPercent(share(figures.purchased_parcels, figures.parcels))} من العقارات`}
      />
    </div>
  )
}
