<!-- docs/digital_twin/mcft/cap_01/GEOX-MCFT-CAP-01-FOUNDATION-IMPLEMENTATION.md -->
# GEOX MCFT-CAP-01 Foundation Implementation

## Authority

```text
capability_line_id: MCFT-CAP-01
display_alias: MCFT-1
baseline_main_commit: 94fe516ccbf8831be05c36ede5e2732bf7e19d55
status: IN_IMPLEMENTATION
included_slices: S1, S2, S3A
excluded_slices: S3B, S4, S5
```

This foundation writes the deterministic Replay Dataset generator, A0 contracts/config compiler, and A0 persistence foundation in one development branch. The three slices retain independent identities, dependencies, Gates, and completion states. This branch does not execute A0 and does not claim any canonical State.

## Frozen corrections

1. Replay records use a common envelope plus role-specific payloads; scalar value fields are not imposed on snapshots, plans, or execution records.
2. Dataset generation fixes interval schedule, role formulas, quality schedule, record ordering, UTF-8 without BOM, LF line endings, and required trailing newline.
3. Availability classification uses role-specific classification instants. Future assumption horizon time is not confused with snapshot Evidence time.
4. Runtime config compilation accepts parsed authority artifacts and has no filesystem, database, network, random, or wall-clock dependency.
5. Semantic hashes exclude their own declared hash fields, storage fact IDs, and audit timestamps.
6. Operational lease expiry is governed by PostgreSQL transaction time and never enters semantic identity.
7. Slice status is machine-readable in `GEOX-MCFT-CAP-01-DELIVERY-SLICE-STATUS.json`.

## Claim boundary

```text
NO_A0_RUNTIME_EXECUTION
NO_BOOTSTRAP_POSTERIOR_COMMITTED
NO_ACTIVE_INITIAL_LINEAGE
NO_INITIAL_CHECKPOINT
NO_SUCCESSFUL_FORECAST
NO_PROPAGATION
NO_CONTINUOUS_RUNTIME
```
