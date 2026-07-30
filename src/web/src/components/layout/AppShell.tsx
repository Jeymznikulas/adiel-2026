import type { PropsWithChildren } from 'react'

export function AppShell({ children }: PropsWithChildren) {
  return (
    <div className="min-h-svh bg-canvas text-ink">
      <header className="border-b border-line/80">
        <div className="mx-auto flex h-20 max-w-6xl items-center justify-between px-6 lg:px-8">
          <a href="/" className="font-display text-xl tracking-[-0.02em]" aria-label="Adiel System home">
            Adiel<span className="text-brass">.</span>
          </a>
          <span className="rounded-full border border-line bg-paper px-3 py-1 text-xs font-medium text-ink-muted shadow-[0_1px_0_rgba(32,29,25,0.04)]">
            Foundation 01
          </span>
        </div>
      </header>
      <main>{children}</main>
      <footer className="mx-auto flex max-w-6xl justify-between px-6 py-8 text-xs text-ink-faint lg:px-8">
        <span>Adiel System</span>
        <span>Built with restraint</span>
      </footer>
    </div>
  )
}

