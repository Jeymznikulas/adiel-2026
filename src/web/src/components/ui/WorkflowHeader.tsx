import type { ReactNode } from 'react'
import { useEffect, useRef, useState } from 'react'
import { loadSystemLogs, systemLogsUpdatedEvent, type SystemLogModule } from '../../services/activityLog'
import { Button, IconButton, type ButtonVariant } from './Button'

export type WorkflowHeaderAction = {
  label: string
  onClick: () => void
  tone?: 'primary' | 'neutral' | 'danger'
  disabled?: boolean
}

export type WorkflowHeaderBadge = {
  label: string
  tone?: 'slate' | 'blue' | 'amber' | 'green' | 'red' | 'violet'
}

type WorkflowHeaderProps = {
  eyebrow: string
  recordNumber: string
  partyName: string
  amount?: string
  createdLabel: string
  status: string
  steps: string[]
  currentStep: number
  primaryAction?: WorkflowHeaderAction
  secondaryActions?: WorkflowHeaderAction[]
  menuActions?: WorkflowHeaderAction[]
  badges?: WorkflowHeaderBadge[]
  module: SystemLogModule
  recordId: string
  children?: ReactNode
}

function Icon({ path, className = 'size-4' }: { path: string; className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={path} /></svg>
}

function badgeTone(tone: WorkflowHeaderBadge['tone'] = 'slate') {
  if (tone === 'blue') return 'border-sky-100 bg-sky-50 text-sky-700'
  if (tone === 'amber') return 'border-amber-100 bg-amber-50 text-amber-700'
  if (tone === 'green') return 'border-emerald-100 bg-emerald-50 text-emerald-700'
  if (tone === 'red') return 'border-red-100 bg-red-50 text-red-600'
  if (tone === 'violet') return 'border-violet-100 bg-violet-50 text-violet-700'
  return 'border-slate-200 bg-slate-100 text-slate-600'
}

function statusTone(status: string) {
  const value = status.toLowerCase()
  if (value.includes('approved') || value.includes('paid') || value.includes('settled') || value.includes('completed') || value.includes('delivered')) return badgeTone('green')
  if (value.includes('reject') || value.includes('void') || value.includes('cancel') || value.includes('overdue')) return badgeTone('red')
  if (value.includes('approval') || value.includes('progress') || value.includes('to pay') || value.includes('partial')) return badgeTone('amber')
  if (value.includes('sent') || value.includes('issued')) return badgeTone('blue')
  return badgeTone('slate')
}

function actionVariant(tone: WorkflowHeaderAction['tone'] = 'neutral'): ButtonVariant {
  if (tone === 'primary') return 'primary'
  if (tone === 'danger') return 'danger'
  return 'secondary'
}

function formatTimestamp(value: string) {
  const date = new Date(value)
  return new Intl.DateTimeFormat('en-PH', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }).format(date)
}

