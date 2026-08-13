import type { KeyboardEvent } from 'react'
import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

type AnimatedDatePickerProps = {
  value: string
  onChange: (value: string) => void
  ariaLabel: string
  id?: string
  mode?: 'date' | 'month'
  min?: string
  max?: string
  required?: boolean
  size?: 'compact' | 'filter' | 'field'
  toneClassName?: string
  triggerLabel?: string
}

const sizeClasses = {
  compact: 'h-9 rounded-lg px-2.5 text-xs font-semibold',
  filter: 'h-10 rounded-xl px-3 text-xs font-semibold',
  field: 'h-11 rounded-xl px-3.5 text-sm font-semibold',
}

const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const weekDays = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']

function dateKey(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function monthKey(date: Date) {
  return dateKey(date).slice(0, 7)
}

function dateFromValue(value: string, mode: 'date' | 'month') {
  const match = (mode === 'month' ? `${value}-01` : value).match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!match) return null
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const date = new Date(year, month - 1, day)
  return Number.isNaN(date.getTime()) ? null : date
}

function displayValue(value: string, mode: 'date' | 'month') {
  const date = dateFromValue(value, mode)
  if (!date) return mode === 'month' ? 'Select month' : 'Select date'
  return new Intl.DateTimeFormat('en', mode === 'month'
    ? { month: 'long', year: 'numeric' }
    : { month: 'short', day: 'numeric', year: 'numeric' }).format(date)
}

