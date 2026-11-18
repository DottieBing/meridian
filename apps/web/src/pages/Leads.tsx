import type { BusinessFilters } from '@meridian/shared/api-types'
import { Search } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { PageHeader } from '../components/ui/PageHeader'
import { fmtAgo } from '../lib/format'
import { useBusinesses, usePresets } from '../lib/queries'

const PAGE_SIZE = 25

function Toggle({ label, on, onClick }: { label: string; on: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={`rounded-md border px-2.5 py-1.5 text-xs transition-colors ${
        on ? 'border-line/50 bg-line/10 text-line' : 'border-border text-muted hover:text-text'
      }`}
    >
      {label}
    </button>
  )
}

const dash = <span className="text-muted">—</span>

export function Leads() {
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const presets = usePresets()

  const q = params.get('q') ?? ''
  const industry = params.get('industry') ?? ''
  const hasWebsite = params.get('web') === '1'
  const hasEmail = params.get('email') === '1'
  const hasPhone = params.get('phone') === '1'
  const page = Math.max(0, Number(params.get('page') ?? '0') || 0)

  const [search, setSearch] = useState(q)

  useEffect(() => {
    const t = setTimeout(() => {
      setParams(
        (prev) => {
          if ((prev.get('q') ?? '') === search) return prev
          const next = new URLSearchParams(prev)
          if (search) next.set('q', search)
          else next.delete('q')
          next.delete('page')
          return next
        },
        { replace: true },
      )
    }, 300)
    return () => clearTimeout(t)
  }, [search, setParams])

  const setParam = (key: string, value: string | null) =>
    setParams((prev) => {
      const next = new URLSearchParams(prev)
      if (value) next.set(key, value)
      else next.delete(key)
      if (key !== 'page') next.delete('page')
      return next
    })

  const filters: BusinessFilters = {
    ...(q ? { q } : {}),
    ...(industry ? { industry } : {}),
    ...(hasWebsite ? { hasWebsite: true } : {}),
    ...(hasEmail ? { hasEmail: true } : {}),
    ...(hasPhone ? { hasPhone: true } : {}),
    limit: PAGE_SIZE,
    offset: page * PAGE_SIZE,
  }

  const { data, isPending, isError, isFetching } = useBusinesses(filters)
  const total = data?.page.total ?? 0
  const industries = useMemo(
    () => [...new Set((presets.data ?? []).map((p) => p.industry))].sort(),
    [presets.data],
  )
  const from = total === 0 ? 0 : page * PAGE_SIZE + 1
  const to = Math.min(total, (page + 1) * PAGE_SIZE)
  const anyFilter = Boolean(q || industry || hasWebsite || hasEmail || hasPhone)

  return (
    <div className="mx-auto max-w-6xl p-6 lg:p-8">
      <PageHeader
        title="Lead Database"
        description="Every discovered business, with the contacts found on OpenStreetMap and on its own website."
      />

      <div className="mt-6 flex flex-wrap items-center gap-2">
        <div className="relative min-w-52 flex-1 sm:max-w-72">
          <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name"
            aria-label="Search by name"
            className="w-full rounded-md border border-border bg-surface py-1.5 pl-8 pr-3 text-sm outline-none placeholder:text-muted focus:border-line/60"
          />
        </div>
        <select
          value={industry}
          onChange={(e) => setParam('industry', e.target.value || null)}
          aria-label="Industry"
          className="rounded-md border border-border bg-surface px-2.5 py-1.5 text-sm outline-none focus:border-line/60"
        >
          <option value="">All industries</option>
          {industries.map((i) => (
            <option key={i} value={i}>
              {i}
            </option>
          ))}
        </select>
        <Toggle label="Has website" on={hasWebsite} onClick={() => setParam('web', hasWebsite ? null : '1')} />
        <Toggle label="Has email" on={hasEmail} onClick={() => setParam('email', hasEmail ? null : '1')} />
        <Toggle label="Has phone" on={hasPhone} onClick={() => setParam('phone', hasPhone ? null : '1')} />
        {anyFilter && (
          <button
            type="button"
            onClick={() => {
              setSearch('')
              setParams({}, { replace: true })
            }}
            className="px-1.5 text-xs text-muted hover:text-text"
          >
            Clear
          </button>
        )}
      </div>

      <div className="mt-4 overflow-x-auto rounded-xl border border-border">
        <table className="w-full min-w-176 text-left text-sm">
          <thead>
            <tr className="border-b border-border bg-surface font-mono text-[11px] tracking-wider text-muted">
              <th className="px-4 py-2.5 font-normal">BUSINESS</th>
              <th className="px-4 py-2.5 font-normal">INDUSTRY</th>
              <th className="px-4 py-2.5 font-normal">WEBSITE</th>
              <th className="px-4 py-2.5 text-right font-normal">EMAIL</th>
              <th className="px-4 py-2.5 text-right font-normal">PHONE</th>
              <th className="px-4 py-2.5 text-right font-normal">SITES</th>
              <th className="px-4 py-2.5 text-right font-normal">LAST SEEN</th>
            </tr>
          </thead>
          <tbody className={isFetching && !isPending ? 'opacity-60 transition-opacity' : ''}>
            {isPending &&
              Array.from({ length: 8 }, (_, i) => (
                <tr key={i} className="border-b border-border last:border-0">
                  <td colSpan={7} className="px-4 py-3">
                    <div className="h-4 animate-pulse rounded bg-border" />
                  </td>
                </tr>
              ))}
            {isError && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-sm text-muted">
                  Couldn’t load businesses. Is the API running?
                </td>
              </tr>
            )}
            {data && data.data.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-sm text-muted">
                  {anyFilter ? 'No businesses match these filters.' : 'No businesses yet. Run a discovery search first.'}
                </td>
              </tr>
            )}
            {data?.data.map((b) => (
              <tr
                key={b.id}
                onClick={() => navigate(`/leads/${b.id}`)}
                className="cursor-pointer border-b border-border transition-colors last:border-0 hover:bg-surface"
              >
                <td className="px-4 py-2.5">
                  <Link
                    to={`/leads/${b.id}`}
                    onClick={(e) => e.stopPropagation()}
                    className="font-medium hover:text-line"
                  >
                    {b.name}
                  </Link>
                  {b.city && <div className="text-xs text-muted">{b.city}</div>}
                </td>
                <td className="px-4 py-2.5 text-muted">{b.niche ?? b.industry ?? dash}</td>
                <td className="max-w-56 truncate px-4 py-2.5">{b.website ?? dash}</td>
                <td className="px-4 py-2.5 text-right font-mono">{b.emailCount > 0 ? b.emailCount : dash}</td>
                <td className="px-4 py-2.5 text-right font-mono">{b.phoneCount > 0 ? b.phoneCount : dash}</td>
                <td className="px-4 py-2.5 text-right font-mono">{b.locationCount}</td>
                <td className="whitespace-nowrap px-4 py-2.5 text-right text-xs text-muted">{fmtAgo(b.lastSeenAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-3 flex items-center justify-between text-xs text-muted">
        <span>{total > 0 ? `Showing ${from}–${to} of ${total.toLocaleString()}` : ' '}</span>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={page === 0}
            onClick={() => setParam('page', page > 1 ? String(page - 1) : null)}
            className="rounded-md border border-border px-2.5 py-1 hover:text-text disabled:opacity-40"
          >
            Previous
          </button>
          <button
            type="button"
            disabled={to >= total}
            onClick={() => setParam('page', String(page + 1))}
            className="rounded-md border border-border px-2.5 py-1 hover:text-text disabled:opacity-40"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  )
}