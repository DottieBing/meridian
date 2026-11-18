import type { FindingDto, TechnologyDto } from '@meridian/shared/api-types'
import { useQueryClient } from '@tanstack/react-query'
import { Radar } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { fmtAgo } from '../../lib/format'
import { isActiveScan, useAudit, useAuditRuns, useStartAudit } from '../../lib/queries'
import { Badge, type Tone } from '../ui/Badge'

const SEVERITY: Record<FindingDto['severity'], { label: string; tone: Tone }> = {
  critical: { label: 'Critical', tone: 'danger' },
  high: { label: 'High', tone: 'danger' },
  medium: { label: 'Medium', tone: 'warn' },
  low: { label: 'Low', tone: 'neutral' },
  info: { label: 'Info', tone: 'neutral' },
}

const SEVERITY_ORDER: FindingDto['severity'][] = ['critical', 'high', 'medium', 'low', 'info']

const CATEGORY: Record<string, string> = {
  performance: 'Performance',
  seo: 'SEO',
  ux: 'Mobile / UX',
  accessibility: 'Accessibility',
  technical: 'Technical',
  security: 'Security',
  ecommerce: 'E-commerce',
  content: 'Content',
}

const OUTCOME_NOTE: Record<string, string> = {
  dead: 'The website could not be found (the domain did not resolve).',
  unreachable: 'The website did not respond.',
  blocked: 'The website refused our request (HTTP 403). It may use bot protection. Meridian identifies itself honestly and does not try to get around such protection, so this site needs a manual look.',
  blocked_by_robots: "The website's robots.txt asks crawlers to stay away.",
  not_html: 'The address is not a web page.',
  suppressed: 'This domain is on the suppression list.',
  no_snapshot: 'No readable page was available to audit.',
}

function shortUrl(u: string | null): string {
  if (!u) return ''
  try {
    const x = new URL(u)
    return x.hostname.replace(/^www\./, '') + (x.pathname === '/' ? '' : x.pathname)
  } catch {
    return u
  }
}

function FindingRow({ f }: { f: FindingDto }) {
  const sev = SEVERITY[f.severity]
  return (
    <div className="border-b border-border px-4 py-3 last:border-b-0">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={sev.tone}>{sev.label}</Badge>
        <span className="text-sm font-medium">{f.title}</span>
      </div>
      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
        <Badge>{CATEGORY[f.category] ?? f.category}</Badge>
        <Badge
          title={
            f.isObjective
              ? 'A fact observed directly in the page code, headers or files.'
              : 'A judgement call, not a proven fault.'
          }
        >
          {f.isObjective ? 'Observed' : 'Judgement'}
        </Badge>
      </div>
      {f.detail && <p className="mt-2 text-sm text-muted">{f.detail}</p>}
      <div className="mt-2 text-xs text-muted">
        {f.affectedUrl && (
          <>
            <a href={f.affectedUrl} target="_blank" rel="noreferrer noopener" className="hover:text-text">
              {shortUrl(f.affectedUrl)}
            </a>
            {' · '}
          </>
        )}
        evidence: {f.evidence.method.replace('website-audit:', '')}
        {f.evidence.excerpt && (
          <code className="mt-1 block max-h-24 overflow-auto whitespace-pre-wrap break-all rounded-md bg-bg px-2 py-1 font-mono text-[11px]">
            {f.evidence.excerpt}
          </code>
        )}
      </div>
    </div>
  )
}

const TECH_GROUPS: [string, string][] = [
  ['website_builder', 'Website builder'], ['cms', 'CMS'], ['ecommerce', 'E-commerce'],
  ['page_builder', 'Page builders'], ['plugin', 'Plugins'], ['framework', 'Frameworks'],
  ['js_library', 'Libraries'], ['booking', 'Booking and scheduling'], ['payment', 'Payments'],
  ['analytics', 'Analytics'], ['tag_manager', 'Tag managers'], ['advertising', 'Advertising'],
  ['marketing', 'Marketing'], ['chat', 'Chat'], ['consent', 'Cookie consent'],
  ['hosting', 'Hosting and CDN'], ['server', 'Server'], ['language', 'Language'], ['legacy', 'Legacy'],
]

function TechnologiesPanel({ techs }: { techs: TechnologyDto[] }) {
  return (
    <section className="rounded-xl border border-border bg-surface">
      <div className="border-b border-border px-4 py-2.5 font-mono text-[11px] tracking-wider text-muted">
        TECHNOLOGIES DETECTED · {techs.length}
      </div>
      <div className="space-y-3 px-4 py-3">
        {TECH_GROUPS.map(([cat, label]) => {
          const rows = techs.filter((t) => t.category === cat)
          if (rows.length === 0) return null
          return (
            <div key={cat} className="flex flex-wrap items-center gap-2">
              <span className="w-36 shrink-0 text-xs text-muted">{label}</span>
              {rows.map((t) => (
                <Badge
                  key={t.id}
                  tone={t.confidence >= 70 ? 'neutral' : 'warn'}
                  title={`Seen via ${t.via}${t.excerpt ? `: ${t.excerpt}` : ''} (confidence ${t.confidence})${t.detail ? ` · ${t.detail}` : ''}`}
                >
                  {t.name}
                  {t.version ? ` ${t.version}` : ''}
                </Badge>
              ))}
            </div>
          )
        })}
        <p className="text-xs text-muted">
          Detected from page code and response headers. A technology we do not know, or one hidden behind a CDN, will
          not appear, so absence is not proof it is not used. Versions are what the site reports.
        </p>
      </div>
    </section>
  )
}

