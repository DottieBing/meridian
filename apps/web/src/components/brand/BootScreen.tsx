import { useState } from 'react'
import { Wordmark } from './Wordmark'

export function BootScreen({ onFinish }: { onFinish: () => void }) {
  const [leaving, setLeaving] = useState(false)

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center bg-bg transition-opacity duration-300 ${
        leaving ? 'opacity-0' : 'opacity-100'
      }`}
      onTransitionEnd={() => {
        if (leaving) onFinish()
      }}
    >
      <Wordmark animate className="text-5xl" onDone={() => setTimeout(() => setLeaving(true), 200)} />
    </div>
  )
}