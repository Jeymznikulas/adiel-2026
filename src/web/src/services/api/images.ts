import { apiRequest } from './client'

export type ImageTarget = 'clients' | 'suppliers' | 'items'
export type UploadedImage = { objectPath: string; viewingUrl: string; version: number }
const path = (target: ImageTarget, id: string, variantId?: string) => target === 'items' && variantId ? `/items/${id}/variants/${variantId}/image` : `/${target}/${id}/image`
export function uploadImage(target: ImageTarget, id: string, version: number, file: File, variantId?: string) { const body = new FormData(); body.append('file', file); return apiRequest<UploadedImage>(`${path(target, id, variantId)}?version=${version}`, { method: 'POST', body }) }
export function getImageUrl(target: ImageTarget, id: string, variantId?: string) { return apiRequest<{ url: string; expiresIn: number }>(path(target, id, variantId)) }
export function removeImage(target: ImageTarget, id: string, version: number, variantId?: string) { return apiRequest<{ objectPath: null; version: number }>(`${path(target, id, variantId)}?version=${version}`, { method: 'DELETE' }) }
