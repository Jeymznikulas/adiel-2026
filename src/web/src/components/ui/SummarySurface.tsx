import type { ComponentPropsWithoutRef } from 'react'

type SummarySurfaceProps = ComponentPropsWithoutRef<'section'>

export function SummarySurface({ children, className = '', ...props }: SummarySurfaceProps) {
  return (
    <section
      className={`app-summary-surface relative isolate overflow-hidden rounded-[1.5rem] border border-slate-200/80 bg-white p-5 sm:p-6 ${className}`}
      {...props}
    >
      <span className="app-summary-accent pointer-events-none absolute inset-x-8 top-0 -z-10 h-px bg-[linear-gradient(90deg,transparent,rgba(253,77,0,0.45),rgba(0,20,76,0.18),transparent)]" aria-hidden="true" />
      <span className="pointer-events-none absolute -right-20 -top-24 -z-10 size-64 rounded-full bg-[radial-gradient(circle,rgba(0,20,76,0.055),transparent_68%)]" aria-hidden="true" />
      <span className="pointer-events-none absolute -bottom-28 left-1/3 -z-10 h-44 w-80 rounded-full bg-[radial-gradient(circle,rgba(253,77,0,0.025),transparent_70%)]" aria-hidden="true" />
      {children}
    </section>
  )
}
