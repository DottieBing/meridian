import type { BusinessFilters, InvestigationDto } from '@meridian/shared/api-types'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  fetchBusiness,
  fetchBusinesses,
  fetchHealth,
  fetchPresets,
  fetchScans,
  fetchWorkspaces,
  startContactScan,
} from './api'

export const isActiveScan = (s: InvestigationDto) => s.status === 'queued' || s.status === 'running'

export function useHealth() {
  return useQuery({
    queryKey: ['health'],
    queryFn: fetchHealth,
    refetchInterval: 15_000,
    retry: false,
  })
}

export function useWorkspaces() {
  return useQuery({ queryKey: ['workspaces'], queryFn: fetchWorkspaces, retry: false })
}

export function usePresets() {
  return useQuery({ queryKey: ['presets'], queryFn: fetchPresets, staleTime: 5 * 60_000 })
}

export function useBusinesses(filters: BusinessFilters) {
  return useQuery({
    queryKey: ['businesses', filters],
    queryFn: () => fetchBusinesses(filters),
    placeholderData: keepPreviousData,
    retry: false,
  })
}

export function useBusiness(id: string) {
  return useQuery({
    queryKey: ['business', id],
    queryFn: () => fetchBusiness(id),
    enabled: id.length > 0,
    retry: false,
  })
}

export function useScans(businessId: string) {
  return useQuery({
    queryKey: ['scans', businessId],
    queryFn: () => fetchScans(businessId),
    enabled: businessId.length > 0,
    refetchInterval: (query) => (query.state.data?.some(isActiveScan) ? 2000 : false),
  })
}

export function useStartScan(businessId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => startContactScan(businessId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['scans', businessId] }),
  })
}