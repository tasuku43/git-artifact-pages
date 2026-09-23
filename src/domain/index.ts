export type SiteSummary = {
  id: string
  title: string
}

export type TocEntry = {
  level: number
  text: string
  id: string
}

export type ArtifactCommitter = {
  name: string
}

export type ArtifactSource = {
  repository: string
  repositoryUrl?: string
  ref: string
}

export type ArtifactIndexEntry = {
  id: string
  title: string
  path: string
  filename?: string
  artifactUrl: string
  updatedAt: string
  lastCommitter?: ArtifactCommitter
  source?: ArtifactSource
  toc?: TocEntry[]
}

export type SiteIndex = {
  schemaVersion: number
  site: SiteSummary
  generatedAt: string
  artifacts: ArtifactIndexEntry[]
}
