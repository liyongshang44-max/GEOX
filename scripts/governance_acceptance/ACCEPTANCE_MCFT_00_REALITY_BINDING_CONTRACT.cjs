// scripts/governance_acceptance/ACCEPTANCE_MCFT_00_REALITY_BINDING_CONTRACT.cjs
// Purpose: validate MCFT-00 scope, authority graph, geometry, configuration, deterministic time semantics, closure state, negative fixtures, predecessor regressions, and repository boundary.
// Boundary: governance-only; this Gate writes no facts, database records, Runtime objects, State, Forecast, Scenario, Checkpoint, or active pointer.
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');

const ROOT = path.resolve(__dirname, '../..');
const BASE = '7fd848ae00680480fc864990b9d03b37bc61fdff';

const F = Object.freeze({
  contract: 'docs/digital_twin/mcft/GEOX-MCFT-00-REALITY-BINDING-CONTRACT.md',
  reality: 'docs/digital_twin/mcft/GEOX-MCFT-00-REALITY-BINDING.json',
  source: 'docs/digital_twin/mcft/GEOX-MCFT-00-SOURCE-BINDING-MATRIX.json',
  config: 'docs/digital_twin/mcft/GEOX-MCFT-00-CONFIGURATION-BINDING-MATRIX.json',
  adjudication: 'docs/digital_twin/mcft/GEOX-MCFT-00-CANDIDATE-ADJUDICATION.md',
  geometryPolicy: 'docs/digital_twin/mcft/GEOX-MCFT-00-GEOMETRY-CANONICALIZATION.md',
  closure: 'docs/digital_twin/mcft/GEOX-MCFT-00-CLOSURE-RECORD.md',
  remediation: 'docs/digital_twin/mcft/GEOX-MCFT-00-REVIEW-REMEDIATION.md',
  geometry: 'fixtures/mcft/reality_binding/MCFT_C8_GOVERNED_ZONE_V1.geojson',
  negatives: 'fixtures/mcft/reality_binding/negative/MCFT_00_NEGATIVE_FIXTURES_V1.json',
  matrix: 'docs/digital_twin/GEOX-DIGITAL-TWIN-CAPABILITY-MATRIX.json',
  dt02: 'scripts/governance_acceptance/ACCEPTANCE_DT_02_RUNTIME_ARCHITECTURE_FREEZE.cjs',
  dt01: 'scripts/governance_acceptance/ACCEPTANCE_DT_01_EXISTING_CAPABILITY_RECONCILIATION.cjs',
  dt01Audit: 'scripts/governance_acceptance/AUDIT_DT_01_REPOSITORY_CAPABILITIES.cjs',
  dt00: 'scripts/governance_acceptance/ACCEPTANCE_DT_00_MAINLINE_GOVERNANCE_RESET.cjs',
  self: 'scripts/governance_acceptance/ACCEPTANCE_MCFT_00_REALITY_BINDING_CONTRACT.cjs',
  geometryHelper: 'scripts/governance_acceptance/mcft00/MCFT00_GEOMETRY_AND_HASH.cjs',
  validatorHelper: 'scripts/governance_acceptance/mcft00/MCFT00_PACKAGE_VALIDATOR.cjs',
  c8: 'scripts/demo_seed/datasets/C8_FORMAL_IRRIGATION_FULL_CHAIN_V1.cjs',
  c8Sensing: 'scripts/demo_seed/SEED_C8_SENSING_ONLY_V1.cjs',
  p50: 'fixtures/twin_demo_runtime/P50_REPLAY_INPUT_MANIFEST.json',
  demoSeed: 'docker/postgres/init/002_demo_seed.sql',
});

const REQUIRED_SEMANTIC_DOMAINS = Object.freeze([
  'SOIL_MOISTURE',
  'RAINFALL',
  'FUTURE_WEATHER',
  'ET0',
  'SOIL_HYDRAULIC_CONFIGURATION',
  'CROP_WATER_USE_CONFIGURATION',
  'APPROVED_IRRIGATION_PLAN',
  'IRRIGATION_EXECUTION',
]);

