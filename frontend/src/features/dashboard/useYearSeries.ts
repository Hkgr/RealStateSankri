import { useMemo } from 'react'
import { CATEGORY_COLORS } from '../../lib/labels'
import type { Overview } from '../../services/types'

/** Annotations per year, one series per category: shared by the overview and the annotations pages. */
export function useYearSeries(data: Overview) {
  return useMemo(() => {
    const years = [...new Set(data.annotations_by_year.map((r) => r.year))].sort((a, b) => a - b)
    const categories = years.map((year) => ({ key: String(year), label: String(year) }))
    const series = data.annotations_by_category.map((category) => ({
      key: category.code,
      name: category.name,
      color: CATEGORY_COLORS[category.code] ?? '#64748b',
      data: years.map((year) => data.annotations_by_year.find((r) => r.year === year && r.category === category.code)?.annotations ?? 0),
    }))
    return { categories, series }
  }, [data.annotations_by_year, data.annotations_by_category])
}
