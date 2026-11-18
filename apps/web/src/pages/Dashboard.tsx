import type { ReactNode } from 'react'
import { BusinessStats } from '../components/dashboard/BusinessStats'
import { PageHeader } from '../components/ui/PageHeader'
import { fmtUptime } from '../lib/format'
import { useHealth, useWorkspaces } from '../lib/queries'

const PHASES = [
  { n: 1, name: 'Foundation', status: 'In progress' },
  { n: 2, name: 'Business discovery', status: 'Next' },
  { n: 3, name: 'Contact intelligence', status: 'Planned' },
  { n: 4, name: 'Website intelligence', status: 'Planned' },
  { n: 5, name: 'Business reporting', status: 'Planned' },
  { n: 6, name: 'Opportunity intelligence', status: 'Planned' },
  { n: 7, name: 'Pitch intelligence', status: 'Planned' },
  { n: 8, name: 'CRM and outreach tracking', status: 'Planned' },
  { n: 9, name: 'Owner and competitor intelligence', status: 'Planned' },
  { n: 10, name: 'Scale and advanced analytics', status: 'Planned' },
]

function Card({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <div className="font-mono text-[11px] tracking-wider text-muted">{label}</div>
      <div className="mt-2">{children}</div>
    </div>
  )
}

export function Dashboard() {
  const health = useHealth()
  const workspaces = useWorkspaces()
  const h = health.data
  const ws = workspaces.data?.[0]

  const apiText = health.isPending ? '…' : health.isError || !h ? 'Offline' : 'Online'
  const dbText = health.isPending ? '…' : !h ? 'Unknown' : h.checks.database.ok ? 'Connected' : 'Unreachable'

  return (
    <div className="mx-auto max-w-5xl p-6 lg:p-8">
      <PageHeader
        title="Dashboard"
        description="System status and discovery numbers, live from your own database."
      />

      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <Card label="API">
          <div className="text-xl font-medium">{apiText}</div>
          <div className="mt-1 text-xs text-muted">
            {h ? `v${h.version} · up ${fmtUptime(h.uptimeSeconds)}` : 'No response yet'}
          </div>
        </Card>
        <Card label="DATABASE">
          <div className="text-xl font-medium">{dbText}</div>
          <div className="mt-1 text-xs text-muted">
            {h ? `Ping ${h.checks.database.latencyMs} ms` : 'No response yet'}
          </div>
        </Card>
        <Card label="WORKSPACE">
          <div className="text-xl font-medium">{ws?.name ?? '—'}</div>
          <div className="mt-1 font-mono text-xs text-muted">{ws ? `${ws.id.slice(0, 8)}…` : 'Not loaded'}</div>
        </Card>
      </div>

      <BusinessStats />

      <div className="mt-6 rounded-xl border border-border bg-surface">
        <div className="border-b border-border px-4 py-3 font-mono text-[11px] tracking-wider text-muted">
          BUILD ROADMAP
        </div>
        {PHASES.map((p) => (
          <div
            key={p.n}
            className="flex items-center gap-3 border-b border-border px-4 py-2.5 text-sm last:border-b-0"
          >
            <span className="w-6 font-mono text-xs text-muted">P{p.n}</span>
            <span className="flex-1">{p.name}</span>
            <span
              className={`rounded-md px-2 py-0.5 text-xs ${
                p.status === 'In progress'
                  ? 'bg-line/15 text-line'
                  : p.status === 'Next'
                    ? 'border border-border text-text'
                    : 'text-muted'
              }`}
            >
              {p.status}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}