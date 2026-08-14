import { useEffect, useState } from 'react'

export function usePersistentState<T>(key: string, initialValue: T, storageType: 'session' | 'local' = 'session') {
  const [value, setValue] = useState<T>(() => {
    try {
      const storage = storageType === 'local' ? window.localStorage : window.sessionStorage
      const stored = storage.getItem(`adiel.preference.${key}`)
      return stored === null ? initialValue : JSON.parse(stored) as T
    } catch {
      return initialValue
    }
  })

  useEffect(() => {
    try {
      const storage = storageType === 'local' ? window.localStorage : window.sessionStorage
      storage.setItem(`adiel.preference.${key}`, JSON.stringify(value))
    } catch {
      // Preferences remain available for the current render when storage is unavailable.
    }
  }, [key, storageType, value])

  return [value, setValue] as const
}
