'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const ROOT = process.cwd();
const BASE = process.env.MCFT_BASE_SHA || '';
const EXPECTED_BASE = '02b43f1c19c48d20cd21c0c529e74a19b166b724';

const F = {
  workflow: '.github/workflows/mcft-cap-09-ea5b5a-external-cap04-state-source.yml',
  inputAuthority: 'apps/server/src/runtime/twin_runtime/external_formal_cap04_input_authority_v1.ts',
  stateSource: 'apps/server/src/runtime/twin_runtime/external_formal_cap04_state_source_builder_v1.ts',
  acceptance: 'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_09_EA5B5A_EXTERNAL_CAP04_STATE_SOURCE.ts',
  authority: 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA5B5A-EXTERNAL-CAP04-STATE-SOURCE-V1.json',
  governance: 'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_EA5B5A_EXTERNAL_CAP04_STATE_SOURCE.cjs',
  ea5b3: 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA5B3-EXTERNAL-RUNTIME-CONFIG-RESOLVER-V1.json',
  ea5b4a: 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA5B4A-EXTERNAL-OPERATOR-AUTHORITY-V1.json',
  ea5b4b: 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA5B4B-EXTERNAL-A0-PROVENANCE-PROFILE-V1.json',
  historicalStateSource: 'apps/server/src/runtime/twin_runtime/forecast_scenario_state_source_builder_v1.ts',
};

const EXPECTED_CHANGED = [
  F.workflow,
  F.inputAuthority,
  F.stateSource,
  F.acceptance,
  F.authority,
  F.governance,
].sort();

const EXPECTED_BLOBS = {
  inputAuthority: 'b4b7448518628bcffe8eaf6a91d9967145f7647d',
  stateSource: '0d9857ea883f55a64261b58b8e56dffa1d388028',
  acceptance: '84334dd120c7714105df1f25861fefbee98677fd',
  authority: '3f4713d52272eae3fce3b05f5ab21316b87b257f',
  ea5b3: 'bdaf311cc23c78fb45079af65fcd30a7b794fec3',
  ea5b4a: '3192e3159bffce5a23913dc7299355e1a1e322c4',
  ea5b4b: '503842ef473e7ccf6a6fe46a21a36e678766851b',
  historicalStateSource: '14a5dc714e1629d230eb9493ba42882571cd85b1',
};

function fail(code) {
  throw new Error(code);
}

function git(args) {
  return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim();
}

function blob(ref, file) {
  return git(['rev-parse', `${ref}:${file}`]);
}

function read(file) {
  return fs.readFileSync(path.join(ROOT, file), 'utf8');
}

function exactArray(actual, expected, code) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) fail(code);
}

function requireToken(text, token, code) {
  if (!text.includes(token)) fail(code);
}

function assertBlob(ref, file, expected, code) {
  if (blob(ref, file) !== expected) fail(code);
}

