// scripts/governance_acceptance/mcft00/MCFT00_PACKAGE_VALIDATOR.cjs
// Purpose: pure semantic validation for the MCFT-00 governance package.
// Boundary: no filesystem, process, network, database, facts, pointer, or canonical persistence writes.
'use strict';

const {
  hash,
  nonEmpty,
  arrayNonEmpty,
  approx,
  geometryValidationCodes,
  canonicalGeometry,
  polygonAreaM2,
  sha256Bytes,
  scanForbiddenHashInputs,
  semanticTopProjection,
  withoutHash,
} = require('./MCFT00_GEOMETRY_AND_HASH.cjs');

const STAGE = Object.freeze({
  SCOPE: 'SCOPE_VALIDATION',
  MODE: 'RUNTIME_MODE_VALIDATION',
  GEOMETRY: 'GEOMETRY_VALIDATION',
  GEOMETRY_HASH: 'GEOMETRY_HASH_VALIDATION',
  GEOMETRY_AREA: 'GEOMETRY_AREA_VALIDATION',
  ROOT: 'ROOT_ZONE_VALIDATION',
  SOURCE: 'SOURCE_BINDING_VALIDATION',
  AUTHORITY: 'AUTHORITY_REFERENCE_VALIDATION',
  CONFIG: 'CONFIG_BINDING_VALIDATION',
  SOIL: 'SOIL_CONFIGURATION_VALIDATION',
  CROP: 'CROP_CONFIGURATION_VALIDATION',
  ACTION: 'ACTION_SEMANTICS_VALIDATION',
  FEEDBACK: 'ACTION_FEEDBACK_VALIDATION',
  TIME: 'REPLAY_TIME_VALIDATION',
  CONTAMINATION: 'CONTAMINATION_GUARD',
  DETERMINISM: 'DETERMINISM_VALIDATION',
  VERSIONING: 'VERSIONING_VALIDATION',
  BOUNDARY: 'CANONICAL_BOUNDARY',
});

function finding(reasonCode, stage, details = null) {
  return { reason_code: reasonCode, stage, details };
}

