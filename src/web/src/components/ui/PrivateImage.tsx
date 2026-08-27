import { useEffect, useState, type ImgHTMLAttributes } from 'react'
import { getImageUrl, type ImageTarget } from '../../services/api/images'

export function PrivateImage({ target, entityId, variantId, objectPath, ...props }: ImgHTMLAttributes<HTMLImageElement> & { target: ImageTarget; entityId?: string; variantId?: string; objectPath: string }) {
  const [url, setUrl] = useState(() => objectPath.startsWith('blob:') ? objectPath : '')
  useEffect(() => {
    let active = true
    if (objectPath.startsWith('blob:')) { setUrl(objectPath); return () => { active = false } }
    if (!objectPath || !entityId) { setUrl(objectPath.startsWith('blob:') ? objectPath : ''); return }
    void getImageUrl(target, entityId, variantId).then((result) => { if (active) setUrl(result.url) }).catch(() => { if (active) setUrl('') })
    return () => { active = false }
  }, [entityId, objectPath, target, variantId])
  return url ? <img {...props} src={url} /> : null
}
