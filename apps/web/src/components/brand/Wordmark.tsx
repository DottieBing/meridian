import { useEffect, useRef } from 'react'

type WordmarkProps = {
  className?: string
  animate?: boolean
  onDone?: () => void
}

const BEFORE = ['m', 'e', 'r', 'i', 'd']
const AFTER = ['a', 'n']

export function Wordmark({ className = '', animate = false, onDone }: WordmarkProps) {
  const rootRef = useRef<HTMLSpanElement>(null)
  const lineRef = useRef<HTMLSpanElement>(null)
  const onDoneRef = useRef(onDone)

  useEffect(() => {
    onDoneRef.current = onDone
  })

  useEffect(() => {
    const root = rootRef.current
    const line = lineRef.current
    if (!animate || !root || !line) return

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      onDoneRef.current?.()
      return
    }

    const styles = getComputedStyle(root)
    const muted = styles.getPropertyValue('--muted').trim()
    const text = styles.getPropertyValue('--text').trim()
    const rootBox = root.getBoundingClientRect()
    const lineBox = line.getBoundingClientRect()
    const slot = lineBox.left - rootBox.left
    const total = rootBox.width
    const duration = 1900
    const sweep = 0.7
    const animations: Animation[] = []

    const lineAnim = line.animate(
      [
        { transform: `translateX(${-slot}px)`, offset: 0 },
        { transform: `translateX(${total - slot - lineBox.width}px)`, offset: sweep },
        { transform: 'translateX(0)', offset: 1 },
      ],
      { duration, easing: 'linear' },
    )
    animations.push(lineAnim)

    root.querySelectorAll<HTMLElement>('[data-letter]').forEach((el) => {
      const box = el.getBoundingClientRect()
      const center = (box.left - rootBox.left + box.width / 2) / total
      animations.push(
        el.animate([{ color: muted }, { color: text }], {
          duration: 260,
          delay: center * duration * sweep,
          fill: 'backwards',
        }),
      )
    })

    lineAnim.finished.then(() => onDoneRef.current?.()).catch(() => {})

    return () => animations.forEach((a) => a.cancel())
  }, [animate])

  return (
    <span
      ref={rootRef}
      role="img"
      aria-label="Meridian"
      className={`inline-flex select-none items-baseline font-medium leading-[1.1] tracking-[-0.045em] ${className}`}
    >
      {BEFORE.map((c, i) => (
        <span key={`b${i}`} data-letter aria-hidden="true">
          {c}
        </span>
      ))}
      <span
        ref={lineRef}
        aria-hidden="true"
        className="ml-[0.06em] mr-[0.05em] inline-block h-[0.9em] w-[0.085em] rounded-[1px] bg-line"
      />
      {AFTER.map((c, i) => (
        <span key={`a${i}`} data-letter aria-hidden="true">
          {c}
        </span>
      ))}
    </span>
  )
}