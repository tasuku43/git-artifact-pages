import { useCallback, useEffect, useRef, useState } from 'react'
import { CommandPalette, type PaletteCommand } from './CommandPalette'
import { Icon } from './Icon'
import { Sidebar } from './Sidebar'
import { SiteHome } from './SiteHome'
import type { TreeStyle } from './ArtifactTree'
import type { ArtifactIndexEntry, SiteIndex, SiteSummary } from '../domain/index'
import { artifactRouteHref, type AppRoute } from '../routing'

type SiteRoute = Extract<AppRoute, { kind: 'site' }>
type WorkspacePanel = 'contents' | 'details' | null

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
  initialSidebarOpen = true,
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
  initialSidebarOpen?: boolean
}) {
  const [sidebarOpen, setSidebarOpen] = useState(initialSidebarOpen)
  const sidebarOpenRef = useRef(initialSidebarOpen)
  const [activePanel, setActivePanel] = useState<WorkspacePanel>(null)
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
  const tocOpen = activePanel === 'contents'
  const detailsOpen = activePanel === 'details'

  const togglePanel = useCallback((panel: Exclude<WorkspacePanel, null>) => {
    setActivePanel((current) => current === panel ? null : panel)
  }, [])

  const updateExpandedPaths = useCallback((update: (current: Set<string>) => Set<string>) => {
    setExpandedPaths(update)
  }, [])

  const updateSidebarOpen = useCallback((open: boolean, restoreFocus = false) => {
    sidebarOpenRef.current = open
    setSidebarOpen(open)
    if (restoreFocus) {
      window.requestAnimationFrame(() => {
        document.getElementById(open ? 'site-switcher' : 'sidebar-toggle-trigger')?.focus()
      })
    }
  }, [])

  const toggleSidebar = useCallback((restoreFocus = false) => {
    updateSidebarOpen(!sidebarOpenRef.current, restoreFocus)
  }, [updateSidebarOpen])

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
      if (target?.isConnected && target.getClientRects().length > 0) target.focus()
      else document.getElementById('sidebar-toggle-trigger')?.focus()
    })
  }, [])

  useEffect(() => () => window.clearTimeout(toastTimer.current), [])

  useEffect(() => {
    updateSidebarOpen(initialSidebarOpen)
  }, [initialSidebarOpen, updateSidebarOpen])

  useEffect(() => {
    setActivePanel(null)
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
        toggleSidebar()
      } else if (modifier && event.shiftKey && key === 'o') {
        event.preventDefault()
        togglePanel('contents')
      } else if (event.key === 'Escape') {
        setPaletteSeed(null)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [paletteSeed, closePalette, toggleSidebar, togglePanel])

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
        toggleSidebar(true)
      } else if (modifier && event.shiftKey && key === 'o' && hasContents) {
        event.preventDefault()
        togglePanel('contents')
      } else if (event.key === 'Escape' && activePanel !== null) {
        setActivePanel(null)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [paletteSeed, hasContents, activePanel, openPalette, toggleSidebar, togglePanel])

  const sites: SiteSummary[] = catalog.length
    ? catalog.map(({ site }) => site).sort((left, right) => left.title.localeCompare(right.title))
    : [index.site]
  const paletteIndexes = catalog.length
    ? [index, ...catalog.filter((other) => other.site.id !== index.site.id)]
    : [index]
  const commands: PaletteCommand[] = [
    { title: 'Toggle sidebar', shortcut: '⌘ B', onSelect: () => toggleSidebar() },
    {
      title: 'Toggle contents',
      shortcut: '⌘ ⇧ O',
      available: hasContents,
      onSelect: () => togglePanel('contents'),
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
    setActivePanel(null)
    setPaletteSeed(null)
    if (window.innerWidth <= 860) updateSidebarOpen(false)
  }

  function openFolder(path: string) {
    setExpandedPaths((current) => new Set([...current, path]))
    updateSidebarOpen(true)
  }

  function jumpToHeading(id: string) {
    navigate(`${pathname}#${encodeURIComponent(id)}`)
    setPaletteSeed(null)
    setActivePanel(null)
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
        id="workspace-sidebar"
        sites={sites}
        artifactPath={currentArtifact?.path}
        expandedPaths={expandedPaths}
        onExpandedPathsChange={updateExpandedPaths}
        onOpenPalette={openPalette}
        onOpenArtifact={openArtifact}
        onToggleTheme={onToggleTheme}
        theme={theme}
        onCollapse={() => updateSidebarOpen(false, true)}
        treeStyle={sidebarTreeStyle}
      />
      {sidebarOpen ? <button className="sidebar-backdrop" aria-label="Close navigation" onClick={() => updateSidebarOpen(false, true)} /> : null}
      {!sidebarOpen ? (
        <aside className="collapsed-rail" aria-label={`${index.site.title} navigation`}>
          <div className="collapsed-rail-group">
            <button
              className="collapsed-rail-button collapsed-rail-button-primary"
              id="sidebar-toggle-trigger"
              title="Expand navigation (⌘ B)"
              aria-label="Expand navigation"
              aria-controls="workspace-sidebar"
              aria-expanded="false"
              onClick={() => updateSidebarOpen(true, true)}
            >
              <Icon name="sidebar" size={17} />
            </button>
            <button
              className="collapsed-rail-button collapsed-rail-site-button"
              title={`Switch site: ${index.site.title}`}
              aria-label={`Switch site. Current site: ${index.site.title}`}
              onClick={(event) => {
                event.currentTarget.focus()
                openPalette('@')
              }}
            >
              <span className="site-mark">{index.site.title.slice(0, 1).toUpperCase()}</span>
            </button>
            <button
              className="collapsed-rail-button"
              title="Search artifacts and pages (⌘ K)"
              aria-label="Search artifacts and pages"
              aria-keyshortcuts="Meta+K Control+K"
              onClick={(event) => {
                event.currentTarget.focus()
                openPalette('')
              }}
            >
              <Icon name="search" size={17} />
            </button>
          </div>
          <div className="collapsed-rail-spacer" />
          <div className="collapsed-rail-group">
            <button
              className="collapsed-rail-button"
              title={`Switch to ${theme === 'light' ? 'dark' : 'light'} theme`}
              aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} theme`}
              onClick={onToggleTheme}
            >
              <Icon name={theme === 'light' ? 'moon' : 'sun'} size={16} />
            </button>
          </div>
        </aside>
      ) : null}

      <div className="workspace">
        <div className="workspace-panel">
          <header className="context-bar">
            <nav className="breadcrumbs" aria-label="Artifact path">
              {artifactSegments.map((segment, segmentIndex) => {
                const isCurrent = segmentIndex === artifactSegments.length - 1
                const folderPath = artifactSegments.slice(0, segmentIndex + 1).join('/')
                return (
                  <span className="breadcrumb-part" key={`${folderPath}:${segmentIndex}`}>
                    {segmentIndex > 0 ? <span className="breadcrumb-separator" aria-hidden="true">/</span> : null}
                    {isCurrent ? (
                      <span className="breadcrumb-current" aria-current="page">{segment}</span>
                    ) : (
                      <button onClick={() => openFolder(folderPath)}>{segment}</button>
                    )}
                  </span>
                )
              })}
            </nav>

            <div className="context-actions">
              <button
                className={`context-button${tocOpen ? ' is-active' : ''}`}
                disabled={!currentArtifact || tocEntries.length === 0}
                aria-pressed={tocOpen}
                title={tocEntries.length ? 'Contents (⌘ ⇧ O)' : 'No indexed contents for this artifact'}
                onClick={() => togglePanel('contents')}
              >
                <Icon name="contents" size={14} />
                <span>Contents</span>
              </button>
              <button
                className={`context-button${detailsOpen ? ' is-active' : ''}`}
                disabled={!currentArtifact}
                aria-pressed={detailsOpen}
                title="Artifact details"
                onClick={() => togglePanel('details')}
              >
                <Icon name="info" size={14} />
                <span>Details</span>
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

            {activePanel && currentArtifact ? (
              <aside
                className="context-panel"
                aria-label={activePanel === 'contents' ? 'Contents' : 'Details'}
              >
                <div className="context-panel-header">
                  <span>{activePanel === 'contents' ? 'Contents' : 'Details'}</span>
                  <button
                    className="icon-button"
                    aria-label={`Close ${activePanel}`}
                    onClick={() => setActivePanel(null)}
                  >
                    <Icon name="close" size={14} />
                  </button>
                </div>
                {activePanel === 'contents' ? (
                  tocEntries.length === 0 ? (
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
                  )
                ) : (
                  <ArtifactDetails artifact={currentArtifact} />
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

function ArtifactDetails({ artifact }: { artifact: ArtifactIndexEntry }) {
  const authors = artifact.authors ?? []
  const repositoryUrl = safeHttpsUrl(artifact.source?.repositoryUrl)

  return (
    <div className="artifact-details">
      {authors.length > 0 ? (
        <section className="details-authors" aria-label={authors.length === 1 ? 'Author' : 'Authors'}>
          <p className="details-section-label">{authors.length === 1 ? 'Author' : 'Authors'}</p>
          <div className="details-author-list">
            {authors.map((author) => (
              <a
                className="details-author"
                href={`https://github.com/${encodeURIComponent(author.login)}`}
                key={`${author.provider}:${author.login}`}
                target="_blank"
                rel="noreferrer"
                aria-label={`@${author.login} on GitHub`}
              >
                <span className="details-avatar" aria-hidden="true">{author.login.slice(0, 1).toUpperCase()}</span>
                <span className="details-author-copy">
                  <span className="details-author-login">@{author.login}</span>
                  <span className="details-author-provider">GitHub</span>
                </span>
                <Icon name="external" size={12} />
              </a>
            ))}
          </div>
        </section>
      ) : null}

      <div className={`details-facts${authors.length > 0 ? ' has-authors' : ''}`}>
        <div className="details-fact">
          <span className="details-label">Updated</span>
          <time dateTime={artifact.updatedAt}>{formatLongDate(artifact.updatedAt)}</time>
        </div>
        {artifact.source ? (
          <div className="details-fact details-source-fact">
            <span className="details-label">Source</span>
            <div className="details-source-value">
              {repositoryUrl ? (
                <a className="details-source-link" href={repositoryUrl} target="_blank" rel="noreferrer">
                  <span>{artifact.source.repository}</span>
                  <Icon name="external" size={12} />
                </a>
              ) : (
                <span className="details-source-name">{artifact.source.repository}</span>
              )}
              <span className="details-source-ref">{artifact.source.ref}</span>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}

function safeHttpsUrl(value?: string) {
  if (!value) return undefined
  try {
    const url = new URL(value)
    return url.protocol === 'https:' ? url.href : undefined
  } catch {
    return undefined
  }
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

function formatLongDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.valueOf())) return value
  return new Intl.DateTimeFormat('en-US', { year: 'numeric', month: 'short', day: 'numeric' }).format(date)
}
