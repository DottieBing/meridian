import { useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Radar } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router'
import { ContactsPanel } from '../components/leads/ContactsPanel'
import { OverviewPanel } from '../components/leads/OverviewPanel'
import { ScansPanel } from '../components/leads/ScansPanel'
import { Badge } from '../components/ui/Badge'
import { Tabs, type TabDef } from '../components/ui/Tabs'
import { isActiveScan, useBusiness, useScans, useStartScan } from '../lib/queries'
import { AuditPanel } from '../components/leads/AuditPanel'
import { MobilePanel } from '../components/leads/MobilePanel'

export function BusinessDetailPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const qc = useQueryClient()
  const biz = useBusiness(id)
  const scans = useScans(id)
  const startScan = useStartScan(id)
  const [tab, setTab] = useState('overview')

  const scanning = (scans.data ?? []).some(isActiveScan) || startScan.isPending
  const wasScanning = useRef(false)

  useEffect(() => {
    if (wasScanning.current && !scanning) {
      void qc.invalidateQueries({ queryKey: ['business', id] })
      void qc.invalidateQueries({ queryKey: ['audit-runs', id] })
      void qc.invalidateQueries({ queryKey: ['audit', id] })
    }
    wasScanning.current = scanning
  }, [scanning, id, qc])

  const back = () => (location.key !== 'default' ? navigate(-1) : navigate('/leads'))

  if (biz.isPending) {
    return (
      <div className="mx-auto max-w-5xl p-6 lg:p-8">
        <div className="h-8 w-64 animate-pulse rounded bg-border" />
      </div>
    )
  }

  if (biz.isError || !biz.data) {
    return (
      <div className="mx-auto max-w-5xl p-6 lg:p-8">
        <button type="button" onClick={back} className="text-sm text-muted hover:text-text">
          ← Back
        </button>
        <p className="mt-4 text-sm text-muted">This business couldn’t be loaded. It may not exist.</p>
      </div>
    )
  }

  const b = biz.data
  const site = b.websites.find((w) => w.isPrimary) ?? b.websites[0]
  const liveContacts = b.contacts.filter((c) => !c.staleAt).length

  const tabs: TabDef[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'contacts', label: `Contacts (${liveContacts})` },
    { id: 'scans', label: 'Scans' },
    { id: 'audit', label: 'Website Audit' },
    { id: 'mobile', label: 'Mobile Check' },
    { id: 'opportunities', label: 'Opportunities', phase: 6 },
    { id: 'reports', label: 'Reports', phase: 5 },
    { id: 'activity', label: 'Activity', phase: 8 },
  ]

  return (
    <div className="mx-auto max-w-5xl p-6 lg:p-8">
      <button
        type="button"
        onClick={back}
        className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-text"
      >
        <ArrowLeft size={14} /> Lead Database
      </button>

      <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-medium tracking-tight">{b.name}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted">
            {b.niche && <Badge>{b.niche}</Badge>}
            {b.city && <span>{b.city}</span>}
            {site && (
              <a href={site.url} target="_blank" rel="noreferrer noopener" className="hover:text-line">
                {site.domain}
              </a>
            )}
          </div>
        </div>
        <button
          type="button"
          disabled={!site || scanning}
          onClick={() => startScan.mutate()}
          title={site ? undefined : 'This business has no website to scan'}
          className="inline-flex items-center gap-2 rounded-md bg-accent px-3.5 py-2 text-sm font-medium text-on-accent transition-opacity disabled:opacity-50"
        >
          <Radar size={15} className={scanning ? 'animate-pulse' : ''} />
          {scanning ? 'Scanning…' : 'Analyse website'}
        </button>
      </div>
      {startScan.isError && (
        <p className="mt-2 text-xs text-danger">Couldn’t start the scan. Is the worker running?</p>
      )}

      <div className="mt-6">
        <Tabs tabs={tabs} active={tab} onChange={setTab} />
      </div>

      <div className="mt-5">
        {tab === 'overview' && <OverviewPanel biz={b} />}
        {tab === 'contacts' && <ContactsPanel contacts={b.contacts} />}
        {tab === 'audit' && <AuditPanel businessId={b.id} hasWebsite={Boolean(site)} siteUrl={site?.url} />}
        {tab === 'mobile' && <MobilePanel businessId={b.id} hasWebsite={Boolean(site)} />}
        {tab === 'scans' &&
          (scans.isError ? (
            <p className="text-sm text-muted">Couldn’t load scan history.</p>
          ) : (
            <ScansPanel scans={scans.data ?? []} />
          ))}
      </div>
    </div>
  )
}