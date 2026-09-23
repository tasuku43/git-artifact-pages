import { useEffect, useMemo, useRef, useState } from 'react'
import type { ArtifactIndexEntry, SiteIndex, TocEntry } from '../domain/index'
import { artifactRouteHref } from '../routing'
import { Icon } from './Icon'

export type PaletteCommand = {
  title: string
  shortcut?: string
  onSelect: () => void
  available?: boolean
}

type PaletteEntry = {
  id: string
  kind: 'artifact' | 'site' | 'command' | 'heading'
  title: string
  subtitle?: string
  shortcut?: string
  query?: string
  onSelect: () => void
}

type PaletteSection = {
  title: string
  entries: PaletteEntry[]
}

export function CommandPalette({
  seed,
  indexes,
  currentIndex,
  currentArtifact,
  commands,
  loading,
  onClose,
  onNavigate,
  onJumpToHeading,
}: {
  seed: string
  indexes: SiteIndex[]
  currentIndex: SiteIndex
  currentArtifact?: ArtifactIndexEntry
  commands: PaletteCommand[]
  loading: boolean
  onClose: () => void
  onNavigate: (href: string) => void
  onJumpToHeading: (headingId: string) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState(seed)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const normalized = query.toLocaleLowerCase()
  const mode = normalized.startsWith('@')
    ? 'site'
    : normalized.startsWith('>')
      ? 'command'
      : normalized.startsWith('#')
        ? 'heading'
        : 'artifact'
  const term = mode === 'artifact' ? query.trim() : query.slice(1).trim()

  const sections = useMemo(
    () => buildSections({ mode, term, indexes, currentIndex, currentArtifact, commands, onNavigate, onJumpToHeading }),
    [mode, term, indexes, currentIndex, currentArtifact, commands, onNavigate, onJumpToHeading],
  )
  const entries = sections.flatMap((section) => section.entries)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    setSelectedIndex(0)
  }, [query])

  useEffect(() => {
    document.querySelector<HTMLElement>('[data-palette-selected="true"]')
      ?.scrollIntoView({ block: 'nearest' })
  }, [selectedIndex])

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setSelectedIndex((current) => Math.min(current + 1, Math.max(entries.length - 1, 0)))
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setSelectedIndex((current) => Math.max(current - 1, 0))
    } else if (event.key === 'Enter') {
      event.preventDefault()
      const selectedEntry = entries[selectedIndex]
      if (selectedEntry) {
        onClose()
        selectedEntry.onSelect()
      }
    } else if (event.key === 'Escape') {
      event.preventDefault()
      onClose()
    }
  }

  let entryIndex = 0

  return (
    <div
      className="palette-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <section className="command-palette" role="dialog" aria-modal="true" aria-label="Command palette">
        <div className="palette-input-row">
          <Icon name="search" size={16} />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search for anything..."
            aria-label="Search artifacts, sites, commands, and headings"
            autoComplete="off"
            spellCheck={false}
          />
          <span className="palette-scope" hidden={mode === 'artifact'}>
            {mode === 'site' ? 'Sites' : mode === 'command' ? 'Commands' : 'This artifact'}
          </span>
          <kbd>esc</kbd>
        </div>

        <div className="palette-results" role="listbox" aria-label="Search results">
          {sections.length === 0 ? (
            <p className="palette-empty">
              {mode === 'heading' && !currentArtifact
                ? 'Open an artifact first to search its headings.'
                : mode === 'heading' && (currentArtifact?.toc?.length ?? 0) === 0
                  ? 'This artifact has no indexed headings.'
                  : mode === 'artifact' && indexes.length < 2
                    ? 'No matching artifacts were found.'
                    : 'Nothing matches. Try > for commands, @ for sites, or # for headings.'}
            </p>
          ) : (
            sections.map((section) => (
              <div className="palette-section" key={section.title}>
                <div className="palette-section-title">{section.title}</div>
                {section.entries.map((entry) => {
                  const index = entryIndex++
                  const selected = index === selectedIndex
                  return (
                    <button
                      className={`palette-entry${selected ? ' is-selected' : ''}`}
                      key={entry.id}
                      role="option"
                      aria-selected={selected}
                      data-palette-selected={selected ? 'true' : undefined}
                      onMouseEnter={() => setSelectedIndex(index)}
                      onClick={() => {
                        onClose()
                        entry.onSelect()
                      }}
                    >
                      <span className="palette-entry-icon">
                        <Icon name={iconForEntry(entry.kind)} size={14} />
                      </span>
                      <span className="palette-entry-title">{highlight(entry.title, entry.query ?? '')}</span>
                      {entry.subtitle ? <span className="palette-entry-subtitle">{entry.subtitle}</span> : null}
                      {entry.shortcut ? <kbd>{entry.shortcut}</kbd> : null}
                    </button>
                  )
                })}
              </div>
            ))
          )}
        </div>

        {loading ? <p className="palette-loading" role="status">Loading other site indexes…</p> : null}

        <footer className="palette-footer">
          <span><kbd>↑</kbd><kbd>↓</kbd> navigate</span>
          <span><kbd>↵</kbd> open</span>
          <span><code>&gt;</code> commands</span>
          <span><code>@</code> sites</span>
          <span><code>#</code> headings</span>
        </footer>
      </section>
    </div>
  )
}

