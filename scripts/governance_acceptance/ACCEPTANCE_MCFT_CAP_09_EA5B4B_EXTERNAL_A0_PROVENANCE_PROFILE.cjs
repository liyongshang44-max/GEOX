'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const ROOT = process.cwd();
const BASE = process.env.MCFT_BASE_SHA || '';
const EXPECTED_BASE = 'a9baab6c214c477ee7f780a3e4ea7d6c86fa2f24';
const F = {
  task: 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-TASK.md',
  amendment05: 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-AMENDMENT-05-EXTERNAL-FORMAL-RUNTIME-AUTHORITY-PROFILE.md',
  ea5b4a: 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA5B4A-EXTERNAL-OPERATOR-AUTHORITY-V1.json',
  ea5b3: 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA5B3-EXTERNAL-RUNTIME-CONFIG-RESOLVER-V1.json',
  profile: 'apps/server/src/domain/twin_runtime/external_formal_evidence_binding_profile_v1.ts',
  historicalA0Builder: 'apps/server/src/runtime/twin_runtime/a0_record_set_builder_v1.ts',
  historicalA0Service: 'apps/server/src/runtime/twin_runtime/a0_bootstrap_runtime_service_v1.ts',
  historicalBootstrapConfig: 'apps/server/src/domain/twin_runtime/runtime_config_v1.ts',
  posteriorAuthority: 'apps/server/src/domain/soil_water/external_formal_bootstrap_posterior_authority_v1.ts',
  builder: 'apps/server/src/runtime/twin_runtime/external_formal_a0_record_set_builder_v1.ts',
  acceptance: 'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_09_EA5B4B_EXTERNAL_A0_PROVENANCE_PROFILE.ts',
  authority: 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA5B4B-EXTERNAL-A0-PROVENANCE-PROFILE-V1.json',
  gate: 'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_EA5B4B_EXTERNAL_A0_PROVENANCE_PROFILE.cjs',
  workflow: '.github/workflows/mcft-cap-09-ea5b4b-external-a0-provenance-profile.yml',
};
const PINS = {
  task: '39f6a09273c30088a7ea264cfa94ff930ea5518e',
  amendment05: '7a92c17f7ba32aae52667de9c21db62bfd2ba70b',
  ea5b4a: '3192e3159bffce5a23913dc7299355e1a1e322c4',
  ea5b3: 'bdaf311cc23c78fb45079af65fcd30a7b794fec3',
  profile: '5fe20f988d2cd6ef038f54eec27e5a32ba6a396d',
  historicalA0Builder: 'd90e60f4603ce6040a5a0dc4cf1fd0729bbc68bf',
  historicalA0Service: '7d2db571b421f1cbfe7fd1192398297def5307c2',
  historicalBootstrapConfig: 'b682878b6bf8f714d4abcc57e32ee48ec02de617',
  posteriorAuthority: '10f00c9dc716bfd9f164c42f00701340a6b3d74b',
  builder: '516c141cbb971d55635b500d2a99962116159588',
  acceptance: 'aa9e6124887f9678f8f02dfa2e4279ade0c967c8',
  authority: '503842ef473e7ccf6a6fe46a21a36e678766851b',
};
const EXPECT = [F.posteriorAuthority, F.builder, F.acceptance, F.authority, F.gate, F.workflow].sort();
const OUT = path.join(ROOT, 'acceptance-output/MCFT_CAP_09_EA5B4B_EXTERNAL_A0_PROVENANCE_PROFILE_GOVERNANCE_RESULT.json');
const git = (...args) => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim();
const blob = (ref, file) => git('rev-parse', `${ref}:${file}`);
const read = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8');
const json = (file) => JSON.parse(read(file));
const req = (ok, code) => { if (!ok) throw new Error(code); };
const result = {
  schema_version: 'geox_mcft_cap09_ea5b4b_external_a0_provenance_profile_governance_v1',
  status: 'FAIL', base_sha: BASE, exact_file_count: 0,
  database_write_count: 0, formal_evidence_write_count: 0,
  public_provider_request_count: 0, canonical_persistence_authorized: false,
  formal_window_started: false, mcft_cap09_completed: false,
};

