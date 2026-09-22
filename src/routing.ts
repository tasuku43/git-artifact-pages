export type AppRoute =
  | { kind: 'sites' }
  | { kind: 'site'; siteId: string; artifactPath?: string }

function decodeSegment(segment: string) {
  try {
    return decodeURIComponent(segment)
  } catch {
    return segment
  }
}

export function parseRoute(pathname: string): AppRoute {
  const segments = pathname.split('/').filter(Boolean).map(decodeSegment)

  if (segments.length === 0) {
    return { kind: 'sites' }
  }

  const [siteId, ...artifactSegments] = segments
  return {
    kind: 'site',
    siteId,
    artifactPath: artifactSegments.length > 0 ? artifactSegments.join('/') : undefined,
  }
}

export function artifactRouteHref(siteId: string, artifactPath: string) {
  const encodedPath = artifactPath
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/')
  return `/${encodeURIComponent(siteId)}/${encodedPath}`
}
