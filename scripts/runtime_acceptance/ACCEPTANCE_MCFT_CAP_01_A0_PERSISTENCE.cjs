// scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_01_A0_PERSISTENCE.cjs
// Purpose: statically verify the S3A migration/repository boundary before database-backed fault-injection acceptance is added.
// Boundary: foundation Gate only; it does not claim A0 Runtime execution or database proof.

'use strict';
const fs = require('node:fs');
const path = require('node:path');
const ROOT = path.resolve(__dirname, '../..');
const migration = fs.readFileSync(path.join(ROOT, 'apps/server/db/migrations/2026_07_09_mcft_cap_01_a0_persistence.sql'), 'utf8');
const repository = fs.readFileSync(path.join(ROOT, 'apps/server/src/persistence/twin_runtime/postgres_runtime_repository_v1.ts'), 'utf8');
const tables = ['twin_runtime_lease_v1','twin_object_idempotency_index_v1','twin_active_lineage_index_v1','twin_state_history_projection_v1','twin_state_latest_index_v1','twin_forecast_result_latest_index_v1','twin_forecast_success_latest_index_v1','twin_runtime_checkpoint_latest_index_v1','twin_runtime_health_latest_index_v1'];
let pass=0, fail=0; function check(v,m){if(v){pass++;console.log(`PASS ${m}`)}else{fail++;console.error(`FAIL ${m}`)}}
for (const table of tables) check(migration.includes(`public.${table}`), `migration declares ${table}`);
check(migration.includes('transaction_timestamp()'), 'Postgres transaction time is lease authority');
check(!migration.includes('CREATE TABLE IF NOT EXISTS public.twin_state_estimate'), 'no second canonical State table');
check(repository.indexOf('SELECT record_set_id,determinism_hash') < repository.indexOf('verifyLease(client'), 'idempotency lookup precedes lease/null-CAS');
check(repository.includes('STALE_FENCING_TOKEN'), 'stale fencing rejection present');
check(repository.includes('INITIAL_LINEAGE_CONFLICT'), 'canonical INITIAL uniqueness rejection present');
check(repository.includes('before_fact_') && repository.includes('before_commit'), 'fault injection stages present');
check(!repository.includes('Fastify') && !repository.includes('recommendation'), 'persistence boundary excludes routes and Recommendation');
console.log(`MCFT-CAP-01 S3A foundation: ${pass} PASS, ${fail} FAIL`); if(fail) process.exit(1);
