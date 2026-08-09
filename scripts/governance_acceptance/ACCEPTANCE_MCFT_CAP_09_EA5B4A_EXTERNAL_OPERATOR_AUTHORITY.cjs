'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const ROOT = process.cwd();
const BASE = process.env.MCFT_BASE_SHA || '';
const EXPECTED_BASE = '391b809b66943f079d90209641e1cae892713b37';
const F = {
  task: 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-TASK.md',
  amendment05: 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-AMENDMENT-05-EXTERNAL-FORMAL-RUNTIME-AUTHORITY-PROFILE.md',
  ea5b3: 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA5B3-EXTERNAL-RUNTIME-CONFIG-RESOLVER-V1.json',
  ea5b2: 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA5B2-CAP04-EXTERNAL-BINDING-THREADING-V1.json',
  profile: 'apps/server/src/domain/twin_runtime/external_formal_evidence_binding_profile_v1.ts',
  posterior: 'apps/server/src/domain/soil_water/assimilated_continuation_posterior_v1.ts',
  cap04: 'apps/server/src/runtime/twin_runtime/forecast_scenario_single_tick_service_v1.ts',
  historicalA0: 'apps/server/src/runtime/twin_runtime/a0_bootstrap_runtime_service_v1.ts',
  view: 'apps/server/src/domain/soil_water/external_formal_assimilation_authority_view_v1.ts',
  acceptance: 'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_09_EA5B4A_EXTERNAL_OPERATOR_AUTHORITY.ts',
  authority: 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA5B4A-EXTERNAL-OPERATOR-AUTHORITY-V1.json',
  gate: 'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_EA5B4A_EXTERNAL_OPERATOR_AUTHORITY.cjs',
  workflow: '.github/workflows/mcft-cap-09-ea5b4a-external-operator-authority.yml',
};
const PINS = {
  task: '39f6a09273c30088a7ea264cfa94ff930ea5518e',
  amendment05: '7a92c17f7ba32aae52667de9c21db62bfd2ba70b',
  ea5b3: 'bdaf311cc23c78fb45079af65fcd30a7b794fec3',
  ea5b2: '09963e6bc3a64fc16d54c5f27a2a00228e4b5e24',
  profile: '5fe20f988d2cd6ef038f54eec27e5a32ba6a396d',
  posterior: '1031c2f534c47214f5a29326db9047e1c7c3566a',
  cap04: '5ca0fdbafe3cb244db92540e0cce4302506a965c',
  historicalA0: '7d2db571b421f1cbfe7fd1192398297def5307c2',
  view: '06c94f7778995e94ba6008c0a31f1273a5c620a2',
  acceptance: 'a997e49c1f6d142b0d8a4177388de2c8c59893e9',
  authority: '3192e3159bffce5a23913dc7299355e1a1e322c4',
};
const EXPECT = [F.view, F.acceptance, F.authority, F.gate, F.workflow].sort();
const OUT = path.join(ROOT, 'acceptance-output/MCFT_CAP_09_EA5B4A_EXTERNAL_OPERATOR_AUTHORITY_GOVERNANCE_RESULT.json');
const git = (...args) => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim();
const blob = (ref, file) => git('rev-parse', `${ref}:${file}`);
const read = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8');
const json = (file) => JSON.parse(read(file));
const req = (ok, code) => { if (!ok) throw new Error(code); };
const result = {
  schema_version: 'geox_mcft_cap09_ea5b4a_external_operator_authority_governance_v1',
  status: 'FAIL', base_sha: BASE, exact_file_count: 0,
  database_write_count: 0, formal_evidence_write_count: 0,
  public_provider_request_count: 0, formal_window_started: false,
  mcft_cap09_completed: false,
};

