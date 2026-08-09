'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const ROOT = process.cwd();
const BASE = process.env.MCFT_BASE_SHA || '';
const EXPECTED_BASE = 'f4c27c69b91f55494a390e247ceffe437795ee69';
const F = {
  workflow: '.github/workflows/mcft-cap-09-ea5b5b-external-forecast-a1a2.yml',
  forecastAuthority: 'apps/server/src/domain/twin_runtime/external_formal_cap04_forecast_authority_v1.ts',
  aBuilder: 'apps/server/src/runtime/twin_runtime/external_formal_cap04_a_record_set_builder_v1.ts',
  fixture: 'scripts/runtime_acceptance/mcft_cap09_ea5b5b_external_fixture_v1.ts',
  acceptance: 'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_09_EA5B5B_EXTERNAL_FORECAST_A1A2.ts',
  authority: 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA5B5B-EXTERNAL-FORECAST-A1A2-V1.json',
  governance: 'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_EA5B5B_EXTERNAL_FORECAST_A1A2.cjs',
  predecessor: 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA5B5A-EXTERNAL-CAP04-STATE-SOURCE-V1.json',
  historicalBuilder: 'apps/server/src/runtime/twin_runtime/forecast_continuation_record_set_builder_v1.ts',
  pureForecastMath: 'apps/server/src/domain/twin_runtime/pure_72h_forecast_math_v1.ts',
};
const EXPECTED_CHANGED = [F.workflow, F.forecastAuthority, F.aBuilder, F.fixture, F.acceptance, F.authority, F.governance].sort();
const EXPECTED_BLOBS = {
  forecastAuthority: 'cb334a55f7649a95de75a26ef30e4a5ee06fd53c',
  aBuilder: '436a74fe1395eb5123807c148b3b6229b120cf61',
  fixture: 'ab47b2412e003921d1a94fa82017d405006e59f1',
  acceptance: '3e1c4b5966524c33a144033510d97e200d6202ad',
  authority: '7568566297f3e917f297fd5cf30111c57e578977',
  predecessor: '3f4713d52272eae3fce3b05f5ab21316b87b257f',
  historicalBuilder: 'e6807beaa680002e3498263950ac13e6025023dc',
  pureForecastMath: '45033d19fe05af54cca6eb3c358535d22f0640bd',
};

function fail(code) { throw new Error(code); }
function git(args) { return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim(); }
function blob(ref, file) { return git(['rev-parse', `${ref}:${file}`]); }
function read(file) { return fs.readFileSync(path.join(ROOT, file), 'utf8'); }
function assertBlob(ref, file, expected, code) { if (blob(ref, file) !== expected) fail(code); }
function requireToken(text, token, code) { if (!text.includes(token)) fail(code); }

