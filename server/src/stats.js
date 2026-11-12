// Small numeric helpers for the analytics endpoint (kept pure so they can be tested).

/** Linear-interpolated quantile of a list of numbers; null for an empty list. */
export function quantile(values, q) {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const position = (sorted.length - 1) * q
  const lower = Math.floor(position)
  const upper = Math.ceil(position)
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (position - lower)
}

export function summary(values) {
  if (values.length === 0) return { n: 0, min: null, p25: null, median: null, p75: null, max: null, mean: null }
  const sum = values.reduce((total, v) => total + v, 0)
  return {
    n: values.length,
    min: Math.min(...values),
    p25: quantile(values, 0.25),
    median: quantile(values, 0.5),
    p75: quantile(values, 0.75),
    max: Math.max(...values),
    mean: sum / values.length,
  }
}

/**
 * Counts values into ordered buckets. Each bucket is [key, label, test]; a value goes to the first
 * bucket whose test passes.
 */
export function bucketize(values, buckets) {
  const counts = buckets.map(([key, label]) => ({ key, label, count: 0 }))
  for (const value of values) {
    const index = buckets.findIndex(([, , test]) => test(value))
    if (index >= 0) counts[index].count += 1
  }
  return counts
}
