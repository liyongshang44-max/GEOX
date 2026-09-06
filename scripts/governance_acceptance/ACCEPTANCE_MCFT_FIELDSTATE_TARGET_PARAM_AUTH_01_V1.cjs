'use strict';

const fs = require('fs');
const cp = require('child_process');

const BASE = 'ca56d60e3d927ccda5d1f28255e195575bf7a487';
const INVENTORY = 'docs/digital_twin/mcft/field_state/GEOX-MCFT-FIELDSTATE-TARGET-PARAM-AUTH-01-INVENTORY-V1.json';
const REALITY = 'docs/digital_twin/mcft/GEOX-MCFT-00-REALITY-BINDING.json';
const MATRIX = 'docs/digital_twin/mcft/GEOX-MCFT-00-CONFIGURATION-BINDING-MATRIX.json';
const ROOTING = 'fixtures/mcft/water_state/configuration_context_source_v1.json';
const COMPILE = 'apps/server/src/runtime/twin_runtime/runtime_config_compile_service_v1.ts';
const CONTINUATION = 'apps/server/src/domain/twin_runtime/continuation_runtime_config_v1.ts';
const BUILDER = 'apps/server/src/runtime/twin_runtime/assimilated_continuation_record_set_builder_v2.ts';

function fail(code) { throw new Error(code); }
function check(condition, code) { if (!condition) fail(code); }
function readJson(path) { return JSON.parse(fs.readFileSync(path, 'utf8')); }
function read(path) { return fs.readFileSync(path, 'utf8'); }
function git(args) { return cp.execFileSync('git', args, { encoding: 'utf8' }).trim(); }

function validateAuthorityEnvelopeContract(contract) {
  const required = [
    'subject_identity','field','zone','crop','season','effective_biological_or_rooting_stage',
    'effective_from','effective_until','available_at','value','unit','vertical_support',
    'measurement_or_estimation_method','source_provenance','source_authority',
    'calibration_or_validation_evidence','uncertainty_or_confidence','supersession_semantics','exact_authority_refs'
  ];
  check(JSON.stringify(contract.required_fields) === JSON.stringify(required), 'AUTHORITY_REQUIRED_FIELDS_MISMATCH');
  check(contract.admissibility_decision_basis === 'COMPLETE_AUTHORITY_ENVELOPE_NOT_SINGLE_STATUS_LABEL', 'AUTHORITY_ENVELOPE_DECISION_BASIS_REQUIRED');
  check(contract.field_calibrated_only_rule === 'FORBIDDEN', 'FIELD_CALIBRATED_ONLY_RULE_MUST_BE_FORBIDDEN');
  check(Array.isArray(contract.potential_source_classes) && contract.potential_source_classes.includes('LABORATORY_MEASUREMENT'), 'LAB_SOURCE_CLASS_MISSING');
  check(contract.potential_source_classes.includes('TARGET_SPECIFIC_CHARACTERIZATION'), 'TARGET_CHARACTERIZATION_CLASS_MISSING');
  check(contract.potential_source_classes.includes('GOVERNED_TARGET_SPECIFIC_MODEL_ESTIMATE'), 'GOVERNED_MODEL_ESTIMATE_CLASS_MISSING');
}

function validatePathB(inventory) {
  const r = inventory.inventory_result;
  check(r.path === 'PATH_B', 'PATH_B_REQUIRED');
  check(r.real_target_parameter_authority === 'ABSENT', 'REAL_TARGET_AUTHORITY_MUST_BE_ABSENT');
  check(r.source_acquisition_gap === 'IDENTIFIED', 'SOURCE_ACQUISITION_GAP_REQUIRED');
  check(r.software_authority_substrate === 'READY', 'SOFTWARE_AUTHORITY_SUBSTRATE_NOT_READY');
  check(r.real_target_source === 'NOT_YET_ACQUIRED', 'REAL_TARGET_SOURCE_STATUS_INVALID');
  for (const p of inventory.current_parameter_inventory) {
    check(p.current_truth_class === 'CONTROLLED_SYNTHETIC', `PARAM_NOT_SYNTHETIC:${p.parameter_id}`);
    check(p.real_target_authority_ref === null, `INVENTED_TARGET_AUTHORITY_REF:${p.parameter_id}`);
    check(p.real_target_authority_status === 'ABSENT', `TARGET_AUTHORITY_STATUS_INVALID:${p.parameter_id}`);
    check(typeof p.source_gap_id === 'string' && p.source_gap_id.length > 0, `SOURCE_GAP_REQUIRED:${p.parameter_id}`);
  }
  const root = inventory.current_parameter_inventory.find((p) => p.parameter_id === 'root_zone_depth_mm');
  check(root && root.dynamic_scope_required === true, 'ROOT_ZONE_DEPTH_MUST_NOT_BE_PERMANENT_FIELD_CONSTANT');
  for (const axis of ['field','zone','crop','season','effective_interval','rooting_or_biological_stage_where_relevant']) {
    check(root.required_scope_axes.includes(axis), `ROOT_ZONE_SCOPE_AXIS_MISSING:${axis}`);
  }
}

