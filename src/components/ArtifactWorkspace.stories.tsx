import { useEffect, useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import sreIndex from '../../fixtures/storage/_indexes/sre.json'
import frontendIndex from '../../fixtures/storage/_indexes/frontend.json'
import { ArtifactWorkspace } from './ArtifactWorkspace'
import { parseRoute, type AppRoute } from '../routing'
import type { SiteIndex } from '../domain/index'

const indexes = [sreIndex, frontendIndex] as SiteIndex[]

type WorkspaceStoryArgs = {
  view: 'site-home' | 'artifact'
  theme: 'light' | 'dark'
}

function WorkspaceStory({ view, theme }: WorkspaceStoryArgs) {
  const [route, setRoute] = useState<Extract<AppRoute, { kind: 'site' }>>(() => ({
    kind: 'site',
    siteId: 'sre',
    artifactPath: view === 'artifact' ? 'incidents/checkout-latency' : undefined,
  }))
  const [hash, setHash] = useState('')
  const [activeTheme, setActiveTheme] = useState(theme)
  const index = indexes.find(({ site }) => site.id === route.siteId) ?? sreIndex

  useEffect(() => {
    setRoute({
      kind: 'site',
      siteId: 'sre',
      artifactPath: view === 'artifact' ? 'incidents/checkout-latency' : undefined,
    })
    setHash('')
  }, [view])

  useEffect(() => {
    setActiveTheme(theme)
  }, [theme])

  useEffect(() => {
    document.documentElement.dataset.theme = activeTheme
  }, [activeTheme])

  function navigate(href: string) {
    const destination = new URL(href, window.location.origin)
    const nextRoute = parseRoute(destination.pathname)
    if (nextRoute.kind === 'site') setRoute(nextRoute)
    setHash(destination.hash)
  }

  const pathname = `/${route.siteId}${route.artifactPath ? `/${route.artifactPath}` : ''}`

  return (
    <ArtifactWorkspace
      route={route}
      pathname={pathname}
      hash={hash}
      catalog={indexes}
      catalogLoading={false}
      navigate={navigate}
      theme={activeTheme}
      onToggleTheme={() => setActiveTheme((current) => current === 'light' ? 'dark' : 'light')}
      index={index}
    />
  )
}

const meta = {
  title: 'Product/Workspace',
  args: {
    view: 'artifact',
    theme: 'light',
  },
  argTypes: {
    view: {
      control: 'radio',
      options: ['site-home', 'artifact'],
      description: 'Choose the main workspace state.',
    },
    theme: {
      control: 'radio',
      options: ['light', 'dark'],
    },
  },
  render: (args: WorkspaceStoryArgs) => <WorkspaceStory {...args} />,
} satisfies Meta<WorkspaceStoryArgs>

export default meta
type Story = StoryObj<typeof meta>

export const ArtifactView: Story = {
  name: 'Artifact viewer',
}

export const SiteHome: Story = {
  name: 'Site home',
  args: { view: 'site-home' },
}

export const DarkArtifactView: Story = {
  name: 'Artifact viewer · dark',
  args: { theme: 'dark' },
}
