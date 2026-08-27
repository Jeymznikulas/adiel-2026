import { apiRequest } from './client'

export type GoogleCalendarStatus = {
  configured: boolean
  connected: boolean
  googleAccountEmail: string | null
  connectedAt: string | null
}

export const getGoogleCalendarStatus = () => apiRequest<GoogleCalendarStatus>('/integrations/google-calendar/status')
export const beginGoogleCalendarConnection = () => apiRequest<{ authorizationUrl: string }>('/integrations/google-calendar/connect', { method: 'POST' })
export const disconnectGoogleCalendar = () => apiRequest<void>('/integrations/google-calendar/connection', { method: 'DELETE' })
export const retryGoogleCalendarTaskSync = (taskId: string) => apiRequest<void>(`/integrations/google-calendar/tasks/${taskId}/retry`, { method: 'POST' })
