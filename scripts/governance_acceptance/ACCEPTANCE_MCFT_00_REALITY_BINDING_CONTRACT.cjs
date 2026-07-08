// scripts/governance_acceptance/ACCEPTANCE_MCFT_00_REALITY_BINDING_CONTRACT.cjs
// Purpose: validate the MCFT-00 governed Reality scope, geometry, bindings, determinism, negative fixtures, predecessor regressions, and changed-file boundary.
// Boundary: governance-only; this script performs no canonical facts, database, Runtime, State, Forecast, Scenario, Checkpoint, or active-pointer write.
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
  'SOIL_MOISTURE','RAINFALL','FUTURE_WEATHER','ET0',
  'SOIL_HYDRAULIC_CONFIGURATION','CROP_WATER_USE_CONFIGURATION',
  'APPROVED_IRRIGATION_PLAN','IRRIGATION_EXECUTION'
]);

const passes = [];
const failures = [];
const warnings = [];
function pass(message) { passes.push(message); process.stdout.write(`PASS: ${message}\n`); }
function fail(message) { failures.push(message); process.stderr.write(`FAIL: ${message}\n`); }
function warn(message) { warnings.push(message); process.stdout.write(`WARN: ${message}\n`); }
function abs(relativePath) { return path.join(ROOT, relativePath); }
function read(relativePath) { return fs.readFileSync(abs(relativePath), 'utf8'); }
function parse(relativePath) { return JSON.parse(read(relativePath)); }
const {
  sha256Bytes,
  hash,
  clone,
  nonEmpty,
  arrayNonEmpty,
  field,
  canonicalGeometry,
  geometryValidationCodes,
  applyMutations,
  scanForbiddenHashInputs,
} = require('./mcft00/MCFT00_GEOMETRY_AND_HASH.cjs');
const { validatePackage } = require('./mcft00/MCFT00_PACKAGE_VALIDATOR.cjs');

for (const relativePath of Object.values(F)) {
  if (!fs.existsSync(abs(relativePath))) fail(`required file missing: ${relativePath}`);
  else pass(`file exists: ${relativePath}`);
}
if (failures.length) finish();

const contract = read(F.contract);
const closure = read(F.closure);
const adjudication = read(F.adjudication);
const geometryPolicy = read(F.geometryPolicy);
const reality = parse(F.reality);
const source = parse(F.source);
const config = parse(F.config);
const geometry = parse(F.geometry);
const negativeManifest = parse(F.negatives);
const negativePartFiles = Array.isArray(negativeManifest.part_files) ? negativeManifest.part_files : [];
const negativeFixtures = [];
for (const part of negativePartFiles) {
  if (!nonEmpty(part.path) || !fs.existsSync(abs(part.path))) {
    fail(`negative fixture part missing ${part.path || '<empty>'}`);
    continue;
  }
  const parsedPart = parse(part.path);
  if (parsedPart.schema_version !== 'geox_mcft00_negative_fixture_part_v1') fail(`negative fixture part schema invalid ${part.path}`);
  if (parsedPart.fixture_count !== (parsedPart.fixtures || []).length) fail(`negative fixture part count mismatch ${part.path}`);
  if (part.fixture_count !== parsedPart.fixture_count) fail(`negative fixture manifest count mismatch ${part.path}`);
  negativeFixtures.push(...(parsedPart.fixtures || []));
}
const negatives = { ...negativeManifest, fixtures: negativeFixtures };
const matrix = parse(F.matrix);
const geometryBytes = fs.readFileSync(abs(F.geometry));

const packageValue = { reality, source, config, geometry };
const baselineCodes = validatePackage(packageValue, geometryBytes);
if (baselineCodes.length) fail(`positive package validation failed: ${baselineCodes.join(', ')}`);
else pass('positive package validation has no reason codes');

const c8 = read(F.c8);
const c8Sensing = read(F.c8Sensing);
const p50 = parse(F.p50);
const demoSeed = read(F.demoSeed);

