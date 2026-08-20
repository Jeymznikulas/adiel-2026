import { useEffect, useState } from 'react'

export const chartPalette = {
  navy: '#0b397f',
  navyDark: '#00144c',
  orange: '#fd7a3f',
  orangeDark: '#fd4d00',
  green: '#10b981',
  red: '#dc2626',
  cyan: '#0891b2',
  amber: '#ea580c',
  grid: '#e8edf4',
  axis: '#94a3b8',
  zero: '#cbd5e1',
} as const

export const chartTooltipStyle = {
  border: '1px solid #e2e8f0',
  borderRadius: 14,
  boxShadow: '0 18px 42px -24px rgba(0, 20, 76, 0.42)',
  padding: '10px 12px',
  backgroundColor: 'rgba(255, 255, 255, 0.98)',
}

export const chartTooltipLabelStyle = { color: '#00144c', fontSize: 12, fontWeight: 800, marginBottom: 6 }
export const chartTooltipItemStyle = { fontSize: 11, fontWeight: 700, paddingTop: 2 }
export const chartAxisTick = { fill: chartPalette.axis, fontSize: 10, fontWeight: 600 }

export function formatChartPeso(value: number) {
  return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', maximumFractionDigits: 0 }).format(value)
}

export function formatChartCompactPeso(value: number) {
  return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', notation: 'compact', maximumFractionDigits: 1 }).format(value)
}

export function useChartAnimation() {
  const [enabled, setEnabled] = useState(() => typeof window === 'undefined' || !window.matchMedia('(prefers-reduced-motion: reduce)').matches)

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => setEnabled(!media.matches)
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])

  return enabled
}
