import { useQuery } from '@tanstack/react-query'
import { fetchHealth, fetchWorkspaces } from './api'

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