function uniqueFindings(findings) {
  const seen = new Set();
  return findings.filter((item) => {
    const key = `${item.reason_code}|${item.stage}|${JSON.stringify(item.details)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function duplicateValues(values) {
  const seen = new Set();
  const duplicates = new Set();
  for (const value of values) {
    if (seen.has(value)) duplicates.add(value);
    seen.add(value);
  }
  return [...duplicates];
}

function parseInstant(value) {
  const milliseconds = Date.parse(value);
  return Number.isFinite(milliseconds) ? milliseconds : null;
}

function deriveAvailableToRuntimeAt(role, record, releasePolicy) {
  const rule = releasePolicy?.role_rules?.[role];
  if (!rule) return { finding: finding('REPLAY_RELEASE_ROLE_RULE_MISSING', STAGE.TIME, role) };
  if (rule.output_field !== 'available_to_runtime_at' || rule.operator !== 'MAX_VALID_INSTANT') {
    return { finding: finding('REPLAY_RELEASE_RULE_INVALID', STAGE.TIME, role) };
  }
  if (!arrayNonEmpty(rule.input_fields)) {
    return { finding: finding('REPLAY_RELEASE_INPUTS_MISSING', STAGE.TIME, role) };
  }
  if (rule.input_fields.includes(rule.output_field)) {
    return { finding: finding('REPLAY_RELEASE_RULE_CIRCULAR', STAGE.TIME, role) };
  }
  const instants = [];
  for (const inputField of rule.input_fields) {
    const parsed = parseInstant(record?.[inputField]);
    if (parsed === null) return { finding: finding('REPLAY_RELEASE_SOURCE_TIME_MISSING', STAGE.TIME, `${role}:${inputField}`) };
    instants.push(parsed);
  }
  return { available_to_runtime_at: new Date(Math.max(...instants)).toISOString() };
}

function classifyEvidenceForTick(record, logicalTickTime) {
  const tick = parseInstant(logicalTickTime);
  const observed = parseInstant(record?.observed_at);
  const available = parseInstant(record?.available_to_runtime_at);
  if (tick === null || observed === null || available === null) {
    return { finding: finding('REPLAY_CLASSIFICATION_TIME_INVALID', STAGE.TIME) };
  }
  if (observed > tick) return { classification: 'FUTURE', eligible_for_tick: false };
  if (available > tick) return { classification: 'LATE', eligible_for_tick: false };
  return { classification: 'ON_TIME', eligible_for_tick: true };
}

function validateIdempotency(existingBinding, candidateBinding) {
  if (!existingBinding || !candidateBinding || existingBinding.binding_id !== candidateBinding.binding_id) {
    return { status: 'NOT_SAME_ID', findings: [] };
  }
  if (existingBinding.determinism_hash === candidateBinding.determinism_hash) {
    return { status: 'IDEMPOTENT_REPLAY', findings: [] };
  }
  return {
    status: 'IDEMPOTENCY_CONFLICT',
    findings: [finding('IDEMPOTENCY_CONFLICT', STAGE.DETERMINISM)],
  };
}

function validatePackage(pkg, geometryBytes) {
  const findings = [];
  const reality = pkg?.reality || {};
  const semantic = reality.semantic_payload || {};
  const source = pkg?.source || {};
  const config = pkg?.config || {};
  const scope = semantic.scope || {};

  const scopeCodes = {
    tenant_id: 'MISSING_TENANT_ID',
    project_id: 'MISSING_PROJECT_ID',
    group_id: 'MISSING_GROUP_ID',
    field_id: 'MISSING_FIELD_ID',
    season_id: 'MISSING_SEASON_ID',
    zone_id: 'MISSING_ZONE_ID',
  };
  for (const [key, code] of Object.entries(scopeCodes)) {
    if (!nonEmpty(scope[key])) findings.push(finding(code, STAGE.SCOPE));
  }
  if (semantic.active_scope_count !== 1) findings.push(finding('SECOND_ACTIVE_REALITY_SCOPE', STAGE.SCOPE));
  if (semantic.runtime_mode === 'CONTROLLED_REPLAY') findings.push(finding('INVALID_RUNTIME_MODE_ENUM', STAGE.MODE));
  else if (semantic.runtime_mode !== 'REPLAY') findings.push(finding('MCFT00_RUNTIME_MODE_NOT_REPLAY', STAGE.MODE));
  if (Object.hasOwn(semantic.crop_binding || {}, 'crop_stage') || (semantic.crop_binding?.identity_fields || []).includes('crop_stage')) {
    findings.push(finding('CROP_STAGE_FORBIDDEN_AS_IDENTITY', STAGE.SCOPE));
  }

  const geometryCodes = geometryValidationCodes(pkg?.geometry);
  for (const code of geometryCodes) findings.push(finding(code, STAGE.GEOMETRY));
  if (geometryCodes.length === 0) {
    const canonical = canonicalGeometry(pkg.geometry);
    const semanticHash = hash(canonical);
    if (semantic.geometry_binding?.geometry_semantic_hash !== semanticHash) findings.push(finding('GEOMETRY_SEMANTIC_HASH_MISMATCH', STAGE.GEOMETRY_HASH));
    const area = polygonAreaM2(canonical);
    if (!(area > 0)) findings.push(finding('GEOMETRY_DERIVED_AREA_NON_POSITIVE', STAGE.GEOMETRY_AREA));
    if (!approx(semantic.geometry_binding?.derived_area_m2, area)) findings.push(finding('DERIVED_AREA_MISMATCH', STAGE.GEOMETRY_AREA));
  }
  if (semantic.geometry_binding?.geometry_truth_status !== 'CONTROLLED_SYNTHETIC') findings.push(finding('GEOMETRY_TRUTH_OVERCLAIM', STAGE.GEOMETRY));
  if (semantic.geometry_binding?.file_sha256 !== `sha256:${sha256Bytes(geometryBytes)}`) findings.push(finding('GEOMETRY_FILE_HASH_MISMATCH', STAGE.GEOMETRY_HASH));
  if (semantic.geometry_binding?.canonicalization_id !== 'GEOX_MCFT_GEOJSON_CANONICALIZATION_V1') findings.push(finding('GEOMETRY_CANONICALIZATION_ID_INVALID', STAGE.GEOMETRY_HASH));

  const root = semantic.root_zone_binding || {};
  if (root.top_depth_mm !== 0 || root.bottom_depth_mm !== 300 || root.total_depth_mm !== 300) findings.push(finding('ROOT_ZONE_DEPTH_INVALID', STAGE.ROOT));
  const layers = Array.isArray(root.layers) ? [...root.layers].sort((left, right) => left.top_depth_mm - right.top_depth_mm) : [];
  if (!layers.length) findings.push(finding('ROOT_ZONE_LAYERS_MISSING', STAGE.ROOT));
  const duplicateLayerIds = duplicateValues(layers.map((layer) => layer.layer_id));
  if (duplicateLayerIds.length || layers.some((layer) => !nonEmpty(layer.layer_id))) findings.push(finding('ROOT_ZONE_LAYER_ID_INVALID', STAGE.ROOT));
  let cursor = root.top_depth_mm;
  let weight = 0;
  for (const layer of layers) {
    if (![layer.top_depth_mm, layer.bottom_depth_mm, layer.weight].every(Number.isFinite) || layer.top_depth_mm >= layer.bottom_depth_mm || layer.top_depth_mm < root.top_depth_mm || layer.bottom_depth_mm > root.bottom_depth_mm) {
      findings.push(finding('ROOT_ZONE_LAYER_BOUNDS_INVALID', STAGE.ROOT));
      continue;
    }
    if (layer.top_depth_mm > cursor) findings.push(finding('ROOT_ZONE_LAYER_GAP', STAGE.ROOT));
    if (layer.top_depth_mm < cursor) findings.push(finding('ROOT_ZONE_LAYER_OVERLAP', STAGE.ROOT));
    cursor = Math.max(cursor, layer.bottom_depth_mm);
    weight += layer.weight;
  }
  if (cursor < root.bottom_depth_mm) findings.push(finding('ROOT_ZONE_LAYER_GAP', STAGE.ROOT));
  if (!approx(weight, 1, 1e-9)) findings.push(finding('ROOT_ZONE_WEIGHT_SUM_INVALID', STAGE.ROOT));
  const sensor = root.sensor_support || {};
  if (!(Number.isFinite(sensor.nominal_depth_mm) && sensor.nominal_depth_mm >= root.top_depth_mm && sensor.nominal_depth_mm <= root.bottom_depth_mm)) findings.push(finding('SENSOR_DEPTH_OUTSIDE_ROOT_ZONE', STAGE.ROOT));
  if (sensor.spatial_support !== 'POINT' || sensor.root_zone_representativeness !== 'PARTIAL') findings.push(finding('SENSOR_SUPPORT_INVALID', STAGE.ROOT));
  if (sensor.direct_state_equivalence !== false) findings.push(finding('POINT_OBSERVATION_DIRECT_STATE_FORBIDDEN', STAGE.ROOT));

  const sourceBindings = Array.isArray(source.bindings) ? source.bindings : [];
  const sourceDefinitions = Array.isArray(source.source_definitions) ? source.source_definitions : [];
  const adapterDefinitions = Array.isArray(source.ingress_adapter_definitions) ? source.ingress_adapter_definitions : [];
  const sourceByRole = new Map(sourceBindings.map((binding) => [binding.source_role, binding]));
  const sourceDefinitionById = new Map(sourceDefinitions.map((definition) => [definition.source_id, definition]));
  const adapterDefinitionById = new Map(adapterDefinitions.map((definition) => [definition.ingress_adapter_id, definition]));
  const requiredSourceRoles = ['SOIL_MOISTURE_OBSERVATION', 'RAINFALL_OBSERVATION', 'FUTURE_WEATHER_ASSUMPTION', 'HISTORICAL_ET0_INPUT', 'FUTURE_ET0_ASSUMPTION', 'APPROVED_IRRIGATION_PLAN', 'IRRIGATION_EXECUTION_EVIDENCE'];
  for (const role of requiredSourceRoles) if (!sourceByRole.has(role)) findings.push(finding(`SOURCE_ROLE_MISSING_${role}`, STAGE.SOURCE));
  if (duplicateValues(sourceBindings.map((binding) => binding.binding_id)).length) findings.push(finding('SOURCE_BINDING_ID_DUPLICATE', STAGE.AUTHORITY));
  if (duplicateValues(sourceBindings.map((binding) => binding.source_role)).length) findings.push(finding('SOURCE_ROLE_DUPLICATE', STAGE.AUTHORITY));
  if (duplicateValues(sourceDefinitions.map((definition) => definition.source_id)).length) findings.push(finding('SOURCE_DEFINITION_ID_DUPLICATE', STAGE.AUTHORITY));
  if (duplicateValues(adapterDefinitions.map((definition) => definition.ingress_adapter_id)).length) findings.push(finding('INGRESS_ADAPTER_ID_DUPLICATE', STAGE.AUTHORITY));

  for (const definition of sourceDefinitions) {
    if (!nonEmpty(definition.source_id) || !nonEmpty(definition.source_kind) || !nonEmpty(definition.source_version) || !nonEmpty(definition.proof_scope)) findings.push(finding('SOURCE_DEFINITION_INCOMPLETE', STAGE.AUTHORITY));
    if (definition.source_semantic_hash !== hash(withoutHash(definition, 'source_semantic_hash'))) findings.push(finding('SOURCE_DEFINITION_HASH_MISMATCH', STAGE.DETERMINISM));
  }
  for (const definition of adapterDefinitions) {
    if (definition.ingress_adapter_kind !== 'REPLAY_ADAPTER' || !Number.isInteger(definition.ingress_adapter_version) || !nonEmpty(definition.input_record_type) || !nonEmpty(definition.output_record_type) || !nonEmpty(definition.release_policy_id) || !arrayNonEmpty(definition.limitations)) {
      findings.push(finding('INGRESS_ADAPTER_DEFINITION_INCOMPLETE', STAGE.AUTHORITY));
    }
    if (definition.adapter_semantic_hash !== hash(withoutHash(definition, 'adapter_semantic_hash'))) findings.push(finding('INGRESS_ADAPTER_HASH_MISMATCH', STAGE.DETERMINISM));
  }
  for (const binding of sourceBindings) {
    for (const key of source.common_contract?.required_fields || []) {
      if (!Object.hasOwn(binding, key) || binding[key] === null || binding[key] === '' || (Array.isArray(binding[key]) && binding[key].length === 0)) findings.push(finding(`SOURCE_BINDING_FIELD_MISSING_${key.toUpperCase()}`, STAGE.SOURCE));
    }
    if (binding.origin_source_id === binding.ingress_adapter_id) findings.push(finding('ORIGIN_AND_INGRESS_IDENTITY_CONFLATED', STAGE.SOURCE));
    if (binding.ingress_adapter_kind !== 'REPLAY_ADAPTER') findings.push(finding('REPLAY_ADAPTER_KIND_INVALID', STAGE.SOURCE));
    const sourceDefinition = sourceDefinitionById.get(binding.origin_source_id);
    if (!sourceDefinition) findings.push(finding('ORIGIN_SOURCE_DEFINITION_MISSING', STAGE.AUTHORITY, binding.binding_id));
    else {
      if (sourceDefinition.source_kind !== binding.origin_source_kind) findings.push(finding('ORIGIN_SOURCE_KIND_MISMATCH', STAGE.AUTHORITY, binding.binding_id));
      if (sourceDefinition.source_version !== binding.source_version) findings.push(finding('ORIGIN_SOURCE_VERSION_MISMATCH', STAGE.AUTHORITY, binding.binding_id));
    }
    const adapterDefinition = adapterDefinitionById.get(binding.ingress_adapter_id);
    if (!adapterDefinition) findings.push(finding('INGRESS_ADAPTER_DEFINITION_MISSING', STAGE.AUTHORITY, binding.binding_id));
    else {
      if (adapterDefinition.ingress_adapter_kind !== binding.ingress_adapter_kind) findings.push(finding('INGRESS_ADAPTER_KIND_MISMATCH', STAGE.AUTHORITY, binding.binding_id));
      if (adapterDefinition.output_record_type !== binding.evidence_record_type) findings.push(finding('INGRESS_ADAPTER_OUTPUT_TYPE_MISMATCH', STAGE.AUTHORITY, binding.binding_id));
      if (adapterDefinition.release_policy_id !== binding.availability_semantics?.release_policy_id) findings.push(finding('INGRESS_ADAPTER_RELEASE_POLICY_MISMATCH', STAGE.AUTHORITY, binding.binding_id));
    }
    if (!arrayNonEmpty(binding.eligible_downstream_uses) || !arrayNonEmpty(binding.forbidden_downstream_uses) || !arrayNonEmpty(binding.limitations)) findings.push(finding('SOURCE_BINDING_GOVERNANCE_METADATA_INCOMPLETE', STAGE.SOURCE));
    if (!arrayNonEmpty(binding.availability_semantics?.derivation_inputs) || binding.availability_semantics.derivation_inputs.includes('available_to_runtime_at')) findings.push(finding('SOURCE_BINDING_AVAILABILITY_INVALID', STAGE.TIME, binding.binding_id));
    if (binding.determinism_hash !== hash(withoutHash(binding))) findings.push(finding('SOURCE_BINDING_HASH_MISMATCH', STAGE.DETERMINISM, binding.binding_id));
  }

  const soilObservation = sourceByRole.get('SOIL_MOISTURE_OBSERVATION');
  if (soilObservation?.source_unit !== 'percent_vwc') findings.push(finding('SOIL_MOISTURE_UNIT_AMBIGUOUS', STAGE.SOURCE));
  if (soilObservation?.conversion_rule?.id !== 'PERCENT_TO_FRACTION_V1') findings.push(finding('SOIL_MOISTURE_CONVERSION_MISSING', STAGE.SOURCE));
  if (soilObservation?.direct_state_equivalence !== false) findings.push(finding('POINT_OBSERVATION_DIRECT_STATE_FORBIDDEN', STAGE.ROOT));
  const rainfall = sourceByRole.get('RAINFALL_OBSERVATION');
  const futureWeather = sourceByRole.get('FUTURE_WEATHER_ASSUMPTION');
  if (futureWeather?.epistemic_class !== 'ASSUMED') findings.push(finding('FUTURE_WEATHER_MUST_BE_ASSUMED', STAGE.SOURCE));
  if (rainfall?.evidence_record_type && futureWeather?.evidence_record_type && rainfall.evidence_record_type === futureWeather.evidence_record_type) findings.push(finding('OBSERVED_AND_ASSUMED_RECORD_MUST_DIFFER', STAGE.SOURCE));
  if (sourceByRole.get('HISTORICAL_ET0_INPUT')?.epistemic_class !== 'ESTIMATED') findings.push(finding('HISTORICAL_ET0_MUST_BE_ESTIMATED', STAGE.SOURCE));
  if (sourceByRole.get('FUTURE_ET0_ASSUMPTION')?.epistemic_class !== 'ASSUMED') findings.push(finding('FUTURE_ET0_MUST_BE_ASSUMED', STAGE.SOURCE));
  const plan = sourceByRole.get('APPROVED_IRRIGATION_PLAN');
  if (plan?.action_lifecycle_class === 'EXECUTION_EVIDENCE') findings.push(finding('APPROVED_PLAN_MARKED_EXECUTED', STAGE.ACTION));
  if (plan?.state_input_policy !== 'NEVER') findings.push(finding('APPROVED_PLAN_STATE_INPUT_FORBIDDEN', STAGE.ACTION));
  if (plan?.eligible_for_state_input === true) findings.push(finding('PLANNED_IRRIGATION_RECORD_ELIGIBLE_FORBIDDEN', STAGE.ACTION));
  if (sourceByRole.get('IRRIGATION_EXECUTION_EVIDENCE')?.state_input_policy !== 'CONDITIONAL') findings.push(finding('IRRIGATION_EXECUTION_POLICY_INVALID', STAGE.ACTION));
  if (source.determinism_hash !== hash(semanticTopProjection(source))) findings.push(finding('SOURCE_MATRIX_HASH_MISMATCH', STAGE.DETERMINISM));

  const configBindings = Array.isArray(config.bindings) ? config.bindings : [];
  const configDefinitions = Array.isArray(config.configuration_source_definitions) ? config.configuration_source_definitions : [];
  const configByRole = new Map(configBindings.map((binding) => [binding.source_role, binding]));
  const configDefinitionById = new Map(configDefinitions.map((definition) => [definition.configuration_source_id, definition]));
  if (!configByRole.has('SOIL_HYDRAULIC_CONFIGURATION')) findings.push(finding('SOIL_HYDRAULIC_CONFIGURATION_MISSING', STAGE.CONFIG));
  if (!configByRole.has('CROP_WATER_USE_CONFIGURATION')) findings.push(finding('CROP_WATER_USE_CONFIGURATION_MISSING', STAGE.CONFIG));
  if (duplicateValues(configBindings.map((binding) => binding.binding_id)).length) findings.push(finding('CONFIG_BINDING_ID_DUPLICATE', STAGE.AUTHORITY));
  if (duplicateValues(configDefinitions.map((definition) => definition.configuration_source_id)).length) findings.push(finding('CONFIGURATION_DEFINITION_ID_DUPLICATE', STAGE.AUTHORITY));
  for (const definition of configDefinitions) {
    if (!Number.isInteger(definition.configuration_version)) findings.push(finding('CONFIGURATION_SOURCE_VERSION_MISSING', STAGE.CONFIG));
    if (!nonEmpty(definition.proof_scope)) findings.push(finding('CONFIGURATION_PROOF_SCOPE_MISSING', STAGE.AUTHORITY));
    if (definition.configuration_semantic_hash !== hash(withoutHash(definition, 'configuration_semantic_hash'))) findings.push(finding('CONFIGURATION_DEFINITION_HASH_MISMATCH', STAGE.DETERMINISM));
    for (const parameter of Object.values(definition.parameters || {})) {
      if (['UNKNOWN', 'UNAVAILABLE', 'SOURCE_MISSING'].includes(parameter.status) && Object.hasOwn(parameter, 'value') && parameter.value !== null) findings.push(finding('UNKNOWN_PARAMETER_HAS_VALUE', STAGE.CONFIG));
    }
  }
  for (const binding of configBindings) {
    for (const key of config.common_contract?.required_fields || []) {
      if (!Object.hasOwn(binding, key) || binding[key] === null || binding[key] === '' || (Array.isArray(binding[key]) && binding[key].length === 0)) findings.push(finding(`CONFIG_BINDING_FIELD_MISSING_${key.toUpperCase()}`, STAGE.CONFIG));
    }
    for (const forbidden of config.common_contract?.forbidden_fields || []) if (Object.hasOwn(binding, forbidden)) findings.push(finding('CONFIG_BINDING_MASQUERADES_AS_EVIDENCE_SOURCE', STAGE.CONFIG));
    const definition = configDefinitionById.get(binding.configuration_source_id);
    if (!definition) findings.push(finding('CONFIGURATION_SOURCE_DEFINITION_MISSING', STAGE.AUTHORITY, binding.binding_id));
    else {
      if (definition.configuration_source_kind !== binding.configuration_source_kind) findings.push(finding('CONFIGURATION_SOURCE_KIND_MISMATCH', STAGE.AUTHORITY, binding.binding_id));
      if (definition.configuration_version !== binding.configuration_version) findings.push(finding('CONFIGURATION_SOURCE_VERSION_MISMATCH', STAGE.AUTHORITY, binding.binding_id));
    }
    if (binding.determinism_hash !== hash(withoutHash(binding))) findings.push(finding('CONFIG_BINDING_HASH_MISMATCH', STAGE.DETERMINISM, binding.binding_id));
  }

  const soilDefinition = configDefinitionById.get('mcft_soil_hydraulic_config_c8_v1');
  const soilParameters = soilDefinition?.parameters || {};
  const parameterValue = (name) => soilParameters[name]?.value;
  const parameterUnit = (name) => soilParameters[name]?.unit;
  const wilting = parameterValue('wilting_point_fraction');
  const fieldCapacity = parameterValue('field_capacity_fraction');
  const saturation = parameterValue('saturation_fraction');
  const rootDepth = parameterValue('root_zone_depth_mm');
  if (![wilting, fieldCapacity, saturation, rootDepth].every(Number.isFinite) || !(0 <= wilting && wilting < fieldCapacity && fieldCapacity < saturation && saturation <= 1)) findings.push(finding('SOIL_HYDRAULIC_ORDER_INVALID', STAGE.SOIL));
  for (const name of ['wilting_point_fraction', 'field_capacity_fraction', 'saturation_fraction', 'runoff_fraction']) if (parameterUnit(name) !== 'fraction') findings.push(finding('SOIL_PARAMETER_UNIT_INVALID', STAGE.SOIL, name));
  for (const name of ['root_zone_depth_mm', 'wilting_point_storage_mm', 'field_capacity_storage_mm', 'saturation_storage_mm']) if (parameterUnit(name) !== 'mm') findings.push(finding('SOIL_PARAMETER_UNIT_INVALID', STAGE.SOIL, name));
  if (!approx(parameterValue('wilting_point_storage_mm'), wilting * rootDepth)) findings.push(finding('WILTING_STORAGE_INCONSISTENT', STAGE.SOIL));
  if (!approx(parameterValue('field_capacity_storage_mm'), fieldCapacity * rootDepth)) findings.push(finding('FIELD_CAPACITY_STORAGE_INCONSISTENT', STAGE.SOIL));
  if (!approx(parameterValue('saturation_storage_mm'), saturation * rootDepth)) findings.push(finding('SATURATION_STORAGE_INCONSISTENT', STAGE.SOIL));
  const runoff = parameterValue('runoff_fraction');
  if (!(Number.isFinite(runoff) && runoff >= 0 && runoff <= 1)) findings.push(finding('RUNOFF_FRACTION_OUT_OF_RANGE', STAGE.SOIL));
  const drainage = parameterValue('drainage_coefficient_per_hour');
  if (!(Number.isFinite(drainage) && drainage >= 0)) findings.push(finding('DRAINAGE_COEFFICIENT_NEGATIVE', STAGE.SOIL));

  const cropDefinition = configDefinitionById.get('mcft_crop_water_use_corn_v1');
  const cropParameters = cropDefinition?.parameters || {};
  const rootDepthPolicy = cropParameters.effective_model_root_depth_policy?.value;
  if (rootDepthPolicy !== 'MIN_CROP_ROOT_DEPTH_AND_GOVERNED_ROOT_ZONE_V1') findings.push(finding('EFFECTIVE_ROOT_DEPTH_POLICY_MISSING', STAGE.CROP));
  const rootMapping = cropParameters.root_depth_mapping?.value;
  if (!Array.isArray(rootMapping) || !rootMapping.length) findings.push(finding('CROP_ROOT_DEPTH_MAPPING_MISSING', STAGE.CROP));
  else {
    for (const row of rootMapping) {
      const expected = Math.min(row.crop_root_depth_mm, root.bottom_depth_mm);
      if (!Number.isFinite(row.crop_root_depth_mm) || !Number.isFinite(row.effective_model_root_depth_mm) || row.effective_model_root_depth_mm !== expected || row.effective_model_root_depth_mm > root.bottom_depth_mm) findings.push(finding('EFFECTIVE_ROOT_DEPTH_EXCEEDS_GOVERNED_ZONE', STAGE.CROP, row.stage_code));
    }
  }
  if (config.determinism_hash !== hash(semanticTopProjection(config))) findings.push(finding('CONFIG_MATRIX_HASH_MISMATCH', STAGE.DETERMINISM));

  const feedbackContract = semantic.action_feedback_eligibility_contract || {};
  const feedback = feedbackContract.example_candidate || {};
  if (!Object.hasOwn(feedback, 'actual_amount')) findings.push(finding('ACTION_FEEDBACK_ACTUAL_AMOUNT_MISSING', STAGE.FEEDBACK));
  if (!nonEmpty(feedback.executed_at)) findings.push(finding('ACTION_FEEDBACK_EXECUTED_AT_MISSING', STAGE.FEEDBACK));
  if (!feedback.spatial_coverage) findings.push(finding('ACTION_FEEDBACK_SPATIAL_COVERAGE_MISSING', STAGE.FEEDBACK));
  if (!feedback.source_identity) findings.push(finding('ACTION_FEEDBACK_SOURCE_IDENTITY_MISSING', STAGE.FEEDBACK));
  if (!feedback.receipt_ref && !feedback.as_executed_ref) findings.push(finding('ACTION_FEEDBACK_TRUSTED_REF_MISSING', STAGE.FEEDBACK));
  if (feedback.origin_kind === 'AO_ACT' && !feedback.task_ref) findings.push(finding('ACTION_FEEDBACK_AO_ACT_TASK_REF_MISSING', STAGE.FEEDBACK));
  if (feedbackContract.acceptance_ref_required !== false) findings.push(finding('ACTION_FEEDBACK_ACCEPTANCE_MUST_BE_OPTIONAL', STAGE.FEEDBACK));
  if (feedbackContract.orthogonal_statuses !== true) findings.push(finding('ACTION_FEEDBACK_STATUS_ORTHOGONALITY_REQUIRED', STAGE.FEEDBACK));

  const release = semantic.replay_release_policy || {};
  if ((release.derivation_inputs || []).includes('current_wall_clock')) findings.push(finding('REPLAY_AVAILABILITY_WALL_CLOCK_FORBIDDEN', STAGE.TIME));
  for (const forbiddenInput of release.forbidden_inputs || []) {
    if (forbiddenInput === 'available_to_runtime_at') findings.push(finding('REPLAY_RELEASE_RULE_CIRCULAR', STAGE.TIME));
  }
  for (const binding of sourceBindings) {
    const rule = release.role_rules?.[binding.source_role];
    if (!rule) findings.push(finding('REPLAY_RELEASE_ROLE_RULE_MISSING', STAGE.TIME, binding.source_role));
    else {
      if (rule.input_fields.includes(rule.output_field)) findings.push(finding('REPLAY_RELEASE_RULE_CIRCULAR', STAGE.TIME, binding.source_role));
      if (JSON.stringify(rule.input_fields) !== JSON.stringify(binding.availability_semantics?.derivation_inputs)) findings.push(finding('REPLAY_RELEASE_BINDING_INPUT_MISMATCH', STAGE.TIME, binding.source_role));
    }
  }
  const compatibilityFuture = release.validation_examples?.future_observation;
  if (compatibilityFuture?.eligible_for_tick === true) findings.push(finding('FUTURE_OBSERVATION_EARLY_CONSUMPTION', STAGE.TIME));
  const compatibilityLate = release.validation_examples?.late_observation;
  if (Object.hasOwn(compatibilityLate || {}, 'classification') && compatibilityLate.classification !== 'LATE') findings.push(finding('LATE_EVIDENCE_CLASSIFICATION_INVALID', STAGE.TIME));
  for (const example of Object.values(release.validation_examples || {})) {
    const derived = deriveAvailableToRuntimeAt(example.role, example.record, release);
    if (derived.finding) findings.push(derived.finding);
    else {
      if (derived.available_to_runtime_at !== example.expected_available_to_runtime_at) findings.push(finding('REPLAY_RELEASE_EXAMPLE_MISMATCH', STAGE.TIME));
      const classified = classifyEvidenceForTick({ ...example.record, available_to_runtime_at: derived.available_to_runtime_at }, example.logical_tick_time);
      if (classified.finding) findings.push(classified.finding);
      else {
        if (classified.classification !== example.expected_classification) findings.push(finding('REPLAY_CLASSIFICATION_EXAMPLE_MISMATCH', STAGE.TIME));
        if (classified.eligible_for_tick !== example.expected_eligible_for_tick) findings.push(finding('REPLAY_ELIGIBILITY_EXAMPLE_MISMATCH', STAGE.TIME));
      }
    }
  }
  if (release.release_policy_hash !== hash(withoutHash(release, 'release_policy_hash'))) findings.push(finding('REPLAY_RELEASE_POLICY_HASH_MISMATCH', STAGE.DETERMINISM));

  const initialInputs = semantic.initial_runtime_inputs || [];
  if (initialInputs.includes('water_state_estimate_v1')) findings.push(finding('LEGACY_STATE_FORBIDDEN', STAGE.CONTAMINATION));
  if (initialInputs.includes('irrigation_scenario_set_v1')) findings.push(finding('LEGACY_SCENARIO_FORBIDDEN', STAGE.CONTAMINATION));
  if (initialInputs.includes('replay_demo_forecast_run_v1')) findings.push(finding('P50_FORECAST_FORBIDDEN', STAGE.CONTAMINATION));
  if (initialInputs.includes('C8_AO_ACT_FACTS')) findings.push(finding('C8_ACTION_CHAIN_CLOSURE_FORBIDDEN', STAGE.CONTAMINATION));

  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(reality.binding_id || '')) findings.push(finding('RANDOM_IDENTITY_FORBIDDEN', STAGE.DETERMINISM));
  for (const code of scanForbiddenHashInputs(semantic)) findings.push(finding(code, STAGE.DETERMINISM));
  if (Object.hasOwn(semantic, 'acceptance_status') || Object.hasOwn(semantic, 'status')) findings.push(finding('ACCEPTANCE_STATUS_IN_SEMANTIC_PAYLOAD', STAGE.DETERMINISM));
  if (reality.determinism_hash !== hash(semantic)) findings.push(finding('REALITY_BINDING_SEMANTIC_HASH_MISMATCH', STAGE.DETERMINISM));
  const expectedBindingId = `mcft_rb_${hash(semantic).slice('sha256:'.length, 'sha256:'.length + 24)}`;
  if (reality.binding_id !== expectedBindingId) findings.push(finding('REALITY_BINDING_ID_MISMATCH', STAGE.DETERMINISM));
  if (Object.hasOwn(reality, 'lineage_id')) findings.push(finding('REALITY_BINDING_LINEAGE_ID_FORBIDDEN', STAGE.VERSIONING));
  if (Object.hasOwn(reality, 'revision_id')) findings.push(finding('REALITY_BINDING_REVISION_ID_FORBIDDEN', STAGE.VERSIONING));
  if (arrayNonEmpty(semantic.versioning_contract?.runtime_operations)) findings.push(finding('REALITY_BINDING_RUNTIME_REVISION_FORBIDDEN', STAGE.VERSIONING));
  if (semantic.versioning_contract?.switches_active_lineage === true) findings.push(finding('REALITY_BINDING_ACTIVE_LINEAGE_SWITCH_FORBIDDEN', STAGE.VERSIONING));
  if (reality.canonical_persistence !== false) findings.push(finding('REALITY_BINDING_CANONICAL_PERSISTENCE_FORBIDDEN', STAGE.BOUNDARY));
  if (Object.hasOwn(reality, 'active_runtime_config_ref')) findings.push(finding('REALITY_BINDING_ACTIVE_CONFIG_FORBIDDEN', STAGE.BOUNDARY));
  if (arrayNonEmpty(reality.generated_runtime_objects)) findings.push(finding('REALITY_BINDING_GENERATED_RUNTIME_OBJECT_FORBIDDEN', STAGE.BOUNDARY));
  if (reality.canonical_runtime_object !== false || reality.lineage_member !== false || reality.runtime_transaction_family !== 'NONE') findings.push(finding('REALITY_BINDING_RUNTIME_OBJECT_BOUNDARY_INVALID', STAGE.BOUNDARY));

  return { findings: uniqueFindings(findings), write_attempt_count: 0 };
}

module.exports = {
  STAGE,
  finding,
  deriveAvailableToRuntimeAt,
  classifyEvidenceForTick,
  validateIdempotency,
  validatePackage,
};
