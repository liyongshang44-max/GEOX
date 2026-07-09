// scripts/mcft/GENERATE_MCFT_CAP_01_REPLAY_DATASET.cjs
// Purpose: deterministically materialize the MCFT-CAP-01 controlled Canonical Replay Dataset.
// Boundary: generator only; no network, database, wall-clock, random, environment-derived semantics, or Runtime object writes.

'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '../..');
const DEFAULT_CONFIG = path.join(ROOT, 'fixtures/mcft/water_state/replay_v1/generator_config.json');
const DEFAULT_SOURCE_MATRIX = path.join(ROOT, 'docs/digital_twin/mcft/GEOX-MCFT-00-SOURCE-BINDING-MATRIX.json');
const DEFAULT_REALITY = path.join(ROOT, 'docs/digital_twin/mcft/GEOX-MCFT-00-REALITY-BINDING.json');
const DEFAULT_OUTPUT = path.join(ROOT, 'fixtures/mcft/water_state/replay_v1/materialized');

function canonical(value) {
  if (value === undefined) throw new Error('UNDEFINED_FORBIDDEN');
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error('NON_FINITE_NUMBER');
    return Object.is(value, -0) ? '0' : JSON.stringify(value);
  }
  if (value === null || typeof value === 'boolean' || typeof value === 'string') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (typeof value === 'object') return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
  throw new Error(`UNSUPPORTED_TYPE:${typeof value}`);
}

function sha256(value) {
  return `sha256:${crypto.createHash('sha256').update(value, 'utf8').digest('hex')}`;
}

function iso(ms) {
  return new Date(ms).toISOString();
}

function round6(value) {
  const sign = value < 0 ? -1 : 1;
  const scaled = Math.abs(value) * 1_000_000;
  const rounded = Math.floor(scaled + 0.5 + Number.EPSILON * scaled);
  const result = sign * rounded / 1_000_000;
  return Object.is(result, -0) ? 0 : result;
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function ensureEmptyDirectory(directory) {
  fs.rmSync(directory, { recursive: true, force: true });
  fs.mkdirSync(directory, { recursive: true });
}

function roleBindingMap(sourceMatrix) {
  return new Map(sourceMatrix.bindings.map((binding) => [binding.source_role, binding]));
}

function scopeFromReality(reality) {
  const scope = reality.semantic_payload?.scope || reality.scope || reality.reality_scope || reality;
  return {
    tenant_id: scope.tenant_id,
    project_id: scope.project_id,
    group_id: scope.group_id,
    field_id: scope.field_id,
    season_id: scope.season_id,
    zone_id: scope.zone_id,
  };
}

function deriveAvailableToRuntimeAt(binding, roleTimeWithoutAvailability) {
  const rule = binding.availability_semantics;
  if (!rule || rule.rule_id !== 'MAX_SOURCE_TIMES_V1' || !Array.isArray(rule.derivation_inputs)) throw new Error(`UNSUPPORTED_AVAILABILITY_RULE:${binding.source_role}`);
  if (rule.derivation_inputs.includes('available_to_runtime_at')) throw new Error(`SELF_REFERENTIAL_AVAILABILITY:${binding.source_role}`);
  const values = rule.derivation_inputs.map((field) => {
    const value = roleTimeWithoutAvailability[field];
    if (typeof value !== 'string' || !Number.isFinite(Date.parse(value))) throw new Error(`INVALID_AVAILABILITY_INPUT:${binding.source_role}:${field}`);
    return value;
  });
  return values.sort()[values.length - 1];
}

function withAvailability(binding, roleTimeWithoutAvailability) {
  return { ...roleTimeWithoutAvailability, available_to_runtime_at: deriveAvailableToRuntimeAt(binding, roleTimeWithoutAvailability) };
}

function recordHash(record) {
  const semantic = { ...record };
  delete semantic.source_record_hash;
  delete semantic.materialized_file_location;
  return sha256(canonical(semantic));
}

function buildCommon({ config, binding, scope, sourceRecordId, roleTime, quality, sourcePayload, canonicalPayload }) {
  const expectedAvailability = deriveAvailableToRuntimeAt(binding, roleTime);
  if (expectedAvailability !== roleTime.available_to_runtime_at) throw new Error(`AVAILABLE_TO_RUNTIME_MISMATCH:${binding.source_role}`);
  const record = {
    dataset_id: config.dataset_id,
    source_record_id: sourceRecordId,
    record_type: binding.evidence_record_type,
    binding_id: binding.binding_id,
    origin_source_kind: binding.origin_source_kind,
    origin_source_id: binding.origin_source_id,
    source_version: binding.source_version,
    ingress_adapter_id: binding.ingress_adapter_id,
    ingress_adapter_version: binding.ingress_adapter_version,
    epistemic_class: binding.epistemic_class,
    action_lifecycle_class: binding.action_lifecycle_class,
    ...scope,
    metric: binding.metric,
    quantity_kind: binding.quantity_kind,
    role_time: roleTime,
    available_to_runtime_at: roleTime.available_to_runtime_at,
    quality,
    limitations: [...binding.limitations, 'controlled synthetic canonical Replay fixture'],
    source_payload: sourcePayload,
    canonical_payload: canonicalPayload,
  };
  record.source_record_hash = recordHash(record);
  return record;
}

function deterministicId(config, binding, roleTime, sequence, payload) {
  const hash = sha256(canonical({ dataset_id: config.dataset_id, binding_id: binding.binding_id, role_time: roleTime, record_sequence: sequence, source_semantic_payload: payload })).slice(7, 31);
  return `mcft_src_${hash}`;
}

function writeJsonl(file, records) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const text = `${records.map((record) => canonical(record)).join('\n')}\n`;
  fs.writeFileSync(file, text, { encoding: 'utf8' });
  return { bytes: Buffer.byteLength(text), sha256: sha256(text), record_count: records.length };
}

