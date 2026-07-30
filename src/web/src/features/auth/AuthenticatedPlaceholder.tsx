import type { Session } from '@supabase/supabase-js'
import { useState } from 'react'
import { BrandMark } from '../../components/ui/BrandMark'
import { signOut } from './auth'

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
    <main className="grid min-h-svh place-items-center bg-slate-50 px-6">
      <section className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-[0_18px_50px_rgba(0,20,76,0.08)]">
        <div className="mb-6 flex justify-center">
          <BrandMark />
        </div>
        <span className="mx-auto mb-5 block size-2 rounded-full bg-emerald-500 shadow-[0_0_0_7px_rgba(16,185,129,0.1)]" />
        <h1 className="text-2xl font-bold tracking-[-0.025em] text-brand-blue">Authentication successful</h1>
        <p className="mt-3 text-sm leading-6 text-slate-500">
          Signed in as <strong className="font-semibold text-slate-700">{username}</strong>. The business dashboard is ready to build next.
        </p>
        <button
          className="mt-7 h-11 rounded-xl border border-slate-200 px-5 text-sm font-semibold text-brand-blue transition hover:border-brand-blue/30 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          type="button"
          disabled={isSigningOut}
          onClick={() => void handleSignOut()}
        >
          {isSigningOut ? 'Signing out...' : 'Sign out'}
        </button>
      </section>
    </main>
  )
}