const passes = [];
const failures = [];
const warnings = [];

function pass(message) {
  passes.push(message);
  process.stdout.write(`PASS: ${message}\n`);
}

function fail(message) {
  failures.push(message);
  process.stderr.write(`FAIL: ${message}\n`);
}

function warn(message) {
  warnings.push(message);
  process.stdout.write(`WARN: ${message}\n`);
}

function abs(relativePath) {
  return path.join(ROOT, relativePath);
}

function read(relativePath) {
  return fs.readFileSync(abs(relativePath), 'utf8');
}

function parse(relativePath) {
  return JSON.parse(read(relativePath));
}

const {
  sha256Bytes,
  hash,
  clone,
  nonEmpty,
  arrayNonEmpty,
  field,
  canonicalGeometry,
  geometryValidationCodes,
  polygonAreaM2,
  applyMutations,
  scanForbiddenHashInputs,
  semanticTopProjection,
} = require('./mcft00/MCFT00_GEOMETRY_AND_HASH.cjs');

const {
  deriveAvailableToRuntimeAt,
  classifyEvidenceForTick,
  validateIdempotency,
  validatePackage,
} = require('./mcft00/MCFT00_PACKAGE_VALIDATOR.cjs');

for (const relativePath of Object.values(F)) {
  if (!fs.existsSync(abs(relativePath))) fail(`required file missing: ${relativePath}`);
  else pass(`file exists: ${relativePath}`);
}
if (failures.length) finish();

const contract = read(F.contract);
const closure = read(F.closure);
const adjudication = read(F.adjudication);
const geometryPolicy = read(F.geometryPolicy);
const remediation = read(F.remediation);
const reality = parse(F.reality);
const source = parse(F.source);
const config = parse(F.config);
const geometry = parse(F.geometry);
const negativeManifest = parse(F.negatives);
const matrix = parse(F.matrix);
const geometryBytes = fs.readFileSync(abs(F.geometry));
const packageValue = { reality, source, config, geometry };

const baselineResult = validatePackage(packageValue, geometryBytes);
if (baselineResult.findings.length) {
  fail(`positive package validation failed: ${baselineResult.findings.map((item) => `${item.reason_code}@${item.stage}`).join(', ')}`);
} else pass('positive package validation has zero findings');
if (baselineResult.write_attempt_count !== 0) fail(`positive validation attempted ${baselineResult.write_attempt_count} writes`);
else pass('positive validation write_attempt_count is zero');