try {
  req(BASE === EXPECTED_BASE, `EA5B4A_BASE_MAIN_DRIFT:${BASE}`);
  req(git('merge-base', BASE, 'HEAD') === BASE, 'EA5B4A_BASE_NOT_ANCESTOR');
  req(git('diff', '--check', `${BASE}...HEAD`) === '', 'EA5B4A_DIFF_CHECK_FAILED');
  const changed = git('diff', '--name-only', `${BASE}...HEAD`).split(/\r?\n/).filter(Boolean).sort();
  Object.assign(result, { changed_files: changed, exact_file_count: changed.length });
  req(JSON.stringify(changed) === JSON.stringify(EXPECT), `EA5B4A_EXACT_FIVE_FILE_BOUNDARY_FAIL:${JSON.stringify(changed)}`);

  for (const key of ['task','amendment05','ea5b3','ea5b2','profile','posterior','cap04','historicalA0']) {
    req(blob(BASE, F[key]) === PINS[key], `EA5B4A_PREDECESSOR_BLOB_DRIFT:${key}`);
    req(blob('HEAD', F[key]) === PINS[key], `EA5B4A_PREDECESSOR_MUTATION_FORBIDDEN:${key}`);
  }
  for (const key of ['view','acceptance','authority']) {
    req(blob('HEAD', F[key]) === PINS[key], `EA5B4A_IMPLEMENTATION_BLOB_DRIFT:${key}`);
  }

  const amendment = read(F.amendment05);
  const authority = json(F.authority);
  const view = read(F.view);
  const acceptance = read(F.acceptance);
  const workflow = read(F.workflow);

  req(amendment.includes('POINT_100MM_TO_ROOT_ZONE_MEAN_H1_WITH_REPRESENTATIVENESS_V1'), 'EA5B4A_AMENDMENT05_OPERATOR_RULING_REQUIRED');
  req(authority.record_status === 'EA5B4A_EXTERNAL_OPERATOR_AUTHORITY_CANDIDATE_NOT_EFFECTIVE', 'EA5B4A_AUTHORITY_STATUS_DRIFT');
  req(authority.base_main_sha === BASE, 'EA5B4A_AUTHORITY_BASE_DRIFT');
  req(authority.predecessor_effectiveness?.ea5b3_merge_sha === BASE, 'EA5B4A_EA5B3_EFFECTIVE_PREDECESSOR_REQUIRED');
  req(authority.implementation_blobs?.external_formal_assimilation_authority_view === PINS.view, 'EA5B4A_VIEW_PIN_DRIFT');
  req(authority.implementation_blobs?.focused_acceptance === PINS.acceptance, 'EA5B4A_ACCEPTANCE_PIN_DRIFT');
  req(authority.external_operator_authority?.measurement_depth_mm === 100, 'EA5B4A_100MM_DEPTH_REQUIRED');
  req(authority.external_operator_authority?.h === 1, 'EA5B4A_H1_REQUIRED');
  req(authority.external_operator_authority?.root_zone_representativeness === 'PARTIAL', 'EA5B4A_PARTIAL_REPRESENTATIVENESS_REQUIRED');
  req(authority.external_operator_authority?.direct_field_equivalence === false && authority.external_operator_authority?.direct_root_zone_equivalence === false, 'EA5B4A_DIRECT_EQUIVALENCE_FORBIDDEN');
  req(authority.compatibility_math_boundary?.historical_posterior_mutated === false, 'EA5B4A_HISTORICAL_POSTERIOR_MUTATION_FORBIDDEN');
  req(authority.compatibility_math_boundary?.external_operator_changes_numerical_result === false, 'EA5B4A_OPERATOR_NUMERICAL_CHANGE_FORBIDDEN');
  req(authority.compatibility_math_boundary?.canonical_persistence_authorized === false, 'EA5B4A_CANONICAL_PERSISTENCE_FORBIDDEN');
  req(authority.success_effect_if_merged?.external_assimilation_operator_authority_view_effective === true, 'EA5B4A_VIEW_SUCCESS_EFFECT_REQUIRED');
  req(authority.success_effect_if_merged?.external_a0_profile_effective === false && authority.success_effect_if_merged?.ea5b4_complete === false, 'EA5B4A_PREMATURE_B4_COMPLETION');
  req(authority.success_effect_if_merged?.ea5c_authorized === false && authority.success_effect_if_merged?.formal_o00_start_authorized === false, 'EA5B4A_PREMATURE_SUCCESSOR_EFFECT');

  for (const token of [
    'MCFT_CAP09_EXTERNAL_FORMAL_SOIL_BINDING_ID_V1',
    'MCFT_CAP09_EXTERNAL_FORMAL_SOIL_OBSERVATION_OPERATOR_ID_V1',
    'ASSIMILATED_CONTINUATION_OBSERVATION_OPERATOR_ID_V1',
    'measurement_depth_mm: 100',
    'root_zone_representativeness: "PARTIAL"',
    'numerical_identity_preserved: true',
    'canonical_persistence_authorized: false',
    'EXTERNAL_FORMAL_ASSIMILATION_NUMERICAL_IDENTITY_MISMATCH',
  ]) req(view.includes(token), `EA5B4A_VIEW_TOKEN_MISSING:${token}`);
  req(!/DATABASE_URL|POSTGRES(?:QL)?|NEON_DATABASE_URL|\bfetch\s*\(|https?:\/\//.test(view), 'EA5B4A_NETWORK_OR_DATABASE_SURFACE_FORBIDDEN');
  req(!/INSERT\s+INTO|commit[A-Z]\w*\s*\(/.test(view), 'EA5B4A_PERSISTENCE_SURFACE_FORBIDDEN');

  for (const token of [
    'exact 100-mm operator provenance',
    'preserves the exact numerical posterior',
    'does not mutate the historical CAP03 compatibility posterior',
    'remains non-persistable',
    'cannot claim External operator provenance',
    'Evidence selection and posterior observation refs diverge',
    'without inventing an observation',
  ]) req(acceptance.includes(token), `EA5B4A_ACCEPTANCE_CASE_MISSING:${token}`);
  req(acceptance.includes('assert.equal(pass, 7)'), 'EA5B4A_ACCEPTANCE_PASS_COUNT_DRIFT');

  for (const token of [
    'ACCEPTANCE_MCFT_CAP_09_EA5B4A_EXTERNAL_OPERATOR_AUTHORITY.ts',
    'ACCEPTANCE_MCFT_CAP_09_EA5B2_CAP04_EXTERNAL_BINDING_THREADING.ts',
    'ACCEPTANCE_MCFT_CAP_03_OBSERVATION_ASSIMILATION.ts',
    'ACCEPTANCE_MCFT_CAP_03_OBSERVATION_ASSIMILATION_NEGATIVE.ts',
    'ACCEPTANCE_MCFT_CAP_08_S2_G3_BOUNDARY.cjs',
    'pnpm --filter @geox/server run typecheck',
  ]) req(workflow.includes(token), `EA5B4A_WORKFLOW_PROOF_MISSING:${token}`);
  req(!/DATABASE_URL|POSTGRES(?:QL)?|NEON_DATABASE_URL/.test(workflow), 'EA5B4A_DATABASE_SECRET_FORBIDDEN');

  Object.assign(result, {
    status: 'PASS',
    authority_blob: blob('HEAD', F.authority),
    external_operator_view_blob: blob('HEAD', F.view),
    external_operator_authority_qualified: true,
    numerical_identity_preserved: true,
    historical_cap03_math_unchanged: true,
    canonical_persistence_authorized: false,
    external_a0_profile_effective: false,
    ea5b4_complete: false,
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
