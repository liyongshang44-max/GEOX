#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');

const ROOT = process.cwd();
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const fail = (m, extra) => { console.error('[BLINE_PR_SEC_2_WEATHER_FAIL_CLOSED] FAIL:', m); if (extra !== undefined) console.error(JSON.stringify(extra, null, 2)); process.exit(1); };
const assert = (c, m, extra) => { if (!c) fail(m, extra); };

const predecessor = JSON.parse(read('docs/architecture/semantic_convergence/GEOX-BLINE-PRODUCTION-CALLER-AUTHORITY-INVENTORY-V1.json'));
const repair = JSON.parse(read('docs/architecture/semantic_convergence/GEOX-BLINE-PR-SEC-2-IMMEDIATE-CALLER-CONTAINMENT-V1.json'));
const weather = read('apps/server/src/routes/weather_v1.ts');
const sensing = read('apps/server/src/modules/sensing/registerSensingModule.ts');
const roles = read('apps/server/src/domain/auth/roles.ts');

const batch1 = repair.batches?.find((x) => x.batch_id === 'PRSEC2-BATCH-001');
const batch2 = repair.batches?.find((x) => x.batch_id === 'PRSEC2-BATCH-002B');
assert(batch1, 'Batch 1 mapping missing');
assert(batch2, 'Batch 2B mapping missing');
assert(batch2.source_surfaces?.length === 1 && batch2.source_surfaces[0] === 'BSEC-003', 'Batch 2B must contain BSEC-003 only');
assert(batch2.containment_decision === 'COMMERCIAL_FAIL_CLOSE', 'Batch 2B containment decision drift');
assert(batch2.new_principal_created === false, 'Batch 2B must not create a principal');
assert(batch2.new_capability_created === false, 'Batch 2B must not create a capability');
assert(batch2.mcft_implementation_changed === false, 'Batch 2B must not modify MCFT');

const row = predecessor.surfaces.find((x) => x.surface_id === 'BSEC-003');
assert(row, 'Frozen BSEC-003 inventory row missing');
assert(row.runtime_reachable === true, 'BSEC-003 frozen runtime reachability drift');
assert(row.authn_mode === 'NONE', 'BSEC-003 frozen authn baseline drift');
assert(Array.isArray(row.authz_capability) && row.authz_capability.length === 0, 'BSEC-003 frozen capability baseline drift');
assert(row.principal_type === 'UNVERIFIED_CALLER', 'BSEC-003 frozen principal baseline drift');
assert(row.caller_authority_status === 'UNAUTHENTICATED_PRODUCTION_WRITER', 'BSEC-003 caller authority baseline drift');
assert(row.tenant_scope_from_untrusted_body === true, 'BSEC-003 frozen tenant-body debt drift');

const batch1After = batch1.expected_after;
assert(batch1After.production_reachable_mutating_surface_without_authn === 33, 'Batch 2 must start from accepted Batch 1 unauth baseline');
assert(batch1After.production_reachable_semantic_writer_without_validated_capability === 107, 'Batch 2 must start from accepted Batch 1 capability baseline');
assert(batch1After.production_reachable_human_action_with_unverified_declared_actor === 7, 'Batch 2 human actor baseline drift');
assert(batch1After.production_reachable_service_writer_without_bound_principal === 3, 'Batch 2 service principal baseline drift');
assert(batch1After.tenant_scope_from_untrusted_body_or_unbound === 16, 'Batch 2 tenant baseline drift');

assert(sensing.includes('registerWeatherV1Routes(app, pool);'), 'Commercial sensing registration must include weather routes');
assert(weather.includes('app.post("/api/v1/weather/forecast/ingest"'), 'BSEC-003 route must remain explicit');
assert(weather.includes('WEATHER_FORECAST_INGEST_COMMERCIAL_AUTHORITY_UNAVAILABLE'), 'BSEC-003 deterministic fail-close error missing');
assert(!weather.includes('ingestWeatherForecastFactV1'), 'weather route module must not retain Commercial forecast ingest writer reachability');

const postStart = weather.indexOf('app.post("/api/v1/weather/forecast/ingest"');
const nextRoute = weather.indexOf('app.get("/api/v1/weather/forecast/latest"', postStart);
assert(postStart >= 0 && nextRoute > postStart, 'BSEC-003 handler block extraction failed');
const postBlock = weather.slice(postStart, nextRoute);
for (const forbidden of [
  'pool.query',
  'ingestWeatherForecastFactV1',
  'appendWeatherForecastFactV1',
  'upsertWeatherForecastIndexV1',
  'ensureWeatherForecastIndexV1',
  'setTimeout',
  'setInterval',
  'setImmediate',
  'queueMicrotask',
  '.then(',
  'addHook',
]) {
  assert(!postBlock.includes(forbidden), 'BSEC-003 rejection block contains deferred/writer reachability', forbidden);
}
assert(postBlock.includes('return reply.code(403).send'), 'BSEC-003 rejection must clean-return the single reply');

