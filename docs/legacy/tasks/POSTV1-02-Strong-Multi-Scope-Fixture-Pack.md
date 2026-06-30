# docs/tasks/POSTV1-02-Strong-Multi-Scope-Fixture-Pack.md

## Purpose

POSTV1-02 implements the strong multi-scope fixture coverage that remained open after TK16.

TK16 is accepted as a configurable multi-scope regression harness framework.

TK16 must not be described as full strong fixture coverage.

POSTV1-02 closes that specific P1 production-hardening gap with a real runtime acceptance.

## Phase

```text
Post-Twin-Kernel-v1 Productionization
P1 Production Hardening
```

## Repository second audit result

Before implementation, the repository facts are:

```text
POSTV1-01 Production Hardening Baseline is complete.
POSTV1 phase line freeze is complete.
POSTV1-02 has no merged PR.
POSTV1-02 has no runtime acceptance in main.
Existing Twin Kernel v1 runtime surfaces are sufficient for the fixture pack.
```

The existing surfaces used by this task are:

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

## Scope

POSTV1-02 adds:

```text
docs/tasks/POSTV1-02-Strong-Multi-Scope-Fixture-Pack.md
scripts/governance_acceptance/POSTV1_02_STRONG_MULTI_SCOPE_FIXTURE_PACK.cjs
```

## Runtime fixture requirements

The acceptance must create and validate at least six runtime cases:

```text
candidate_count >= 6
project/group/field scope count >= 3
season count >= 2
crop count >= 2
```

The default fixture pack uses six distinct project/group/field scopes so crop checks cannot be hidden by field-index overwrites.

## Runtime chain per case

Each case runs this chain:

```text
source-index fixture rows
鈫?field_state_snapshot_v1
鈫?forecast_run_v1
鈫?scenario_set_v1
鈫?calibration_replay_v1 + forecast_error_v1
鈫?field_learning_candidate_v1
鈫?production_ingestion_event_v0 + decision_cycle_v1
鈫?operator_session_v0
鈫?operator_decision_review_v0
鈫?roi_entry_v1 through explicit operator action
鈫?field_memory_v1 through explicit operator action
鈫?trace readback
鈫?business closure readback
```

## Isolation assertions

The acceptance verifies:

```text
candidate_count >= 6
project/group/field scopes do not collapse
at least 2 seasons are present
at least 2 crops are present
pointer refs remain case-local
decision cycle snapshot season matches the fixture case
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

The script seeds only the minimum source-index rows required to make each synthetic fixture snapshot ready.

The script does not seed recommendation, approval, AO-ACT task, receipt, acceptance, ROI, or Field Memory objects directly.

The script creates ROI and Field Memory only through the existing explicit operator workflow routes.

## Local schema drift note

Some long-lived local databases may have `field_index_v1` created before the current migration definition included the `crop` column.

Because the migration uses `CREATE TABLE IF NOT EXISTS`, an existing table is not automatically altered by replaying that migration.

When `field_index_v1.crop` is absent, `state_vector_json.field.crop` will be `null`.

POSTV1-02 does not silently alter schema.

In that case, the runtime acceptance records a schema-drift diagnostic and verifies crop isolation through:

```text
fixture crop metadata
explicit Field Memory memory_statement_json.crop_id
crop_count >= 2 across completed cases
```

This keeps POSTV1-02 inside fixture coverage and isolation regression.

Schema repair belongs to later P1 migration-runner hardening, not to this task.


## Production ingestion response shape note

The production ingestion route returns two companion objects:

```text
production_ingestion_event_v0
decision_cycle_v1
```

The returned `production_ingestion_event` exposes `tenant_id`, `project_id`, `group_id`, and `field_id`.

The returned `decision_cycle` is intentionally compact and does not expose those scope fields in the immediate POST response.

Therefore POSTV1-02 verifies scope locality in two places:

```text
immediate production_ingestion_event readback
later decision_cycle GET readback
```

The script must not treat the compact POST `decision_cycle` response as the full decision-cycle read model.

## Acceptance command

```powershell
node scripts/governance_acceptance/POSTV1_02_STRONG_MULTI_SCOPE_FIXTURE_PACK.cjs
```

Required runtime:

```text
API server running on TWIN_KERNEL_BASE_URL or http://127.0.0.1:3001
Postgres reachable through DATABASE_URL or postgres://landos:landos_pwd@127.0.0.1:5433/landos
```

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

## Remaining P1 tasks after POSTV1-02

```text
POSTV1-03 Ingestion Idempotency & Error Taxonomy
POSTV1-04 Route Negative Runtime Matrix
POSTV1-05 DB Index / Query Cost Audit
POSTV1-06 Docker Startup / Migration Runner Baseline
```