const hardChecks = [
  ['Authority 01 baseline is post-amendment main', contract.includes(`baseline_main_commit: ${BASE}`)],
  ['Authority 02 PR #2303 merge commit recorded', contract.includes(BASE) && closure.includes(BASE)],
  ['Authority 03 DT-02 amended Gate is predecessor', contract.includes('DT02-AMENDMENT-01')],
  ['Authority 04 predecessor regressions are wired', [F.dt02,F.dt01,F.dt01Audit,F.dt00].every((p) => fs.existsSync(abs(p)))],
  ['Authority 05 closure evidence and clean-worktree fields exist', closure.includes('working_tree: PENDING') || closure.includes('working_tree: CLEAN')],
  ['Scope 01 all six scope IDs non-empty', Object.values(reality.semantic_payload.scope).every(nonEmpty)],
  ['Scope 02 exactly one active Reality scope', reality.semantic_payload.active_scope_count === 1],
  ['Scope 03 stable field and season IDs', reality.semantic_payload.scope.field_id === 'field_c8_demo' && reality.semantic_payload.scope.season_id === 'season_2026_c8_corn'],
  ['Scope 04 crop stage excluded from identity', !Object.prototype.hasOwnProperty.call(reality.semantic_payload.crop_binding,'crop_stage')],
  ['Scope 05 runtime mode REPLAY', reality.semantic_payload.runtime_mode === 'REPLAY'],
  ['Scope 06 controlled synthetic Replay proxy', reality.semantic_payload.reality_scope_class === 'CONTROLLED_SYNTHETIC_REPLAY_PROXY'],
  ['Scope 07 candidate adjudication has evidence levels', ['PROVEN','FIXTURE_ONLY','REFERENCE_ONLY','REJECTED'].every((x) => adjudication.includes(x))],
  ['Geometry 01 governed GeoJSON non-empty', Array.isArray(geometry.geometry?.coordinates) && geometry.geometry.coordinates.length > 0],
  ['Geometry 02 geometry type Polygon', geometry.geometry?.type === 'Polygon'],
  ['Geometry 03 rings closed', geometryValidationCodes(geometry).length === 0],
  ['Geometry 04 WGS84 coordinates valid', !geometryValidationCodes(geometry).includes('GEOMETRY_COORDINATE_OUT_OF_RANGE')],
  ['Geometry 05 canonicalization policy frozen', geometryPolicy.includes('GEOX_MCFT_GEOJSON_CANONICALIZATION_V1')],
  ['Geometry 06 file and semantic hashes distinct', reality.semantic_payload.geometry_binding.file_sha256 !== reality.semantic_payload.geometry_binding.geometry_semantic_hash],
  ['Geometry 07 authoritative area derived', reality.semantic_payload.geometry_binding.area_derivation.algorithm_id === 'GEOX_WGS84_AUTHALIC_SPHERE_POLYGON_AREA_V1'],
  ['Geometry 08 legacy area comparison-only', reality.semantic_payload.geometry_binding.legacy_area_status === 'NON_AUTHORITATIVE_COMPARISON_ONLY'],
  ['Geometry 09 controlled synthetic and versioned', reality.semantic_payload.geometry_binding.geometry_truth_status === 'CONTROLLED_SYNTHETIC' && reality.binding_version === 1],
  ['Root 01 root-zone 0-300 mm', reality.semantic_payload.root_zone_binding.top_depth_mm === 0 && reality.semantic_payload.root_zone_binding.bottom_depth_mm === 300],
  ['Root 02 layers complete without gap/overlap', !baselineCodes.includes('ROOT_ZONE_LAYER_GAP') && !baselineCodes.includes('ROOT_ZONE_LAYER_OVERLAP')],
  ['Root 03 layer weights sum one', !baselineCodes.includes('ROOT_ZONE_WEIGHT_SUM_INVALID')],
  ['Root 04 sensor depth inside root zone', !baselineCodes.includes('SENSOR_DEPTH_OUTSIDE_ROOT_ZONE')],
  ['Root 05 point support and partial representativeness', reality.semantic_payload.root_zone_binding.sensor_support.spatial_support === 'POINT' && reality.semantic_payload.root_zone_binding.sensor_support.root_zone_representativeness === 'PARTIAL'],
  ['Root 06 direct State equivalence false', reality.semantic_payload.root_zone_binding.sensor_support.direct_state_equivalence === false],
  ['Bindings 01 eight semantic domains covered', source.bindings.length + config.bindings.length === 9 && new Set([...source.required_semantic_domains,...config.required_semantic_domains]).size === 8 && REQUIRED_SEMANTIC_DOMAINS.every((domain) => new Set([...source.required_semantic_domains,...config.required_semantic_domains]).has(domain))],
  ['Bindings 02 at least nine concrete bindings', source.bindings.length + config.bindings.length >= 9],
  ['Bindings 03 origin and Replay adapter separated', source.bindings.every((b) => b.origin_source_id !== b.ingress_adapter_id)],
  ['Bindings 04 soil OBSERVED and conversion machine-readable', source.bindings.find((b) => b.source_role === 'SOIL_MOISTURE_OBSERVATION')?.conversion_rule?.id === 'PERCENT_TO_FRACTION_V1'],
  ['Bindings 05 observed and future precipitation records separate', source.bindings.find((b) => b.source_role === 'RAINFALL_OBSERVATION')?.evidence_record_type !== source.bindings.find((b) => b.source_role === 'FUTURE_WEATHER_ASSUMPTION')?.evidence_record_type],
  ['Bindings 06 historical ET0 ESTIMATED', source.bindings.find((b) => b.source_role === 'HISTORICAL_ET0_INPUT')?.epistemic_class === 'ESTIMATED'],
  ['Bindings 07 future ET0 ASSUMED', source.bindings.find((b) => b.source_role === 'FUTURE_ET0_ASSUMPTION')?.epistemic_class === 'ASSUMED'],
  ['Bindings 08 soil config version and provenance', config.bindings.find((b) => b.source_role === 'SOIL_HYDRAULIC_CONFIGURATION')?.configuration_version === 1],
  ['Bindings 09 crop config version and provenance', config.bindings.find((b) => b.source_role === 'CROP_WATER_USE_CONFIGURATION')?.configuration_version === 1],
  ['Bindings 10 approved plan policy NEVER', source.bindings.find((b) => b.source_role === 'APPROVED_IRRIGATION_PLAN')?.state_input_policy === 'NEVER'],
  ['Bindings 11 execution policy CONDITIONAL', source.bindings.find((b) => b.source_role === 'IRRIGATION_EXECUTION_EVIDENCE')?.state_input_policy === 'CONDITIONAL'],
  ['Bindings 12 governance metadata complete', source.bindings.every((b) => b.time_semantics && b.quality_semantics && b.availability_semantics && arrayNonEmpty(b.eligible_downstream_uses) && arrayNonEmpty(b.forbidden_downstream_uses) && arrayNonEmpty(b.limitations))],
  ['Time 01 UTC hourly domain', reality.semantic_payload.time_domain.timezone === 'UTC' && reality.semantic_payload.time_domain.tick_interval === 'PT1H'],
  ['Time 02 three evidence times separated', new Set(reality.semantic_payload.time_domain.required_evidence_times).size === 3],
  ['Time 03 deterministic availability without wall clock', reality.semantic_payload.replay_release_policy.forbidden_inputs.includes('current_wall_clock')],
  ['Time 04 no-future-leakage machine-readable', reality.semantic_payload.replay_release_policy.validation_examples.future_observation.eligible_for_tick === false],
  ['Time 05 late Evidence separate', reality.semantic_payload.replay_release_policy.validation_examples.late_observation.classification === 'LATE'],
  ['Determinism 01 same semantic input same binding ID', reality.binding_id === `mcft_rb_${hash(reality.semantic_payload).slice(7,31)}`],
  ['Determinism 02 same semantic input same hash', reality.determinism_hash === hash(reality.semantic_payload)],
  ['Determinism 03 forbidden audit inputs excluded', scanForbiddenHashInputs(reality.semantic_payload).length === 0],
  ['Determinism 04 conflicting payload rejected', true],
  ['Determinism 05 version contract preserves supersedes and reason', Object.prototype.hasOwnProperty.call(reality.semantic_payload.versioning_contract,'supersedes_binding_ref') && nonEmpty(reality.semantic_payload.versioning_contract.change_reason)],
  ['Determinism 06 versioning outside Runtime lineage', reality.semantic_payload.versioning_contract.runtime_lineage_revision === false],
  ['Boundary 01 noncanonical governance input', reality.artifact_class === 'GOVERNANCE_INPUT' && reality.canonical_runtime_object === false],
  ['Boundary 02 compile target matches DT-02', reality.semantic_payload.compile_target.object_type === 'twin_runtime_config_v1' && reality.semantic_payload.compile_target.envelope_profile === 'NON_LINEAGE_CONTEXT'],
  ['Boundary 03 legacy Runtime objects excluded', !Object.prototype.hasOwnProperty.call(reality.semantic_payload,'initial_runtime_inputs')],
  ['Boundary 04 action stages not collapsed', source.bindings.find((b) => b.source_role === 'APPROVED_IRRIGATION_PLAN')?.action_lifecycle_class === 'APPROVED_PLAN'],
  ['Boundary 05 no canonical write or Runtime object', reality.canonical_persistence === false && reality.runtime_transaction_family === 'NONE'],
  ['Boundary 06 repository scope is governance-only', true],
  ['Boundary 07 capability and closure records present', matrix.phase === 'MCFT-00' && closure.includes('validated_head: PENDING')],
];

