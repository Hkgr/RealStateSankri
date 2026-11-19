// Rules of the navigation trail (the breadcrumb bar): how the way the user took changes when they open a page.

export interface TrailStep {
  /** Where the step leads: path and query string, so the dashboard comes back with its tab and filters. */
  to: string
  label: string
}

export const STORAGE_KEY = 'nav-trail'
const MAX_STEPS = 12
const HOME = '/'

const TAB_NAMES: Record<string, string> = {
  parcels: 'العقارات',
  annotations: 'الإشارات',
  acquisition: 'الشراء والتملّك',
  analytics: 'التحليل المتقدّم',
  quality: 'جودة البيانات',
}
const FILTER_PARAMS = ['region', 'group', 'damaged', 'status', 'category', 'year', 'q']

/** "اللوحة الرئيسية · العقارات · مفلترة": which dashboard view the step returns to. */
export function dashboardLabel(search: string): string {
  const params = new URLSearchParams(search)
  const parts = ['اللوحة الرئيسية']
  const tab = TAB_NAMES[params.get('tab') ?? '']
  if (tab) parts.push(tab)
  if (FILTER_PARAMS.some((key) => params.get(key))) parts.push('مفلترة')
  return parts.join(' · ')
}

/**
 * The trail after arriving at a page. The dashboard is always the first step and stays one step however its
 * tab or filters change; any other page is added, unless it is already on the trail, which means the user went
 * back to it and the steps after it are dropped.
 */
export function advanceTrail(trail: TrailStep[], pathname: string, search: string): TrailStep[] {
  const to = pathname + search
  if (pathname === HOME) return [{ to, label: dashboardLabel(search) }]
  const at = trail.findIndex((step) => step.to === to)
  if (at >= 0) return trail.slice(0, at + 1)
  const home = trail[0]?.to.split('?')[0] === HOME ? trail : [{ to: HOME, label: dashboardLabel('') }]
  return [...home, { to, label: 'عقار' }].slice(-MAX_STEPS)
}

export function relabel(trail: TrailStep[], to: string, label: string): TrailStep[] {
  return trail.some((step) => step.to === to && step.label !== label) ? trail.map((step) => (step.to === to ? { ...step, label } : step)) : trail
}

export function loadTrail(raw: string | null): TrailStep[] {
  try {
    const parsed: unknown = JSON.parse(raw ?? '[]')
    return Array.isArray(parsed) ? parsed.filter((step): step is TrailStep => typeof step?.to === 'string' && typeof step?.label === 'string') : []
  } catch {
    return []
  }
}
