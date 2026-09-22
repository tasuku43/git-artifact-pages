import { useEffect, useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { ArtifactWorkspace } from './ArtifactWorkspace'
import { parseRoute, type AppRoute } from '../routing'
import { deepExpandedPaths, deepSreIndex, storyIndexes, treeStyleOptions } from '../stories/fixtures'

const indexes = storyIndexes

type WorkspaceStoryArgs = {
  view: 'site-home' | 'artifact'
  theme: 'light' | 'dark'
  sidebarTreeStyle: typeof treeStyleOptions[number]
  siteHomeTreeStyle: typeof treeStyleOptions[number]
  initialSidebarOpen: boolean
}

function WorkspaceStory({ view, theme, sidebarTreeStyle, siteHomeTreeStyle, initialSidebarOpen }: WorkspaceStoryArgs) {
  const [route, setRoute] = useState<Extract<AppRoute, { kind: 'site' }>>(() => ({
    kind: 'site',
    siteId: deepSreIndex.site.id,
    artifactPath: view === 'artifact' ? 'incidents/checkout-latency' : undefined,
  }))
  const [hash, setHash] = useState('')
  const [activeTheme, setActiveTheme] = useState(theme)
  const index = indexes.find(({ site }) => site.id === route.siteId) ?? deepSreIndex

  useEffect(() => {
    setRoute({
      kind: 'site',
      siteId: deepSreIndex.site.id,
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
      sidebarTreeStyle={sidebarTreeStyle}
      siteHomeTreeStyle={siteHomeTreeStyle}
      initialExpandedPaths={deepExpandedPaths}
      initialSidebarOpen={initialSidebarOpen}
    />
  )
}

const meta = {
  title: 'Product/Workspace',
  args: {
    view: 'artifact',
    theme: 'light',
    sidebarTreeStyle: 'branch-guides',
    siteHomeTreeStyle: 'path-list',
    initialSidebarOpen: true,
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
    sidebarTreeStyle: {
      control: 'radio',
      options: treeStyleOptions,
      description: 'Choose the sidebar tree treatment.',
    },
    siteHomeTreeStyle: {
      control: 'radio',
      options: treeStyleOptions,
      description: 'Choose the Site Home Browse treatment.',
    },
    initialSidebarOpen: {
      control: 'boolean',
      description: 'Show the workspace with its navigation sidebar open or collapsed.',
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

export const SidebarCollapsed: Story = {
  name: 'Artifact viewer · sidebar collapsed',
  args: { initialSidebarOpen: false },
}
