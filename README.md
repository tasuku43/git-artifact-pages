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

Phase 1 local product prototype. The SPA now discovers sites from per-site indexes and provides a site picker, recent-artifact home, searchable navigation tree, command palette, and an iframe-based artifact viewer. The interface is being shaped in Storybook against committed fixtures.

AWS infrastructure and reusable distribution packages come later.

## Local development

Install dependencies and start the Vite development server:

~~~sh
npm install
npm run dev
~~~

Run the isolated UI design workspace with:

~~~sh
npm run storybook
~~~

Storybook uses the same React components and CSS as the application, with the committed site indexes and artifact fixtures. Open the **Product / Workspace** stories for the site home, artifact viewer, and theme variants; the **Navigation** stories cover the site picker, sidebar, and command-palette search modes.

Create a production build with:

~~~sh
npm run build
npm run preview
~~~

Build both the application and the Storybook catalog with:

~~~sh
npm run build
npm run build-storybook
~~~

To serve the production build with the local nginx contract:

~~~sh
npm run serve:local
~~~

This serves the SPA on `http://localhost:4173/`, fixture indexes below `/_indexes/`, and fixture artifacts below `/_artifacts/`. Any other route falls back to the SPA shell.

## Core ideas

- Git-managed artifacts remain versioned with the work that produced them.
- A site is a logical namespace such as sre or frontend.
- Multiple repositories may publish into one site as long as their mounted paths do not overlap.
- /_artifacts/* contains published static files.
- /_indexes/<site>.json contains the searchable/browsable projection for a site.
- The SPA is stable infrastructure; artifact content and site indexes change independently.
- Search, recent items, tree navigation, and table-of-contents metadata are precomputed at publish time where practical.

See [the thesis](docs/thesis.md), [specification](docs/specification.md), and [roadmap](docs/roadmap.md).
