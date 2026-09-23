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

A site is a logical destination, not a repository identity. The initial builder maps one repository source directory to one site. Combining sources from multiple repositories is deferred until a concrete use case requires it.

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
│   ├── sre.json
│   ├── frontend.json
│   └── platform.json
└── _artifacts/
    ├── sre/
    ├── frontend/
    └── platform/
~~~

### 5.1 Site discovery

The local reference implementation discovers available sites from the directory listing at `/_indexes/`, then loads each per-site index file.

Each `<site>.json` file is the source of that site's display metadata. No separate `sites.json` registry is required for the local product.

The directory listing changes when sites are onboarded, renamed, or removed. It does **not** change for each artifact publication unless the set of site files changes.

An object-storage/CDN adapter may provide an equivalent static listing or a generated catalog. The production representation is intentionally not fixed by the local milestone; the requirement is that root site selection remains serverless.

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
      "authors": [
        { "provider": "github", "login": "octocat" }
      ],
      "source": {
        "repository": "example/sre",
        "repositoryUrl": "https://github.com/example/sre",
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

The initial builder indexes `.html` and `.htm` documents as individual artifacts. A document named `index.html` or `index.htm` uses its containing directory as its logical route; other HTML filenames use their basename without the extension. `filename` and `artifactUrl` retain the actual source filename. Two documents that resolve to the same logical route are rejected rather than silently shadowing one another.

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

Relative resources should work naturally because artifact directory structure is preserved in the storage projection. Resolve ordinary HTML references from the artifact document URL, CSS `url()` references from the stylesheet URL, and module imports from the importing module URL.

Artifact-owned resources should normally use relative URLs that stay within their artifact directory. A root-relative URL such as `/assets/report.css` starts at the origin root and does not retain the `/_artifacts/<site>/...` namespace; enough `../` segments can also leave the artifact tree. Sites may contain identical relative paths and filenames; while references stay within their artifact directories, their full URLs remain distinct because each site's tree has its own prefix. Missing artifact resources should return a real 404, not the SPA fallback document.

## 7. Artifact viewer

Artifacts should initially be displayed using an iframe.

Reasons:

- preserve normal relative URL behavior
- isolate artifact CSS from the application shell
- avoid injecting arbitrary HTML into the SPA DOM
- allow normal browser HTML and JavaScript behavior for published artifacts
- keep the SPA focused on navigation and discovery

The iframe intentionally has no `sandbox` attribute. Publishing an artifact is the trust boundary: published HTML is treated as approved executable content and can use normal browser capabilities.

The hosting layer sends an enforced Content Security Policy that limits artifact resource loads to the current logical site's `/_artifacts/<site>/` path; local nginx demonstrates this contract. Inline scripts, styles, and eval remain allowed because published artifacts are trusted, but network resources must stay under that site prefix. Do not use `'self'` as the only source: all logical sites share one origin. External origins and other logical sites are blocked by default; additional sources should be added only when a published use case requires them.

CSP path matching does not constrain a same-origin redirect target. Artifact resources should therefore be served directly without redirects across site prefixes; any future hosting adapter must preserve both the policy and that serving behavior.

Artifacts are served from the same origin as the SPA under `/_artifacts/*`. The path-scoped policy limits resource loads initiated by the artifact document, but it is not a security boundary: an artifact script can still access the parent application and other same-origin resources. This product trusts published artifacts rather than isolating hostile publishers. If private or authenticated content, or mutually untrusted publishers, become part of the product, artifact hosting must move to a separate origin and the security model must be revisited before that use case is supported.

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

/:site discovers and loads /_indexes/<site>.json and initially presents recent artifacts, expected to start with roughly the latest 10 entries.

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

The optional right panel has two views, toggled from the workspace header:

- **Contents** displays table-of-contents metadata and navigates to heading anchors in the artifact.
- **Details** displays the artifact's author attribution, last-updated date, and source repository link/ref.

Both views use the same overlay panel so opening metadata does not narrow or reflow the artifact. `updatedAt` describes the artifact's last relevant source update, not the index generation time. `authors` is explicit content attribution (not an inferred last committer); each GitHub author is represented by provider and login. `source.repositoryUrl` is the canonical clickable repository URL, while `repository` remains its display name.

## 9. Initial builder source model

The initial index build consumes one source per site:

~~~text
(repository, ref, sourcePath)
~~~

Artifact paths and IDs are relative to `sourcePath`; repository identity is recorded as metadata, not exposed in the site's public route. For example:

~~~yaml
site: sre
repository: company/sre-monorepo
ref: main
sourcePath: docs/artifacts
~~~

An artifact-only repository can use its root as the source:

~~~yaml
site: sre
repository: company/sre-artifacts
ref: main
sourcePath: .
~~~

There is no mount-path merge in the initial builder. A later publisher may add explicit mounting if a validated use case needs it.

## 10. Multiple repositories in one site (deferred)

This is a possible future capability, not an MVP requirement. The initial builder does not merge multiple repositories or require a registry to allocate mount paths.

Example:

~~~text
site: sre

/incidents     ← company/sre
/architecture  ← company/platform
/runbooks      ← company/operations
~~~

If multi-repository publishing is introduced, the registry must guarantee that mount paths within a site do not overlap.

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

How multiple publisher contributions might be staged and merged into that single index is a future implementation concern. Source-specific manifests are one possible internal mechanism, but are not required by the browser-facing contract or the initial builder.

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
- explicit author attribution (GitHub account)
- commit SHA
- source repository
- source repository URL
- source ref
- headings / TOC
- optional tags
- optional description

Initial title extraction may use the HTML title element.

Sidecar metadata may be added later if HTML alone is insufficient.

The initial local builder does not infer explicit author attribution from the last Git committer. It omits `authors` until an artifact-level attribution source is defined; commit activity still supplies `updatedAt`.

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
- iframe loads nested relative artifact assets, modules, and data without crossing site prefixes
- CSP blocks requests to another logical site's artifact paths and external origins by default
- missing artifact resources return 404 rather than the SPA shell
- artifact styles remain inside the iframe document
- published scripts retain normal same-origin browser capabilities
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

A site is a logical namespace, not a repository identity.

The initial builder maps one repository source to each site; multi-repository merging is deferred. If it is introduced later, mount paths within a site must not overlap.

The browser consumes per-site indexes discovered through the local `/_indexes/` listing; it does not use browser-side object-storage ListObjects APIs.

Artifacts live under /_artifacts.

Indexes live under /_indexes.

Logical user routes do not expose the storage projection as the main UX.

Prefer publish-time computation over request-time services.
~~~
