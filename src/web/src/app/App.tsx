import { AuthenticatedPlaceholder } from '../features/auth/AuthenticatedPlaceholder'
import { LoginPage } from '../features/auth/LoginPage'
import { useSession } from '../features/auth/useSession'

export function App() {
  const { session, isLoading } = useSession()

  if (isLoading) {
    return (
      <main className="grid min-h-svh place-items-center bg-white" aria-label="Loading session">
        <span className="size-7 animate-spin rounded-full border-2 border-brand-blue/20 border-t-brand-blue" />
      </main>
    )
  }

  return session ? <AuthenticatedPlaceholder session={session} /> : <LoginPage />
}

