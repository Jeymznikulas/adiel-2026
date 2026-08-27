import { useEffect } from 'react'

const errorSelector = '.rounded-xl.border-red-200.bg-red-50'

function announce(error: HTMLElement) {
  if (error.dataset.errorAnnouncementManaged === 'true') return

  error.dataset.errorAnnouncementManaged = 'true'
  error.setAttribute('role', 'alert')
  error.setAttribute('aria-live', 'assertive')
  error.tabIndex = -1

  window.requestAnimationFrame(() => {
    error.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    error.focus({ preventScroll: true })
  })
}

function announceErrors(node: Node) {
  if (!(node instanceof HTMLElement)) return
  if (node.matches(errorSelector)) announce(node)
  node.querySelectorAll<HTMLElement>(errorSelector).forEach(announce)
}

/**
 * Applies accessible, in-context error handling to the app's established error
 * panels while feature forms migrate to FormErrorSummary.
 */
export function ErrorFocusAnnouncer() {
  useEffect(() => {
    const observer = new MutationObserver((records) => {
      records.forEach((record) => record.addedNodes.forEach(announceErrors))
    })

    observer.observe(document.body, { childList: true, subtree: true })
    return () => observer.disconnect()
  }, [])

  return null
}
