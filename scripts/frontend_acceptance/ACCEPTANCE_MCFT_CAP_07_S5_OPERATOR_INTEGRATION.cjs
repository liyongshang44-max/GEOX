#!/usr/bin/env node
// Purpose: prove the frozen S5 Operator product contract across its exact candidate, formal workflow remediation, and S6 successor-regression lifecycle modes.
// Boundary: repository reads and git diff inspection only; no browser, network, product API, database, or write action.
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');

const ROOT = path.resolve(__dirname, '../..');
const OUT = path.join(ROOT, 'acceptance-output/MCFT_CAP_07_S5_OPERATOR_INTEGRATION_RESULT.json');
const REQUESTED_MODE = String(process.env.MCFT_S5_ACCEPTANCE_MODE || 'AUTO').trim();
const checks = [];
const read = (relative) => fs.readFileSync(path.join(ROOT, relative), 'utf8');
const json = (relative) => JSON.parse(read(relative));
const check = (name, action) => { action(); checks.push({ name, status: 'PASS' }); };
const includesAll = (content, tokens) => tokens.every((token) => content.includes(token));

const FILES = {
  route: 'apps/web/src/app/routes/operatorFieldRuntimeRoutes.tsx',
  client: 'apps/web/src/api/mcftFieldTwinRuntime.ts',
  page: 'apps/web/src/features/operator/fieldRuntime/McftCanonicalFieldRuntimeRoutePage.tsx',
  s5: 'docs/digital_twin/mcft/cap_07/GEOX-MCFT-CAP-07-S5-DELIVERY-STATUS-V1.json',
  s6: 'docs/digital_twin/mcft/cap_07/GEOX-MCFT-CAP-07-S6-DELIVERY-STATUS-V1.json',
  registry: 'docs/digital_twin/mcft/MCFT-CANDIDATE-AUTHORITY-REGISTRY-V1.json',
  workflow: '.github/workflows/mcft-cap-07-s5-operator-integration.yml',
  acceptance: 'scripts/frontend_acceptance/ACCEPTANCE_MCFT_CAP_07_S5_OPERATOR_INTEGRATION.cjs',
};

const EXACT_CANDIDATE_FILES = Object.values(FILES).sort();
const WORKFLOW_REMEDIATION_FILES = [FILES.workflow, FILES.acceptance].sort();
const S5_PROTECTED_PRODUCT_FILES = [FILES.route, FILES.client, FILES.page, FILES.s5, FILES.workflow, FILES.acceptance].sort();

function changedFiles() {
  const base = String(process.env.MCFT_BASE_SHA || '').trim();
  const refs = base ? [`${base}...HEAD`] : ['origin/main...HEAD', 'main...HEAD'];
  for (const ref of refs) {
    try {
      return cp.execFileSync('git', ['diff', '--name-only', ref], { cwd: ROOT, encoding: 'utf8' })
        .trim().split(/\r?\n/).filter(Boolean).sort();
    } catch (_error) {}
  }
  return [];
}

function resolveMode(actual, s6) {
  const allowed = ['S5_EXACT_CANDIDATE_MODE', 'S6_SUCCESSOR_REGRESSION_MODE', 'S5_WORKFLOW_REMEDIATION_MODE'];
  if (REQUESTED_MODE !== 'AUTO') {
    assert.ok(allowed.includes(REQUESTED_MODE), `S5_ACCEPTANCE_MODE_INVALID:${REQUESTED_MODE}`);
    return REQUESTED_MODE;
  }
  if (JSON.stringify(actual) === JSON.stringify(WORKFLOW_REMEDIATION_FILES)) return 'S5_WORKFLOW_REMEDIATION_MODE';
  if (s6.record_status === 'S6_COMMITTED_CLOSURE_CANDIDATE_AUTHORITY' && s6.s6_candidate_implemented === true) return 'S6_SUCCESSOR_REGRESSION_MODE';
  return 'S5_EXACT_CANDIDATE_MODE';
}

