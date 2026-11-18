import type { BusinessDetail } from '@meridian/shared/api-types'
import type { ReactNode } from 'react'
import { fmtDate } from '../../lib/format'
import { Badge } from '../ui/Badge'

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-border bg-surface">
      <div className="border-b border-border px-4 py-2.5 font-mono text-[11px] tracking-wider text-muted">
        {title}
      </div>
      <div className="px-4 py-3">{children}</div>
    </section>
  )
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-1 text-sm">
      <span className="text-muted">{label}</span>
      <span className="min-w-0 truncate text-right">{children}</span>
    </div>
  )
}

export function OverviewPanel({ biz }: { biz: BusinessDetail }) {
  const live = biz.contacts.filter((c) => !c.staleAt)
  const count = (t: string) => live.filter((c) => c.type === t).length
  const stats = [
    ['Emails', count('email')],
    ['Phones', count('phone')],
    ['Social', count('social')],
    ['Forms', count('contact_form')],
  ] as const

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stats.map(([label, n]) => (
          <div key={label} className="rounded-xl border border-border bg-surface p-4">
            <div className="font-mono text-[11px] tracking-wider text-muted">{label.toUpperCase()}</div>
            <div className="mt-1 text-2xl font-medium">{n}</div>
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="BUSINESS">
          <Row label="Industry">{biz.industry ?? '—'}</Row>
          <Row label="Niche">{biz.niche ?? '—'}</Row>
          <Row label="City">{biz.city ?? '—'}</Row>
          <Row label="Country">{biz.countryCode ?? '—'}</Row>
          <Row label="Lead status">{biz.status}</Row>
          <Row label="First seen">{fmtDate(biz.firstSeenAt)}</Row>
          <Row label="Last seen">{fmtDate(biz.lastSeenAt)}</Row>
        </Card>

        <Card title="WEBSITES">
          {biz.websites.length === 0 && <div className="text-sm text-muted">No website known.</div>}
          {biz.websites.map((w) => (
            <div key={w.id} className="py-1.5 text-sm">
              <div className="flex items-center justify-between gap-3">
                <a href={w.url} target="_blank" rel="noreferrer noopener" className="truncate hover:text-line">
                  {w.domain}
                </a>
                <Badge tone={w.status === 'active' ? 'lime' : 'warn'}>{w.status}</Badge>
              </div>
              <div className="truncate text-xs text-muted">
                {w.url} · checked {fmtDate(w.lastCheckedAt)}
              </div>
            </div>
          ))}
        </Card>

        <Card title={`LOCATIONS · ${biz.locations.length}`}>
          {biz.locations.length === 0 && <div className="text-sm text-muted">No location known.</div>}
          {biz.locations.map((l) => (
            <div key={l.id} className="py-1.5 text-sm">
              <div className="flex items-center gap-2">
                <span className="truncate">{l.label ?? l.addressLine ?? 'Unnamed location'}</span>
                {l.isPrimary && <Badge>Primary</Badge>}
              </div>
              <div className="text-xs text-muted">
                {[l.addressLine, l.city, l.postalCode].filter(Boolean).join(', ') || '—'}
                {l.latitude !== null && l.longitude !== null && (
                  <>
                    {' · '}
                    <a
                      href={`https://www.openstreetmap.org/?mlat=${l.latitude}&mlon=${l.longitude}#map=17/${l.latitude}/${l.longitude}`}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="hover:text-text"
                    >
                      {l.latitude.toFixed(4)}, {l.longitude.toFixed(4)}
                    </a>
                  </>
                )}
              </div>
            </div>
          ))}
        </Card>

        <Card title={`SOURCES · ${biz.sources.length}`}>
          {biz.sources.length === 0 && <div className="text-sm text-muted">No source records.</div>}
          {biz.sources.map((s) => (
            <div key={`${s.provider}:${s.externalId}`} className="flex items-center justify-between gap-3 py-1.5 text-sm">
              <div className="flex min-w-0 items-center gap-2">
                <Badge>{s.provider}</Badge>
                {s.url ? (
                  <a href={s.url} target="_blank" rel="noreferrer noopener" className="truncate hover:text-line">
                    {s.externalId}
                  </a>
                ) : (
                  <span className="truncate">{s.externalId}</span>
                )}
              </div>
              <span className="shrink-0 text-xs text-muted">fetched {fmtDate(s.fetchedAt)}</span>
            </div>
          ))}
        </Card>
      </div>
    </div>
  )
}