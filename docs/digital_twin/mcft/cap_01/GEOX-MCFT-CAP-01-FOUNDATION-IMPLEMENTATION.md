<!-- docs/digital_twin/mcft/cap_01/GEOX-MCFT-CAP-01-FOUNDATION-IMPLEMENTATION.md -->
# GEOX MCFT-CAP-01 Foundation Implementation

## Authority

```text
capability_line_id: MCFT-CAP-01
display_alias: MCFT-1
baseline_main_commit: 94fe516ccbf8831be05c36ede5e2732bf7e19d55
status: IN_IMPLEMENTATION
completed_slices: S1, S2, S3A
next_authorized_slice: MCFT-CAP-01.MCFT-07-08.BOOTSTRAP-STATE-MATH-V1
excluded_slices: S4, S5
```

This foundation establishes the deterministic Replay Dataset, A0 contracts/config compiler, and A0 persistence foundation as three independently closed delivery slices. MCFT-CAP-01 remains in implementation because bootstrap State mathematics, A0 Runtime integration, and capability-line closure are not established.

## Frozen corrections

1. Replay records use a common envelope plus role-specific payloads; scalar value fields are not imposed on snapshots, plans, or execution records.
2. Dataset generation fixes interval schedule, role formulas, quality schedule, record ordering, UTF-8 without BOM, LF line endings, and required trailing newline.
3. Availability classification uses role-specific classification instants. Future assumption horizon time is not confused with snapshot Evidence time.
4. Runtime config compilation accepts parsed authority artifacts and has no filesystem, database, network, random, or wall-clock dependency.
5. Semantic hashes exclude their own declared hash fields, storage fact IDs, and audit timestamps.
6. Operational lease expiry is governed by PostgreSQL transaction time and never enters semantic identity.
7. Slice status and completion evidence are machine-readable in `GEOX-MCFT-CAP-01-DELIVERY-SLICE-STATUS.json`.

## Closure evidence

```text
implementation_candidate_head: 5975f8e1f1dfa6fc4a79b26c8a300ed6bdd869d3
ci: #4425 success
S1: 12 PASS, 0 FAIL
S2: 10 PASS, 0 FAIL
S3A static: 16 PASS, 0 FAIL
S3A PostgreSQL: 8 PASS, 0 FAIL
Foundation governance: 11 PASS, 0 FAIL
server typecheck/build: PASS
```

## Claim boundary

```text
NO_A0_RUNTIME_EXECUTION
NO_BOOTSTRAP_POSTERIOR_COMMITTED
NO_ACTIVE_INITIAL_LINEAGE
NO_INITIAL_CHECKPOINT
NO_SUCCESSFUL_FORECAST
NO_PROPAGATION
NO_CONTINUOUS_RUNTIME
NO_MCFT_CAP_01_CLOSURE
```
