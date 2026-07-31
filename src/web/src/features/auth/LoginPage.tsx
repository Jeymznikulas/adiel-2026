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
  const [showPassword, setShowPassword] = useState(false)

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
    <main className="grid min-h-svh bg-[#f7f8fb] lg:grid-cols-[minmax(30rem,0.9fr)_1.1fr]">
      <section className="relative isolate flex min-h-svh flex-col overflow-hidden px-6 py-6 sm:px-10 lg:px-12 xl:px-16 2xl:px-20">
        <div className="pointer-events-none absolute -left-40 top-1/3 -z-10 size-96 rounded-full bg-blue-100/50 blur-3xl" aria-hidden="true" />
        <div className="pointer-events-none absolute bottom-0 right-0 -z-10 size-72 bg-[radial-gradient(circle,rgba(0,20,76,0.035)_1px,transparent_1px)] [background-size:18px_18px]" aria-hidden="true" />

        <header className="flex items-center animate-[content-enter_420ms_cubic-bezier(0.22,1,0.36,1)]">
          <BrandMark />
          <span className="mx-4 hidden h-8 w-px bg-slate-200 sm:block" aria-hidden="true" />
          <div className="hidden sm:block">
            <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-brand-orange">The Allies of Vissionaries</p>
            <p className="mt-1 text-[9px] font-medium uppercase tracking-[0.14em] text-slate-400">Business operations suite</p>
          </div>
        </header>

        <div className="mx-auto flex w-full max-w-[26.5rem] flex-1 items-center py-12 sm:py-16">
          <div className="w-full animate-[content-enter_500ms_80ms_cubic-bezier(0.22,1,0.36,1)_both]">
            <div className="mb-8">
              <h1 className="mt-6 text-[2.3rem] font-semibold leading-[1.05] tracking-[-0.045em] text-brand-blue sm:text-[2.75rem]">Welcome back.</h1>
              <p className="mt-3 max-w-sm text-sm leading-6 text-slate-500">Sign in to access your workspace and continue managing your business operations.</p>
            </div>

            <form className="space-y-4" onSubmit={(event) => void handleSubmit(event)}>
              <div>
                <label className="mb-2 block text-[11px] font-bold uppercase tracking-[0.08em] text-slate-600" htmlFor="username">Username</label>
                <div className="group relative">
                  <svg className="pointer-events-none absolute left-4 top-1/2 size-[1.05rem] -translate-y-1/2 text-slate-300 transition-colors group-focus-within:text-brand-blue" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 21a8 8 0 0 0-16 0M12 13a5 5 0 1 0 0-10 5 5 0 0 0 0 10Z" /></svg>
                  <input
                    className="h-14 w-full rounded-[0.9rem] border border-slate-200 bg-white/90 pl-11 pr-4 text-sm font-medium text-brand-blue shadow-[0_5px_20px_-15px_rgba(0,20,76,0.3)] outline-none transition-all placeholder:font-normal placeholder:text-slate-300 hover:border-slate-300 focus:border-brand-blue/50 focus:bg-white focus:ring-4 focus:ring-brand-blue/[0.055]"
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
              </div>

              <div>
                <label className="mb-2 block text-[11px] font-bold uppercase tracking-[0.08em] text-slate-600" htmlFor="password">Password</label>
                <div className="group relative">
                  <svg className="pointer-events-none absolute left-4 top-1/2 size-[1.05rem] -translate-y-1/2 text-slate-300 transition-colors group-focus-within:text-brand-blue" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 10V8a6 6 0 0 1 12 0v2M5 10h14v11H5V10Zm7 5v2" /></svg>
                  <input
                    className="h-14 w-full rounded-[0.9rem] border border-slate-200 bg-white/90 pl-11 pr-12 text-sm font-medium text-brand-blue shadow-[0_5px_20px_-15px_rgba(0,20,76,0.3)] outline-none transition-all placeholder:font-normal placeholder:text-slate-300 hover:border-slate-300 focus:border-brand-blue/50 focus:bg-white focus:ring-4 focus:ring-brand-blue/[0.055]"
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    placeholder="Enter your password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    aria-invalid={errorMessage !== null}
                    aria-describedby={errorMessage ? 'login-error' : undefined}
                    disabled={isSubmitting}
                    required
                  />
                  <button className="absolute right-2 top-1/2 grid size-10 -translate-y-1/2 place-items-center rounded-xl text-slate-300 transition hover:bg-slate-50 hover:text-brand-blue focus-visible:outline-2 focus-visible:outline-brand-blue" type="button" onClick={() => setShowPassword((current) => !current)} aria-label={showPassword ? 'Hide password' : 'Show password'} disabled={isSubmitting}>
                    {showPassword ? (
                      <svg className="size-[1.05rem]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m3 3 18 18M10.6 10.7a2 2 0 0 0 2.7 2.7M9.9 4.2A10.7 10.7 0 0 1 12 4c5.5 0 9 8 9 8a17 17 0 0 1-2 3.1M6.6 6.6C4.2 8.2 3 12 3 12s3.5 8 9 8a9.8 9.8 0 0 0 4.1-.9" /></svg>
                    ) : (
                      <svg className="size-[1.05rem]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 12s3.5-8 9-8 9 8 9 8-3.5 8-9 8-9-8-9-8Zm9 3a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" /></svg>
                    )}
                  </button>
                </div>
              </div>

              {errorMessage ? (
                <div className="flex items-start gap-3 rounded-[0.9rem] border border-red-200/80 bg-red-50 px-4 py-3 text-xs leading-5 text-red-700" id="login-error" role="alert">
                  <span className="mt-1 size-1.5 shrink-0 rounded-full bg-red-500" />
                  <span>{errorMessage}</span>
                </div>
              ) : null}

              <button className="group relative flex h-14 w-full items-center justify-center gap-3 overflow-hidden rounded-[0.9rem] bg-[linear-gradient(115deg,#00113f,#073078)] px-5 text-sm font-bold text-white shadow-[0_14px_35px_-12px_rgba(0,20,76,0.65)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_20px_42px_-14px_rgba(0,20,76,0.7)] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-blue active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-65 disabled:hover:translate-y-0" type="submit" disabled={isSubmitting}>
                <span className="absolute inset-0 translate-x-[-120%] bg-[linear-gradient(100deg,transparent,rgba(255,255,255,0.08),transparent)] transition-transform duration-700 group-hover:translate-x-[120%]" aria-hidden="true" />
                {isSubmitting ? <span className="size-4 animate-spin rounded-full border-2 border-white/25 border-t-white" aria-hidden="true" /> : null}
                <span>{isSubmitting ? 'Signing in securely...' : 'Sign in to workspace'}</span>
                {!isSubmitting ? <svg className="size-4 transition-transform duration-300 group-hover:translate-x-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6" /></svg> : null}
              </button>
            </form>

            <div className="mt-6 flex items-center justify-center gap-2 text-[10px] font-medium text-slate-400">
              <svg className="size-3.5 text-emerald-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Zm-3-10 2 2 4-4" /></svg>
              Secure authentication powered by Supabase
            </div>
          </div>
        </div>

        <footer className="flex items-center justify-between text-[10px] font-medium text-slate-400">
          <span>&copy; 2026 Adiel System</span>
          <span className="hidden sm:block">Authorized access only</span>
        </footer>
      </section>

      <aside className="relative hidden min-h-svh overflow-hidden bg-brand-blue lg:block">
        <img className="absolute inset-0 size-full scale-[1.02] object-cover" src={loginImageUrl} alt="Construction professionals coordinating work on site" loading="eager" decoding="async" />
        <div className="absolute inset-0 bg-[#00113f]/35" aria-hidden="true" />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,11,43,0.18)_0%,rgba(0,17,63,0.28)_40%,rgba(0,11,43,0.94)_100%)]" aria-hidden="true" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_15%,rgba(255,255,255,0.12),transparent_24%)]" aria-hidden="true" />

        <div className="absolute inset-x-0 bottom-0 z-10 p-9 xl:p-14 2xl:p-16">
          <div className="max-w-2xl rounded-[1.75rem] border border-white/15 bg-white/[0.075] p-7 text-white shadow-[0_24px_80px_rgba(0,0,0,0.25)] backdrop-blur-md xl:p-9">
            <div className="flex items-center gap-3">
              <span className="h-px w-8 bg-brand-orange" />
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/55">The Allies of Vissionaries</p>
            </div>
            <h2 className="mt-5 max-w-xl text-balance text-[2.15rem] font-semibold leading-[1.08] tracking-[-0.045em] xl:text-[2.8rem]">Build with clarity. Operate with confidence.</h2>
            <p className="mt-4 max-w-lg text-sm leading-6 text-blue-100/60">A dependable command center for the people, materials, and decisions that keep your business moving.</p>
            <div className="mt-7 grid grid-cols-3 gap-3 border-t border-white/10 pt-5">
              {['One workspace', 'Clear oversight', 'Built to scale'].map((item, index) => (
                <div key={item}>
                  <span className="font-mono text-[9px] text-brand-orange">0{index + 1}</span>
                  <p className="mt-1.5 text-[10px] font-semibold text-white/65">{item}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </aside>
    </main>
  )
}