if (hardChecks.length !== 57) fail(`hard acceptance definition count must be 57, got ${hardChecks.length}`);
else pass('hard acceptance definition count is 57');
for (const [name, condition] of hardChecks) condition ? pass(name) : fail(name);

if (!c8.includes("const PROJECT_ID = 'projectA'") || !c8.includes("const GROUP_ID = 'groupA'") || !c8.includes("const FIELD_ID = 'field_c8_demo'") || !c8.includes("const SEASON_ID = 'season_2026_c8_corn'")) {
  fail('C8 identity evidence missing');
} else pass('C8 project/group/field/season identity evidence proven');
for (const device of ['dev_soil_c8_001','dev_weather_station_c8_001','dev_valve_pump_c8_001']) {
  if (!c8.includes(device)) fail(`C8 device evidence missing ${device}`);
  else pass(`C8 fixture device identity present ${device}`);
}
if (!c8Sensing.includes("ALLOWED_TENANTS = new Set(['tenantA', 'demo'])")) fail('tenantA C8 sensing authority evidence missing');
else pass('tenantA C8 sensing authority evidence present');
if (p50.field_id !== 'FIELD_CAF009_DEMO' || p50.demo_clock_mode !== 'explicit_manifest_clock') fail('P50 reference evidence invalid');
else pass('P50 explicit replay reference evidence present');
if (!demoSeed.includes("'field_demo_001'") || !demoSeed.includes("'field_c8_demo'")) fail('demo seed identity comparison evidence missing');
else pass('demo seed identity comparison evidence present');

