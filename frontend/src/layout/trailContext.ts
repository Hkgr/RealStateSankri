import { createContext, useContext, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import type { TrailStep } from '../lib/trail'

export interface TrailContextValue {
  trail: TrailStep[]
  setLabel: (to: string, label: string) => void
}

export const TrailContext = createContext<TrailContextValue>({ trail: [], setLabel: () => {} })

export const useTrail = () => useContext(TrailContext)

/** Names the current page in the breadcrumb bar once its data is known ("محضر 1158 · ماير"). */
export function useTrailLabel(label: string) {
  const location = useLocation()
  const { setLabel } = useTrail()
  const to = location.pathname + location.search
  useEffect(() => {
    setLabel(to, label)
  }, [setLabel, to, label])
}