function main() {
  const liveMain = git(['rev-parse', 'origin/main']);
  check(liveMain === BASE, `PROTECTED_MAIN_DRIFT:${liveMain}`);

  const inventory = readJson(INVENTORY);
  const reality = readJson(REALITY);
  const matrix = readJson(MATRIX);
  const rooting = readJson(ROOTING);
  const compile = read(COMPILE);
  const continuation = read(CONTINUATION);
  const builder = read(BUILDER);

  check(inventory.frontier_id === 'MCFT-FIELDSTATE-TARGET-PARAM-AUTH-01', 'FRONTIER_ID_MISMATCH');
  check(inventory.authoritative_successor_base === BASE, 'SUCCESSOR_BASE_MISMATCH');
  check(inventory.forbidden_reopens.includes('#3514') && inventory.forbidden_reopens.includes('#3524') && inventory.forbidden_reopens.includes('QINF'), 'CLOSED_FRONTIER_GUARD_MISSING');

  const scope = reality.semantic_payload.scope;
  for (const [key, value] of Object.entries({tenant_id:'tenantA',project_id:'projectA',group_id:'groupA',field_id:'field_c8_demo',season_id:'season_2026_c8_corn',zone_id:'zone_mcft_c8_water_001'})) {
    check(scope[key] === value, `REALITY_SCOPE_MISMATCH:${key}`);
  }
  check(reality.semantic_payload.crop_binding.crop_code === 'corn', 'CROP_SCOPE_MISMATCH');
  check(reality.semantic_payload.reality_scope_class === 'CONTROLLED_SYNTHETIC_REPLAY_PROXY', 'REALITY_NOT_SYNTHETIC_PROXY');
  check(reality.semantic_payload.reality_classification.field_truth_mode === 'CONTROLLED_REPLAY_FIELD_PROXY', 'FIELD_TRUTH_MODE_MISMATCH');

  check((matrix.determinism_hash || matrix.configuration_matrix_hash) === 'sha256:381ef166454c7b698c6641fadc5d08019fecff127e9529a4c58a1f09d9e1fef5', 'CONFIG_MATRIX_HASH_MISMATCH');
  const def = matrix.configuration_source_definitions.find((x) => x.configuration_source_id === 'mcft_soil_hydraulic_config_c8_v1');
  check(def, 'SOIL_HYDRAULIC_DEFINITION_MISSING');
  check(def.provenance_class === 'CONTROLLED_SYNTHETIC_GOVERNED_CONFIG', 'SOIL_HYDRAULIC_PROVENANCE_NOT_SYNTHETIC');
  check(def.proof_scope === 'GOVERNANCE_IDENTITY_ONLY', 'SOIL_HYDRAULIC_PROOF_SCOPE_WIDENED');
  check(def.parameters.root_zone_depth_mm.value === 300, 'ROOT_ZONE_DEPTH_CHANGED');
  check(def.parameters.field_capacity_fraction.value === 0.3, 'FIELD_CAPACITY_CHANGED');
  check(def.parameters.wilting_point_fraction.value === 0.12, 'WILTING_POINT_CHANGED');
  check(def.parameters.saturation_fraction.value === 0.45, 'SATURATION_CHANGED');
  check(def.parameters.drainage_coefficient_per_hour.value === 0.03, 'DRAINAGE_CHANGED');
  check(def.parameters.runoff_fraction.value === 0.05, 'RUNOFF_CHANGED');
  check(def.limitations.includes('controlled synthetic') && def.limitations.includes('not field-calibrated'), 'SYNTHETIC_LIMITATIONS_MISSING');

  const binding = matrix.bindings.find((x) => x.binding_id === 'soil_hydraulic_config_c8_v1');
  check(binding && binding.determinism_hash === 'sha256:3d6e3d8b52a9736ff6898487cacbbffdf71578cca693754ab34cb484e5bc3082', 'SOIL_HYDRAULIC_BINDING_HASH_MISMATCH');
  check(binding.applicability.zone_id === 'zone_mcft_c8_water_001', 'SOIL_HYDRAULIC_ZONE_SCOPE_MISMATCH');

  check(rooting.context_class === 'CONFIGURATION_DERIVED_CONTEXT', 'ROOTING_CONTEXT_CLASS_MISMATCH');
  check(rooting.limitations.includes('controlled synthetic configuration schedule'), 'ROOTING_SYNTHETIC_LIMITATION_MISSING');
  check(rooting.limitations.includes('not field-verified phenology'), 'ROOTING_FIELD_VERIFICATION_LIMITATION_MISSING');

  validateAuthorityEnvelopeContract(inventory.target_parameter_authority_contract);
  validatePathB(inventory);

  check(compile.includes('configuration_matrix_hash: MCFT_CAP_01_EXPECTED_AUTHORITY_V1.configuration_matrix_hash'), 'RUNTIME_CONFIG_MATRIX_HASH_BINDING_MISSING');
  check(compile.includes('soil_hydraulic_configuration_refs: soilRefs'), 'RUNTIME_CONFIG_SOIL_REF_BINDING_MISSING');
  check(continuation.includes('CONTINUATION_SOIL_HYDRAULIC_BINDING_REF_V1 = "soil_hydraulic_config_c8_v1"'), 'CONTINUATION_SOIL_BINDING_REF_MISMATCH');
  check(continuation.includes('CONTINUATION_SOIL_HYDRAULIC_BINDING_HASH_V1 = "sha256:3d6e3d8b52a9736ff6898487cacbbffdf71578cca693754ab34cb484e5bc3082"'), 'CONTINUATION_SOIL_BINDING_HASH_MISMATCH');
  check(continuation.includes('parameter_class: "CONTROLLED_SYNTHETIC"'), 'CONTINUATION_PARAMETER_CLASS_NOT_SYNTHETIC');
  check(continuation.includes('field_calibration_status: "NOT_FIELD_CALIBRATED"'), 'CONTINUATION_CALIBRATION_STATUS_CHANGED');
  check(builder.includes('runtime_config_ref: input.runtime_config.object_id'), 'STATE_RUNTIME_CONFIG_REF_BINDING_MISSING');
  check(builder.includes('runtime_config_hash: input.runtime_config.determinism_hash'), 'STATE_RUNTIME_CONFIG_HASH_BINDING_MISSING');
  check(builder.includes('const rootDepth = config.soil_hydraulic_snapshot.root_zone_depth_mm;'), 'STATE_ROOT_DEPTH_CONSUMPTION_MISSING');
  check(builder.includes('const fieldCapacityStorage = config.soil_hydraulic_snapshot.field_capacity_storage_mm;'), 'STATE_FIELD_CAPACITY_CONSUMPTION_MISSING');
  check(builder.includes('buildMember("twin_state_estimate_v1"'), 'TWIN_STATE_ESTIMATE_BINDING_TARGET_MISSING');

  const prohibited = inventory.prohibited_shortcuts;
  for (const item of ['synthetic constant relabeling','invented calibration','invented provenance','scope widening','cross-field authority reuse','cross-zone authority reuse']) {
    check(prohibited.includes(item), `PROHIBITED_SHORTCUT_MISSING:${item}`);
  }

  const ceiling = inventory.authority_ceiling;
  check(ceiling.production_runtime === 'NOT_AUTHORIZED', 'PRODUCTION_RUNTIME_CEILING_WIDENED');
  check(ceiling.production_owner_acquisition_activation === 'NOT_AUTHORIZED', 'PRODUCTION_OWNER_CEILING_WIDENED');
  check(ceiling.formal_v5 === 'NOT_ARMED' && ceiling.A0 === 'NOT_AUTHORIZED' && ceiling.O00_O23 === 'NOT_STARTED', 'FORMAL_CEILING_WIDENED');
  check(ceiling.adr_semantic_modification === 0 && ceiling.b_line_semantic_modification === 0 && ceiling.adr_provider_implementation === 0 && ceiling.b_line_integration === 0, 'CROSS_LINE_MODIFICATION_FORBIDDEN');

  console.log(JSON.stringify({
    frontier: inventory.frontier_id,
    protected_main: liveMain,
    path: inventory.inventory_result.path,
    real_target_parameter_authority: inventory.inventory_result.real_target_parameter_authority,
    source_acquisition_gap: inventory.inventory_result.source_acquisition_gap,
    software_authority_substrate: inventory.inventory_result.software_authority_substrate,
    real_target_source: inventory.inventory_result.real_target_source,
    synthetic_values_unchanged: true,
    twin_state_exact_binding_substrate: 'VERIFIED',
    production_runtime: ceiling.production_runtime,
    cross_line_semantic_modification: 0
  }, null, 2));
}

main();
