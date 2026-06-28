# docs/tasks/POSTV1-02-Strong-Multi-Scope-Fixture-Pack.md

## Purpose

POSTV1-02 implements the strong fixture coverage that was originally described in the pre-post-v1 TK16 target but not covered by the default TK16 acceptance run.

This task does not change Twin Kernel semantics.

It strengthens production hardening by proving that the existing Twin Kernel v1 execution-to-learning loop can run across multiple isolated scopes.

## Repository second audit result

The repository already contains:

```text
docs/tasks/POST-TWIN-KERNEL-V1-TASK-LINE.md
docs/tasks/POSTV1-01-Production-Hardening-Baseline.md
scripts/governance_acceptance/POSTV1_01_PRODUCTION_HARDENING_BASELINE.cjs
scripts/governance_acceptance/TK16_MULTI_SCOPE_REGRESSION_HARNESS.cjs
scripts/governance_acceptance/TK18_EXECUTION_TO_LEARNING_BUSINESS_CLOSURE_V0.cjs
```

The repository also contains existing runtime surfaces for this fixture pack:

```text
POST /api/v1/twin-kernel/field-state-snapshots
POST /api/v1/twin-kernel/forecast-runs
POST /api/v1/twin-kernel/scenario-sets
POST /api/v1/twin-kernel/calibration-replays
POST /api/v1/twin-kernel/field-learning-candidates
POST /api/v1/twin-kernel/production-ingestion/source-refs
POST /api/v1/twin-kernel/operator-workflow/sessions
POST /api/v1/twin-kernel/operator-workflow/reviews
POST /api/v1/twin-kernel/operator-workflow/formalization-actions/roi
POST /api/v1/twin-kernel/operator-workflow/formalization-actions/field-memory
GET  /api/v1/twin-kernel/traces/:decision_cycle_id
GET  /api/v1/twin-kernel/business-closures/:decision_cycle_id
```

Therefore POSTV1-02 must use existing surfaces.

It must not add a new route.

## Scope

POSTV1-02 adds:

```text
docs/tasks/POSTV1-02-Strong-Multi-Scope-Fixture-Pack.md
scripts/governance_acceptance/POSTV1_02_STRONG_MULTI_SCOPE_FIXTURE_PACK.cjs
```

## Fixture requirements

The runtime acceptance creates and validates at least six cases:

```text
candidate_count >= 6
project/group/field scope count >= 3
season count >= 2
crop count >= 2
```

The default fixture pack uses six project/group/field cases to avoid field-index crop overwrites.

## Runtime chain per case

Each case runs this chain:

```text
source-index fixture rows
→ field_state_snapshot_v1
→ forecast_run_v1
→ scenario_set_v1
→ calibration_replay_v1 + forecast_error_v1
→ field_learning_candidate_v1
→ production_ingestion_event_v0 + decision_cycle_v1
→ operator_session_v0
→ operator_decision_review_v0
→ roi_entry_v1 via explicit operator action
→ field_memory_v1 via explicit operator action
→ trace readback
→ business closure readback
```

## Isolation assertions

The acceptance verifies:

```text
candidate_count >= 6
project/group/field scopes do not collapse
at least 2 seasons are present
at least 2 crops are present
pointer refs do not cross fields
snapshot season_id matches the fixture case
decision cycle points to the expected snapshot
Field Memory crop statement matches the fixture case
business closure remains case-local
all decision cycles reach CALIBRATED
all business closures return business_closure_complete = true
model_update_created remains false
forbidden automatic writes remain absent
```

## Boundary

```text
No new route.
No migration.
No UI.
No new domain object.
No new Twin Kernel state-machine stage.
No automatic recommendation.
No automatic approval.
No automatic AO-ACT task.
No automatic receipt.
No automatic acceptance.
No automatic ROI formalization.
No automatic Field Memory policy write.
No automatic model update.
```

## Acceptance command

```powershell
node scripts/governance_acceptance/POSTV1_02_STRONG_MULTI_SCOPE_FIXTURE_PACK.cjs
```

The API server must be running.

The script also seeds only the minimum source-index rows required to make each synthetic fixture snapshot ready.

## Expected result

```text
ok = true
acceptance = POSTV1_02_STRONG_MULTI_SCOPE_FIXTURE_PACK
candidate_count >= 6
scope_count >= 3
season_count >= 2
crop_count >= 2
next_step = POSTV1-03_INGESTION_IDEMPOTENCY_AND_ERROR_TAXONOMY
```
