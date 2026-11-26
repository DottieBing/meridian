export function StaticWordmark({
  className = '',
  ink = '#0b0f0a',
  accent = '#4e8a00',
}: {
  className?: string
  ink?: string
  accent?: string
}) {
  return (
    <span
      role="img"
      aria-label="Meridian"
      className={`inline-flex select-none items-baseline font-medium leading-[1.1] tracking-[-0.045em] ${className}`}
      style={{ color: ink }}
    >
      merid
      <span
        aria-hidden="true"
        className="ml-[0.06em] mr-[0.05em] inline-block h-[0.9em] w-[0.085em] rounded-[1px]"
        style={{ backgroundColor: accent }}
      />
      an
    </span>
  )
}