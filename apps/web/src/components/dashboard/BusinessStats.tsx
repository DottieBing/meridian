import type { BusinessFilters } from '@meridian/shared/api-types'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router'
import { fetchBusinesses } from '../../lib/api'

function useTotal(extra: Partial<BusinessFilters>) {
  return useQuery({
    queryKey: ['business-total', extra],
    queryFn: () => fetchBusinesses({ limit: 1, offset: 0, ...extra }),
    select: (d) => d.page.total,
    staleTime: 30_000,
    retry: false,
  })
}

function Stat({ label, to, value }: { label: string; to: string; value: number | undefined }) {
  return (
    <Link to={to} className="rounded-xl border border-border bg-surface p-4 transition-colors hover:border-line/50">
      <div className="font-mono text-[11px] tracking-wider text-muted">{label}</div>
      <div className="mt-2 text-2xl font-medium">{value === undefined ? '…' : value.toLocaleString()}</div>
    </Link>
  )
}

export function BusinessStats() {
  const all = useTotal({})
  const web = useTotal({ hasWebsite: true })
  const email = useTotal({ hasEmail: true })
  const phone = useTotal({ hasPhone: true })

  return (
    <div className="mt-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="BUSINESSES" to="/leads" value={all.data} />
        <Stat label="WITH A WEBSITE" to="/leads?web=1" value={web.data} />
        <Stat label="WITH AN EMAIL" to="/leads?email=1" value={email.data} />
        <Stat label="WITH A PHONE" to="/leads?phone=1" value={phone.data} />
      </div>
      <p className="mt-2 text-xs text-muted">
        Counts include contacts published on OpenStreetMap and contacts found on each business’s own website.
      </p>
    </div>
  )
}