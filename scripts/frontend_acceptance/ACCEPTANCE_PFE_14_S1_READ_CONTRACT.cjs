'use strict';

const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');

const ROOT = process.cwd();
const CURRENT = 'docs/frontend-productization/PFE-14-CURRENT-AUTHORITY.json';
const READ_CONTRACT = 'docs/frontend-productization/PFE-14-S1-FRONTEND-READ-CONTRACT.json';
const STATE_MATRIX = 'docs/frontend-productization/PFE-14-S1-STATE-MATRIX.json';
const COPY_CONTRACT = 'docs/frontend-productization/PFE-14-S1-COPY-NONCLAIM-CONTRACT.json';
const BOUNDARY = 'docs/frontend-productization/PFE-14-S1-CHANGED-FILE-BOUNDARY.json';
const S0_TASKBOOK = 'docs/frontend-productization/PFE-14-SHADOW-ONLINE-OPERATOR-RUNTIME-CONSOLE-TASK.md';
const S0_ROUTES = 'docs/frontend-productization/PFE-14-ROUTE-OWNERSHIP.json';
const S0_DEPENDENCIES = 'docs/frontend-productization/PFE-14-MCFT-09-DEPENDENCY-MAP.json';
const MCFT09 = 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-CURRENT-AUTHORITY-V1.json';
const OUTPUT = path.join(ROOT, 'acceptance-output/PFE_14_S1_READ_CONTRACT_RESULT.json');

const read = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8');
const json = (file) => JSON.parse(read(file));
const git = (...args) => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim();
const check = (value, message) => { if (!value) throw new Error(message); };
const sorted = (values) => [...values].sort((a, b) => a.localeCompare(b));
const same = (actual, expected, message) => assert.deepEqual(actual, expected, message);

function writeResult(value) {
  fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
  fs.writeFileSync(OUTPUT, `${JSON.stringify(value, null, 2)}\n`);
}