export function WorkflowHeader({ eyebrow, recordNumber, partyName, amount, createdLabel, status, steps, currentStep, primaryAction, secondaryActions = [], menuActions = [], badges = [], module, recordId, children }: WorkflowHeaderProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isHistoryOpen, setIsHistoryOpen] = useState(false)
  const [, setHistoryVersion] = useState(0)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const refresh = () => setHistoryVersion((value) => value + 1)
    window.addEventListener(systemLogsUpdatedEvent, refresh)
    return () => window.removeEventListener(systemLogsUpdatedEvent, refresh)
  }, [])

  useEffect(() => {
    if (!isMenuOpen && !isHistoryOpen) return
    function handlePointerDown(event: PointerEvent) {
      if (isMenuOpen && !menuRef.current?.contains(event.target as Node)) setIsMenuOpen(false)
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape') return
      setIsMenuOpen(false)
      setIsHistoryOpen(false)
    }
    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isHistoryOpen, isMenuOpen])

  const history = isHistoryOpen ? loadSystemLogs().filter((entry) => entry.module === module && entry.recordId === recordId) : []
  const stepCount = Math.max(steps.length, 1)
  const safeCurrentStep = Math.min(Math.max(currentStep, 0), stepCount - 1)
  const progressPercentage = stepCount === 1 ? 100 : (safeCurrentStep / (stepCount - 1)) * 100

  return <section className="relative overflow-visible rounded-[1.5rem] border border-slate-200/80 bg-white p-5 shadow-[0_16px_46px_-34px_rgba(0,20,76,0.5)] sm:p-6">
    <div className="pointer-events-none absolute inset-y-0 right-0 w-80 overflow-hidden rounded-r-[1.5rem] bg-[radial-gradient(circle_at_100%_0%,rgba(82,56,168,0.1),transparent_62%)]" aria-hidden="true" />
    <div className="relative flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-brand-orange">{eyebrow}</p>
          <span className={`inline-flex rounded-lg border px-2.5 py-1 text-[10px] font-bold ${statusTone(status)}`}>{status}</span>
          {badges.map((badge) => <span className={`inline-flex rounded-lg border px-2.5 py-1 text-[10px] font-bold ${badgeTone(badge.tone)}`} key={`${badge.label}-${badge.tone}`}>{badge.label}</span>)}
        </div>
        <h2 className="mt-3 font-mono text-2xl font-extrabold tracking-[-0.035em] text-brand-blue sm:text-3xl">{recordNumber}</h2>
        <p className="mt-2 truncate text-base font-extrabold text-slate-700">{partyName}</p>
        <p className="mt-1 text-sm font-semibold text-slate-400">{[amount, createdLabel].filter(Boolean).join(' · ')}</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="secondary" leadingIcon={<Icon path="M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5M12 7v5l3 2" />} onClick={() => setIsHistoryOpen(true)}>History</Button>
        {secondaryActions.map((action) => <Button variant={actionVariant(action.tone)} onClick={action.onClick} disabled={action.disabled} key={action.label}>{action.label}</Button>)}
        {primaryAction ? <Button variant={actionVariant(primaryAction.tone ?? 'primary')} onClick={primaryAction.onClick} disabled={primaryAction.disabled}>{primaryAction.label}</Button> : null}
        {menuActions.length ? <div className="relative" ref={menuRef}><Button variant="secondary" trailingIcon={<Icon path="m6 9 6 6 6-6" />} aria-haspopup="menu" aria-expanded={isMenuOpen} onClick={() => setIsMenuOpen((value) => !value)}>More</Button>{isMenuOpen ? <div className="absolute right-0 top-12 z-30 min-w-48 overflow-hidden rounded-xl border border-slate-200 bg-white p-1.5 shadow-[0_18px_45px_-18px_rgba(0,20,76,0.45)]" role="menu">{menuActions.map((action) => <Button className={`justify-start ${action.tone === 'danger' ? 'ui-button--menu-danger' : ''}`} variant="ghost" size="small" fullWidth role="menuitem" disabled={action.disabled} onClick={() => { setIsMenuOpen(false); action.onClick() }} key={action.label}>{action.label}</Button>)}</div> : null}</div> : null}
      </div>
    </div>

    <div className="relative mt-6 rounded-2xl border border-slate-200/80 bg-slate-50/65 px-4 py-3.5" role="group" aria-label={`${eyebrow} workflow progress`}>
      <div className="flex min-w-0 items-center justify-between gap-4">
        <div className="min-w-0"><p className="text-[9px] font-bold uppercase tracking-[0.12em] text-slate-400">Current stage</p><p className="mt-1 truncate text-xs font-extrabold text-brand-blue">{steps[safeCurrentStep] ?? status}</p></div>
        <span className="shrink-0 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[9px] font-bold text-slate-500">Step {safeCurrentStep + 1} of {stepCount}</span>
      </div>
      <div className="relative mt-3 h-4 px-1">
        <div className="absolute inset-x-2 top-1.5 h-1 overflow-hidden rounded-full bg-slate-200" aria-hidden="true"><span className="block h-full rounded-full bg-[linear-gradient(90deg,#10b981,#f48020)] transition-[width] duration-300" style={{ width: `${progressPercentage}%` }} /></div>
        <ol className="absolute inset-x-0 top-0 flex items-center justify-between" aria-label={`${eyebrow} workflow steps`}>
          {steps.map((step, index) => {
            const complete = index < safeCurrentStep
            const current = index === safeCurrentStep
            return <li className="grid size-4 place-items-center" aria-current={current ? 'step' : undefined} title={step} key={step}><span className={`block rounded-full border-2 border-white shadow-sm transition-all ${complete ? 'size-3 bg-emerald-500' : current ? 'size-4 bg-brand-orange ring-4 ring-orange-100' : 'size-3 bg-slate-300'}`}><span className="sr-only">{step}{current ? ', current stage' : complete ? ', completed' : ', upcoming'}</span></span></li>
          })}
        </ol>
      </div>
      {steps.length > 1 ? <div className="mt-1 flex items-center justify-between gap-3 text-[9px] font-semibold text-slate-400"><span className="max-w-[45%] truncate">{steps[0]}</span><span className="max-w-[45%] truncate text-right">{steps.at(-1)}</span></div> : null}
    </div>
    {children ? <div className="relative mt-5 border-t border-slate-100 pt-4">{children}</div> : null}

    {isHistoryOpen ? <div className="fixed inset-0 z-[90] grid place-items-center bg-slate-950/55 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="workflow-history-title"><button className="absolute inset-0" type="button" onClick={() => setIsHistoryOpen(false)} aria-label="Close history" /><section className="relative w-full max-w-xl overflow-hidden rounded-[1.5rem] border border-white/20 bg-white shadow-[0_30px_90px_rgba(0,20,76,0.38)]"><header className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4"><div><p className="text-[10px] font-bold uppercase tracking-[0.15em] text-brand-orange">Record activity</p><h3 className="mt-1 text-lg font-extrabold text-brand-blue" id="workflow-history-title">{recordNumber} history</h3></div><IconButton size="small" variant="ghost" label="Close history" onClick={() => setIsHistoryOpen(false)}><Icon path="M18 6 6 18M6 6l12 12" /></IconButton></header><div className="max-h-[65svh] overflow-y-auto p-5">{history.length ? <ol className="space-y-3">{history.map((entry) => <li className="rounded-xl border border-slate-200 bg-slate-50/55 p-3.5" key={entry.id}><div className="flex items-start justify-between gap-3"><p className="text-xs font-extrabold text-brand-blue">{entry.action}</p><time className="shrink-0 text-[9px] font-semibold text-slate-400">{formatTimestamp(entry.timestamp)}</time></div><p className="mt-1.5 text-[11px] leading-5 text-slate-600">{entry.description}</p><p className="mt-2 text-[9px] font-semibold text-slate-400">By {entry.actor}{entry.status ? ` · ${entry.status}` : ''}</p></li>)}</ol> : <div className="grid min-h-40 place-items-center text-center"><div><p className="text-sm font-extrabold text-brand-blue">No activity yet</p><p className="mt-1 text-xs text-slate-400">Changes to this record will appear here.</p></div></div>}</div></section></div> : null}
  </section>
}
