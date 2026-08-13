import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

function canvasToBlob(canvas: HTMLCanvasElement) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob)
      else reject(new Error('The image could not be created.'))
    }, 'image/png')
  })
}

export async function convertPdfToPng(pdfBlob: Blob, onProgress?: (completed: number, total: number) => void) {
  const pdfjs = await import('pdfjs-dist')
  pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl
  const pdf = await pdfjs.getDocument({ data: new Uint8Array(await pdfBlob.arrayBuffer()) }).promise
  const pages = await Promise.all(Array.from({ length: pdf.numPages }, (_, index) => pdf.getPage(index + 1)))
  const baseViewports = pages.map((page) => page.getViewport({ scale: 1 }))
  const gapAtFullScale = 18
  const totalBaseHeight = baseViewports.reduce((total, viewport) => total + viewport.height, 0) + gapAtFullScale * Math.max(0, pages.length - 1)
  const scale = Math.min(1.65, 16_000 / totalBaseHeight)
  const viewports = pages.map((page) => page.getViewport({ scale }))
  const gap = Math.max(8, Math.round(gapAtFullScale * scale))
  const width = Math.ceil(Math.max(...viewports.map((viewport) => viewport.width)))
  const height = Math.ceil(viewports.reduce((total, viewport) => total + viewport.height, 0) + gap * Math.max(0, pages.length - 1))
  const outputCanvas = document.createElement('canvas')
  outputCanvas.width = width
  outputCanvas.height = height
  const outputContext = outputCanvas.getContext('2d')
  if (!outputContext) throw new Error('Canvas rendering is not available in this browser.')
  outputContext.fillStyle = '#e8edf5'
  outputContext.fillRect(0, 0, width, height)

  let y = 0
  for (let index = 0; index < pages.length; index += 1) {
    const page = pages[index]!
    const viewport = viewports[index]!
    const pageCanvas = document.createElement('canvas')
    pageCanvas.width = Math.ceil(viewport.width)
    pageCanvas.height = Math.ceil(viewport.height)
    const pageContext = pageCanvas.getContext('2d')
    if (!pageContext) throw new Error('Canvas rendering is not available in this browser.')
    await page.render({ canvas: pageCanvas, canvasContext: pageContext, viewport }).promise
    const x = Math.floor((width - pageCanvas.width) / 2)
    outputContext.drawImage(pageCanvas, x, y)
    y += pageCanvas.height + gap
    onProgress?.(index + 1, pages.length)
  }

  return canvasToBlob(outputCanvas)
}
