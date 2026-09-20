import { useEffect, useState } from 'react'
import { apiDownload, apiRequest } from '../../services/api/client'

type BackupSummary = {
  id: string
  kind: 'Manual' | 'Pre-restore'
  fileName: string
  createdAt: string
  createdByName: string
  schemaFingerprint: string
  tableCount: number
  rowCount: number
  sizeBytes: number
  sha256: string
}

type BackupPreview = {
  fileName: string
  createdAt: string
  schemaFingerprint: string
  tableCount: number
  rowCount: number
  sizeBytes: number
}

type RestoreResult = {
  restoredAt: string
  sourceFileName: string
  rowCount: number
  safetyBackup: BackupSummary
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('en-PH', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}

function saveBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}

export function DatabaseBackupSettings() {
  const [history, setHistory] = useState<BackupSummary[]>([])
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<BackupPreview | null>(null)
  const [confirmation, setConfirmation] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [operation, setOperation] = useState<'create' | 'validate' | 'restore' | 'download' | null>(null)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  useEffect(() => { void refreshHistory() }, [])

  async function refreshHistory() {
    try { setHistory(await apiRequest<BackupSummary[]>('/settings/backups')); setError('') }
    catch (failure) { setError(failure instanceof Error ? failure.message : 'Backup history could not be loaded.') }
    finally { setIsLoading(false) }
  }

  async function createBackup() {
    setOperation('create'); setError(''); setMessage('')
    try {
      const download = await apiDownload('/settings/backups', { method: 'POST' })
      saveBlob(download.blob, download.fileName)
      setMessage('Database backup created and downloaded. Keep the ZIP file in a secure location.')
      await refreshHistory()
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'The database backup could not be created.') }
    finally { setOperation(null) }
  }

  async function chooseFile(file: File | null) {
    setSelectedFile(file); setPreview(null); setConfirmation(''); setError(''); setMessage('')
    if (!file) return
    if (file.size > 60 * 1024 * 1024) { setError('Choose a database backup smaller than 60 MB.'); return }
    setOperation('validate')
    try {
      const form = new FormData(); form.append('file', file)
      setPreview(await apiRequest<BackupPreview>('/settings/backups/validate', { method: 'POST', body: form }))
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'The selected backup could not be validated.') }
    finally { setOperation(null) }
  }

  async function restoreBackup() {
    if (!selectedFile || !preview || confirmation !== 'RESTORE') return
    setOperation('restore'); setError(''); setMessage('')
    try {
      const form = new FormData(); form.append('file', selectedFile); form.append('confirmation', confirmation)
      const result = await apiRequest<RestoreResult>('/settings/backups/restore', { method: 'POST', body: form })
      setMessage(`Restore completed for ${result.rowCount.toLocaleString()} records. Safety backup: ${result.safetyBackup.fileName}. Reload the page before continuing work.`)
      setSelectedFile(null); setPreview(null); setConfirmation('')
      await refreshHistory()
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'The database restore could not be completed.') }
    finally { setOperation(null) }
  }

  async function downloadStored(backup: BackupSummary) {
    setOperation('download'); setError(''); setMessage('')
    try {
      const download = await apiDownload(`/settings/backups/${backup.id}/download`)
      saveBlob(download.blob, download.fileName)
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'The stored backup could not be downloaded.') }
    finally { setOperation(null) }
  }

  const busy = operation !== null
  return <div className="space-y-5">
    {error ? <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-semibold text-red-700">{error}</div> : null}
    {message ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-semibold text-emerald-700">{message}</div> : null}

    <div className="grid gap-5 xl:grid-cols-2">
      <section className="overflow-hidden rounded-[1.5rem] border border-slate-200/80 bg-white shadow-[0_18px_48px_-36px_rgba(0,20,76,0.45)]">
        <header className="border-b border-slate-100 px-5 py-4 sm:px-6"><h3 className="text-base font-extrabold text-brand-blue">Create Database Backup</h3><p className="mt-1 text-xs leading-5 text-slate-400">Exports business records and settings. Auth accounts, uploaded files, and credentials are excluded.</p></header>
        <div className="p-5 sm:p-6">
          <div className="rounded-2xl border border-blue-100 bg-blue-50/60 p-4 text-xs leading-6 text-brand-blue"><strong>Included:</strong> clients, suppliers, items and variants, quotations, purchase orders, expenses, statements, payments, tasks, settings, and audit history.</div>
          <button className="mt-5 inline-flex h-11 items-center justify-center rounded-xl bg-[linear-gradient(115deg,#00113f,#073078)] px-5 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-50" type="button" disabled={busy} onClick={() => void createBackup()}>{operation === 'create' ? 'Creating secure ZIP…' : 'Create and download backup'}</button>
        </div>
      </section>

      <section className="overflow-hidden rounded-[1.5rem] border border-red-200/70 bg-white shadow-[0_18px_48px_-36px_rgba(127,29,29,0.35)]">
        <header className="border-b border-red-100 bg-red-50/40 px-5 py-4 sm:px-6"><h3 className="text-base font-extrabold text-red-800">Restore Database Backup</h3><p className="mt-1 text-xs leading-5 text-red-500">This replaces current business data. A pre-restore safety backup is created automatically.</p></header>
        <div className="space-y-4 p-5 sm:p-6">
          <label className="block"><span className="mb-2 block text-[10px] font-bold uppercase tracking-[0.1em] text-slate-500">Backup ZIP</span><input className="block w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-brand-blue file:px-3 file:py-2 file:text-xs file:font-bold file:text-white" type="file" accept=".zip,application/zip" disabled={busy} onChange={(event) => void chooseFile(event.target.files?.[0] ?? null)} /></label>
          {operation === 'validate' ? <p className="text-xs font-semibold text-brand-blue">Validating structure and checksums…</p> : null}
          {preview ? <div className="grid grid-cols-2 gap-3 rounded-2xl border border-emerald-200 bg-emerald-50/50 p-4 text-xs"><div><span className="block text-[9px] font-bold uppercase text-emerald-600">Created</span><strong className="mt-1 block text-emerald-900">{formatDate(preview.createdAt)}</strong></div><div><span className="block text-[9px] font-bold uppercase text-emerald-600">Contents</span><strong className="mt-1 block text-emerald-900">{preview.tableCount} tables · {preview.rowCount.toLocaleString()} records</strong></div><div className="col-span-2"><span className="block text-[9px] font-bold uppercase text-emerald-600">File</span><strong className="mt-1 block truncate text-emerald-900">{preview.fileName} · {formatSize(preview.sizeBytes)}</strong></div></div> : null}
          {preview ? <label className="block"><span className="mb-2 block text-[10px] font-bold uppercase tracking-[0.1em] text-red-600">Type RESTORE to confirm</span><input className="h-11 w-full rounded-xl border border-red-200 px-3.5 text-sm font-bold text-red-800 outline-none focus:ring-4 focus:ring-red-100" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} autoComplete="off" /></label> : null}
          <button className="inline-flex h-11 items-center justify-center rounded-xl bg-red-700 px-5 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-40" type="button" disabled={busy || !preview || confirmation !== 'RESTORE'} onClick={() => void restoreBackup()}>{operation === 'restore' ? 'Creating safety backup and restoring…' : 'Restore business data'}</button>
        </div>
      </section>
    </div>

    <section className="overflow-hidden rounded-[1.5rem] border border-slate-200/80 bg-white shadow-[0_18px_48px_-36px_rgba(0,20,76,0.45)]">
      <header className="flex items-center justify-between border-b border-slate-100 px-5 py-4 sm:px-6"><div><h3 className="text-base font-extrabold text-brand-blue">Backup History</h3><p className="mt-1 text-xs text-slate-400">The 50 most recent manual and automatic safety backups.</p></div><button className="text-xs font-bold text-brand-blue disabled:opacity-50" type="button" disabled={busy} onClick={() => void refreshHistory()}>Refresh</button></header>
      {isLoading ? <p className="p-6 text-xs font-semibold text-slate-400">Loading backup history…</p> : history.length === 0 ? <p className="p-6 text-xs text-slate-400">No database backups have been created yet.</p> : <div className="divide-y divide-slate-100">{history.map((backup) => <div className="flex flex-wrap items-center justify-between gap-4 px-5 py-4 sm:px-6" key={backup.id}><div className="min-w-0"><div className="flex items-center gap-2"><span className={`rounded-full px-2 py-1 text-[9px] font-bold uppercase ${backup.kind === 'Pre-restore' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-brand-blue'}`}>{backup.kind}</span><strong className="truncate text-xs text-brand-blue">{backup.fileName}</strong></div><p className="mt-1.5 text-[10px] text-slate-400">{formatDate(backup.createdAt)} · {backup.rowCount.toLocaleString()} records · {formatSize(backup.sizeBytes)}</p></div><button className="h-9 rounded-xl border border-slate-200 px-3 text-[10px] font-bold text-brand-blue hover:border-brand-blue/30 disabled:opacity-50" type="button" disabled={busy} onClick={() => void downloadStored(backup)}>Download</button></div>)}</div>}
    </section>
  </div>
}
