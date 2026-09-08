import { expect, test } from '@playwright/test'

const username = process.env.ADIEL_E2E_USERNAME
const password = process.env.ADIEL_E2E_PASSWORD

test('anonymous users are held at the login boundary', async ({ page }) => {
  await page.goto('/clients')
  await expect(page.getByRole('heading', { name: 'Welcome back.' })).toBeVisible()
  await expect(page.locator('#password')).toHaveAttribute('type', 'password')
})

test('the owner can traverse every critical workflow register without browser business storage', async ({ page }) => {
  test.skip(!username || !password, 'Set ADIEL_E2E_USERNAME and ADIEL_E2E_PASSWORD in the external test secret store.')

  await page.goto('/')
  await page.getByLabel('Username').fill(username!)
  await page.locator('#password').fill(password!)
  await page.getByRole('button', { name: 'Sign in to workspace' }).click()
  await expect(page.getByRole('link', { name: 'Clients', exact: true })).toBeVisible()

  for (const [label, path] of [
    ['Clients', '/clients'],
    ['Quotations', '/quotations'],
    ['Purchase Orders', '/purchase-orders'],
    ['Expenses', '/expenses'],
    ['Statements of Account', '/statement-of-account'],
    ['Collections', '/collections'],
  ] as const) {
    await page.goto(path)
    await expect(page.getByRole('link', { name: label, exact: true })).toBeVisible()
    await expect(page.getByText(/could not be loaded/i)).toHaveCount(0)
  }

  const unexpectedLocalStorageKeys = await page.evaluate(() => Object.keys(window.localStorage).filter((key) =>
    !key.startsWith('adiel.preference.') && !(key.startsWith('sb-') && key.endsWith('-auth-token'))))
  expect(unexpectedLocalStorageKeys).toEqual([])
})
