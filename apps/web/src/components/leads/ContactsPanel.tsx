import type { ContactDto, ContactType } from '@meridian/shared/api-types'
import { ExternalLink, ShieldAlert } from 'lucide-react'
import { fmtDate } from '../../lib/format'
import { Badge, type Tone } from '../ui/Badge'
import { ConfidenceBar } from '../ui/ConfidenceBar'

const GROUPS: { type: ContactType; title: string }[] = [
  { type: 'email', title: 'Emails' },
  { type: 'phone', title: 'Phone numbers' },
  { type: 'social', title: 'Social profiles' },
  { type: 'contact_form', title: 'Contact forms' },
]

const ROLE_LABEL: Record<string, string> = {
  general: 'General',
  booking: 'Bookings',
  sales: 'Sales',
  support: 'Support',
  privacy_legal: 'Privacy / legal',
  technical: 'Technical',
  no_reply: 'No-reply',
  named_person: 'Named person',
  unknown: 'Role unknown',
}

const NOT_FOR_OUTREACH = new Set(['privacy_legal', 'no_reply', 'technical'])

function shortUrl(u: string | null): string {
  if (!u) return ''
  try {
    const x = new URL(u)
    return x.hostname.replace(/^www\./, '') + (x.pathname === '/' ? '' : x.pathname)
  } catch {
    return u
  }
}

function dnsLabel(v: ContactDto['validation']): { text: string; tone: Tone } {
  if (!v) return { text: 'DNS not checked', tone: 'neutral' }
  if (v.hasMx === true) return { text: 'Mail server found', tone: 'lime' }
  if (v.hasMx === false) {
    return v.domainResolves
      ? { text: 'No MX record', tone: 'warn' }
      : { text: 'Domain not resolving', tone: 'warn' }
  }
  return { text: 'DNS inconclusive', tone: 'neutral' }
}

function via(c: ContactDto): string {
  const m = c.evidence.method
  return m.startsWith('html-extract:') ? `website ${m.split(':')[1] ?? ''}`.trim() : m
}

function ContactRow({ c }: { c: ContactDto }) {
  const isLink = c.type === 'social' || c.type === 'contact_form'
  const blocked = c.type === 'email' && c.role !== null && NOT_FOR_OUTREACH.has(c.role)
  const dns = c.type === 'email' ? dnsLabel(c.validation) : null

  return (
    <div className={`border-b border-border px-4 py-3 last:border-b-0 ${c.staleAt ? 'opacity-60' : ''}`}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <div className="min-w-0 flex-1 basis-60">
          {isLink ? (
            <a
              href={c.value}
              target="_blank"
              rel="noreferrer noopener"
              className="inline-flex max-w-full items-center gap-1.5 truncate text-sm hover:text-line"
            >
              <span className="truncate">{shortUrl(c.value)}</span>
              <ExternalLink size={12} className="shrink-0 text-muted" />
            </a>
          ) : (
            <span className="select-all break-all text-sm">{c.value}</span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {c.type === 'email' && c.role && <Badge>{ROLE_LABEL[c.role] ?? c.role}</Badge>}
          {c.classification === 'personal' && <Badge tone="warn">Personal name</Badge>}
          {blocked && (
            <Badge tone="danger" title="This mailbox type should not receive sales outreach">
              <ShieldAlert size={11} className="mr-1" />
              Not for outreach
            </Badge>
          )}
          {dns && (
            <Badge
              tone={dns.tone}
              title="Domain-level DNS check only. It does not prove the mailbox exists or that mail will be delivered."
            >
              {dns.text}
            </Badge>
          )}
          {c.staleAt && <Badge tone="warn">Not seen in last scan</Badge>}
        </div>
        <ConfidenceBar value={c.confidence} />
      </div>
      <div className="mt-1.5 text-xs text-muted">
        via {via(c)}
        {c.evidence.sourceUrl && (
          <>
            {' · '}
            <a
              href={c.evidence.sourceUrl}
              target="_blank"
              rel="noreferrer noopener"
              className="hover:text-text"
            >
              {shortUrl(c.evidence.sourceUrl)}
            </a>
          </>
        )}
        {' · captured '}
        {fmtDate(c.evidence.capturedAt)}
      </div>
    </div>
  )
}

export function ContactsPanel({ contacts }: { contacts: ContactDto[] }) {
  if (contacts.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border p-6 text-sm text-muted">
        No contacts yet. Use “Scan website for contacts” to read the business’s own pages.
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {GROUPS.map((g) => {
        const rows = contacts
          .filter((c) => c.type === g.type)
          .sort((a, b) => Number(Boolean(a.staleAt)) - Number(Boolean(b.staleAt)) || b.confidence - a.confidence)
        if (rows.length === 0) return null
        return (
          <section key={g.type} className="rounded-xl border border-border bg-surface">
            <div className="border-b border-border px-4 py-2.5 font-mono text-[11px] tracking-wider text-muted">
              {g.title.toUpperCase()} · {rows.length}
            </div>
            {rows.map((c) => (
              <ContactRow key={c.id} c={c} />
            ))}
          </section>
        )
      })}
    </div>
  )
}