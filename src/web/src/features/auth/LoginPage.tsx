import type { FormEvent } from 'react'
import { useState } from 'react'
import { BrandMark } from '../../components/ui/BrandMark'
import { AuthenticationError, signInWithUsername } from './auth'

const loginImageUrl = '/images/login-background.jpg'

export function LoginPage() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setErrorMessage(null)
    setIsSubmitting(true)

    try {
      await signInWithUsername(username, password)
    } catch (error) {
      setErrorMessage(error instanceof AuthenticationError ? error.message : 'Unable to sign in. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="grid min-h-svh bg-white lg:grid-cols-[minmax(30rem,0.92fr)_1.08fr]">
      <section className="flex min-h-svh flex-col px-6 py-7 sm:px-10 lg:px-14 xl:px-20">
        <header>
          <BrandMark />
        </header>

        <div className="mx-auto flex w-full max-w-[27rem] flex-1 items-center py-16">
          <div className="w-full">
            <div className="mb-9">
              <span className="mb-5 block h-1 w-9 rounded-full bg-brand-orange" />
              <p className="mb-2 text-[13px] font-bold uppercase tracking-[0.16em] text-brand-blue/55">Business portal</p>
              <h1 className="text-[2.15rem] font-bold leading-tight tracking-[-0.035em] text-brand-blue sm:text-[2.55rem]">
                Welcome back
              </h1>
              <p className="mt-3 text-[15px] leading-6 text-slate-500">Sign in to manage materials, orders, and deliveries.</p>
            </div>

            <form className="space-y-5" onSubmit={(event) => void handleSubmit(event)}>
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700" htmlFor="username">
                  Username
                </label>
                <input
                  className="h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-[15px] text-brand-blue outline-none transition placeholder:text-slate-400 hover:border-slate-300 focus:border-brand-blue focus:ring-4 focus:ring-brand-blue/[0.07]"
                  id="username"
                  name="username"
                  type="text"
                  autoCapitalize="none"
                  autoComplete="username"
                  placeholder="Enter your username"
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  aria-invalid={errorMessage !== null}
                  disabled={isSubmitting}
                  required
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700" htmlFor="password">
                  Password
                </label>
                <input
                  className="h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-[15px] text-brand-blue outline-none transition placeholder:text-slate-400 hover:border-slate-300 focus:border-brand-blue focus:ring-4 focus:ring-brand-blue/[0.07]"
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  aria-invalid={errorMessage !== null}
                  aria-describedby={errorMessage ? 'login-error' : undefined}
                  disabled={isSubmitting}
                  required
                />
              </div>

              {errorMessage ? (
                <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" id="login-error" role="alert">
                  {errorMessage}
                </p>
              ) : null}

              <button
                className="group flex h-12 w-full items-center justify-center gap-3 rounded-xl bg-brand-blue px-5 text-sm font-bold text-white shadow-[0_10px_24px_rgba(0,20,76,0.18)] transition duration-200 hover:-translate-y-0.5 hover:bg-[#071e5c] hover:shadow-[0_14px_30px_rgba(0,20,76,0.24)] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-blue active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-65 disabled:hover:translate-y-0"
                type="submit"
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Signing in...' : 'Sign in'}
                {!isSubmitting ? (
                  <span className="text-lg leading-none text-white transition-transform group-hover:translate-x-1" aria-hidden="true">
                    &rarr;
                  </span>
                ) : null}
              </button>
            </form>
          </div>
        </div>

        <footer className="text-xs text-slate-400">
          <span>&copy; 2026 Adiel System</span>
        </footer>
      </section>

      <aside className="relative hidden min-h-svh overflow-hidden bg-brand-blue lg:block">
        <img
          className="absolute inset-0 size-full object-cover"
          src={loginImageUrl}
          alt="Construction professionals coordinating work on site"
          loading="eager"
          decoding="async"
        />
        <div className="absolute inset-0 bg-brand-blue/20" aria-hidden="true" />
        <div
          className="absolute inset-0 bg-gradient-to-t from-brand-blue/85 via-brand-blue/20 to-brand-blue/10"
          aria-hidden="true"
        />
        <div className="absolute inset-x-0 bottom-0 z-10 p-12 text-white xl:p-16">
          <span className="mb-6 block h-1 w-10 rounded-full bg-brand-orange" />
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-white/65">Business management system</p>
          <h2 className="mt-4 max-w-xl text-balance text-[2.5rem] font-semibold leading-[1.08] tracking-[-0.035em] xl:text-5xl">
            Keep every part of your operation moving.
          </h2>
          <p className="mt-5 max-w-lg text-[15px] leading-7 text-white/72">
            Manage inventory, purchasing, sales, and site deliveries from one dependable workspace.
          </p>
        </div>
      </aside>
    </main>
  )
}
