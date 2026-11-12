import { useMemo } from 'react'
import { axisLabelStyle, categoryLabelStyle, chartColors, chartFont, DIMMED_OPACITY, gridLine, tooltipBase, tooltipHtml } from './chartTheme'
import { EChart } from './EChart'
import { formatCompact, formatDecimal, formatPercent } from '../../lib/format'

export interface ChartItem {
  key: string
  label: string
  value: number
  color: string
}

interface ItemChartProps {
  items: ChartItem[]
  /** Selected key (filter currently applied); other items are dimmed. */
  selected?: string
  onSelect?: (key: string) => void
  /** What the value means, used in the tooltip and the text alternative ("عقار", "إشارة", ...). */
  unit: string
  ariaLabel: string
  className?: string
  format?: (value: number) => string
}

const dim = (selected: string | undefined, key: string) => (selected && selected !== key ? DIMMED_OPACITY : 1)

/** Horizontal bars, longest first; click a bar to filter by it. */
export function HBarChart({ items, selected, onSelect, unit, ariaLabel, className, format = formatDecimal }: ItemChartProps) {
  const option = useMemo(() => {
    const ordered = [...items].reverse()
    return {
      grid: { top: 6, bottom: 6, left: 8, right: 64, containLabel: true },
      tooltip: {
        ...tooltipBase,
        trigger: 'item',
        formatter: (p: { data: ChartItem }) => tooltipHtml(p.data.label, [{ color: p.data.color, label: unit, value: format(p.data.value), strong: true }]),
      },
      // Each bar carries its own value label, so the value axis stays quiet.
      xAxis: { type: 'value', axisLabel: { show: false }, splitLine: gridLine },
      yAxis: { type: 'category', data: ordered.map((i) => i.label), axisTick: { show: false }, axisLine: { show: false }, axisLabel: categoryLabelStyle },
      series: [
        {
          type: 'bar',
          barMaxWidth: 22,
          cursor: onSelect ? 'pointer' : 'default',
          label: { show: true, position: 'right', color: chartColors.ink, fontFamily: chartFont.family, fontWeight: 700, fontSize: 12.5, formatter: (p: { value: number }) => format(p.value) },
          data: ordered.map((i) => ({
            key: i.key,
            label: i.label,
            value: i.value,
            color: i.color,
            itemStyle: { color: i.color, borderRadius: [0, 6, 6, 0], opacity: dim(selected, i.key) },
          })),
        },
      ],
    }
  }, [items, selected, onSelect, unit, format])
  return <EChart option={option} ariaLabel={ariaLabel} className={className ?? 'h-72'} onSelect={onSelect} />
}

/** Ring chart with the total in the middle; click a slice to filter by it. */
export function DonutChart({ items, selected, onSelect, unit, ariaLabel, className, format = formatDecimal }: ItemChartProps) {
  const total = items.reduce((sum, i) => sum + i.value, 0)
  const option = useMemo(
    () => ({
      tooltip: {
        ...tooltipBase,
        trigger: 'item',
        formatter: (p: { data: ChartItem }) =>
          tooltipHtml(p.data.label, [
            { color: p.data.color, label: unit, value: format(p.data.value), strong: true },
            { label: 'النسبة', value: formatPercent(total ? (p.data.value / total) * 100 : null) },
          ]),
      },
      series: [
        {
          type: 'pie',
          radius: ['52%', '78%'],
          center: ['50%', '50%'],
          avoidLabelOverlap: true,
          cursor: onSelect ? 'pointer' : 'default',
          label: { show: false },
          emphasis: { scale: false },
          itemStyle: { borderColor: '#fff', borderWidth: 2, borderRadius: 4 },
          data: items.map((i) => ({
            key: i.key,
            label: i.label,
            value: i.value,
            color: i.color,
            itemStyle: { color: i.color, opacity: dim(selected, i.key) },
          })),
        },
      ],
      graphic: [
        {
          type: 'text',
          left: 'center',
          top: '43%',
          style: { text: format(total), font: `800 22px ${chartFont.family}`, fill: chartColors.ink, textAlign: 'center' },
        },
        { type: 'text', left: 'center', top: '55%', style: { text: unit, font: `600 12.5px ${chartFont.family}`, fill: chartColors.inkMuted, textAlign: 'center' } },
      ],
    }),
    [items, selected, onSelect, unit, total, format],
  )
  return (
    <div>
      <EChart option={option} ariaLabel={ariaLabel} className={className ?? 'h-56'} onSelect={onSelect} />
      <Legend items={items} total={total} selected={selected} onSelect={onSelect} format={format} />
    </div>
  )
}

/** Colour key with value and share, doubling as the chart's accessible data. */
export function Legend({
  items,
  total,
  selected,
  onSelect,
  format = formatDecimal,
}: {
  items: ChartItem[]
  total: number
  selected?: string
  onSelect?: (key: string) => void
  format?: (value: number) => string
}) {
  return (
    <ul className="mt-2 grid gap-1">
      {items.map((item) => (
        <li key={item.key}>
          <button
            type="button"
            disabled={!onSelect}
            onClick={() => onSelect?.(item.key)}
            aria-pressed={selected === item.key}
            className={`flex w-full cursor-pointer items-center gap-2 rounded-lg px-2 py-1 text-start text-sm transition-colors enabled:hover:bg-paper-deep disabled:cursor-default ${
              selected && selected !== item.key ? 'opacity-50' : ''
            } ${selected === item.key ? 'bg-brand-soft' : ''}`}
          >
            <i className="size-3 shrink-0 rounded-[4px]" style={{ background: item.color }} aria-hidden="true" />
            <span className="min-w-0 flex-1 truncate font-semibold text-ink-soft">{item.label}</span>
            <span className="num font-bold text-ink">{format(item.value)}</span>
            <span className="num w-14 text-end text-xs text-ink-muted">{formatPercent(total ? (item.value / total) * 100 : null)}</span>
          </button>
        </li>
      ))}
    </ul>
  )
}

