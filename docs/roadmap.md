# Roadmap

The roadmap is intentionally staged. Each phase should prove a stable contract before the next infrastructure layer is added.

## Phase 1 — Local product

Build the product locally without AWS.

Target stack:

- Vite
- React + TypeScript
- nginx
- Docker Compose
- fixture indexes and artifacts
- Vitest
- Storybook interaction tests
- Playwright E2E

Target user experience:

- / shows available sites.
- /:site shows the site home and recent artifacts.
- /:site/* deep-links to an artifact.
- Left sidebar shows a searchable/filterable artifact tree.
- Main pane renders the selected artifact in an iframe.
- An optional right panel switches between indexed contents and artifact details (author, update date, and source).
- Direct navigation and reload restore the same state.

VRT is optional at this stage and should focus on the application shell rather than arbitrary artifact contents.

## Phase 2 — Local projection builder

Build the per-site index from one Git repository source directory:

~~~text
source repository + sourcePath
        ↓
_indexes/<site>.json
~~~

The initial Go command indexes nested artifact entrypoints, extracts display metadata, and computes artifact update times from Git history and working-tree changes. It does not copy artifact bytes or publish to a hosting provider; those files remain in their source tree for a later copy/deploy step. Explicit author attribution is omitted until its artifact-level source is defined rather than inferred from the last committer.

The full source tree is scanned on each build. Generated 1,000-, 5,000-, and 10,000-file fixture trees are ignored by Git and used to validate whether incremental indexing is needed.

Use one repository source per site for this milestone. Registry enforcement, mount ownership, multi-repository merging, and provider publishing are deferred until the static index contract is validated.

The public contract should remain simple even if internal merge/staging mechanics evolve.

## Phase 3 — AWS reference deployment

Provide a reference AWS deployment:

- private S3 origin
- CloudFront
- Origin Access Control
- SPA fallback/rewrite
- cache policies appropriate to application, indexes, and artifacts
- optional access controls
- GitHub Actions OIDC for publishing

Prefer Terraform for the reference infrastructure.

## Phase 4 — Reusable distribution

Package the system so another organization can adopt it without copying implementation code.

Expected distribution surfaces:

- CLI / core package
- bundled SPA
- Terraform AWS module
- GitHub Action
- reusable workflow examples

Do not lock these package boundaries until Phases 1–3 make the contracts clear.

## Before an OSS release

- choose an OSS license
- define compatibility/versioning policy for index and registry schemas
- document security assumptions for arbitrary HTML/JavaScript artifacts
- document upgrade and rollback behavior
