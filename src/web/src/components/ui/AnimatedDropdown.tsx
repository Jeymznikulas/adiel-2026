import type { KeyboardEvent } from 'react'
import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

export type DropdownOption<T extends string = string> = {
  value: T
  label?: string
  dotClassName?: string
  toneClassName?: string
}

type AnimatedDropdownProps<T extends string> = {
  value: T
  options: readonly DropdownOption<T>[]
  onChange: (value: T) => void
  ariaLabel: string
  id?: string
  size?: 'compact' | 'filter' | 'field'
  fullWidth?: boolean
  className?: string
}

const sizeClasses = {
  compact: 'h-9 rounded-lg px-2.5 text-[11px] font-bold uppercase tracking-wide',
  filter: 'h-10 rounded-xl px-3 text-xs font-semibold',
  field: 'h-11 rounded-xl px-3.5 text-sm font-semibold',
}

export function AnimatedDropdown<T extends string>({
  value,
  options,
  onChange,
  ariaLabel,
  id,
  size = 'field',
  fullWidth = true,
  className = '',
}: AnimatedDropdownProps<T>) {
  const [isOpen, setIsOpen] = useState(false)
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0, width: 0, opensAbove: false })
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const generatedId = useId().replaceAll(':', '')
  const menuId = `${id ?? `dropdown-${generatedId}`}-menu`
  const selectedOption = options.find((option) => option.value === value) ?? { value, label: value }

  useEffect(() => {
    if (!isOpen) return

    const focusFrame = window.requestAnimationFrame(() => {
      menuRef.current?.querySelector<HTMLButtonElement>('[aria-selected="true"]')?.focus()
    })
    const closeMenu = () => setIsOpen(false)
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node
      if (!triggerRef.current?.contains(target) && !menuRef.current?.contains(target)) closeMenu()
    }
    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Tab') closeMenu()
      if (event.key !== 'Escape') return
      closeMenu()
      triggerRef.current?.focus()
    }

    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    window.addEventListener('resize', closeMenu)
    window.addEventListener('scroll', closeMenu, true)
    return () => {
      window.cancelAnimationFrame(focusFrame)
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('resize', closeMenu)
      window.removeEventListener('scroll', closeMenu, true)
    }
  }, [isOpen])

  function toggleMenu() {
    if (isOpen) {
      setIsOpen(false)
      return
    }

    const rect = triggerRef.current?.getBoundingClientRect()
    if (!rect) return
    const width = Math.max(rect.width, 156)
    const menuHeight = Math.min(options.length, 6) * 36 + 12
    const opensAbove = window.innerHeight - rect.bottom < menuHeight + 12 && rect.top > menuHeight + 12
    setMenuPosition({
      top: opensAbove ? rect.top - menuHeight - 6 : rect.bottom + 6,
      left: Math.min(Math.max(8, rect.right - width), window.innerWidth - width - 8),
      width,
      opensAbove,
    })
    setIsOpen(true)
  }

  function handleOptionKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    const optionButtons = Array.from(menuRef.current?.querySelectorAll<HTMLButtonElement>('[role="option"]') ?? [])
    if (!optionButtons.length) return

    if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault()
      optionButtons[event.key === 'Home' ? 0 : optionButtons.length - 1]?.focus()
      return
    }
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return
    event.preventDefault()
    const currentIndex = optionButtons.indexOf(event.currentTarget)
    const offset = event.key === 'ArrowDown' ? 1 : -1
    optionButtons[(currentIndex + offset + optionButtons.length) % optionButtons.length]?.focus()
  }

  const neutralTone = 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'

  return (
    <>
      <button
        className={`inline-flex items-center gap-2 border text-left outline-none transition-all duration-200 hover:brightness-[0.98] focus-visible:border-brand-blue/40 focus-visible:ring-4 focus-visible:ring-brand-blue/[0.06] ${fullWidth ? 'w-full' : ''} ${sizeClasses[size]} ${selectedOption.toneClassName ?? neutralTone} ${className}`}
        type="button"
        id={id}
        ref={triggerRef}
        onClick={toggleMenu}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={menuId}
      >
        {selectedOption.dotClassName ? <span className={`size-2 shrink-0 rounded-full ${selectedOption.dotClassName}`} aria-hidden="true" /> : null}
        <span className="min-w-0 flex-1 truncate">{selectedOption.label ?? selectedOption.value}</span>
        <svg className={`size-3.5 shrink-0 transition-transform duration-200 ease-out ${isOpen ? 'rotate-180' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
      </button>
      {isOpen ? createPortal(
        <div
          className="fixed z-[70] max-h-60 overflow-y-auto rounded-xl border border-slate-200/80 bg-white/95 p-1.5 shadow-[0_18px_45px_-16px_rgba(0,20,76,0.32)] backdrop-blur-xl animate-[status-menu-enter_160ms_cubic-bezier(0.22,1,0.36,1)]"
          id={menuId}
          ref={menuRef}
          role="listbox"
          aria-label={ariaLabel}
          style={{ top: menuPosition.top, left: menuPosition.left, width: menuPosition.width, transformOrigin: menuPosition.opensAbove ? 'bottom right' : 'top right' }}
        >
          {options.map((option) => {
            const isSelected = option.value === value
            return (
              <button
                className={`flex h-9 w-full items-center gap-2.5 rounded-lg px-2.5 text-left text-xs font-semibold outline-none transition-colors duration-150 focus-visible:bg-slate-100 ${isSelected ? option.toneClassName ?? 'bg-slate-100 text-brand-blue' : 'text-slate-600 hover:bg-slate-50 hover:text-brand-blue'}`}
                type="button"
                key={option.value}
                role="option"
                aria-selected={isSelected}
                onKeyDown={handleOptionKeyDown}
                onClick={() => {
                  onChange(option.value)
                  setIsOpen(false)
                }}
              >
                {option.dotClassName ? <span className={`size-2 shrink-0 rounded-full ${option.dotClassName}`} aria-hidden="true" /> : null}
                <span className="min-w-0 flex-1 truncate">{option.label ?? option.value}</span>
                <svg className={`size-3.5 shrink-0 text-emerald-600 transition-all duration-150 ${isSelected ? 'scale-100 opacity-100' : 'scale-75 opacity-0'}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m5 12 4 4L19 6" /></svg>
              </button>
            )
          })}
        </div>,
        document.body,
      ) : null}
    </>
  )
}