function main() {
  const current = json(CURRENT);
  const contract = json(READ_CONTRACT);
  const matrix = json(STATE_MATRIX);
  const copy = json(COPY_CONTRACT);
  const boundary = json(BOUNDARY);
  const dependencies = json(S0_DEPENDENCIES);
  const routes = json(S0_ROUTES);
  const mcft09 = json(MCFT09);
  const taskbook = read(S0_TASKBOOK);

  const baseSha = process.env.PFE14_BASE_SHA || boundary.base_main_sha;
  check(/^[0-9a-f]{40}$/.test(baseSha), 'PFE14_S1_BASE_SHA_INVALID');
  git('cat-file', '-e', `${baseSha}^{commit}`);
  check(boundary.predecessor_merge_sha === baseSha, 'PFE14_S1_PREDECESSOR_BINDING_MISMATCH');

  const changedFiles = git('diff', '--name-only', `${baseSha}...HEAD`).split(/\r?\n/).filter(Boolean);
  same(sorted(changedFiles), sorted(boundary.expected_changed_files), 'PFE14_S1_CHANGED_FILES_MISMATCH');
  check(changedFiles.length === boundary.expected_changed_file_count, 'PFE14_S1_CHANGED_FILE_COUNT_MISMATCH');
  for (const file of changedFiles) {
    check(boundary.allowed_prefixes.some((prefix) => file.startsWith(prefix)), `PFE14_S1_FILE_OUTSIDE_ALLOWLIST:${file}`);
    check(!boundary.forbidden_prefixes.some((prefix) => file.startsWith(prefix)), `PFE14_S1_FORBIDDEN_PREFIX:${file}`);
    check(!boundary.forbidden_exact_files.includes(file), `PFE14_S1_FORBIDDEN_FILE:${file}`);
  }

  check(taskbook.includes('PFE-14.S1'), 'PFE14_TASKBOOK_S1_MISSING');
  check(routes.truth_policy === 'CANONICAL_GET_ONLY_NO_LEGACY_TRUTH_FALLBACK', 'PFE14_S1_ROUTE_TRUTH_POLICY_DRIFT');
  check(routes.scope_policy === 'EXACT_TENANT_PROJECT_GROUP_FIELD_SEASON_ZONE', 'PFE14_S1_SCOPE_POLICY_DRIFT');
  check(dependencies.slice_dependencies.find((entry) => entry.pfe_slice === 'PFE-14.S1')?.dependency_satisfied === true, 'PFE14_S1_DEPENDENCY_NOT_SATISFIED');
  check(mcft09.capability_line_id === 'MCFT-CAP-09', 'PFE14_S1_MCFT09_AUTHORITY_MISSING');

  check(current.slice_id === 'PFE-14.S1', 'PFE14_S1_CURRENT_SLICE_MISMATCH');
  check(current.status === 'S1_READ_CONTRACT_IN_PROGRESS', 'PFE14_S1_CURRENT_STATUS_MISMATCH');
  check(current.base_main_sha === baseSha, 'PFE14_S1_CURRENT_BASE_MISMATCH');
  check(current.s0_merge_sha === baseSha && current.s0_effective === true, 'PFE14_S1_S0_PREDECESSOR_NOT_EFFECTIVE');
  for (const key of ['frontend_contract_design_authorized', 'state_matrix_design_authorized', 'copy_nonclaim_design_authorized']) {
    check(current[key] === true, `PFE14_S1_DESIGN_AUTHORITY_MISSING:${key}`);
  }
  for (const key of [
    'react_source_authorized', 'css_source_authorized', 'route_source_authorized', 'api_client_source_authorized',
    'backend_source_authorized', 'database_delta_authorized', 'package_delta_authorized', 'workflow_delta_authorized',
    'runtime_claim_authorized', 'shadow_online_label_authorized', 'scheduler_ui_authorized',
    'evidence_freshness_ui_authorized', 'backfill_ui_authorized', 'recovery_ui_authorized',
    'controlled_action_authorized', 'ao_act_authorized', 'dispatch_authorized', 'model_activation_authorized',
    'production_launch_authorized', 'commercial_launch_authorized', 'candidate_declaration_authorized', 's1_effective'
  ]) {
    check(current[key] === false, `PFE14_S1_AUTHORITY_MUST_REMAIN_FALSE:${key}`);
  }

  check(contract.record_status === 'DESIGN_FROZEN_NOT_IMPLEMENTED', 'PFE14_S1_CONTRACT_STATUS_MISMATCH');
  check(contract.base_main_sha === baseSha, 'PFE14_S1_CONTRACT_BASE_MISMATCH');
  same(contract.scope_keys, ['tenant_id', 'project_id', 'group_id', 'field_id', 'season_id', 'zone_id'], 'PFE14_S1_SCOPE_KEYS_MISMATCH');
  same(contract.request_policy.methods, ['GET'], 'PFE14_S1_METHOD_POLICY_MISMATCH');
  check(contract.request_policy.exact_scope_required === true, 'PFE14_S1_EXACT_SCOPE_NOT_REQUIRED');
  check(contract.request_policy.field_only_fallback_allowed === false, 'PFE14_S1_FIELD_FALLBACK_ALLOWED');
  check(contract.request_policy.legacy_truth_fallback_allowed === false, 'PFE14_S1_LEGACY_FALLBACK_ALLOWED');
  check(contract.request_policy.fixture_truth_fallback_allowed === false, 'PFE14_S1_FIXTURE_FALLBACK_ALLOWED');
  check(contract.request_policy.frontend_business_inference_allowed === false, 'PFE14_S1_FRONTEND_INFERENCE_ALLOWED');
  check(contract.request_policy.server_time_is_authoritative === true, 'PFE14_S1_SERVER_TIME_NOT_AUTHORITATIVE');
  check(contract.request_policy.server_verdicts_are_authoritative === true, 'PFE14_S1_SERVER_VERDICT_NOT_AUTHORITATIVE');
  check(contract.implementation_state.api_implemented === false, 'PFE14_S1_API_FALSE_CLAIM');
  check(contract.implementation_state.view_model_implemented === false, 'PFE14_S1_VIEW_MODEL_FALSE_CLAIM');
  check(contract.implementation_state.shadow_online_claim_enabled === false, 'PFE14_S1_SHADOW_CLAIM_ENABLED');

  const models = new Map(contract.read_models.map((model) => [model.model, model]));
  for (const required of ['runtime_context', 'scheduler_summary', 'evidence_availability', 'persistence_and_recovery', 'runtime_health', 'forecast_qualification']) {
    check(models.has(required), `PFE14_S1_READ_MODEL_MISSING:${required}`);
  }
  const fieldNames = new Set(contract.envelope.required);
  for (const model of contract.read_models) {
    for (const field of model.fields) {
      check(!fieldNames.has(field.name), `PFE14_S1_DUPLICATE_FIELD:${field.name}`);
      fieldNames.add(field.name);
      check(field.semantic_owner === 'server', `PFE14_S1_FIELD_NOT_SERVER_OWNED:${field.name}`);
    }
  }
  for (const requiredField of dependencies.required_runtime_fields) {
    check(fieldNames.has(requiredField), `PFE14_S1_REQUIRED_RUNTIME_FIELD_MISSING:${requiredField}`);
  }
  for (const forbiddenRule of [
    'derive runtime_mode from URL, object count, or current date',
    'derive scheduler slot from browser clock',
    'derive freshness_status from a frontend threshold',
    'derive scenario_source_eligible from forecast presence',
    'convert HTTP 404 runtime-not-established into an empty successful model'
  ]) {
    check(contract.forbidden_frontend_derivations.includes(forbiddenRule), `PFE14_S1_FORBIDDEN_DERIVATION_MISSING:${forbiddenRule}`);
  }

  check(matrix.record_status === 'DESIGN_FROZEN_NOT_IMPLEMENTED', 'PFE14_S1_MATRIX_STATUS_MISMATCH');
  check(matrix.base_main_sha === baseSha, 'PFE14_S1_MATRIX_BASE_MISMATCH');
  const states = new Map(matrix.states.map((state) => [state.state, state]));
  for (const required of [
    'NO_SCOPE', 'RUNTIME_NOT_ESTABLISHED', 'SHADOW_NOT_AUTHORIZED', 'WAITING_FOR_FIRST_SLOT',
    'WAITING_NEXT_SLOT', 'RUNNING', 'COMPLETED', 'DEGRADED_STALE_EVIDENCE',
    'DEGRADED_MISSING_DATA', 'BACKFILLING', 'RECOVERED', 'BLOCKED_LEASE',
    'BLOCKED_FENCING', 'CONTRACT_INCOMPLETE', 'FORBIDDEN', 'API_ERROR'
  ]) {
    check(states.has(required), `PFE14_S1_STATE_MISSING:${required}`);
  }
  check(states.get('RUNTIME_NOT_ESTABLISHED').http_status === 404, 'PFE14_S1_RUNTIME_NOT_ESTABLISHED_HTTP_DRIFT');
  check(states.get('RUNTIME_NOT_ESTABLISHED').kind === 'empty_not_success', 'PFE14_S1_404_EMPTY_SUCCESS_DRIFT');
  check(states.get('BACKFILLING').claims_forbidden.includes('queue order inferred by frontend'), 'PFE14_S1_BACKFILL_INFERENCE_NOT_BLOCKED');
  check(states.get('BLOCKED_LEASE').claims_forbidden.includes('offer force takeover'), 'PFE14_S1_LEASE_MUTATION_NOT_BLOCKED');
  check(matrix.global_rules.write_action_from_state_forbidden === true, 'PFE14_S1_STATE_WRITE_ACTION_ALLOWED');

  check(copy.record_status === 'DESIGN_FROZEN_NOT_IMPLEMENTED', 'PFE14_S1_COPY_STATUS_MISMATCH');
  check(copy.base_main_sha === baseSha, 'PFE14_S1_COPY_BASE_MISMATCH');
  same(copy.locales, ['zh-CN', 'en-US'], 'PFE14_S1_LOCALES_MISMATCH');
  for (const condition of ['ALL_FORMAL_OPERATOR_RUNTIME_PAGES', 'REPLAY_BACKED', 'SHADOW_ONLINE', 'FORECAST_PRESENT', 'SCENARIO_PRESENT', 'RESIDUAL_PRESENT', 'HEALTH_PRESENT']) {
    check(copy.required_boundary_copy.some((entry) => entry.condition === condition), `PFE14_S1_BOUNDARY_COPY_MISSING:${condition}`);
  }
  check(copy.dynamic_copy_rules.some((rule) => rule.includes('runtime_mode is returned as SHADOW_ONLINE')), 'PFE14_S1_SHADOW_LABEL_RULE_MISSING');
  check(copy.forbidden_claims.includes('Production online'), 'PFE14_S1_PRODUCTION_CLAIM_NOT_BLOCKED');
  check(copy.forbidden_claims.includes('Automatic control enabled'), 'PFE14_S1_CONTROL_CLAIM_NOT_BLOCKED');
  check(copy.progressive_disclosure.raw_payload_default_visible === false, 'PFE14_S1_RAW_PAYLOAD_DEFAULT_VISIBLE');
  check(copy.style_boundary.apple_brand_claim_allowed === false, 'PFE14_S1_APPLE_BRAND_CLAIM_ALLOWED');
  check(copy.style_boundary.bundled_apple_font_allowed === false, 'PFE14_S1_APPLE_FONT_BUNDLE_ALLOWED');

  for (const [name, value] of Object.entries(boundary.delta_assertions)) {
    check(value === 0, `PFE14_S1_NONZERO_DELTA:${name}`);
  }
  check(boundary.contract_design_only === true, 'PFE14_S1_NOT_DESIGN_ONLY');
  check(boundary.candidate_declaration === false, 'PFE14_S1_CANDIDATE_DECLARATION');
  check(boundary.runtime_implementation_authority === false, 'PFE14_S1_RUNTIME_AUTHORITY');
  check(boundary.shadow_online_product_claim === false, 'PFE14_S1_SHADOW_PRODUCT_CLAIM');

  const result = {
    status: 'PASS',
    change_class: boundary.change_class,
    base_main_sha: baseSha,
    head_sha: git('rev-parse', 'HEAD'),
    changed_file_count: changedFiles.length,
    changed_files: sorted(changedFiles),
    read_model_count: contract.read_models.length,
    contracted_field_count: fieldNames.size,
    state_count: matrix.states.length,
    locale_count: copy.locales.length,
    exact_scope_required: true,
    get_only: true,
    server_verdict_authority: true,
    react_source_delta: 0,
    css_source_delta: 0,
    api_client_delta: 0,
    backend_source_delta: 0,
    runtime_claim_delta: 0,
    completion_claim: boundary.completion_claim_when_accepted,
    next_slice: boundary.next_slice_after_effectiveness
  };
  writeResult(result);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

try {
  main();
} catch (error) {
  const result = { status: 'FAIL', error: error instanceof Error ? error.message : String(error) };
  writeResult(result);
  process.stderr.write(`${JSON.stringify(result, null, 2)}\n`);
  process.exitCode = 1;
}
