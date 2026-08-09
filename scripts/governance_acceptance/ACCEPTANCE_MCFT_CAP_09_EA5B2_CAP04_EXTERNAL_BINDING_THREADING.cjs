'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const ROOT = process.cwd();
const BASE = process.env.MCFT_BASE_SHA || '';
const EXPECTED_BASE = '9ceea4f44abac4160dfe2cfcb0af65d5d71ef215';
const F = {
  task: 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-TASK.md',
  amendment05: 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-AMENDMENT-05-EXTERNAL-FORMAL-RUNTIME-AUTHORITY-PROFILE.md',
  ea5b1: 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA5B1-EXTERNAL-EVIDENCE-BINDING-SEAM-V1.json',
  profile: 'apps/server/src/domain/twin_runtime/external_formal_evidence_binding_profile_v1.ts',
  selector: 'apps/server/src/runtime/twin_runtime/assimilated_continuation_observation_selector_v2.ts',
  window: 'apps/server/src/runtime/twin_runtime/assimilated_continuation_evidence_window_v2.ts',
  historicalA0: 'apps/server/src/runtime/twin_runtime/a0_bootstrap_runtime_service_v1.ts',
  service: 'apps/server/src/runtime/twin_runtime/forecast_scenario_single_tick_service_v1.ts',
  acceptance: 'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_09_EA5B2_CAP04_EXTERNAL_BINDING_THREADING.ts',
  authority: 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA5B2-CAP04-EXTERNAL-BINDING-THREADING-V1.json',
  gate: 'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_EA5B2_CAP04_EXTERNAL_BINDING_THREADING.cjs',
  workflow: '.github/workflows/mcft-cap-09-ea5b2-cap04-external-binding-threading.yml',
};
const PINS = {
  task: '39f6a09273c30088a7ea264cfa94ff930ea5518e',
  amendment05: '7a92c17f7ba32aae52667de9c21db62bfd2ba70b',
  ea5b1: '94b8e891bb077753ef77fc7c55fc5c78f1c328e2',
  profile: '5fe20f988d2cd6ef038f54eec27e5a32ba6a396d',
  selector: 'c4ecf12c9830a82b4b5f5c001e51a483fc7ad2e0',
  window: '0a7c02aae1e5ddbccadc303ae7977e4369dddcba',
  historicalA0: '7d2db571b421f1cbfe7fd1192398297def5307c2',
  historicalService: '53ba9f0b3b8f054985d51613f359ad9eb154b089',
  service: '5ca0fdbafe3cb244db92540e0cce4302506a965c',
  acceptance: 'a3ce22de4a8f5ebacb296f4e6878f1f27f595a56',
  authority: '09963e6bc3a64fc16d54c5f27a2a00228e4b5e24',
};
const EXPECT = [F.service, F.acceptance, F.authority, F.gate, F.workflow].sort();
const OUT = path.join(ROOT, 'acceptance-output/MCFT_CAP_09_EA5B2_CAP04_EXTERNAL_BINDING_THREADING_GOVERNANCE_RESULT.json');
const git = (...args) => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim();
const blob = (ref, file) => git('rev-parse', `${ref}:${file}`);
const read = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8');
const json = (file) => JSON.parse(read(file));
const req = (ok, code) => { if (!ok) throw new Error(code); };
const result = {
  schema_version: 'geox_mcft_cap09_ea5b2_cap04_external_binding_threading_governance_v1',
  status: 'FAIL',
  base_sha: BASE,
  exact_file_count: 0,
  database_write_count: 0,
  formal_evidence_write_count: 0,
  public_provider_request_count: 0,
  formal_window_started: false,
  mcft_cap09_completed: false,
};