function main() {
  if (!BASE) fail('EA5B5A_BASE_SHA_REQUIRED');
  if (BASE !== EXPECTED_BASE) fail(`EA5B5A_BASE_SHA_MISMATCH:${BASE}`);

  const changed = git(['diff', '--name-only', `${BASE}...HEAD`])
    .split(/\r?\n/)
    .filter(Boolean)
    .sort();
  exactArray(changed, EXPECTED_CHANGED, `EA5B5A_EXACT_SIX_FILE_BOUNDARY_MISMATCH:${changed.join(',')}`);

  assertBlob(BASE, F.ea5b3, EXPECTED_BLOBS.ea5b3, 'EA5B5A_EA5B3_PREDECESSOR_BLOB_MISMATCH');
  assertBlob(BASE, F.ea5b4a, EXPECTED_BLOBS.ea5b4a, 'EA5B5A_EA5B4A_PREDECESSOR_BLOB_MISMATCH');
  assertBlob(BASE, F.ea5b4b, EXPECTED_BLOBS.ea5b4b, 'EA5B5A_EA5B4B_PREDECESSOR_BLOB_MISMATCH');
  assertBlob(BASE, F.historicalStateSource, EXPECTED_BLOBS.historicalStateSource, 'EA5B5A_HISTORICAL_STATE_SOURCE_BASE_BLOB_MISMATCH');
  assertBlob('HEAD', F.historicalStateSource, EXPECTED_BLOBS.historicalStateSource, 'EA5B5A_HISTORICAL_STATE_SOURCE_MUTATED');

  assertBlob('HEAD', F.inputAuthority, EXPECTED_BLOBS.inputAuthority, 'EA5B5A_INPUT_AUTHORITY_BLOB_MISMATCH');
  assertBlob('HEAD', F.stateSource, EXPECTED_BLOBS.stateSource, 'EA5B5A_STATE_SOURCE_BLOB_MISMATCH');
  assertBlob('HEAD', F.acceptance, EXPECTED_BLOBS.acceptance, 'EA5B5A_ACCEPTANCE_BLOB_MISMATCH');
  assertBlob('HEAD', F.authority, EXPECTED_BLOBS.authority, 'EA5B5A_AUTHORITY_BLOB_MISMATCH');

  const inputText = read(F.inputAuthority);
  const sourceText = read(F.stateSource);
  const acceptanceText = read(F.acceptance);
  const authority = JSON.parse(read(F.authority));

  for (const token of [
    'MCFT_CAP09_EXTERNAL_FORMAL_SOIL_BINDING_ID_V1',
    'MCFT_CAP09_EXTERNAL_FORMAL_RAINFALL_BINDING_ID_V1',
    'MCFT_CAP09_EXTERNAL_FORMAL_HISTORICAL_ET0_BINDING_ID_V1',
    'MCFT_CAP09_EXTERNAL_FORMAL_FUTURE_WEATHER_BINDING_ID_V1',
    'MCFT_CAP09_EXTERNAL_FORMAL_FUTURE_ET0_BINDING_ID_V1',
    'EXTERNAL_CAP04_COMMERCIAL_OPERATION_EVIDENCE_FORBIDDEN',
    'resolveContinuationCropStageContextV1',
  ]) requireToken(inputText, token, `EA5B5A_INPUT_AUTHORITY_TOKEN_MISSING:${token}`);

  for (const token of [
    'buildExternalFormalAssimilationAuthorityViewV1',
    'MCFT_CAP09_EXTERNAL_FORMAL_MODEL_PARAMETER_AUTHORITY_V1',
    'MCFT_CAP09_EXTERNAL_FORMAL_SOIL_BINDING_ID_V1',
    'recommendation_input_eligible: false',
    'action_input_eligible: false',
    'EXTERNAL_CAP04_SOURCE_GRAPH_REPLAY_LEAKAGE',
  ]) requireToken(sourceText, token, `EA5B5A_STATE_SOURCE_TOKEN_MISSING:${token}`);

  requireToken(acceptanceText, 'assert.equal(pass, 8)', 'EA5B5A_ACCEPTANCE_PASS_COUNT_TOKEN_MISSING');
  requireToken(acceptanceText, 'mass_balance_trace.mass_balance_error_mm', 'EA5B5A_MASS_BALANCE_PROOF_MISSING');
  requireToken(acceptanceText, 'computeMemberDeterminismHashV1', 'EA5B5A_CONTINUATION_MEMBER_HASH_PROOF_MISSING');
  requireToken(acceptanceText, 'CROP_STAGE_CONTEXT_HASH_MISMATCH', 'EA5B5A_CROP_DRIFT_NEGATIVE_CASE_MISSING');
  requireToken(acceptanceText, 'EXTERNAL_CAP04_COMMERCIAL_OPERATION_EVIDENCE_FORBIDDEN', 'EA5B5A_OPERATION_EVIDENCE_NEGATIVE_CASE_MISSING');

  if (authority.base_main_sha !== EXPECTED_BASE) fail('EA5B5A_AUTHORITY_BASE_MISMATCH');
  if (authority.implementation_blobs.external_cap04_input_authority_v1 !== EXPECTED_BLOBS.inputAuthority) fail('EA5B5A_AUTHORITY_INPUT_BLOB_MISMATCH');
  if (authority.implementation_blobs.external_cap04_state_source_builder_v1 !== EXPECTED_BLOBS.stateSource) fail('EA5B5A_AUTHORITY_SOURCE_BLOB_MISMATCH');
  if (authority.implementation_blobs.focused_acceptance !== EXPECTED_BLOBS.acceptance) fail('EA5B5A_AUTHORITY_ACCEPTANCE_BLOB_MISMATCH');
  if (authority.focused_qualification.expected_pass_count !== 8) fail('EA5B5A_AUTHORITY_PASS_COUNT_MISMATCH');

  const effect = authority.effect_boundary || {};
  if (effect.external_cap04_input_authority_qualified !== true) fail('EA5B5A_INPUT_QUALIFICATION_REQUIRED');
  if (effect.external_cap04_canonical_state_source_candidate_qualified !== true) fail('EA5B5A_STATE_SOURCE_QUALIFICATION_REQUIRED');
  if (effect.external_cap04_forecast_authority_qualified !== false) fail('EA5B5A_FORECAST_PREMATURE_EFFECT');
  if (effect.external_cap04_a1_a2_record_set_qualified !== false) fail('EA5B5A_A1A2_PREMATURE_EFFECT');
  if (effect.canonical_persistence_authorized !== false || effect.external_cap04_persistence_effective !== false) fail('EA5B5A_PERSISTENCE_PREMATURE_EFFECT');
  if (effect.ea5b_external_runtime_profile_complete !== false || effect.ea5c_authorized !== false) fail('EA5B5A_FRONTIER_PREMATURE_ADVANCE');
  if (effect.external_package_formal_eligible !== false || effect.formal_o00_start_authorized !== false) fail('EA5B5A_FORMAL_PREMATURE_EFFECT');
  if (effect.database_write_count !== 0 || effect.formal_evidence_write_count !== 0 || effect.public_provider_request_count !== 0) fail('EA5B5A_ZERO_WRITE_NONCLAIM_REQUIRED');
  if (effect.mcft_cap09_completed !== false) fail('EA5B5A_COMPLETION_NONCLAIM_REQUIRED');

  const output = {
    status: 'PASS',
    base_sha: BASE,
    changed_files: changed,
    exact_six_file_boundary: true,
    predecessor_ea5b3_pinned: true,
    predecessor_ea5b4a_pinned: true,
    predecessor_ea5b4b_pinned: true,
    historical_cap04_state_source_builder_unchanged: true,
    external_five_source_authority_qualified: true,
    external_crop_authority_qualified: true,
    external_cap04_state_source_candidate_qualified: true,
    external_100mm_operator_authority_preserved: true,
    canonical_persistence_authorized: false,
    external_forecast_authority_qualified: false,
    external_a1_a2_record_set_qualified: false,
    ea5b_complete: false,
    ea5c_authorized: false,
    formal_o00_start_authorized: false,
    database_write_count: 0,
    public_provider_request_count: 0,
  };

  fs.mkdirSync(path.join(ROOT, 'acceptance-output'), { recursive: true });
  fs.writeFileSync(
    path.join(ROOT, 'acceptance-output/MCFT_CAP_09_EA5B5A_EXTERNAL_CAP04_STATE_SOURCE_GOVERNANCE_RESULT.json'),
    JSON.stringify(output, null, 2) + '\n',
  );
  console.log(JSON.stringify(output));
}

main();
