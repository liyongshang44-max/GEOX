'use strict';

const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');

const ROOT = process.cwd();
const TASKBOOK = 'docs/frontend-productization/PFE-14-SHADOW-ONLINE-OPERATOR-RUNTIME-CONSOLE-TASK.md';
const CURRENT = 'docs/frontend-productization/PFE-14-CURRENT-AUTHORITY.json';
const ROUTES = 'docs/frontend-productization/PFE-14-ROUTE-OWNERSHIP.json';
const DEPENDENCIES = 'docs/frontend-productization/PFE-14-MCFT-09-DEPENDENCY-MAP.json';
const BOUNDARY = 'docs/frontend-productization/PFE-14-S0-CHANGED-FILE-BOUNDARY.json';
const PFE13 = 'docs/frontend-productization/PFE-13-FREEZE-MANIFEST.json';
const MCFT09 = 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-CURRENT-AUTHORITY-V1.json';
const ACCEPTANCE = 'scripts/frontend_acceptance/ACCEPTANCE_PFE_14_S0_FOUNDATION.cjs';
const OUTPUT = path.join(ROOT, 'acceptance-output/PFE_14_S0_FOUNDATION_RESULT.json');

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

function json(relativePath) {
  return JSON.parse(read(relativePath));
}

function git(...args) {
  return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim();
}

function check(condition, message) {
  if (!condition) throw new Error(message);
}

function same(actual, expected, message) {
  assert.deepEqual(actual, expected, message);
}

function sorted(values) {
  return [...values].sort((a, b) => a.localeCompare(b));
}

function writeResult(result) {
  fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
  fs.writeFileSync(OUTPUT, `${JSON.stringify(result, null, 2)}\n`);
}

