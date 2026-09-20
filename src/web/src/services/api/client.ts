import { env } from '../../lib/env'
import { supabase } from '../supabase/client'

type ApiProblem = {
  title?: string
  detail?: string
  status?: number
}

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

export async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await authenticatedFetch(path, init, 'application/json')
  await throwIfFailed(response)

  if (response.status === 204) {
    return undefined as T
  }

  return (await response.json()) as T
}

export async function apiDownload(path: string, init?: RequestInit): Promise<{ blob: Blob; fileName: string }> {
  const response = await authenticatedFetch(path, init, 'application/zip')
  await throwIfFailed(response)
  const disposition = response.headers.get('Content-Disposition') ?? ''
  const encoded = disposition.match(/filename\*=UTF-8''([^;]+)/i)?.[1]
  const plain = disposition.match(/filename="?([^";]+)"?/i)?.[1]
  const fileName = encoded ? decodeURIComponent(encoded) : (plain ?? 'adiel-database-backup.zip')
  return { blob: await response.blob(), fileName }
}

async function authenticatedFetch(path: string, init: RequestInit | undefined, accept: string) {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.access_token) throw new ApiError('Your session has expired. Sign in again.', 401)

  const headers = new Headers(init?.headers)
  headers.set('Accept', accept)
  headers.set('Authorization', `Bearer ${session.access_token}`)
  if (init?.body && !(init.body instanceof FormData)) headers.set('Content-Type', 'application/json')

  return fetch(`${env.apiBaseUrl}${path}`, {
    ...init,
    headers,
  })
}

async function throwIfFailed(response: Response) {
  if (!response.ok) {
    const problem = (await response.json().catch(() => ({}))) as ApiProblem
    throw new ApiError(problem.detail ?? problem.title ?? 'The request failed.', response.status)
  }
}

