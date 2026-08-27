import { useEffect, useRef, useState, type PointerEvent } from 'react'

const frameSize = 320
const outputSize = 800

type Offset = { x: number; y: number }

export function SquareImageCropper({ file, label = 'Image', onCancel, onConfirm }: { file: File; label?: string; onCancel: () => void; onConfirm: (file: File) => void }) {
  const imageRef = useRef<HTMLImageElement>(null)
  const drag = useRef<{ pointerId: number; x: number; y: number } | null>(null)
  const [sourceUrl, setSourceUrl] = useState('')
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 })
  const [zoom, setZoom] = useState(1)
  const [offset, setOffset] = useState<Offset>({ x: 0, y: 0 })
  const [error, setError] = useState('')
  const [isCropping, setIsCropping] = useState(false)

  const baseScale = dimensions.width && dimensions.height ? Math.max(frameSize / dimensions.width, frameSize / dimensions.height) : 1
  const displayScale = baseScale * zoom

  useEffect(() => {
    const nextUrl = URL.createObjectURL(file)
    setSourceUrl(nextUrl)
    setDimensions({ width: 0, height: 0 })
    setZoom(1)
    setOffset({ x: 0, y: 0 })
    setError('')
    return () => URL.revokeObjectURL(nextUrl)
  }, [file])

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) { if (event.key === 'Escape') onCancel() }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onCancel])

  function clamp(next: Offset, nextZoom = zoom): Offset {
    if (!dimensions.width || !dimensions.height) return { x: 0, y: 0 }
    const scale = baseScale * nextZoom
    const maxX = Math.max(0, (dimensions.width * scale - frameSize) / 2)
    const maxY = Math.max(0, (dimensions.height * scale - frameSize) / 2)
    return { x: Math.max(-maxX, Math.min(maxX, next.x)), y: Math.max(-maxY, Math.min(maxY, next.y)) }
  }

  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    event.currentTarget.setPointerCapture(event.pointerId)
    drag.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY }
  }

  function onPointerMove(event: PointerEvent<HTMLDivElement>) {
    const current = drag.current
    if (!current || current.pointerId !== event.pointerId) return
    const x = event.clientX - current.x
    const y = event.clientY - current.y
    drag.current = { ...current, x: event.clientX, y: event.clientY }
    setOffset((previous) => clamp({ x: previous.x + x, y: previous.y + y }))
  }

  function stopDragging(event: PointerEvent<HTMLDivElement>) {
    if (drag.current?.pointerId === event.pointerId) drag.current = null
  }

  function updateZoom(nextZoom: number) {
    setZoom(nextZoom)
    setOffset((previous) => clamp(previous, nextZoom))
  }

  async function confirmCrop() {
    const image = imageRef.current
    if (!image || !dimensions.width || !dimensions.height) return
    setIsCropping(true)
    setError('')
    try {
      const canvas = document.createElement('canvas')
      canvas.width = outputSize
      canvas.height = outputSize
      const context = canvas.getContext('2d')
      if (!context) throw new Error('Your browser cannot prepare this image.')
      const sourceWidth = frameSize / displayScale
      const sourceHeight = frameSize / displayScale
      const sourceX = (dimensions.width - sourceWidth) / 2 - offset.x / displayScale
      const sourceY = (dimensions.height - sourceHeight) / 2 - offset.y / displayScale
      context.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, outputSize, outputSize)
      const cropped = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.92))
      if (!cropped) throw new Error('The image could not be cropped.')
      const result = new File([cropped], `${label.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'image'}.jpg`, { type: 'image/jpeg' })
      if (result.size > 5 * 1024 * 1024) throw new Error('The cropped image is larger than 5 MB. Choose a smaller image.')
      onConfirm(result)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The image could not be cropped.')
    } finally {
      setIsCropping(false)
    }
  }

  return <div className="fixed inset-0 z-[80] grid place-items-center bg-slate-950/70 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="image-crop-title">
    <div className="w-full max-w-md overflow-hidden rounded-[1.5rem] border border-white/20 bg-white shadow-[0_35px_100px_rgba(0,20,76,0.45)]">
      <div className="border-b border-slate-100 px-5 py-4"><p className="text-[11px] font-bold uppercase tracking-[0.14em] text-brand-orange">{label}</p><h2 className="mt-1 text-lg font-bold text-brand-blue" id="image-crop-title">Position your image</h2><p className="mt-1 text-xs text-slate-500">Drag to reposition and use the slider to zoom. The saved image will be square.</p></div>
      <div className="p-5"><div className="mx-auto w-80 max-w-full overflow-hidden rounded-2xl bg-slate-950 shadow-inner" onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={stopDragging} onPointerCancel={stopDragging} style={{ aspectRatio: '1', touchAction: 'none', cursor: 'grab' }}><img ref={imageRef} src={sourceUrl} alt="Crop preview" draggable={false} onLoad={(event) => setDimensions({ width: event.currentTarget.naturalWidth, height: event.currentTarget.naturalHeight })} className="pointer-events-none relative left-1/2 top-1/2 max-w-none select-none" style={{ width: dimensions.width ? `${dimensions.width * displayScale}px` : undefined, height: dimensions.height ? `${dimensions.height * displayScale}px` : undefined, transform: `translate(calc(-50% + ${offset.x}px), calc(-50% + ${offset.y}px))` }} /></div><label className="mt-5 block"><span className="mb-2 flex justify-between text-[11px] font-bold uppercase tracking-[0.1em] text-slate-500"><span>Zoom</span><span>{Math.round(zoom * 100)}%</span></span><input className="h-2 w-full cursor-pointer accent-brand-blue" type="range" min="1" max="3" step="0.01" value={zoom} onChange={(event) => updateZoom(Number(event.target.value))} aria-label="Zoom photo" /></label>{error ? <p className="mt-3 rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-xs font-semibold text-red-600">{error}</p> : null}</div>
      <div className="flex justify-end gap-2 border-t border-slate-100 bg-slate-50/60 px-5 py-4"><button className="h-10 rounded-xl px-4 text-xs font-bold text-slate-500 transition hover:bg-slate-100" type="button" onClick={onCancel} disabled={isCropping}>Cancel</button><button className="h-10 rounded-xl bg-[linear-gradient(115deg,#00113f,#073078)] px-5 text-xs font-bold text-white shadow-[0_8px_20px_-10px_rgba(0,20,76,0.7)] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50" type="button" onClick={() => void confirmCrop()} disabled={!dimensions.width || isCropping}>{isCropping ? 'Cropping...' : 'Use photo'}</button></div>
    </div>
  </div>
}
