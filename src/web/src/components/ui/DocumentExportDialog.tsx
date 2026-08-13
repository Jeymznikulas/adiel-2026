import { useEffect, useRef, useState } from 'react'
import { downloadDocumentBlob } from '../../services/pdf/documentPdf'
import { convertPdfToPng } from '../../services/pdf/pdfImage'

type DocumentExportDialogProps = {
  title: string
  reference: string
  pdfFilename: string
  pngFilename: string
  createPdfBlob: () => Promise<Blob>
  onClose: () => void
}

function Icon({ path, className = 'size-4' }: { path: string; className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={path} /></svg>
}

export function DocumentExportDialog({ title, reference, pdfFilename, pngFilename, createPdfBlob, onClose }: DocumentExportDialogProps) {
  const factory = useRef(createPdfBlob)
  const [pdfBlob, setPdfBlob] = useState<Blob | null>(null)
  const [previewUrl, setPreviewUrl] = useState('')
  const [error, setError] = useState('')
  const [isImageExporting, setIsImageExporting] = useState(false)
  const [imageProgress, setImageProgress] = useState('')

  useEffect(() => {
    let active = true
    let url = ''
    void factory.current().then((blob) => {
      if (!active) return
      url = URL.createObjectURL(blob)
      setPdfBlob(blob)
      setPreviewUrl(url)
    }).catch((cause: unknown) => {
      console.error(cause)
      if (active) setError('The document preview could not be generated.')
    })
    return () => {
      active = false
      if (url) URL.revokeObjectURL(url)
    }
  }, [])

  async function downloadImage() {
    if (!pdfBlob) return
    setIsImageExporting(true)
    setError('')
    try {
      const image = await convertPdfToPng(pdfBlob, (completed, total) => setImageProgress(`Rendering page ${completed} of ${total}`))
      downloadDocumentBlob(image, pngFilename)
    } catch (cause) {
      console.error(cause)
      setError('The PNG could not be generated in this browser. You can still download the PDF.')
    } finally {
      setIsImageExporting(false)
      setImageProgress('')
    }
  }

  return <div className="fixed inset-0 z-[110] grid place-items-center overflow-y-auto bg-slate-950/75 p-3 backdrop-blur-sm animate-[content-enter_180ms_ease-out]" role="dialog" aria-modal="true" aria-labelledby="document-export-preview-title">
    <button className="absolute inset-0" type="button" onClick={onClose} aria-label="Close document preview" />
    <section className="relative flex max-h-[calc(100svh-1.5rem)] w-full max-w-6xl flex-col overflow-hidden rounded-[1.5rem] border border-white/20 bg-white shadow-[0_32px_100px_rgba(0,20,76,0.48)]">
      <header className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-100 px-5 py-4 sm:px-6"><div><p className="text-[10px] font-bold uppercase tracking-[0.15em] text-brand-orange">Preview before export</p><h2 className="mt-1 text-xl font-extrabold tracking-[-0.03em] text-brand-blue" id="document-export-preview-title">{title}</h2><p className="mt-1 font-mono text-[10px] font-bold text-slate-400">{reference}</p></div><button className="grid size-9 shrink-0 place-items-center rounded-xl text-slate-300 transition hover:bg-slate-100 hover:text-brand-blue" type="button" onClick={onClose} aria-label="Close preview"><Icon path="M18 6 6 18M6 6l12 12" /></button></header>
      <div className="min-h-0 flex-1 bg-slate-100 p-3 sm:p-4">
        {error ? <div className="mb-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-semibold text-red-700">{error}</div> : null}
        {previewUrl ? <iframe className="h-[calc(100svh-14.5rem)] min-h-[28rem] w-full rounded-xl border border-slate-200 bg-white shadow-sm" src={previewUrl} title={`${reference} document preview`} /> : <div className="grid h-[calc(100svh-14.5rem)] min-h-[28rem] place-items-center rounded-xl border border-slate-200 bg-white"><div className="text-center"><span className="mx-auto grid size-12 place-items-center rounded-2xl bg-blue-50 text-brand-blue"><svg className="size-5 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M21 12a9 9 0 1 1-5.3-8.2" /></svg></span><p className="mt-3 text-xs font-bold text-brand-blue">Generating preview...</p></div></div>}
      </div>
      <footer className="flex shrink-0 flex-col gap-3 border-t border-slate-100 bg-white px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6"><div><p className="text-[10px] font-bold text-slate-600">Choose your export format</p><p className="mt-1 text-[9px] text-slate-400">Multi-page documents are combined into one tall PNG.</p></div><div className="flex flex-wrap justify-end gap-2"><button className="h-10 rounded-xl px-4 text-xs font-bold text-slate-500 transition hover:bg-slate-100" type="button" onClick={onClose}>Cancel</button><button className="inline-flex h-10 items-center gap-2 rounded-xl border border-orange-200 bg-orange-50 px-4 text-xs font-bold text-orange-700 transition hover:-translate-y-0.5 hover:bg-orange-100 disabled:cursor-not-allowed disabled:opacity-40" type="button" onClick={() => void downloadImage()} disabled={!pdfBlob || isImageExporting}><Icon path="M4 5h16v14H4V5Zm0 10 4-4 4 4 2-2 6 6M16 9h.01" />{isImageExporting ? imageProgress || 'Creating image...' : 'Download PNG'}</button><button className="inline-flex h-10 items-center gap-2 rounded-xl bg-[linear-gradient(115deg,#00113f,#073078)] px-5 text-xs font-bold text-white shadow-[0_8px_20px_-10px_rgba(0,20,76,0.7)] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-40" type="button" onClick={() => pdfBlob && downloadDocumentBlob(pdfBlob, pdfFilename)} disabled={!pdfBlob}><Icon path="M12 3v12M7 10l5 5 5-5M5 21h14" />Download PDF</button></div></footer>
    </section>
  </div>
}
