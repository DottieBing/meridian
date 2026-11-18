import type { ReactNode } from 'react'

export type Tone = 'neutral' | 'lime' | 'warn' | 'danger'

const TONES: Record<Tone, string> = {
  neutral: 'border-border text-muted',
  lime: 'border-line/40 bg-line/10 text-line',
  warn: 'border-warn/40 bg-warn/10 text-warn',
  danger: 'border-danger/40 bg-danger/10 text-danger',
}

export function Badge({
  tone = 'neutral',
  title,
  children,
}: {
  tone?: Tone
  title?: string
  children: ReactNode
}) {
  return (
    <span
      title={title}
      className={`inline-flex items-center whitespace-nowrap rounded-md border px-1.5 py-0.5 text-[11px] leading-none ${TONES[tone]}`}
    >
      {children}
    </span>
  )
}