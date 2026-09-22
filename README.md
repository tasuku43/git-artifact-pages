# Git Artifact Pages

**Git Artifact Pages turns Git-managed static artifacts into searchable, browsable websites.**

Teams keep HTML reports, design documents, diagrams, generated explanations, and other static artifacts in Git. Git Artifact Pages publishes them into a stable web namespace and provides a lightweight SPA for discovery, search, navigation, and viewing.

The intended production shape is deliberately static:

~~~text
Git repositories
      ↓
publish pipeline
      ↓
S3
├── _indexes/
├── _artifacts/
├── index.html
└── assets/
      ↓
CloudFront
      ↓
Browser
~~~

There is no application server in the request path. Git is the source of truth; object storage is a serving projection.

## Status

Early design and local-prototype phase.

The Vite + React + TypeScript application shell is now bootstrapped and renders a Hello World page. Artifact discovery and the nginx-backed local serving contract are the next steps. AWS infrastructure and reusable distribution packages come later.

## Local development

Install dependencies and start the Vite development server:

~~~sh
npm install
npm run dev
~~~

Create a production build with:

~~~sh
npm run build
npm run preview
~~~

The current SPA is intentionally only a Hello World shell. The fixture projection under `fixtures/storage/` is not wired into the application yet.

## Core ideas

- Git-managed artifacts remain versioned with the work that produced them.
- A site is a logical namespace such as sre or frontend.
- Multiple repositories may publish into one site as long as their mounted paths do not overlap.
- /_artifacts/* contains published static files.
- /_indexes/<site>.json contains the searchable/browsable projection for a site.
- The SPA is stable infrastructure; artifact content and site indexes change independently.
- Search, recent items, tree navigation, and table-of-contents metadata are precomputed at publish time where practical.

See [the thesis](docs/thesis.md), [specification](docs/specification.md), and [roadmap](docs/roadmap.md).
