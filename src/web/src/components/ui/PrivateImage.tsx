import { useEffect, useState, type ImgHTMLAttributes } from 'react'
import { getImageUrl, type ImageTarget } from '../../services/api/images'

export function PrivateImage({ target, entityId, variantId, objectPath, ...props }: ImgHTMLAttributes<HTMLImageElement> & { target: ImageTarget; entityId?: string; variantId?: string; objectPath: string }) {
  const [url, setUrl] = useState(() => objectPath.startsWith('blob:') ? objectPath : '')
  const imageVariantId = target === 'items' && objectPath.split('/')[1] === 'variants' ? variantId : undefined
  const imageEntityId = entityId || (imageVariantId ? undefined : objectPath.split('/')[2])
  useEffect(() => {
    let active = true
    if (objectPath.startsWith('blob:')) { setUrl(objectPath); return () => { active = false } }
    if (!objectPath || !imageEntityId) { setUrl(''); return }
    let refreshTimer: ReturnType<typeof setTimeout> | undefined
    const refresh = () => {
      void getImageUrl(target, imageEntityId, imageVariantId).then((result) => {
        if (!active) return
        setUrl(result.url)
        refreshTimer = setTimeout(refresh, Math.max(1, result.expiresIn - 30) * 1000)
      }).catch(() => {
        if (!active) return
        setUrl('')
        refreshTimer = setTimeout(refresh, 30_000)
      })
    }
    setUrl('')
    refresh()
    return () => { active = false; clearTimeout(refreshTimer) }
  }, [imageEntityId, imageVariantId, objectPath, target])
  return url ? <img {...props} src={url} /> : null
}