try {
  req(BASE === EXPECTED_BASE, `EA5B2_BASE_MAIN_DRIFT:${BASE}`);
  req(git('merge-base', BASE, 'HEAD') === BASE, 'EA5B2_BASE_NOT_ANCESTOR');
  req(git('diff', '--check', `${BASE}...HEAD`) === '', 'EA5B2_DIFF_CHECK_FAILED');
  const changed = git('diff', '--name-only', `${BASE}...HEAD`).split(/\r?\n/).filter(Boolean).sort();
  Object.assign(result, { changed_files: changed, exact_file_count: changed.length });
  req(JSON.stringify(changed) === JSON.stringify(EXPECT), `EA5B2_EXACT_FIVE_FILE_BOUNDARY_FAIL:${JSON.stringify(changed)}`);

  for (const key of ['task','amendment05','ea5b1','profile','selector','window','historicalA0']) {
    req(blob(BASE, F[key]) === PINS[key], `EA5B2_PREDECESSOR_BLOB_DRIFT:${key}`);
  }
  req(blob(BASE, F.service) === PINS.historicalService, 'EA5B2_HISTORICAL_CAP04_SERVICE_BLOB_DRIFT');
  for (const key of ['service','acceptance','authority']) {
    req(blob('HEAD', F[key]) === PINS[key], `EA5B2_IMPLEMENTATION_BLOB_DRIFT:${key}`);
  }
  req(blob('HEAD', F.historicalA0) === PINS.historicalA0, 'EA5B2_CAP08_A0_FROZEN_CORE_DRIFT');

  const authority = json(F.authority);
  const service = read(F.service);
  const acceptance = read(F.acceptance);
  const workflow = read(F.workflow);

  req(authority.record_status === 'EA5B2_CAP04_EXTERNAL_BINDING_THREADING_CANDIDATE_NOT_EFFECTIVE', 'EA5B2_AUTHORITY_STATUS_DRIFT');
  req(authority.base_main_sha === BASE, 'EA5B2_AUTHORITY_BASE_DRIFT');
  req(authority.predecessor_effectiveness?.ea5b1_merge_sha === BASE, 'EA5B2_EA5B1_EFFECTIVE_PREDECESSOR_REQUIRED');
  req(authority.predecessor_effectiveness?.ea5b1_authority_blob_sha === PINS.ea5b1, 'EA5B2_EA5B1_AUTHORITY_PIN_DRIFT');
  req(authority.implementation_blobs?.cap04_single_tick_service === PINS.service, 'EA5B2_SERVICE_PIN_DRIFT');
  req(authority.implementation_blobs?.focused_acceptance === PINS.acceptance, 'EA5B2_ACCEPTANCE_PIN_DRIFT');
  req(authority.implemented_boundary?.cap04_single_tick_accepts_optional_explicit_soil_binding_authority === true, 'EA5B2_CAP04_EXPLICIT_SOIL_INPUT_REQUIRED');
  req(authority.implemented_boundary?.cap04_threads_explicit_soil_binding_to_continuation_evidence_window === true, 'EA5B2_CAP04_THREADING_REQUIRED');
  req(authority.implemented_boundary?.omitted_soil_binding_preserves_historical_replay_default === true, 'EA5B2_REPLAY_DEFAULT_REQUIRED');
  req(authority.implemented_boundary?.idempotent_retry_requires_exact_soil_binding_authority_match === true, 'EA5B2_RETRY_AUTHORITY_STABILITY_REQUIRED');
  req(authority.success_effect_if_merged?.cap04_external_soil_binding_service_threading_effective === true, 'EA5B2_SUCCESS_EFFECT_MISSING');
  req(authority.success_effect_if_merged?.ea5b_external_runtime_profile_complete === false, 'EA5B2_EA5B_COMPLETION_PREMATURE');
  req(authority.success_effect_if_merged?.external_package_formal_eligible === false, 'EA5B2_FORMAL_ELIGIBILITY_PREMATURE');
  req(authority.success_effect_if_merged?.ea5c_authorized === false, 'EA5B2_EA5C_PREMATURE');
  req(authority.success_effect_if_merged?.formal_o00_start_authorized === false, 'EA5B2_O00_PREMATURE');

  for (const token of [
    'authorized_soil_observation_binding_id?: string',
    'CAP04_SINGLE_TICK_SOIL_BINDING_AUTHORITY_INVALID',
    'CAP04_SINGLE_TICK_SOIL_BINDING_AUTHORITY_RETRY_MISMATCH',
    'authorized_soil_observation_binding_id: authorizedSoilObservationBindingId',
    'assertExistingSoilBindingAuthorityV1(aRecordSet, authorizedSoilObservationBindingId)',
  ]) req(service.includes(token), `EA5B2_SERVICE_TOKEN_MISSING:${token}`);
  req(!/DATABASE_URL|NEON_DATABASE_URL|\bfetch\s*\(|https?:\/\//.test(service), 'EA5B2_NEW_NETWORK_OR_SECRET_SURFACE_FORBIDDEN');

  for (const token of [
    'explicit External authority selects KBS soil',
    'exact same External soil authority',
    'External-to-C8 authority drift',
    'explicit-to-omitted authority drift',
    'blank soil binding authority fails closed',
    'historical Replay default',
  ]) req(acceptance.includes(token), `EA5B2_ACCEPTANCE_CASE_MISSING:${token}`);
  req(acceptance.includes('assert.equal(pass, 6)'), 'EA5B2_ACCEPTANCE_PASS_COUNT_DRIFT');

  for (const token of [
    'ACCEPTANCE_MCFT_CAP_09_EA5B2_CAP04_EXTERNAL_BINDING_THREADING.ts',
    'ACCEPTANCE_MCFT_CAP_04_SINGLE_TICK_INTEGRATION.ts',
    'ACCEPTANCE_MCFT_CAP_04_SINGLE_TICK_INTEGRATION_NEGATIVE.ts',
    'ACCEPTANCE_MCFT_CAP_03_R4_A_EVIDENCE_CLASSIFICATION.ts',
    'ACCEPTANCE_MCFT_CAP_08_S2_G3_BOUNDARY.cjs',
    'pnpm --filter @geox/server run typecheck',
  ]) req(workflow.includes(token), `EA5B2_WORKFLOW_PROOF_MISSING:${token}`);
  req(!/DATABASE_URL|POSTGRES(?:QL)?|NEON_DATABASE_URL/.test(workflow), 'EA5B2_DATABASE_SECRET_FORBIDDEN');

  const forbiddenChanged = changed.filter((file) => /(?:persistence|migration|scheduler|collector|canonicalizer|ingress|runner|routes|apps\/web)/i.test(file));
  req(forbiddenChanged.length === 0, `EA5B2_FORBIDDEN_SCOPE_PATH:${JSON.stringify(forbiddenChanged)}`);

  Object.assign(result, {
    status: 'PASS',
    authority_blob: blob('HEAD', F.authority),
    cap04_single_tick_service_blob: blob('HEAD', F.service),
    cap04_external_soil_binding_threading_qualified: true,
    replay_default_preserved: true,
    retry_authority_drift_fail_closed: true,
    cap08_frozen_a0_bootstrap_core_unchanged: true,
    ea5b_external_runtime_profile_complete: false,
    external_package_formal_eligible: false,
    ea5c_authorized: false,
    formal_o00_start_authorized: false,
  });
} catch (error) {
  result.error = `${error.name || 'Error'}:${error.message || String(error)}`;
  process.exitCode = 1;
}
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, `${JSON.stringify(result, null, 2)}\n`);
if (result.status === 'PASS') console.log(JSON.stringify(result)); else console.error(result.error);
