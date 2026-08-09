'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const ROOT = process.cwd();
const BASE = process.env.MCFT_BASE_SHA || '';
const EXPECTED_BASE = '9dc8f99303e9d1efaec52afe5eac7ed816c5a8d2';
const F = {
  task: 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-TASK.md',
  a1: 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-AMENDMENT-01-EXTERNAL-PUBLIC-EVIDENCE-AUTHORITY.md',
  a5: 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-AMENDMENT-05-EXTERNAL-FORMAL-RUNTIME-AUTHORITY-PROFILE.md',
  a5status: 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-AMENDMENT-05-STATUS.json',
  recovery: 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA4-RECOVERY-AUTHORITY-V1.json',
  ea5a: 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA5A-FRESH-FORMAL-DATABASE-PREFLIGHT-V1.json',
  profile: 'apps/server/src/domain/twin_runtime/external_formal_evidence_binding_profile_v1.ts',
  a0window: 'apps/server/src/runtime/twin_runtime/evidence_window_builder_v1.ts',
  selector: 'apps/server/src/runtime/twin_runtime/assimilated_continuation_observation_selector_v2.ts',
  contWindow: 'apps/server/src/runtime/twin_runtime/assimilated_continuation_evidence_window_v2.ts',
  historicalA0Service: 'apps/server/src/runtime/twin_runtime/a0_bootstrap_runtime_service_v1.ts',
  externalA0Service: 'apps/server/src/runtime/twin_runtime/external_formal_a0_evidence_window_service_v1.ts',
  acceptance: 'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_09_EA5B_EXTERNAL_EVIDENCE_BINDING_SEAM.ts',
  authority: 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA5B1-EXTERNAL-EVIDENCE-BINDING-SEAM-V1.json',
  gate: 'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_EA5B1_EXTERNAL_EVIDENCE_BINDING_SEAM.cjs',
  workflow: '.github/workflows/mcft-cap-09-ea5b1-external-evidence-binding-seam.yml',
};
const PINS = {
  task: '39f6a09273c30088a7ea264cfa94ff930ea5518e',
  a1: '41270b888e15e4d9a6c9a34e1fa3f70e957a275e',
  a5: '7a92c17f7ba32aae52667de9c21db62bfd2ba70b',
  a5status: 'be8a80345e004cf33d3993b0e26dcea01fc6644b',
  recovery: '1174940a6908e545e70d87cb65be5b3a41db33cf',
  ea5a: 'f3a57413d78633685cbc5be7d94f39d9fdc5c62b',
  profile: '5fe20f988d2cd6ef038f54eec27e5a32ba6a396d',
  a0window: '4b626cc1069c83ba31963c31d0228382a4842bf7',
  selector: 'c4ecf12c9830a82b4b5f5c001e51a483fc7ad2e0',
  contWindow: '0a7c02aae1e5ddbccadc303ae7977e4369dddcba',
  historicalA0Service: '7d2db571b421f1cbfe7fd1192398297def5307c2',
  externalA0Service: '1a02cd7c39da8a17ebd161f487c7d2c3c7c704e1',
  acceptance: '8f6176a518d31d494cbd24978c5e5834174efed7',
  authority: '94b8e891bb077753ef77fc7c55fc5c78f1c328e2',
};
const EXPECT = [
  F.profile, F.a0window, F.selector, F.contWindow, F.externalA0Service,
  F.acceptance, F.authority, F.gate, F.workflow,
].sort();
const OUT = path.join(ROOT, 'acceptance-output/MCFT_CAP_09_EA5B1_EXTERNAL_EVIDENCE_BINDING_SEAM_GOVERNANCE_RESULT.json');
const git = (...args) => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim();
const blob = (ref, file) => git('rev-parse', `${ref}:${file}`);
const read = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8');
const json = (file) => JSON.parse(read(file));
const req = (ok, code) => { if (!ok) throw new Error(code); };
const result = {
  schema_version: 'geox_mcft_cap09_ea5b1_external_evidence_binding_seam_governance_v1',
  status: 'FAIL', base_sha: BASE, exact_file_count: 0,
  database_write_count: 0, formal_evidence_write_count: 0,
  public_provider_request_count: 0, formal_window_started: false,
  mcft_cap09_completed: false,
};

