import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { Button } from './Button'

type DirectoryHeaderProps = {
  id?: string
  eyebrow: string
  title: string
  description: string
  children: ReactNode
  footer?: ReactNode
}

export function DirectoryHeader({ id, eyebrow, title, description, children, footer }: DirectoryHeaderProps) {
  return (
    <header className="border-b border-slate-100 p-4 sm:p-5">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center">
        <div className="min-w-0 xl:min-w-52">
          <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-brand-orange">{eyebrow}</p>
          <h3 className="mt-1 text-base font-bold tracking-[-0.02em] text-brand-blue" id={id}>{title}</h3>
          <p className="mt-1 text-[11px] text-slate-400">{description}</p>
        </div>
        <div className="ml-auto flex w-full flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center xl:w-auto xl:justify-end">
          {children}
        </div>
      </div>
      {footer ? <div className="mt-4 flex min-h-7 items-center justify-between gap-3 border-t border-slate-100 pt-4 text-[10px] font-semibold text-slate-400">{footer}</div> : null}
    </header>
  )
}

type CreateRecordButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode
}

export function CreateRecordButton({ className = '', children, ...props }: CreateRecordButtonProps) {
  return (
    <Button
      className={`group w-full sm:w-auto ${className}`}
      variant="primary"
      size="medium"
      leadingIcon={(
        <svg className="size-4 transition-transform group-hover:rotate-90" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <path d="M12 5v14M5 12h14" />
        </svg>
      )}
      {...props}
    >
      {children}
    </Button>
  )
}
