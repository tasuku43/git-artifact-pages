import { useEffect, useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import sreIndex from '../../fixtures/storage/_indexes/sre.json'
import frontendIndex from '../../fixtures/storage/_indexes/frontend.json'
import type { ArtifactIndexEntry, SiteIndex } from '../domain/index'
import { Sidebar } from './Sidebar'
import { CommandPalette, type PaletteCommand } from './CommandPalette'

const indexes = [sreIndex, frontendIndex] as SiteIndex[]

type SidebarStoryArgs = { theme: 'light' | 'dark' }

function SidebarStory({ theme }: SidebarStoryArgs) {
  const [activeIndex, setActiveIndex] = useState(sreIndex as SiteIndex)
  const [artifactPath, setArtifactPath] = useState('incidents/checkout-latency')
  const [expandedPaths, setExpandedPaths] = useState(() => new Set(['incidents', 'architecture']))
  const [paletteSeed, setPaletteSeed] = useState<string | null>(null)
  const [activeTheme, setActiveTheme] = useState(theme)
  const commands: PaletteCommand[] = [
    { title: 'Toggle sidebar', shortcut: '⌘ B', onSelect: () => undefined },
    { title: 'Switch theme', onSelect: () => setActiveTheme((current) => current === 'light' ? 'dark' : 'light') },
  ]

  useEffect(() => setActiveTheme(theme), [theme])
  useEffect(() => {
    document.documentElement.dataset.theme = activeTheme
  }, [activeTheme])

  const activeArtifact = activeIndex.artifacts.find((artifact) => artifact.path === artifactPath)

  return (
    <div style={{ display: 'flex', width: '100%', height: '100vh', background: 'var(--shell)' }}>
      <Sidebar
        index={activeIndex}
        sites={indexes.map(({ site }) => site)}
        artifactPath={artifactPath}
        expandedPaths={expandedPaths}
        onExpandedPathsChange={setExpandedPaths}
        onOpenPalette={setPaletteSeed}
        onOpenArtifact={(artifact: ArtifactIndexEntry) => setArtifactPath(artifact.path)}
        onToggleTheme={() => setActiveTheme((current) => current === 'light' ? 'dark' : 'light')}
        theme={activeTheme}
        onClose={() => undefined}
      />
      {paletteSeed !== null ? (
        <CommandPalette
          seed={paletteSeed}
          indexes={indexes}
          currentIndex={activeIndex}
          currentArtifact={activeArtifact}
          commands={commands}
          loading={false}
          onClose={() => setPaletteSeed(null)}
          onNavigate={(href) => {
            const siteId = href.split('/').filter(Boolean)[0]
            const nextIndex = indexes.find(({ site }) => site.id === siteId)
            if (nextIndex) {
              setActiveIndex(nextIndex)
              setArtifactPath(href.split('/').filter(Boolean).slice(1).join('/'))
            }
            setPaletteSeed(null)
          }}
          onJumpToHeading={() => setPaletteSeed(null)}
        />
      ) : null}
    </div>
  )
}

const meta = {
  title: 'Navigation/Sidebar',
  args: { theme: 'light' },
  argTypes: {
    theme: { control: 'radio', options: ['light', 'dark'] },
  },
  render: (args: SidebarStoryArgs) => <SidebarStory {...args} />,
} satisfies Meta<SidebarStoryArgs>

export default meta
type Story = StoryObj<typeof meta>

export const ArtifactTree: Story = {}

export const Dark: Story = {
  args: { theme: 'dark' },
}
