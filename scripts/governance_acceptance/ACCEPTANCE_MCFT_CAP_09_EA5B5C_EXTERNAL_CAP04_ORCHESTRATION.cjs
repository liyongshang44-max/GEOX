'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const ROOT = process.cwd();
const BASE = process.env.MCFT_BASE_SHA || '';
const EXPECTED_BASE = '5b911ad78fa1c66622368cb01d154d14fc3f8377';
const F = {
  workflow: '.github/workflows/mcft-cap-09-ea5b5c-external-cap04-orchestration.yml',
  service: 'apps/server/src/runtime/twin_runtime/external_formal_cap04_candidate_execution_service_v1.ts',
  acceptance: 'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_09_EA5B5C_EXTERNAL_CAP04_ORCHESTRATION.ts',
  authority: 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA5B5C-EXTERNAL-CAP04-ORCHESTRATION-V1.json',
  governance: 'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_EA5B5C_EXTERNAL_CAP04_ORCHESTRATION.cjs',
  b5a: 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA5B5A-EXTERNAL-CAP04-STATE-SOURCE-V1.json',
  b5b: 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA5B5B-EXTERNAL-FORECAST-A1A2-V1.json',
};
const EXPECTED_CHANGED = [F.workflow, F.service, F.acceptance, F.authority, F.governance].sort();
const PINS = {
  service: 'f627c89d59092621dd7a4523f09b2ce4ec78433b',
  acceptance: 'b67245380973b542b24a08d3a461fffea25a9b1c',
  authority: '345f54fe5b79ca69c88f8c515ea8526db2d3bc99',
  b5a: '3f4713d52272eae3fce3b05f5ab21316b87b257f',
  b5b: '7568566297f3e917f297fd5cf30111c57e578977',
};
function fail(code) { throw new Error(code); }
function git(args) { return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim(); }
function blob(ref, file) { return git(['rev-parse', `${ref}:${file}`]); }
function read(file) { return fs.readFileSync(path.join(ROOT, file), 'utf8'); }
function requireToken(text, token, code) { if (!text.includes(token)) fail(code); }
function pin(ref, file, expected, code) { if (blob(ref, file) !== expected) fail(code); }

