import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

type AnimatedTimePickerProps = {
  value: string
  onChange: (value: string) => void
  ariaLabel: string
  id?: string
  size?: 'field'
  toneClassName?: string
}

type TimeParts = { hour: number; minute: number; meridiem: 'AM' | 'PM' }

const hours = Array.from({ length: 12 }, (_, index) => index + 1)
const minutes = Array.from({ length: 60 }, (_, index) => index)
const meridiems: TimeParts['meridiem'][] = ['AM', 'PM']

function parseTime(value: string): TimeParts {
  const match = value.match(/^(\d{1,2}):(\d{2})/)
  if (!match) return { hour: 9, minute: 0, meridiem: 'AM' }
  const hour24 = Number(match[1])
  const minute = Number(match[2])
  if (hour24 > 23 || minute > 59) return { hour: 9, minute: 0, meridiem: 'AM' }
  return { hour: hour24 % 12 || 12, minute, meridiem: hour24 >= 12 ? 'PM' : 'AM' }
}

function toValue({ hour, minute, meridiem }: TimeParts) {
  const hour24 = (hour % 12) + (meridiem === 'PM' ? 12 : 0)
  return `${String(hour24).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
}

function displayTime(value: string) {
  if (!value) return 'Select time'
  const { hour, minute, meridiem } = parseTime(value)
  return `${hour}:${String(minute).padStart(2, '0')} ${meridiem}`
}

export function AnimatedTimePicker({
  value,
  onChange,
  ariaLabel,
  id,
  size = 'field',
  toneClassName = 'border-slate-200 bg-white text-slate-600 hover:border-slate-300',
}: AnimatedTimePickerProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [draft, setDraft] = useState(() => parseTime(value))
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0, width: 316, opensAbove: false })
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const generatedId = useId().replaceAll(':', '')
  const menuId = `${id ?? `time-picker-${generatedId}`}-menu`

  const activeValue = useMemo(() => toValue(draft), [draft])

  useEffect(() => {
    if (!isOpen) return
    const closePicker = () => setIsOpen(false)
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node
      if (!triggerRef.current?.contains(target) && !menuRef.current?.contains(target)) closePicker()
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      closePicker()
      triggerRef.current?.focus()
    }

    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    window.addEventListener('resize', closePicker)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('resize', closePicker)
    }
  }, [isOpen])

  function openPicker() {
    const rect = triggerRef.current?.getBoundingClientRect()
    if (!rect) return
    const width = Math.min(316, window.innerWidth - 16)
    const estimatedHeight = 330
    const opensAbove = window.innerHeight - rect.bottom < estimatedHeight + 12 && rect.top > estimatedHeight + 12
    setDraft(parseTime(value))
    setMenuPosition({
      top: opensAbove ? rect.top - estimatedHeight - 6 : Math.min(rect.bottom + 6, window.innerHeight - estimatedHeight - 8),
      left: Math.min(Math.max(8, rect.right - width), window.innerWidth - width - 8),
      width,
      opensAbove,
    })
    setIsOpen(true)
  }

  function updateDraft(change: Partial<TimeParts>) {
    setDraft((current) => ({ ...current, ...change }))
  }

  function applySelection() {
    onChange(activeValue)
    setIsOpen(false)
    triggerRef.current?.focus()
  }

  const sizeClass = size === 'field' ? 'h-11 rounded-xl px-3.5 text-sm font-semibold' : ''

  return (
    <>
      <button
        className={`app-control inline-flex w-full items-center gap-2.5 border text-left outline-none transition-all duration-200 hover:brightness-[0.98] focus-visible:border-brand-blue/40 focus-visible:ring-4 focus-visible:ring-brand-blue/[0.06] ${sizeClass} ${toneClassName}`}
        type="button"
        id={id}
        ref={triggerRef}
        onClick={() => (isOpen ? setIsOpen(false) : openPicker())}
        aria-label={ariaLabel}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        aria-controls={menuId}
      >
        <svg className="size-4 shrink-0 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="8.5" /><path d="M12 7v5l3 2" /></svg>
        <span className={`min-w-0 flex-1 truncate ${value ? '' : 'text-slate-400'}`}>{displayTime(value)}</span>
        <svg className={`size-3.5 shrink-0 text-slate-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
      </button>
      {isOpen ? createPortal(
        <div className="fixed z-[110] overflow-hidden rounded-2xl border border-slate-200/80 bg-white/95 p-3 shadow-[0_24px_60px_-20px_rgba(0,20,76,0.38)] backdrop-blur-xl animate-[status-menu-enter_170ms_cubic-bezier(0.22,1,0.36,1)]" id={menuId} ref={menuRef} role="dialog" aria-modal="false" aria-label={ariaLabel} style={{ top: menuPosition.top, left: menuPosition.left, width: menuPosition.width, transformOrigin: menuPosition.opensAbove ? 'bottom right' : 'top right' }}>
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div><p className="text-[9px] font-bold uppercase tracking-[0.14em] text-brand-orange">Choose time</p><p className="mt-0.5 text-sm font-extrabold text-brand-blue">{displayTime(activeValue)}</p></div>
            <button className="grid size-8 place-items-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-brand-blue" type="button" onClick={() => setIsOpen(false)} aria-label="Close time picker"><svg className="size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12" /></svg></button>
          </div>
          <div className="mt-3 grid grid-cols-[1fr_1fr_0.9fr] gap-2">
            <TimeWheel label="Hour" values={hours} active={draft.hour} renderValue={(hour) => String(hour)} onSelect={(hour) => updateDraft({ hour })} />
            <TimeWheel label="Minute" values={minutes} active={draft.minute} renderValue={(minute) => String(minute).padStart(2, '0')} onSelect={(minute) => updateDraft({ minute })} />
            <TimeWheel label="Period" values={meridiems} active={draft.meridiem} renderValue={(period) => period} onSelect={(meridiem) => updateDraft({ meridiem })} />
          </div>
          <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3">
            <button className="rounded-lg px-2.5 py-1.5 text-[10px] font-bold text-slate-400 transition hover:bg-slate-100 hover:text-slate-600" type="button" onClick={() => { onChange(''); setIsOpen(false) }}>Clear</button>
            <button className="rounded-lg bg-brand-blue px-4 py-1.5 text-[10px] font-bold text-white transition hover:brightness-110" type="button" onClick={applySelection}>Done</button>
          </div>
        </div>,
        document.body,
      ) : null}
    </>
  )
}

type TimeWheelProps<T extends string | number> = {
  label: string
  values: T[]
  active: T
  renderValue: (value: T) => string
  onSelect: (value: T) => void
}

function TimeWheel<T extends string | number>({ label, values, active, renderValue, onSelect }: TimeWheelProps<T>) {
  return <div className="min-w-0"><p className="mb-1.5 px-1 text-center text-[9px] font-bold uppercase tracking-[0.11em] text-slate-400">{label}</p><div className="h-44 snap-y snap-mandatory overflow-y-auto overscroll-contain rounded-xl border border-slate-100 bg-slate-50/70 p-1 [scrollbar-width:thin]" aria-label={`${label} options`}>
    {values.map((item) => <button className={`block h-9 w-full snap-center rounded-lg text-xs font-bold tabular-nums outline-none transition focus-visible:ring-2 focus-visible:ring-brand-blue/25 ${item === active ? 'bg-brand-blue text-white shadow-[0_6px_14px_-8px_rgba(0,20,76,0.9)]' : 'text-slate-500 hover:bg-white hover:text-brand-blue'}`} type="button" key={String(item)} onClick={() => onSelect(item)} aria-pressed={item === active}>{renderValue(item)}</button>)}
  </div></div>
}
