import { NavLink } from 'react-router'
import { NAV } from '../../config/nav'
import { useWorkspaces } from '../../lib/queries'
import { Wordmark } from '../brand/Wordmark'

export function Sidebar({ open, onNavigate }: { open: boolean; onNavigate: () => void }) {
  const { data } = useWorkspaces()

  return (
    <aside
      className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-border bg-surface transition-transform lg:static lg:translate-x-0 ${
        open ? 'translate-x-0' : '-translate-x-full'
      }`}
    >
      <div className="flex h-14 shrink-0 items-center border-b border-border px-5">
        <Wordmark className="text-xl" />
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4">
        {NAV.map((section) => (
          <div key={section.label} className="mb-5">
            <div className="px-2.5 pb-1.5 font-mono text-[11px] tracking-wider text-muted">
              {section.label}
            </div>
            {section.items.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.path === '/'}
                onClick={onNavigate}
                className={({ isActive }) =>
                  `relative flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-[13px] transition-colors ${
                    isActive ? 'bg-bg text-text' : 'text-muted hover:bg-bg hover:text-text'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    {isActive && (
                      <span className="absolute bottom-1.5 left-0 top-1.5 w-0.5 rounded-full bg-line" />
                    )}
                    <item.icon size={16} />
                    <span className="flex-1 truncate">{item.label}</span>
                    {item.phase !== undefined && (
                      <span className="font-mono text-[10px] text-muted">P{item.phase}</span>
                    )}
                  </>
                )}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>

      <div className="shrink-0 border-t border-border px-5 py-3">
        <div className="font-mono text-[11px] tracking-wider text-muted">WORKSPACE</div>
        <div className="truncate text-sm">{data?.[0]?.name ?? '—'}</div>
      </div>
    </aside>
  )
}