function main() {
  if (!BASE) fail('EA5B5C_BASE_SHA_REQUIRED');
  if (BASE !== EXPECTED_BASE) fail(`EA5B5C_BASE_SHA_MISMATCH:${BASE}`);
  const changed = git(['diff', '--name-only', `${BASE}...HEAD`]).split(/\r?\n/).filter(Boolean).sort();
  if (JSON.stringify(changed) !== JSON.stringify(EXPECTED_CHANGED)) fail(`EA5B5C_EXACT_FIVE_FILE_BOUNDARY_MISMATCH:${changed.join(',')}`);

  pin(BASE, F.b5a, PINS.b5a, 'EA5B5C_B5A_PREDECESSOR_BLOB_MISMATCH');
  pin(BASE, F.b5b, PINS.b5b, 'EA5B5C_B5B_PREDECESSOR_BLOB_MISMATCH');
  pin('HEAD', F.service, PINS.service, 'EA5B5C_SERVICE_BLOB_MISMATCH');
  pin('HEAD', F.acceptance, PINS.acceptance, 'EA5B5C_ACCEPTANCE_BLOB_MISMATCH');
  pin('HEAD', F.authority, PINS.authority, 'EA5B5C_AUTHORITY_BLOB_MISMATCH');

  const service = read(F.service);
  const acceptance = read(F.acceptance);
  const workflow = read(F.workflow);
  const authority = JSON.parse(read(F.authority));

  for (const token of [
    'validateExternalFormalCap04InputAuthorityV1',
    'buildExternalFormalCap04StateSourceMembersV1',
    'selectCap04FutureForcingOutcomeV1',
    'executeCap04Pure72hForecastMathV1',
    'buildExternalFormalCompletedForecastAuthorityV1',
    'buildExternalFormalBlockedForecastAuthorityV1',
    'buildExternalFormalCap04CompletedA1RecordSetV1',
    'buildExternalFormalCap04BlockedA2RecordSetV1',
    'canonical_persistence_authorized: false',
    'database_write_count: 0',
    'provider_request_count: 0',
    'scenario_write_count: 0',
    'recommendation_write_count: 0',
    'action_write_count: 0',
  ]) requireToken(service, token, `EA5B5C_SERVICE_TOKEN_MISSING:${token}`);

  requireToken(acceptance, 'assert.equal(pass, 8)', 'EA5B5C_PASS_COUNT_MISSING');
  requireToken(acceptance, 'MALFORMED_FORCING_RECORD:FORCING_AVAILABILITY_MISMATCH', 'EA5B5C_MALFORMED_FORCING_CASE_MISSING');
  requireToken(acceptance, 'EXTERNAL_CAP04_COMMERCIAL_OPERATION_EVIDENCE_FORBIDDEN', 'EA5B5C_OPERATION_EVIDENCE_CASE_MISSING');
  requireToken(acceptance, 'EXTERNAL_CAP04_SERVICE_REALITY_BINDING_MISMATCH', 'EA5B5C_REALITY_DRIFT_CASE_MISSING');
  requireToken(acceptance, 'CROP_STAGE_CONTEXT_HASH_MISMATCH', 'EA5B5C_CROP_DRIFT_CASE_MISSING');

  if (authority.base_main_sha !== EXPECTED_BASE) fail('EA5B5C_AUTHORITY_BASE_MISMATCH');
  if (authority.implementation_blobs.external_cap04_candidate_execution_service_v1 !== PINS.service) fail('EA5B5C_AUTHORITY_SERVICE_BLOB_MISMATCH');
  if (authority.implementation_blobs.focused_acceptance !== PINS.acceptance) fail('EA5B5C_AUTHORITY_ACCEPTANCE_BLOB_MISMATCH');
  if (authority.focused_qualification.expected_pass_count !== 8) fail('EA5B5C_AUTHORITY_PASS_COUNT_MISMATCH');
  const effect = authority.effect_boundary || {};
  if (effect.production_external_cap04_candidate_orchestration_qualified !== true) fail('EA5B5C_ORCHESTRATION_QUALIFICATION_REQUIRED');
  if (effect.canonical_persistence_authorized !== false || effect.provider_fetch_authorized !== false || effect.scheduler_authorized !== false) fail('EA5B5C_SIDE_EFFECT_BOUNDARY_REQUIRED');
  if (effect.ea5b_completion_audit_required !== true || effect.ea5b_complete !== false || effect.ea5c_authorized !== false) fail('EA5B5C_CLOSURE_BOUNDARY_REQUIRED');
  if (effect.formal_o00_start_authorized !== false || effect.formal_window_started !== false || effect.mcft_cap09_completed !== false) fail('EA5B5C_FORMAL_NONCLAIM_REQUIRED');
  if (effect.database_write_count !== 0 || effect.provider_request_count !== 0 || effect.scenario_write_count !== 0 || effect.recommendation_write_count !== 0 || effect.action_write_count !== 0) fail('EA5B5C_ZERO_SIDE_EFFECT_COUNTS_REQUIRED');

  for (const token of [
    'ACCEPTANCE_MCFT_CAP_09_EA5B5C_EXTERNAL_CAP04_ORCHESTRATION.cjs',
    'ACCEPTANCE_MCFT_CAP_08_S2_G3_BOUNDARY.cjs',
    'ACCEPTANCE_MCFT_CAP_09_EA5B5B_EXTERNAL_FORECAST_A1A2.ts',
    'ACCEPTANCE_MCFT_CAP_09_EA5B5A_EXTERNAL_CAP04_STATE_SOURCE.ts',
    'ACCEPTANCE_MCFT_CAP_04_SINGLE_TICK_INTEGRATION.ts',
    'ACCEPTANCE_MCFT_CAP_04_SINGLE_TICK_INTEGRATION_NEGATIVE.ts',
  ]) requireToken(workflow, token, `EA5B5C_WORKFLOW_PROOF_MISSING:${token}`);

  const result = {
    status: 'PASS',
    base_sha: BASE,
    changed_files: changed,
    exact_five_file_boundary: true,
    predecessor_b5a_pinned: true,
    predecessor_b5b_pinned: true,
    external_cap04_candidate_orchestration_qualified: true,
    selected_a1_path_qualified: true,
    blocked_a2_path_qualified: true,
    malformed_forcing_failed_path_qualified: true,
    canonical_persistence_authorized: false,
    provider_fetch_authorized: false,
    scheduler_authorized: false,
    ea5b_completion_audit_required: true,
    ea5b_complete: false,
    ea5c_authorized: false,
    formal_o00_start_authorized: false,
    database_write_count: 0,
    provider_request_count: 0,
  };
  fs.mkdirSync(path.join(ROOT, 'acceptance-output'), { recursive: true });
  fs.writeFileSync(path.join(ROOT, 'acceptance-output/MCFT_CAP_09_EA5B5C_EXTERNAL_CAP04_ORCHESTRATION_GOVERNANCE_RESULT.json'), JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify(result));
}
main();
