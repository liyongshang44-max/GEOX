<!-- docs/frontend-productization/H61-REPLAY-DEMO-PRODUCTIZATION.md -->
# H61 Replay Demo Productization

Status: H61 Replay Demo Productization
Scope: Productize the existing replay-backed gateway demo page.
Write impact: NONE
Backend impact: NONE
DB impact: NONE
Route topology impact: NONE

H61 productizes replay-backed demo only.

Route remains:

```text
/operator/twin/gateway-demo
```

source remains checked-in P51 gateway viewer snapshot.
API remains static GET only.

H61 does not create backend contract.
H61 does not change route topology.
H61 does not claim live device.
H61 does not claim production gateway.
H61 does not claim Runtime Health.
H61 does not create facts.
H61 does not create recommendation.
H61 does not approve / dispatch / create AO-ACT.
H61 does not write ROI.
H61 does not write Field Memory.
H61 does not implement H62 Runtime Health.

Product surface:

```text
Replay-backed Gateway Demo
Static checked-in snapshot
Gateway Path Replay
Snapshot Source
Standards Mapping
Device Evidence Package
Ingestion Window
Traceability
Hashes
Evidence refs
Demo Boundary
```

Replay-backed Demo is not live production.
Device Evidence Package is not Runtime Health.
Gateway Path Replay is not production gateway online.
Traceability Readback is not trace creation.
Hashes are reproducibility metadata.

Acceptance:

```powershell
node scripts/frontend_acceptance/ACCEPTANCE_H61_REPLAY_DEMO_PRODUCTIZATION_V1.cjs
pnpm run typecheck:web
pnpm run build:web
```
