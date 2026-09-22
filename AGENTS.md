# Agent guidance

Read these before making architectural changes:

1. docs/thesis.md
2. docs/specification.md
3. docs/roadmap.md

## Current phase

The repository is in **Phase 1: local product**.

Do not implement AWS infrastructure, Terraform, GitHub Actions publishing, or a general-purpose CLI unless explicitly requested. First prove the browser product and local serving contract.

## Current implementation direction

- Vite + React + TypeScript
- nginx behind Docker Compose as the local analogue of CloudFront routing
- committed fixtures model the future object-storage projection
- generated local output, when introduced, belongs under .local/ and stays untracked
- artifacts should be rendered in an iframe rather than injected into the SPA DOM
- the SPA should consume per-site index metadata; local discovery may use the nginx directory listing for `/_indexes/`

## Product boundaries

The stable application plane is:

~~~text
/index.html
/assets/*
~~~

The changing content plane is:

~~~text
/_indexes/*
/_artifacts/*
~~~

Logical user routes are:

~~~text
/
/:site
/:site/*
~~~

Do not expose storage paths as the primary user-facing navigation model.

## Keep abstractions honest

Avoid introducing backend services for functionality that can remain static. Avoid coupling the core product contract to AWS-specific APIs. Avoid making repository identity part of the public site URL unless the product specification explicitly requires it.

Prefer a small implementation that demonstrates the thesis over speculative framework code for future distribution.
