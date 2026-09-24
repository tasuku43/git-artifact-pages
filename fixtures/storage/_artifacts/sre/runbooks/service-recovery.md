# Service recovery

A concise field guide for tracing a request across the edge, API gateway, and service mesh when latency rises.

## Request path

Follow a request across the boundaries below:

```mermaid
flowchart LR
  Edge[Global edge] --> Gateway[API gateway] --> Service[Service mesh]
```

![Request path from edge through gateway to services](./assets/request-path.svg)

## Recovery checks

| Check | Why it matters |
| --- | --- |
| Compare p95 by region | Separate local saturation from broad latency |
| Inspect gateway retries | Retries can amplify load |

- [x] Confirm the affected route and compare p95 latency by region.
- [ ] Check gateway retries before increasing service capacity.

[Open the related incident review](../incidents/checkout-latency/index.html).

<script>window.__markdownScriptShouldNotRun = true</script>