export function AuditPanel({
  businessId,
  hasWebsite,
  siteUrl,
}: {
  businessId: string
  hasWebsite: boolean
  siteUrl?: string | undefined
}) {
  const qc = useQueryClient()
  const audit = useAudit(businessId)
  const runs = useAuditRuns(businessId)
  const start = useStartAudit(businessId)

  const active = (runs.data ?? []).some(isActiveScan)
  const busy = active || start.isPending
  const wasActive = useRef(false)

  useEffect(() => {
    if (wasActive.current && !active) void qc.invalidateQueries({ queryKey: ['audit', businessId] })
    wasActive.current = active
  }, [active, businessId, qc])

  const data = audit.data
  const summary = data?.investigation.summary
  const ok = summary?.outcome === 'ok' || summary?.outcome === 'tls_error'

  const deepLink = (() => {
    try {
      return siteUrl ? new URL(siteUrl).pathname.split('/').filter(Boolean).length >= 2 : false
    } catch {
      return false
    }
  })()

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-xl text-xs text-muted">
          Findings are facts observed in the page code, headers and files. Severity is our judgement of how much each
          one matters. Timing figures are measured from the machine running Meridian.
        </p>
        <button
          type="button"
          disabled={!hasWebsite || busy}
          onClick={() => start.mutate()}
          title={hasWebsite ? undefined : 'This business has no website to audit'}
          className="inline-flex items-center gap-2 rounded-md bg-accent px-3.5 py-2 text-sm font-medium text-on-accent transition-opacity disabled:opacity-50"
        >
          <Radar size={15} className={busy ? 'animate-pulse' : ''} />
          {busy ? 'Auditing…' : data ? 'Run audit again' : 'Run website audit'}
        </button>
      </div>
      {start.isError && <p className="text-xs text-danger">Couldn’t start the audit. Is the worker running?</p>}

      {deepLink && (
        <p className="text-xs text-warn">
          The stored website address is a deep page ({shortUrl(siteUrl ?? null)}). If it is a directory listing and
          not the business’s own site, these findings describe the directory.
        </p>
      )}

      {audit.isPending && <div className="h-24 animate-pulse rounded-xl bg-border" />}

      {audit.isError && <p className="text-sm text-muted">Couldn’t load the audit.</p>}

      {!audit.isPending && !audit.isError && !data && (
        <div className="rounded-xl border border-dashed border-border p-6 text-sm text-muted">
          No audit yet. It reads the pages we already stored for this site, and fetches the main page itself if none
          exist.
        </div>
      )}

      {data && summary && !ok && (
        <div className="rounded-xl border border-border bg-surface p-4 text-sm">
          <div className="font-medium">The site could not be audited</div>
          <p className="mt-1 text-muted">
            {OUTCOME_NOTE[summary.outcome ?? ''] ?? 'The audit did not complete.'}
            {summary.error ? ` (${summary.error})` : ''}
          </p>
          <p className="mt-1 text-xs text-muted">{fmtAgo(data.investigation.createdAt)}</p>
        </div>
      )}

      {data && summary && ok && (
        <>
          {summary.outcome === 'tls_error' && (
            <p className="text-xs text-warn">
              The page itself could not be loaded because of the certificate problem, so only that was checked.
            </p>
          )}
          <div className="rounded-xl border border-border bg-surface p-4">
            <div className="flex flex-wrap items-center gap-2">
              {SEVERITY_ORDER.filter((s) => (summary.bySeverity?.[s] ?? 0) > 0).map((s) => (
                <Badge key={s} tone={SEVERITY[s].tone}>
                  {summary.bySeverity?.[s]} {SEVERITY[s].label.toLowerCase()}
                </Badge>
              ))}
              {data.findings.length === 0 && <span className="text-sm">No findings from the rules we run.</span>}
            </div>
            <div className="mt-2 text-xs text-muted">
              {summary.pagesAudited ?? 0} page{summary.pagesAudited === 1 ? '' : 's'} audited
              {summary.mainPage && <> · main page {shortUrl(summary.mainPage)}</>}
              {' · '}
              {fmtAgo(data.investigation.finishedAt ?? data.investigation.createdAt)}
              {summary.truncatedPages ? ` · ${summary.truncatedPages} page(s) were cut off at 1 MB` : ''}
            </div>
          </div>

          {data.findings.length > 0 && (
            <div className="rounded-xl border border-border bg-surface">
              {data.findings.map((f) => (
                <FindingRow key={f.id} f={f} />
              ))}
            </div>
          )}
          {(data.technologies ?? []).length > 0 && <TechnologiesPanel techs={data.technologies} />}
        </>
      )}
    </div>
  )
}