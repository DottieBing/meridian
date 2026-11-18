export function ConfidenceBar({ value }: { value: number }) {
  const pct = Math.max(0, Math.min(100, value))
  const color = pct >= 80 ? 'bg-line' : pct >= 50 ? 'bg-warn' : 'bg-muted'
  return (
    <div className="flex items-center gap-2" title={`Confidence ${pct}/100`}>
      <div className="h-1 w-14 overflow-hidden rounded-full bg-border">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="w-6 font-mono text-[11px] text-muted">{pct}</span>
    </div>
  )
}