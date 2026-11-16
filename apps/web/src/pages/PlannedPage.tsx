import { PageHeader } from '../components/ui/PageHeader'
import type { NavItem } from '../config/nav'

export function PlannedPage({ item }: { item: NavItem }) {
  return (
    <div className="mx-auto max-w-4xl p-6 lg:p-8">
      <PageHeader title={item.label} description={item.summary} />
      <div className="mt-6 rounded-xl border border-dashed border-border p-6">
        <div className="flex items-center gap-2 text-sm">
          <item.icon size={16} className="text-line" />
          <span>Not built yet</span>
        </div>
        <p className="mt-2 text-sm text-muted">
          This module is scheduled for Phase {item.phase ?? '—'}. It will show real data once its engine
          exists, so there are no mock numbers here.
        </p>
      </div>
    </div>
  )
}