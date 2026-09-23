import { expect, test, type Page } from '@playwright/test'

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

test('multi-file artifacts stay in their site namespace when relative asset paths overlap', async ({ page }) => {
  const artifactResponsePaths: string[] = []
  page.on('response', (response) => {
    const pathname = new URL(response.url()).pathname
    if (pathname.startsWith('/_artifacts/')) artifactResponsePaths.push(pathname)
  })

  const sreAssetPaths = artifactAssetPaths('sre', 'incidents/checkout-latency')
  const sreAssetResponses = waitForResponses(page, sreAssetPaths)
  const navigationResponse = await page.goto('/sre/incidents/checkout-latency')
  expect(navigationResponse?.status()).toBe(200)
  expect(navigationResponse?.headers()['content-type']).toContain('text/html')

  const iframe = page.locator('iframe[title="Checkout latency incident review"]')
  expect(await iframe.getAttribute('sandbox')).toBeNull()
  const artifact = page.frameLocator('iframe[title="Checkout latency incident review"]')
  await expect(artifact.getByRole('heading', { name: 'Summary' })).toBeVisible()
  await expect(artifact.getByRole('status')).toHaveText('SRE incident bundle loaded')
  await expect(artifact.locator('body')).toHaveAttribute('data-artifact-site', 'sre')
  await expect(artifact.locator('body')).toHaveCSS('color', 'rgb(31, 41, 55)')
  expect((await Promise.all(sreAssetResponses)).every((response) => response.status() === 200)).toBeTruthy()
  expect(artifactResponsePaths.length).toBeGreaterThanOrEqual(sreAssetPaths.length)
  expect(artifactResponsePaths.every((path) => path.startsWith('/_artifacts/sre/'))).toBeTruthy()
  await expect(page.locator('body')).toHaveCSS('color', 'rgb(17, 20, 22)')

  const breadcrumb = page.getByRole('navigation', { name: 'Artifact path' })
  await expect(breadcrumb).toContainText('incidents')
  await expect(breadcrumb).not.toContainText('SRE')

  await page.getByRole('button', { name: 'Contents', exact: true }).click()
  const contents = page.getByRole('complementary', { name: 'Contents' })
  await contents.getByRole('button', { name: 'Root cause' }).click()
  await expect(page).toHaveURL(/#root-cause$/)

  await page.reload()
  await expect(artifact.getByRole('heading', { name: 'Summary' })).toBeVisible()
  await expect(artifact.getByRole('status')).toHaveText('SRE incident bundle loaded')
  await expect(page).toHaveURL(/\/sre\/incidents\/checkout-latency#root-cause$/)

  const frontendPage = await page.context().newPage()
  const frontendResponsePaths: string[] = []
  frontendPage.on('response', (response) => {
    const pathname = new URL(response.url()).pathname
    if (pathname.startsWith('/_artifacts/')) frontendResponsePaths.push(pathname)
  })
  const frontendAssetPaths = artifactAssetPaths('frontend', 'design-system/button-guidelines')
  const frontendAssetResponses = waitForResponses(frontendPage, frontendAssetPaths)
  await frontendPage.goto('/frontend/design-system/button-guidelines')

  const frontend = frontendPage.frameLocator('iframe[title="Button guidelines"]')
  await expect(frontend.getByRole('heading', { name: 'Buttons' })).toBeVisible()
  await expect(frontend.getByRole('status')).toHaveText('Frontend guideline bundle loaded')
  await expect(frontend.locator('body')).toHaveAttribute('data-artifact-site', 'frontend')
  await expect(frontend.locator('body')).toHaveCSS('color', 'rgb(76, 29, 149)')
  expect((await Promise.all(frontendAssetResponses)).every((response) => response.status() === 200)).toBeTruthy()
  expect(frontendResponsePaths.length).toBeGreaterThanOrEqual(frontendAssetPaths.length)
  expect(frontendResponsePaths.every((path) => path.startsWith('/_artifacts/frontend/'))).toBeTruthy()
  await expect(frontendPage.locator('body')).toHaveCSS('color', 'rgb(17, 20, 22)')

  const missingAsset = await frontendPage.request.get('/_artifacts/frontend/design-system/button-guidelines/assets/data/missing.json')
  expect(missingAsset.status()).toBe(404)
  await frontendPage.close()
})

function artifactAssetPaths(siteId: string, artifactPath: string) {
  const root = `/_artifacts/${siteId}/${artifactPath}/assets`
  return [
    `${root}/css/styles.css`,
    `${root}/css/tokens.css`,
    `${root}/images/brand-mark.svg`,
    `${root}/js/main.js`,
    `${root}/js/modules/hydrate.js`,
    `${root}/data/details.json`,
  ]
}

function waitForResponses(page: Page, paths: string[]) {
  return paths.map((pathname) => page.waitForResponse((response) => {
    return new URL(response.url()).pathname === pathname
  }))
}

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
