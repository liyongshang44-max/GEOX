<!-- docs/digital_twin/GEOX-MCFT-VERTICAL-CAPABILITY-LINE-AMENDMENT-01.md -->
# GEOX MCFT Vertical Capability Line Amendment 01

## 0. Authority

```text
amendment_id: MCFT-VERTICAL-AMENDMENT-01
work_id: MCFT-GOV-01
name: Vertical Capability Line Amendment 01
type: governance-only task-line amendment
baseline_branch: main
baseline_commit: 7dbdce40a55740fbf48dbffe18f8343d17d07953
baseline_meaning: MCFT-00 Reality Binding Contract merged
predecessor: MCFT-00 COMPLETE
successor: DT02-AMENDMENT-02 Initial Lineage and Bootstrap State Semantics
status: PENDING_ACCEPTANCE
```

This amendment introduces orthogonal identifiers for vertical executable capability closure and horizontal DT-02 implementation ownership. It creates no Runtime source, migration, canonical object, State, Forecast, Scenario, checkpoint, public write route, or production capability.

## 1. Identifier model

```text
capability_line_id
  vertical executable capability closure unit

owner_work_package_id
  horizontal DT-02 architecture ownership catalogue entry

delivery_slice_id
  one bounded implementation slice delivered by a capability line
```

The first capability line is frozen as:

```yaml
capability_line_id: MCFT-CAP-01
display_alias: MCFT-1
name: First-Class Water State Estimate
runtime_mode: REPLAY
target_completion_level: Level A
```

`MCFT-01` through `MCFT-18` remain owner work-package identifiers. They are not renamed and are not reinterpreted as capability-line completion claims.

Every implementation artifact that belongs to a vertical slice must declare:

```yaml
capability_line_id: MCFT-CAP-01
display_alias: MCFT-1
delivery_slice_id: MCFT-CAP-01.MCFT-08.BOOTSTRAP-POSTERIOR-V1
primary_owner_work_package_id: MCFT-08
contributing_work_package_ids:
  - MCFT-07
depends_on_delivery_slice_ids: []
```

`primary_owner_work_package_id` is singular. Cross-package participation is represented only through `contributing_work_package_ids`.

## 2. Existing MCFT-00 ownership remains authoritative

MCFT-00 remains immutable. Its frozen ownership values continue to mean architecture ownership:

```text
compile_target.owner_phase = MCFT-02
persistence_target.owner_phase = MCFT-03
```

This amendment does not modify the MCFT-00 Reality Binding artifact, Closure Record, source matrix, configuration matrix, geometry, binding ID, or hashes.

The consumed frozen identity remains:

```text
binding_id: mcft_rb_bf1da664164a4fedda249bcb
reality_hash: sha256:bf1da664164a4fedda249bcb0e330c1af2083173a52bd704f01eac3ad277ba4f
source_matrix_hash: sha256:c5187c23be0d058ffa23d464ae1139f924f5af064a270248746fbabde4c3e51b
configuration_matrix_hash: sha256:381ef166454c7b698c6641fadc5d08019fecff127e9529a4c58a1f09d9e1fef5
geometry_semantic_hash: sha256:d3dbc5495485e7af68acdc4b32e6061c2ea99772835be2805ae706b74d75ca51
```

## 3. Dependency and partial-establishment rule

The existing `MCFT-00 -> MCFT-01 -> ... -> MCFT-18` ordering remains the semantic dependency order.

It no longer means that an owner work package must be fully closed before a later work package may deliver a strictly bounded slice. A slice may proceed only when:

1. all required predecessor slices are explicitly listed;
2. the slice does not claim the complete owner work package;
3. the slice does not silently re-decide frozen DT-02 semantics;
4. the capability matrix records the exact partial status and nonclaims;
5. the slice Gate proves its changed-file boundary and dependency graph.

Allowed work-package delivery states are:

```text
NOT_STARTED
SLICE_PLANNED
PARTIALLY_ESTABLISHED
COMPLETE
```

Closing a capability line does not close every contributing owner work package.

## 4. MCFT-CAP-01 authorized slices

MCFT-CAP-01 may deliver only these bounded ownership slices:

```text
MCFT-01  Canonical Replay Dataset
MCFT-02  A0 canonical object/config subset
MCFT-03  A0 persistence subset
MCFT-04  bootstrap transaction only
MCFT-05  bootstrap Evidence Window only
MCFT-07  static bootstrap observation/assimilation only
MCFT-08  one first-class posterior State
MCFT-09  BLOCKED Forecast outcome only
```

MCFT-06 is not part of MCFT-CAP-01.

MCFT-CAP-01 explicitly excludes:

