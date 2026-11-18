import type { BusinessFilters, BusinessListItem } from '@meridian/shared/api-types'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Download, Search, Sparkles } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { Badge } from '../components/ui/Badge'
import { PageHeader } from '../components/ui/PageHeader'
import { businessExportUrl, startBulkAnalyse } from '../lib/api'
import { fmtAgo } from '../lib/format'
import { SEVERE_SIGNALS, signalLabel } from '../lib/signals'
import { useBusinesses, usePresets, useTechOptions } from '../lib/queries'

const PAGE_SIZE = 25
const SEVERITIES = ['low', 'medium', 'high', 'critical'] as const

const STATUS_NOTE: Record<string, string> = {
  dead: 'Site not found',
  unreachable: 'Unreachable',
  blocked: 'Blocks bots, check manually',
  blocked_by_robots: 'robots.txt blocks us',
  not_html: 'Not a web page',
  suppressed: 'Suppressed',
}

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

function Issues({ a }: { a: BusinessListItem['audit'] }) {
  if (!a) return <span className="text-xs text-muted">Not analysed</span>
  const note = a.outcome ? STATUS_NOTE[a.outcome] : undefined
  if (note) return <Badge tone="warn">{note}</Badge>
  if (a.signals.length === 0) {
    return <span className="text-xs text-muted">{a.issueCount > 0 ? `${a.issueCount} minor` : 'No notable issues'}</span>
  }
  return (
    <div className="flex flex-wrap gap-1">
      {a.signals.map((s) => (
        <Badge key={s} tone={SEVERE_SIGNALS.has(s) ? 'danger' : 'warn'}>
          {signalLabel(s)}
        </Badge>
      ))}
    </div>
  )
}

const dash = <span className="text-muted">—</span>

