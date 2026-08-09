'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const ROOT = process.cwd();
const BASE = process.env.MCFT_BASE_SHA || '';
const EXPECTED_BASE = '982ff8a3382e22a6fb3de01c83a9c98e22dbfb77';
const F = {
  task: 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-TASK.md',
  amendment05: 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-AMENDMENT-05-EXTERNAL-FORMAL-RUNTIME-AUTHORITY-PROFILE.md',
  ea5b2: 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA5B2-CAP04-EXTERNAL-BINDING-THREADING-V1.json',
  profile: 'apps/server/src/domain/twin_runtime/external_formal_evidence_binding_profile_v1.ts',
  site: 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S6-FORMAL-SITE-AUTHORITY-V1.json',
  reality: 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S6-FORMAL-REALITY-BINDING-V1.json',
  source: 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S6-FORMAL-SOURCE-BINDING-MATRIX-V1.json',
  crop: 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S6-FORMAL-CROP-CONTEXT-AUTHORITY-V1.json',
  recovery: 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA4-RECOVERY-AUTHORITY-V1.json',
  ea5a: 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA5A-FRESH-FORMAL-DATABASE-PREFLIGHT-V1.json',
  historicalConfig: 'apps/server/src/domain/twin_runtime/forecast_scenario_runtime_config_v1.ts',
  historicalA0: 'apps/server/src/runtime/twin_runtime/a0_bootstrap_runtime_service_v1.ts',
  externalConfig: 'apps/server/src/domain/twin_runtime/external_formal_runtime_config_v1.ts',
  executionView: 'apps/server/src/domain/twin_runtime/runtime_config_execution_view_v1.ts',
  resolver: 'apps/server/src/domain/twin_runtime/external_formal_cap04_execution_config_resolver_v1.ts',
  acceptance: 'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_09_EA5B3_EXTERNAL_RUNTIME_CONFIG_RESOLVER.ts',
  authority: 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA5B3-EXTERNAL-RUNTIME-CONFIG-RESOLVER-V1.json',
  gate: 'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_EA5B3_EXTERNAL_RUNTIME_CONFIG_RESOLVER.cjs',
  workflow: '.github/workflows/mcft-cap-09-ea5b3-external-runtime-config-resolver.yml',
};
const PINS = {
  task: '39f6a09273c30088a7ea264cfa94ff930ea5518e',
  amendment05: '7a92c17f7ba32aae52667de9c21db62bfd2ba70b',
  ea5b2: '09963e6bc3a64fc16d54c5f27a2a00228e4b5e24',
  profile: '5fe20f988d2cd6ef038f54eec27e5a32ba6a396d',
  site: 'eb9eb1880e01eb16430c177be6e2ef2dc36b3ca8',
  reality: 'dedc8db6e2e3c902066ed94b0d3322a69775b7b6',
  source: '30b7910a1bd27882b80eb56041924d0f6252ae02',
  crop: 'b5de9d29189cb654444b3f57d00df290eefe16d3',
  recovery: '1174940a6908e545e70d87cb65be5b3a41db33cf',
  ea5a: 'f3a57413d78633685cbc5be7d94f39d9fdc5c62b',
  historicalConfig: '2ceefc94aa82e619b1ef2398a1d7260b9607fa51',
  historicalExecutionView: '9021a803454efe803662a4682dde915ceda5041e',
  historicalA0: '7d2db571b421f1cbfe7fd1192398297def5307c2',
  externalConfig: 'f7ea03a7f8387ce4de135dac61f0b063e91f0f25',
  executionView: 'cbb5f4d6ea0753825fe9f7d419cd3cbd89298895',
  resolver: '7c542f62b6950739187948fa60f0d4c5b3c4e8e6',
  acceptance: 'aa114a4557be1d3d79bb0cd29b98e0ba1c86a88d',
  authority: 'bdaf311cc23c78fb45079af65fcd30a7b794fec3',
};
const EXPECT = [F.externalConfig, F.executionView, F.resolver, F.acceptance, F.authority, F.gate, F.workflow].sort();
const OUT = path.join(ROOT, 'acceptance-output/MCFT_CAP_09_EA5B3_EXTERNAL_RUNTIME_CONFIG_RESOLVER_GOVERNANCE_RESULT.json');
const git = (...args) => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim();
const blob = (ref, file) => git('rev-parse', `${ref}:${file}`);
const read = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8');
const json = (file) => JSON.parse(read(file));
const req = (ok, code) => { if (!ok) throw new Error(code); };
const result = {
  schema_version: 'geox_mcft_cap09_ea5b3_external_runtime_config_resolver_governance_v1',
  status: 'FAIL', base_sha: BASE, exact_file_count: 0,
  database_write_count: 0, formal_evidence_write_count: 0,
  public_provider_request_count: 0, formal_window_started: false,
  mcft_cap09_completed: false,
};

