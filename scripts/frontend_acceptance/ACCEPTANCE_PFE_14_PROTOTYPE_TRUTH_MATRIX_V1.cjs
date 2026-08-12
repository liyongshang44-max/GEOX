const fs = require('fs');
const path = require('path');
const assert = require('assert');

const ROOT = process.cwd();
const DOC = path.join(ROOT, 'docs/frontend-productization/PFE-14-PROTOTYPE-TRUTH-MATRIX-V1.md');
const MATRIX = path.join(ROOT, 'docs/frontend-productization/PFE-14-PROTOTYPE-TRUTH-MATRIX-V1.json');
const AMENDMENT = path.join(ROOT, 'docs/frontend-productization/PFE-14-PROTOTYPE-NO-FABRICATION-AMENDMENT-01.md');
const PROTOTYPE_AUTHORITY = path.join(ROOT, 'docs/frontend-productization/PFE-14-PROTOTYPE-AUTHORITY-V1.json');
const AUTHORITY = path.join(ROOT, 'docs/frontend-productization/PFE-14-CURRENT-AUTHORITY.json');
const READ_CONTRACT = path.join(ROOT, 'docs/frontend-productization/PFE-14-S1-FRONTEND-READ-CONTRACT.json');
const ROUTES = path.join(ROOT, 'apps/web/src/app/routes/operatorFieldRuntimeRoutes.tsx');
const API = path.join(ROOT, 'apps/web/src/api/mcftFieldTwinRuntime.ts');
const SHELL = path.join(ROOT, 'apps/web/src/layouts/OperatorLayout.tsx');

function read(file) {
  return fs.readFileSync(file, 'utf8');
}

function json(file) {
  return JSON.parse(read(file));
}

function has(text, token, code) {
  assert(text.includes(token), code || `MISSING:${token}`);
}

const doc = read(DOC);
const amendment = read(AMENDMENT);
const matrix = json(MATRIX);
const prototypeAuthority = json(PROTOTYPE_AUTHORITY);
const authority = json(AUTHORITY);
const readContract = json(READ_CONTRACT);
const routes = read(ROUTES);
const api = read(API);
const shell = read(SHELL);

assert.equal(matrix.schema_version, 'geox_pfe14_prototype_truth_matrix_v1');
assert.equal(matrix.record_status, 'DESIGN_ONLY_NON_EFFECTIVE');
assert.equal(matrix.prototype_policy.sample_scope_values_allowed, false);
assert.equal(matrix.prototype_policy.invented_runtime_values_allowed, false);
assert.equal(matrix.prototype_policy.invented_numeric_values_allowed, false);
assert.equal(matrix.prototype_policy.invented_timestamps_allowed, false);
assert.equal(matrix.prototype_policy.invented_server_verdicts_allowed, false);

assert.equal(prototypeAuthority.prototype_policy_revision, 'v1.1_no_fabrication');
assert.equal(prototypeAuthority.artifact_classes.TARGET_STATE_PRODUCT_PROTOTYPE.may_use_design_sample_data, false);
assert.equal(prototypeAuthority.scope_value_policy.may_use_design_sample_scope, false);
assert.equal(prototypeAuthority.scope_value_policy.may_use_invented_scope_identifiers, false);
assert.equal(prototypeAuthority.truth_matrix_ref, 'docs/frontend-productization/PFE-14-PROTOTYPE-TRUTH-MATRIX-V1.json');
assert.equal(prototypeAuthority.policy_amendment_ref, 'docs/frontend-productization/PFE-14-PROTOTYPE-NO-FABRICATION-AMENDMENT-01.md');
assert(!Object.prototype.hasOwnProperty.call(prototypeAuthority, 'frozen_sample_scope'), 'FROZEN_SAMPLE_SCOPE_MUST_BE_REMOVED');

assert.equal(authority.status, matrix.pfe14_authority_expected_status, 'PFE14_S4_DEPENDENCY_HOLD_DRIFT');
assert.equal(readContract.implementation_state.api_implemented, false, 'S1_API_MUST_STILL_BE_MARKED_NOT_IMPLEMENTED');
assert.equal(readContract.implementation_state.shadow_online_claim_enabled, false, 'SHADOW_ONLINE_CLAIM_MUST_REMAIN_DISABLED');

const dataBearingMatrix = JSON.stringify({
  current_static_nonclaims: matrix.current_static_nonclaims,
  current_primary_navigation: matrix.current_primary_navigation,
  canonical_sources: matrix.canonical_sources,
  blocked_s4_models: matrix.blocked_s4_models,
  prototype_surfaces: matrix.prototype_surfaces,
  cross_surface_states: matrix.cross_surface_states,
  next_action: matrix.next_action,
});
for (const token of matrix.forbidden_prototype_tokens) {
  assert(!dataBearingMatrix.includes(token), `FORBIDDEN_SAMPLE_TOKEN_USED_AS_DATA:${token}`);
}