function main() {
  if (!BASE) fail('EA5B5B_BASE_SHA_REQUIRED');
  if (BASE !== EXPECTED_BASE) fail(`EA5B5B_BASE_SHA_MISMATCH:${BASE}`);
  const changed = git(['diff', '--name-only', `${BASE}...HEAD`]).split(/\r?\n/).filter(Boolean).sort();
  if (JSON.stringify(changed) !== JSON.stringify(EXPECTED_CHANGED)) fail(`EA5B5B_EXACT_SEVEN_FILE_BOUNDARY_MISMATCH:${changed.join(',')}`);

  assertBlob(BASE, F.predecessor, EXPECTED_BLOBS.predecessor, 'EA5B5B_PREDECESSOR_BLOB_MISMATCH');
  assertBlob(BASE, F.historicalBuilder, EXPECTED_BLOBS.historicalBuilder, 'EA5B5B_HISTORICAL_BUILDER_BASE_BLOB_MISMATCH');
  assertBlob('HEAD', F.historicalBuilder, EXPECTED_BLOBS.historicalBuilder, 'EA5B5B_HISTORICAL_BUILDER_MUTATED');
  assertBlob(BASE, F.pureForecastMath, EXPECTED_BLOBS.pureForecastMath, 'EA5B5B_PURE_FORECAST_MATH_BASE_BLOB_MISMATCH');
  assertBlob('HEAD', F.pureForecastMath, EXPECTED_BLOBS.pureForecastMath, 'EA5B5B_PURE_FORECAST_MATH_MUTATED');
  assertBlob('HEAD', F.forecastAuthority, EXPECTED_BLOBS.forecastAuthority, 'EA5B5B_FORECAST_AUTHORITY_BLOB_MISMATCH');
  assertBlob('HEAD', F.aBuilder, EXPECTED_BLOBS.aBuilder, 'EA5B5B_A_BUILDER_BLOB_MISMATCH');
  assertBlob('HEAD', F.fixture, EXPECTED_BLOBS.fixture, 'EA5B5B_FIXTURE_BLOB_MISMATCH');
  assertBlob('HEAD', F.acceptance, EXPECTED_BLOBS.acceptance, 'EA5B5B_ACCEPTANCE_BLOB_MISMATCH');
  assertBlob('HEAD', F.authority, EXPECTED_BLOBS.authority, 'EA5B5B_AUTHORITY_BLOB_MISMATCH');

  const forecastText = read(F.forecastAuthority);
  const builderText = read(F.aBuilder);
  const acceptanceText = read(F.acceptance);
  const authority = JSON.parse(read(F.authority));

  for (const token of [
    'buildExternalFormalCompletedForecastAuthorityV1',
    'buildExternalFormalBlockedForecastAuthorityV1',
    'EXTERNAL_CAP04_FORECAST_NUMERICAL_IDENTITY_MISMATCH',
    'EXTERNAL_CROP_AUTHORITY_REBOUND_BEFORE_CANONICALIZATION',
    'canonical_persistence_authorized: false',
  ]) requireToken(forecastText, token, `EA5B5B_FORECAST_TOKEN_MISSING:${token}`);

  for (const token of [
    'buildExternalFormalCap04CompletedA1RecordSetV1',
    'buildExternalFormalCap04BlockedA2RecordSetV1',
    'MCFT_CAP09_EXTERNAL_FORMAL_RUNTIME_MODE_V1',
    'MCFT_CAP09_EXTERNAL_FORMAL_MODEL_PARAMETER_AUTHORITY_V1',
    'validateCap04ARecordSetV1',
    'SCENARIO_SET_NOT_CREATED_BY_EA5B5B',
    'canonical_persistence_authorized: false',
  ]) requireToken(builderText, token, `EA5B5B_BUILDER_TOKEN_MISSING:${token}`);

  requireToken(acceptanceText, 'assert.equal(pass, 8)', 'EA5B5B_ACCEPTANCE_PASS_COUNT_MISSING');
  requireToken(acceptanceText, 'points.length, 72', 'EA5B5B_72H_PROOF_MISSING');
  requireToken(acceptanceText, 'terminal_tick_uniqueness_key_hash', 'EA5B5B_TERMINAL_UNIQUENESS_PROOF_MISSING');
  requireToken(acceptanceText, 'EXTERNAL_CAP04_A_FORECAST_REPLAY_LEAKAGE', 'EA5B5B_REPLAY_NEGATIVE_CASE_MISSING');

  if (authority.base_main_sha !== EXPECTED_BASE) fail('EA5B5B_AUTHORITY_BASE_MISMATCH');
  if (authority.implementation_blobs.external_forecast_authority_v1 !== EXPECTED_BLOBS.forecastAuthority) fail('EA5B5B_AUTHORITY_FORECAST_BLOB_MISMATCH');
  if (authority.implementation_blobs.external_a_record_set_builder_v1 !== EXPECTED_BLOBS.aBuilder) fail('EA5B5B_AUTHORITY_BUILDER_BLOB_MISMATCH');
  if (authority.implementation_blobs.qualification_fixture !== EXPECTED_BLOBS.fixture) fail('EA5B5B_AUTHORITY_FIXTURE_BLOB_MISMATCH');
  if (authority.implementation_blobs.focused_acceptance !== EXPECTED_BLOBS.acceptance) fail('EA5B5B_AUTHORITY_ACCEPTANCE_BLOB_MISMATCH');
  if (authority.focused_qualification.expected_pass_count !== 8) fail('EA5B5B_AUTHORITY_PASS_COUNT_MISMATCH');

  const effect = authority.effect_boundary || {};
  if (effect.external_cap04_forecast_authority_qualified !== true || effect.external_cap04_a1_a2_record_set_qualified !== true) fail('EA5B5B_QUALIFICATION_EFFECT_REQUIRED');
  if (effect.canonical_persistence_authorized !== false || effect.external_cap04_persistence_effective !== false) fail('EA5B5B_PERSISTENCE_PREMATURE_EFFECT');
  if (effect.ea5b_completion_audit_required !== true || effect.ea5b_external_runtime_profile_complete !== false) fail('EA5B5B_CLOSURE_AUDIT_REQUIRED');
  if (effect.ea5c_authorized !== false || effect.ea5d_authorized !== false || effect.ea5e_authorized !== false) fail('EA5B5B_PREMATURE_FRONTIER_ADVANCE');
  if (effect.external_package_formal_eligible !== false || effect.formal_o00_start_authorized !== false || effect.formal_window_started !== false) fail('EA5B5B_PREMATURE_FORMAL_EFFECT');
  for (const key of ['database_write_count','formal_evidence_write_count','public_provider_request_count','scenario_write_count','recommendation_write_count','action_write_count']) {
    if (effect[key] !== 0) fail(`EA5B5B_ZERO_WRITE_NONCLAIM_REQUIRED:${key}`);
  }
  if (effect.mcft_cap09_completed !== false) fail('EA5B5B_COMPLETION_NONCLAIM_REQUIRED');

  const output = {
    status: 'PASS',
    base_sha: BASE,
    exact_seven_file_boundary: true,
    predecessor_ea5b5a_pinned: true,
    historical_builder_unchanged: true,
    pure_forecast_math_unchanged: true,
    external_forecast_authority_qualified: true,
    external_a1_a2_record_set_qualified: true,
    completed_forecast_numeric_identity_preserved: true,
    external_tick_checkpoint_health_authority: true,
    canonical_persistence_authorized: false,
    ea5b_completion_audit_required: true,
    ea5b_complete: false,
    ea5c_authorized: false,
    formal_o00_start_authorized: false,
    database_write_count: 0,
    provider_request_count: 0,
  };
  fs.mkdirSync(path.join(ROOT, 'acceptance-output'), { recursive: true });
  fs.writeFileSync(path.join(ROOT, 'acceptance-output/MCFT_CAP_09_EA5B5B_EXTERNAL_FORECAST_A1A2_GOVERNANCE_RESULT.json'), JSON.stringify(output, null, 2) + '\n');
  console.log(JSON.stringify(output));
}

main();
