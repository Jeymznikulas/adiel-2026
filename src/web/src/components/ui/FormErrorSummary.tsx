import { useEffect, useRef } from 'react'

type FormErrorSummaryProps = {
  message: string
  title?: string
  className?: string
}

/** Keeps a failed form submission visible to the person who made it. */
export function FormErrorSummary({ message, title = 'Please review the form', className = '' }: FormErrorSummaryProps) {
  const summaryRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!message) return

    const frame = window.requestAnimationFrame(() => {
      summaryRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
      summaryRef.current?.focus({ preventScroll: true })
    })
    return () => window.cancelAnimationFrame(frame)
  }, [message])

  if (!message) return null

  return (
    <div ref={summaryRef} tabIndex={-1} role="alert" aria-live="assertive" className={`rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-left text-xs text-red-800 outline-none ring-red-200 focus:ring-4 ${className}`}>
      <p className="font-extrabold">{title}</p>
      <p className="mt-1 font-semibold leading-5">{message}</p>
    </div>
  )
}
