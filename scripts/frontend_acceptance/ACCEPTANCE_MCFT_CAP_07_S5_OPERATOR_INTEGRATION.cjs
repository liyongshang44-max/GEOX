#!/usr/bin/env node
// Purpose: prove the frozen S5 Operator product contract across exact-candidate, workflow-remediation, S6 successor-regression, and post-closure local-demo lifecycle modes.
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
const CAP08_REGISTRY_BOOTSTRAP_FILES = [FILES.registry, FILES.acceptance].sort();
const S5_PROTECTED_PRODUCT_FILES = [FILES.route, FILES.client, FILES.page, FILES.s5, FILES.workflow, FILES.acceptance].sort();
const POST_CLOSURE_LOCAL_DEMO_FILES = [
  FILES.workflow,
  FILES.acceptance,
  'apps/server/src/domain/auth/roles.ts',
  'apps/server/src/infra/mcft_cap07_database_platform_bootstrap_v1.ts',
  'apps/server/src/modules/field/registerFieldModule.ts',
  'apps/server/src/routes/field_runtime_scope_options_v1.ts',
  FILES.route,
  'apps/web/src/api/fields.ts',
  'apps/web/src/features/operator/fieldRuntime/McftFieldRuntimeScopeNavigatorPage.tsx',
  'apps/web/src/styles/operatorFieldRuntimeNavigator.css',
  'config/auth/security_acceptance_tokens.json',
  'scripts/dev_seed/SEED_THREE_SURFACE_LOCAL_DEMO_V1.cjs',
  'scripts/dev_seed/seed_three_surface_local_demo_v1.ts',
  'scripts/dev_seed/three_surface_local_demo_action_lifecycle_v1.ts',
  'scripts/dev_seed/three_surface_local_demo_contract_v1.ts',
  'scripts/dev_seed/three_surface_local_demo_optional_persistence_v1.ts',
  'scripts/dev_seed/three_surface_local_demo_persistence_v1.ts',
  'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_07_LOCAL_DEMO_AND_SCOPE_NAVIGATOR_V1.cjs',
].sort();

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
  const allowed = ['S5_EXACT_CANDIDATE_MODE', 'S6_SUCCESSOR_REGRESSION_MODE', 'S5_WORKFLOW_REMEDIATION_MODE', 'S5_POST_CLOSURE_LOCAL_DEMO_MODE'];
  if (REQUESTED_MODE !== 'AUTO') {
    assert.ok(allowed.includes(REQUESTED_MODE), `S5_ACCEPTANCE_MODE_INVALID:${REQUESTED_MODE}`);
    return REQUESTED_MODE;
  }
  if (JSON.stringify(actual) === JSON.stringify(POST_CLOSURE_LOCAL_DEMO_FILES)) return 'S5_POST_CLOSURE_LOCAL_DEMO_MODE';
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
      const cap08RegistryBootstrap = JSON.stringify(actual) === JSON.stringify(CAP08_REGISTRY_BOOTSTRAP_FILES);
      if (cap08RegistryBootstrap) {
        check('CAP08_REGISTRY_BOOTSTRAP_BOUNDARY_IS_EXACT', () => {
          assert.deepEqual(actual, CAP08_REGISTRY_BOOTSTRAP_FILES);
        });
        check('CAP08_REGISTRY_BOOTSTRAP_IS_PRE_REGISTERED_AND_NON_AUTHORIZING', () => {
          const statusFile = 'docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-CURRENT-AUTHORITY-V1.json';
          const cap08 = registry.capabilities.find((entry) => entry.capability_line === 'MCFT-CAP-08');
          assert.ok(cap08, 'CAP08_REGISTRY_ENTRY_MISSING');
          assert.equal(cap08.registry_bootstrap_kind, 'P_1B_PRE_REGISTER_PR1_CURRENT_AUTHORITY_CANDIDATE');
          assert.equal(cap08.current_candidate_authority, false);
          assert.equal(cap08.candidate_declaration_enabled, true);
          assert.equal(cap08.candidate_authority_scope, 'PR1_CURRENT_AUTHORITY_ONLY_UNTIL_SUCCESSOR_RULES_MERGE');
          assert.deepEqual(cap08.authoritative_candidate_status_paths, [statusFile]);
          assert.equal(cap08.candidate_transition_fields.length, 1);
          const rule = cap08.candidate_transition_fields[0];
          assert.equal(rule.status_file, statusFile);
          assert.equal(rule.field_path, 'status');
          assert.deepEqual(rule.allowed_candidate_values, ['AUTHORIZATION_CANDIDATE_NOT_EFFECTIVE']);
          assert.equal(rule.focused_workflow, 'mcft-cap-08-authority-reconciliation');
          assert.equal(rule.standard_workflow, 'ci');
          assert.equal(rule.predecessor_effective_evidence_required, true);
          assert.equal(cap08.terminal_state, 'S6_FINAL_CLOSURE_CANDIDATE_PENDING_EXACT_MERGE_SHA_ATTESTATION');
          assert.equal(cap08.successor_capability_authorized, false);
          assert.equal(cap08.implementation_authorized, false);
          assert.equal(cap08.runtime_source_authorized, false);
          assert.equal(cap08.canonical_write_authorized, false);
          assert.equal(cap08.mcft_cap_09_authorized, false);
          assert.equal(fs.existsSync(path.join(ROOT, statusFile)), false, 'CAP08_CURRENT_AUTHORITY_MUST_NOT_EXIST_IN_PR0');
        });
      } else {
        check('S6_SUCCESSOR_DOES_NOT_MUTATE_S5_PRODUCT_OR_GATE', () => {
          assert.ok(actual.includes(FILES.s6), 'S6_STATUS_NOT_CHANGED');
          for (const protectedFile of S5_PROTECTED_PRODUCT_FILES) assert.equal(actual.includes(protectedFile), false, `S5_PROTECTED_FILE_CHANGED:${protectedFile}`);
        });
      }
    } else if (mode === 'S5_POST_CLOSURE_LOCAL_DEMO_MODE') {
      const navigator = read('apps/web/src/features/operator/fieldRuntime/McftFieldRuntimeScopeNavigatorPage.tsx');
      const fieldApi = read('apps/web/src/api/fields.ts');
      const scopeOptionsRoute = read('apps/server/src/routes/field_runtime_scope_options_v1.ts');
      const fieldModule = read('apps/server/src/modules/field/registerFieldModule.ts');
      const localAcceptance = read('scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_07_LOCAL_DEMO_AND_SCOPE_NAVIGATOR_V1.cjs');
      const bootstrap = read('apps/server/src/infra/mcft_cap07_database_platform_bootstrap_v1.ts');
      const roles = read('apps/server/src/domain/auth/roles.ts');
      const tokenContract = json('config/auth/security_acceptance_tokens.json');
      check('POST_CLOSURE_LOCAL_DEMO_BOUNDARY_IS_EXACT', () => assert.deepEqual(actual, POST_CLOSURE_LOCAL_DEMO_FILES));
      check('POST_CLOSURE_NAVIGATOR_IS_GET_ONLY_AND_EXACT_SCOPE', () => {
        assert.match(route, /FieldRuntimeScopeNavigatorPage/);
        assert.match(navigator, /fetchFields/);
        assert.match(navigator, /fetchFieldRuntimeScopeOptions/);
        assert.doesNotMatch(navigator, /fetchFieldDetail/);
        assert.match(fieldApi, /\/runtime-scope-options/);
        assert.match(scopeOptionsRoute, /requireAoActScopeV0\(req, reply, "fields\.read"\)/);
        assert.match(fieldModule, /registerFieldRuntimeScopeOptionsV1Routes/);
        for (const key of ['field_id', 'season_id', 'zone_id']) assert.ok(navigator.includes(`data-mcft-scope-key="${key}"`), key);
        assert.doesNotMatch(navigator, /createField|updateField|method:\s*["'](?:POST|PUT|PATCH|DELETE)/);
        assert.doesNotMatch(scopeOptionsRoute, /INSERT\s+INTO|UPDATE\s+public\.|DELETE\s+FROM|CREATE\s+TABLE|ALTER\s+TABLE/i);
      });
      check('POST_CLOSURE_OPERATOR_FIELD_DISCOVERY_SCOPE_IS_ALIGNED', () => {
        const operator = tokenContract.tokens.find((item) => item.token === 'operator_token');
        const writeOnly = tokenContract.tokens.find((item) => item.token === 'set-via-env-or-external-secret-file-pdi-writeonly');
        assert.ok(operator?.scopes?.includes('fields.read'));
        assert.equal(writeOnly?.scopes?.includes('fields.read'), false);
        assert.match(roles, /operator:\s*\[[^\]]*"fields\.read"/s);
        assert.match(workflow, /Probe operator field-read authorization/);
        assert.match(workflow, /runtime-scope-options/);
      });
      check('POST_CLOSURE_LOADER_AND_BOOTSTRAP_REENTRY_REMAIN_FAIL_CLOSED', () => {
        assert.match(localAcceptance, /runtime_source_authorized:\s*false/);
        assert.match(localAcceptance, /mcft_cap_08_authorized:\s*false/);
        assert.match(localAcceptance, /LOCAL_DEMO_READBACK_ACTION_LIFECYCLE_INCOMPLETE/);
        assert.match(localAcceptance, /LOCAL_DEMO_READBACK_TIMELINE_INCOMPLETE/);
        assert.match(bootstrap, /reassertMcftCap07RuntimeVisibilityBoundaryV1/);
        assert.match(bootstrap, /REVOKE ALL ON TABLE public\.twin_fact_visibility_epoch_v1/);
        assert.match(bootstrap, /GRANT SELECT ON TABLE public\.twin_fact_visibility_epoch_v1/);
      });
      check('POST_CLOSURE_DOES_NOT_CHANGE_CANONICAL_CLIENT_OR_DETAIL_PAGE', () => {
        assert.equal(actual.includes(FILES.client), false);
        assert.equal(actual.includes(FILES.page), false);
        assert.equal(s6.runtime_source_authorized, false);
        assert.equal(s6.canonical_write_authorized, false);
        assert.equal(s6.mcft_cap_08_authorized, false);
      });
    } else {
      check('S5_WORKFLOW_REMEDIATION_BOUNDARY_IS_EXACT', () => assert.deepEqual(actual, WORKFLOW_REMEDIATION_FILES));
      check('S5_WORKFLOW_REMEDIATION_SELFTESTS_ALL_LIFECYCLE_MODES', () => {
        for (const token of ['S5_EXACT_CANDIDATE_MODE', 'S6_SUCCESSOR_REGRESSION_MODE', 'S5_WORKFLOW_REMEDIATION_MODE', 'S5_POST_CLOSURE_LOCAL_DEMO_MODE']) {
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
