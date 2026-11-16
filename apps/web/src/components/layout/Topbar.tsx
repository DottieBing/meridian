import { Menu } from 'lucide-react'
import { useLocation } from 'react-router'
import { findNavItem } from '../../config/nav'
import { ApiStatus } from '../ui/ApiStatus'
import { ThemeToggle } from '../ui/ThemeToggle'

export function Topbar({ onMenu }: { onMenu: () => void }) {
  const { pathname } = useLocation()
  const current = findNavItem(pathname)

  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border px-4 lg:px-6">
      <button
        type="button"
        onClick={onMenu}
        aria-label="Open navigation"
        className="grid h-8 w-8 place-items-center rounded-md border border-border text-muted lg:hidden"
      >
        <Menu size={16} />
      </button>
      <div className="min-w-0 flex-1 truncate text-sm text-muted">
        Meridian <span className="mx-1.5">/</span>
        <span className="text-text">{current?.label ?? 'Not found'}</span>
      </div>
      <ApiStatus />
      <ThemeToggle />
    </header>
  )
}