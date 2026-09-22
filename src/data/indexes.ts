import type { SiteIndex, SiteSummary } from '../domain/index'

const INDEX_ROOT = '/_indexes'
const SITE_ID_PATTERN = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/

export class IndexLoadError extends Error {
  constructor(
    message: string,
    readonly url: string,
    options?: ErrorOptions,
  ) {
    super(message, options)
    this.name = 'IndexLoadError'
  }
}

type Fetcher = typeof fetch

async function fetchText(url: string, fetcher: Fetcher): Promise<string> {
  let response: Response

  try {
    response = await fetcher(url)
  } catch (error) {
    throw new IndexLoadError(`Could not fetch ${url}.`, url, { cause: error })
  }

  if (!response.ok) {
    throw new IndexLoadError(`Request failed with status ${response.status}: ${url}.`, url)
  }

  return response.text()
}

function extractSiteIds(directoryListing: string): string[] {
  const document = new DOMParser().parseFromString(directoryListing, 'text/html')
  const siteIds = Array.from(document.querySelectorAll('a[href]'))
    .map((anchor) => anchor.getAttribute('href') ?? '')
    .map((href) => href.split(/[?#]/, 1)[0])
    .map((href) => href.split('/').filter(Boolean).at(-1) ?? '')
    .filter((filename) => filename.endsWith('.json'))
    .map((filename) => decodeURIComponent(filename.slice(0, -'.json'.length)))
    .filter((siteId) => siteId !== 'sites' && SITE_ID_PATTERN.test(siteId))

  return [...new Set(siteIds)].sort()
}

function parseSiteIndex(payload: unknown, url: string): SiteIndex {
  if (!payload || typeof payload !== 'object') {
    throw new IndexLoadError(`Invalid site index data: ${url}.`, url)
  }

  const index = payload as Partial<SiteIndex>
  if (
    typeof index.schemaVersion !== 'number' ||
    !index.site ||
    typeof index.site.id !== 'string' ||
    typeof index.site.title !== 'string' ||
    typeof index.generatedAt !== 'string' ||
    !Array.isArray(index.artifacts)
  ) {
    throw new IndexLoadError(`Invalid site index data: ${url}.`, url)
  }

  return index as SiteIndex
}

export async function loadSiteIndex(
  siteId: string,
  fetcher: Fetcher = fetch,
): Promise<SiteIndex> {
  if (!SITE_ID_PATTERN.test(siteId)) {
    throw new IndexLoadError(`Invalid site id: ${siteId}.`, `${INDEX_ROOT}/${siteId}.json`)
  }

  const url = `${INDEX_ROOT}/${encodeURIComponent(siteId)}.json`
  let payload: unknown

  try {
    const response = await fetcher(url)
    if (!response.ok) {
      throw new IndexLoadError(`Request failed with status ${response.status}: ${url}.`, url)
    }
    payload = await response.json()
  } catch (error) {
    if (error instanceof IndexLoadError) {
      throw error
    }
    throw new IndexLoadError(`Could not fetch ${url}.`, url, { cause: error })
  }

  return parseSiteIndex(payload, url)
}

export async function discoverSites(fetcher: Fetcher = fetch): Promise<SiteSummary[]> {
  const directoryListing = await fetchText(`${INDEX_ROOT}/`, fetcher)
  const siteIds = extractSiteIds(directoryListing)
  const indexes = await Promise.all(siteIds.map((siteId) => loadSiteIndex(siteId, fetcher)))

  return indexes
    .map(({ site }) => site)
    .sort((left, right) => left.title.localeCompare(right.title))
}
