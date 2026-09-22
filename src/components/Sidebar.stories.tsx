import { useEffect, useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import type { AppRoute } from '../routing'
import type { PaletteCommand } from './CommandPalette'
import { CommandPalette } from './CommandPalette'
import { Sidebar } from './Sidebar'
import { deepExpandedPaths, deepSreIndex, storyIndexes, treeStyleOptions } from '../stories/fixtures'

type SidebarStoryArgs = {
  theme: 'light' | 'dark'
  treeStyle: typeof treeStyleOptions[number]
}

function SidebarStory({ theme, treeStyle }: SidebarStoryArgs) {
  const [activeIndex, setActiveIndex] = useState(deepSreIndex)
  const [artifactPath, setArtifactPath] = useState<string | undefined>(
    'incidents/2026/q3/checkout/latency-review',
  )
  const [expandedPaths, setExpandedPaths] = useState(() => new Set(deepExpandedPaths))
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

  function navigate(href: string) {
    const route = parseRoute(href)
    if (route.kind !== 'site') return
    const nextIndex = storyIndexes.find(({ site }) => site.id === route.siteId)
    if (!nextIndex) return
    setActiveIndex(nextIndex)
    setArtifactPath(route.artifactPath)
    setPaletteSeed(null)
  }

  return (
    <div style={{ display: 'flex', width: '100%', height: '100vh', background: 'var(--shell)' }}>
      <Sidebar
        index={activeIndex}
        sites={storyIndexes.map(({ site }) => site)}
        artifactPath={artifactPath}
        expandedPaths={expandedPaths}
        onExpandedPathsChange={setExpandedPaths}
        onOpenPalette={setPaletteSeed}
        onOpenArtifact={(artifact) => setArtifactPath(artifact.path)}
        onToggleTheme={() => setActiveTheme((current) => current === 'light' ? 'dark' : 'light')}
        theme={activeTheme}
        onCollapse={() => undefined}
        treeStyle={treeStyle}
      />
      {paletteSeed !== null ? (
        <CommandPalette
          seed={paletteSeed}
          indexes={storyIndexes}
          currentIndex={activeIndex}
          currentArtifact={activeArtifact}
          commands={commands}
          loading={false}
          onClose={() => setPaletteSeed(null)}
          onNavigate={navigate}
          onJumpToHeading={() => setPaletteSeed(null)}
        />
      ) : null}
    </div>
  )
}

function parseRoute(href: string): AppRoute {
  const pathname = new URL(href, window.location.origin).pathname
  const segments = pathname.split('/').filter(Boolean)
  if (segments.length === 0) return { kind: 'sites' }
  const [siteId, ...artifactPath] = segments
  return { kind: 'site', siteId, artifactPath: artifactPath.length ? artifactPath.join('/') : undefined }
}

const meta = {
  title: 'Navigation/Tree directions',
  args: { theme: 'dark', treeStyle: 'branch-guides' },
  argTypes: {
    theme: { control: 'radio', options: ['light', 'dark'] },
    treeStyle: {
      control: 'radio',
      options: treeStyleOptions,
      description: 'Compare indentation, helper lines, and selection treatment using the same deep fixture.',
    },
  },
  render: (args: SidebarStoryArgs) => <SidebarStory {...args} />,
} satisfies Meta<SidebarStoryArgs>

export default meta
type Story = StoryObj<typeof meta>

export const AQuietIndent: Story = {
  name: 'A · Quiet indent',
  args: { treeStyle: 'quiet' },
  parameters: { docs: { description: { story: 'No connector lines or bullets; depth is communicated by consistent indentation.' } } },
}

export const BBranchGuides: Story = {
  name: 'B · Branch guides',
  args: { treeStyle: 'branch-guides' },
  parameters: { docs: { description: { story: 'Subtle guide rails clarify open branches without adding file bullets.' } } },
}

export const CPathList: Story = {
  name: 'C · Path labels',
  args: { treeStyle: 'path-list' },
  parameters: { docs: { description: { story: 'A flatter alternative with each full path shown beneath its artifact title.' } } },
}
