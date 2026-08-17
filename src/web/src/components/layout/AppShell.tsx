import type { MouseEvent, PropsWithChildren, ReactNode } from 'react'
import { useEffect, useState } from 'react'
import { GlobalSearch } from '../ui/GlobalSearch'

type NavigationItem = {
  label: string
  path: string
  icon: string
}

type NavigationGroup = {
  label: string
  items: readonly NavigationItem[]
}

const navigationGroups: readonly NavigationGroup[] = [
  {
    label: 'Main',
    items: [
      { label: 'Dashboard', path: '/dashboard', icon: 'M3 13h8V3H3v10Zm0 8h8v-6H3v6Zm10 0h8V11h-8v10Zm0-18v6h8V3h-8Z' },
      { label: 'Tasks', path: '/tasks', icon: 'M9 11 12 14 22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11' },
    ],
  },
  {
    label: 'Sales',
    items: [
      { label: 'Clients', path: '/clients', icon: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8' },
      { label: 'Quotations', path: '/quotations', icon: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6Zm0 0v6h6M8 13h8M8 17h5' },
      { label: 'Sales', path: '/sales-tracker', icon: 'M3 3v18h18M7 16l4-5 3 3 6-8' },
      { label: 'Statements of Account', path: '/statement-of-account', icon: 'M4 2h16v20l-3-2-3 2-2-2-3 2-2-2-3 2V2Zm4 6h8M8 12h8M8 16h5' },
    ],
  },
  {
    label: 'Purchasing',
    items: [
      { label: 'Suppliers', path: '/suppliers', icon: 'M3 21h18M5 21V7l7-4 7 4v14M9 9h.01M15 9h.01M9 13h.01M15 13h.01M9 17h6' },
      { label: 'Items', path: '/items', icon: 'm21 8-9-5-9 5 9 5 9-5ZM3 12l9 5 9-5M3 16l9 5 9-5' },
      { label: 'Purchase Orders', path: '/purchase-orders', icon: 'M3 3h2l2.4 12.3a2 2 0 0 0 2 1.7h7.7a2 2 0 0 0 2-1.6L21 7H6M10 21h.01M18 21h.01' },
    ],
  },
  {
    label: 'Finance',
    items: [
      { label: 'Collections', path: '/collections', icon: 'M3 6h18M6 12h12M9 18h6M18 3l3 3-3 3M6 15l-3 3 3 3' },
      { label: 'Expenses', path: '/expenses', icon: 'M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6' },
    ],
  },
  {
    label: 'System',
    items: [
      { label: 'Settings', path: '/settings', icon: 'M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.88-.34 1.7 1.7 0 0 0-1.03 1.56V21a2 2 0 1 1-4 0v-.09A1.7 1.7 0 0 0 9 19.36a1.7 1.7 0 0 0-1.88.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 4.63 15a1.7 1.7 0 0 0-1.56-1.03H3a2 2 0 1 1 0-4h.09A1.7 1.7 0 0 0 4.64 9a1.7 1.7 0 0 0-.34-1.88l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.7 1.7 0 0 0 9 4.63h.01A1.7 1.7 0 0 0 10.03 3.1V3a2 2 0 1 1 4 0v.09A1.7 1.7 0 0 0 15 4.64a1.7 1.7 0 0 0 1.88-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.7 1.7 0 0 0 19.37 9v.01A1.7 1.7 0 0 0 20.9 10.03H21a2 2 0 1 1 0 4h-.09A1.7 1.7 0 0 0 19.4 15Z' },
      { label: 'Archive', path: '/archive', icon: 'M3 6h18M5 6l1 15h12l1-15M9 10v7M15 10v7M8 6l1-3h6l1 3' },
      { label: 'Activity Log', path: '/logs', icon: 'M4 4h16v16H4V4Zm4 5h8M8 13h8M8 17h5' },
    ],
  },
]

const navigationItems = navigationGroups.flatMap((group) => group.items)
const defaultNavigationItem = navigationItems[0]!
const sidebarStorageKey = 'adiel.sidebar-collapsed'

function getInitialSidebarState() {
  try {
    return window.localStorage.getItem(sidebarStorageKey) === 'true'
  } catch {
    return false
  }
}

function normalizePath(pathname: string) {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname
  if (path === '/finance') return '/collections'
  if (/^\/items\/[^/]+$/.test(path)) return path
  if (/^\/clients\/[^/]+$/.test(path)) return path
  if (/^\/suppliers\/[^/]+$/.test(path)) return path
  if (path.startsWith('/quotations/')) return path
  if (path.startsWith('/statement-of-account/')) return path
  return navigationItems.some((item) => item.path === path) ? path : '/dashboard'
}

type AppShellProps = PropsWithChildren<{
  username: string
  isSigningOut: boolean
  onSignOut: () => void
  sectionContent?: Partial<Record<string, ReactNode>>
}>

function NavigationIcon({ path }: { path: string }) {
  return (
    <svg className="size-[1.15rem] shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={path} />
    </svg>
  )
}

export function AppShell({ children, username, isSigningOut, onSignOut, sectionContent }: AppShellProps) {
  const [activePath, setActivePath] = useState(() => normalizePath(window.location.pathname))
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(getInitialSidebarState)
  const activeItem = navigationItems.find((item) => item.path === activePath)
    ?? (activePath.startsWith('/items/') ? navigationItems.find((item) => item.path === '/items') : undefined)
    ?? (activePath.startsWith('/clients/') ? navigationItems.find((item) => item.path === '/clients') : undefined)
    ?? (activePath.startsWith('/suppliers/') ? navigationItems.find((item) => item.path === '/suppliers') : undefined)
    ?? (activePath.startsWith('/quotations/') ? navigationItems.find((item) => item.path === '/quotations') : undefined)
    ?? (activePath.startsWith('/statement-of-account/') ? navigationItems.find((item) => item.path === '/statement-of-account') : undefined)
    ?? defaultNavigationItem
  const activeSection = activeItem.label
  const initial = username.charAt(0).toUpperCase() || 'U'
  const currentDate = new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date())

  useEffect(() => {
    const canonicalPath = normalizePath(window.location.pathname)
    if (canonicalPath !== window.location.pathname) window.history.replaceState(null, '', canonicalPath)

    function handleHistoryChange() {
      const nextPath = normalizePath(window.location.pathname)
      if (nextPath !== window.location.pathname) window.history.replaceState(null, '', nextPath)
      setActivePath(nextPath)
    }

    window.addEventListener('popstate', handleHistoryChange)
    window.addEventListener('adiel:navigate', handleHistoryChange)
    return () => {
      window.removeEventListener('popstate', handleHistoryChange)
      window.removeEventListener('adiel:navigate', handleHistoryChange)
    }
  }, [])

  useEffect(() => {
    try {
      window.localStorage.setItem(sidebarStorageKey, String(isSidebarCollapsed))
    } catch {
      // The sidebar still works when browser storage is unavailable.
    }
  }, [isSidebarCollapsed])

  useEffect(() => {
    const markDirty = (event: Event) => {
      const target = event.target
      if (!(target instanceof HTMLElement)) return
      const form = target.closest('form')
      if (form?.closest('[role="dialog"]')) form.dataset.dirty = 'true'
    }
    const clearSaving = (form: HTMLFormElement) => {
      window.setTimeout(() => {
        delete form.dataset.saving
        const button = form.querySelector<HTMLButtonElement>('button[type="submit"]')
        button?.removeAttribute('aria-busy')
      }, 650)
    }
    const handleSubmit = (event: Event) => {
      const form = event.target
      if (!(form instanceof HTMLFormElement)) return
      delete form.dataset.dirty
      form.dataset.saving = 'true'
      form.querySelector<HTMLButtonElement>('button[type="submit"]')?.setAttribute('aria-busy', 'true')
      clearSaving(form)
    }
    const handleClosingClick = (event: globalThis.MouseEvent) => {
      const target = event.target
      if (!(target instanceof HTMLElement)) return
      const dialog = target.closest<HTMLElement>('[role="dialog"], [role="alertdialog"]')
      const form = dialog?.querySelector<HTMLFormElement>('form[data-dirty="true"]')
      if (!form) return
      const button = target.closest<HTMLButtonElement>('button')
      if (!button) return
      const label = `${button.getAttribute('aria-label') ?? ''} ${button.textContent ?? ''}`.trim().toLowerCase()
      const isCloseAction = button === dialog?.firstElementChild || /close|cancel|back|keep editing/.test(label)
      if (!isCloseAction || window.confirm('Discard your unsaved changes?')) return
      event.preventDefault()
      event.stopPropagation()
    }
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!document.querySelector('form[data-dirty="true"]')) return
      event.preventDefault()
      event.returnValue = ''
    }
    const addIconTitles = () => {
      document.querySelectorAll<HTMLButtonElement>('button[aria-label]:not([title])').forEach((button) => {
        if (!button.textContent?.trim()) button.title = button.getAttribute('aria-label') ?? ''
      })
    }
    addIconTitles()
    const observer = new MutationObserver(addIconTitles)
    observer.observe(document.body, { childList: true, subtree: true })
    document.addEventListener('input', markDirty, true)
    document.addEventListener('change', markDirty, true)
    document.addEventListener('submit', handleSubmit, true)
    document.addEventListener('click', handleClosingClick, true)
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => {
      observer.disconnect()
      document.removeEventListener('input', markDirty, true)
      document.removeEventListener('change', markDirty, true)
      document.removeEventListener('submit', handleSubmit, true)
      document.removeEventListener('click', handleClosingClick, true)
      window.removeEventListener('beforeunload', handleBeforeUnload)
    }
  }, [])

  function navigate(event: MouseEvent<HTMLAnchorElement>, path: string) {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
    event.preventDefault()
    if (path !== activePath) {
      window.history.pushState(null, '', path)
      setActivePath(path)
      window.dispatchEvent(new Event('adiel:navigate'))
    }
    setIsMenuOpen(false)
  }

  function navigateTo(path: string) {
    if (path !== activePath) {
      window.history.pushState(null, '', path)
      setActivePath(normalizePath(path))
      window.dispatchEvent(new Event('adiel:navigate'))
    }
    setIsMenuOpen(false)
  }

  function renderSidebar(isCollapsed = false) {
    return (
      <div className="relative flex h-full flex-col overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_0%_0%,rgba(0,20,76,0.04),transparent_28%),radial-gradient(circle_at_100%_100%,rgba(253,77,0,0.035),transparent_24%)]" aria-hidden="true" />
        <div className={`relative flex h-[5.5rem] shrink-0 items-center border-b border-slate-200/80 transition-[padding] duration-300 ${isCollapsed ? 'justify-center px-3' : 'px-5'}`}>
          <a className={`flex min-w-0 items-center rounded-xl transition-all duration-300 hover:opacity-80 ${isCollapsed ? 'size-12 shrink-0 justify-center p-1.5' : 'h-14 flex-1 px-1 py-2'}`} href="/dashboard" onClick={(event) => navigate(event, '/dashboard')} aria-label="Adiel Business Management System dashboard">
            <img className={`shrink-0 object-contain transition-all duration-300 ${isCollapsed ? 'max-h-9 max-w-full' : 'max-h-10 max-w-10'}`} src="/images/adiel-logo-flat.png" alt="Adiel" decoding="async" />
            <span className={`min-w-0 overflow-hidden transition-all duration-300 ${isCollapsed ? 'ml-0 max-w-0 border-l-0 pl-0 opacity-0' : 'ml-2 max-w-[8.75rem] border-l border-slate-200 pl-2 opacity-100'}`}>
              <span className="block text-[13px] font-extrabold tracking-[-0.02em] text-brand-blue">ADIEL</span>
              <span className="mt-0.5 block text-[8px] font-bold uppercase leading-[0.7rem] tracking-[0.06em] text-slate-400">Business Management<br />System</span>
            </span>
          </a>
          <button className="ml-auto grid size-9 shrink-0 place-items-center rounded-xl text-slate-400 transition-all hover:rotate-90 hover:bg-slate-100 hover:text-brand-blue lg:hidden" type="button" onClick={() => setIsMenuOpen(false)} aria-label="Close navigation">
            <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12" /></svg>
          </button>
        </div>

        <nav className={`relative flex-1 overflow-x-hidden overflow-y-auto py-6 transition-[padding] duration-300 ${isCollapsed ? 'px-2.5' : 'px-3.5'}`} aria-label="Primary navigation">
          <ul className={isCollapsed ? 'space-y-2.5' : 'space-y-4'}>
            {navigationGroups.map((group, groupIndex) => (
              <li key={group.label}>
                {isCollapsed ? (
                  groupIndex > 0 ? <div className="mx-auto mb-2.5 h-px w-7 bg-slate-200/90" aria-hidden="true" /> : null
                ) : group.label === 'Finance' ? (
                  <a className="mb-1.5 block rounded-lg px-3 py-1 text-[9px] font-bold uppercase tracking-[0.18em] text-slate-400 transition hover:bg-slate-100 hover:text-brand-blue" href="/collections" onClick={(event) => navigate(event, '/collections')}>{group.label}</a>
                ) : (
                  <p className="mb-1.5 px-3 text-[9px] font-bold uppercase tracking-[0.18em] text-slate-400">{group.label}</p>
                )}
                <ul className="space-y-1">
                  {group.items.map((item) => {
                    const isActive = activeSection === item.label
                    return (
                      <li key={item.path}>
                        <a
                          className={`group relative flex w-full items-center rounded-xl py-[0.68rem] text-left text-[12.5px] font-medium transition-all duration-200 ${isCollapsed ? 'justify-center px-2' : 'gap-3 px-3'} ${isActive ? 'bg-brand-blue/[0.07] text-brand-blue ring-1 ring-inset ring-brand-blue/[0.08]' : 'text-slate-500 hover:bg-slate-100/80 hover:text-brand-blue'}`}
                          href={item.path}
                          onClick={(event) => navigate(event, item.path)}
                          aria-current={isActive ? 'page' : undefined}
                        >
                          {isActive ? <span className="absolute -left-0.5 h-5 w-0.5 rounded-full bg-brand-orange shadow-[0_0_10px_rgba(253,77,0,0.65)]" aria-hidden="true" /> : null}
                          <span className={`transition-all duration-200 ${isActive ? 'text-brand-orange' : 'text-slate-400 group-hover:text-brand-blue/70'}`}><NavigationIcon path={item.icon} /></span>
                          <span className={`overflow-hidden whitespace-nowrap transition-all duration-300 ${isCollapsed ? 'max-w-0 opacity-0' : 'max-w-44 opacity-100'}`}>{item.label}</span>
                          {isActive && !isCollapsed ? <span className="ml-auto size-1 rounded-full bg-brand-orange" aria-hidden="true" /> : null}
                          {isCollapsed ? <span className="pointer-events-none absolute left-[calc(100%+0.85rem)] z-50 -translate-x-1 whitespace-nowrap rounded-lg border border-white/10 bg-slate-950 px-2.5 py-1.5 text-[11px] font-semibold text-white opacity-0 shadow-xl transition-all group-hover:translate-x-0 group-hover:opacity-100" role="tooltip">{item.label}</span> : null}
                        </a>
                      </li>
                    )
                  })}
                </ul>
              </li>
            ))}
          </ul>
        </nav>

        <div className={`relative border-t border-slate-200/80 transition-[padding] duration-300 ${isCollapsed ? 'p-2.5' : 'p-4'}`}>
          <div className={`mb-2.5 flex items-center rounded-xl border border-slate-200 bg-slate-50/80 transition-all duration-300 hover:border-slate-300 hover:bg-slate-100 ${isCollapsed ? 'justify-center p-2' : 'gap-3 p-2.5'}`}>
            <span className="grid size-9 shrink-0 place-items-center rounded-[0.7rem] bg-[linear-gradient(145deg,#ff6b2c,#e43c00)] text-xs font-bold text-white shadow-[0_7px_18px_rgba(253,77,0,0.2)]">{initial}</span>
            <div className={`min-w-0 overflow-hidden whitespace-nowrap transition-all duration-300 ${isCollapsed ? 'max-w-0 opacity-0' : 'max-w-40 opacity-100'}`}>
              <p className="truncate text-xs font-semibold text-brand-blue">{username}</p>
              <p className="mt-0.5 text-[9px] font-medium uppercase tracking-wider text-slate-400">Account</p>
            </div>
          </div>
          <button className={`group relative flex w-full items-center rounded-xl py-2.5 text-[11px] font-semibold text-slate-400 transition-all hover:bg-red-50 hover:text-red-600 disabled:opacity-40 ${isCollapsed ? 'justify-center px-2' : 'gap-2.5 px-3'}`} type="button" disabled={isSigningOut} onClick={onSignOut} aria-label={isSigningOut ? 'Signing out' : 'Sign out'}>
            <svg className="size-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M10 17l5-5-5-5M15 12H3M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" /></svg>
            <span className={`overflow-hidden whitespace-nowrap transition-all duration-300 ${isCollapsed ? 'max-w-0 opacity-0' : 'max-w-24 opacity-100'}`}>{isSigningOut ? 'Signing out...' : 'Sign out'}</span>
            {isCollapsed ? <span className="pointer-events-none absolute left-[calc(100%+0.85rem)] z-50 whitespace-nowrap rounded-lg bg-slate-950 px-2.5 py-1.5 text-[11px] text-white opacity-0 shadow-xl transition-opacity group-hover:opacity-100" role="tooltip">Sign out</span> : null}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="app-shell min-h-svh bg-[#f5f7fb] text-slate-900">
      <aside className={`fixed inset-y-0 left-0 z-30 hidden border-r border-slate-200/80 bg-white shadow-[10px_0_40px_rgba(0,20,76,0.05)] transition-[width] duration-300 ease-in-out lg:block ${isSidebarCollapsed ? 'w-[5.25rem]' : 'w-[17.5rem]'}`}>
        {renderSidebar(isSidebarCollapsed)}
        <button className="group absolute -right-3 top-[6.35rem] grid size-7 place-items-center rounded-full border border-slate-200/80 bg-white text-slate-400 shadow-[0_5px_18px_rgba(0,20,76,0.15)] transition-all hover:scale-110 hover:text-brand-blue" type="button" onClick={() => setIsSidebarCollapsed((current) => !current)} aria-label={isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'} title={isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
          <svg className={`size-3 transition-transform duration-300 ${isSidebarCollapsed ? 'rotate-180' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6" /></svg>
        </button>
      </aside>

      <div className={`fixed inset-0 z-40 transition-[visibility] duration-300 lg:hidden ${isMenuOpen ? 'visible' : 'invisible pointer-events-none'}`} aria-hidden={!isMenuOpen}>
        <button className={`absolute inset-0 bg-slate-950/55 backdrop-blur-sm transition-opacity duration-300 ${isMenuOpen ? 'opacity-100' : 'opacity-0'}`} type="button" onClick={() => setIsMenuOpen(false)} aria-label="Close navigation" tabIndex={isMenuOpen ? 0 : -1} />
        <aside className={`relative h-full w-[min(17.5rem,86vw)] border-r border-slate-200 bg-white shadow-2xl transition-transform duration-300 ease-out ${isMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}>{renderSidebar()}</aside>
      </div>

      <div className={`transition-[padding] duration-300 ease-in-out ${isSidebarCollapsed ? 'lg:pl-[5.25rem]' : 'lg:pl-[17.5rem]'}`}>
        <header className="sticky top-0 z-20 flex h-16 items-center border-b border-slate-200/70 bg-white/80 px-4 shadow-[0_1px_0_rgba(15,23,42,0.02)] backdrop-blur-xl sm:px-6 lg:h-[4.75rem] lg:px-8">
          <button className="mr-3 grid size-10 place-items-center rounded-xl border border-slate-200 bg-white text-brand-blue shadow-sm transition hover:border-slate-300 lg:hidden" type="button" onClick={() => setIsMenuOpen(true)} aria-label="Open navigation" aria-expanded={isMenuOpen}>
            <svg className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16" /></svg>
          </button>
          <div>
            <div className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-[0.16em] text-slate-400"><span>Adiel</span><span className="text-slate-300">/</span><span>{activeSection}</span></div>
            <h1 className="mt-1 text-base font-bold tracking-[-0.025em] text-brand-blue sm:text-lg">{activeSection}</h1>
          </div>
          <div className="ml-auto flex items-center gap-3 sm:gap-4">
            <GlobalSearch onNavigate={navigateTo} />
            <span className="hidden rounded-lg border border-slate-200/80 bg-white/70 px-3 py-1.5 text-[10px] font-semibold text-slate-400 md:block">{currentDate}</span>
            <span className="hidden h-7 w-px bg-slate-200 sm:block" aria-hidden="true" />
            <span className="hidden text-right sm:block"><span className="block text-[11px] font-semibold text-slate-700">{username}</span><span className="mt-0.5 flex items-center justify-end gap-1 text-[9px] font-medium text-emerald-600"><span className="size-1 rounded-full bg-emerald-500" /> Online</span></span>
            <span className="grid size-9 place-items-center rounded-xl bg-[linear-gradient(145deg,#092968,#00113f)] text-[11px] font-bold text-white shadow-[0_6px_16px_rgba(0,20,76,0.18)] ring-1 ring-brand-blue/10">{initial}</span>
          </div>
        </header>

        <main className="mx-auto max-w-[100rem] p-4 sm:p-6 lg:p-8">
          {activeSection === 'Dashboard' ? children : sectionContent?.[activeSection] ?? (
            <section className="grid min-h-[calc(100svh-9rem)] place-items-center animate-[content-enter_320ms_ease-out]">
              <div className="max-w-md text-center">
                <span className="mx-auto grid size-16 place-items-center rounded-2xl border border-slate-200 bg-white text-brand-blue shadow-[0_16px_40px_-22px_rgba(0,20,76,0.4)]"><NavigationIcon path={navigationItems.find((item) => item.label === activeSection)?.icon ?? defaultNavigationItem.icon} /></span>
                <p className="mt-6 text-[9px] font-bold uppercase tracking-[0.18em] text-brand-orange">Module</p>
                <h2 className="mt-2 text-2xl font-bold tracking-[-0.035em] text-brand-blue">{activeSection}</h2>
                <p className="mt-2 text-sm leading-6 text-slate-400">This page for {activeSection.toLowerCase()} is ready to set up.</p>
                <span className="mt-5 inline-flex rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[10px] font-semibold text-slate-400 shadow-sm">Coming next</span>
              </div>
            </section>
          )}
        </main>
      </div>
    </div>
  )
}