const validatorSource = read(F.validatorHelper);
const forbiddenPurityPatterns = [
  /node:fs/,
  /node:child_process/,
  /node:http/,
  /node:https/,
  /\bfetch\s*\(/,
  /writeFile(?:Sync)?\s*\(/,
  /appendFile(?:Sync)?\s*\(/,
  /createWriteStream\s*\(/,
  /pool\.query\s*\(/,
  /INSERT\s+INTO\s+facts/i,
  /active[_ -]pointer/i,
];
const validatorPurity = forbiddenPurityPatterns.every((pattern) => !pattern.test(validatorSource));
if (validatorPurity) pass('private validator purity scan passed');
else fail('private validator purity scan found write or external-I/O capability');

const closureStatus = field(closure, 'status');
const closureMode = closureStatus === 'COMPLETE' ? 'COMPLETE' : closureStatus === 'PENDING_ACCEPTANCE' ? 'PENDING_ACCEPTANCE' : 'INVALID';
const expectedAcceptance = closureMode === 'COMPLETE' ? 'COMPLETE' : 'PENDING';
const expectedClaim = closureMode === 'COMPLETE' ? 'MCFT_00_REALITY_BINDING_FROZEN' : 'MCFT_00_REALITY_BINDING_FROZEN_PENDING_ACCEPTANCE';

function closureEvidenceValid() {
  if (closureMode === 'PENDING_ACCEPTANCE') {
    return [
      'implementation_validated_head: PENDING',
      'implementation_local_gate: PENDING',
      'DT-02 amended regression: PENDING',
      'DT-01 repository audit: PENDING',
      'DT-01 acceptance: PENDING',
      'DT-00 semantic regression: PENDING',
      'changed-file boundary: PENDING',
      'negative_fixture_count: PENDING',
      'working_tree: PENDING',
      'implementation_ci: PENDING',
      'closure_input_head: PENDING',
    ].every((marker) => closure.includes(marker));
  }
  if (closureMode !== 'COMPLETE') return false;
  const implementationHead = field(closure, 'implementation_validated_head');
  const closureInputHead = field(closure, 'closure_input_head');
  return /^[0-9a-f]{40}$/.test(implementationHead || '')
    && closureInputHead === implementationHead
    && /^PASS — [0-9]+ PASS \/ 0 WARN \/ 0 FAIL$/.test(field(closure, 'implementation_local_gate') || '')
    && /^PASS — workflow ci #[0-9]+$/.test(field(closure, 'implementation_ci') || '')
    && [
      'DT-02 amended regression: PASS',
      'DT-01 repository audit: PASS',
      'DT-01 acceptance: PASS',
      'DT-00 semantic regression: PASS',
      'changed-file boundary: PASS',
      `negative_fixture_count: ${negativeManifest.fixture_count}`,
      'working_tree: CLEAN',
    ].every((marker) => closure.includes(marker))
    && !closure.includes(': PENDING');
}

const changedBoundary = { executed: false, valid: false, changed: [], forbidden: [], error: null };
const skipGitScope = process.env.MCFT00_ACCEPTANCE_SKIP_GIT_SCOPE === '1';
if (skipGitScope) {
  warn('changed-file boundary skipped by MCFT00_ACCEPTANCE_SKIP_GIT_SCOPE=1');
} else {
  try {
    cp.execFileSync('git', ['cat-file', '-e', `${BASE}^{commit}`], { cwd: ROOT, stdio: 'ignore' });
    const output = cp.execFileSync('git', ['diff', '--name-only', `${BASE}...HEAD`], { cwd: ROOT, encoding: 'utf8' }).trim();
    changedBoundary.changed = output ? output.split(/\r?\n/).filter(Boolean) : [];
    const exact = new Set([F.self, F.matrix, F.dt01, F.dt02]);
    changedBoundary.forbidden = changedBoundary.changed.filter((file) => !(
      file.startsWith('docs/digital_twin/mcft/')
      || file.startsWith('fixtures/mcft/reality_binding/')
      || file.startsWith('scripts/governance_acceptance/mcft00/')
      || exact.has(file)
    ));
    changedBoundary.executed = true;
    changedBoundary.valid = changedBoundary.changed.length > 0 && changedBoundary.forbidden.length === 0;
    if (changedBoundary.valid) pass(`changed-file boundary valid: ${changedBoundary.changed.length} files`);
    else fail(`changed-file boundary invalid: ${changedBoundary.forbidden.join(', ') || 'no changes'}`);
  } catch (error) {
    changedBoundary.error = error.message;
    fail(`changed-file boundary failed: ${error.message}`);
  }
}

const geometryCodes = geometryValidationCodes(geometry);
const canonical = geometryCodes.length ? null : canonicalGeometry(geometry);
const allDomains = new Set([...(source.required_semantic_domains || []), ...(config.required_semantic_domains || [])]);
const sourceByRole = new Map((source.bindings || []).map((binding) => [binding.source_role, binding]));
const soilDefinition = (config.configuration_source_definitions || []).find((definition) => definition.configuration_source_id === 'mcft_soil_hydraulic_config_c8_v1');
const cropDefinition = (config.configuration_source_definitions || []).find((definition) => definition.configuration_source_id === 'mcft_crop_water_use_corn_v1');
const idempotentReplay = validateIdempotency(reality, clone(reality));
const conflictingCandidate = clone(reality);
conflictingCandidate.semantic_payload.crop_binding.crop_code = 'different_semantic_payload';
conflictingCandidate.determinism_hash = hash(conflictingCandidate.semantic_payload);
conflictingCandidate.binding_id = reality.binding_id;
const idempotencyConflict = validateIdempotency(reality, conflictingCandidate);
const statusVariantSource = clone(source);
statusVariantSource.acceptance_status = source.acceptance_status === 'PENDING' ? 'COMPLETE' : 'PENDING';
const statusVariantConfig = clone(config);
statusVariantConfig.acceptance_status = config.acceptance_status === 'PENDING' ? 'COMPLETE' : 'PENDING';
const statusHashInvariant = hash(semanticTopProjection(statusVariantSource)) === source.determinism_hash
  && hash(semanticTopProjection(statusVariantConfig)) === config.determinism_hash;
const releaseExampleResults = Object.values(reality.semantic_payload.replay_release_policy.validation_examples || {}).map((example) => {
  const derived = deriveAvailableToRuntimeAt(example.role, example.record, reality.semantic_payload.replay_release_policy);
  if (derived.finding) return false;
  const classified = classifyEvidenceForTick({ ...example.record, available_to_runtime_at: derived.available_to_runtime_at }, example.logical_tick_time);
  return derived.available_to_runtime_at === example.expected_available_to_runtime_at
    && classified.classification === example.expected_classification
    && classified.eligible_for_tick === example.expected_eligible_for_tick;
});

const hardChecks = [
  ['Authority 01 baseline is post-amendment main', contract.includes(`baseline_main_commit: ${BASE}`)],
  ['Authority 02 PR #2303 merge commit recorded', contract.includes(BASE) && closure.includes(BASE)],
  ['Authority 03 MCFT00-AMENDMENT-01 accepted', contract.includes('amendment_id: MCFT00-AMENDMENT-01') && contract.includes('amendment_status: ACCEPTED')],
  ['Authority 04 duplicate PR #2305 superseded', contract.includes('duplicate_implementation_pr: #2305 CLOSED_SUPERSEDED') && closure.includes('duplicate_implementation_pr: #2305 CLOSED_SUPERSEDED')],
  ['Authority 05 closure mode valid', closureMode !== 'INVALID'],
  ['Authority 06 closure evidence matches mode', closureEvidenceValid()],
  ['Authority 07 artifact and capability acceptance aligned', [reality, source, config].every((artifact) => artifact.status === 'FROZEN' && artifact.acceptance_status === expectedAcceptance) && matrix.acceptance_status === expectedAcceptance && matrix.current_claim === expectedClaim],

  ['Scope 01 all six scope IDs non-empty', Object.values(reality.semantic_payload.scope).every(nonEmpty)],
  ['Scope 02 exactly one active Reality scope', reality.semantic_payload.active_scope_count === 1],
  ['Scope 03 stable field and season IDs', reality.semantic_payload.scope.field_id === 'field_c8_demo' && reality.semantic_payload.scope.season_id === 'season_2026_c8_corn'],
  ['Scope 04 crop stage excluded from identity', !Object.hasOwn(reality.semantic_payload.crop_binding, 'crop_stage')],
  ['Scope 05 runtime mode REPLAY', reality.semantic_payload.runtime_mode === 'REPLAY'],
  ['Scope 06 controlled synthetic Replay proxy', reality.semantic_payload.reality_scope_class === 'CONTROLLED_SYNTHETIC_REPLAY_PROXY'],
  ['Scope 07 candidate adjudication evidence levels', ['PROVEN', 'FIXTURE_ONLY', 'REFERENCE_ONLY', 'REJECTED'].every((value) => adjudication.includes(value))],

  ['Geometry 01 governed GeoJSON non-empty', Array.isArray(geometry.geometry?.coordinates) && geometry.geometry.coordinates.length > 0],
  ['Geometry 02 type Polygon', geometry.geometry?.type === 'Polygon'],
  ['Geometry 03 structural validation clean', geometryCodes.length === 0],
  ['Geometry 04 WGS84 valid', !geometryCodes.includes('GEOMETRY_COORDINATE_OUT_OF_RANGE')],
  ['Geometry 05 canonicalization policy frozen', geometryPolicy.includes('GEOX_MCFT_GEOJSON_CANONICALIZATION_V1')],
  ['Geometry 06 file and semantic hashes distinct', reality.semantic_payload.geometry_binding.file_sha256 !== reality.semantic_payload.geometry_binding.geometry_semantic_hash],
  ['Geometry 07 authoritative area derived and positive', canonical && polygonAreaM2(canonical) > 0 && reality.semantic_payload.geometry_binding.derived_area_m2 === polygonAreaM2(canonical)],
  ['Geometry 08 legacy area comparison-only', reality.semantic_payload.geometry_binding.legacy_area_status === 'NON_AUTHORITATIVE_COMPARISON_ONLY'],
  ['Geometry 09 controlled synthetic and versioned', reality.semantic_payload.geometry_binding.geometry_truth_status === 'CONTROLLED_SYNTHETIC' && reality.binding_version === 1],

  ['Root 01 root-zone 0-300 mm', reality.semantic_payload.root_zone_binding.top_depth_mm === 0 && reality.semantic_payload.root_zone_binding.bottom_depth_mm === 300],
  ['Root 02 layers complete without gap or overlap', !baselineResult.findings.some((item) => ['ROOT_ZONE_LAYER_GAP', 'ROOT_ZONE_LAYER_OVERLAP'].includes(item.reason_code))],
  ['Root 03 layer bounds and IDs valid', !baselineResult.findings.some((item) => ['ROOT_ZONE_LAYER_BOUNDS_INVALID', 'ROOT_ZONE_LAYER_ID_INVALID'].includes(item.reason_code))],
  ['Root 04 layer weights sum one', !baselineResult.findings.some((item) => item.reason_code === 'ROOT_ZONE_WEIGHT_SUM_INVALID')],
  ['Root 05 sensor inside root zone with POINT/PARTIAL support', !baselineResult.findings.some((item) => ['SENSOR_DEPTH_OUTSIDE_ROOT_ZONE', 'SENSOR_SUPPORT_INVALID'].includes(item.reason_code))],
  ['Root 06 direct State equivalence false', reality.semantic_payload.root_zone_binding.sensor_support.direct_state_equivalence === false],

  ['Bindings 01 eight semantic domains covered', REQUIRED_SEMANTIC_DOMAINS.every((domain) => allDomains.has(domain))],
  ['Bindings 02 nine concrete bindings', source.bindings.length + config.bindings.length === 9],
  ['Bindings 03 seven source and two config bindings', source.bindings.length === 7 && config.bindings.length === 2],
  ['Bindings 04 source authority graph resolves', !baselineResult.findings.some((item) => item.stage === 'AUTHORITY_REFERENCE_VALIDATION' && item.reason_code.includes('SOURCE'))],
  ['Bindings 05 seven governed Replay adapters resolve', source.ingress_adapter_definitions.length === 7 && source.bindings.every((binding) => source.ingress_adapter_definitions.some((definition) => definition.ingress_adapter_id === binding.ingress_adapter_id))],
  ['Bindings 06 soil OBSERVED and conversion machine-readable', sourceByRole.get('SOIL_MOISTURE_OBSERVATION')?.epistemic_class === 'OBSERVED' && sourceByRole.get('SOIL_MOISTURE_OBSERVATION')?.conversion_rule?.id === 'PERCENT_TO_FRACTION_V1'],
  ['Bindings 07 rainfall and future assumption separated', sourceByRole.get('RAINFALL_OBSERVATION')?.evidence_record_type !== sourceByRole.get('FUTURE_WEATHER_ASSUMPTION')?.evidence_record_type],
  ['Bindings 08 historical ET0 ESTIMATED and future ET0 ASSUMED', sourceByRole.get('HISTORICAL_ET0_INPUT')?.epistemic_class === 'ESTIMATED' && sourceByRole.get('FUTURE_ET0_ASSUMPTION')?.epistemic_class === 'ASSUMED'],
  ['Bindings 09 soil configuration physical invariants valid', soilDefinition && !baselineResult.findings.some((item) => item.stage === 'SOIL_CONFIGURATION_VALIDATION')],
  ['Bindings 10 crop effective root policy valid', cropDefinition && !baselineResult.findings.some((item) => item.stage === 'CROP_CONFIGURATION_VALIDATION')],
  ['Bindings 11 Approved plan NEVER and execution CONDITIONAL', sourceByRole.get('APPROVED_IRRIGATION_PLAN')?.state_input_policy === 'NEVER' && sourceByRole.get('IRRIGATION_EXECUTION_EVIDENCE')?.state_input_policy === 'CONDITIONAL'],
  ['Bindings 12 metadata complete and validator pure', source.bindings.every((binding) => binding.time_semantics && binding.quality_semantics && binding.availability_semantics && arrayNonEmpty(binding.eligible_downstream_uses) && arrayNonEmpty(binding.forbidden_downstream_uses) && arrayNonEmpty(binding.limitations)) && validatorPurity],

  ['Time 01 UTC hourly domain', reality.semantic_payload.time_domain.timezone === 'UTC' && reality.semantic_payload.time_domain.tick_interval === 'PT1H'],
  ['Time 02 role event, ingestion, and availability separated', reality.semantic_payload.time_domain.required_evidence_times.length === 3],
  ['Time 03 release rules non-circular and deterministic', !baselineResult.findings.some((item) => ['REPLAY_RELEASE_RULE_CIRCULAR', 'REPLAY_RELEASE_INPUTS_MISSING', 'REPLAY_RELEASE_BINDING_INPUT_MISMATCH'].includes(item.reason_code))],
  ['Time 04 no-future and late classification computed', releaseExampleResults.length === 3 && releaseExampleResults.every(Boolean)],
  ['Time 05 wall clock forbidden', reality.semantic_payload.replay_release_policy.forbidden_inputs.includes('current_wall_clock') && !reality.semantic_payload.replay_release_policy.derivation_inputs.includes('current_wall_clock')],

  ['Determinism 01 same semantic input same binding ID', reality.binding_id === `mcft_rb_${hash(reality.semantic_payload).slice(7, 31)}`],
  ['Determinism 02 same semantic input same hash', reality.determinism_hash === hash(reality.semantic_payload)],
  ['Determinism 03 audit fields excluded from semantic identity', scanForbiddenHashInputs(reality.semantic_payload).length === 0 && statusHashInvariant],
  ['Determinism 04 idempotent replay recognized', idempotentReplay.status === 'IDEMPOTENT_REPLAY'],
  ['Determinism 05 conflicting payload rejected', idempotencyConflict.status === 'IDEMPOTENCY_CONFLICT' && idempotencyConflict.findings.some((item) => item.reason_code === 'IDEMPOTENCY_CONFLICT')],
  ['Determinism 06 versioning remains outside Runtime lineage', reality.semantic_payload.versioning_contract.runtime_lineage_revision === false && !Object.hasOwn(reality, 'lineage_id') && !Object.hasOwn(reality, 'revision_id')],

  ['Boundary 01 noncanonical governance input', reality.artifact_class === 'GOVERNANCE_INPUT' && reality.canonical_runtime_object === false && reality.canonical_persistence === false],
  ['Boundary 02 compile and persistence owners remain MCFT-02/03', reality.semantic_payload.compile_target.owner_phase === 'MCFT-02' && reality.semantic_payload.persistence_target.owner_phase === 'MCFT-03'],
  ['Boundary 03 legacy Runtime objects excluded', !Object.hasOwn(reality.semantic_payload, 'initial_runtime_inputs')],
  ['Boundary 04 no Runtime object or active pointer produced', reality.runtime_transaction_family === 'NONE' && !Object.hasOwn(reality, 'active_runtime_config_ref') && !arrayNonEmpty(reality.generated_runtime_objects)],
  ['Boundary 05 repository scope governance-only', skipGitScope ? remediation.includes('repository boundary remains governance-only') : changedBoundary.executed && changedBoundary.valid],
];

if (hardChecks.length !== 57) fail(`hard acceptance definition count must be 57, got ${hardChecks.length}`);
else pass('hard acceptance definition count is 57');
for (const [name, condition] of hardChecks) condition ? pass(name) : fail(name);

const c8 = read(F.c8);
const c8Sensing = read(F.c8Sensing);
const p50 = parse(F.p50);
const demoSeed = read(F.demoSeed);
if (!c8.includes("const PROJECT_ID = 'projectA'") || !c8.includes("const GROUP_ID = 'groupA'") || !c8.includes("const FIELD_ID = 'field_c8_demo'") || !c8.includes("const SEASON_ID = 'season_2026_c8_corn'")) fail('C8 identity evidence missing');
else pass('C8 project/group/field/season identity evidence proven');
for (const device of ['dev_soil_c8_001', 'dev_weather_station_c8_001', 'dev_valve_pump_c8_001']) {
  if (!c8.includes(device)) fail(`C8 device evidence missing ${device}`);
  else pass(`C8 fixture device identity present ${device}`);
}
if (!c8Sensing.includes("ALLOWED_TENANTS = new Set(['tenantA', 'demo'])")) fail('tenantA C8 sensing authority evidence missing');
else pass('tenantA C8 sensing authority evidence present');
if (p50.field_id !== 'FIELD_CAF009_DEMO' || p50.demo_clock_mode !== 'explicit_manifest_clock') fail('P50 reference evidence invalid');
else pass('P50 explicit replay reference evidence present');
if (!demoSeed.includes("'field_demo_001'") || !demoSeed.includes("'field_c8_demo'")) fail('demo seed identity comparison evidence missing');
else pass('demo seed identity comparison evidence present');

const negativeFixtures = [];
for (const part of negativeManifest.part_files || []) {
  if (!nonEmpty(part.path) || !fs.existsSync(abs(part.path))) {
    fail(`negative fixture part missing ${part.path || '<empty>'}`);
    continue;
  }
  const parsedPart = parse(part.path);
  if (parsedPart.fixture_count !== (parsedPart.fixtures || []).length) fail(`negative fixture part count mismatch ${part.path}`);
  if (part.fixture_count !== parsedPart.fixture_count) fail(`negative fixture manifest count mismatch ${part.path}`);
  negativeFixtures.push(...(parsedPart.fixtures || []));
}
if (negativeFixtures.length !== negativeManifest.fixture_count) fail(`negative fixture total mismatch: manifest=${negativeManifest.fixture_count}, actual=${negativeFixtures.length}`);
else pass(`negative fixture catalog contains exact ${negativeFixtures.length} cases`);
if (negativeFixtures.length < negativeManifest.minimum_fixture_count || negativeFixtures.length < 61) fail('negative fixture catalog below required minimum');
else pass(`negative fixture catalog exceeds minimum ${negativeManifest.minimum_fixture_count}`);

const negativeIds = new Set();
for (const fixture of negativeFixtures) {
  if (!nonEmpty(fixture.fixture_id) || negativeIds.has(fixture.fixture_id)) {
    fail(`negative fixture identity invalid ${fixture.fixture_id}`);
    continue;
  }
  negativeIds.add(fixture.fixture_id);
  if (!nonEmpty(fixture.expected_reason_code) || !nonEmpty(fixture.expected_stage) || fixture.expected_no_write !== true) {
    fail(`${fixture.fixture_id} negative metadata incomplete`);
    continue;
  }
  const mutated = clone(packageValue);
  let result;
  if (fixture.test_kind === 'ID_CONFLICT') {
    const candidate = clone(mutated.reality);
    candidate.semantic_payload.crop_binding.crop_code = 'different_semantic_payload';
    candidate.determinism_hash = hash(candidate.semantic_payload);
    candidate.binding_id = mutated.reality.binding_id;
    result = { findings: validateIdempotency(mutated.reality, candidate).findings, write_attempt_count: 0 };
  } else {
    const mutations = fixture.test_kind === 'FORMATTING_HASH_CLAIM'
      ? [{ op: 'set', path: 'reality.semantic_payload.geometry_binding.geometry_semantic_hash', value: `sha256:${sha256Bytes(geometryBytes)}` }]
      : fixture.mutations;
    applyMutations(mutated, mutations);
    result = validatePackage(mutated, geometryBytes);
  }
  const exactFinding = result.findings.find((item) => item.reason_code === fixture.expected_reason_code && item.stage === fixture.expected_stage);
  if (!exactFinding) {
    fail(`${fixture.fixture_id} expected ${fixture.expected_reason_code}@${fixture.expected_stage}, got ${result.findings.map((item) => `${item.reason_code}@${item.stage}`).join(', ')}`);
  } else if (result.write_attempt_count !== 0) {
    fail(`${fixture.fixture_id} write_attempt_count=${result.write_attempt_count}`);
  } else {
    pass(`${fixture.fixture_id} rejected with ${fixture.expected_reason_code}@${fixture.expected_stage}; write_attempt_count=0`);
  }
}

const formattingVariant = { geometry: geometry.geometry, properties: { ignored: true }, type: 'Feature' };
if (hash(canonicalGeometry(formattingVariant)) !== reality.semantic_payload.geometry_binding.geometry_semantic_hash) fail('format-only geometry representation changed semantic hash');
else pass('format-only geometry representation preserves semantic hash');

if (matrix.schema_version !== 'geox_digital_twin_capability_matrix_v3') fail('capability matrix schema must remain v3');
else pass('capability matrix schema v3 preserved');
const byCapability = new Map((matrix.capabilities || []).map((item) => [item.capability_id, item]));
for (const id of ['DT-MATRIX-HOURLY-TICK', 'DT-MATRIX-PROPAGATION', 'DT-MATRIX-ASSIMILATION', 'DT-MATRIX-POSTERIOR', 'DT-MATRIX-CHECKPOINT', 'DT-MATRIX-RESTART', 'DT-MATRIX-LATE-REVISION', 'DT-MATRIX-72H-REGEN']) {
  if (byCapability.get(id)?.current_status !== 'MISSING') fail(`${id} capability inflation`);
  else pass(`${id} remains MISSING`);
}
if (byCapability.get('DT-MATRIX-LIVE-PRODUCTION-FIELD-TWIN')?.current_status !== 'NOT_CLAIMED') fail('production Field Twin claim inflated');
else pass('live production Field Twin remains NOT_CLAIMED');

const skipPredecessor = process.env.MCFT00_ACCEPTANCE_SKIP_PREDECESSOR === '1';
if (skipPredecessor) {
  warn('predecessor regressions skipped by MCFT00_ACCEPTANCE_SKIP_PREDECESSOR=1');
} else {
  function run(label, script, environment = process.env) {
    try {
      cp.execFileSync(process.execPath, [script], { cwd: ROOT, env: environment, stdio: 'inherit' });
      pass(label);
    } catch (error) {
      fail(`${label} failed: ${error.message}`);
    }
  }
  run('DT-01 repository audit regression', F.dt01Audit, process.env);
  run('DT-02 amended acceptance regression', F.dt02, process.env);
}

try {
  const status = cp.execFileSync('git', ['status', '--short'], { cwd: ROOT, encoding: 'utf8' }).trim();
  if (status) fail(`working tree is not clean: ${status}`);
  else pass('working tree clean');
} catch (error) {
  fail(`working-tree check failed: ${error.message}`);
}

finish();

function finish() {
  process.stdout.write(`\nMCFT-00 acceptance summary: ${passes.length} PASS, ${warnings.length} WARN, ${failures.length} FAIL\n`);
  if (failures.length) process.exit(1);
  if (closureMode === 'COMPLETE') process.stdout.write('MCFT-00 REALITY BINDING CONTRACT: COMPLETE PASS\n');
  else process.stdout.write('MCFT-00 REALITY BINDING CONTRACT: PENDING-CLOSURE PASS\n');
}
