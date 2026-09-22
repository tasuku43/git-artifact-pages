import { useEffect, useState } from 'react'
import { discoverSites, IndexLoadError, loadSiteIndex } from './data/indexes'
import type { ArtifactIndexEntry, SiteIndex, SiteSummary } from './domain/index'
import { artifactRouteHref, parseRoute, type AppRoute } from './routing'

type LoadingState<T> =
  | { status: 'loading' }
  | { status: 'success'; data: T }
  | { status: 'error'; error: Error }

function useRoute() {
  const [pathname, setPathname] = useState(() => window.location.pathname)

  useEffect(() => {
    const handlePopState = () => setPathname(window.location.pathname)
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  return parseRoute(pathname)
}

function App() {
  const route = useRoute()

  if (route.kind === 'sites') {
    return <SitesPage />
  }

  return <SitePage route={route} />
}

function SitesPage() {
  const [state, setState] = useState<LoadingState<SiteSummary[]>>({ status: 'loading' })

  useEffect(() => {
    let cancelled = false
    setState({ status: 'loading' })

    discoverSites().then(
      (sites) => {
        if (!cancelled) setState({ status: 'success', data: sites })
      },
      (error: unknown) => {
        if (!cancelled) setState({ status: 'error', error: toError(error) })
      },
    )

    return () => {
      cancelled = true
    }
  }, [])

  if (state.status === 'loading') {
    return <StatusPage title="Sites" message="Loading sites…" />
  }

  if (state.status === 'error') {
    return <ErrorPage title="Sites" error={state.error} />
  }

  return (
    <PageFrame eyebrow="Git Artifact Pages" title="Sites">
      {state.data.length === 0 ? (
        <p>No site indexes were found.</p>
      ) : (
        <ul className="route-list">
          {state.data.map((site) => (
            <li key={site.id}>
              <a href={`/${encodeURIComponent(site.id)}`}>{site.title}</a>
              <code>{site.id}</code>
            </li>
          ))}
        </ul>
      )}
    </PageFrame>
  )
}

function SitePage({ route }: { route: Extract<AppRoute, { kind: 'site' }> }) {
  const [state, setState] = useState<LoadingState<SiteIndex>>({ status: 'loading' })

  useEffect(() => {
    let cancelled = false
    setState({ status: 'loading' })

    loadSiteIndex(route.siteId).then(
      (index) => {
        if (!cancelled) setState({ status: 'success', data: index })
      },
      (error: unknown) => {
        if (!cancelled) setState({ status: 'error', error: toError(error) })
      },
    )

    return () => {
      cancelled = true
    }
  }, [route.siteId])

  if (state.status === 'loading') {
    return <StatusPage title={route.siteId} message="Loading site index…" />
  }

  if (state.status === 'error') {
    return <ErrorPage title={route.siteId} error={state.error} />
  }

  const artifact = route.artifactPath
    ? findArtifact(state.data, route.artifactPath)
    : undefined

  if (route.artifactPath && !artifact) {
    return (
      <PageFrame eyebrow={state.data.site.title} title="Artifact not found">
        <p>
          No artifact matches <code>{route.artifactPath}</code>.
        </p>
        <BackToSite siteId={state.data.site.id} />
      </PageFrame>
    )
  }

  return (
    <PageFrame eyebrow={state.data.site.title} title={artifact?.title ?? state.data.site.title}>
      <p>
        {artifact ? 'Artifact route resolved.' : `${state.data.artifacts.length} artifact(s) indexed.`}
      </p>

      {artifact ? (
        <ArtifactResolution artifact={artifact} />
      ) : (
        <ul className="route-list">
          {state.data.artifacts.map((item) => (
            <li key={item.id}>
              <a href={artifactRouteHref(state.data.site.id, item.path)}>{item.title}</a>
              <code>{item.path}</code>
            </li>
          ))}
        </ul>
      )}

      <BackToSites />
    </PageFrame>
  )
}

function ArtifactResolution({ artifact }: { artifact: ArtifactIndexEntry }) {
  return (
    <dl className="metadata">
      <dt>Logical path</dt>
      <dd>
        <code>{artifact.path}</code>
      </dd>
      <dt>Artifact URL</dt>
      <dd>
        <a href={artifact.artifactUrl}>{artifact.artifactUrl}</a>
      </dd>
      <dt>Updated</dt>
      <dd>{artifact.updatedAt}</dd>
    </dl>
  )
}

function BackToSites() {
  return (
    <p className="navigation-link">
      <a href="/">← All sites</a>
    </p>
  )
}

function BackToSite({ siteId }: { siteId: string }) {
  return (
    <p className="navigation-link">
      <a href={`/${encodeURIComponent(siteId)}`}>← Back to site</a>
    </p>
  )
}

function PageFrame({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string
  title: string
  children: React.ReactNode
}) {
  return (
    <main className="app-shell">
      <section className="app-content">
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        {children}
      </section>
    </main>
  )
}

function StatusPage({ title, message }: { title: string; message: string }) {
  return (
    <PageFrame eyebrow="Git Artifact Pages" title={title}>
      <p role="status">{message}</p>
    </PageFrame>
  )
}

function ErrorPage({ title, error }: { title: string; error: Error }) {
  return (
    <PageFrame eyebrow="Git Artifact Pages" title={title}>
      <p className="error-message" role="alert">
        {error instanceof IndexLoadError ? error.message : 'Something went wrong while loading this page.'}
      </p>
      <BackToSites />
    </PageFrame>
  )
}

function findArtifact(index: SiteIndex, path: string) {
  return index.artifacts.find((artifact) => artifact.path === path || artifact.id === path)
}

function toError(error: unknown) {
  return error instanceof Error ? error : new Error(String(error))
}

export default App