try {
  req(BASE === EXPECTED_BASE, `EA5B1_BASE_MAIN_DRIFT:${BASE}`);
  const changed = git('diff', '--name-only', `${BASE}...HEAD`).split(/\r?\n/).filter(Boolean).sort();
  Object.assign(result, { changed_files: changed, exact_file_count: changed.length });
  req(JSON.stringify(changed) === JSON.stringify(EXPECT), `EA5B1_EXACT_NINE_FILE_BOUNDARY_FAIL:${JSON.stringify(changed)}`);

  for (const key of ['task','a1','a5','a5status','recovery','ea5a']) {
    req(blob(BASE, F[key]) === PINS[key], `EA5B1_PREDECESSOR_BLOB_DRIFT:${key}`);
  }
  for (const key of ['profile','a0window','selector','contWindow','externalA0Service','acceptance','authority']) {
    req(blob('HEAD', F[key]) === PINS[key], `EA5B1_IMPLEMENTATION_BLOB_DRIFT:${key}`);
  }
  req(blob(BASE, F.historicalA0Service) === PINS.historicalA0Service, 'EA5B1_CAP08_A0_BASE_BLOB_DRIFT');
  req(blob('HEAD', F.historicalA0Service) === PINS.historicalA0Service, 'EA5B1_CAP08_A0_FROZEN_CORE_REGRESSION');

  const amendment = read(F.a5);
  const amendmentStatus = json(F.a5status);
  const authority = json(F.authority);
  const profile = read(F.profile);
  const a0window = read(F.a0window);
  const selector = read(F.selector);
  const contWindow = read(F.contWindow);
  const externalA0Service = read(F.externalA0Service);
  const acceptance = read(F.acceptance);
  const workflow = read(F.workflow);

  req(amendment.includes('**EA5B** — External Formal Runtime Authority Profile + binding/profile implementation qualification') && amendment.includes('External Formal Runtime Authority Profile'), 'EA5B1_AMENDMENT05_EA5B_RULING_MISSING');
  req(amendmentStatus.next_legal_successor_if_effective === 'S6-EA5B-EXTERNAL-FORMAL-RUNTIME-AUTHORITY-PROFILE-IMPLEMENTATION', 'EA5B1_AMENDMENT05_SUCCESSOR_DRIFT');
  req(amendmentStatus.implementation_authority_if_effective?.additive_external_runtime_profile_authorized === true, 'EA5B1_ADDITIVE_PROFILE_NOT_AUTHORIZED');
  req(amendmentStatus.implementation_authority_if_effective?.historical_replay_contract_mutation_authorized === false, 'EA5B1_REPLAY_MUTATION_FORBIDDEN');

  req(authority.record_status === 'EA5B1_EXTERNAL_EVIDENCE_BINDING_SEAM_CANDIDATE_NOT_EFFECTIVE', 'EA5B1_AUTHORITY_STATUS_DRIFT');
  req(authority.base_main_sha === BASE, 'EA5B1_AUTHORITY_BASE_DRIFT');
  req(authority.predecessor_authorities?.amendment_05_blob_sha === PINS.a5 && authority.predecessor_authorities?.amendment_05_status_blob_sha === PINS.a5status, 'EA5B1_AUTHORITY_AM05_PIN_DRIFT');
  for (const [key, expected] of Object.entries({
    external_binding_profile: PINS.profile,
    a0_evidence_window: PINS.a0window,
    continuation_observation_selector: PINS.selector,
    continuation_evidence_window: PINS.contWindow,
    external_a0_evidence_window_service: PINS.externalA0Service,
    focused_acceptance: PINS.acceptance,
  })) req(authority.implementation_blobs?.[key] === expected, `EA5B1_AUTHORITY_IMPLEMENTATION_PIN_DRIFT:${key}`);

  req(authority.cap08_frozen_core_compatibility?.historical_a0_bootstrap_runtime_service_modified === false, 'EA5B1_CAP08_HISTORICAL_A0_MUTATION_FORBIDDEN');
  req(authority.cap08_frozen_core_compatibility?.historical_a0_bootstrap_runtime_service_required_blob === PINS.historicalA0Service, 'EA5B1_CAP08_HISTORICAL_A0_REQUIRED_BLOB_DRIFT');
  req(authority.cap08_frozen_core_compatibility?.external_a0_binding_preparation_is_additive === true, 'EA5B1_EXTERNAL_A0_ADDITIVE_SERVICE_REQUIRED');
  req(authority.cap08_frozen_core_compatibility?.external_a0_evidence_window_service_may_persist_bootstrap_state === false, 'EA5B1_EXTERNAL_A0_PERSISTENCE_FORBIDDEN');
  req(authority.cap08_frozen_core_compatibility?.external_a0_evidence_window_service_may_construct_external_a0_canonical_members === false, 'EA5B1_EXTERNAL_A0_CANONICAL_MEMBER_CONSTRUCTION_FORBIDDEN');

  const bindingValues = Object.values(authority.formal_binding_ids || {});
  req(bindingValues.length === 5 && new Set(bindingValues).size === 5, 'EA5B1_FIVE_UNIQUE_BINDINGS_REQUIRED');
  req(authority.soil_authority?.measurement_depth_mm === 100 && authority.soil_authority?.root_zone_representativeness === 'PARTIAL', 'EA5B1_SOIL_DEPTH_OR_REPRESENTATIVENESS_DRIFT');
  req(authority.soil_authority?.direct_state_equivalence === false && authority.soil_authority?.direct_field_equivalence === false && authority.soil_authority?.direct_root_zone_equivalence === false, 'EA5B1_SOIL_EQUIVALENCE_OVERCLAIM');
  req(authority.soil_authority?.observation_operator_id === 'POINT_100MM_TO_ROOT_ZONE_MEAN_H1_WITH_REPRESENTATIVENESS_V1', 'EA5B1_SOIL_OPERATOR_DRIFT');
  req(authority.soil_authority?.model_parameter_authority === 'MODEL_PRIOR_FROM_CAP08' && authority.soil_authority?.field_calibration_status === 'NOT_FIELD_CALIBRATED', 'EA5B1_MODEL_PRIOR_AUTHORITY_DRIFT');

  req(authority.implemented_boundary?.a0_evidence_window_accepts_explicit_soil_binding_authority === true, 'EA5B1_A0_WINDOW_SEAM_REQUIRED');
  req(authority.implemented_boundary?.external_a0_evidence_window_service_enforces_formal_soil_binding === true, 'EA5B1_EXTERNAL_A0_SERVICE_SEAM_REQUIRED');
  req(authority.implemented_boundary?.historical_cap08_frozen_a0_bootstrap_service_unchanged === true, 'EA5B1_CAP08_A0_FROZEN_ASSERTION_REQUIRED');
  req(authority.implemented_boundary?.continuation_selector_accepts_explicit_soil_binding_authority === true, 'EA5B1_CONTINUATION_SELECTOR_SEAM_REQUIRED');
  req(authority.implemented_boundary?.continuation_evidence_window_threads_explicit_soil_binding_authority === true, 'EA5B1_CONTINUATION_WINDOW_SEAM_REQUIRED');
  req(authority.not_implemented_in_ea5b1?.cap04_single_tick_service_input_threading === true, 'EA5B1_CAP04_THREADING_MUST_REMAIN_FUTURE');
  req(authority.success_effect_if_merged?.cap04_external_service_threading_effective === false, 'EA5B1_CAP04_THREADING_PREMATURE_EFFECT');
  req(authority.success_effect_if_merged?.external_package_formal_eligible === false && authority.success_effect_if_merged?.ea5c_authorized === false && authority.success_effect_if_merged?.formal_o00_start_authorized === false, 'EA5B1_PREMATURE_FORMAL_EFFECT');
  req(authority.next_legal_successor_if_effective === 'S6-EA5B2-CAP04-EXTERNAL-BINDING-SERVICE-THREADING', 'EA5B1_SUCCESSOR_DRIFT');

  const qualification = authority.qualification_requirements || {};
  req(qualification.historical_cap08_g3_core_regression_passes === true, 'EA5B1_CAP08_G3_SUCCESSOR_REGRESSION_REQUIRED');
  req(qualification.historical_cap01_first_20_behavioral_assertions_pass === true, 'EA5B1_CAP01_BEHAVIORAL_ASSERTIONS_REQUIRED');
  req(qualification.historical_cap01_repo_wide_scope_guard_already_stale_on_protected_base === true, 'EA5B1_CAP01_STALE_BASE_GUARD_FINDING_REQUIRED');
  req(qualification.ea5b1_introduces_no_historical_cap01_forbidden_scope_paths === true, 'EA5B1_CAP01_PR_SCOPE_NONREGRESSION_REQUIRED');
  req(qualification.historical_cap03_r4a_acceptance_passes === true, 'EA5B1_CAP03_R4A_REGRESSION_REQUIRED');

  for (const token of [
    'kbs_lter_variate25_vwc_100mm_v1',
    'kbs_lter_raw_hourly_rain_mm_v1',
    'kbs_lter_asce_short_reference_et_hourly_v1',
    'noaa_ncep_gfs_pgrb2_kbs_nearest_72h_v1',
    'noaa_ncep_gfs_asce_short_reference_et_same_cycle_72h_v1',
    'POINT_100MM_TO_ROOT_ZONE_MEAN_H1_WITH_REPRESENTATIVENESS_V1',
    'NEAR_SITE_POINT_SUPPORT', 'PARTIAL', 'MODEL_PRIOR_FROM_CAP08', 'NOT_FIELD_CALIBRATED',
  ]) req(profile.includes(token), `EA5B1_PROFILE_TOKEN_MISSING:${token}`);

  req(a0window.includes('authorized_soil_binding_id?: string'), 'EA5B1_A0_AUTHORIZED_BINDING_INPUT_MISSING');
  req(a0window.includes('SOIL_BINDING_NOT_AUTHORIZED') && a0window.includes('UNAUTHORIZED_BINDING_EXCLUDED'), 'EA5B1_A0_UNAUTHORIZED_BINDING_FAIL_CLOSED_MISSING');
  const compactA0Window = a0window.replace(/\s+/g, '');
  req(compactA0Window.includes('...(authorizedSoilBindingId!==undefined?{authorized_soil_binding_id:authorizedSoilBindingId}:{})'), 'EA5B1_A0_OPTIONAL_SEMANTIC_FIELD_MISSING');
  req(selector.includes('authorized_binding_id?: string'), 'EA5B1_SELECTOR_AUTHORIZED_BINDING_INPUT_MISSING');
  req(selector.includes('?? ASSIMILATED_CONTINUATION_OBSERVATION_BINDING_ID_V1'), 'EA5B1_SELECTOR_REPLAY_DEFAULT_MISSING');
  req(selector.includes('record.binding_id !== input.authorized_binding_id'), 'EA5B1_SELECTOR_CALLER_BINDING_ENFORCEMENT_MISSING');
  req(contWindow.includes('authorized_soil_observation_binding_id?: string') && contWindow.includes('authorized_binding_id: input.authorized_soil_observation_binding_id'), 'EA5B1_CONTINUATION_WINDOW_THREADING_MISSING');
  req(externalA0Service.includes('MCFT_CAP09_EXTERNAL_FORMAL_SOIL_BINDING_ID_V1'), 'EA5B1_EXTERNAL_A0_EXACT_FORMAL_BINDING_MISSING');
  req(externalA0Service.includes('authorized_soil_binding_id:') && externalA0Service.includes('buildFrozenEvidenceWindowV1'), 'EA5B1_EXTERNAL_A0_WINDOW_PREPARATION_MISSING');

  for (const fileText of [profile,a0window,selector,contWindow,externalA0Service]) {
    req(!/DATABASE_URL|POSTGRES(?:QL)?|NEON_DATABASE_URL|\bfetch\s*\(|https?:\/\//.test(fileText), 'EA5B1_NETWORK_OR_DATABASE_SURFACE_FORBIDDEN');
  }
  req(!/formal_evidence_write|INSERT\s+INTO|public\.facts/i.test(profile + a0window + selector + contWindow + externalA0Service), 'EA5B1_FORMAL_WRITE_SURFACE_FORBIDDEN');

  for (const token of [
    'same-scope historical C8 soil',
    'REJECTED_UNAUTHORIZED_BINDING',
    'SOIL_BINDING_NOT_AUTHORIZED',
    'historical Replay binding behavior',
    'blank binding authority fails closed',
    'CAP08-safe External A0 Evidence service',
  ]) req(acceptance.includes(token), `EA5B1_ACCEPTANCE_CASE_MISSING:${token}`);
  req(acceptance.includes('assert.equal(pass, 8)'), 'EA5B1_ACCEPTANCE_PASS_COUNT_DRIFT');

  req(workflow.includes(F.externalA0Service), 'EA5B1_EXTERNAL_A0_SERVICE_WORKFLOW_PATH_MISSING');
  req(!workflow.includes("- 'apps/server/src/runtime/twin_runtime/a0_bootstrap_runtime_service_v1.ts'"), 'EA5B1_HISTORICAL_A0_SERVICE_MUST_NOT_BE_PR_PATH');
  req(workflow.includes('ACCEPTANCE_MCFT_CAP_08_S2_G3_BOUNDARY.cjs'), 'EA5B1_CAP08_G3_SUCCESSOR_REGRESSION_WORKFLOW_MISSING');
  req(workflow.includes('ACCEPTANCE_MCFT_CAP_09_EA5B_EXTERNAL_EVIDENCE_BINDING_SEAM.ts'), 'EA5B1_FOCUSED_ACCEPTANCE_WORKFLOW_MISSING');
  req(workflow.includes('ACCEPTANCE_MCFT_CAP_01_A0_RUNTIME.ts'), 'EA5B1_CAP01_REGRESSION_WORKFLOW_MISSING');
  req(workflow.includes('ACCEPTANCE_MCFT_CAP_03_R4_A_EVIDENCE_CLASSIFICATION.ts'), 'EA5B1_CAP03_REGRESSION_WORKFLOW_MISSING');
  req(workflow.includes("pass_count=$(grep -c '^PASS ' acceptance-output/EA5B1_CAP01_A0_REGRESSION.log || true)"), 'EA5B1_CAP01_PASS_COUNT_ADJUDICATION_MISSING');
  req(workflow.includes("test \"$pass_count\" -eq 20"), 'EA5B1_CAP01_EXACT_20_BEHAVIORAL_PASSES_REQUIRED');
  req(workflow.includes('ACCEPTANCE_MCFT_CAP_01_A0_RUNTIME.ts:199:10') && workflow.includes('true !== false'), 'EA5B1_CAP01_EXACT_STALE_FAILURE_SIGNATURE_REQUIRED');
  req(workflow.includes('5d17e6ad9944376bbb5a71c9d801aa4472afe592..."$MCFT_BASE_SHA"'), 'EA5B1_CAP01_PROTECTED_BASE_STALE_GUARD_REPROOF_MISSING');
  req(workflow.includes('git diff --name-only "$MCFT_BASE_SHA"...HEAD'), 'EA5B1_CAP01_PR_DELTA_SCOPE_GUARD_MISSING');
  req(workflow.includes('pnpm --filter @geox/server run typecheck'), 'EA5B1_TYPECHECK_WORKFLOW_MISSING');
  req(!/DATABASE_URL|POSTGRES(?:QL)?|NEON_DATABASE_URL/.test(workflow), 'EA5B1_DATABASE_SECRET_FORBIDDEN');

  Object.assign(result, {
    status: 'PASS',
    authority_blob: blob('HEAD', F.authority),
    external_binding_profile_blob: blob('HEAD', F.profile),
    external_a0_evidence_window_service_blob: blob('HEAD', F.externalA0Service),
    historical_a0_bootstrap_runtime_service_blob: blob('HEAD', F.historicalA0Service),
    binding_seam_qualified: true,
    cap08_g3_successor_regression_required: true,
    cap08_frozen_a0_bootstrap_core_unchanged: true,
    replay_default_regression_required: true,
    cap01_behavioral_regression_mode: 'EXACT_20_BEHAVIORAL_ASSERTIONS_PLUS_PROTECTED_BASE_STALE_SCOPE_GUARD_ADJUDICATION',
    cap04_external_service_threading_effective: false,
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
