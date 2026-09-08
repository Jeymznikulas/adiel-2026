import { defineConfig, devices } from '@playwright/test'
import { fileURLToPath } from 'node:url'

const repositoryRoot = fileURLToPath(new URL('../..', import.meta.url))

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:5173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'edge', use: { ...devices['Desktop Chrome'], channel: 'msedge' } }],
  webServer: [
    {
      command: 'dotnet run --project src/api/AdielSystem.Api -c Release --no-build',
      cwd: repositoryRoot,
      url: 'http://127.0.0.1:5080/health/live',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
    {
      command: 'npm run dev --prefix src/web -- --host 127.0.0.1',
      cwd: repositoryRoot,
      url: 'http://127.0.0.1:5173',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
})
