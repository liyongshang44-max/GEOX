# docs/tasks/POSTV1-05-DB-Index-Query-Cost-Audit.md

## Purpose

POSTV1-05 audits Twin Kernel v1 productionization database lookup paths before real production adapters increase write and read volume.

This task is not general performance tuning. It records the current index inventory, checks route query surfaces, applies one observed missing index, and adds a basic EXPLAIN readout acceptance.

## Phase

```text
Post-Twin-Kernel-v1 Productionization
P1 Production Hardening
```

## Second audit result

Before implementation, repository facts were:

```text
POSTV1-01 Production Hardening Baseline is complete.
POSTV1-02 Strong Multi-Scope Fixture Pack is complete.
POSTV1-03 Ingestion Idempotency & Error Taxonomy is complete.
POSTV1-04 Route Negative Runtime Matrix is complete.
No POSTV1-05 PR exists.
No pv1-05 branch exists.
```

Route query audit result:

```text
production_ingestion_event_v0 source_system + source_event_id lookup is covered by a unique constraint.
production_ingestion_event_v0 decision_cycle_id readback is covered by production_ingestion_event_v0_decision_cycle_idx.
trace readback object lookups are primary-key lookups.
business closure decision-cycle dependent readbacks are covered by decision_cycle_id indexes.
field_learning_candidate_v1 lookup is covered by the primary key.
operator decision queue lookup was the only observed route query path without a matching index.
```

## Scope

POSTV1-05 changes:

```text
apps/server/db/migrations/2026_06_29_postv1_05_query_cost_audit_indexes.sql
docs/tasks/POSTV1-05-DB-Index-Query-Cost-Audit.md
scripts/governance_acceptance/POSTV1_05_DB_INDEX_QUERY_COST_AUDIT.cjs
```

## Index change

POSTV1-05 adds exactly one index:

```sql
CREATE INDEX IF NOT EXISTS decision_cycle_v1_operator_queue_idx
  ON decision_cycle_v1 (created_at DESC)
  WHERE cycle_status = 'DECISION_CYCLE_READY'
    AND (external_refs_json->>'acceptance_id') IS NOT NULL
    AND (
      (external_refs_json->>'roi_entry_id') IS NULL
      OR (external_refs_json->>'field_memory_id') IS NULL
    );
```

This index matches the TK14 operator decision queue route:

```text
GET /api/v1/twin-kernel/operator-workflow/decision-cycles
```

The index is partial because only decision cycles ready for operator formalization belong in that queue.

## Acceptance coverage

The acceptance performs:

```text
static route query-path audit
migration token audit
migration application through PostgreSQL
index inventory readback
basic EXPLAIN JSON readout
operator queue index applicability check
production ingestion lookup plan check
trace readback lookup plan check
business closure lookup plan check
field_learning_candidate_v1 lookup plan check
forbidden semantic-change scan
```

## Boundary

```text
No route change.
No UI.
No table redesign.
No schema expansion beyond one index.
No production adapter.
No automatic recommendation.
No automatic approval.
No AO-ACT task creation.
No receipt creation.
No acceptance creation.
No automatic ROI creation.
No automatic Field Memory creation.
No model update.
No semantic change.
```

## Acceptance command

```powershell
node scripts/governance_acceptance/POSTV1_05_DB_INDEX_QUERY_COST_AUDIT.cjs
```

Default database connection:

```text
postgres://landos:landos_pwd@127.0.0.1:5433/landos
```

Override with:

```powershell
$env:DATABASE_URL="postgres://landos:landos_pwd@127.0.0.1:5433/landos"
```

## Expected result

```text
ok = true
acceptance = POSTV1_05_DB_INDEX_QUERY_COST_AUDIT
required_index_count >= 20
explain_plan_count >= 8
operator_queue_index_verified = true
next_step = POSTV1-06_DOCKER_STARTUP_MIGRATION_RUNNER_BASELINE
```

## Remaining P1 task after POSTV1-05

```text
POSTV1-06 Docker Startup / Migration Runner Baseline
```