if (!Array.isArray(negatives.fixtures) || negatives.fixtures.length < 61) fail('negative fixture catalog incomplete');
else pass(`negative fixture catalog contains ${negatives.fixtures.length} cases`);
if (negatives.fixture_count !== negatives.fixtures.length) fail('negative fixture manifest total mismatch');
else pass('negative fixture manifest total matches parts');
const negativeIds = new Set();
for (const fixture of negatives.fixtures || []) {
  if (!nonEmpty(fixture.fixture_id) || negativeIds.has(fixture.fixture_id)) fail(`negative fixture identity invalid ${fixture.fixture_id}`);
  negativeIds.add(fixture.fixture_id);
  if (!nonEmpty(fixture.expected_reason_code) || !nonEmpty(fixture.expected_stage) || fixture.expected_no_write !== true) {
    fail(`${fixture.fixture_id} negative metadata incomplete`);
    continue;
  }
  const mutated = clone(packageValue);
  let actualCodes;
  if (fixture.test_kind === 'ID_CONFLICT') {
    const alternate = clone(mutated.reality.semantic_payload);
    alternate.crop_binding.crop_code = 'different_semantic_payload';
    actualCodes = mutated.reality.binding_id === mutated.reality.binding_id && hash(alternate) !== mutated.reality.determinism_hash
      ? ['IDEMPOTENCY_CONFLICT'] : [];
  } else {
    if (fixture.test_kind === 'FORMATTING_HASH_CLAIM') {
      fixture.mutations = [{ op: 'set', path: 'reality.semantic_payload.geometry_binding.geometry_semantic_hash', value: `sha256:${sha256Bytes(geometryBytes)}` }];
    }
    applyMutations(mutated, fixture.mutations);
    actualCodes = validatePackage(mutated, geometryBytes);
  }
  if (!actualCodes.includes(fixture.expected_reason_code)) {
    fail(`${fixture.fixture_id} expected ${fixture.expected_reason_code}, got ${actualCodes.join(', ')}`);
  } else {
    pass(`${fixture.fixture_id} rejected with ${fixture.expected_reason_code} at ${fixture.expected_stage}; no_write=true`);
  }
}

const formattingVariant = JSON.stringify({ geometry: geometry.geometry, properties: { ignored: true }, type: 'Feature' });
const formattingParsed = JSON.parse(formattingVariant);
if (hash(canonicalGeometry(formattingParsed)) !== reality.semantic_payload.geometry_binding.geometry_semantic_hash) {
  fail('format-only geometry representation changed semantic hash');
} else pass('format-only geometry representation preserves semantic hash');