assert.equal(matrix.prototype_surfaces.length, 12, 'EXACTLY_12_PRODUCT_SURFACES_REQUIRED');
assert.equal(new Set(matrix.prototype_surfaces.map((surface) => surface.id)).size, 12, 'SURFACE_IDS_MUST_BE_UNIQUE');
assert.equal(matrix.prototype_surfaces.some((surface) => surface.id === 'P13'), false, 'P13_MUST_NOT_BE_A_SEPARATE_PAGE');
assert.equal(matrix.prototype_surfaces.some((surface) => surface.id === 'P14'), false, 'P14_MUST_NOT_BE_A_SEPARATE_PAGE');

const requiredRouteTokens = [
  'path=\":fieldId\"',
  'path=\":fieldId/state\"',
  'path=\":fieldId/forecast\"',
  'path=\":fieldId/scenario\"',
  'path=\":fieldId/action-lifecycle\"',
  'path=\":fieldId/residual\"',
  'path=\":fieldId/calibration\"',
  'path=\":fieldId/evidence-trace\"',
  'path=\":fieldId/health\"',
  'path=\":fieldId/evidence\"',
  'path=\":fieldId/audit\"'
];
for (const token of requiredRouteTokens) has(routes, token, `CANONICAL_ROUTE_MISSING:${token}`);

const requiredApiFunctions = [
  'readMcftRuntime',
  'readMcftStates',
  'readMcftForecasts',
  'readMcftScenarios',
  'readMcftActionLifecycle',
  'readMcftResiduals',
  'readMcftTrace',
  'readMcftTimeline',
  'readMcftHealth',
  'readMcftModelGovernance'
];
for (const fn of requiredApiFunctions) has(api, fn, `CANONICAL_API_FUNCTION_MISSING:${fn}`);
has(api, 'method: "GET"', 'CANONICAL_API_MUST_REMAIN_GET_ONLY');
has(api, 'missing_keys', 'EXACT_SIX_KEY_SCOPE_GUARD_REQUIRED');

has(shell, 'Replay-backed Demo', 'REPLAY_BACKED_STATIC_NONCLAIM_REQUIRED');
has(shell, 'Not connected', 'LIVE_DEVICE_NONCLAIM_REQUIRED');
has(shell, 'Not online', 'PRODUCTION_GATEWAY_NONCLAIM_REQUIRED');
has(shell, 'Not started', 'FIELD_PILOT_NONCLAIM_REQUIRED');
has(shell, 'Disabled', 'CONTROLLED_EXECUTION_NONCLAIM_REQUIRED');
has(shell, 'LocaleToggle', 'LOCALE_TOGGLE_REQUIRED');
has(shell, 'to: "/operator/twin"', 'RUNTIME_OVERVIEW_NAV_REQUIRED');
has(shell, 'to: "/operator/fields"', 'FIELDS_NAV_REQUIRED');

const blockedModels = new Set(matrix.blocked_s4_models);
for (const required of ['scheduler_summary', 'evidence_availability', 'persistence_and_recovery']) {
  assert(blockedModels.has(required), `BLOCKED_MODEL_MISSING:${required}`);
}

for (const surface of matrix.prototype_surfaces) {
  assert(surface.current_data_mode, `DATA_MODE_REQUIRED:${surface.id}`);
  for (const fn of surface.source_functions || []) {
    if (fn.startsWith('fetchOperatorTwin')) continue;
    has(api, fn, `SURFACE_SOURCE_FUNCTION_NOT_IN_CANONICAL_API:${surface.id}:${fn}`);
  }
}

const docRequired = [
  'CURRENT_IMPLEMENTATION_REFERENCE',
  'TARGET_STATE_STRUCTURE_ONLY',
  '等待权威读合同',
  'P01 Runtime Overview',
  'P12 Calibration',
  'Data rendering policy for future visual mockups',
  'Draft PR #2863'
];
for (const token of docRequired) has(doc, token, `DOC_RULE_MISSING:${token}`);

for (const token of ['No sixth class exists', 'may not use invented six-key Scope identifiers', 'PFE-14 S4 remains blocked']) {
  has(amendment, token, `AMENDMENT_RULE_MISSING:${token}`);
}

console.log(JSON.stringify({
  status: 'PASS',
  matrix: 'PFE-14-PROTOTYPE-TRUTH-MATRIX-V1',
  prototype_policy_revision: prototypeAuthority.prototype_policy_revision,
  repo_basis_main_sha: matrix.repo_basis_main_sha,
  surface_count: matrix.prototype_surfaces.length,
  sample_scope_values_allowed: false,
  invented_runtime_values_allowed: false,
  pfe14_s4_status: authority.status,
  canonical_get_only_functions_verified: requiredApiFunctions.length,
  write_count: 0
}, null, 2));