// The closure reason is reachability removal, not capability invention or trusted-body binding.
const computedDelta = {
  production_reachable_mutating_surface_without_authn: -1,
  production_reachable_semantic_writer_without_validated_capability: -1,
  production_reachable_human_action_with_unverified_declared_actor: 0,
  production_reachable_service_writer_without_bound_principal: 0,
  tenant_scope_from_untrusted_body_or_unbound: -1,
};
const computedAfter = Object.fromEntries(
  Object.entries(batch1After).map(([key, value]) => [key, value + (computedDelta[key] ?? 0)])
);
assert(JSON.stringify(batch2.machine_debt_delta) === JSON.stringify(computedDelta), 'Batch 2 declared debt delta must equal frozen-row reachability closure', { declared: batch2.machine_debt_delta, computed: computedDelta });
assert(JSON.stringify(batch2.expected_after) === JSON.stringify(computedAfter), 'Batch 2 after-state must be derived from accepted Batch 1 baseline', { declared: batch2.expected_after, computed: computedAfter });
assert(batch2.closure_reason?.capability_debt === 'PRODUCTION_WRITER_NO_LONGER_CALLER_REACHABLE_NOT_VALIDATED_CAPABILITY_CREATED', 'capability debt closure reason must remain reachability-based');
assert(batch2.closure_reason?.tenant_scope_debt === 'UNTRUSTED_BODY_SCOPE_NO_LONGER_REACHES_PRODUCTION_PERSISTENCE_NOT_TRUSTED_BINDING_CREATED', 'tenant debt closure reason must remain reachability-based');

// No role/capability widening in the existing role matrix.
for (const invented of ['weather.write', 'forecast.write']) {
  assert(!roles.includes(invented), `Batch 2 must not invent ${invented}`);
}

// Batch-2 file provenance is frozen at its accepted exact head. Later PR-SEC-2 batches
// must not be reclassified as Batch-2 scope expansion merely because this is a stacked PR.
const acceptedBatch1Head = '3a8c456509070698d4f2b3f19ffec71f3ce0e248';
const acceptedBatch2Head = '599604d7ace9c6c7cc09ba5fd761e3100d3f3403';
let changed = [];
try {
  changed = cp.execFileSync('git', ['diff', '--name-only', `${acceptedBatch1Head}...${acceptedBatch2Head}`], { cwd: ROOT, encoding: 'utf8' })
    .trim().split(/\r?\n/).filter(Boolean);
} catch (error) {
  fail('unable to derive accepted Batch 2 changed-file boundary', String(error));
}
const allowed = new Set([
  'apps/server/src/routes/weather_v1.ts',
  'docs/architecture/semantic_convergence/GEOX-BLINE-PR-SEC-2-IMMEDIATE-CALLER-CONTAINMENT-V1.json',
  'scripts/governance_acceptance/ACCEPTANCE_BLINE_PR_SEC_2_WEATHER_INGEST_FAIL_CLOSED_V1.cjs',
  'scripts/runtime_acceptance/ACCEPTANCE_BLINE_PR_SEC_2_WEATHER_INGEST_FAIL_CLOSED_V1.ts',
  'scripts/runtime_acceptance/ACCEPTANCE_BLINE_PR_SEC_2_WEATHER_INGEST_COMMERCIAL_RUNTIME_V1.ts',
  '.github/workflows/bline-pr-sec2-containment.yml',
]);
for (const file of changed) assert(allowed.has(file), 'Accepted Batch 2 changed-file scope expansion', file);
for (const file of changed) {
  assert(!file.includes('/mcft') && !file.includes('MCFT'), 'Batch 2 must not modify MCFT', file);
  assert(!file.endsWith('apps/server/src/domain/auth/roles.ts'), 'Batch 2 must not modify role matrix', file);
}

console.log(JSON.stringify({
  result: 'PASS',
  batch: 'PRSEC2-BATCH-002B',
  surface: 'BSEC-003',
  containment: 'COMMERCIAL_FAIL_CLOSE',
  production_registration: 'registerSensingModule -> registerWeatherV1Routes',
  writer_reachability: false,
  deferred_callback_writer_scan: 'PASS',
  new_principal_created: false,
  new_capability_created: false,
  before: batch1After,
  computed_delta: computedDelta,
  computed_after: computedAfter,
  accepted_batch2_head: acceptedBatch2Head,
  changed_files_between_accepted_batch_heads: changed,
  mcft_modification: false,
}, null, 2));
