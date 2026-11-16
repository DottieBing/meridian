import { fmtUptime } from '../../lib/format'
import { useHealth } from '../../lib/queries'

export function ApiStatus() {
  const { data, isPending, isError } = useHealth()

  let dot = 'bg-muted'
  let text = 'Checking…'

  if (!isPending) {
    if (isError || !data) {
      dot = 'bg-danger'
      text = 'API offline'
    } else if (data.status === 'ok') {
      dot = 'bg-line'
      text = `API online · DB ${data.checks.database.latencyMs} ms`
    } else {
      dot = 'bg-warn'
      text = 'API up · DB unreachable'
    }
  }

  const title = data ? `v${data.version} · up ${fmtUptime(data.uptimeSeconds)}` : undefined

  return (
    <div
      title={title}
      className="flex items-center gap-2 rounded-full border border-border px-3 py-1 font-mono text-xs text-muted"
    >
      <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
      {text}
    </div>
  )
}