try {
  req(BASE === EXPECTED_BASE, `EA5B3_BASE_MAIN_DRIFT:${BASE}`);
  req(git('merge-base', BASE, 'HEAD') === BASE, 'EA5B3_BASE_NOT_ANCESTOR');
  req(git('diff', '--check', `${BASE}...HEAD`) === '', 'EA5B3_DIFF_CHECK_FAILED');
  const changed = git('diff', '--name-only', `${BASE}...HEAD`).split(/\r?\n/).filter(Boolean).sort();
  Object.assign(result, { changed_files: changed, exact_file_count: changed.length });
  req(JSON.stringify(changed) === JSON.stringify(EXPECT), `EA5B3_EXACT_SEVEN_FILE_BOUNDARY_FAIL:${JSON.stringify(changed)}`);

  for (const key of ['task','amendment05','ea5b2','profile','site','reality','source','crop','recovery','ea5a','historicalConfig','historicalA0']) {
    req(blob(BASE, F[key]) === PINS[key], `EA5B3_PREDECESSOR_BLOB_DRIFT:${key}`);
  }
  req(blob(BASE, F.executionView) === PINS.historicalExecutionView, 'EA5B3_HISTORICAL_EXECUTION_VIEW_BLOB_DRIFT');
  for (const key of ['externalConfig','executionView','resolver','acceptance','authority']) {
    req(blob('HEAD', F[key]) === PINS[key], `EA5B3_IMPLEMENTATION_BLOB_DRIFT:${key}`);
  }
  req(blob('HEAD', F.historicalA0) === PINS.historicalA0, 'EA5B3_CAP08_A0_FROZEN_CORE_DRIFT');
  req(blob('HEAD', F.historicalConfig) === PINS.historicalConfig, 'EA5B3_HISTORICAL_CAP04_CONFIG_MUTATION_FORBIDDEN');

  const amendment = read(F.amendment05);
  const authority = json(F.authority);
  const externalConfig = read(F.externalConfig);
  const executionView = read(F.executionView);
  const resolver = read(F.resolver);
  const acceptance = read(F.acceptance);
  const workflow = read(F.workflow);

  req(amendment.includes('External canonical bootstrap Runtime Config') && amendment.includes('Non-canonical compatibility execution view'), 'EA5B3_AMENDMENT05_CONFIG_RESOLVER_RULING_REQUIRED');
  req(authority.record_status === 'EA5B3_EXTERNAL_RUNTIME_CONFIG_RESOLVER_CANDIDATE_NOT_EFFECTIVE', 'EA5B3_AUTHORITY_STATUS_DRIFT');
  req(authority.base_main_sha === BASE, 'EA5B3_AUTHORITY_BASE_DRIFT');
  req(authority.predecessor_effectiveness?.ea5b2_merge_sha === BASE, 'EA5B3_EA5B2_EFFECTIVE_PREDECESSOR_REQUIRED');
  req(authority.implementation_blobs?.external_formal_runtime_config === PINS.externalConfig, 'EA5B3_EXTERNAL_CONFIG_PIN_DRIFT');
  req(authority.implementation_blobs?.runtime_config_execution_view === PINS.executionView, 'EA5B3_EXECUTION_VIEW_PIN_DRIFT');
  req(authority.implementation_blobs?.external_formal_cap04_execution_config_resolver === PINS.resolver, 'EA5B3_RESOLVER_PIN_DRIFT');
  req(authority.implementation_blobs?.focused_acceptance === PINS.acceptance, 'EA5B3_ACCEPTANCE_PIN_DRIFT');
  req(authority.external_canonical_runtime_config_authority?.runtime_mode === 'SHADOW_ONLINE_FORMAL_QUALIFICATION_ONLY', 'EA5B3_EXTERNAL_RUNTIME_MODE_REQUIRED');
  req(authority.external_canonical_runtime_config_authority?.historical_replay_scope_allowed === false, 'EA5B3_REPLAY_SCOPE_FORBIDDEN');
  req(authority.external_canonical_runtime_config_authority?.controlled_synthetic_replay_proxy_allowed === false, 'EA5B3_REPLAY_PROXY_FORBIDDEN');
  req(authority.external_canonical_runtime_config_authority?.geometry_hash_invented_by_compiler === false, 'EA5B3_FAKE_GEOMETRY_FORBIDDEN');
  req(authority.compatibility_execution_view?.compatibility_view_canonical_persistence_authorized === false, 'EA5B3_COMPATIBILITY_PERSISTENCE_FORBIDDEN');
  req(authority.success_effect_if_merged?.external_canonical_runtime_config_contract_effective === true, 'EA5B3_CONFIG_SUCCESS_EFFECT_REQUIRED');
  req(authority.success_effect_if_merged?.external_noncanonical_cap04_compatibility_resolver_effective === true, 'EA5B3_RESOLVER_SUCCESS_EFFECT_REQUIRED');
  req(authority.success_effect_if_merged?.external_cap04_canonical_execution_effective === false, 'EA5B3_CAP04_EXECUTION_PREMATURE');
  req(authority.success_effect_if_merged?.external_a0_profile_effective === false, 'EA5B3_A0_PROFILE_PREMATURE');
  req(authority.success_effect_if_merged?.ea5b_external_runtime_profile_complete === false, 'EA5B3_EA5B_COMPLETION_PREMATURE');
  req(authority.success_effect_if_merged?.ea5c_authorized === false && authority.success_effect_if_merged?.formal_o00_start_authorized === false, 'EA5B3_PREMATURE_SUCCESSOR_EFFECT');

  for (const token of [
    'MCFT_CAP09_EXTERNAL_FORMAL_RUNTIME_AUTHORITY_V1',
    'SHADOW_ONLINE_FORMAL_QUALIFICATION_ONLY',
    'EXTERNAL_PUBLIC_RESEARCH_SCOPE',
    'MODEL_PRIOR_FROM_CAP08',
    'NOT_FIELD_CALIBRATED',
    'MCFT_CAP09_EXTERNAL_FORMAL_SOIL_BINDING_ID_V1',
    'MCFT_CAP09_EXTERNAL_FORMAL_SOIL_OBSERVATION_OPERATOR_ID_V1',
    'geometry_semantic_hash',
    'canonical_persistence_authorized: false',
    'may_relabel_external_evidence: false',
  ]) req(externalConfig.includes(token), `EA5B3_EXTERNAL_CONFIG_TOKEN_MISSING:${token}`);
  req(!externalConfig.includes('CONTROLLED_SYNTHETIC_REPLAY_PROXY'), 'EA5B3_EXTERNAL_CONFIG_REPLAY_PROXY_FORBIDDEN');
  req(!externalConfig.includes('runtime_mode: "REPLAY"'), 'EA5B3_EXTERNAL_CONFIG_REPLAY_MODE_FORBIDDEN');

  req(executionView.includes('EXTERNAL_FORMAL_CAP04_COMPATIBILITY_RESOLUTION_POLICY_ID_V1'), 'EA5B3_EXECUTION_VIEW_POLICY_TYPE_REQUIRED');
  req(executionView.includes('MCFT_CAP09_EXTERNAL_FORMAL_RUNTIME_CONFIG_PURPOSE_V1'), 'EA5B3_EXECUTION_VIEW_EXTERNAL_PURPOSE_REQUIRED');
  req(resolver.includes('compileCap04RuntimeConfigV1') && resolver.includes('validateExternalFormalRuntimeConfigPayloadV1'), 'EA5B3_EXTERNAL_RESOLVER_REQUIRED');
  req(resolver.includes('source_config_ref: canonicalConfig.object_id') && resolver.includes('source_config_hash: canonicalConfig.determinism_hash'), 'EA5B3_EXTERNAL_SOURCE_IDENTITY_PRESERVATION_REQUIRED');
  req(resolver.includes('EXTERNAL_FORMAL_CAP04_HOURLY_CONFIG_REQUIRED'), 'EA5B3_A0_TO_CAP04_RESOLVER_FAIL_CLOSED_REQUIRED');
  req(resolver.includes('exactRequiredScopeStringV1') && resolver.includes('MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1'), 'EA5B3_EXACT_EXTERNAL_SCOPE_NARROWING_REQUIRED');

  for (const text of [externalConfig, executionView, resolver]) {
    req(!/DATABASE_URL|POSTGRES(?:QL)?|NEON_DATABASE_URL|\bfetch\s*\(|https?:\/\//.test(text), 'EA5B3_NETWORK_OR_DATABASE_SURFACE_FORBIDDEN');
  }
  req(!/INSERT\s+INTO|commitRuntimeConfig\s*\(|commitBootstrapState\s*\(/i.test(externalConfig + resolver), 'EA5B3_PERSISTENCE_SURFACE_FORBIDDEN');

  for (const token of [
    'External A0 canonical Runtime Config is honest',
    'compilation is deterministic',
    'parent drift changes canonical identity',
    'resolves to CAP04 compatibility math payload',
    'compatibility markers remain non-canonical',
    'rejects External A0 bootstrap configs',
    'rejects Replay scope',
    'Historical Direct CAP04 resolver remains unchanged',
  ]) req(acceptance.includes(token), `EA5B3_ACCEPTANCE_CASE_MISSING:${token}`);
  req(acceptance.includes('assert.equal(pass, 8)'), 'EA5B3_ACCEPTANCE_PASS_COUNT_DRIFT');

  for (const token of [
    'ACCEPTANCE_MCFT_CAP_09_EA5B3_EXTERNAL_RUNTIME_CONFIG_RESOLVER.ts',
    'ACCEPTANCE_MCFT_CAP_09_EA5B2_CAP04_EXTERNAL_BINDING_THREADING.ts',
    'ACCEPTANCE_MCFT_CAP_04_SINGLE_TICK_INTEGRATION.ts',
    'ACCEPTANCE_MCFT_CAP_04_SINGLE_TICK_INTEGRATION_NEGATIVE.ts',
    'ACCEPTANCE_MCFT_CAP_08_S2_G3_BOUNDARY.cjs',
    'pnpm --filter @geox/server run typecheck',
  ]) req(workflow.includes(token), `EA5B3_WORKFLOW_PROOF_MISSING:${token}`);
  req(!/DATABASE_URL|POSTGRES(?:QL)?|NEON_DATABASE_URL/.test(workflow), 'EA5B3_DATABASE_SECRET_FORBIDDEN');

  const forbiddenChanged = changed.filter((file) => /(?:persistence|migration|scheduler|collector|canonicalizer|ingress|runner|routes|apps\/web)/i.test(file));
  req(forbiddenChanged.length === 0, `EA5B3_FORBIDDEN_SCOPE_PATH:${JSON.stringify(forbiddenChanged)}`);

  Object.assign(result, {
    status: 'PASS',
    authority_blob: blob('HEAD', F.authority),
    external_runtime_config_blob: blob('HEAD', F.externalConfig),
    external_cap04_resolver_blob: blob('HEAD', F.resolver),
    external_canonical_runtime_config_contract_qualified: true,
    noncanonical_cap04_compatibility_resolver_qualified: true,
    external_cap04_canonical_execution_effective: false,
    external_a0_profile_effective: false,
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