function buildSections({
  mode,
  term,
  indexes,
  currentIndex,
  currentArtifact,
  commands,
  onNavigate,
  onJumpToHeading,
}: {
  mode: 'site' | 'command' | 'heading' | 'artifact'
  term: string
  indexes: SiteIndex[]
  currentIndex: SiteIndex
  currentArtifact?: ArtifactIndexEntry
  commands: PaletteCommand[]
  onNavigate: (href: string) => void
  onJumpToHeading: (headingId: string) => void
}): PaletteSection[] {
  const query = term.toLocaleLowerCase()

  if (mode === 'site') {
    const entries = indexes
      .filter(({ site }) => `${site.title} ${site.id}`.toLocaleLowerCase().includes(query))
      .map((index) => ({
        id: `site:${index.site.id}`,
        kind: 'site' as const,
        title: index.site.title,
        subtitle: `/${index.site.id} · ${index.artifacts.length} artifacts`,
        onSelect: () => onNavigate(`/${encodeURIComponent(index.site.id)}`),
      }))
    return entries.length ? [{ title: 'Sites', entries }] : []
  }

  if (mode === 'command') {
    const entries = commands
      .filter((command) => command.available !== false)
      .filter((command) => command.title.toLocaleLowerCase().includes(query))
      .map((command) => ({
        id: `command:${command.title}`,
        kind: 'command' as const,
        title: command.title,
        shortcut: command.shortcut,
        onSelect: command.onSelect,
      }))
    return entries.length ? [{ title: 'Commands', entries }] : []
  }

  if (mode === 'heading') {
    const headings = (currentArtifact?.toc ?? [])
      .filter((heading) => heading.text.toLocaleLowerCase().includes(query))
      .map((heading) => headingEntry(heading, currentArtifact, onJumpToHeading))
    return headings.length
      ? [{ title: `In ${currentArtifact?.title ?? 'this artifact'}`, entries: headings }]
      : []
  }

  if (!term.trim()) {
    const recent = [...currentIndex.artifacts]
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
      .slice(0, 4)
      .map((artifact) => artifactEntry(currentIndex, artifact, '', onNavigate))
    const commandEntries = commands
      .filter((command) => command.available !== false)
      .slice(0, 3)
      .map((command) => ({
        id: `command:${command.title}`,
        kind: 'command' as const,
        title: command.title,
        shortcut: command.shortcut,
        onSelect: command.onSelect,
      }))
    return [
      ...(recent.length ? [{ title: 'Recently updated', entries: recent }] : []),
      ...(commandEntries.length ? [{ title: 'Commands', entries: commandEntries }] : []),
    ]
  }

  const orderedIndexes = [
    currentIndex,
    ...indexes.filter(({ site }) => site.id !== currentIndex.site.id),
  ]
  return orderedIndexes.flatMap((index) => {
    const entries = index.artifacts
      .filter((artifact) =>
        `${artifact.title} ${artifact.path} ${artifact.filename ?? ''}`.toLocaleLowerCase().includes(query),
      )
      .slice(0, 8)
      .map((artifact) => artifactEntry(index, artifact, term, onNavigate))
    return entries.length ? [{ title: index.site.title, entries }] : []
  })
}

function artifactEntry(
  index: SiteIndex,
  artifact: ArtifactIndexEntry,
  query: string,
  onNavigate: (href: string) => void,
): PaletteEntry {
  return {
    id: `artifact:${index.site.id}:${artifact.id}`,
    kind: 'artifact',
    title: artifact.title,
    subtitle: artifact.path,
    query,
    onSelect: () => onNavigate(artifactRouteHref(index.site.id, artifact.path)),
  }
}

function headingEntry(
  heading: TocEntry,
  artifact: ArtifactIndexEntry | undefined,
  onJumpToHeading: (headingId: string) => void,
): PaletteEntry {
  return {
    id: `heading:${heading.id}`,
    kind: 'heading',
    title: heading.text,
    subtitle: heading.level > 1 ? `Heading ${heading.level}` : 'Heading',
    onSelect: () => {
      if (artifact) onJumpToHeading(heading.id)
    },
  }
}

function iconForEntry(kind: PaletteEntry['kind']) {
  if (kind === 'site') return 'folder' as const
  if (kind === 'command') return 'chevron' as const
  if (kind === 'heading') return 'contents' as const
  return 'file' as const
}

function highlight(text: string, query: string) {
  if (!query) return text
  const index = text.toLocaleLowerCase().indexOf(query.toLocaleLowerCase())
  if (index < 0) return text
  return (
    <>
      {text.slice(0, index)}
      <mark>{text.slice(index, index + query.length)}</mark>
      {text.slice(index + query.length)}
    </>
  )
}
