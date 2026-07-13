<!-- docs/digital_twin/mcft/cap_04/GEOX-MCFT-CAP-04-FAILURE-RECOVERY-CONTRACT.md -->

# GEOX MCFT-CAP-04 Failure and Recovery Contract

## Transaction boundary

A1 and A2 each append exactly eight canonical facts in one fenced PostgreSQL transaction. B appends exactly one canonical Scenario Set fact in a separate fenced transaction. Any injected failure before commit rolls back canonical facts, uniqueness guards, pointer updates, idempotency rows and projections together.

## Uniqueness

A1 and A2 share one terminal tick uniqueness authority over scope, lineage, revision and logical time. A second variant for the same terminal tick fails closed. B uniqueness is bound to source Forecast ref/hash plus lineage and revision. A second non-idempotent Scenario Set for that source Forecast fails closed.

## Response-loss recovery

A repeated A1/A2/B request with the same idempotency key, record identity and aggregate hash returns the canonical readback without duplicate writes. A conflicting semantic payload under the same idempotency key fails with IDENTITY/IDEMPOTENCY conflict.

## Pending Scenario barrier

A successful Forecast becomes pending when it is the latest successful Forecast and no Scenario uniqueness row exists. B commit clears this condition. A blocked Forecast never becomes Scenario-eligible.

## Projection recovery

Forecast and Scenario projections are rebuildable from append-only facts and guard identity metadata. Projection rows are not canonical truth. Divergence or deletion requires explicit rebuild; silent repair is forbidden.

## Preserved boundary

This contract does not implement tick orchestration, range execution, restart/backfill closure, routes, web, scheduler, recommendation, decision, AO-ACT, model activation or continuous/live Runtime claims.
