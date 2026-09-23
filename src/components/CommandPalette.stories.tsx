import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { storyIndexes } from '../stories/fixtures'
import type { ArtifactIndexEntry, SiteIndex } from '../domain/index'
import { CommandPalette, type PaletteCommand } from './CommandPalette'

const indexes = storyIndexes as SiteIndex[]
const currentIndex = indexes[0]
const currentArtifact = currentIndex.artifacts[0] as ArtifactIndexEntry

type PaletteStoryArgs = { seed: string }

function PaletteStory({ seed }: PaletteStoryArgs) {
  const [isOpen, setIsOpen] = useState(true)
  const commands: PaletteCommand[] = [
    { title: 'Toggle sidebar', shortcut: '⌘ B', onSelect: () => undefined },
    { title: 'Toggle contents', shortcut: '⌘ ⇧ O', onSelect: () => undefined },
    { title: 'Go to site home', onSelect: () => undefined },
    { title: 'Use light theme', onSelect: () => undefined },
    { title: 'Use dark theme', onSelect: () => undefined },
    { title: 'Use system theme', subtitle: 'Current', onSelect: () => undefined },
  ]

  return isOpen ? (
    <CommandPalette
      seed={seed}
      indexes={indexes}
      currentIndex={currentIndex}
      currentArtifact={currentArtifact}
      commands={commands}
      loading={false}
      onClose={() => setIsOpen(false)}
      onNavigate={() => setIsOpen(false)}
      onJumpToHeading={() => setIsOpen(false)}
    />
  ) : (
    <div style={{ padding: 24 }}>
      <button className="text-action" onClick={() => setIsOpen(true)}>Open command palette</button>
    </div>
  )
}

const meta = {
  title: 'Navigation/Command palette',
  args: { seed: '' },
  argTypes: {
    seed: {
      control: 'radio',
      options: ['', 'checkout', 'pltf', 'chk lat', '@', '>', '#'],
      description: 'Try fuzzy terms or switch to a search scope.',
    },
  },
  render: (args: PaletteStoryArgs) => <PaletteStory key={args.seed} {...args} />,
} satisfies Meta<PaletteStoryArgs>

export default meta
type Story = StoryObj<typeof meta>

export const RecentAndCommands: Story = {}

export const SearchArtifacts: Story = {
  args: { seed: 'checkout' },
}

export const FuzzySearchInlineTrace: Story = {
  args: { seed: 'chk lat' },
}

export const SwitchSites: Story = {
  args: { seed: '@' },
}

export const Commands: Story = {
  args: { seed: '>' },
}

export const Headings: Story = {
  args: { seed: '#' },
}