export function AnimatedDatePicker({
  value,
  onChange,
  ariaLabel,
  id,
  mode = 'date',
  min,
  max,
  required = false,
  size = 'field',
  toneClassName = 'border-slate-200 bg-white text-slate-600 hover:border-slate-300',
  triggerLabel,
}: AnimatedDatePickerProps) {
  const initialDate = dateFromValue(value, mode) ?? new Date()
  const [isOpen, setIsOpen] = useState(false)
  const [viewDate, setViewDate] = useState(() => new Date(initialDate.getFullYear(), initialDate.getMonth(), 1))
  const [isJumpOpen, setIsJumpOpen] = useState(false)
  const [jumpMonth, setJumpMonth] = useState(initialDate.getMonth())
  const [jumpYear, setJumpYear] = useState(String(initialDate.getFullYear()))
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0, width: 320, opensAbove: false })
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const generatedId = useId().replaceAll(':', '')
  const menuId = `${id ?? `date-picker-${generatedId}`}-menu`
  const today = new Date()
  const todayKey = dateKey(today)

  const calendarDays = useMemo(() => {
    const year = viewDate.getFullYear()
    const month = viewDate.getMonth()
    const firstWeekday = new Date(year, month, 1).getDay()
    return Array.from({ length: 42 }, (_, index) => new Date(year, month, index - firstWeekday + 1))
  }, [viewDate])

  useEffect(() => {
    if (!isOpen) return

    const focusFrame = window.requestAnimationFrame(() => {
      const selected = menuRef.current?.querySelector<HTMLButtonElement>('[data-selected="true"]')
      const current = menuRef.current?.querySelector<HTMLButtonElement>('[data-today="true"]')
      const first = menuRef.current?.querySelector<HTMLButtonElement>('[data-picker-option]:not(:disabled)')
      ;(selected ?? current ?? first)?.focus()
    })
    const closePicker = () => setIsOpen(false)
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node
      if (!triggerRef.current?.contains(target) && !menuRef.current?.contains(target)) closePicker()
    }
    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Tab') closePicker()
      if (event.key !== 'Escape') return
      closePicker()
      triggerRef.current?.focus()
    }

    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    window.addEventListener('resize', closePicker)
    window.addEventListener('scroll', closePicker, true)
    return () => {
      window.cancelAnimationFrame(focusFrame)
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('resize', closePicker)
      window.removeEventListener('scroll', closePicker, true)
    }
  }, [isOpen])

  function isUnavailable(candidate: string) {
    const comparable = mode === 'month' ? candidate.slice(0, 7) : candidate
    return Boolean((min && comparable < min) || (max && comparable > max))
  }

  function togglePicker() {
    if (isOpen) {
      setIsOpen(false)
      setIsJumpOpen(false)
      return
    }

    const rect = triggerRef.current?.getBoundingClientRect()
    if (!rect) return
    const activeDate = dateFromValue(value, mode) ?? new Date()
    setViewDate(new Date(activeDate.getFullYear(), activeDate.getMonth(), 1))
    setJumpMonth(activeDate.getMonth())
    setJumpYear(String(activeDate.getFullYear()))
    setIsJumpOpen(false)
    const width = Math.min(320, window.innerWidth - 16)
    const estimatedHeight = Math.min(mode === 'month' ? 300 : 390, window.innerHeight - 16)
    const opensAbove = window.innerHeight - rect.bottom < estimatedHeight + 12 && rect.top > estimatedHeight + 12
    setMenuPosition({
      top: opensAbove ? rect.top - estimatedHeight - 6 : Math.min(rect.bottom + 6, window.innerHeight - estimatedHeight - 8),
      left: Math.min(Math.max(8, rect.right - width), window.innerWidth - width - 8),
      width,
      opensAbove,
    })
    setIsOpen(true)
  }

  function selectValue(nextValue: string) {
    if (isUnavailable(nextValue)) return
    onChange(mode === 'month' ? nextValue.slice(0, 7) : nextValue)
    setIsOpen(false)
    triggerRef.current?.focus()
  }

  function selectToday() {
    selectValue(mode === 'month' ? monthKey(today) : todayKey)
  }

  function handleGridKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    const optionButtons = Array.from(menuRef.current?.querySelectorAll<HTMLButtonElement>('[data-picker-option]:not(:disabled)') ?? [])
    if (!optionButtons.length) return
    const currentIndex = optionButtons.indexOf(event.currentTarget)
    const columnCount = mode === 'month' ? 3 : 7
    const offsets: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -columnCount, ArrowDown: columnCount }
    const offset = offsets[event.key]
    if (offset === undefined) return
    event.preventDefault()
    optionButtons[Math.min(Math.max(currentIndex + offset, 0), optionButtons.length - 1)]?.focus()
  }

  function changeView(offset: number) {
    setViewDate((current) => {
      const next = new Date(current.getFullYear() + (mode === 'month' ? offset : 0), current.getMonth() + (mode === 'date' ? offset : 0), 1)
      setJumpMonth(next.getMonth())
      setJumpYear(String(next.getFullYear()))
      return next
    })
    setIsJumpOpen(false)
  }

  function toggleJumpPicker() {
    setJumpMonth(viewDate.getMonth())
    setJumpYear(String(viewDate.getFullYear()))
    setIsJumpOpen((current) => !current)
  }

  function applyJump() {
    const year = Number(jumpYear)
    if (!Number.isInteger(year) || year < 1000 || year > 9999) return
    setViewDate(new Date(year, mode === 'date' ? jumpMonth : viewDate.getMonth(), 1))
    setIsJumpOpen(false)
  }

  const headerLabel = mode === 'month'
    ? String(viewDate.getFullYear())
    : new Intl.DateTimeFormat('en', { month: 'long', year: 'numeric' }).format(viewDate)

  return (
    <>
      <button
        className={`app-control inline-flex w-full items-center gap-2.5 border text-left outline-none transition-all duration-200 hover:brightness-[0.98] focus-visible:border-brand-blue/40 focus-visible:ring-4 focus-visible:ring-brand-blue/[0.06] ${sizeClasses[size]} ${toneClassName}`}
        type="button"
        id={id}
        ref={triggerRef}
        onClick={togglePicker}
        aria-label={ariaLabel}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        aria-controls={menuId}
        aria-required={required}
      >
        <svg className="size-4 shrink-0 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M7 3v3M17 3v3M4 9h16M5 5h14a1 1 0 0 1 1 1v14H4V6a1 1 0 0 1 1-1Z" /></svg>
        <span className={`min-w-0 flex-1 truncate ${value ? '' : 'text-slate-400'}`}>{triggerLabel ?? displayValue(value, mode)}</span>
        <svg className={`size-3.5 shrink-0 text-slate-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
      </button>
      {isOpen ? createPortal(
        <div
          className="fixed z-[110] max-h-[calc(100vh-1rem)] overflow-y-auto rounded-2xl border border-slate-200/80 bg-white/95 p-3 shadow-[0_24px_60px_-20px_rgba(0,20,76,0.38)] backdrop-blur-xl animate-[status-menu-enter_170ms_cubic-bezier(0.22,1,0.36,1)]"
          id={menuId}
          ref={menuRef}
          role="dialog"
          aria-modal="false"
          aria-label={ariaLabel}
          style={{ top: menuPosition.top, left: menuPosition.left, width: menuPosition.width, transformOrigin: menuPosition.opensAbove ? 'bottom right' : 'top right' }}
        >
          <div className="relative flex items-center justify-between gap-3 border-b border-slate-100 pb-3">
            <button className="grid size-9 place-items-center rounded-xl text-slate-400 transition hover:bg-slate-100 hover:text-brand-blue" type="button" onClick={() => changeView(-1)} aria-label={mode === 'month' ? 'Previous year' : 'Previous month'}><svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6" /></svg></button>
            <button className="group min-w-0 rounded-lg px-2 py-0.5 text-center outline-none transition hover:bg-slate-50 focus-visible:ring-4 focus-visible:ring-brand-blue/[0.06]" type="button" onClick={toggleJumpPicker} aria-expanded={isJumpOpen} aria-label={`Jump to a different ${mode === 'month' ? 'year' : 'month and year'}`}>
              <span className="block text-[9px] font-bold uppercase tracking-[0.14em] text-brand-orange">{mode === 'month' ? 'Choose month' : 'Choose date'}</span>
              <span className="mt-0.5 flex items-center justify-center gap-1 text-sm font-extrabold text-brand-blue">{headerLabel}<svg className={`size-3 transition-transform ${isJumpOpen ? 'rotate-180' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg></span>
            </button>
            <button className="grid size-9 place-items-center rounded-xl text-slate-400 transition hover:bg-slate-100 hover:text-brand-blue" type="button" onClick={() => changeView(1)} aria-label={mode === 'month' ? 'Next year' : 'Next month'}><svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6" /></svg></button>
            {isJumpOpen ? (
              <div className="absolute left-1/2 top-[calc(100%+0.5rem)] z-10 w-64 -translate-x-1/2 rounded-xl border border-slate-200 bg-white p-3 text-left shadow-[0_18px_40px_-18px_rgba(0,20,76,0.38)]" role="group" aria-label="Jump to date">
                <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-slate-400">Jump to {mode === 'month' ? 'year' : 'month and year'}</p>
                <div className={`mt-2 grid gap-2 ${mode === 'date' ? 'grid-cols-[1fr_5rem_auto]' : 'grid-cols-[1fr_auto]'}`}>
                  {mode === 'date' ? <select className="h-9 min-w-0 rounded-lg border border-slate-200 bg-white px-2 text-xs font-bold text-brand-blue outline-none focus:border-brand-blue/40" value={jumpMonth} onChange={(event) => setJumpMonth(Number(event.target.value))} aria-label="Month">{monthNames.map((month, index) => <option value={index} key={month}>{month.slice(0, 3)}</option>)}</select> : null}
                  <input className="h-9 min-w-0 rounded-lg border border-slate-200 px-2 text-xs font-bold tabular-nums text-brand-blue outline-none focus:border-brand-blue/40" type="number" min="1000" max="9999" value={jumpYear} onChange={(event) => setJumpYear(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); applyJump() } }} aria-label="Year" autoFocus />
                  <button className="h-9 rounded-lg bg-brand-blue px-3 text-[10px] font-bold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-30" type="button" onClick={applyJump} disabled={!/^\d{4}$/.test(jumpYear)}>Go</button>
                </div>
              </div>
            ) : null}
          </div>

          {mode === 'date' ? (
            <>
              <div className="mt-3 grid grid-cols-7">{weekDays.map((day) => <span className="grid h-7 place-items-center text-[9px] font-extrabold uppercase tracking-wide text-slate-400" key={day}>{day}</span>)}</div>
              <div className="grid grid-cols-7 gap-0.5">
                {calendarDays.map((date) => {
                  const candidate = dateKey(date)
                  const isSelected = candidate === value
                  const isToday = candidate === todayKey
                  const isCurrentMonth = date.getMonth() === viewDate.getMonth()
                  return <button className={`relative grid aspect-square place-items-center rounded-lg text-[11px] font-bold outline-none transition-all duration-150 ${isSelected ? 'bg-brand-blue text-white shadow-[0_6px_14px_-7px_rgba(0,20,76,0.85)]' : isToday ? 'bg-orange-50 text-brand-orange ring-1 ring-brand-orange/20' : isCurrentMonth ? 'text-slate-600 hover:bg-slate-100 hover:text-brand-blue' : 'text-slate-300 hover:bg-slate-50'} disabled:cursor-not-allowed disabled:opacity-25`} type="button" key={candidate} data-picker-option data-selected={isSelected} data-today={isToday} disabled={isUnavailable(candidate)} onKeyDown={handleGridKeyDown} onClick={() => selectValue(candidate)} aria-label={new Intl.DateTimeFormat('en', { dateStyle: 'full' }).format(date)} aria-pressed={isSelected}>{date.getDate()}</button>
                })}
              </div>
            </>
          ) : (
            <div className="mt-3 grid grid-cols-3 gap-1.5">
              {monthNames.map((month, index) => {
                const candidateDate = new Date(viewDate.getFullYear(), index, 1)
                const candidate = monthKey(candidateDate)
                const isSelected = candidate === value
                const isCurrent = candidate === monthKey(today)
                return <button className={`h-10 rounded-xl text-[11px] font-bold outline-none transition-all duration-150 ${isSelected ? 'bg-brand-blue text-white shadow-sm' : isCurrent ? 'bg-orange-50 text-brand-orange ring-1 ring-brand-orange/20' : 'text-slate-600 hover:bg-slate-100 hover:text-brand-blue'} disabled:cursor-not-allowed disabled:opacity-25`} type="button" key={month} data-picker-option data-selected={isSelected} data-today={isCurrent} disabled={isUnavailable(candidate)} onKeyDown={handleGridKeyDown} onClick={() => selectValue(candidate)}>{month.slice(0, 3)}</button>
              })}
            </div>
          )}

          <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3">
            {!required && value ? <button className="rounded-lg px-2.5 py-1.5 text-[10px] font-bold text-slate-400 transition hover:bg-slate-100 hover:text-slate-600" type="button" onClick={() => { onChange(''); setIsOpen(false) }}>Clear</button> : <span />}
            <button className="rounded-lg bg-brand-blue/[0.06] px-3 py-1.5 text-[10px] font-bold text-brand-blue transition hover:bg-brand-blue hover:text-white disabled:cursor-not-allowed disabled:opacity-30" type="button" onClick={selectToday} disabled={isUnavailable(mode === 'month' ? monthKey(today) : todayKey)}>Today</button>
          </div>
        </div>,
        document.body,
      ) : null}
    </>
  )
}
