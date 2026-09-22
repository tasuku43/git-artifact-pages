# Git Artifact Pages — Specification

Status: **design baseline / pre-MVP**

This document captures the intended product contract. Some implementation details are deliberately left open until the local reference implementation validates them.

## 1. Product definition

Git Artifact Pages is a Git-backed platform for publishing static artifacts as searchable, browsable websites.

A typical source artifact is generated or maintained in a Git repository, for example:

- HTML reports
- architecture explanations
- design documents
- generated visualizations
- incident reports
- review artifacts
- documentation bundles

The product preserves Git as the source of truth while presenting artifacts through a normal web experience.

## 2. System model

~~~text
Git repositories
      ↓
publisher
      ↓
static projection
      ↓
object storage
      ↓
CDN / HTTP server
      ↓
browser SPA
~~~

There is no required application server in the browser request path.

### 2.1 Application plane

The application plane changes relatively infrequently.

~~~text
/index.html
/assets/*
~~~

It contains the SPA shell and its versioned JS/CSS assets.

The initial SPA implementation is Vite + React + TypeScript.

### 2.2 Content plane

The content plane changes as artifacts are published.

~~~text
/_indexes/*
/_artifacts/*
~~~

It is independently deployable from the application plane.

## 3. Site

A **site** is the first logical segment of a user-facing route.

Examples:

~~~text
/sre
/frontend
/platform
~~~

Therefore /sre/incidents/123 means:

- site: sre
- logical artifact route: incidents/123

A site is not a repository. Multiple repositories may contribute to the same site.

## 4. User-facing routing

The browser contract is intentionally small:

~~~text
/            site selection
/:site       site home
/:site/*     artifact view
~~~

Storage implementation paths are internal details and should not become the primary URLs users share.

Example:

~~~text
user URL:
/sre/incidents/123

internal artifact URL:
/_artifacts/sre/incidents/123/index.html
~~~

The SPA resolves the logical route and loads the corresponding artifact.

## 5. Storage projection

The initial projection shape is:

~~~text
/
├── index.html
├── assets/
├── _indexes/
│   ├── sites.json
│   ├── sre.json
│   ├── frontend.json
│   └── platform.json
└── _artifacts/
    ├── sre/
    ├── frontend/
    └── platform/
~~~

### 5.1 Site discovery

/_indexes/sites.json is a low-frequency registry projection used by the root route to discover available sites.

It changes when sites are onboarded, renamed, or removed. It does **not** change for each artifact publication.

Example:

~~~json
{
  "schemaVersion": 1,
  "sites": [
    { "id": "sre", "title": "SRE" },
    { "id": "frontend", "title": "Frontend" }
  ]
}
~~~

If a future implementation derives site discovery from another static registry representation, this file may evolve. The requirement is that root site selection remains serverless.

### 5.2 Per-site index

Each site has one public index:

~~~text
/_indexes/<site>.json
~~~

Example:

~~~json
{
  "schemaVersion": 1,
  "site": {
    "id": "sre",
    "title": "SRE"
  },
  "generatedAt": "2026-09-22T00:00:00Z",
  "artifacts": [
    {
      "id": "incidents/123",
      "title": "Incident 123 Review",
      "path": "incidents/123",
      "artifactUrl": "/_artifacts/sre/incidents/123/index.html",
      "updatedAt": "2026-09-22T00:00:00Z",
      "source": {
        "repository": "example/sre",
        "ref": "main"
      },
      "toc": [
        { "level": 1, "text": "Summary", "id": "summary" },
        { "level": 2, "text": "Root cause", "id": "root-cause" }
      ]
    }
  ]
}
~~~

The exact schema will mature with implementation. The important public contract is one index per site.

The index should eventually contain enough information to support:

- recent artifacts
- title search
- filename/path search
- tree navigation
- source/path grouping where useful
- table of contents
- deep links

The browser should not need S3 ListObjects or equivalent runtime storage listing APIs.

## 6. Artifacts

Artifact bytes are served beneath:

~~~text
/_artifacts/<site>/...
~~~

The platform does not define "static artifact" by file extension. HTML may depend on:

- CSS
- JavaScript
- images
- SVG
- fonts
- JSON
- WASM
- other static relative resources

The publisher therefore works on declared source paths / mounts, not on a hard-coded extension allowlist.

Relative resources should work naturally because artifact directory structure is preserved in the storage projection.

## 7. Artifact viewer

Artifacts should initially be displayed using an iframe.

Reasons:

- preserve normal relative URL behavior
- isolate artifact CSS from the application shell
- avoid injecting arbitrary HTML into the SPA DOM
- allow artifact JavaScript policy to evolve independently
- keep the SPA focused on navigation and discovery

The exact iframe sandbox policy is a security decision to validate during implementation.

The right-hand table of contents should use precomputed index metadata rather than requiring the parent application to inspect the iframe DOM.

## 8. Browser UX

Target layout:

~~~text
┌──────────────────────────────────────────────────────────┐
│ Git Artifact Pages                         Search        │
├─────────────────┬─────────────────────────┬──────────────┤
│                 │                         │              │
│ Artifact tree   │ Artifact viewer         │ Contents     │
│ filters/search  │ iframe                  │ H1 / H2 / H3 │
│                 │                         │              │
└─────────────────┴─────────────────────────┴──────────────┘
~~~

### Root route

/ presents site selection using static registry metadata.

### Site home

/:site loads /_indexes/<site>.json and initially presents recent artifacts, expected to start with roughly the latest 10 entries.

### Search

Search is client-side against the site index for the initial implementation.

Initial searchable fields:

- title
- path
- filename where available

Search should feel immediate after the index is loaded.

### Left sidebar

The left sidebar derives a tree/navigation model from the site index. It may support filtering without additional network calls.

### Main pane

The selected artifact is loaded from /_artifacts/* into the iframe.

### Right sidebar

The right sidebar displays table-of-contents metadata when present and can navigate to heading anchors in the artifact.

## 9. Source and mount model

A publish source is conceptually:

~~~text
(repository, ref, sourcePath)
~~~

and is assigned a destination:

~~~text
(site, mountPath)
~~~

Example:

~~~yaml
site: sre
repository: company/sre-monorepo
ref: main
sourcePath: docs/artifacts
mountPath: /incidents
~~~

Artifact-only repositories are represented naturally:

~~~yaml
site: sre
repository: company/sre-artifacts
ref: main
sourcePath: .
mountPath: /reports
~~~

## 10. Multiple repositories in one site

This is a required design capability.

Example:

~~~text
site: sre

/incidents     ← company/sre
/architecture  ← company/platform
/runbooks      ← company/operations
~~~

The registry must guarantee that mount paths within a site do not overlap.

Invalid examples:

~~~text
/reports
/reports
~~~

and:

~~~text
/reports
/reports/security
~~~

Parent/child overlap is rejected because a publisher using delete/sync semantics could affect another publisher's namespace.

The public projection still presents one /_indexes/sre.json.

How multiple publisher contributions are staged and merged into that single index is an implementation concern to solve in the publisher phase. Source-specific manifests are one possible internal mechanism, but are not required as part of the browser-facing contract.

## 11. Registry

The eventual platform registry is the authority for:

- site identity
- source repository
- ref
- sourcePath
- mountPath
- publish authorization

Repository workflows should not be able to arbitrarily choose another source's destination namespace.

Normalization rules should reject at least:

- duplicate mount paths
- ancestor/descendant mount overlap
- ..
- reserved platform namespaces
- invalid site IDs

The exact registry format is not required for the local browser milestone.

## 12. Publish-time metadata

Where practical, metadata is produced at publish time instead of browser request time.

Candidate metadata:

- title
- logical path
- filename
- updated time
- commit SHA
- source repository
- source ref
- headings / TOC
- optional tags
- optional description

Initial title extraction may use the HTML title element.

Sidecar metadata may be added later if HTML alone is insufficient.

## 13. Local reference implementation

Local development should reproduce the production routing contract without AWS.

Target:

~~~text
Browser
   ↓
nginx (Docker Compose)
   ├── /_indexes/*   → fixture/generated static files
   ├── /_artifacts/* → fixture/generated static files
   └── everything else → Vite SPA index.html
~~~

Committed fixture data lives separately from generated local state.

Recommended convention:

~~~text
fixtures/storage/   committed representative projection
.local/             generated/untracked projection
~~~

The local product should be usable before any AWS code exists.

## 14. Testing direction

Target testing layers:

- Vitest for domain/unit behavior
- Storybook for isolated UI states
- Storybook interaction tests for component behavior
- Playwright for full navigation and routing behavior

Important E2E flows include:

- root → choose site
- site home → recent artifact
- sidebar filter → artifact selection
- deep-link directly to an artifact
- reload preserves route
- iframe loads relative artifact assets
- TOC navigation reaches an artifact heading

VRT can be introduced later for the stable application shell. Arbitrary artifact contents should not become the primary VRT responsibility.

## 15. AWS reference architecture

AWS is the first intended production adapter, after the local contract is stable.

Expected static architecture:

~~~text
Git
 ↓
GitHub Actions / publisher
 ↓
private S3
 ↓ OAC
CloudFront
 ↓
Browser
~~~

Expected CloudFront routing has three conceptual behaviors:

~~~text
/_indexes/*    → static index content
/_artifacts/*  → static artifact content
Default (*)    → SPA shell
~~~

The first two patterns do not overlap, so their relative order is not semantically important. The default behavior is the fallback.

SPA routes such as /sre/incidents/123 must resolve to the application shell rather than being looked up as literal S3 object keys. The AWS adapter will therefore need an SPA fallback/rewrite mechanism.

The S3 bucket remains private and CloudFront reads it through Origin Access Control.

## 16. Cache model

The application and content planes have different lifecycles.

Expected direction:

~~~text
/index.html             short/revalidated
/assets/<hashed>*       long/immutable

/_indexes/*             short/revalidated
/_artifacts/*           cache according to publication model
~~~

Artifact paths may later become commit-addressed/immutable, which would allow aggressive CDN caching. That is an optimization, not an MVP requirement.

## 17. Publishing and AWS credentials

The intended GitHub-to-AWS path uses GitHub Actions OIDC rather than long-lived AWS access keys.

Publishers should eventually be scoped to the S3 prefixes they own.

The exact IAM model belongs to the AWS/publisher phase.

## 18. Access control

Repository read permission and website viewer permission are separate concerns.

The first AWS reference implementation may support simple deployment-level controls such as:

- network/IP restrictions
- Basic Authentication
- an existing organizational identity layer

Mirroring GitHub repository ACLs for each viewer is not an initial goal.

## 19. Distribution model

The eventual OSS distribution is expected to be a set of versioned components rather than one copied template.

Possible surfaces:

~~~text
core / CLI
bundled SPA
Terraform AWS module
GitHub Action
reusable workflow examples
~~~

The core product contract should not require AWS. AWS is a reference infrastructure adapter.

Do not freeze package/repository boundaries before the local and AWS implementations validate the contracts.

## 20. Non-goals for the MVP

- server-side rendering
- database
- request-time search API
- browser-side S3 ListObjects
- per-viewer GitHub OAuth authorization
- PR/branch preview environments
- arbitrary dynamic backend execution
- a generalized documentation CMS
- automatic interpretation of every possible HTML/browser feature

## 21. Architectural invariants

Treat changes to these as architecture decisions:

~~~text
Git is the source of truth.

The served system is a static projection.

The SPA application plane and artifact content plane are independently deployable.

A site is a logical namespace, not a repository.

Multiple repositories may contribute to one site.

Mount paths within one site must not overlap.

The browser consumes per-site indexes rather than listing object storage.

Artifacts live under /_artifacts.

Indexes live under /_indexes.

Logical user routes do not expose the storage projection as the main UX.

Prefer publish-time computation over request-time services.
~~~
