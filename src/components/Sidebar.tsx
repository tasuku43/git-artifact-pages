import { useEffect, useMemo, useState } from 'react'
import type { ArtifactIndexEntry, SiteIndex, SiteSummary } from '../domain/index'
import { buildArtifactTree, countArtifacts, flattenArtifacts, type ArtifactTreeNode } from '../domain/tree'
import { Icon } from './Icon'

export function Sidebar({
  index,
  sites,
  artifactPath,
  expandedPaths,
  onExpandedPathsChange,
  onOpenPalette,
  onOpenArtifact,
  onToggleTheme,
  theme,
  onClose,
}: {
  index: SiteIndex
  sites: SiteSummary[]
  artifactPath?: string
  expandedPaths: Set<string>
  onExpandedPathsChange: (update: (current: Set<string>) => Set<string>) => void
  onOpenPalette: (seed: string) => void
  onOpenArtifact: (artifact: ArtifactIndexEntry) => void
  onToggleTheme: () => void
  theme: 'light' | 'dark'
  onClose: () => void
}) {
  const [query, setQuery] = useState('')
  const tree = useMemo(() => buildArtifactTree(index.artifacts), [index.artifacts])
  const normalizedQuery = query.trim().toLocaleLowerCase()
  const recent = useMemo(
    () => [...index.artifacts]
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
      .slice(0, 4),
    [index.artifacts],
  )
  const filteredArtifacts = useMemo(
    () => flattenArtifacts(tree).filter((artifact) => matches(artifact, normalizedQuery)),
    [tree, normalizedQuery],
  )

  useEffect(() => {
    const ancestors = folderAncestors(artifactPath)
    if (ancestors.length > 0) {
      onExpandedPathsChange((current) => new Set([...current, ...ancestors]))
    }
  }, [artifactPath, onExpandedPathsChange])

  function toggleDirectory(path: string) {
    onExpandedPathsChange((current) => {
      const next = new Set(current)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })
  }

  function renderNode(node: ArtifactTreeNode, depth: number): React.ReactNode {
    const directories = [...node.directories.values()].filter(
      (directory) => !normalizedQuery || countMatching(directory, normalizedQuery) > 0,
    )
    const files = node.artifacts.filter((artifact) => matches(artifact, normalizedQuery))

    return (
      <>
        {directories.map((directory) => {
          const expanded = normalizedQuery.length > 0 || expandedPaths.has(directory.path)
          const count = normalizedQuery
            ? countMatching(directory, normalizedQuery)
            : countArtifacts(directory)

          return (
            <div className="tree-directory" key={directory.path}>
              <button
                className="tree-directory-button"
                style={{ paddingInlineStart: `${9 + depth * 14}px` }}
                aria-expanded={expanded}
                onClick={() => toggleDirectory(directory.path)}
              >
                <Icon name="chevron" size={11} />
                <span className="tree-label">{highlight(directory.name, normalizedQuery)}</span>
                <span className="tree-count">{count}</span>
              </button>
              {expanded ? (
                <div className="tree-children">
                  {renderNode(directory, depth + 1)}
                </div>
              ) : null}
            </div>
          )
        })}
        {files.map((artifact) => (
          <button
            className={`tree-artifact${artifact.path === artifactPath ? ' is-active' : ''}`}
            key={artifact.id}
            style={{ paddingInlineStart: `${10 + depth * 14}px` }}
            title={artifact.path}
            aria-current={artifact.path === artifactPath ? 'page' : undefined}
            onClick={() => onOpenArtifact(artifact)}
          >
            <span className="tree-artifact-mark" aria-hidden="true" />
            <span className="tree-label">{highlight(artifact.title, normalizedQuery)}</span>
          </button>
        ))}
      </>
    )
  }

  return (
    <aside className="sidebar-panel" aria-label={`${index.site.title} navigation`}>
      <div className="sidebar-top">
        <div className="sidebar-top-row">
          <button
            className="site-switcher"
            id="site-switcher"
            title="Switch site"
            aria-label={`Switch site. Current site: ${index.site.title}`}
            onClick={() => onOpenPalette('@')}
          >
            <span className="site-mark site-mark-small" aria-hidden="true">
              {index.site.title.slice(0, 1).toUpperCase()}
            </span>
            <span className="site-switcher-name">{index.site.title}</span>
            <span className="site-switcher-hint">{sites.length || 1}</span>
            <Icon name="chevron" size={12} />
          </button>
          <button className="icon-button sidebar-dismiss" aria-label="Close navigation" onClick={onClose}>
            <Icon name="close" size={15} />
          </button>
        </div>

        <label className="sidebar-filter">
          <Icon name="search" size={14} />
          <input
            aria-label="Filter this site"
            placeholder="Filter this site"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                setQuery('')
                event.currentTarget.blur()
              } else if (event.key === 'Enter' && filteredArtifacts[0]) {
                onOpenArtifact(filteredArtifacts[0])
              }
            }}
          />
          {query ? (
            <button
              type="button"
              className="filter-clear"
              aria-label="Clear filter"
              onClick={() => setQuery('')}
            >
              <Icon name="close" size={12} />
            </button>
          ) : null}
        </label>
      </div>

      <nav className="sidebar-body" aria-label="Artifacts">
        {normalizedQuery ? (
          <div className="sidebar-section">
            <div className="sidebar-section-title">
              <span>Matches</span><span className="mono">{filteredArtifacts.length}</span>
            </div>
            {filteredArtifacts.length === 0 ? (
              <p className="sidebar-empty">
                Nothing in {index.site.title} matches.<br />
                <span>Press ⌘ K to search other sites.</span>
              </p>
            ) : renderNode(tree, 0)}
          </div>
        ) : (
          <>
            <div className="sidebar-section">
              <div className="sidebar-section-title">
                <span>Recently updated</span><span className="mono">{recent.length}</span>
              </div>
              {recent.map((artifact) => (
                <ArtifactTreeRow
                  key={artifact.id}
                  artifact={artifact}
                  active={artifact.path === artifactPath}
                  onClick={() => onOpenArtifact(artifact)}
                />
              ))}
            </div>
            <div className="sidebar-section browse-tree">
              <div className="sidebar-section-title"><span>Browse</span></div>
              {index.artifacts.length === 0 ? (
                <p className="sidebar-empty">No artifacts have been published yet.</p>
              ) : renderNode(tree, 0)}
            </div>
          </>
        )}
      </nav>

      <footer className="sidebar-footer">
        <span className="index-date">
          Index updated <time dateTime={index.generatedAt}>{formatDate(index.generatedAt)}</time>
        </span>
        <button
          className="icon-button theme-toggle"
          title={`Switch to ${theme === 'light' ? 'dark' : 'light'} theme`}
          aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} theme`}
          onClick={onToggleTheme}
        >
          <Icon name={theme === 'light' ? 'moon' : 'sun'} size={15} />
        </button>
      </footer>
    </aside>
  )
}

function ArtifactTreeRow({
  artifact,
  active,
  onClick,
}: {
  artifact: ArtifactIndexEntry
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      className={`tree-artifact${active ? ' is-active' : ''}`}
      title={artifact.path}
      aria-current={active ? 'page' : undefined}
      onClick={onClick}
    >
      <span className="tree-artifact-mark" aria-hidden="true" />
      <span className="tree-label">{artifact.title}</span>
    </button>
  )
}

function matches(artifact: ArtifactIndexEntry, query: string) {
  if (!query) return true
  return `${artifact.title} ${artifact.path} ${artifact.filename ?? ''}`.toLocaleLowerCase().includes(query)
}

function countMatching(node: ArtifactTreeNode, query: string): number {
  return node.artifacts.filter((artifact) => matches(artifact, query)).length
    + [...node.directories.values()].reduce((total, directory) => total + countMatching(directory, query), 0)
}

function folderAncestors(path?: string) {
  if (!path) return []
  const segments = path.split('/').filter(Boolean).slice(0, -1)
  return segments.map((_, index) => segments.slice(0, index + 1).join('/'))
}

function highlight(text: string, query: string) {
  if (!query) return text
  const index = text.toLocaleLowerCase().indexOf(query)
  if (index < 0) return text
  return (
    <>
      {text.slice(0, index)}
      <mark>{text.slice(index, index + query.length)}</mark>
      {text.slice(index + query.length)}
    </>
  )
}

function formatDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.valueOf())) return value
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(date)
}
