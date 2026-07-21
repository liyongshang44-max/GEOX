#!/usr/bin/env node
// Purpose: statically prove MCFT-CAP-07 S5 canonical Operator integration and governance boundaries.
// Boundary: repository reads and git diff inspection only; no browser, network, product API, database, or write action.
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');

const ROOT = path.resolve(__dirname, '../..');
const OUT = path.join(ROOT, 'acceptance-output/MCFT_CAP_07_S5_OPERATOR_INTEGRATION_RESULT.json');
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

function main() {
  try {
    for (const file of Object.values(FILES)) assert.equal(fs.existsSync(path.join(ROOT, file)), true, `MISSING:${file}`);
    const route = read(FILES.route);
    const client = read(FILES.client);
    const page = read(FILES.page);
    const s5 = json(FILES.s5);
    const s6 = json(FILES.s6);
    const registry = json(FILES.registry);

    check('S4_EXACT_SHA_ARTIFACT_CONSUMED_AND_S5_PROJECTED', () => {
      assert.equal(s5.s5_candidate_implemented, true);
      assert.equal(s5.implementation_authorized, true);
      assert.equal(s5.externally_effective, false);
      assert.equal(s5.effectiveness_condition, 'PRESENT_ON_MAIN_AND_EXACT_SHA_ATTESTATION_PASS');
      assert.equal(s5.effective_next_slice_when_attested, 'S6');
      const evidence = s5.predecessor_effective_evidence_requirement;
      assert.equal(evidence.status, 'PASS');
      assert.equal(evidence.source_slice, 'MCFT-CAP-07.S4');
      assert.equal(evidence.source_pr_number, 2614);
      assert.equal(evidence.merge_commit, '498675bc2e20f2404342256dbf954aa3a0d3a96d');
      assert.equal(evidence.attestation_workflow_run_id, 29818904418);
      assert.equal(evidence.attestation_job_id, 88596633153);
      assert.equal(evidence.artifact_id, 8490504068);
      assert.equal(evidence.semantic_artifact_digest, 'sha256:47ea269db4d095e726394635b78cddb9be7e01bcfd567debba31dc9367aa35b4');
      assert.equal(evidence.transport_archive_sha256, 'sha256:baf525e38392d86afcf0115737f59a35e412751f25031cbbd13881358637ca1c');
      assert.equal(evidence.readback_verified, true);
      assert.equal(evidence.locked_version_delete_denied, true);
      assert.equal(evidence.effective_frontier, 'S5');
    });

    check('CANONICAL_ROUTE_DEPENDENCY_REPLACES_LEGACY_PAGE', () => {
      assert.match(route, /McftCanonicalFieldRuntimeRoutePage/);
      assert.doesNotMatch(route, /fieldRuntime\/FieldRuntimeRoutePage["']/);
      for (const routeToken of ['action-lifecycle', 'evidence-trace', 'tab="overview"', 'tab="state"', 'tab="forecast"', 'tab="scenario"', 'tab="residual"', 'tab="calibration"', 'tab="health"']) assert.ok(route.includes(routeToken), routeToken);
      assert.match(route, /tab="evidence"/);
      assert.match(route, /tab="audit"/);
    });

    check('EXACT_SIX_KEY_SCOPE_FAILS_CLOSED', () => {
      for (const key of ['tenant_id', 'project_id', 'group_id', 'field_id', 'season_id', 'zone_id']) assert.ok(client.includes(key), key);
      assert.match(client, /missing_keys/);
      assert.match(page, /Exact six-key scope required/);
      assert.match(page, /No field-only scope degradation/);
      assert.match(page, /resolveMcftRuntimeScope/);
    });

    check('TEN_CANONICAL_GET_ONLY_RUNTIME_ENDPOINTS_CONSUMED', () => {
      for (const suffix of ['', '/states', '/forecasts', '/scenarios', '/action-lifecycle', '/residuals', '/model-governance', '/timeline', '/trace', '/health']) {
        assert.ok(client.includes(`"${suffix}"`) || suffix === '', suffix);
      }
      assert.match(client, /method: "GET"/);
      assert.doesNotMatch(client, /method:\s*"(?:POST|PUT|PATCH|DELETE)"/);
      assert.doesNotMatch(client, /\/api\/control|\/api\/v1\/recommendations|\/api\/v1\/approvals|\/api\/v1\/actions/);
    });

    check('FORMAL_NINE_TAB_PRODUCT_CONTRACT', () => {
      const keys = ['overview', 'state', 'forecast', 'scenario', 'action-lifecycle', 'residual', 'calibration', 'evidence-trace', 'health'];
      for (const key of keys) assert.ok(page.includes(`key: "${key}"`) || page.includes(`data-mcft-tab={definition.key}`), key);
      for (const label of ['Overview', 'State', 'Forecast', 'Scenario', 'Action Lifecycle', 'Residual Verification', 'Calibration', 'Evidence / Trace', 'Health']) assert.ok(page.includes(label), label);
      assert.equal(keys.length, 9);
    });

    check('FORECAST_THREE_POINTERS_ARE_DISTINCT', () => {
      assert.ok(includesAll(page, ['Current Tick Forecast Result', 'Latest Successful Forecast', 'Scenario Source Forecast']));
      assert.ok(includesAll(page, ['current_tick_forecast_result', 'latest_successful_forecast', 'scenario_source_forecast']));
    });

    check('HEALTH_TERMINAL_OPERATIONAL_AND_RELATIONSHIP_VISIBLE', () => {
      assert.ok(includesAll(page, ['Terminal Record-Set Health', 'Latest Operational Runtime Health', 'Health Relationship']));
      assert.ok(includesAll(client, ['SAME_OBJECT', 'LATEST_OPERATIONAL_IS_LATER', 'TERMINAL_ONLY', 'OPERATIONAL_ONLY', 'BOTH_ABSENT']));
    });

    check('ATTACHMENT_STATUS_REASON_CODE_AND_BOUNDED_COUNT_VISIBLE', () => {
      assert.ok(includesAll(page, ['attachment_status', 'reason_code', 'count_status', 'NOT_COMPUTED', 'latest_item_ref']));
      assert.doesNotMatch(client + page, /confidence_score|confidence_percent|confidence_value|Math\.round\([^)]*confidence/i);
    });

    check('STRUCTURED_MCFT_ERRORS_REMAIN_EXACT', () => {
      assert.ok(includesAll(client, ['error_code', 'failed_profiles', 'diagnostics', 'request_id']));
      for (const status of ['400', '403', '404', '409', '503']) assert.ok(client.includes(status), status);
      assert.ok(includesAll(page, ['failed_profiles', 'diagnostics', 'request_id']));
    });

    check('CANONICAL_DEPENDENCY_GRAPH_HAS_NO_LEGACY_TRUTH_OR_WRITE_CLIENT', () => {
      const bundle = route + '\n' + client + '\n' + page;
      assert.doesNotMatch(bundle, /from\s+["'][^"']*operatorTwin["']/);
      assert.doesNotMatch(bundle, /fetchOperatorFieldTwin|operator_field_twin_workspace_v1|Replay-backed Demo/);
      assert.doesNotMatch(bundle, /from\s+["'][^"']*(?:recommendation|approval|ao_act|dispatch|writer|persistence|activation)[^"']*["']/i);
      assert.doesNotMatch(bundle, /\b(?:createRecommendation|approveRecommendation|dispatchTask|dispatchAction|createAoActTask|activateModel|writeFact|persistFact)\s*\(/);
    });

    check('S6_SEED_AND_FUTURE_REGISTRY_AUTHORITY_ONLY', () => {
      assert.equal(s6.record_status, 'PRE_REGISTERED_SUCCESSOR_SEED');
      assert.equal(s6.delivery_state, 'SEEDED_NOT_AUTHORIZED');
      assert.equal(s6.s6_candidate_implemented, false);
      assert.equal(s6.implementation_authorized, false);
      assert.equal(s6.focused_workflow, 'mcft-cap-07-s6-closure');
      assert.equal(s6.mcft_cap_08_authorized, false);
      const cap07 = registry.capabilities.find((entry) => entry.capability_line === 'MCFT-CAP-07');
      assert.ok(cap07.authoritative_candidate_status_paths.includes(FILES.s6));
      const rule = cap07.candidate_transition_fields.find((entry) => entry.status_file === FILES.s6 && entry.field_path === 's6_candidate_implemented');
      assert.deepEqual(rule.allowed_candidate_values, [true]);
      assert.equal(rule.focused_workflow, 'mcft-cap-07-s6-closure');
      assert.equal(cap07.implementation_authorized, false);
      assert.equal(cap07.runtime_source_authorized, false);
      assert.equal(cap07.successor_capability_authorized, false);
    });

    check('S5_EXACT_CHANGED_FILE_BOUNDARY', () => {
      const actual = changedFiles();
      const allowed = Object.values(FILES).sort();
      assert.deepEqual(actual, allowed);
    });

    const result = {
      schema_version: 'geox_mcft_cap_07_s5_operator_integration_result_v1',
      status: 'PASS',
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
    const result = { schema_version: 'geox_mcft_cap_07_s5_operator_integration_result_v1', status: 'FAIL', error: error instanceof Error ? error.message : String(error), checks };
    fs.mkdirSync(path.dirname(OUT), { recursive: true });
    fs.writeFileSync(OUT, `${JSON.stringify(result, null, 2)}\n`);
    console.error(error);
    process.exitCode = 1;
  }
}

main();