try {
  req(BASE === EXPECTED_BASE, `EA5B4B_BASE_MAIN_DRIFT:${BASE}`);
  req(git('merge-base', BASE, 'HEAD') === BASE, 'EA5B4B_BASE_NOT_ANCESTOR');
  req(git('diff', '--check', `${BASE}...HEAD`) === '', 'EA5B4B_DIFF_CHECK_FAILED');
  const changed = git('diff', '--name-only', `${BASE}...HEAD`).split(/\r?\n/).filter(Boolean).sort();
  Object.assign(result, { changed_files: changed, exact_file_count: changed.length });
  req(JSON.stringify(changed) === JSON.stringify(EXPECT), `EA5B4B_EXACT_SIX_FILE_BOUNDARY_FAIL:${JSON.stringify(changed)}`);

  for (const key of ['task','amendment05','ea5b4a','ea5b3','profile','historicalA0Builder','historicalA0Service','historicalBootstrapConfig']) {
    req(blob(BASE, F[key]) === PINS[key], `EA5B4B_PREDECESSOR_BLOB_DRIFT:${key}`);
    req(blob('HEAD', F[key]) === PINS[key], `EA5B4B_PREDECESSOR_MUTATION_FORBIDDEN:${key}`);
  }
  for (const key of ['posteriorAuthority','builder','acceptance','authority']) {
    req(blob('HEAD', F[key]) === PINS[key], `EA5B4B_IMPLEMENTATION_BLOB_DRIFT:${key}`);
  }

  const amendment = read(F.amendment05);
  const authority = json(F.authority);
  const posteriorAuthority = read(F.posteriorAuthority);
  const builder = read(F.builder);
  const acceptance = read(F.acceptance);
  const workflow = read(F.workflow);

  req(amendment.includes('External A0 bootstrap profile') && amendment.includes('SHADOW_ONLINE_FORMAL_QUALIFICATION_ONLY'), 'EA5B4B_AMENDMENT05_A0_RULING_REQUIRED');
  req(authority.record_status === 'EA5B4B_EXTERNAL_A0_PROVENANCE_PROFILE_CANDIDATE_NOT_EFFECTIVE', 'EA5B4B_AUTHORITY_STATUS_DRIFT');
  req(authority.base_main_sha === BASE, 'EA5B4B_AUTHORITY_BASE_DRIFT');
  req(authority.predecessor_effectiveness?.ea5b4a_merge_sha === BASE, 'EA5B4B_EA5B4A_EFFECTIVE_PREDECESSOR_REQUIRED');
  req(authority.implementation_blobs?.external_formal_bootstrap_posterior_authority === PINS.posteriorAuthority, 'EA5B4B_POSTERIOR_AUTHORITY_PIN_DRIFT');
  req(authority.implementation_blobs?.external_formal_a0_record_set_builder === PINS.builder, 'EA5B4B_BUILDER_PIN_DRIFT');
  req(authority.implementation_blobs?.focused_acceptance === PINS.acceptance, 'EA5B4B_ACCEPTANCE_PIN_DRIFT');
  req(authority.canonical_candidate_graph?.member_count === 9, 'EA5B4B_NINE_MEMBER_GRAPH_REQUIRED');
  req(authority.canonical_candidate_graph?.canonical_persistence_authorized === false, 'EA5B4B_CANONICAL_PERSISTENCE_FORBIDDEN');
  req(authority.compatibility_math_boundary?.historical_a0_builder_modified === false, 'EA5B4B_HISTORICAL_A0_BUILDER_MUTATION_FORBIDDEN');
  req(authority.compatibility_math_boundary?.historical_a0_service_modified === false, 'EA5B4B_HISTORICAL_A0_SERVICE_MUTATION_FORBIDDEN');
  req(authority.compatibility_math_boundary?.numerical_identity_digest_required === true, 'EA5B4B_NUMERICAL_IDENTITY_REQUIRED');
  req(authority.success_effect_if_merged?.external_a0_canonical_candidate_profile_effective === true, 'EA5B4B_A0_PROFILE_SUCCESS_EFFECT_REQUIRED');
  req(authority.success_effect_if_merged?.external_a0_bootstrap_persistence_effective === false, 'EA5B4B_A0_PERSISTENCE_PREMATURE');
  req(authority.success_effect_if_merged?.ea5b_external_runtime_profile_complete === false, 'EA5B4B_EA5B_COMPLETION_PREMATURE');
  req(authority.success_effect_if_merged?.ea5c_authorized === false && authority.success_effect_if_merged?.formal_o00_start_authorized === false, 'EA5B4B_PREMATURE_SUCCESSOR_EFFECT');

  for (const token of [
    'MCFT_CAP09_EXTERNAL_FORMAL_SOIL_BINDING_ID_V1',
    'MCFT_CAP09_EXTERNAL_FORMAL_SOIL_OBSERVATION_OPERATOR_ID_V1',
    'compatibility_source_canonical_persistence_authorized: false',
    'EXTERNAL_FORMAL_BOOTSTRAP_NUMERICAL_IDENTITY_MISMATCH',
    'MODEL_PRIOR_FROM_CAP08', 'NOT_FIELD_CALIBRATED',
  ]) req(posteriorAuthority.includes(token), `EA5B4B_POSTERIOR_AUTHORITY_TOKEN_MISSING:${token}`);

  for (const token of [
    'buildRootZoneWaterPosteriorV1',
    'buildExternalFormalBootstrapPosteriorAuthorityV1',
    'validateA0RecordSetV1',
    'EXTERNAL_A0_REPLAY_OR_SYNTHETIC_CANONICAL_MARKER_FORBIDDEN',
    'CONTROLLED_SYNTHETIC_REPLAY_PROXY',
    'POINT_200MM_TO_ROOT_ZONE_MEAN_H1_WITH_REPRESENTATIVENESS_V1',
    'EXTERNAL_A0_CANONICAL_CANDIDATE_WITH_BLOCKED_FORECAST',
  ]) req(builder.includes(token), `EA5B4B_BUILDER_TOKEN_MISSING:${token}`);
  req(!/DATABASE_URL|POSTGRES(?:QL)?|NEON_DATABASE_URL|\bfetch\s*\(|https?:\/\//.test(posteriorAuthority + builder), 'EA5B4B_NETWORK_OR_DATABASE_SURFACE_FORBIDDEN');
  req(!/INSERT\s+INTO|commitBootstrapState\s*\(|commitRuntimeConfig\s*\(/i.test(posteriorAuthority + builder), 'EA5B4B_PERSISTENCE_SURFACE_FORBIDDEN');

  for (const token of [
    'exact KBS 100-mm soil binding',
    'valid nine-object graph',
    'freeze exact KBS binding, 100-mm operator',
    'honest Shadow-online qualification mode',
    'preserves frozen CAP01 bootstrap numerical posterior',
    'External A0 is deterministic',
    'rejects historical C8 soil authority',
    'rejects hourly config role',
  ]) req(acceptance.includes(token), `EA5B4B_ACCEPTANCE_CASE_MISSING:${token}`);
  req(acceptance.includes('assert.equal(pass, 8)'), 'EA5B4B_ACCEPTANCE_PASS_COUNT_DRIFT');

  for (const token of [
    'ACCEPTANCE_MCFT_CAP_09_EA5B4B_EXTERNAL_A0_PROVENANCE_PROFILE.ts',
    'ACCEPTANCE_MCFT_CAP_09_EA5B4A_EXTERNAL_OPERATOR_AUTHORITY.ts',
    'ACCEPTANCE_MCFT_CAP_01_A0_RUNTIME.ts',
    'ACCEPTANCE_MCFT_CAP_08_S2_G3_BOUNDARY.cjs',
    'pnpm --filter @geox/server run typecheck',
  ]) req(workflow.includes(token), `EA5B4B_WORKFLOW_PROOF_MISSING:${token}`);
  req(!/DATABASE_URL|POSTGRES(?:QL)?|NEON_DATABASE_URL/.test(workflow), 'EA5B4B_DATABASE_SECRET_FORBIDDEN');

  Object.assign(result, {
    status: 'PASS',
    authority_blob: blob('HEAD', F.authority),
    external_bootstrap_posterior_authority_blob: blob('HEAD', F.posteriorAuthority),
    external_a0_builder_blob: blob('HEAD', F.builder),
    external_a0_canonical_candidate_profile_qualified: true,
    cap01_bootstrap_numerical_identity_preserved: true,
    historical_a0_builder_unchanged: true,
    historical_a0_service_unchanged: true,
    external_a0_bootstrap_persistence_effective: false,
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
