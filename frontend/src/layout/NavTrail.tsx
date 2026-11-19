import { ChevronLeft, Home } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { advanceTrail, loadTrail, relabel, STORAGE_KEY, type TrailStep } from '../lib/trail'
import { TrailContext, useTrail } from './trailContext'

// The way the user got to the current page, as a bar they can step back along: the dashboard (with the tab and
// filters it was left on), then each parcel opened from it. Opening a page adds a step; going back to a step
// (from the bar, the browser or the logo) drops the steps after it. It survives a reload within the tab.

function readStorage(): TrailStep[] {
  try {
    return loadTrail(sessionStorage.getItem(STORAGE_KEY))
  } catch {
    return []
  }
}

export function NavTrailProvider({ children }: { children: ReactNode }) {
  const location = useLocation()
  const here = location.pathname + location.search
  const [state, setState] = useState(() => ({ at: '', trail: readStorage() }))

  // Derived while rendering (not in an effect), so the bar is right on the first paint of every page.
  let trail = state.trail
  if (state.at !== here) {
    trail = advanceTrail(state.trail, location.pathname, location.search)
    setState({ at: here, trail })
  }

  useEffect(() => {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(trail))
    } catch {
      // Storage can be blocked: the bar then simply lasts until reload.
    }
  }, [trail])

  const setLabel = useCallback((to: string, label: string) => setState((current) => ({ ...current, trail: relabel(current.trail, to, label) })), [])
  const value = useMemo(() => ({ trail, setLabel }), [trail, setLabel])
  return <TrailContext.Provider value={value}>{children}</TrailContext.Provider>
}

/** The bar: every step back to the dashboard, the current page last. Hidden when there is nowhere to go back to. */
export function Breadcrumbs() {
  const { trail } = useTrail()
  const currentStep = useRef<HTMLSpanElement>(null)
  const steps = trail.length
  // On a narrow screen a long trail scrolls inside the bar: keep the page the user is on in view.
  useEffect(() => {
    currentStep.current?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }, [steps])
  if (trail.length < 2) return null

  return (
    <nav aria-label="مسار التنقل" className="no-print -mt-1 max-w-full overflow-x-auto scrollbar-none">
      <ol className="flex w-max min-w-full items-center gap-1.5 rounded-xl border border-line bg-white px-3 py-2 text-sm">
        {trail.map((step, index) => {
          const current = index === trail.length - 1
          return (
            <li key={step.to} className="flex items-center gap-1.5 whitespace-nowrap">
              {index > 0 && <ChevronLeft className="size-4 shrink-0 text-ink-muted" aria-hidden="true" />}
              {current ? (
                <span ref={currentStep} aria-current="page" className="rounded-lg bg-night px-2.5 py-1 font-bold text-white">
                  {step.label}
                </span>
              ) : (
                <Link to={step.to} className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 font-semibold text-brand-ink transition-colors hover:bg-brand-soft">
                  {index === 0 && <Home className="size-4" aria-hidden="true" />}
                  {step.label}
                </Link>
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
