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
  const sreDocumentResponse = page.waitForResponse((response) => {
    return new URL(response.url()).pathname === '/_artifacts/sre/incidents/checkout-latency/index.html'
  })
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
  const sreCsp = (await sreDocumentResponse).headers()['content-security-policy']
  expect(sreCsp).toContain('/_artifacts/sre/')
  expect(sreCsp).not.toContain("'self'")
  expect(sreCsp).not.toContain('/_artifacts/frontend/')
  expect((await Promise.all(sreAssetResponses)).every((response) => response.status() === 200)).toBeTruthy()
  expect(artifactResponsePaths.length).toBeGreaterThanOrEqual(sreAssetPaths.length)
  expect(artifactResponsePaths.every((path) => path.startsWith('/_artifacts/sre/'))).toBeTruthy()
  await expect(page.locator('body')).toHaveCSS('color', 'rgb(17, 20, 22)')

  const crossSiteFetch = await artifact.locator('body').evaluate(async () => {
    try {
      const response = await fetch('/_artifacts/frontend/design-system/button-guidelines/assets/data/details.json')
      return response.status
    } catch {
      return 'blocked'
    }
  })
  expect(crossSiteFetch).toBe('blocked')

  const crossSiteStylesheet = await artifact.locator('body').evaluate((body) => new Promise<string>((resolve) => {
    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = '/_artifacts/frontend/design-system/button-guidelines/assets/css/styles.css'
    link.onload = () => resolve('loaded')
    link.onerror = () => resolve('blocked')
    body.ownerDocument.head.append(link)
  }))
  expect(crossSiteStylesheet).toBe('blocked')

  const crossSiteScript = await artifact.locator('body').evaluate((body) => new Promise<string>((resolve) => {
    const script = document.createElement('script')
    script.type = 'module'
    script.src = '/_artifacts/frontend/design-system/button-guidelines/assets/js/main.js'
    script.onload = () => resolve('loaded')
    script.onerror = () => resolve('blocked')
    body.ownerDocument.head.append(script)
  }))
  expect(crossSiteScript).toBe('blocked')
  await expect(artifact.locator('body')).toHaveAttribute('data-artifact-site', 'sre')
  expect(artifactResponsePaths.every((path) => path.startsWith('/_artifacts/sre/'))).toBeTruthy()

  const breadcrumb = page.getByRole('navigation', { name: 'Artifact path' })
  await expect(breadcrumb).toContainText('incidents')
  await expect(breadcrumb).not.toContainText('SRE')

  const header = page.locator('.context-bar')
  await expect(header).not.toContainText('Sep 22, 2026')
  await expect(header).not.toContainText('example/payments')
  const detailsButton = page.getByRole('button', { name: 'Details', exact: true })
  await expect(detailsButton).toHaveAttribute('aria-pressed', 'false')
  await detailsButton.click()
  const details = page.getByRole('complementary', { name: 'Details' })
  await expect(details).toBeVisible()
  await expect(details.getByRole('link', { name: '@maya-chen on GitHub' })).toHaveAttribute(
    'href',
    'https://github.com/maya-chen',
  )
  await expect(details.getByRole('link', { name: /example\/payments/ })).toHaveAttribute(
    'href',
    'https://github.com/example/payments',
  )
  await expect(details.getByText('Sep 22, 2026')).toBeVisible()

  await page.getByRole('button', { name: 'Contents', exact: true }).click()
  await expect(details).toBeHidden()
  await expect(page.getByRole('button', { name: 'Contents', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await page.getByRole('button', { name: 'Contents', exact: true }).click()
  await expect(page.getByRole('complementary', { name: 'Contents' })).toBeHidden()
  await detailsButton.click()
  await expect(details).toBeVisible()
  await detailsButton.click()
  await expect(details).toBeHidden()

  await page.getByRole('button', { name: 'Contents', exact: true }).click()
  const contents = page.getByRole('complementary', { name: 'Contents' })
  await expect(contents).toBeVisible()
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
  const frontendDocumentResponse = frontendPage.waitForResponse((response) => {
    return new URL(response.url()).pathname === '/_artifacts/frontend/design-system/button-guidelines/index.html'
  })
  await frontendPage.goto('/frontend/design-system/button-guidelines')

  const frontend = frontendPage.frameLocator('iframe[title="Button guidelines"]')
  await expect(frontend.getByRole('heading', { name: 'Buttons' })).toBeVisible()
  await expect(frontend.getByRole('status')).toHaveText('Frontend guideline bundle loaded')
  await expect(frontend.locator('body')).toHaveAttribute('data-artifact-site', 'frontend')
  await expect(frontend.locator('body')).toHaveCSS('color', 'rgb(76, 29, 149)')
  const frontendCsp = (await frontendDocumentResponse).headers()['content-security-policy']
  expect(frontendCsp).toContain('/_artifacts/frontend/')
  expect(frontendCsp).not.toContain("'self'")
  expect(frontendCsp).not.toContain('/_artifacts/sre/')
  expect((await Promise.all(frontendAssetResponses)).every((response) => response.status() === 200)).toBeTruthy()
  expect(frontendResponsePaths.length).toBeGreaterThanOrEqual(frontendAssetPaths.length)
  expect(frontendResponsePaths.every((path) => path.startsWith('/_artifacts/frontend/'))).toBeTruthy()
  await expect(frontendPage.locator('body')).toHaveCSS('color', 'rgb(17, 20, 22)')

  let externalRequestReachedServer = false
  await frontendPage.route('https://example.invalid/**', async (route) => {
    externalRequestReachedServer = true
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: { 'access-control-allow-origin': '*' },
      body: '{}',
    })
  })
  const externalFetch = await frontend.locator('body').evaluate(async () => {
    try {
      await fetch('https://example.invalid/data.json')
      return 'loaded'
    } catch {
      return 'blocked'
    }
  })
  expect(externalFetch).toBe('blocked')
  expect(externalRequestReachedServer).toBeFalsy()

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