export interface StackSeries {
  key: string
  name: string
  color: string
  data: number[]
}

interface StackProps {
  /** x categories (months, years...) with their display labels. */
  categories: { key: string; label: string }[]
  series: StackSeries[]
  selected?: string
  onSelect?: (key: string) => void
  unit: string
  ariaLabel: string
  className?: string
  /** `line` draws each series as a line instead of stacked columns. */
  kind?: 'stack' | 'line'
}

/** Stacked columns (or lines) over time, one colour per series. */
export function StackedChart({ categories, series, selected, onSelect, unit, ariaLabel, className, kind = 'stack' }: StackProps) {
  const option = useMemo(
    () => ({
      grid: { top: 12, bottom: 4, left: 8, right: 8, containLabel: true },
      tooltip: {
        ...tooltipBase,
        trigger: 'axis',
        axisPointer: { type: 'shadow', shadowStyle: { color: 'rgba(15,95,92,0.06)' } },
        formatter: (params: { dataIndex: number; seriesName: string; value: number; color: string }[]) => {
          const index = params[0]?.dataIndex ?? 0
          const rows = params.filter((p) => p.value > 0).map((p) => ({ color: p.color, label: p.seriesName, value: formatDecimal(p.value) }))
          const total = params.reduce((sum, p) => sum + (p.value || 0), 0)
          return tooltipHtml(categories[index]?.label ?? '', [...rows, { label: unit, value: formatDecimal(total), strong: true }])
        },
      },
      xAxis: {
        type: 'category',
        data: categories.map((c) => c.label),
        axisTick: { show: false },
        axisLine: { lineStyle: { color: chartColors.axis } },
        axisLabel: { ...axisLabelStyle, hideOverlap: true },
      },
      yAxis: { type: 'value', axisLabel: { ...axisLabelStyle, formatter: (v: number) => formatCompact(v) }, splitLine: gridLine },
      series: series.map((s) => ({
        type: kind === 'line' ? 'line' : 'bar',
        name: s.name,
        stack: kind === 'line' ? undefined : 'total',
        barMaxWidth: 26,
        smooth: kind === 'line' ? 0.25 : undefined,
        symbolSize: 5,
        cursor: onSelect ? 'pointer' : 'default',
        lineStyle: kind === 'line' ? { width: 2.5, color: s.color } : undefined,
        itemStyle: { color: s.color },
        data: s.data.map((value, index) => ({
          key: categories[index]?.key,
          value,
          itemStyle: { color: s.color, opacity: dim(selected, categories[index]?.key ?? '') },
        })),
      })),
    }),
    [categories, series, selected, onSelect, unit, kind],
  )
  return (
    <div>
      <EChart option={option} ariaLabel={ariaLabel} className={className ?? 'h-72'} onSelect={onSelect} />
      <ul className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
        {series.map((s) => (
          <li key={s.key} className="flex items-center gap-1.5 text-sm font-semibold text-ink-soft">
            <i className="size-3 rounded-[4px]" style={{ background: s.color }} aria-hidden="true" />
            {s.name}
          </li>
        ))}
      </ul>
    </div>
  )
}

/** Horizontal stacked bars (one row per label, one segment per series). */
export function HStackedChart({ rows, series, unit, ariaLabel, className }: { rows: { key: string; label: string }[]; series: StackSeries[]; unit: string; ariaLabel: string; className?: string }) {
  const option = useMemo(() => {
    const labels = [...rows].reverse()
    return {
      grid: { top: 6, bottom: 6, left: 8, right: 24, containLabel: true },
      tooltip: {
        ...tooltipBase,
        trigger: 'axis',
        axisPointer: { type: 'shadow', shadowStyle: { color: 'rgba(15,95,92,0.06)' } },
        formatter: (params: { dataIndex: number; seriesName: string; value: number; color: string }[]) => {
          const index = params[0]?.dataIndex ?? 0
          const out = params.filter((p) => p.value > 0).map((p) => ({ color: p.color, label: p.seriesName, value: formatDecimal(p.value) }))
          const total = params.reduce((sum, p) => sum + (p.value || 0), 0)
          return tooltipHtml(labels[index]?.label ?? '', [...out, { label: unit, value: formatDecimal(total), strong: true }])
        },
      },
      xAxis: { type: 'value', axisLabel: { ...axisLabelStyle, formatter: (v: number) => formatCompact(v) }, splitLine: gridLine },
      yAxis: { type: 'category', data: labels.map((l) => l.label), axisTick: { show: false }, axisLine: { show: false }, axisLabel: categoryLabelStyle },
      series: series.map((s) => ({
        type: 'bar',
        name: s.name,
        stack: 'total',
        barMaxWidth: 22,
        itemStyle: { color: s.color },
        data: [...s.data].reverse(),
      })),
    }
  }, [rows, series, unit])
  return (
    <div>
      <EChart option={option} ariaLabel={ariaLabel} className={className ?? 'h-80'} />
      <ul className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
        {series.map((s) => (
          <li key={s.key} className="flex items-center gap-1.5 text-sm font-semibold text-ink-soft">
            <i className="size-3 rounded-[4px]" style={{ background: s.color }} aria-hidden="true" />
            {s.name}
          </li>
        ))}
      </ul>
    </div>
  )
}
