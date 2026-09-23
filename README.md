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

Storybook uses the same React components and CSS as the application, with the committed site indexes and artifact fixtures. Site Home uses full-path labels, while the artifact sidebar uses subtle branch guides. The **Product / Workspace** stories cover site home, artifact viewing, light and dark themes, and the collapsed Reader rail. **Navigation** stories cover the site picker and command-palette search modes.

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

On first use, install the Playwright Chromium browser, then run the end-to-end checks against the production build served by nginx:

~~~sh
npx playwright install chromium
npm run test:e2e
~~~

The command builds the SPA first, starts an isolated Compose nginx service on port `4174`, and removes that test service when finished. The regular local service on `4173` is left untouched. Docker Compose and the Playwright Chromium browser are required. Tests cover site discovery, deep-link/reload behavior, relative artifact assets, and the collapsed navigation rail.

## Local index builder prototype

The Go builder creates one site's index from a publishable static content directory inside a Git working tree. Point `--source` at the exact tree that should be served under `/_artifacts/<site>/`, containing ready-to-serve HTML and its local resources—not an unrendered template/source tree. It does not render templates, bundle assets, rewrite URLs, copy artifact files, or publish to a hosting provider.

Every `.html` and `.htm` file below the selected directory becomes an artifact except a root-level `index.html` or `index.htm`, which is treated as site-level content and omitted from the artifact index. Nested index files use their containing directory as the logical route; other filenames become routes without their extension. There are no path-name exclusions: if `_includes` or another partial/template directory is inside the selected tree, its HTML files are indexed too. Choose a publishable root that excludes such source-only files.

The source directory must be inside the current Git working tree. Tracked files provide Git-based update metadata. Untracked files, including Git-ignored generated output, can still be indexed, but `updatedAt` then falls back to filesystem modification times and `lastCommitter` is omitted.

Requires Go 1.26 or newer.

~~~sh
go run ./cmd/git-artifact index build \
  --site sre \
  --site-title SRE \
  --source fixtures/storage/_artifacts/sre \
  --out .local/storage
~~~

This writes `.local/storage/_indexes/sre.json`. The source tree is left untouched, and every indexed page points to its original file under the source-relative artifact path. A later static publish step should copy the selected content tree unchanged so relative CSS, JavaScript, images, and other resources retain their paths. The initial builder expects one repository source per site.

Run the Go tests and the benchmarks with generated fixtures in temporary Git repositories. The file-count benchmark uses 1,000, 5,000, and 10,000 source files, corresponding to 100, 500, and 1,000 HTML pages. A second benchmark measures 500 and 1,000 HTML pages with 51 commits in the history:

~~~sh
go test ./...
go test ./internal/indexer -run '^$' -bench=BenchmarkBuildIndexFiles -benchtime=5x -benchmem
go test ./internal/indexer -run '^$' -bench=BenchmarkBuildIndexGitHistoryPages -benchtime=3x -benchmem
~~~

## Core ideas

- Git-managed artifacts remain versioned with the work that produced them.
- A site is a logical namespace such as sre or frontend.
- The initial index builder maps one repository source directory to one site; merging multiple repositories into a site is deferred.
- /_artifacts/* contains published static files.
- /_indexes/<site>.json contains the searchable/browsable projection for a site.
- The SPA is stable infrastructure; artifact content and site indexes change independently.
- Search, recent items, tree navigation, and table-of-contents metadata are precomputed at publish time where practical.

See [the thesis](docs/thesis.md), [specification](docs/specification.md), and [roadmap](docs/roadmap.md).
