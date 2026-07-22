#!/usr/bin/env node
// Purpose: preserve the post-closure MCFT-CAP-07 local demo loader and exact-scope navigator boundary.
// Boundary: repository reads only; no database, network, browser, canonical write, Runtime source activation, or CAP-08 authority.
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '../..');
const read = (relative) => fs.readFileSync(path.join(ROOT, relative), 'utf8');
const checks = [];
const check = (name, fn) => { fn(); checks.push({ name, status: 'PASS' }); };

const wrapper = read('scripts/dev_seed/SEED_THREE_SURFACE_LOCAL_DEMO_V1.cjs');
const loaderFiles = [
  'scripts/dev_seed/seed_three_surface_local_demo_v1.ts',
  'scripts/dev_seed/three_surface_local_demo_action_lifecycle_v1.ts',
  'scripts/dev_seed/three_surface_local_demo_contract_v1.ts',
  'scripts/dev_seed/three_surface_local_demo_persistence_v1.ts',
  'scripts/dev_seed/three_surface_local_demo_optional_persistence_v1.ts',
];
const loader = loaderFiles.map(read).join('\n');
const route = read('apps/web/src/app/routes/operatorFieldRuntimeRoutes.tsx');
const navigator = read('apps/web/src/features/operator/fieldRuntime/McftFieldRuntimeScopeNavigatorPage.tsx');
const fieldApi = read('apps/web/src/api/fields.ts');
const scopeOptionsRoute = read('apps/server/src/routes/field_runtime_scope_options_v1.ts');
const fieldModule = read('apps/server/src/modules/field/registerFieldModule.ts');
const css = read('apps/web/src/styles/operatorFieldRuntimeNavigator.css');
const roleContract = read('apps/server/src/domain/auth/roles.ts');
const fieldRoute = read('apps/server/src/routes/fields_v1.ts');
const tokenContract = JSON.parse(read('config/auth/security_acceptance_tokens.json'));

check('HISTORICAL_LOCAL_DEMO_COMMAND_NOW_DELEGATES_TO_REAL_LOADER', () => {
  assert.match(wrapper, /seed_three_surface_local_demo_v1\.ts/);
  assert.doesNotMatch(wrapper, /contract-placeholder|intentionally placeholder/i);
  assert.match(navigator, /SEED_THREE_SURFACE_LOCAL_DEMO_V1\.cjs --apply --confirm-local-demo/);
});

check('LOADER_REUSES_PRODUCTION_CANONICAL_BUILDERS_AND_READBACK', () => {
  for (const token of [
    'buildA0RecordSetV1','validateA0RecordSetV1','computeMemberDeterminismHashV1',
    'buildCap05DecisionV1','buildCap05ActionFeedbackV1','computeCap05ReplayEvidenceSourceRecordHashV1',
    'PostgresMcftFieldTwinReadApiV1','readRuntime','readTimeline','readActionLifecycle','readTrace','readHealth',
  ]) assert.ok(loader.includes(token), token);
});

check('LOADER_PROVES_NONEMPTY_ACTION_LIFECYCLE_AND_TIMELINE', () => {
  assert.match(loader, /runtime_action_feedback_has_items/);
  assert.match(loader, /action_feedback_count\s*<\s*1/);
  assert.match(loader, /LOCAL_DEMO_READBACK_ACTION_LIFECYCLE_INCOMPLETE/);
  assert.match(loader, /REQUIRED_TIMELINE_KINDS/);
  assert.match(loader, /LOCAL_DEMO_READBACK_TIMELINE_INCOMPLETE/);
  for (const token of ['HUMAN_DECISION','APPROVED_PLAN_EVIDENCE','ACTION_FEEDBACK']) assert.ok(loader.includes(token), token);
});

check('LOADER_IS_EXPLICITLY_LOCAL_AND_FAILS_CLOSED', () => {
  for (const token of ['--confirm-local-demo','LOCAL_DEMO_DATABASE_HOST_FORBIDDEN','LOCAL_DEMO_RUNTIME_ENV_FORBIDDEN','LOCAL_DEMO_RUNTIME_READBACK_CREDENTIAL_REQUIRED']) assert.ok(loader.includes(token), token);
  assert.match(loader, /127\.0\.0\.1|localhost/);
  assert.doesNotMatch(loader, /DROP\s+SCHEMA|TRUNCATE\s+TABLE/i);
});

check('VISIBILITY_AUTHORITY_REMAINS_DATABASE_TRIGGER_OWNED', () => {
  assert.doesNotMatch(loader, /INSERT\s+INTO\s+public\.twin_fact_visibility_index_v1/i);
  assert.match(loader, /mcft_cap07_fact_visibility_after_insert_v1/);
});

