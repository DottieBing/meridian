import { useParams } from 'react-router'
import type { ReportFindingDto, ReportPriority } from '@meridian/shared/api-types'
import { fmtAgo } from '../lib/format'
import { useInternalReport } from '../lib/queries'
import { Badge } from '../components/ui/Badge'

const PRIORITY_LABEL: Record<ReportPriority, string> = { now: 'Fix now', soon: 'Fix soon', worth_doing: 'Worth doing' }
const PRIORITY_ORDER: ReportPriority[] = ['now', 'soon', 'worth_doing']

const BAND_TONE: Record<string, 'lime' | 'neutral' | 'warn' | 'danger'> = { good: 'lime', fair: 'neutral', weak: 'warn', poor: 'danger' }

function FindingBlock({ f }: { f: ReportFindingDto }) {
  const cat = f.catalogue
  return (
    <div className="break-inside-avoid border-b border-border py-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={f.severity === 'critical' || f.severity === 'high' ? 'danger' : f.severity === 'medium' ? 'warn' : 'neutral'}>
          {f.severity}
        </Badge>
        <span className="text-sm font-medium">{cat?.observed ?? f.title}</span>
        {cat && <Badge>{PRIORITY_LABEL[cat.priority]}</Badge>}
        <Badge title={f.isObjective ? 'Directly observed' : 'Our judgement'}>{f.isObjective ? 'Observed' : 'Judgement'}</Badge>
        <span className="text-xs text-muted">confidence {f.confidence}%</span>
      </div>
      {cat && <p className="mt-1.5 text-sm text-muted">{cat.whyItMatters}</p>}
      {cat && <p className="mt-1 text-sm">→ {cat.recommendation}</p>}
      {!cat && f.detail && <p className="mt-1.5 text-sm text-muted">{f.detail}</p>}
      <p className="mt-1.5 text-xs text-muted">
        Source: {f.evidence.sourceUrl ?? f.affectedUrl ?? '—'} · method {f.evidence.method} · captured {fmtAgo(f.evidence.capturedAt)}
      </p>
      {f.evidence.excerpt && (
        <code className="mt-1 block max-h-20 overflow-auto whitespace-pre-wrap break-all rounded-md bg-bg px-2 py-1 font-mono text-[11px]">
          {f.evidence.excerpt}
        </code>
      )}
    </div>
  )
}

export function InternalReportPage() {
  const { id = '' } = useParams()
  const report = useInternalReport(id)

  if (report.isPending) return <div className="p-6 text-sm text-muted">Loading…</div>
  if (report.isError || !report.data) return <div className="p-6 text-sm text-muted">Couldn’t load this report.</div>
  const r = report.data
  const scores = r.audit?.summary?.scores
  const placeholder = r.audit?.summary?.outcome === 'placeholder' ? r.audit.summary['placeholder'] as { kind: string; detail: string } | undefined : undefined

  const grouped = PRIORITY_ORDER.map((p) => ({
    priority: p,
    items: r.findings.filter((f) => f.catalogue?.priority === p),
  })).filter((g) => g.items.length > 0)
  const uncatalogued = r.findings.filter((f) => !f.catalogue)

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6 print:p-0">
      <style>{`
        @media print {
          body { background: white; }
          .no-print { display: none !important; }
          a { color: inherit; text-decoration: none; }
        }
      `}</style>

      <div className="no-print flex justify-end">
        <button
          type="button"
          onClick={() => window.print()}
          className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-border/40"
        >
          Print / Save as PDF
        </button>
      </div>

      <header className="border-b border-border pb-4">
        <h1 className="text-xl font-medium">Internal report — {String(r.business['name'] ?? '')}</h1>
        <p className="mt-1 text-sm text-muted">
          Generated {fmtAgo(r.generatedAt)} · {String(r.business['industry'] ?? '')} · {String(r.business['city'] ?? '')}
        </p>
        <p className="mt-1 text-xs text-muted">
          Internal use only. Lead scores (contactability, completeness) and this layout never appear in a business-facing report.
        </p>
      </header>

      {placeholder ? (
        <section className="rounded-xl border border-border bg-surface p-4">
          <h2 className="font-medium">No real website found</h2>
          <p className="mt-1 text-sm text-muted">{placeholder.detail}</p>
          <p className="mt-2 text-sm">This is a "the business needs a website built" opportunity, not a findings-based pitch.</p>
        </section>
      ) : scores ? (
        <section className="rounded-xl border border-border bg-surface p-4">
          <div className="flex items-center gap-3">
            <span className="font-mono text-3xl">{scores.health}</span>
            <Badge tone={BAND_TONE[scores.band]}>{scores.band}</Badge>
            <span className="text-xs text-muted">Website health · method {scores.method}</span>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2 text-sm">
            {Object.entries(scores.categories).map(([cat, c]) => (
              <div key={cat} className="flex justify-between">
                <span className="text-muted">{cat}</span>
                <span className="font-mono">{c.score}</span>
              </div>
            ))}
          </div>
        </section>
      ) : (
        <section className="rounded-xl border border-border bg-surface p-4 text-sm text-muted">
          No completed website audit yet.
        </section>
      )}

      {r.mobile?.summary?.scores && (
        <section className="rounded-xl border border-border bg-surface p-4">
          <div className="flex items-center gap-3">
            <span className="font-mono text-2xl">{r.mobile.summary.scores.health}</span>
            <Badge tone={BAND_TONE[r.mobile.summary.scores.band]}>{r.mobile.summary.scores.band}</Badge>
            <span className="text-xs text-muted">Mobile check</span>
          </div>
        </section>
      )}

      {grouped.map((g) => (
        <section key={g.priority}>
          <h2 className="mb-1 text-sm font-medium text-muted">{PRIORITY_LABEL[g.priority]} ({g.items.length})</h2>
          <div className="rounded-xl border border-border bg-surface px-4">
            {g.items.map((f) => (
              <FindingBlock key={f.id} f={f} />
            ))}
          </div>
        </section>
      ))}

      {uncatalogued.length > 0 && (
        <section>
          <h2 className="mb-1 text-sm font-medium text-muted">Other findings ({uncatalogued.length})</h2>
          <div className="rounded-xl border border-border bg-surface px-4">
            {uncatalogued.map((f) => (
              <FindingBlock key={f.id} f={f} />
            ))}
          </div>
        </section>
      )}

      {r.mobileFindings.length > 0 && (
        <section>
          <h2 className="mb-1 text-sm font-medium text-muted">Mobile check findings</h2>
          <div className="rounded-xl border border-border bg-surface px-4">
            {r.mobileFindings.map((f) => (
              <FindingBlock key={f.id} f={f} />
            ))}
          </div>
        </section>
      )}

      {r.technologies.length > 0 && (
        <section>
          <h2 className="mb-1 text-sm font-medium text-muted">Technologies detected</h2>
          <div className="flex flex-wrap gap-1.5 rounded-xl border border-border bg-surface p-3">
            {r.technologies.map((t) => (
              <Badge key={t.id}>{t.name}{t.version ? ` ${t.version}` : ''}</Badge>
            ))}
          </div>
        </section>
      )}

      <section className="rounded-xl border border-dashed border-border p-3 text-xs text-muted">
        Internal only — contactability {r.leadScores.contactability}/100 · data completeness {r.leadScores.completeness}/100
      </section>
    </div>
  )
}