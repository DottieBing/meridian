export type TabDef = { id: string; label: string; phase?: number }

export function Tabs({
  tabs,
  active,
  onChange,
}: {
  tabs: TabDef[]
  active: string
  onChange: (id: string) => void
}) {
  return (
    <div role="tablist" className="flex gap-1 overflow-x-auto border-b border-border">
      {tabs.map((t) => {
        const locked = t.phase !== undefined
        const on = t.id === active
        return (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={on}
            disabled={locked}
            onClick={() => onChange(t.id)}
            className={`relative shrink-0 px-3 py-2 text-sm transition-colors ${
              on ? 'text-text' : 'text-muted'
            } ${locked ? 'cursor-not-allowed opacity-50' : 'hover:text-text'}`}
          >
            {t.label}
            {locked && <span className="ml-1.5 font-mono text-[10px]">P{t.phase}</span>}
            {on && <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-line" />}
          </button>
        )
      })}
    </div>
  )
}