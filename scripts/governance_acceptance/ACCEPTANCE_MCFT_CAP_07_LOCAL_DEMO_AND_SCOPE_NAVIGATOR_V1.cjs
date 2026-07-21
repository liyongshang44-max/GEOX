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
const loader = read('scripts/dev_seed/seed_three_surface_local_demo_v1.ts');
const route = read('apps/web/src/app/routes/operatorFieldRuntimeRoutes.tsx');
const navigator = read('apps/web/src/features/operator/fieldRuntime/McftFieldRuntimeScopeNavigatorPage.tsx');
const css = read('apps/web/src/styles/operatorFieldRuntimeNavigator.css');
const packageJson = JSON.parse(read('package.json'));

check('HISTORICAL_LOCAL_DEMO_COMMAND_NOW_DELEGATES_TO_REAL_LOADER', () => {
  assert.match(packageJson.scripts['seed:three-surface-local-demo'], /SEED_THREE_SURFACE_LOCAL_DEMO_V1\.cjs/);
  assert.match(wrapper, /seed_three_surface_local_demo_v1\.ts/);
  assert.doesNotMatch(wrapper, /intentionally placeholder/i);
});

check('LOADER_REUSES_PRODUCTION_CANONICAL_BUILDERS_AND_READBACK', () => {
  for (const token of ['buildA0RecordSetV1','validateA0RecordSetV1','computeMemberDeterminismHashV1','PostgresMcftFieldTwinReadApiV1','readRuntime','readTrace','readHealth']) assert.ok(loader.includes(token), token);
});

check('LOADER_IS_EXPLICITLY_LOCAL_AND_FAILS_CLOSED', () => {
  for (const token of ['--confirm-local-demo','LOCAL_DEMO_DATABASE_HOST_FORBIDDEN','LOCAL_DEMO_RUNTIME_ENV_FORBIDDEN']) assert.ok(loader.includes(token), token);
  assert.match(loader, /127\.0\.0\.1|localhost/);
  assert.doesNotMatch(loader, /DROP\s+SCHEMA|TRUNCATE\s+TABLE/i);
});

check('VISIBILITY_AUTHORITY_REMAINS_DATABASE_TRIGGER_OWNED', () => {
  assert.doesNotMatch(loader, /INSERT\s+INTO\s+public\.twin_fact_visibility_index_v1/i);
  assert.match(loader, /mcft_cap07_fact_visibility_after_insert_v1/);
});

check('NO_MODEL_ACTIVATION_OR_SUCCESSOR_AUTHORITY_IS_CREATED', () => {
  assert.doesNotMatch(loader, /INSERT\s+INTO\s+public\.twin_model_activation/i);
  assert.match(loader, /model_activation_created:\s*false/);
  assert.match(loader, /mcft_cap_08_authorized:\s*false/);
  assert.match(loader, /runtime_source_authorized:\s*false/);
  assert.match(loader, /canonical_production_write_authorized:\s*false/);
});

check('SCOPE_NAVIGATOR_USES_EXISTING_GET_ONLY_FIELD_READS', () => {
  assert.match(navigator, /fetchFields/);
  assert.match(navigator, /fetchFieldDetail/);
  assert.doesNotMatch(navigator, /createField|updateField|method:\s*["'](?:POST|PUT|PATCH|DELETE)/);
  for (const key of ['field_id','season_id','zone_id']) assert.ok(navigator.includes(`data-mcft-scope-key="${key}"`), key);
  assert.match(navigator, /navigate\(target\)/);
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
  runtime_source_authorized: false,
  canonical_production_write_authorized: false,
  mcft_cap_08_authorized: false,
  repository_write_performed: false,
}));
