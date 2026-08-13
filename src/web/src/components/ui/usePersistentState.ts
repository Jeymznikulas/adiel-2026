import { useEffect, useState } from 'react'

export function usePersistentState<T>(key: string, initialValue: T) {
  const [value, setValue] = useState<T>(() => {
    try {
      const stored = window.sessionStorage.getItem(`adiel.preference.${key}`)
      return stored === null ? initialValue : JSON.parse(stored) as T
    } catch {
      return initialValue
    }
  })

  useEffect(() => {
    try {
      window.sessionStorage.setItem(`adiel.preference.${key}`, JSON.stringify(value))
    } catch {
      // Preferences remain available for the current render when storage is unavailable.
    }
  }, [key, value])

  return [value, setValue] as const
}
