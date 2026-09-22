import type { Meta, StoryObj } from '@storybook/react-vite'
import sreIndex from '../../fixtures/storage/_indexes/sre.json'
import frontendIndex from '../../fixtures/storage/_indexes/frontend.json'
import type { SiteIndex } from '../domain/index'
import { SitePicker } from './SitePicker'

const meta = {
  title: 'Navigation/Site picker',
  component: SitePicker,
  args: {
    indexes: [sreIndex, frontendIndex] as SiteIndex[],
    onNavigate: () => undefined,
  },
  parameters: {
    layout: 'fullscreen',
  },
} satisfies Meta<typeof SitePicker>

export default meta
type Story = StoryObj<typeof meta>

export const AvailableSites: Story = {}

export const Empty: Story = {
  args: { indexes: [] },
}
