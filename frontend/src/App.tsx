import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { DashboardPage } from './features/dashboard/DashboardPage'
import { ParcelPage } from './features/parcel/ParcelPage'
import { NavTrailProvider } from './layout/NavTrail'
import { ApiError } from './services/api'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Client errors (e.g. an invalid filter) will not fix themselves; only retry network/server failures.
      retry: (count, error) => !(error instanceof ApiError && error.status >= 400 && error.status < 500) && count < 1,
      staleTime: 30_000,
      refetchOnWindowFocus: false,
    },
  },
})

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <NavTrailProvider>
          <Routes>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/parcels/:id" element={<ParcelPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </NavTrailProvider>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
