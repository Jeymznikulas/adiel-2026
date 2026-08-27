import { useEffect, useState } from 'react'
import { beginGoogleCalendarConnection, disconnectGoogleCalendar, getGoogleCalendarStatus, type GoogleCalendarStatus } from '../../services/api/calendar'

function Icon({ path }: { path: string }) {
  return <svg className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={path} /></svg>
}

export function GoogleCalendarSettings() {
  const [status, setStatus] = useState<GoogleCalendarStatus | null>(null)
  const [isBusy, setIsBusy] = useState(true)
  const [error, setError] = useState('')
  const callbackStatus = new URLSearchParams(window.location.search).get('calendar')

  useEffect(() => {
    let active = true
    void getGoogleCalendarStatus().then((result) => { if (active) { setStatus(result); setError('') } }).catch((failure: unknown) => { if (active) setError(failure instanceof Error ? failure.message : 'Calendar status could not be loaded.') }).finally(() => { if (active) setIsBusy(false) })
    return () => { active = false }
  }, [])

  async function connect() {
    setIsBusy(true); setError('')
    try {
      const result = await beginGoogleCalendarConnection()
      window.location.assign(result.authorizationUrl)
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Google Calendar connection could not be started.')
      setIsBusy(false)
    }
  }

  async function disconnect() {
    setIsBusy(true); setError('')
    try {
      await disconnectGoogleCalendar()
      setStatus((current) => current ? { ...current, connected: false, googleAccountEmail: null, connectedAt: null } : current)
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Google Calendar could not be disconnected.')
    } finally { setIsBusy(false) }
  }

  return <section className="overflow-hidden rounded-[1.5rem] border border-slate-200/80 bg-white shadow-[0_18px_48px_-36px_rgba(0,20,76,0.45)]">
    <header className="border-b border-slate-100 px-5 py-4 sm:px-6"><h3 className="text-base font-extrabold text-brand-blue">Google Calendar</h3><p className="mt-1 text-xs text-slate-400">Use the admin Google account as organizer and invite each task assignee at their saved Calendar email.</p></header>
    <div className="grid gap-5 p-5 sm:p-6 lg:grid-cols-[1fr_0.8fr]">
      <div className="rounded-2xl border border-slate-200 bg-slate-50/45 p-5">
        <div className="flex items-start gap-4"><span className={`grid size-12 shrink-0 place-items-center rounded-2xl ${status?.connected ? 'bg-emerald-50 text-emerald-700' : 'bg-blue-50 text-brand-blue'}`}><Icon path="M8 2v4M16 2v4M3 9h18M5 4h14a2 2 0 0 1 2 2v14H3V6a2 2 0 0 1 2-2Zm3 9h3v3H8Z" /></span><div className="min-w-0"><p className="text-sm font-extrabold text-brand-blue">{isBusy && !status ? 'Checking connection…' : status?.connected ? 'Calendar connected' : 'Calendar not connected'}</p><p className="mt-1 text-xs leading-5 text-slate-500">{status?.connected ? <>Organizer: <span className="font-bold text-slate-700">{status.googleAccountEmail}</span></> : 'Connect the Google account that should own and send task invitations.'}</p></div></div>
        {callbackStatus === 'connected' ? <p className="mt-4 rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-[10px] font-semibold text-emerald-700">Connected successfully. Existing active tasks are queued for synchronization.</p> : callbackStatus === 'denied' ? <p className="mt-4 rounded-xl border border-amber-100 bg-amber-50 px-3 py-2 text-[10px] font-semibold text-amber-700">Google authorization was cancelled.</p> : null}
        {error ? <p className="mt-4 rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-[10px] font-semibold text-red-700">{error}</p> : null}
        {!status?.configured && status ? <p className="mt-4 rounded-xl border border-amber-100 bg-amber-50 px-3 py-2 text-[10px] font-semibold text-amber-700">Add the Google OAuth credentials to the API configuration before connecting.</p> : null}
        <div className="mt-5 flex gap-2">{status?.connected ? <button className="h-10 rounded-xl border border-red-200 px-4 text-xs font-bold text-red-600 transition hover:bg-red-50 disabled:opacity-40" type="button" onClick={disconnect} disabled={isBusy}>Disconnect</button> : <button className="h-10 rounded-xl bg-[linear-gradient(115deg,#00113f,#073078)] px-5 text-xs font-bold text-white transition hover:-translate-y-0.5 disabled:opacity-40" type="button" onClick={connect} disabled={isBusy || status?.configured === false}>Connect Google Calendar</button>}</div>
      </div>
      <aside className="rounded-2xl bg-[linear-gradient(145deg,#00113f,#073078)] p-5 text-white"><p className="text-[10px] font-bold uppercase tracking-[0.12em] text-white/45">Invitation flow</p><ol className="mt-5 space-y-4 text-xs leading-5 text-white/75"><li><strong className="mr-2 text-brand-orange">1.</strong>Add an assignee name and Calendar email under Options.</li><li><strong className="mr-2 text-brand-orange">2.</strong>Create or update a task and select one or more assignees.</li><li><strong className="mr-2 text-brand-orange">3.</strong>Google emails each assignee an event invitation.</li><li><strong className="mr-2 text-brand-orange">4.</strong>Due-date or status changes update the same event.</li></ol></aside>
    </div>
  </section>
}