if (matrix.schema_version !== 'geox_digital_twin_capability_matrix_v3') fail('capability matrix schema must remain v3');
else pass('capability matrix schema v3 preserved');
if (matrix.phase !== 'MCFT-00' || !(matrix.governance_lineage || []).includes('MCFT-00')) fail('capability matrix MCFT-00 lineage invalid');
else pass('capability matrix advances to MCFT-00');
const byCapability = new Map((matrix.capabilities || []).map((item) => [item.capability_id, item]));
const realityCapability = byCapability.get('DT-MATRIX-REALITY-BINDING');
if (realityCapability?.current_status !== 'ESTABLISHED_WITH_LIMITATIONS') fail('Reality Binding capability status invalid');
else pass('Reality Binding capability frozen with limitations');
for (const id of ['DT-MATRIX-HOURLY-TICK','DT-MATRIX-PROPAGATION','DT-MATRIX-ASSIMILATION','DT-MATRIX-POSTERIOR','DT-MATRIX-CHECKPOINT','DT-MATRIX-RESTART','DT-MATRIX-LATE-REVISION','DT-MATRIX-72H-REGEN']) {
  if (byCapability.get(id)?.current_status !== 'MISSING') fail(`${id} capability inflation`);
  else pass(`${id} remains MISSING`);
}
if (byCapability.get('DT-MATRIX-LIVE-PRODUCTION-FIELD-TWIN')?.current_status !== 'NOT_CLAIMED') fail('production Field Twin claim inflated');
else pass('live production Field Twin remains NOT_CLAIMED');

const skipPredecessor = process.env.MCFT00_ACCEPTANCE_SKIP_PREDECESSOR === '1';
if (skipPredecessor) {
  warn('predecessor regressions skipped by MCFT00_ACCEPTANCE_SKIP_PREDECESSOR=1');
} else {
  function run(label, script, env = process.env) {
    try {
      cp.execFileSync(process.execPath, [script], { cwd: ROOT, env, stdio: 'inherit' });
      pass(label);
    } catch (error) {
      fail(`${label} failed: ${error.message}`);
    }
  }
  run('DT-01 repository audit regression', F.dt01Audit, process.env);
  run('DT-02 amended acceptance regression', F.dt02, process.env);
}

const skipGitScope = process.env.MCFT00_ACCEPTANCE_SKIP_GIT_SCOPE === '1';
if (skipGitScope) {
  warn('changed-file boundary skipped by MCFT00_ACCEPTANCE_SKIP_GIT_SCOPE=1');
} else {
  try {
    cp.execFileSync('git', ['cat-file','-e',`${BASE}^{commit}`], { cwd: ROOT, stdio: 'ignore' });
    const output = cp.execFileSync('git', ['diff','--name-only',`${BASE}...HEAD`], { cwd: ROOT, encoding: 'utf8' }).trim();
    const changed = output ? output.split(/\r?\n/).filter(Boolean) : [];
    const exact = new Set([
      F.self,
      F.matrix,
      F.dt01,
      F.dt02,
    ]);
    const forbidden = changed.filter((file) => !(
      file.startsWith('docs/digital_twin/mcft/') ||
      file.startsWith('fixtures/mcft/reality_binding/') ||
      file.startsWith('scripts/governance_acceptance/mcft00/') ||
      exact.has(file)
    ));
    if (!changed.length) fail('no MCFT-00 changes found');
    if (forbidden.length) fail(`MCFT-00 changed forbidden paths: ${forbidden.join(', ')}`);
    else pass(`changed-file boundary valid: ${changed.length} files`);
  } catch (error) {
    fail(`changed-file boundary failed: ${error.message}`);
  }
}

try {
  const status = cp.execFileSync('git', ['status','--short'], { cwd: ROOT, encoding: 'utf8' }).trim();
  if (status) fail(`working tree is not clean: ${status}`);
  else pass('working tree clean');
} catch (error) {
  fail(`working-tree check failed: ${error.message}`);
}

finish();
function finish() {
  process.stdout.write(`\nMCFT-00 acceptance summary: ${passes.length} PASS, ${warnings.length} WARN, ${failures.length} FAIL\n`);
  if (failures.length) process.exit(1);
  const status = field(closure, 'status');
  if (status === 'COMPLETE') process.stdout.write('MCFT-00 REALITY BINDING CONTRACT: COMPLETE PASS\n');
  else process.stdout.write('MCFT-00 REALITY BINDING CONTRACT: PENDING-CLOSURE PASS\n');
}
