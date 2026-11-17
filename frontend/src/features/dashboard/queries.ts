import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { apiGet } from '../../services/api'
import type { Analytics, AnnotationRow, Meta, MissingResult, OperationsReport, QualityReport, Overview, Page, ParcelDetail, ParcelRow } from '../../services/types'
import type { Filters } from './useDashboardFilters'

export function useMeta() {
  return useQuery({ queryKey: ['meta'], queryFn: ({ signal }) => apiGet<Meta>('/meta', {}, signal), staleTime: Infinity })
}

export function useOverview(filters: Filters) {
  return useQuery({
    queryKey: ['overview', filters],
    queryFn: ({ signal }) => apiGet<Overview>('/overview', filters, signal),
    placeholderData: keepPreviousData,
  })
}

export interface TableState {
  sort: string
  dir: 'asc' | 'desc'
  page: number
}

/** Filters that belong to the parcels table itself (its search box and selects). */
export interface ParcelTableFilters {
  tq: string
  ann: string
  method: string
  buy_year: string
}

/** Filters that belong to the annotations log itself. */
export interface AnnotationTableFilters {
  tq: string
  timing: string
  target: string
  source: string
}

export function useParcels(filters: Filters, table: TableState, own: ParcelTableFilters) {
  return useQuery({
    queryKey: ['parcels', filters, table, own],
    queryFn: ({ signal }) => apiGet<Page<ParcelRow>>('/parcels', { ...filters, ...own, ...table, per: 20 }, signal),
    placeholderData: keepPreviousData,
  })
}

export function useAnnotations(filters: Filters, table: TableState, own: AnnotationTableFilters) {
  return useQuery({
    queryKey: ['annotations', filters, table, own],
    queryFn: ({ signal }) => apiGet<Page<AnnotationRow>>('/annotations', { ...filters, ...own, ...table, per: 20 }, signal),
    placeholderData: keepPreviousData,
  })
}

export function useParcel(id: string) {
  return useQuery({ queryKey: ['parcel', id], queryFn: ({ signal }) => apiGet<ParcelDetail>(`/parcels/${id}`, {}, signal) })
}

export function useAnalytics(filters: Filters, enabled: boolean) {
  return useQuery({
    queryKey: ['analytics', filters],
    queryFn: ({ signal }) => apiGet<Analytics>('/analytics', filters, signal),
    placeholderData: keepPreviousData,
    enabled,
  })
}

export function useQuality(filters: Filters) {
  return useQuery({
    queryKey: ['quality', filters],
    queryFn: ({ signal }) => apiGet<QualityReport>('/quality', filters, signal),
    placeholderData: keepPreviousData,
  })
}

/** The records that lack one field; fetched only when the user opens that row. */
export function useMissing(filters: Filters, metric: string, enabled: boolean) {
  return useQuery({
    queryKey: ['quality-missing', filters, metric],
    queryFn: ({ signal }) => apiGet<MissingResult>('/quality/missing', { ...filters, metric }, signal),
    enabled,
  })
}

export function useOperations(filters: Filters, enabled = true) {
  return useQuery({
    queryKey: ['operations', filters],
    queryFn: ({ signal }) => apiGet<OperationsReport>('/operations', filters, signal),
    placeholderData: keepPreviousData,
    enabled,
  })
}
