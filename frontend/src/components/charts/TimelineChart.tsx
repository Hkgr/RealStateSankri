import { useMemo } from 'react'
import { axisLabelStyle, categoryLabelStyle, chartColors, gridLine, tooltipBase, tooltipHtml } from './chartTheme'
import { EChart } from './EChart'

export interface TimelineEvent {
  /** Milliseconds since the epoch. */
  time: number
  /** The lane (row) the event sits on. */
  lane: string
  label: string
  color: string
  /** Only the year is known: drawn hollow, placed in mid-year. */
  approximate?: boolean
  detail?: string
}

interface TimelineChartProps {
  events: TimelineEvent[]
  /** Lanes from top to bottom. */
  lanes: string[]
  ariaLabel: string
  className?: string
}

/** Events on a time axis, one lane per kind of event (purchase, judgment, transfer, annotations...). */
export function TimelineChart({ events, lanes, ariaLabel, className }: TimelineChartProps) {
  const option = useMemo(() => {
    const ordered = [...lanes].reverse()
    return {
      grid: { top: 10, bottom: 8, left: 8, right: 24, containLabel: true },
      tooltip: {
        ...tooltipBase,
        trigger: 'item',
        formatter: (p: { data: { value: [number, string]; event: TimelineEvent } }) => {
          const e = p.data.event
          const date = new Date(e.time)
          const when = e.approximate ? `سنة ${date.getUTCFullYear()} (التاريخ الدقيق غير مسجّل)` : date.toISOString().slice(0, 10).split('-').reverse().join('/')
          return tooltipHtml(e.label, [{ color: e.color, label: e.lane, value: when }, ...(e.detail ? [{ label: 'التفصيل', value: e.detail }] : [])])
        },
      },
      xAxis: {
        type: 'time',
        axisLine: { lineStyle: { color: chartColors.axis } },
        axisTick: { show: false },
        axisLabel: { ...axisLabelStyle, hideOverlap: true },
        splitLine: gridLine,
      },
      yAxis: { type: 'category', data: ordered, axisTick: { show: false }, axisLine: { show: false }, axisLabel: categoryLabelStyle, splitLine: { show: true, lineStyle: { color: chartColors.grid } } },
      series: [
        {
          type: 'scatter',
          symbolSize: 13,
          data: events.map((event) => ({
            value: [event.time, event.lane],
            event,
            itemStyle: event.approximate
              ? { color: 'transparent', borderColor: event.color, borderWidth: 2 }
              : { color: event.color, opacity: 0.85, borderColor: '#fff', borderWidth: 1.5 },
          })),
        },
      ],
    }
  }, [events, lanes])

  return <EChart option={option} ariaLabel={ariaLabel} className={className ?? 'h-72'} />
}
