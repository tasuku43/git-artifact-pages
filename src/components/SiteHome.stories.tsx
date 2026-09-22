import type { Meta, StoryObj } from '@storybook/react-vite'
import sreIndex from '../../fixtures/storage/_indexes/sre.json'
import type { SiteIndex } from '../domain/index'
import { SiteHome } from './SiteHome'

const meta = {
  title: 'Navigation/Site home',
  component: SiteHome,
  args: {
    index: sreIndex as SiteIndex,
    onOpenArtifact: () => undefined,
  },
  parameters: {
    layout: 'padded',
  },
} satisfies Meta<typeof SiteHome>

export default meta
type Story = StoryObj<typeof meta>

export const RecentAndBrowse: Story = {}
