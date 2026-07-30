function requireEnvironmentValue(value: string | undefined, name: string): string {
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`)
  }

  return value
}

export const env = {
  apiBaseUrl: requireEnvironmentValue(import.meta.env.VITE_API_BASE_URL, 'VITE_API_BASE_URL'),
  supabaseUrl: requireEnvironmentValue(import.meta.env.VITE_SUPABASE_URL, 'VITE_SUPABASE_URL'),
  supabasePublishableKey: requireEnvironmentValue(
    import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    'VITE_SUPABASE_PUBLISHABLE_KEY',
  ),
  supabaseUsernameDomain: requireEnvironmentValue(
    import.meta.env.VITE_SUPABASE_USERNAME_DOMAIN,
    'VITE_SUPABASE_USERNAME_DOMAIN',
  ),
} as const
