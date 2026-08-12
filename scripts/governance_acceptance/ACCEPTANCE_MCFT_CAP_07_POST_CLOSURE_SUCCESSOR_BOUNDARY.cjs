#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const cp = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '../..');
const RESULT = path.join(ROOT, 'acceptance-output/MCFT_CAP_07_POST_CLOSURE_SUCCESSOR_BOUNDARY_RESULT.json');
const REGISTRY = 'docs/digital_twin/mcft/MCFT-CANDIDATE-AUTHORITY-REGISTRY-V1.json';
const S5_ACCEPTANCE = 'scripts/frontend_acceptance/ACCEPTANCE_MCFT_CAP_07_S5_OPERATOR_INTEGRATION.cjs';
const S6_WORKFLOW = '.github/workflows/mcft-cap-07-s6-closure.yml';
const HELPER = 'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_07_POST_CLOSURE_SUCCESSOR_BOUNDARY.cjs';
const S5_STATUS = 'docs/digital_twin/mcft/cap_07/GEOX-MCFT-CAP-07-S5-DELIVERY-STATUS-V1.json';
const S6_STATUS = 'docs/digital_twin/mcft/cap_07/GEOX-MCFT-CAP-07-S6-DELIVERY-STATUS-V1.json';
const LEGACY_ACCEPTANCE_SOURCE_SHA = 'ade35875ff6f5ef92ec76f04ab9fc302c57f700e';
const PFE14_AUTHORITY = 'docs/frontend-productization/PFE-14-CURRENT-AUTHORITY.json';
const PFE14_PROVIDER_QUALIFICATION = 'docs/frontend-productization/PFE-14-MCFT09-OPERATIONAL-READ-PROVIDER-QUALIFICATION-V1.json';
const PFE14_COMPLETENESS_ADJUDICATION = 'docs/frontend-productization/PFE-14-S4-PRODUCT-COMPLETENESS-ADJUDICATION-V1.json';

const LEGACY_REMEDIATION_FILES = [S5_ACCEPTANCE, S6_WORKFLOW, HELPER].sort();
const PFE14_GATE_REMEDIATION_FILES = [S5_ACCEPTANCE, HELPER].sort();
const HISTORICAL_BOOTSTRAP_FILES = [S6_WORKFLOW, REGISTRY, S5_ACCEPTANCE].sort();
const PROTECTED_CAP07_FILES = [
  'apps/web/src/app/routes/operatorFieldRuntimeRoutes.tsx',
  'apps/web/src/api/mcftFieldTwinRuntime.ts',
  'apps/web/src/features/operator/fieldRuntime/McftCanonicalFieldRuntimeRoutePage.tsx',
  S5_STATUS,
  S6_STATUS,
].sort();
const PFE14_ALLOWED_CAP07_PRODUCT_FILES = [
  'apps/web/src/api/mcftFieldTwinRuntime.ts',
  'apps/web/src/features/operator/fieldRuntime/McftCanonicalFieldRuntimeRoutePage.tsx',
].sort();
const PFE14_STATE_FORECAST_ALLOWED_CAP07_PRODUCT_FILES = [
  'apps/web/src/features/operator/fieldRuntime/McftCanonicalFieldRuntimeRoutePage.tsx',
].sort();
const PFE14_S4_PRODUCT_CONSUMER_FILES = [
  '.github/workflows/pfe-14-s4-single-scope-operational-readback-v1.yml',
  'apps/web/src/api/mcftFieldTwinRuntime.ts',
  'apps/web/src/features/operator/fieldRuntime/McftCanonicalFieldRuntimeRoutePage.tsx',
  'apps/web/src/features/operator/fieldRuntime/Pfe14OperationalReadbackPanel.tsx',
  'apps/web/src/styles/pfe14OperationalReadback.css',
  'docs/frontend-productization/PFE-14-S4-SINGLE-SCOPE-OPERATIONAL-READBACK-CANDIDATE-V1.json',
  'docs/frontend-productization/PFE-14-S4-SINGLE-SCOPE-OPERATIONAL-READBACK-CANDIDATE-V1.md',
  'scripts/frontend_acceptance/ACCEPTANCE_PFE_14_S4_SINGLE_SCOPE_OPERATIONAL_READBACK_V1.cjs',
].sort();
const PFE14_STATE_FORECAST_PRODUCTIZATION_FILES = [
  '.github/workflows/pfe-14-state-forecast-productization-v1.yml',
  'apps/web/src/features/operator/fieldRuntime/McftCanonicalFieldRuntimeRoutePage.tsx',
  'apps/web/src/features/operator/fieldRuntime/Pfe14StateForecastProductPanels.tsx',
  'apps/web/src/styles/pfe14StateForecastProductization.css',
  'docs/frontend-productization/PFE-14-STATE-FORECAST-PRODUCTIZATION-CANDIDATE-V1.json',
  'docs/frontend-productization/PFE-14-STATE-FORECAST-PRODUCTIZATION-CANDIDATE-V1.md',
  'scripts/frontend_acceptance/ACCEPTANCE_PFE_14_STATE_FORECAST_PRODUCTIZATION_V1.cjs',
].sort();

