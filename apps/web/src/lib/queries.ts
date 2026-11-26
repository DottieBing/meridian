import type { BusinessFilters, InvestigationDto } from '@meridian/shared/api-types'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  fetchAudit,
  fetchAuditRuns,
  fetchBusiness,
  fetchBusinesses,
  fetchHealth,
  fetchPresets,
  fetchScans,
  fetchWorkspaces,
  startContactScan,
  startWebsiteAudit,
  fetchTechOptions,
  fetchMobileAudit,
  fetchMobileRuns,
  startMobileAudit,
  fetchReportSettings,
  saveReportSettings,
  uploadReportLogo,
  removeReportLogo
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

export function useAudit(businessId: string) {
  return useQuery({
    queryKey: ['audit', businessId],
    queryFn: () => fetchAudit(businessId),
    enabled: businessId.length > 0,
    retry: false,
  })
}

export function useAuditRuns(businessId: string) {
  return useQuery({
    queryKey: ['audit-runs', businessId],
    queryFn: () => fetchAuditRuns(businessId),
    enabled: businessId.length > 0,
    refetchInterval: (query) => (query.state.data?.some(isActiveScan) ? 2000 : false),
  })
}

export function useStartAudit(businessId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => startWebsiteAudit(businessId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['audit-runs', businessId] }),
  })
}

export function useTechOptions() {
  return useQuery({ queryKey: ['tech-options'], queryFn: fetchTechOptions, staleTime: 60_000, retry: false })
}

export function useMobileAudit(businessId: string) {
  return useQuery({
    queryKey: ['mobile', businessId],
    queryFn: () => fetchMobileAudit(businessId),
    enabled: businessId.length > 0,
    retry: false,
  })
}

export function useMobileRuns(businessId: string) {
  return useQuery({
    queryKey: ['mobile-runs', businessId],
    queryFn: () => fetchMobileRuns(businessId),
    enabled: businessId.length > 0,
    refetchInterval: (query) => (query.state.data?.some(isActiveScan) ? 2000 : false),
  })
}

export function useStartMobileAudit(businessId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => startMobileAudit(businessId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['mobile-runs', businessId] }),
  })
}

export function useReportSettings() {
  return useQuery({ queryKey: ['report-settings'], queryFn: fetchReportSettings })
}

export function useSaveReportSettings() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: saveReportSettings,
    onSuccess: (data) => qc.setQueryData(['report-settings'], data),
  })
}

export function useUploadReportLogo() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: uploadReportLogo,
    onSuccess: (data) => qc.setQueryData(['report-settings'], data),
  })
}

export function useRemoveReportLogo() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: removeReportLogo,
    onSuccess: (data) => qc.setQueryData(['report-settings'], data),
  })
}