export function Leads() {
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const presets = usePresets()
  const techOptions = useTechOptions();

  const q = params.get('q') ?? ''
  const industry = params.get('industry') ?? ''
  const hasWebsite = params.get('web') === '1'
  const hasEmail = params.get('email') === '1'
  const hasPhone = params.get('phone') === '1'
  const contactable = params.get('contact') === '1'
  const audited = params.get('audited') === '1'
  const minSeverity = SEVERITIES.find((s) => s === params.get('sev'))
  const sort = params.get('sort') === 'issues' ? 'issues' : 'recent'
  const tech = params.get('tech') ?? ''
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
    ...(contactable ? { contactable: true } : {}),
    ...(audited ? { audited: true } : {}),
    ...(minSeverity ? { minSeverity } : {}),
    ...(tech ? { tech } : {}),
    sort,
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
  const anyFilter = Boolean(q || industry || hasWebsite || hasEmail || hasPhone || contactable || audited || minSeverity || tech)

  const analyse = useMutation({
    mutationFn: () => startBulkAnalyse(industry || undefined),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['businesses'] }),
  })

  return (
    <div className="mx-auto max-w-6xl p-6 lg:p-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <PageHeader
          title="Lead Database"
          description="Every discovered business, with its contacts and the measurable issues found on its website."
        />
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={analyse.isPending}
            onClick={() => analyse.mutate()}
            title="Scans the next 25 sites that have a website and have not been analysed yet"
            className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm hover:border-line/50 disabled:opacity-50"
          >
            <Sparkles size={14} /> Analyse next 25
          </button>
          <a
            href={businessExportUrl(filters)}
            className="inline-flex items-center gap-1.5 rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-on-accent"
          >
            <Download size={14} /> Export CSV
          </a>
        </div>
      </div>
      {analyse.isSuccess && (
        <p className="mt-2 text-xs text-muted">
          Queued {analyse.data.queued} site{analyse.data.queued === 1 ? '' : 's'}. Refresh in a few minutes to see
          the results.
        </p>
      )}
      {analyse.isError && <p className="mt-2 text-xs text-danger">Couldn’t queue the analysis. Is the API running?</p>}

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
        <select
          value={minSeverity ?? ''}
          onChange={(e) => setParam('sev', e.target.value || null)}
          aria-label="Minimum issue severity"
          className="rounded-md border border-border bg-surface px-2.5 py-1.5 text-sm outline-none focus:border-line/60"
        >
          <option value="">Any issues</option>
          <option value="medium">Medium or worse</option>
          <option value="high">High or worse</option>
          <option value="critical">Critical only</option>
        </select>
        <select
          value={sort}
          onChange={(e) => setParam('sort', e.target.value === 'issues' ? 'issues' : null)}
          aria-label="Sort order"
          className="rounded-md border border-border bg-surface px-2.5 py-1.5 text-sm outline-none focus:border-line/60"
        >
          <option value="recent">Recently seen</option>
          <option value="issues">Most issues first</option>
        </select>
        <select
          value={tech}
          onChange={(e) => setParam('tech', e.target.value || null)}
          aria-label="Technology"
          className="rounded-md border border-border bg-surface px-2.5 py-1.5 text-sm outline-none focus:border-line/60"
        >
          <option value="">Any technology</option>
          {(techOptions.data ?? [])
            .filter((o) => o.sites >= 2)
            .map((o) => (
              <option key={o.slug} value={o.slug}>
                {o.name} ({o.sites})
              </option>
            ))}
        </select>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <Toggle label="Has website" on={hasWebsite} onClick={() => setParam('web', hasWebsite ? null : '1')} />
        <Toggle label="Has email" on={hasEmail} onClick={() => setParam('email', hasEmail ? null : '1')} />
        <Toggle label="Has phone" on={hasPhone} onClick={() => setParam('phone', hasPhone ? null : '1')} />
        <Toggle label="Contactable email" on={contactable} onClick={() => setParam('contact', contactable ? null : '1')} />
        <Toggle label="Analysed" on={audited} onClick={() => setParam('audited', audited ? null : '1')} />
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
        <table className="w-full min-w-208 text-left text-sm">
          <thead>
            <tr className="border-b border-border bg-surface font-mono text-[11px] tracking-wider text-muted">
              <th className="px-4 py-2.5 font-normal">BUSINESS</th>
              <th className="px-4 py-2.5 font-normal">WEBSITE</th>
              <th className="px-4 py-2.5 font-normal">ISSUES FOUND</th>
              <th
                className="px-4 py-2.5 text-right font-normal"
                title="Sum of severity weights: critical 8, high 5, medium 3, low 1. A sorting aid, not a quality score."
              >
                WEIGHT
              </th>
              <th className="px-4 py-2.5 font-normal">CONTACT</th>
              <th className="px-4 py-2.5 text-right font-normal">LAST SEEN</th>
            </tr>
          </thead>
          <tbody className={isFetching && !isPending ? 'opacity-60 transition-opacity' : ''}>
            {isPending &&
              Array.from({ length: 8 }, (_, i) => (
                <tr key={i} className="border-b border-border last:border-0">
                  <td colSpan={6} className="px-4 py-3">
                    <div className="h-4 animate-pulse rounded bg-border" />
                  </td>
                </tr>
              ))}
            {isError && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-sm text-muted">
                  Couldn’t load businesses. Is the API running?
                </td>
              </tr>
            )}
            {data && data.data.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-sm text-muted">
                  {anyFilter ? 'No businesses match these filters.' : 'No businesses yet. Run a discovery search first.'}
                </td>
              </tr>
            )}
            {data?.data.map((b) => (
              <tr
                key={b.id}
                onClick={() => navigate(`/leads/${b.id}`)}
                className="cursor-pointer border-b border-border align-top transition-colors last:border-0 hover:bg-surface"
              >
                <td className="px-4 py-2.5">
                  <Link
                    to={`/leads/${b.id}`}
                    onClick={(e) => e.stopPropagation()}
                    className="font-medium hover:text-line"
                  >
                    {b.name}
                  </Link>
                  <div className="text-xs text-muted">{[b.niche ?? b.industry, b.city].filter(Boolean).join(' · ')}</div>
                </td>
                <td className="max-w-48 px-4 py-2.5">
                  <div className="truncate">{b.website ?? dash}</div>
                  {b.platform && <div className="mt-0.5 truncate text-xs text-muted">{b.platform}</div>}
                </td>
                <td className="px-4 py-2.5">
                  <Issues a={b.audit} />
                </td>
                <td className="px-4 py-2.5 text-right font-mono">{b.audit && !STATUS_NOTE[b.audit.outcome ?? ''] ? b.audit.issueWeight : dash}</td>
                <td className="px-4 py-2.5">
                  {b.contactable ? (
                    <Badge tone="lime">Email ready</Badge>
                  ) : b.emailCount > 0 ? (
                    <Badge title="Only generic privacy, technical or no-reply mailboxes were found">No outreach email</Badge>
                  ) : (
                    dash
                  )}
                  {b.phoneCount > 0 && <span className="ml-2 text-xs text-muted">{b.phoneCount} phone</span>}
                </td>
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