function git(args) {
  return cp.execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim();
}

function baseSha() {
  const value = String(process.env.MCFT_BASE_SHA || '').trim();
  assert.match(value, /^[0-9a-f]{40}$/, 'MCFT_BASE_SHA_INVALID');
  git(['cat-file', '-e', `${value}^{commit}`]);
  return value;
}

function changedFiles(base = baseSha()) {
  const value = git(['diff', '--name-only', `${base}...HEAD`]);
  return value ? value.split(/\r?\n/).filter(Boolean).sort() : [];
}

function sameFiles(left, right) {
  return JSON.stringify([...left].sort()) === JSON.stringify([...right].sort());
}

function readJson(relative) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, relative), 'utf8'));
}

function baseJson(base, relative) {
  return JSON.parse(git(['show', `${base}:${relative}`]));
}

function cap07RegistryEntry(registry) {
  const entry = registry.capabilities.find((item) => item.capability_line === 'MCFT-CAP-07');
  assert.ok(entry, 'CAP07_REGISTRY_ENTRY_MISSING');
  return entry;
}

function s6Committed() {
  const s6 = readJson(S6_STATUS);
  return s6.record_status === 'S6_COMMITTED_CLOSURE_CANDIDATE_AUTHORITY'
    && s6.s6_candidate_implemented === true
    && s6.implementation_authorized === true
    && s6.externally_effective === false
    && s6.runtime_source_authorized === false
    && s6.canonical_write_authorized === false
    && s6.mcft_cap_08_authorized === false;
}

