import type { SiteIndex } from '../domain/index'
import { Icon } from './Icon'

export function SitePicker({
  indexes,
  onNavigate,
}: {
  indexes: SiteIndex[]
  onNavigate: (href: string) => void
}) {
  const sortedIndexes = [...indexes].sort((left, right) => left.site.title.localeCompare(right.site.title))

  return (
    <main className="site-picker-page">
      <div className="site-picker-content">
        <p className="brand-label"><span className="brand-mark">G</span> Git Artifact Pages</p>
        <p className="eyebrow">Artifact library</p>
        <h1>Choose a site</h1>
        <p className="site-picker-lede">Browse published artifacts from the sites available in this environment.</p>
        {sortedIndexes.length === 0 ? (
          <p className="empty-note">No site indexes were found.</p>
        ) : (
          <div className="site-picker-list">
            {sortedIndexes.map(({ site, artifacts, generatedAt }) => (
              <button
                className="site-picker-row"
                key={site.id}
                onClick={() => onNavigate(`/${encodeURIComponent(site.id)}`)}
              >
                <span className="site-mark" aria-hidden="true">{site.title.slice(0, 1).toUpperCase()}</span>
                <span className="site-picker-main">
                  <strong>{site.title}</strong>
                  <span className="mono">/{site.id}</span>
                </span>
                <span className="site-picker-count">{artifacts.length} artifacts · updated {formatDate(generatedAt)}</span>
                <Icon name="arrow" size={16} />
              </button>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}

function formatDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.valueOf())) return value
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(date)
}
