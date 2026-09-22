import { expect, test } from '@playwright/test'

test('nginx index listing discovers sites and opens a site home', async ({ page }) => {
  const listing = await page.request.get('/_indexes/')
  expect(listing.ok()).toBeTruthy()
  const directoryListing = await listing.text()
  expect(directoryListing).toContain('sre.json')
  expect(directoryListing).toContain('frontend.json')

  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Choose a site' })).toBeVisible()
  await expect(page.getByRole('button', { name: /SRE/ })).toBeVisible()
  await expect(page.getByRole('button', { name: /Frontend/ })).toBeVisible()

  await page.getByRole('button', { name: /SRE/ }).click()
  await expect(page).toHaveURL(/\/sre$/)
  await expect(page.getByRole('heading', { name: 'SRE', exact: true })).toBeVisible()
})

test('a direct artifact URL survives reload and loads its relative stylesheet', async ({ page }) => {
  const stylesheetResponse = page.waitForResponse((response) => {
    return new URL(response.url()).pathname === '/_artifacts/sre/incidents/checkout-latency/styles.css'
  })

  const navigationResponse = await page.goto('/sre/incidents/checkout-latency')
  expect(navigationResponse?.status()).toBe(200)
  expect(navigationResponse?.headers()['content-type']).toContain('text/html')

  const artifact = page.frameLocator('iframe[title="Checkout latency incident review"]')
  await expect(artifact.getByRole('heading', { name: 'Summary' })).toBeVisible()
  expect((await stylesheetResponse).status()).toBe(200)
  await expect(artifact.locator('body')).toHaveCSS('color', 'rgb(31, 41, 55)')

  const breadcrumb = page.getByRole('navigation', { name: 'Artifact path' })
  await expect(breadcrumb).toContainText('incidents')
  await expect(breadcrumb).not.toContainText('SRE')

  await page.getByRole('button', { name: 'Contents', exact: true }).click()
  const contents = page.getByRole('complementary', { name: 'Contents' })
  await contents.getByRole('button', { name: 'Root cause' }).click()
  await expect(page).toHaveURL(/#root-cause$/)

  await page.reload()
  await expect(artifact.getByRole('heading', { name: 'Summary' })).toBeVisible()
  await expect(page).toHaveURL(/\/sre\/incidents\/checkout-latency#root-cause$/)
})

test('the collapsed rail searches artifacts and switches sites', async ({ page }) => {
  const frontendIndex = page.waitForResponse((response) => {
    return new URL(response.url()).pathname === '/_indexes/frontend.json'
  })

  await page.goto('/sre/incidents/checkout-latency')
  await frontendIndex

  await page.getByRole('button', { name: 'Collapse sidebar' }).click()
  await expect(page.getByRole('button', { name: 'Expand navigation' })).toBeVisible()

  await page.getByRole('button', { name: 'Switch to dark theme' }).click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await page.getByRole('button', { name: 'Switch to light theme' }).click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')

  await page.getByRole('button', { name: 'Search artifacts and pages' }).click()
  const palette = page.getByRole('dialog', { name: 'Command palette' })
  const search = palette.getByRole('textbox', { name: 'Search artifacts, sites, commands, and headings' })
  await search.fill('Platform topology')
  await palette.getByRole('option', { name: /Platform topology/ }).click()

  await expect(page).toHaveURL(/\/sre\/architecture\/platform-topology$/)
  await expect(page.getByRole('button', { name: 'Expand navigation' })).toBeVisible()
  await expect(page.getByRole('navigation', { name: 'Artifact path' })).not.toContainText('SRE')

  await page.getByRole('button', { name: 'Switch site. Current site: SRE' }).click()
  const sitePalette = page.getByRole('dialog', { name: 'Command palette' })
  await expect(sitePalette.getByRole('textbox', { name: 'Search artifacts, sites, commands, and headings' })).toHaveValue('@')
  await sitePalette.getByRole('option', { name: /Frontend/ }).click()

  await expect(page).toHaveURL(/\/frontend$/)
  await expect(page.getByRole('heading', { name: 'Frontend', exact: true })).toBeVisible()
})
