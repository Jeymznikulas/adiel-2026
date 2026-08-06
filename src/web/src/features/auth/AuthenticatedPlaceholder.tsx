import type { Session } from '@supabase/supabase-js'
import { useState } from 'react'
import { AppShell } from '../../components/layout/AppShell'
import { ClientsPage } from '../clients/ClientsPage'
import { ExpensesPage } from '../expenses/ExpensesPage'
import { ItemsPage } from '../items/ItemsPage'
import { LogsPage } from '../logs/LogsPage'
import { PurchaseOrdersPage } from '../purchase-orders/PurchaseOrdersPage'
import { SupplierPage } from '../suppliers/SupplierPage'
import { TasksPage } from '../tasks/TasksPage'
import { signOut } from './auth'

const workspaceModules = [
  { name: 'Tasks', detail: 'Plan and monitor daily work', accent: 'bg-sky-500' },
  { name: 'Quotations', detail: 'Prepare customer proposals', accent: 'bg-violet-500' },
  { name: 'Purchase orders', detail: 'Coordinate supplier orders', accent: 'bg-amber-500' },
  { name: 'Sales tracker', detail: 'Follow commercial activity', accent: 'bg-emerald-500' },
]

type AuthenticatedPlaceholderProps = {
  session: Session
}

export function AuthenticatedPlaceholder({ session }: AuthenticatedPlaceholderProps) {
  const [isSigningOut, setIsSigningOut] = useState(false)
  const username = session.user.email?.split('@')[0] ?? 'user'

  async function handleSignOut() {
    setIsSigningOut(true)

    try {
      await signOut()
    } finally {
      setIsSigningOut(false)
    }
  }

  return (
    <AppShell
      username={username}
      isSigningOut={isSigningOut}
      onSignOut={() => void handleSignOut()}
      sectionContent={{
        Tasks: <TasksPage currentUsername={username} />,
        Items: <ItemsPage currentUsername={username} />,
        'Purchase Order': <PurchaseOrdersPage currentUsername={username} />,
        Expenses: <ExpensesPage currentUsername={username} />,
        'Client Directory': <ClientsPage currentUsername={username} />,
        'Supplier Directory': <SupplierPage currentUsername={username} />,
        Logs: <LogsPage />,
      }}
    >
      <div className="space-y-6 animate-[content-enter_420ms_cubic-bezier(0.22,1,0.36,1)]">
        <section className="relative isolate overflow-hidden rounded-[1.75rem] bg-[linear-gradient(125deg,#00113f_0%,#062667_58%,#0b397f_100%)] px-6 py-8 shadow-[0_24px_70px_-28px_rgba(0,20,76,0.65)] sm:px-9 sm:py-10 lg:px-11">
          <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_82%_18%,rgba(73,137,255,0.28),transparent_28%),radial-gradient(circle_at_58%_120%,rgba(253,77,0,0.14),transparent_35%)]" aria-hidden="true" />
          <div className="absolute -right-16 -top-24 -z-10 size-80 rounded-full border border-white/10" aria-hidden="true" />
          <div className="absolute -right-6 -top-12 -z-10 size-56 rounded-full border border-white/[0.07]" aria-hidden="true" />
          <div className="grid items-end gap-8 lg:grid-cols-[1fr_auto]">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.07] px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-white/65 backdrop-blur-md">
                <span className="size-1.5 rounded-full bg-emerald-400 shadow-[0_0_0_4px_rgba(52,211,153,0.12)]" /> Secure workspace
              </span>
              <h2 className="mt-6 max-w-2xl text-3xl font-semibold leading-tight tracking-[-0.04em] text-white sm:text-[2.6rem]">Good to see you, <span className="text-white/65">{username}.</span></h2>
              <p className="mt-3 max-w-xl text-sm leading-6 text-blue-100/60">Everything you need to manage operations, commercial activity, and business relationships—organized in one workspace.</p>
            </div>
            <div className="hidden min-w-48 rounded-2xl border border-white/10 bg-white/[0.07] p-4 backdrop-blur-md sm:block">
              <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-white/40">System status</p>
              <div className="mt-3 flex items-center justify-between gap-6">
                <span className="text-sm font-semibold text-white">All services ready</span>
                <span className="size-2 rounded-full bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.7)]" />
              </div>
            </div>
          </div>
        </section>

        <section aria-labelledby="workspace-heading">
          <div className="mb-4 flex items-end justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-brand-orange">Overview</p>
              <h3 className="mt-1 text-lg font-bold tracking-[-0.025em] text-brand-blue" id="workspace-heading">Your workspace</h3>
            </div>
            <span className="text-xs font-medium text-slate-400">10 modules available</span>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {workspaceModules.map((module, index) => (
              <article className="group relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_8px_30px_-20px_rgba(0,20,76,0.35)] transition-all duration-300 hover:-translate-y-1 hover:border-slate-300 hover:shadow-[0_18px_45px_-22px_rgba(0,20,76,0.3)]" key={module.name}>
                <div className="flex items-center justify-between">
                  <span className={`size-2 rounded-full ${module.accent} shadow-[0_0_0_5px_rgba(15,23,42,0.03)]`} />
                  <span className="font-mono text-[10px] font-semibold text-slate-300">0{index + 1}</span>
                </div>
                <h4 className="mt-8 text-[15px] font-bold tracking-[-0.015em] text-brand-blue">{module.name}</h4>
                <p className="mt-1 text-xs leading-5 text-slate-400">{module.detail}</p>
                <div className="absolute inset-x-0 bottom-0 h-0.5 origin-left scale-x-0 bg-brand-orange transition-transform duration-300 group-hover:scale-x-100" aria-hidden="true" />
              </article>
            ))}
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
          <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-[0_8px_30px_-22px_rgba(0,20,76,0.28)]">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-400">Activity</p>
                <h3 className="mt-1 text-base font-bold text-brand-blue">Recent updates</h3>
              </div>
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-semibold text-slate-500">Live</span>
            </div>
            <div className="mt-8 flex min-h-28 items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/70 px-5 text-center">
              <div>
                <span className="mx-auto block size-1.5 rounded-full bg-slate-300" />
                <p className="mt-3 text-sm font-semibold text-slate-600">No recent activity</p>
                <p className="mt-1 text-xs text-slate-400">Updates will appear here as your team starts working.</p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-[0_8px_30px_-22px_rgba(0,20,76,0.28)]">
            <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-400">Workspace</p>
            <h3 className="mt-1 text-base font-bold text-brand-blue">Ready to begin</h3>
            <p className="mt-3 text-xs leading-5 text-slate-400">Choose any module from the navigation to begin setting up your business workflow.</p>
            <div className="mt-6 h-1.5 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full w-1/4 rounded-full bg-[linear-gradient(90deg,#fd4d00,#ff8a55)]" />
            </div>
            <div className="mt-2 flex justify-between text-[10px] font-medium text-slate-400"><span>Workspace initialized</span><span>25%</span></div>
          </div>
        </section>
      </div>
    </AppShell>
  )
}

