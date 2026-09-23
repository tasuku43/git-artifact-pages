export async function hydrateArtifact() {
  const response = await fetch(new URL('../../data/details.json', import.meta.url))
  if (!response.ok) throw new Error(`Could not load artifact details: ${response.status}`)

  const details = await response.json()
  document.body.dataset.artifactSite = details.site

  const status = document.querySelector('#bundle-status')
  if (status) {
    status.textContent = details.message
    status.hidden = false
  }
}
