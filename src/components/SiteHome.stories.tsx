import { useEffect } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { deepExpandedPaths, deepSreIndex, treeStyleOptions } from '../stories/fixtures'
import { SiteHome } from './SiteHome'

type SiteHomeStoryArgs = {
  treeStyle: typeof treeStyleOptions[number]
  theme: 'light' | 'dark'
}

function SiteHomeStory({ treeStyle, theme }: SiteHomeStoryArgs) {
  useEffect(() => {
    document.documentElement.dataset.theme = theme
  }, [theme])

  return (
    <SiteHome
      index={deepSreIndex}
      onOpenArtifact={() => undefined}
      treeStyle={treeStyle}
      defaultExpandedPaths={deepExpandedPaths}
    />
  )
}

const meta = {
  title: 'Product/Site home',
  args: {
    treeStyle: 'branch-guides',
    theme: 'light',
  },
  argTypes: {
    treeStyle: {
      control: 'radio',
      options: treeStyleOptions,
      description: 'The Browse section uses the same hierarchy treatments as the sidebar.',
    },
    theme: { control: 'radio', options: ['light', 'dark'] },
  },
  parameters: {
    layout: 'fullscreen',
  },
  render: (args: SiteHomeStoryArgs) => <SiteHomeStory {...args} />,
} satisfies Meta<SiteHomeStoryArgs>

export default meta
type Story = StoryObj<typeof meta>

export const AQuietIndent: Story = {
  name: 'A · Quiet indent',
  args: { treeStyle: 'quiet' },
  parameters: { docs: { description: { story: 'Clear indentation without guide lines. The selected row edge aligns to each row level.' } } },
}

export const BBranchGuides: Story = {
  name: 'B · Branch guides',
  args: { treeStyle: 'branch-guides' },
  parameters: { docs: { description: { story: 'Subtle vertical rails and short branch connectors make expanded depth easier to follow.' } } },
}

export const CPathList: Story = {
  name: 'C · Path labels',
  args: { treeStyle: 'path-list' },
  parameters: { docs: { description: { story: 'A compact alternative for very deep structures: each artifact keeps its full path as secondary text.' } } },
}
