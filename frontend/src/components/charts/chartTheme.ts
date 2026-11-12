// One visual language for every chart: fonts, ink, grid and tooltip.
export const chartColors = {
  ink: '#1b2327',
  inkSoft: '#435056',
  inkMuted: '#5f6b70',
  grid: '#ece8de',
  axis: '#d3ccbd',
  surface: '#ffffff',
  brand: '#0f5f5c',
  muted: '#94a3b8',
} as const

export const chartFont = {
  family: "'Cairo Variable', 'Cairo', system-ui, sans-serif",
  size: 13,
} as const

export const DIMMED_OPACITY = 0.28

export const axisLabelStyle = {
  color: chartColors.inkMuted,
  fontFamily: chartFont.family,
  fontSize: 12.5,
} as const

export const categoryLabelStyle = {
  ...axisLabelStyle,
  color: chartColors.ink,
  fontWeight: 600,
  fontSize: 13,
} as const

export const gridLine = {
  show: true,
  lineStyle: { color: chartColors.grid, type: 'dashed' as const, width: 1 },
}

const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] ?? c)

export interface TooltipRow {
  color?: string
  label: string
  value: string
  strong?: boolean
}

/** Shared tooltip markup: title, then one short row per figure (swatch · label · value). */
export function tooltipHtml(title: string, rows: TooltipRow[]): string {
  const body = rows
    .map(
      (row) => `
      <div style="display:flex;align-items:center;gap:12px;justify-content:space-between;margin-top:5px;${row.strong ? 'padding-top:5px;border-top:1px solid #ece8de;font-weight:700;' : ''}">
        <span style="display:flex;align-items:center;gap:7px;color:${chartColors.inkSoft}">
          ${row.color ? `<i style="width:10px;height:10px;border-radius:3px;background:${row.color};display:inline-block"></i>` : ''}
          ${escapeHtml(row.label)}
        </span>
        <span style="direction:ltr;font-variant-numeric:tabular-nums;color:${chartColors.ink}">${escapeHtml(row.value)}</span>
      </div>`,
    )
    .join('')
  return `<div dir="rtl" style="min-width:150px"><div style="font-weight:700;color:${chartColors.ink}">${escapeHtml(title)}</div>${body}</div>`
}

export const tooltipBase = {
  confine: true,
  backgroundColor: '#ffffff',
  borderColor: chartColors.axis,
  borderWidth: 1,
  padding: [9, 13],
  extraCssText: 'box-shadow:0 14px 32px -14px rgba(27,35,39,.3);border-radius:12px;direction:rtl;',
  textStyle: { fontFamily: chartFont.family, fontSize: 13, color: chartColors.ink },
}