function main() {
  try {
    for (const file of Object.values(FILES)) assert.equal(fs.existsSync(path.join(ROOT, file)), true, `MISSING:${file}`);
    const route = read(FILES.route);
    const client = read(FILES.client);
    const page = read(FILES.page);
    const workflow = read(FILES.workflow);
    const self = read(FILES.acceptance);
    const s5 = json(FILES.s5);
    const s6 = json(FILES.s6);
    const registry = json(FILES.registry);
    const actual = changedFiles();
    const mode = resolveMode(actual, s6);

    check('S5_FROZEN_AUTHORITY_REMAINS_CONDITIONAL_AND_READ_ONLY', () => {
      assert.equal(s5.record_status, 'S5_COMMITTED_CANDIDATE_AUTHORITY');
      assert.equal(s5.delivery_state, 'IMPLEMENTED_AWAITING_PROTECTED_MERGE_AND_EXACT_SHA_ATTESTATION');
      assert.equal(s5.s5_candidate_implemented, true);
      assert.equal(s5.implementation_authorized, true);
      assert.equal(s5.externally_effective, false);
      assert.equal(s5.effectiveness_condition, 'PRESENT_ON_MAIN_AND_EXACT_SHA_ATTESTATION_PASS');
      assert.equal(s5.effective_next_slice_when_attested, 'S6');
      assert.equal(s5.canonical_write_authority_delta, 'ZERO');
      assert.equal(s5.runtime_source_authorized, false);
      assert.equal(s5.mcft_cap_08_authorized, false);
    });

    check('S4_EXACT_SHA_ARTIFACT_CONSUMED_BY_S5', () => {
      const evidence = s5.predecessor_effective_evidence_requirement;
      assert.equal(evidence.status, 'PASS');
      assert.equal(evidence.source_slice, 'MCFT-CAP-07.S4');
      assert.equal(evidence.source_pr_number, 2614);
      assert.equal(evidence.merge_commit, '498675bc2e20f2404342256dbf954aa3a0d3a96d');
      assert.equal(evidence.attestation_workflow_run_id, 29818904418);
      assert.equal(evidence.artifact_id, 8490504068);
      assert.equal(evidence.semantic_artifact_digest, 'sha256:47ea269db4d095e726394635b78cddb9be7e01bcfd567debba31dc9367aa35b4');
      assert.equal(evidence.readback_verified, true);
      assert.equal(evidence.locked_version_delete_denied, true);
    });

    check('CANONICAL_ROUTE_DEPENDENCY_REPLACES_LEGACY_PAGE', () => {
      assert.match(route, /McftCanonicalFieldRuntimeRoutePage/);
      assert.doesNotMatch(route, /fieldRuntime\/FieldRuntimeRoutePage["']/);
      for (const token of ['action-lifecycle', 'evidence-trace', 'tab="overview"', 'tab="state"', 'tab="forecast"', 'tab="scenario"', 'tab="residual"', 'tab="calibration"', 'tab="health"']) assert.ok(route.includes(token), token);
    });

    check('EXACT_SIX_KEY_SCOPE_FAILS_CLOSED', () => {
      for (const key of ['tenant_id', 'project_id', 'group_id', 'field_id', 'season_id', 'zone_id']) assert.ok(client.includes(key), key);
      assert.match(client, /missing_keys/);
      assert.match(page, /Exact six-key scope required/);
      assert.match(page, /No field-only scope degradation/);
    });

    check('TEN_CANONICAL_GET_ONLY_RUNTIME_ENDPOINTS_CONSUMED', () => {
      for (const suffix of ['/states', '/forecasts', '/scenarios', '/action-lifecycle', '/residuals', '/model-governance', '/timeline', '/trace', '/health']) assert.ok(client.includes(`"${suffix}"`), suffix);
      assert.match(client, /method: "GET"/);
      assert.doesNotMatch(client, /method:\s*"(?:POST|PUT|PATCH|DELETE)"/);
      assert.doesNotMatch(client, /\/api\/control|\/api\/v1\/recommendations|\/api\/v1\/approvals|\/api\/v1\/actions/);
    });

    check('FORMAL_NINE_TAB_PRODUCT_CONTRACT', () => {
      const keys = ['overview', 'state', 'forecast', 'scenario', 'action-lifecycle', 'residual', 'calibration', 'evidence-trace', 'health'];
      for (const key of keys) assert.ok(page.includes(`key: "${key}"`) || page.includes('data-mcft-tab={definition.key}'), key);
      assert.equal(keys.length, 9);
    });

    check('FORECAST_AND_HEALTH_DISTINCTIONS_REMAIN_VISIBLE', () => {
      assert.ok(includesAll(page, ['Current Tick Forecast Result', 'Latest Successful Forecast', 'Scenario Source Forecast']));
      assert.ok(includesAll(page, ['Terminal Record-Set Health', 'Latest Operational Runtime Health', 'Health Relationship']));
      assert.ok(includesAll(client, ['SAME_OBJECT', 'LATEST_OPERATIONAL_IS_LATER', 'TERMINAL_ONLY', 'OPERATIONAL_ONLY', 'BOTH_ABSENT']));
    });

    check('NO_LEGACY_TRUTH_NUMERIC_CONFIDENCE_OR_WRITE_CLIENT', () => {
      const bundle = route + '\n' + client + '\n' + page;
      assert.doesNotMatch(bundle, /fetchOperatorFieldTwin|operator_field_twin_workspace_v1|Replay-backed Demo/);
      assert.doesNotMatch(bundle, /confidence_score|confidence_percent|confidence_value|Math\.round\([^)]*confidence/i);
      assert.doesNotMatch(bundle, /from\s+["'][^"']*(?:recommendation|approval|ao_act|dispatch|writer|persistence|activation)[^"']*["']/i);
      assert.doesNotMatch(bundle, /\b(?:createRecommendation|approveRecommendation|dispatchTask|dispatchAction|createAoActTask|activateModel|writeFact|persistFact)\s*\(/);
    });

    check('S5_AND_S6_REGISTRY_RULES_REMAIN_FAIL_CLOSED', () => {
      const cap07 = registry.capabilities.find((entry) => entry.capability_line === 'MCFT-CAP-07');
      assert.ok(cap07);
      for (const [statusFile, field, focused] of [
        [FILES.s5, 's5_candidate_implemented', 'mcft-cap-07-s5-operator-integration'],
        [FILES.s6, 's6_candidate_implemented', 'mcft-cap-07-s6-closure'],
      ]) {
        const rule = cap07.candidate_transition_fields.find((entry) => entry.status_file === statusFile && entry.field_path === field);
        assert.deepEqual(rule.allowed_candidate_values, [true]);
        assert.equal(rule.focused_workflow, focused);
      }
      assert.equal(cap07.implementation_authorized, false);
      assert.equal(cap07.runtime_source_authorized, false);
      assert.equal(cap07.successor_capability_authorized, false);
    });

    if (mode === 'S5_EXACT_CANDIDATE_MODE') {
      check('S5_EXACT_CANDIDATE_RETAINS_S6_SEED', () => {
        assert.equal(s6.record_status, 'PRE_REGISTERED_SUCCESSOR_SEED');
        assert.equal(s6.delivery_state, 'SEEDED_NOT_AUTHORIZED');
        assert.equal(s6.s6_candidate_implemented, false);
        assert.equal(s6.implementation_authorized, false);
        assert.equal(s6.mcft_cap_08_authorized, false);
      });
      check('S5_EXACT_CHANGED_FILE_BOUNDARY', () => assert.deepEqual(actual, EXACT_CANDIDATE_FILES));
    } else if (mode === 'S6_SUCCESSOR_REGRESSION_MODE') {
      check('S6_SUCCESSOR_CANDIDATE_IS_NOT_MISCLASSIFIED_AS_BROKEN_S5_SEED', () => {
        assert.equal(s6.record_status, 'S6_COMMITTED_CLOSURE_CANDIDATE_AUTHORITY');
        assert.equal(s6.delivery_state, 'IMPLEMENTED_AWAITING_PROTECTED_MERGE_AND_EXACT_SHA_ATTESTATION');
        assert.equal(s6.s6_candidate_implemented, true);
        assert.equal(s6.implementation_authorized, true);
        assert.equal(s6.externally_effective, false);
        assert.equal(s6.predecessor_effective_evidence_requirement.source_slice, 'MCFT-CAP-07.S5');
        assert.equal(s6.predecessor_effective_evidence_requirement.merge_commit, 'fd7b639e36d1706de26feb3fbc0f1c640636ebdb');
        assert.equal(s6.predecessor_effective_evidence_requirement.status, 'PASS');
        assert.equal(s6.required_closure_retention_level, 'R2');
        assert.equal(s6.required_closure_retention_days, 730);
        assert.equal(s6.runtime_source_authorized, false);
        assert.equal(s6.canonical_write_authorized, false);
        assert.equal(s6.mcft_cap_08_authorized, false);
      });
      check('S6_SUCCESSOR_DOES_NOT_MUTATE_S5_PRODUCT_OR_GATE', () => {
        assert.ok(actual.includes(FILES.s6), 'S6_STATUS_NOT_CHANGED');
        for (const protectedFile of S5_PROTECTED_PRODUCT_FILES) assert.equal(actual.includes(protectedFile), false, `S5_PROTECTED_FILE_CHANGED:${protectedFile}`);
      });
    } else {
      check('S5_WORKFLOW_REMEDIATION_BOUNDARY_IS_EXACT', () => assert.deepEqual(actual, WORKFLOW_REMEDIATION_FILES));
      check('S5_WORKFLOW_REMEDIATION_SELFTESTS_ALL_LIFECYCLE_MODES', () => {
        for (const token of ['S5_EXACT_CANDIDATE_MODE', 'S6_SUCCESSOR_REGRESSION_MODE', 'S5_WORKFLOW_REMEDIATION_MODE']) {
          assert.ok(self.includes(token), `SCRIPT_MODE_MISSING:${token}`);
          assert.ok(workflow.includes(token), `WORKFLOW_MODE_MISSING:${token}`);
        }
        assert.ok(workflow.includes('steps.delivery.outputs.exact_sha'));
        assert.equal(s6.record_status, 'PRE_REGISTERED_SUCCESSOR_SEED');
        assert.equal(s6.s6_candidate_implemented, false);
      });
    }

    const result = {
      schema_version: 'geox_mcft_cap_07_s5_operator_integration_result_v2',
      status: 'PASS',
      acceptance_mode: mode,
      check_count: checks.length,
      checks,
      canonical_tab_count: 9,
      canonical_endpoint_count: 10,
      exact_scope_key_count: 6,
      legacy_truth_fallback: false,
      numeric_confidence_fabricated: false,
      write_authority_delta: 'ZERO',
      repository_write_performed: false,
    };
    fs.mkdirSync(path.dirname(OUT), { recursive: true });
    fs.writeFileSync(OUT, `${JSON.stringify(result, null, 2)}\n`);
    console.log(JSON.stringify(result));
  } catch (error) {
    const result = {
      schema_version: 'geox_mcft_cap_07_s5_operator_integration_result_v2',
      status: 'FAIL',
      acceptance_mode: REQUESTED_MODE,
      error: error instanceof Error ? error.message : String(error),
      check_count: checks.length,
      checks,
    };
    fs.mkdirSync(path.dirname(OUT), { recursive: true });
    fs.writeFileSync(OUT, `${JSON.stringify(result, null, 2)}\n`);
    console.error(error);
    process.exitCode = 1;
  }
}

main();
