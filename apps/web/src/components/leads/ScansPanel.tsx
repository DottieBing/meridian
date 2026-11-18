import type { InvestigationDto } from '@meridian/shared/api-types'
import { fmtAgo } from '../../lib/format'
import { Badge, type Tone } from '../ui/Badge'

const OUTCOME: Record<string, { label: string; tone: Tone }> = {
  ok: { label: 'Contacts found', tone: 'lime' },
  no_contacts: { label: 'Page read, no contacts', tone: 'warn' },
  unreachable: { label: 'Unreachable', tone: 'warn' },
  dead: { label: 'Site not found', tone: 'danger' },
  blocked: { label: 'Blocked by site', tone: 'warn' },
  blocked_by_robots: { label: 'Disallowed by robots.txt', tone: 'warn' },
  not_html: { label: 'Not a web page', tone: 'neutral' },
  suppressed: { label: 'Suppressed', tone: 'neutral' },
}

function describe(s: InvestigationDto): { label: string; tone: Tone } {
  if (s.status === 'queued') return { label: 'Queued', tone: 'neutral' }
  if (s.status === 'running') return { label: 'Scanning…', tone: 'neutral' }
  if (s.status === 'failed') return { label: 'Failed', tone: 'danger' }
  const o = s.summary?.outcome
  return (o ? OUTCOME[o] : undefined) ?? { label: s.status, tone: 'neutral' }
}

export function ScansPanel({ scans }: { scans: InvestigationDto[] }) {
  if (scans.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border p-6 text-sm text-muted">
        No scans yet for this business.
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-border bg-surface">
      {scans.map((s) => {
        const d = describe(s)
        const found = s.summary?.found
        const pages = s.summary?.pages?.length ?? 0
        return (
          <div key={s.id} className="border-b border-border px-4 py-3 last:border-b-0">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={d.tone}>{d.label}</Badge>
              <span className="text-xs text-muted">{fmtAgo(s.createdAt)}</span>
              {s.summary?.durationMs !== undefined && (
                <span className="text-xs text-muted">· {(s.summary.durationMs / 1000).toFixed(1)}s</span>
              )}
            </div>
            {s.status === 'completed' && (
              <div className="mt-1.5 text-xs text-muted">
                {pages} page{pages === 1 ? '' : 's'} read
                {found &&
                  ` · ${found.email ?? 0} email, ${found.phone ?? 0} phone, ${found.social ?? 0} social, ${found.contact_form ?? 0} form`}
                {s.summary?.newContacts !== undefined &&
                  ` · ${s.summary.newContacts} new, ${s.summary.updatedContacts ?? 0} updated`}
              </div>
            )}
            {(s.summary?.error || s.error) && (
              <div className="mt-1 text-xs text-warn">{s.summary?.error ?? s.error}</div>
            )}
          </div>
        )
      })}
    </div>
  )
}