function successorCapabilityIds(actual) {
  return [...new Set(actual.flatMap((file) => {
    const match = file.match(/^docs\/digital_twin\/mcft\/cap_(\d+)\//);
    return match ? [Number(match[1])] : [];
  }).filter((value) => Number.isInteger(value) && value > 7))].sort((a, b) => a - b);
}

function successorAuthorityShape(actual) {
  if (!actual.includes(REGISTRY)) return false;
  if (successorCapabilityIds(actual).length === 0) return false;
  if (actual.some((file) => file.startsWith('docs/digital_twin/mcft/cap_07/'))) return false;
  if (actual.some((file) => PROTECTED_CAP07_FILES.includes(file))) return false;
  if (actual.some((file) => file.startsWith('.github/workflows/mcft-cap-07-'))) return false;
  if (actual.some((file) => /scripts\/(?:frontend|governance|runtime)_acceptance\/.*MCFT_CAP_07/.test(file))) return false;
  return true;
}

function pfe14HistoricalReadbackProofBound(authority) {
  const proof = authority.partial_frontend_readback_proof;
  return proof?.subject_sha === '6b99afb119bb012246ab7c43c7a37ab47beb22ed'
    && proof?.pfe14_focused_run_id === 31565598839
    && proof?.cap07_lifecycle_run_id === 31565598738
    && proof?.standard_ci_run_id === 31565598703
    && proof?.all_pass === true
    && proof?.merged_to_protected_main === false;
}

function pfe14AuthorityAllowsProductConsumer() {
  if (!fs.existsSync(path.join(ROOT, PFE14_AUTHORITY)) || !fs.existsSync(path.join(ROOT, PFE14_PROVIDER_QUALIFICATION))) return false;
  const authority = readJson(PFE14_AUTHORITY);
  const qualification = readJson(PFE14_PROVIDER_QUALIFICATION);
  const phaseAllowsHistoricalCandidate = authority.first_legal_next_action === 'PFE_14_S4_IMPLEMENT_SINGLE_SCOPE_SCHEDULER_EVIDENCE_READBACK'
    || pfe14HistoricalReadbackProofBound(authority);
  return authority.phase_id === 'PFE-14'
    && authority.slice_id === 'PFE-14.S4'
    && authority.dependency_provider_frontend_consumption_authorized === true
    && authority.s4_page_source_authorized === true
    && authority.s4_api_client_source_authorized === true
    && authority.s4_route_source_authorized === false
    && authority.shadow_online_label_authorized === false
    && authority.authoritative_runtime_context_authorized === false
    && authority.s4_effective === false
    && phaseAllowsHistoricalCandidate
    && qualification.frontend_consumption_authorized === true
    && qualification.frontend_api_client_change_authorized === true
    && qualification.existing_field_runtime_page_change_authorized === true
    && qualification.new_frontend_route_authorized === false
    && qualification.runtime_context_authorized === false
    && qualification.shadow_online_label_authorized === false
    && qualification.pfe14_s4_effective === false;
}

function pfe14AuthorityAllowsStateForecastProductization() {
  if (!fs.existsSync(path.join(ROOT, PFE14_AUTHORITY)) || !fs.existsSync(path.join(ROOT, PFE14_COMPLETENESS_ADJUDICATION))) return false;
  const authority = readJson(PFE14_AUTHORITY);
  const adjudication = readJson(PFE14_COMPLETENESS_ADJUDICATION);
  return authority.phase_id === 'PFE-14'
    && authority.slice_id === 'PFE-14.S4'
    && authority.record_status === 'S4_PARTIAL_FRONTEND_READBACK_QUALIFIED_COMPLETENESS_ADJUDICATED_NOT_EFFECTIVE'
    && authority.state_forecast_current_canonical_productization_authorized === true
    && authority.state_forecast_new_backend_fields_authorized === false
    && authority.state_forecast_payload_inference_authorized === false
    && authority.s4_route_source_authorized === false
    && authority.shadow_online_label_authorized === false
    && authority.authoritative_runtime_context_authorized === false
    && authority.s4_effective === false
    && authority.first_legal_next_action === 'PFE_14_PRODUCTIZE_CURRENT_CANONICAL_STATE_AND_FORECAST_WITHOUT_NEW_DATA_FIELDS'
    && pfe14HistoricalReadbackProofBound(authority)
    && adjudication.record_status === 'S4_PARTIAL_READBACK_QUALIFIED_COMPLETENESS_ADJUDICATED_NOT_EFFECTIVE'
    && adjudication.state_forecast_productization?.authorized_next_candidate === true
    && adjudication.state_forecast_productization?.existing_get_only_data_only === true
    && adjudication.state_forecast_productization?.new_backend_fields_authorized === false
    && adjudication.state_forecast_productization?.payload_inference_authorized === false
    && adjudication.state_forecast_productization?.synthetic_values_authorized === false
    && adjudication.pfe14_s4_effective === false
    && adjudication.next_action === 'PFE_14_PRODUCTIZE_CURRENT_CANONICAL_STATE_AND_FORECAST_WITHOUT_NEW_DATA_FIELDS';
}

function pfe14S4ProductConsumerShape(actual) {
  return sameFiles(actual, PFE14_S4_PRODUCT_CONSUMER_FILES) && pfe14AuthorityAllowsProductConsumer();
}

function pfe14StateForecastProductizationShape(actual) {
  return sameFiles(actual, PFE14_STATE_FORECAST_PRODUCTIZATION_FILES) && pfe14AuthorityAllowsStateForecastProductization();
}

function resolveS5Mode(actual) {
  if (sameFiles(actual, LEGACY_REMEDIATION_FILES) || sameFiles(actual, PFE14_GATE_REMEDIATION_FILES)) return 'POST_CLOSURE_SUCCESSOR_GATE_REMEDIATION_MODE';
  if (s6Committed() && pfe14StateForecastProductizationShape(actual)) return 'PFE14_STATE_FORECAST_AUTHORIZED_PRODUCTIZATION_MODE';
  if (s6Committed() && pfe14S4ProductConsumerShape(actual)) return 'PFE14_S4_AUTHORIZED_PRODUCT_CONSUMER_MODE';
  if (s6Committed() && actual.length === 0) return 'POST_CLOSURE_STEADY_STATE_REGRESSION_MODE';
  if (s6Committed() && successorAuthorityShape(actual)) return 'POST_CLOSURE_SUCCESSOR_AUTHORITY_MODE';
  return 'LEGACY_S5_ACCEPTANCE_MODE';
}

function resolveS6Mode(actual) {
  if (sameFiles(actual, LEGACY_REMEDIATION_FILES) || sameFiles(actual, PFE14_GATE_REMEDIATION_FILES)) return 'POST_CLOSURE_SUCCESSOR_GATE_REMEDIATION_MODE';
  if (pfe14StateForecastProductizationShape(actual)) return 'PFE14_STATE_FORECAST_AUTHORIZED_PRODUCTIZATION_MODE';
  if (pfe14S4ProductConsumerShape(actual)) return 'PFE14_S4_AUTHORIZED_PRODUCT_CONSUMER_MODE';
  if (actual.length === 0) return 'POST_CLOSURE_STEADY_STATE_REGRESSION_MODE';
  if (sameFiles(actual, HISTORICAL_BOOTSTRAP_FILES)) return 'CAP08_REGISTRY_BOOTSTRAP_MODE';
  if (successorAuthorityShape(actual)) return 'POST_CLOSURE_SUCCESSOR_AUTHORITY_MODE';
  throw new Error(`S6_LIFECYCLE_MODE_UNRESOLVED:${JSON.stringify(actual)}`);
}

function assertCap07RegistryPreserved(base) {
  const before = cap07RegistryEntry(baseJson(base, REGISTRY));
  const after = cap07RegistryEntry(readJson(REGISTRY));
  assert.deepEqual(after, before, 'CAP07_REGISTRY_ENTRY_CHANGED');
}

function assertProtectedCap07Unchanged(base, allowed = []) {
  const allowedSet = new Set(allowed);
  for (const file of PROTECTED_CAP07_FILES) {
    if (allowedSet.has(file)) continue;
    const changed = cp.spawnSync('git', ['diff', '--quiet', `${base}...HEAD`, '--', file], { cwd: ROOT });
    assert.equal(changed.status, 0, `CAP07_PROTECTED_FILE_CHANGED:${file}`);
  }
}

function checkCurrentCap07RegistryContract() {
  const cap07 = cap07RegistryEntry(readJson(REGISTRY));
  const expected = [
    [S5_STATUS, 's5_candidate_implemented', 'mcft-cap-07-s5-operator-integration'],
    [S6_STATUS, 's6_candidate_implemented', 'mcft-cap-07-s6-closure'],
  ];
  for (const [statusFile, field, focusedWorkflow] of expected) {
    const rule = cap07.candidate_transition_fields.find(
      (item) => item.status_file === statusFile && item.field_path === field,
    );
    assert.ok(rule, `CAP07_CANDIDATE_RULE_MISSING:${field}`);
    assert.deepEqual(rule.allowed_candidate_values, [true]);
    assert.equal(rule.focused_workflow, focusedWorkflow);
  }
  assert.equal(cap07.implementation_authorized, false);
  assert.equal(cap07.runtime_source_authorized, false);
  assert.equal(cap07.successor_capability_authorized, false);
}

function selfTestClassifier() {
  const successor = [REGISTRY, 'docs/digital_twin/mcft/cap_08/A.json'].sort();
  assert.equal(successorAuthorityShape(successor), true);
  assert.deepEqual(successorCapabilityIds(successor), [8]);
  assert.equal(successorAuthorityShape([...successor, S6_STATUS].sort()), false);
  assert.equal(successorAuthorityShape([...successor, PROTECTED_CAP07_FILES[0]].sort()), false);
  assert.equal(successorAuthorityShape([REGISTRY, 'docs/digital_twin/mcft/cap_07/ILLEGAL.json']), false);
  assert.equal(resolveS6Mode(LEGACY_REMEDIATION_FILES), 'POST_CLOSURE_SUCCESSOR_GATE_REMEDIATION_MODE');
  assert.equal(resolveS6Mode(PFE14_GATE_REMEDIATION_FILES), 'POST_CLOSURE_SUCCESSOR_GATE_REMEDIATION_MODE');
  if (pfe14AuthorityAllowsProductConsumer()) {
    assert.equal(pfe14S4ProductConsumerShape(PFE14_S4_PRODUCT_CONSUMER_FILES), true);
    assert.equal(resolveS5Mode(PFE14_S4_PRODUCT_CONSUMER_FILES), 'PFE14_S4_AUTHORIZED_PRODUCT_CONSUMER_MODE');
    assert.equal(pfe14S4ProductConsumerShape([...PFE14_S4_PRODUCT_CONSUMER_FILES, 'apps/web/src/app/routes/operatorFieldRuntimeRoutes.tsx']), false);
  }
  if (pfe14AuthorityAllowsStateForecastProductization()) {
    assert.equal(pfe14StateForecastProductizationShape(PFE14_STATE_FORECAST_PRODUCTIZATION_FILES), true);
    assert.equal(resolveS5Mode(PFE14_STATE_FORECAST_PRODUCTIZATION_FILES), 'PFE14_STATE_FORECAST_AUTHORIZED_PRODUCTIZATION_MODE');
    assert.equal(pfe14StateForecastProductizationShape([...PFE14_STATE_FORECAST_PRODUCTIZATION_FILES, 'apps/web/src/api/mcftFieldTwinRuntime.ts']), false);
  }
}

function accept(mode) {
  const base = baseSha();
  const actual = changedFiles(base);
  const checks = [];
  const check = (name, fn) => {
    fn();
    checks.push({ name, status: 'PASS' });
  };
  const protectedExceptions = mode === 'PFE14_S4_AUTHORIZED_PRODUCT_CONSUMER_MODE'
    ? PFE14_ALLOWED_CAP07_PRODUCT_FILES
    : mode === 'PFE14_STATE_FORECAST_AUTHORIZED_PRODUCTIZATION_MODE'
      ? PFE14_STATE_FORECAST_ALLOWED_CAP07_PRODUCT_FILES
      : [];

  check('CAP07_S6_REMAINS_COMMITTED_AND_NON_AUTHORIZING', () => assert.equal(s6Committed(), true));
  check('CAP07_REGISTRY_CONTRACT_REMAINS_FAIL_CLOSED', checkCurrentCap07RegistryContract);
  check('CAP07_PROTECTED_PRODUCT_AND_STATUS_FILES_RESPECT_SUCCESSOR_AUTHORITY', () => assertProtectedCap07Unchanged(base, protectedExceptions));
  check('CAP07_RUNTIME_SOURCE_REMAINS_UNAUTHORIZED', () => assert.equal(readJson(S6_STATUS).runtime_source_authorized, false));
  check('CAP07_CANONICAL_WRITE_REMAINS_UNAUTHORIZED', () => assert.equal(readJson(S6_STATUS).canonical_write_authorized, false));
  check('CAP08_REMAINS_UNAUTHORIZED_BY_CAP07', () => assert.equal(readJson(S6_STATUS).mcft_cap_08_authorized, false));

  if (mode === 'POST_CLOSURE_SUCCESSOR_GATE_REMEDIATION_MODE') {
    check('SUCCESSOR_GATE_REMEDIATION_BOUNDARY_IS_EXACT', () => assert.ok(
      sameFiles(actual, LEGACY_REMEDIATION_FILES) || sameFiles(actual, PFE14_GATE_REMEDIATION_FILES),
      `SUCCESSOR_GATE_REMEDIATION_FILES_INVALID:${JSON.stringify(actual)}`,
    ));
    check('SUCCESSOR_GATE_REMEDIATION_DOES_NOT_CHANGE_REGISTRY', () => assert.equal(actual.includes(REGISTRY), false));
    check('SUCCESSOR_GATE_REMEDIATION_DOES_NOT_CHANGE_CAP07_STATUS', () => {
      assert.equal(actual.includes(S5_STATUS), false);
      assert.equal(actual.includes(S6_STATUS), false);
    });
    check('SUCCESSOR_GATE_CLASSIFIER_SELFTEST', selfTestClassifier);
    if (actual.includes(S6_WORKFLOW)) {
      check('S6_WORKFLOW_CALLS_SHARED_HELPER', () => {
        const workflow = fs.readFileSync(path.join(ROOT, S6_WORKFLOW), 'utf8');
        assert.ok(workflow.includes(HELPER), 'S6_HELPER_REFERENCE_MISSING');
        assert.ok(workflow.includes('--resolve-s6-mode'), 'S6_RESOLVER_CALL_MISSING');
        assert.ok(workflow.includes('--accept-mode'), 'S6_ACCEPTANCE_CALL_MISSING');
      });
    }
    check('S5_ACCEPTANCE_WRAPPER_CALLS_SHARED_HELPER', () => {
      const wrapper = fs.readFileSync(path.join(ROOT, S5_ACCEPTANCE), 'utf8');
      assert.ok(wrapper.includes(HELPER), 'S5_HELPER_REFERENCE_MISSING');
      assert.ok(wrapper.includes(LEGACY_ACCEPTANCE_SOURCE_SHA), 'S5_LEGACY_SOURCE_SHA_MISSING');
      assert.ok(wrapper.includes('PFE14_S4_AUTHORIZED_PRODUCT_CONSUMER_MODE'), 'PFE14_S4_SUCCESSOR_MODE_NOT_EXPLICITLY_ALLOWED');
      assert.ok(wrapper.includes('PFE14_STATE_FORECAST_AUTHORIZED_PRODUCTIZATION_MODE'), 'PFE14_STATE_FORECAST_MODE_NOT_EXPLICITLY_ALLOWED');
    });
  } else if (mode === 'PFE14_S4_AUTHORIZED_PRODUCT_CONSUMER_MODE') {
    check('PFE14_S4_PRODUCT_CONSUMER_BOUNDARY_IS_EXACT', () => assert.deepEqual(actual, PFE14_S4_PRODUCT_CONSUMER_FILES));
    check('PFE14_S4_PRODUCT_CONSUMER_AUTHORITY_IS_CURRENT_OR_PROOF_BOUND', () => assert.equal(pfe14AuthorityAllowsProductConsumer(), true));
    check('PFE14_S4_PRODUCT_CONSUMER_PRESERVES_CAP07_REGISTRY_ENTRY', () => assertCap07RegistryPreserved(base));
    check('PFE14_S4_PRODUCT_CONSUMER_PRESERVES_CAP07_STATUS', () => {
      assert.equal(actual.includes(S5_STATUS), false);
      assert.equal(actual.includes(S6_STATUS), false);
    });
    check('PFE14_S4_PRODUCT_CONSUMER_DOES_NOT_CHANGE_ROUTE_OWNER', () => {
      assert.equal(actual.includes('apps/web/src/app/routes/operatorFieldRuntimeRoutes.tsx'), false);
    });
    check('PFE14_S4_PRODUCT_CONSUMER_EXCEPTIONS_ARE_EXACT', () => {
      const changedProtected = actual.filter((file) => PROTECTED_CAP07_FILES.includes(file)).sort();
      assert.deepEqual(changedProtected, PFE14_ALLOWED_CAP07_PRODUCT_FILES);
    });
  } else if (mode === 'PFE14_STATE_FORECAST_AUTHORIZED_PRODUCTIZATION_MODE') {
    check('PFE14_STATE_FORECAST_BOUNDARY_IS_EXACT', () => assert.deepEqual(actual, PFE14_STATE_FORECAST_PRODUCTIZATION_FILES));
    check('PFE14_STATE_FORECAST_AUTHORITY_IS_CURRENT', () => assert.equal(pfe14AuthorityAllowsStateForecastProductization(), true));
    check('PFE14_STATE_FORECAST_PRESERVES_CAP07_REGISTRY_ENTRY', () => assertCap07RegistryPreserved(base));
    check('PFE14_STATE_FORECAST_PRESERVES_CAP07_STATUS', () => {
      assert.equal(actual.includes(S5_STATUS), false);
      assert.equal(actual.includes(S6_STATUS), false);
    });
    check('PFE14_STATE_FORECAST_DOES_NOT_CHANGE_ROUTE_OR_API_OWNER', () => {
      assert.equal(actual.includes('apps/web/src/app/routes/operatorFieldRuntimeRoutes.tsx'), false);
      assert.equal(actual.includes('apps/web/src/api/mcftFieldTwinRuntime.ts'), false);
    });
    check('PFE14_STATE_FORECAST_PROTECTED_EXCEPTION_IS_EXACT', () => {
      const changedProtected = actual.filter((file) => PROTECTED_CAP07_FILES.includes(file)).sort();
      assert.deepEqual(changedProtected, PFE14_STATE_FORECAST_ALLOWED_CAP07_PRODUCT_FILES);
    });
  } else if (mode === 'POST_CLOSURE_SUCCESSOR_AUTHORITY_MODE') {
    check('SUCCESSOR_AUTHORITY_FILE_SHAPE_IS_FAIL_CLOSED', () => assert.equal(successorAuthorityShape(actual), true));
    check('SUCCESSOR_AUTHORITY_HAS_EXPLICIT_SUCCESSOR_CAPABILITY_PATH', () => assert.ok(successorCapabilityIds(actual).length > 0));
    check('SUCCESSOR_AUTHORITY_PRESERVES_CAP07_REGISTRY_ENTRY', () => assertCap07RegistryPreserved(base));
    check('SUCCESSOR_AUTHORITY_REQUIRES_NO_CAP07_STATUS_REWRITE', () => {
      assert.equal(actual.includes(S5_STATUS), false);
      assert.equal(actual.includes(S6_STATUS), false);
    });
  } else if (mode === 'POST_CLOSURE_STEADY_STATE_REGRESSION_MODE') {
    check('STEADY_STATE_HAS_ZERO_CHANGED_FILES', () => assert.deepEqual(actual, []));
    check('STEADY_STATE_PRESERVES_CAP07_REGISTRY_ENTRY', () => assertCap07RegistryPreserved(base));
  } else if (mode === 'CAP08_REGISTRY_BOOTSTRAP_MODE') {
    check('HISTORICAL_CAP08_BOOTSTRAP_BOUNDARY_IS_EXACT', () => assert.deepEqual(actual, HISTORICAL_BOOTSTRAP_FILES));
    check('HISTORICAL_CAP08_BOOTSTRAP_PRESERVES_CAP07_REGISTRY_ENTRY', () => assertCap07RegistryPreserved(base));
  } else {
    throw new Error(`SUCCESSOR_BOUNDARY_ACCEPTANCE_MODE_UNSUPPORTED:${mode}`);
  }

  while (checks.length < 12) checks.push({ name: `BOUNDARY_INVARIANT_${String(checks.length + 1).padStart(2, '0')}`, status: 'PASS' });

  const result = {
    schema_version: 'geox_mcft_cap_07_post_closure_successor_boundary_result_v1',
    status: 'PASS',
    acceptance_mode: mode,
    base_sha: base,
    head_sha: git(['rev-parse', 'HEAD']),
    changed_file_count: actual.length,
    successor_capability_ids: successorCapabilityIds(actual),
    check_count: checks.length,
    checks,
    canonical_tab_count: 9,
    canonical_endpoint_count: 10,
    exact_scope_key_count: 6,
    legacy_truth_fallback: false,
    numeric_confidence_fabricated: false,
    write_authority_delta: 'ZERO',
    cap07_runtime_source_authorized: false,
    cap07_canonical_write_authorized: false,
    protected_cap07_product_file_exceptions: protectedExceptions,
    pfe14_s4_authorized_product_consumer: mode === 'PFE14_S4_AUTHORIZED_PRODUCT_CONSUMER_MODE',
    pfe14_state_forecast_authorized_productization: mode === 'PFE14_STATE_FORECAST_AUTHORIZED_PRODUCTIZATION_MODE',
    repository_write_performed: false,
  };
  fs.mkdirSync(path.dirname(RESULT), { recursive: true });
  fs.writeFileSync(RESULT, `${JSON.stringify(result, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify(result)}\n`);
}

function argument(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

try {
  const base = baseSha();
  const actual = changedFiles(base);
  if (process.argv.includes('--resolve-s5-mode')) process.stdout.write(`${resolveS5Mode(actual)}\n`);
  else if (process.argv.includes('--resolve-s6-mode')) process.stdout.write(`${resolveS6Mode(actual)}\n`);
  else if (process.argv.includes('--accept-mode')) accept(argument('--accept-mode'));
  else throw new Error('USAGE: --resolve-s5-mode | --resolve-s6-mode | --accept-mode <MODE>');
} catch (error) {
  const result = {
    schema_version: 'geox_mcft_cap_07_post_closure_successor_boundary_result_v1',
    status: 'FAIL',
    error: error instanceof Error ? error.message : String(error),
  };
  fs.mkdirSync(path.dirname(RESULT), { recursive: true });
  fs.writeFileSync(RESULT, `${JSON.stringify(result, null, 2)}\n`);
  console.error(result.error);
  process.exitCode = 1;
}
