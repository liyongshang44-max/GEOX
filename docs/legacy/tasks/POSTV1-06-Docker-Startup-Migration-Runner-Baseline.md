# docs/tasks/POSTV1-06-Docker-Startup-Migration-Runner-Baseline.md

## Purpose

POSTV1-06 closes P1 Production Hardening with a local Docker startup and migration-runner baseline.

The server already applies SQL migrations during startup. This task makes that behavior more observable and adds a preflight acceptance for service names, port mapping, server health, Postgres reachability, migration directory resolution, and critical migrated DB objects.

## Phase

```text
Post-Twin-Kernel-v1 Productionization
P1 Production Hardening
```

## Second audit result

```text
POSTV1-01 Production Hardening Baseline is complete.
POSTV1-02 Strong Multi-Scope Fixture Pack is complete.
POSTV1-03 Ingestion Idempotency & Error Taxonomy is complete.
POSTV1-04 Route Negative Runtime Matrix is complete.
POSTV1-05 DB Index / Query Cost Audit is complete.
No POSTV1-06 PR exists.
No pv1-06 branch exists.
```

## Scope

```text
apps/server/src/infra/migrations.ts
apps/server/src/bootstrap/server.ts
docs/tasks/POSTV1-06-Docker-Startup-Migration-Runner-Baseline.md
scripts/governance_acceptance/POSTV1_06_DOCKER_STARTUP_MIGRATION_RUNNER_BASELINE.cjs
```

## Runtime change

The migration runner keeps the same execution model:

```text
find the SQL migration directory
sort SQL files
run each non-empty SQL file through the existing pg pool
throw if no migration directory exists
```

POSTV1-06 only adds diagnostic visibility:

```text
checked migration directories
selected migration directory
sql file count
applied non-empty file count
skipped empty file count
migration file list
startup log message: sql_migrations_completed
```

## Acceptance coverage

```text
static task-line audit
static docker-compose service and port audit
static migration-runner diagnostic audit
static startup log audit
server health preflight
Postgres connectivity preflight
migration directory and SQL-file count readout
critical migrated table and index readback
POSTV1-05 operator queue index readback
```

## Boundary

```text
No infrastructure migration to another platform.
No cloud deployment work.
No new runtime semantics.
No route change.
No UI.
No table redesign.
No production adapter.
No automatic recommendation.
No automatic approval.
No AO-ACT task creation.
No receipt creation.
No acceptance creation.
No automatic ROI creation.
No automatic Field Memory creation.
No model update.
```

## Acceptance command

```powershell
node scripts/governance_acceptance/POSTV1_06_DOCKER_STARTUP_MIGRATION_RUNNER_BASELINE.cjs
```

## Expected result

```text
ok = true
acceptance = POSTV1_06_DOCKER_STARTUP_MIGRATION_RUNNER_BASELINE
compose_services_verified = [postgres, server, executor]
server_health_reachable = true
postgres_reachable = true
migration_sql_file_count >= 1
critical_db_objects_verified = true
startup_migration_summary_observable = true
p1_completed = true
```

## P1 completion

POSTV1-06 is the last P1 task. After this task is merged and tagged, P1 should be reviewed before P2 begins.