function generate(options = {}) {
  const configPath = options.configPath || DEFAULT_CONFIG;
  const sourceMatrixPath = options.sourceMatrixPath || DEFAULT_SOURCE_MATRIX;
  const realityPath = options.realityPath || DEFAULT_REALITY;
  const outputDirectory = options.outputDirectory || DEFAULT_OUTPUT;
  const config = readJson(configPath);
  const sourceMatrix = readJson(sourceMatrixPath);
  const reality = readJson(realityPath);
  const bindings = roleBindingMap(sourceMatrix);
  const scope = scopeFromReality(reality);
  const requiredRoles = ['SOIL_MOISTURE_OBSERVATION','RAINFALL_OBSERVATION','HISTORICAL_ET0_INPUT','FUTURE_WEATHER_ASSUMPTION','FUTURE_ET0_ASSUMPTION','APPROVED_IRRIGATION_PLAN','IRRIGATION_EXECUTION_EVIDENCE'];
  for (const role of requiredRoles) if (!bindings.has(role)) throw new Error(`UNRESOLVED_BINDING:${role}`);
  ensureEmptyDirectory(outputDirectory);
  const startMs = Date.parse(config.coverage_start);
  const endMs = Date.parse(config.coverage_end_exclusive);
  const intervalMs = config.tick_interval_ms;
  if ((endMs - startMs) / intervalMs !== config.hourly_interval_count) throw new Error('INTERVAL_COUNT_MISMATCH');
  const daily = new Map();
  const roleCounts = Object.fromEntries(requiredRoles.map((role) => [role, 0]));
  function add(role, date, record) {
    const key = `${role}|${date}`;
    if (!daily.has(key)) daily.set(key, []);
    daily.get(key).push(record);
    roleCounts[role] += 1;
  }
  for (let i = 0; i < config.hourly_interval_count; i += 1) {
    const intervalStart = startMs + i * intervalMs;
    const intervalEnd = intervalStart + intervalMs;
    const date = iso(intervalStart).slice(0, 10);

    const soil = bindings.get('SOIL_MOISTURE_OBSERVATION');
    const soilRoleTime = withAvailability(soil, { observed_at: iso(intervalEnd - 10 * 60_000), ingested_at: iso(intervalEnd - 5 * 60_000) });
    const soilPercent = round6(18.4 + ((i * 7) % 17) / 100);
    const soilSource = { value: soilPercent, unit: soil.source_unit };
    const soilCanonical = { value: round6(soilPercent / 100), unit: soil.canonical_unit };
    add('SOIL_MOISTURE_OBSERVATION', date, buildCommon({ config, binding: soil, scope, sourceRecordId: deterministicId(config, soil, soilRoleTime, i, soilSource), roleTime: soilRoleTime, quality: { status: 'PASS' }, sourcePayload: soilSource, canonicalPayload: soilCanonical }));

    const rain = bindings.get('RAINFALL_OBSERVATION');
    const rainRoleTime = withAvailability(rain, { interval_start: iso(intervalStart), interval_end: iso(intervalEnd), ingested_at: iso(intervalEnd) });
    const rainMm = i % 137 === 0 ? 3.2 : i % 211 === 0 ? 1.1 : 0;
    const rainPayload = { value: rainMm, unit: rain.canonical_unit };
    add('RAINFALL_OBSERVATION', date, buildCommon({ config, binding: rain, scope, sourceRecordId: deterministicId(config, rain, rainRoleTime, i, rainPayload), roleTime: rainRoleTime, quality: { status: 'PASS' }, sourcePayload: rainPayload, canonicalPayload: rainPayload }));

    const et0 = bindings.get('HISTORICAL_ET0_INPUT');
    const et0RoleTime = withAvailability(et0, { interval_start: iso(intervalStart), interval_end: iso(intervalEnd), ingested_at: iso(intervalEnd), input_weather_refs: [], calculation_method: 'CONTROLLED_SYNTHETIC_ET0_PATTERN_V1', method_version: '1' });
    const et0Value = round6(0.08 + (i % 24) * 0.005);
    const et0Payload = { value: et0Value, unit: et0.canonical_unit, calculation_method: 'CONTROLLED_SYNTHETIC_ET0_PATTERN_V1', method_version: 1, input_weather_refs: [] };
    add('HISTORICAL_ET0_INPUT', date, buildCommon({ config, binding: et0, scope, sourceRecordId: deterministicId(config, et0, et0RoleTime, i, et0Payload), roleTime: et0RoleTime, quality: { status: 'PASS' }, sourcePayload: et0Payload, canonicalPayload: et0Payload }));

    for (const [role, kind] of [['FUTURE_WEATHER_ASSUMPTION', 'weather'], ['FUTURE_ET0_ASSUMPTION', 'et0']]) {
      const binding = bindings.get(role);
      const availableAt = iso(intervalEnd + 5 * 60_000);
      const roleTime = withAvailability(binding, { issued_at: iso(intervalEnd - 15 * 60_000), retrieved_at: availableAt, ingested_at: availableAt, valid_from: iso(intervalEnd + intervalMs), valid_to: iso(intervalEnd + 73 * intervalMs) });
      const points = [];
      for (let horizon = 1; horizon <= 72; horizon += 1) {
        const pointStart = intervalEnd + horizon * intervalMs;
        const pointEnd = pointStart + intervalMs;
        points.push(kind === 'weather'
          ? { horizon, valid_from: iso(pointStart), valid_to: iso(pointEnd), precipitation_mm: (i + horizon) % 41 === 0 ? 1.2 : 0 }
          : { horizon, valid_from: iso(pointStart), valid_to: iso(pointEnd), et0_mm_per_hour: round6(0.09 + ((i + horizon) % 24) * 0.004) });
      }
      const payload = { snapshot_kind: kind === 'weather' ? 'FUTURE_WEATHER_ASSUMPTION' : 'FUTURE_ET0_ASSUMPTION', points };
      add(role, date, buildCommon({ config, binding, scope, sourceRecordId: deterministicId(config, binding, roleTime, i, payload), roleTime, quality: { status: 'PASS' }, sourcePayload: payload, canonicalPayload: payload }));
    }
  }

  for (const event of config.irrigation_events) {
    const plan = bindings.get('APPROVED_IRRIGATION_PLAN');
    const planRoleTime = withAvailability(plan, { created_at: event.plan_created_at, approved_at: event.plan_approved_at, ingested_at: event.plan_ingested_at, plan_effective_from: event.plan_effective_from, plan_effective_to: event.plan_effective_to });
    const planPayload = { event_id: event.event_id, approved_amount_mm: event.approved_amount_mm, spatial_scope: scope.zone_id, status: 'APPROVED' };
    add('APPROVED_IRRIGATION_PLAN', 'plans', buildCommon({ config, binding: plan, scope, sourceRecordId: deterministicId(config, plan, planRoleTime, event.event_id, planPayload), roleTime: planRoleTime, quality: { status: 'PASS' }, sourcePayload: planPayload, canonicalPayload: planPayload }));

    const execution = bindings.get('IRRIGATION_EXECUTION_EVIDENCE');
    const executionRoleTime = withAvailability(execution, { executed_at: event.executed_at, ingested_at: event.execution_ingested_at });
    const executionPayload = { event_id: event.event_id, executed_amount_mm: event.executed_amount_mm, coverage_fraction: event.coverage_fraction, spatial_scope: scope.zone_id };
    add('IRRIGATION_EXECUTION_EVIDENCE', 'executions', buildCommon({ config, binding: execution, scope, sourceRecordId: deterministicId(config, execution, executionRoleTime, event.event_id, executionPayload), roleTime: executionRoleTime, quality: { status: 'PASS' }, sourcePayload: executionPayload, canonicalPayload: executionPayload }));
  }

  const folderByRole = { SOIL_MOISTURE_OBSERVATION: 'soil_moisture', RAINFALL_OBSERVATION: 'rainfall', HISTORICAL_ET0_INPUT: 'historical_et0', FUTURE_WEATHER_ASSUMPTION: 'future_weather', FUTURE_ET0_ASSUMPTION: 'future_et0', APPROVED_IRRIGATION_PLAN: 'irrigation_plan', IRRIGATION_EXECUTION_EVIDENCE: 'irrigation_execution' };
  const files = [];
  const recordsByRole = new Map(requiredRoles.map((role) => [role, []]));
  for (const [key, records] of [...daily.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    const [role, date] = key.split('|');
    records.sort((a, b) => a.source_record_id.localeCompare(b.source_record_id));
    recordsByRole.get(role).push(...records);
    const name = role === 'APPROVED_IRRIGATION_PLAN' ? 'plans.jsonl' : role === 'IRRIGATION_EXECUTION_EVIDENCE' ? 'executions.jsonl' : `${date}.jsonl`;
    const relative = path.posix.join(folderByRole[role], name);
    files.push({ path: relative, role, ...writeJsonl(path.join(outputDirectory, relative), records) });
  }
  const perRoleSemanticHash = {};
  for (const role of requiredRoles) perRoleSemanticHash[role] = sha256(canonical(recordsByRole.get(role).map((record) => record.source_record_hash).sort()));
  const manifest = {
    schema_version: 'geox_mcft_cap_01_replay_dataset_manifest_v1', dataset_id: config.dataset_id, dataset_truth_class: config.dataset_truth_class,
    coverage_start: config.coverage_start, coverage_end_exclusive: config.coverage_end_exclusive, timezone: config.timezone,
    hourly_interval_count: config.hourly_interval_count, top_level_record_count: Object.values(roleCounts).reduce((sum, value) => sum + value, 0),
    role_counts: roleCounts, file_count: files.length, files, per_role_semantic_hash: perRoleSemanticHash,
    whole_dataset_semantic_hash: sha256(canonical({ config, roleCounts, file_hashes: files.map((file) => [file.path, file.sha256]) })),
    generator_contract: { encoding: config.encoding, line_ending: config.line_ending, trailing_newline: config.trailing_newline, record_order: 'source_record_id ascending within deterministic shard order' },
  };
  fs.writeFileSync(path.join(outputDirectory, 'manifest.json'), `${canonical(manifest)}\n`, 'utf8');
  return manifest;
}

function parseArgs(argv) {
  const options = {};
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--output') options.outputDirectory = path.resolve(argv[++i]);
    else if (argv[i] === '--config') options.configPath = path.resolve(argv[++i]);
    else if (argv[i] === '--source-matrix') options.sourceMatrixPath = path.resolve(argv[++i]);
    else if (argv[i] === '--reality') options.realityPath = path.resolve(argv[++i]);
    else throw new Error(`UNKNOWN_ARGUMENT:${argv[i]}`);
  }
  return options;
}

if (require.main === module) {
  const manifest = generate(parseArgs(process.argv.slice(2)));
  process.stdout.write(`${JSON.stringify({ ok: true, dataset_id: manifest.dataset_id, records: manifest.top_level_record_count, files: manifest.file_count, hash: manifest.whole_dataset_semantic_hash })}\n`);
}

module.exports = { canonical, deriveAvailableToRuntimeAt, generate, recordHash, round6, sha256 };