```text
propagation
water balance
rainfall application
ET application
irrigation application
continuous hourly runtime
restart/backfill recovery
late-Evidence revision runtime
successful 72-point Forecast
Scenario
Recommendation
Decision
Action loop
live field operation
```

## 5. Planned owner work-package status at MCFT-CAP-01 closure

```yaml
MCFT-01:
  status: COMPLETE
  established_scope: 30-day controlled Canonical Replay Dataset

MCFT-02:
  status: PARTIALLY_ESTABLISHED
  established_scope: A0 object and Runtime config subset only

MCFT-03:
  status: PARTIALLY_ESTABLISHED
  established_scope: A0 persistence, lease, fencing, idempotency and projection subset only

MCFT-04:
  status: PARTIALLY_ESTABLISHED
  established_scope: A0 bootstrap transaction only

MCFT-05:
  status: PARTIALLY_ESTABLISHED
  established_scope: bootstrap Evidence Window only

MCFT-06:
  status: NOT_STARTED
  established_scope: none

MCFT-07:
  status: PARTIALLY_ESTABLISHED
  established_scope: static bootstrap observation operator and assimilation only

MCFT-08:
  status: PARTIALLY_ESTABLISHED
  established_scope: one first-class posterior State and next-tick handoff only

MCFT-09:
  status: PARTIALLY_ESTABLISHED
  established_scope: BLOCKED zero-point Forecast outcome only
```

## 6. Governance preconditions

MCFT-CAP-01 Runtime implementation remains prohibited until both are merged and accepted:

```text
MCFT-VERTICAL-AMENDMENT-01
DT02-AMENDMENT-02
```

Before those amendments are complete, the capability-line state is:

```text
DESIGN_CONDITIONALLY_APPROVED
GOVERNANCE_AMENDMENTS_NOT_YET_MERGED
RUNTIME_IMPLEMENTATION_PROHIBITED
```

After both amendments are complete, the state becomes:

```text
READY_FOR_IMPLEMENTATION
```

## 7. Delivery slices

The planned slice graph is:

```text
MCFT-CAP-01.MCFT-01.CANONICAL-REPLAY-DATASET-V1
  -> MCFT-CAP-01.MCFT-02.A0-CONTRACTS-AND-CONFIG-V1
  -> MCFT-CAP-01.MCFT-03.A0-PERSISTENCE-V1
  -> MCFT-CAP-01.MCFT-07-08.BOOTSTRAP-STATE-MATH-V1
  -> MCFT-CAP-01.MCFT-04-05-08-09.A0-RUNTIME-INTEGRATION-V1
  -> MCFT-CAP-01.CLOSURE-V1
```

The Runtime integration slice must not re-open either governance amendment.

## 8. Capability claim rule

MCFT-CAP-01 closure may establish only bounded bootstrap capabilities. It must not change these existing matrix capabilities to complete:

```text
DT-MATRIX-HOURLY-TICK
DT-MATRIX-PROPAGATION
DT-MATRIX-RESTART
DT-MATRIX-LATE-REVISION
DT-MATRIX-72H-REGEN
```

The closure phase may add bounded capabilities such as:

```text
DT-MATRIX-A0-BOOTSTRAP-TRANSACTION
DT-MATRIX-FIRST-CLASS-WATER-POSTERIOR
DT-MATRIX-BOOTSTRAP-ASSIMILATION
DT-MATRIX-BOOTSTRAP-CHECKPOINT-HANDOFF
```

Only executable evidence may change them from planned to established.

## 9. Changed-file boundary

This amendment is governance-only.

Allowed:

```text
docs/digital_twin/**
scripts/governance_acceptance/ACCEPTANCE_MCFT_VERTICAL_CAPABILITY_LINE_AMENDMENT_01.cjs
```

Necessary exact predecessor-Gate compatibility edits are allowed only when they do not weaken predecessor semantics.

Forbidden:

```text
apps/server/**
apps/web/**
fixtures/mcft/water_state/**
apps/server/db/migrations/**
package.json
pnpm-lock.yaml
.github/workflows/**
Runtime source
canonical State write
public Runtime write route
```

## 10. Completion statement

This amendment may claim only:

```text
MCFT_VERTICAL_CAPABILITY_LINE_MODEL_FROZEN
WORK_PACKAGE_OWNERSHIP_PRESERVED
PARTIAL_ESTABLISHMENT_SEMANTICS_FROZEN
NO_RUNTIME_IMPLEMENTATION
NO_CANONICAL_WRITE
```

Its only successor is:

```text
DT02-AMENDMENT-02 — Initial Lineage and Bootstrap State Semantics
```
