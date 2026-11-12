import { useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'

export const FILTER_KEYS = ['region', 'group', 'damaged', 'status', 'category', 'year', 'q'] as const
export type FilterKey = (typeof FILTER_KEYS)[number]
export type Filters = Record<FilterKey, string>

export const TAB_VALUES = ['overview', 'parcels', 'annotations', 'acquisition', 'analytics', 'quality'] as const
export type TabValue = (typeof TAB_VALUES)[number]

/** The explorer state lives in the URL: it can be shared, bookmarked and walked back with the browser's back button. */
export function useDashboardFilters() {
  const [params, setParams] = useSearchParams()

  const filters = useMemo(() => {
    const out = {} as Filters
    for (const key of FILTER_KEYS) out[key] = params.get(key) ?? ''
    return out
  }, [params])

  const tabParam = params.get('tab')
  const tab: TabValue = (TAB_VALUES as readonly string[]).includes(tabParam ?? '') ? (tabParam as TabValue) : 'overview'

  const update = useCallback(
    (changes: Partial<Filters> & { tab?: TabValue }, replace = false) => {
      setParams(
        (previous) => {
          const next = new URLSearchParams(previous)
          for (const [key, value] of Object.entries(changes)) {
            if (value) next.set(key, value)
            else next.delete(key)
          }
          return next
        },
        { replace },
      )
    },
    [setParams],
  )

  /** Chart clicks: choosing the selected item again clears it. */
  const toggle = useCallback(
    (key: FilterKey, value: string) => update({ [key]: filters[key] === value ? '' : value }),
    [filters, update],
  )

  const reset = useCallback(() => update({ region: '', group: '', damaged: '', status: '', category: '', year: '', q: '' }), [update])
  const activeCount = FILTER_KEYS.filter((key) => filters[key] !== '').length

  return { filters, tab, update, toggle, reset, activeCount }
}
