> **Incident retrospective · 23 September 2026**
>
> The regional latency increase was contained before it became a customer-visible outage. This report is intentionally written as a compact executive brief rather than a runbook.

## Outcome at a glance

| Signal | Before | Peak | Recovered |
| --- | ---: | ---: | ---: |
| p95 latency | 118 ms | 241 ms | 126 ms |
| Retry rate | 0.8% | 4.6% | 0.9% |
| Error budget burn | 0.4× | 3.1× | 0.5× |

The table is deliberately wider than a narrow viewport when expanded with additional columns; it should scroll inside the document instead of widening the entire workspace.

## Timeline

| Time (UTC) | Event | Owner | Decision |
| --- | --- | --- | --- |
| 09:14 | Elevated p95 detected | On-call | Page API team |
| 09:22 | Retry amplification confirmed | API | Reduce retry ceiling |
| 09:38 | Regional saturation eased | SRE | Hold capacity steady |
| 10:05 | SLO returned to target | Incident lead | Begin follow-up |

## What changed

The gateway retried a narrow class of upstream timeouts more aggressively than expected. A staged rollout raised the effective request volume during a partial regional degradation.

### Evidence

```text
gateway.retry.attempts      3.8x baseline
service.mesh.queue_depth    +41%
edge.p95.latency            +103 ms
```

The mitigation was to lower the retry ceiling, drain the affected pool, and verify recovery in each region before changing capacity.

## Follow-up

- [x] Add a per-region retry dashboard
- [x] Document the rollback threshold
- [ ] Run a partial-zone failure exercise
- [ ] Review client timeout defaults

---

> **Decision record**
>
> Do not increase service capacity until retry amplification has been ruled out. Scaling a feedback loop can make the incident more expensive without improving the user-visible outcome.