check('CANONICAL_FACT_CLEANUP_IS_NOT_FABRICATED', () => {
  assert.match(loader, /DISPOSABLE_LOCAL_DATABASE_OR_VOLUME_ONLY/);
  assert.match(loader, /append-only\/immutable/);
  assert.doesNotMatch(loader, /DELETE\s+FROM\s+public\.facts/i);
});

check('NO_MODEL_ACTIVATION_OR_SUCCESSOR_AUTHORITY_IS_CREATED', () => {
  assert.doesNotMatch(loader, /INSERT\s+INTO\s+public\.twin_model_activation/i);
  assert.match(loader, /model_activation_created:\s*false/);
  assert.match(loader, /mcft_cap_08_authorized:\s*false/);
  assert.match(loader, /runtime_source_authorized:\s*false/);
  assert.match(loader, /canonical_production_write_authorized:\s*false/);
});

check('SCOPE_NAVIGATOR_USES_LIGHTWEIGHT_GET_ONLY_FIELD_READS', () => {
  assert.match(navigator, /fetchFields/);
  assert.match(navigator, /fetchFieldRuntimeScopeOptions/);
  assert.doesNotMatch(navigator, /fetchFieldDetail/);
  assert.match(fieldApi, /\/runtime-scope-options/);
  assert.doesNotMatch(navigator, /createField|updateField|method:\s*["'](?:POST|PUT|PATCH|DELETE)/);
  for (const key of ['field_id','season_id','zone_id']) assert.ok(navigator.includes(`data-mcft-scope-key="${key}"`), key);
  assert.match(navigator, /navigate\(target\)/);
});

check('RUNTIME_SCOPE_OPTIONS_ROUTE_IS_MINIMAL_AND_REGISTERED', () => {
  assert.match(scopeOptionsRoute, /app\.get\("\/api\/v1\/fields\/:field_id\/runtime-scope-options"/);
  assert.match(scopeOptionsRoute, /requireAoActScopeV0\(req, reply, "fields\.read"\)/);
  assert.match(scopeOptionsRoute, /FROM public\.field_index_v1/);
  assert.match(scopeOptionsRoute, /FROM public\.field_season_index_v1/);
  assert.match(scopeOptionsRoute, /field_detail_aggregate_consumed:\s*false/);
  assert.doesNotMatch(scopeOptionsRoute, /INSERT\s+INTO|UPDATE\s+public\.|DELETE\s+FROM|CREATE\s+TABLE|ALTER\s+TABLE/i);
  assert.match(fieldModule, /registerFieldRuntimeScopeOptionsV1Routes/);
});

check('OPERATOR_FIELD_DISCOVERY_AUTHORITY_IS_EXPLICIT_AND_MINIMAL', () => {
  const operator = tokenContract.tokens.find((item) => item.token === 'operator_token');
  const writeOnly = tokenContract.tokens.find((item) => item.token === 'set-via-env-or-external-secret-file-pdi-writeonly');
  assert.ok(operator, 'OPERATOR_TOKEN_MISSING');
  assert.equal(operator.role, 'operator');
  assert.ok(operator.scopes.includes('fields.read'), 'OPERATOR_FIELDS_READ_SCOPE_MISSING');
  assert.ok(writeOnly, 'WRITE_ONLY_TOKEN_MISSING');
  assert.equal(writeOnly.scopes.includes('fields.read'), false, 'WRITE_ONLY_TOKEN_SCOPE_ESCALATED');
  assert.match(roleContract, /operator:\s*\[[^\]]*"fields\.read"/s);
  assert.match(fieldRoute, /app\.get\("\/api\/v1\/fields"[\s\S]*?requireAoActScopeV0\(req, reply, "fields\.read"\)/);
  assert.doesNotMatch(roleContract, /operator:\s*\[[^\]]*"fields\.write"/s);
});

check('INDEX_AND_WILDCARD_ROUTES_USE_SCOPE_NAVIGATOR', () => {
  assert.match(route, /Route index element={<FieldRuntimeScopeNavigatorPage/);
  assert.match(route, /Route path="\*" element={<FieldRuntimeScopeNavigatorPage/);
  assert.match(route, /McftCanonicalFieldRuntimeRoutePage/);
});

check('NAVIGATOR_EXPOSES_CONTROLLED_REPLAY_NONCLAIMS', () => {
  for (const token of ['Runtime source authority','canonical production write authority','MCFT-CAP-08']) assert.ok(navigator.includes(token), token);
  assert.match(css, /operatorFieldRuntimeNavigator__form/);
});

console.log(JSON.stringify({
  schema_version: 'geox_mcft_cap_07_local_demo_scope_navigator_acceptance_v1',
  status: 'PASS',
  check_count: checks.length,
  checks,
  operator_fields_read_authorized: true,
  operator_fields_write_authorized: false,
  field_detail_aggregate_consumed: false,
  runtime_source_authorized: false,
  canonical_production_write_authorized: false,
  mcft_cap_08_authorized: false,
  repository_write_performed: false,
}));
