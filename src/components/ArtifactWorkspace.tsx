import { useCallback, useEffect, useRef, useState } from 'react'
import { CommandPalette, type PaletteCommand } from './CommandPalette'
import { Icon } from './Icon'
import { Sidebar } from './Sidebar'
import { SiteHome } from './SiteHome'
import type { TreeStyle } from './ArtifactTree'
import type { ArtifactIndexEntry, SiteIndex, SiteSummary } from '../domain/index'
import { artifactRouteHref, type AppRoute } from '../routing'

type SiteRoute = Extract<AppRoute, { kind: 'site' }>

export function ArtifactWorkspace({
  route,
  pathname,
  hash,
  catalog,
  catalogLoading,
  navigate,
  theme,
  onToggleTheme,
  index,
  sidebarTreeStyle = 'branch-guides',
  siteHomeTreeStyle = 'path-list',
  initialExpandedPaths = [],
}: {
  route: SiteRoute
  pathname: string
  hash: string
  catalog: SiteIndex[]
  catalogLoading: boolean
  navigate: (href: string) => void
  theme: 'light' | 'dark'
  onToggleTheme: () => void
  index: SiteIndex
  sidebarTreeStyle?: TreeStyle
  siteHomeTreeStyle?: TreeStyle
  initialExpandedPaths?: string[]
}) {
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [tocOpen, setTocOpen] = useState(false)
  const [paletteSeed, setPaletteSeed] = useState<string | null>(null)
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(
    () => new Set([...folderAncestors(route.artifactPath), ...initialExpandedPaths]),
  )
  const [toast, setToast] = useState<string | null>(null)
  const toastTimer = useRef<number | undefined>(undefined)
  const paletteReturnFocus = useRef<HTMLElement | null>(null)
  const currentArtifact = route.artifactPath
    ? findArtifact(index, route.artifactPath)
    : undefined
  const hasContents = Boolean(currentArtifact?.toc?.length)

  const updateExpandedPaths = useCallback((update: (current: Set<string>) => Set<string>) => {
    setExpandedPaths(update)
  }, [])

  const openPalette = useCallback((seed: string) => {
    const activeElement = document.activeElement
    paletteReturnFocus.current = activeElement instanceof HTMLElement && activeElement !== document.body
      ? activeElement
      : null
    setPaletteSeed(seed)
  }, [])

  const closePalette = useCallback(() => {
    setPaletteSeed(null)
    window.requestAnimationFrame(() => {
      const target = paletteReturnFocus.current
      if (target?.isConnected) target.focus()
      else document.getElementById('sidebar-toggle-trigger')?.focus()
    })
  }, [])

  useEffect(() => () => window.clearTimeout(toastTimer.current), [])

  useEffect(() => {
    setTocOpen(false)
  }, [route.artifactPath])

  useEffect(() => {
    if (paletteSeed === null) return
    const handleKeyDown = (event: KeyboardEvent) => {
      const modifier = event.metaKey || event.ctrlKey
      const key = event.key.toLocaleLowerCase()

      if (modifier && key === 'k') {
        event.preventDefault()
        closePalette()
      } else if (modifier && key === 'b') {
        event.preventDefault()
        setSidebarOpen((current) => !current)
      } else if (modifier && event.shiftKey && key === 'o') {
        event.preventDefault()
        setTocOpen((current) => !current)
      } else if (event.key === 'Escape') {
        setPaletteSeed(null)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [paletteSeed, closePalette])

  useEffect(() => {
    if (paletteSeed !== null) return
    const handleKeyDown = (event: KeyboardEvent) => {
      const modifier = event.metaKey || event.ctrlKey
      const key = event.key.toLocaleLowerCase()

      if (modifier && key === 'k') {
        event.preventDefault()
        openPalette('')
      } else if (modifier && key === 'b') {
        event.preventDefault()
        setSidebarOpen((current) => !current)
      } else if (modifier && event.shiftKey && key === 'o' && hasContents) {
        event.preventDefault()
        setTocOpen((current) => !current)
      } else if (event.key === 'Escape' && tocOpen) {
        setTocOpen(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [paletteSeed, hasContents, tocOpen, openPalette])

  const sites: SiteSummary[] = catalog.length
    ? catalog.map(({ site }) => site).sort((left, right) => left.title.localeCompare(right.title))
    : [index.site]
  const paletteIndexes = catalog.length
    ? [index, ...catalog.filter((other) => other.site.id !== index.site.id)]
    : [index]
  const commands: PaletteCommand[] = [
    { title: 'Toggle sidebar', shortcut: '⌘ B', onSelect: () => setSidebarOpen((current) => !current) },
    {
      title: 'Toggle contents',
      shortcut: '⌘ ⇧ O',
      available: hasContents,
      onSelect: () => setTocOpen((current) => !current),
    },
    { title: 'Go to site home', onSelect: () => navigate(`/${encodeURIComponent(index.site.id)}`) },
    { title: 'Switch theme', onSelect: onToggleTheme },
    {
      title: 'Copy artifact link',
      available: Boolean(currentArtifact),
      onSelect: () => void copyCurrentLink(showToast),
    },
    {
      title: 'Open raw artifact',
      available: Boolean(currentArtifact),
      onSelect: () => {
        if (currentArtifact) window.open(currentArtifact.artifactUrl, '_blank', 'noopener,noreferrer')
      },
    },
  ]

  function showToast(message: string) {
    setToast(message)
    window.clearTimeout(toastTimer.current)
    toastTimer.current = window.setTimeout(() => setToast(null), 1900)
  }

  function openArtifact(artifact: ArtifactIndexEntry) {
    navigate(artifactRouteHref(index.site.id, artifact.path))
    setTocOpen(false)
    setPaletteSeed(null)
    setSidebarOpen(window.innerWidth > 860)
  }

  function openFolder(path: string) {
    setExpandedPaths((current) => new Set([...current, path]))
    setSidebarOpen(true)
  }

  function jumpToHeading(id: string) {
    navigate(`${pathname}#${encodeURIComponent(id)}`)
    setPaletteSeed(null)
    setTocOpen(false)
  }

  const tocEntries = currentArtifact?.toc ?? []
  const artifactSegments = currentArtifact?.path.split('/').filter(Boolean)
    ?? route.artifactPath?.split('/').filter(Boolean)
    ?? []
  const iframeSrc = currentArtifact ? `${currentArtifact.artifactUrl}${hash}` : undefined

  return (
    <div className={`app-shell${sidebarOpen ? '' : ' sidebar-collapsed'}`}>
      <Sidebar
        index={index}
        sites={sites}
        artifactPath={currentArtifact?.path}
        expandedPaths={expandedPaths}
        onExpandedPathsChange={updateExpandedPaths}
        onOpenPalette={openPalette}
        onOpenArtifact={openArtifact}
        onToggleTheme={onToggleTheme}
        theme={theme}
        onClose={() => setSidebarOpen(false)}
        treeStyle={sidebarTreeStyle}
      />
      {sidebarOpen ? <button className="sidebar-backdrop" aria-label="Close navigation" onClick={() => setSidebarOpen(false)} /> : null}

      <div className="workspace">
        <div className="workspace-panel">
          <header className="context-bar">
            <div className="context-leading">
              <button
                className={`icon-button${sidebarOpen ? ' is-active' : ''}`}
                id="sidebar-toggle-trigger"
                title="Toggle sidebar (⌘ B)"
                aria-label="Toggle sidebar"
                aria-pressed={sidebarOpen}
                onClick={() => setSidebarOpen((current) => !current)}
              >
                <Icon name="sidebar" size={16} />
              </button>
            </div>

            <nav className="breadcrumbs" aria-label="Breadcrumb">
              <button onClick={() => navigate(`/${encodeURIComponent(index.site.id)}`)}>{index.site.id}</button>
              {artifactSegments.map((segment, segmentIndex) => {
                const isCurrent = segmentIndex === artifactSegments.length - 1
                const folderPath = artifactSegments.slice(0, segmentIndex + 1).join('/')
                return (
                  <span className="breadcrumb-part" key={`${folderPath}:${segmentIndex}`}>
                    <span className="breadcrumb-separator" aria-hidden="true">/</span>
                    {isCurrent ? (
                      <span className="breadcrumb-current" aria-current="page">{segment}</span>
                    ) : (
                      <button onClick={() => openFolder(folderPath)}>{segment}</button>
                    )}
                  </span>
                )
              })}
            </nav>

            {currentArtifact ? (
              <div className="artifact-stamp">
                <time dateTime={currentArtifact.updatedAt}>{formatDate(currentArtifact.updatedAt)}</time>
                {currentArtifact.source ? (
                  <span className="artifact-source">
                    {currentArtifact.source.repository}<span aria-hidden="true">·</span>{currentArtifact.source.ref}
                  </span>
                ) : null}
              </div>
            ) : null}

            <div className="context-actions">
              <button
                className={`context-button${tocOpen ? ' is-active' : ''}`}
                disabled={!currentArtifact || tocEntries.length === 0}
                aria-pressed={tocOpen}
                title={tocEntries.length ? 'Contents (⌘ ⇧ O)' : 'No indexed contents for this artifact'}
                onClick={() => setTocOpen((current) => !current)}
              >
                <Icon name="contents" size={14} />
                <span>Contents</span>
              </button>
              <span className="action-divider" />
              <button
                className="icon-button"
                title="Copy link"
                aria-label="Copy artifact link"
                disabled={!currentArtifact}
                onClick={() => void copyCurrentLink(showToast)}
              >
                <Icon name="copy" size={15} />
              </button>
              <a
                className={`icon-button${currentArtifact ? '' : ' is-disabled'}`}
                title="Open raw artifact"
                aria-label="Open raw artifact"
                aria-disabled={!currentArtifact}
                href={currentArtifact?.artifactUrl ?? '#'}
                target="_blank"
                rel="noreferrer"
                onClick={(event) => {
                  if (!currentArtifact) event.preventDefault()
                }}
              >
                <Icon name="external" size={15} />
              </a>
            </div>
          </header>

          <main className={`stage${currentArtifact ? ' has-artifact' : ''}`}>
            {currentArtifact && iframeSrc ? (
              <iframe
                className="artifact-frame"
                key={currentArtifact.artifactUrl}
                src={iframeSrc}
                title={currentArtifact.title}
              />
            ) : route.artifactPath ? (
              <div className="stage-message">
                <p className="eyebrow">{index.site.title}</p>
                <h1>Artifact not found</h1>
                <p>No artifact matches <code>{route.artifactPath}</code>.</p>
                <button className="text-action" onClick={() => navigate(`/${encodeURIComponent(index.site.id)}`)}>
                  <Icon name="arrow" size={14} /> Back to site
                </button>
              </div>
            ) : (
              <SiteHome
                index={index}
                onOpenArtifact={navigate}
                treeStyle={siteHomeTreeStyle}
                defaultExpandedPaths={initialExpandedPaths}
              />
            )}

            {tocOpen && currentArtifact ? (
              <aside className="toc-panel" aria-label="Contents">
                <div className="toc-header">
                  <span>Contents</span>
                  <button className="icon-button" aria-label="Close contents" onClick={() => setTocOpen(false)}>
                    <Icon name="close" size={14} />
                  </button>
                </div>
                {tocEntries.length === 0 ? (
                  <p className="toc-empty">This artifact does not include indexed headings.</p>
                ) : (
                  <nav className="toc-list" aria-label="Artifact headings">
                    {tocEntries.map((entry) => (
                      <button
                        className={`toc-link${entry.level >= 3 ? ' toc-level-3' : ''}`}
                        key={`${entry.id}:${entry.text}`}
                        onClick={() => jumpToHeading(entry.id)}
                      >
                        {entry.text}
                      </button>
                    ))}
                  </nav>
                )}
              </aside>
            ) : null}
          </main>
        </div>
      </div>

      {paletteSeed !== null ? (
        <CommandPalette
          seed={paletteSeed}
          indexes={paletteIndexes}
          currentIndex={index}
          currentArtifact={currentArtifact}
          commands={commands}
          loading={catalogLoading}
          onClose={closePalette}
          onNavigate={navigate}
          onJumpToHeading={jumpToHeading}
        />
      ) : null}

      {toast ? <div className="toast" role="status" aria-live="polite">{toast}</div> : null}
    </div>
  )
}

function findArtifact(index: SiteIndex, path: string) {
  return index.artifacts.find((artifact) => artifact.path === path || artifact.id === path)
}

function folderAncestors(path?: string) {
  if (!path) return []
  const segments = path.split('/').filter(Boolean).slice(0, -1)
  return segments.map((_, index) => segments.slice(0, index + 1).join('/'))
}

async function copyCurrentLink(showToast: (message: string) => void) {
  try {
    await navigator.clipboard.writeText(window.location.href)
    showToast('Link copied to clipboard.')
  } catch {
    showToast('Clipboard access is unavailable.')
  }
}

function formatDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.valueOf())) return value
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(date)
}