function main() {
  const taskbook = read(TASKBOOK);
  const current = json(CURRENT);
  const routes = json(ROUTES);
  const dependencies = json(DEPENDENCIES);
  const boundary = json(BOUNDARY);
  const pfe13 = json(PFE13);
  const mcft09 = json(MCFT09);

  const baseSha = process.env.PFE14_BASE_SHA || boundary.base_main_sha;
  check(/^[0-9a-f]{40}$/.test(baseSha), 'PFE14_BASE_SHA_INVALID');
  git('cat-file', '-e', `${baseSha}^{commit}`);

  const changedFiles = git('diff', '--name-only', `${baseSha}...HEAD`)
    .split(/\r?\n/)
    .filter(Boolean);
  const expectedChangedFiles = boundary.expected_changed_files;

  same(sorted(changedFiles), sorted(expectedChangedFiles), 'PFE14_S0_CHANGED_FILES_MISMATCH');
  check(changedFiles.length === boundary.expected_changed_file_count, 'PFE14_S0_CHANGED_FILE_COUNT_MISMATCH');

  for (const changedFile of changedFiles) {
    check(
      boundary.allowed_prefixes.some((prefix) => changedFile.startsWith(prefix)),
      `PFE14_S0_FILE_OUTSIDE_ALLOWLIST:${changedFile}`,
    );
    check(
      !boundary.forbidden_prefixes.some((prefix) => changedFile.startsWith(prefix)),
      `PFE14_S0_FORBIDDEN_PREFIX:${changedFile}`,
    );
    check(
      !boundary.forbidden_exact_files.includes(changedFile),
      `PFE14_S0_FORBIDDEN_EXACT_FILE:${changedFile}`,
    );
  }

  check(pfe13.phase === 'PFE-13 Frontend Product v1 Freeze', 'PFE13_PHASE_MISMATCH');
  check(pfe13.frozen === true, 'PFE13_NOT_FROZEN');
  check(pfe13.productionLaunch === false, 'PFE13_PRODUCTION_LAUNCH_DRIFT');
  check(pfe13.commercialLaunch === false, 'PFE13_COMMERCIAL_LAUNCH_DRIFT');
  check(pfe13.postFreezeChangePolicy.routeChangeRequiresNewPhase === true, 'PFE13_ROUTE_POLICY_MISSING');
  check(pfe13.postFreezeChangePolicy.capabilityChangeRequiresNewPhase === true, 'PFE13_CAPABILITY_POLICY_MISSING');
  check(pfe13.postFreezeChangePolicy.visualChangeRequiresRegressionEvidence === true, 'PFE13_VISUAL_POLICY_MISSING');

  check(mcft09.capability_line_id === 'MCFT-CAP-09', 'MCFT09_CAPABILITY_LINE_MISMATCH');
  check(mcft09.implementation_authorized === false, 'MCFT09_IMPLEMENTATION_AUTHORITY_DRIFT');
  check(mcft09.runtime_source_authorized === false, 'MCFT09_RUNTIME_SOURCE_AUTHORITY_DRIFT');
  check(mcft09.background_scheduler_authorized === false, 'MCFT09_SCHEDULER_AUTHORITY_DRIFT');
  check(mcft09.canonical_write_authorized === false, 'MCFT09_CANONICAL_WRITE_AUTHORITY_DRIFT');

  check(current.phase_id === 'PFE-14', 'PFE14_PHASE_ID_MISMATCH');
  check(current.slice_id === 'PFE-14.S0', 'PFE14_SLICE_ID_MISMATCH');
  check(current.status === 'S0_FOUNDATION_IN_PROGRESS', 'PFE14_CURRENT_STATUS_MISMATCH');
  check(current.base_main_sha === baseSha, 'PFE14_CURRENT_BASE_SHA_MISMATCH');
  check(current.frontend_governance_authorized === true, 'PFE14_FRONTEND_GOVERNANCE_NOT_AUTHORIZED');
  check(current.s0_documentation_authorized === true, 'PFE14_S0_DOCS_NOT_AUTHORIZED');
  check(current.s0_static_acceptance_authorized === true, 'PFE14_S0_ACCEPTANCE_NOT_AUTHORIZED');

  const requiredFalseAuthority = [
    'react_source_authorized',
    'css_source_authorized',
    'route_source_authorized',
    'api_client_source_authorized',
    'runtime_claim_authorized',
    'shadow_online_label_authorized',
    'scheduler_ui_authorized',
    'evidence_freshness_ui_authorized',
    'backfill_ui_authorized',
    'recovery_ui_authorized',
    'backend_source_authorized',
    'database_delta_authorized',
    'package_delta_authorized',
    'workflow_delta_authorized',
    'controlled_action_authorized',
    'ao_act_authorized',
    'dispatch_authorized',
    'model_activation_authorized',
    'production_launch_authorized',
    'commercial_launch_authorized',
    'candidate_declaration_authorized',
    's0_effective',
  ];
  for (const field of requiredFalseAuthority) {
    check(current[field] === false, `PFE14_AUTHORITY_MUST_REMAIN_FALSE:${field}`);
  }

  check(routes.truth_policy === 'CANONICAL_GET_ONLY_NO_LEGACY_TRUTH_FALLBACK', 'PFE14_TRUTH_POLICY_MISMATCH');
  check(routes.scope_policy === 'EXACT_TENANT_PROJECT_GROUP_FIELD_SEASON_ZONE', 'PFE14_SCOPE_POLICY_MISMATCH');
  check(routes.canonical_route_module === 'apps/web/src/app/routes/operatorFieldRuntimeRoutes.tsx', 'PFE14_ROUTE_OWNER_MISMATCH');
  check(routes.canonical_route_page === 'apps/web/src/features/operator/fieldRuntime/McftCanonicalFieldRuntimeRoutePage.tsx', 'PFE14_PAGE_OWNER_MISMATCH');
  check(routes.canonical_api_client === 'apps/web/src/api/mcftFieldTwinRuntime.ts', 'PFE14_API_OWNER_MISMATCH');
  check(routes.s0_route_source_delta === 0, 'PFE14_ROUTE_SOURCE_DELTA');
  check(routes.react_source_delta === 0, 'PFE14_REACT_SOURCE_DELTA');
  check(routes.api_client_delta === 0, 'PFE14_API_CLIENT_DELTA');

  const formalRouteNames = routes.formal_routes.map((entry) => entry.route);
  for (const requiredRoute of [
    '/operator/twin',
    '/operator/fields',
    '/operator/fields/:fieldId',
    '/operator/fields/:fieldId/state',
    '/operator/fields/:fieldId/forecast',
    '/operator/fields/:fieldId/scenario',
    '/operator/fields/:fieldId/action-lifecycle',
    '/operator/fields/:fieldId/residual',
    '/operator/fields/:fieldId/calibration',
    '/operator/fields/:fieldId/evidence-trace',
    '/operator/fields/:fieldId/health',
    '/operator/pilot',
  ]) {
    check(formalRouteNames.includes(requiredRoute), `PFE14_FORMAL_ROUTE_MISSING:${requiredRoute}`);
  }
  check(new Set(formalRouteNames).size === formalRouteNames.length, 'PFE14_DUPLICATE_FORMAL_ROUTE');
  same(routes.forbidden_new_route_prefixes, ['/operator/shadow', '/operator/mcft9', '/app/operator/shadow'], 'PFE14_FORBIDDEN_ROUTE_PREFIX_DRIFT');

  check(dependencies.runtime_capability_line === 'MCFT-CAP-09', 'PFE14_DEPENDENCY_LINE_MISMATCH');
  check(dependencies.global_rules.frontend_may_not_authorize_runtime === true, 'PFE14_RUNTIME_AUTHORIZATION_RULE_MISSING');
  check(dependencies.global_rules.frontend_may_not_synthesize_missing_runtime_facts === true, 'PFE14_SYNTHESIS_RULE_MISSING');
  check(dependencies.global_rules.frontend_may_not_hardcode_shadow_online === true, 'PFE14_HARDCODE_RULE_MISSING');
  check(dependencies.global_rules.formal_runtime_requests_must_remain_get_only === true, 'PFE14_GET_ONLY_RULE_MISSING');

  const slices = new Map(dependencies.slice_dependencies.map((entry) => [entry.pfe_slice, entry]));
  check(slices.get('PFE-14.S0')?.dependency_satisfied === true, 'PFE14_S0_DEPENDENCY_NOT_SATISFIED');
  check(slices.get('PFE-14.S1')?.dependency_satisfied === true, 'PFE14_S1_DESIGN_DEPENDENCY_NOT_AVAILABLE');
  check(slices.get('PFE-14.S2')?.dependency_satisfied === true, 'PFE14_S2_VISUAL_DEPENDENCY_NOT_AVAILABLE');
  for (const blockedSlice of ['PFE-14.S4', 'PFE-14.S5', 'PFE-14.S6', 'PFE-14.S7', 'PFE-14.S8', 'PFE-14.S9']) {
    check(slices.get(blockedSlice)?.dependency_satisfied === false, `PFE14_RUNTIME_DEPENDENT_SLICE_MUST_REMAIN_BLOCKED:${blockedSlice}`);
  }

  check(taskbook.includes('# PFE-14 Shadow-Online Operator Runtime Console Promotion'), 'PFE14_TASKBOOK_TITLE_MISSING');
  check(taskbook.includes('PFE_14_S0_POST_FREEZE_AUTHORITY_AND_REPOSITORY_RECONCILIATION'), 'PFE14_FIRST_ACTION_MISSING');
  check(taskbook.includes('PFE_14_SHADOW_ONLINE_OPERATOR_READ_SURFACE_COMPLETE'), 'PFE14_COMPLETION_CLAIM_MISSING');
  check(taskbook.includes('PFE-14.S0'), 'PFE14_S0_DEFINITION_MISSING');
  check(taskbook.includes('PFE-14.S9'), 'PFE14_S9_DEFINITION_MISSING');
  check(taskbook.includes('HA-30'), 'PFE14_HARD_ACCEPTANCE_INCOMPLETE');

  const deltas = boundary.delta_assertions;
  for (const [name, value] of Object.entries(deltas)) {
    check(value === 0, `PFE14_S0_NONZERO_DELTA:${name}`);
  }
  check(boundary.candidate_declaration === false, 'PFE14_S0_CANDIDATE_DECLARATION');
  check(boundary.runtime_implementation_authority === false, 'PFE14_S0_RUNTIME_IMPLEMENTATION_AUTHORITY');
  check(boundary.shadow_online_product_claim === false, 'PFE14_S0_SHADOW_ONLINE_PRODUCT_CLAIM');

  const result = {
    status: 'PASS',
    change_class: boundary.change_class,
    base_main_sha: baseSha,
    head_sha: git('rev-parse', 'HEAD'),
    changed_file_count: changedFiles.length,
    changed_files: sorted(changedFiles),
    frontend_predecessor_frozen: true,
    mcft09_status: mcft09.status,
    mcft09_implementation_authorized: false,
    canonical_route_owner: routes.canonical_route_page,
    canonical_api_owner: routes.canonical_api_client,
    exact_scope_policy: routes.scope_policy,
    react_source_delta: 0,
    css_source_delta: 0,
    route_source_delta: 0,
    api_client_delta: 0,
    backend_source_delta: 0,
    database_delta: 0,
    package_delta: 0,
    workflow_delta: 0,
    runtime_claim_delta: 0,
    controlled_action_delta: 0,
    s0_effective_claim: boundary.completion_claim_when_accepted,
    next_slice: boundary.next_slice_after_effectiveness,
  };

  writeResult(result);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

try {
  main();
} catch (error) {
  const result = {
    status: 'FAIL',
    error: error instanceof Error ? error.message : String(error),
  };
  writeResult(result);
  process.stderr.write(`${JSON.stringify(result, null, 2)}\n`);
  process.exitCode = 1;
}
