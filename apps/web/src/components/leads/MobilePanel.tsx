import { useQueryClient } from '@tanstack/react-query'
import { Smartphone } from 'lucide-react'
import { useEffect, useRef, type ReactNode } from 'react'
import { fmtAgo } from '../../lib/format'
import { isActiveScan, useMobileAudit, useMobileRuns, useStartMobileAudit } from '../../lib/queries'
import { Badge } from '../ui/Badge'
import { BAND, FindingRow } from './AuditPanel'

const OUTCOME_NOTE: Record<string, string> = {
  timeout:
    'The website did not start responding within 45 seconds from the machine running Meridian. That says as much about our connection as about the site, so re-test before drawing conclusions.',
  load_failed: 'The browser could not load the page.',
  blocked:
    'The website refused the browser (bot protection). Meridian does not try to get around that, so this site needs a manual look.',
  not_eligible: 'The website audit has to succeed before the mobile check can run.',
  suppressed: 'This domain is on the suppression list.',
}

const mb = (n: number) => `${(n / 1e6).toFixed(1)} MB`
const secs = (ms: number | null | undefined) => (ms === null || ms === undefined ? '—' : `${(ms / 1000).toFixed(1)} s`)

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-1 text-sm">
      <span className="text-muted">{label}</span>
      <span className="text-right">{children}</span>
    </div>
  )
}

export function MobilePanel({ businessId, hasWebsite }: { businessId: string; hasWebsite: boolean }) {
  const qc = useQueryClient()
  const audit = useMobileAudit(businessId)
  const runs = useMobileRuns(businessId)
  const start = useStartMobileAudit(businessId)

  const active = (runs.data ?? []).some(isActiveScan)
  const busy = active || start.isPending
  const wasActive = useRef(false)
  useEffect(() => {
    if (wasActive.current && !active) void qc.invalidateQueries({ queryKey: ['mobile', businessId] })
    wasActive.current = active
  }, [active, businessId, qc])

  const data = audit.data
  const summary = data?.investigation.summary
  const m = summary?.measurements
  const ok = summary?.outcome === 'ok' && m
  const pts = new Map<string, number>()
  for (const p of summary?.scores?.points ?? []) pts.set(p.code, (pts.get(p.code) ?? 0) + p.points)

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-xl text-xs text-muted">
          A real mobile browser (iPhone 13, 390 px wide) opens the main page from the machine running Meridian. Layout
          and error findings are scored. Load times are shown but never scored, because they mostly measure the
          connection between this machine and the site.
        </p>
        <button
          type="button"
          disabled={!hasWebsite || busy}
          onClick={() => start.mutate()}
          title={hasWebsite ? undefined : 'This business has no website to check'}
          className="inline-flex items-center gap-2 rounded-md bg-accent px-3.5 py-2 text-sm font-medium text-on-accent transition-opacity disabled:opacity-50"
        >
          <Smartphone size={15} className={busy ? 'animate-pulse' : ''} />
          {busy ? 'Checking…' : data ? 'Run mobile check again' : 'Run mobile check'}
        </button>
      </div>
      {start.isError && (
        <p className="text-xs text-danger">
          Couldn’t start the mobile check. The website audit has to have succeeded first, and the worker must be running.
        </p>
      )}

      {audit.isPending && <div className="h-24 animate-pulse rounded-xl bg-border" />}
      {audit.isError && <p className="text-sm text-muted">Couldn’t load the mobile check.</p>}

      {!audit.isPending && !audit.isError && !data && (
        <div className="rounded-xl border border-dashed border-border p-6 text-sm text-muted">
          No mobile check yet. It needs a successful website audit first, and takes about half a minute.
        </div>
      )}

      {data && summary && !ok && (
        <div className="rounded-xl border border-border bg-surface p-4 text-sm">
          <div className="font-medium">The mobile check could not be completed</div>
          <p className="mt-1 text-muted">{OUTCOME_NOTE[summary.outcome ?? ''] ?? 'The check did not complete.'}</p>
          <p className="mt-1 text-xs text-muted">{fmtAgo(data.investigation.createdAt)}</p>
        </div>
      )}

      {data && summary && m && ok && (
        <>
          <div className="grid gap-4 md:grid-cols-[auto_1fr]">
            {summary.screenshot && (
              <img
                src={`/api/v1/investigations/${data.investigation.id}/screenshot`}
                alt="The page as a phone renders it"
                className="max-h-[28rem] w-auto rounded-xl border border-border"
              />
            )}
            <section className="rounded-xl border border-border bg-surface px-4 py-3">
              {summary.scores && (
                <div className="mb-2 flex items-center gap-3">
                  <span className="font-mono text-2xl">{summary.scores.health}</span>
                  <Badge tone={BAND[summary.scores.band].tone}>{BAND[summary.scores.band].label}</Badge>
                  <span className="text-xs text-muted">Mobile check score</span>
                </div>
              )}
              <Row label="Layout width">
                {m.layoutWidth}px{m.layoutWidth > 600 ? ' (shrunken desktop layout)' : ''}
              </Row>
              <Row label="Sideways scroll">{m.scrollable && m.overflowPx >= 8 ? `${m.overflowPx}px too wide` : 'None'}</Row>
              <Row label="Data transferred">
                {mb(m.transferBytes)} in {m.requests} requests
              </Row>
              <Row label="Layout shift">{m.cls ?? '—'}</Row>
              <Row label="Largest paint (lab)">
                {secs(m.lcpMs)}
                {summary.calibration?.lcpMs ? (
                  <span className="ml-2 text-xs text-muted">
                    baseline {secs(summary.calibration.lcpMs)} for a tiny page
                  </span>
                ) : null}
              </Row>
              <Row label="Finished loading">{m.loaded ? secs(m.loadMs) : 'Did not finish within 15 s'}</Row>
              <p className="mt-2 text-xs text-muted">
                {summary.device} · {fmtAgo(data.investigation.finishedAt ?? data.investigation.createdAt)}. Timings come
                from this machine and are not scored.
              </p>
            </section>
          </div>

          {data.findings.length > 0 ? (
            <div className="rounded-xl border border-border bg-surface">
              {data.findings.map((f) => (
                <FindingRow key={f.id} f={f} points={pts.get(f.code) ?? null} />
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted">No findings from the mobile rules we run.</p>
          )}
        </>
      )}
    </div>
  )
}