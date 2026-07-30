import { env } from '../../lib/env'
import { supabase } from '../../services/supabase/client'

const usernamePattern = /^[a-zA-Z0-9._-]{3,64}$/

export class AuthenticationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AuthenticationError'
  }
}

export function normalizeUsername(username: string) {
  const normalized = username.trim().toLowerCase()

  if (!usernamePattern.test(normalized)) {
    throw new AuthenticationError('Enter a valid username.')
  }

  return normalized
}

export async function signInWithUsername(username: string, password: string) {
  const normalizedUsername = normalizeUsername(username)
  const email = `${normalizedUsername}@${env.supabaseUsernameDomain}`
  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    throw new AuthenticationError('The username or password is incorrect.')
  }
}

export async function signOut() {
  const { error } = await supabase.auth.signOut()

  if (error) {
    throw new AuthenticationError('Unable to sign out. Please try again.')
  }
}

