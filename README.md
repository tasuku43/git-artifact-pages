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

The first milestone is a local reference implementation using Vite + React, fixture content, Docker Compose, and nginx. AWS infrastructure and reusable distribution packages come later.

## Core ideas

- Git-managed artifacts remain versioned with the work that produced them.
- A site is a logical namespace such as sre or frontend.
- Multiple repositories may publish into one site as long as their mounted paths do not overlap.
- /_artifacts/* contains published static files.
- /_indexes/<site>.json contains the searchable/browsable projection for a site.
- The SPA is stable infrastructure; artifact content and site indexes change independently.
- Search, recent items, tree navigation, and table-of-contents metadata are precomputed at publish time where practical.

See [the thesis](docs/thesis.md), [specification](docs/specification.md), and [roadmap](docs/roadmap.md).
