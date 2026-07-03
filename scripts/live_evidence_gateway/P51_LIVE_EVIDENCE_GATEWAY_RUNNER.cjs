// scripts/live_evidence_gateway/P51_LIVE_EVIDENCE_GATEWAY_RUNNER.cjs
'use strict';

// Load Node core modules only so the runner works without workspace builds.
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

// Keep every path explicit so P51 stays self-contained.
const MANIFEST_PATH = 'fixtures/live_evidence_gateway/P51_GATEWAY_INPUT_MANIFEST.json';
const SENML_PATH = 'fixtures/live_evidence_gateway/P51_SENML_DEVICE_SAMPLE_FIXTURE.jsonl';
const NEGATIVE_MANIFEST_PATH = 'fixtures/live_evidence_gateway/P51_NEGATIVE_FIXTURE_MANIFEST.json';
const LEDGER_PATH = 'acceptance-output/P51_LIVE_EVIDENCE_GATEWAY_LEDGER.jsonl';
const REPORT_PATH = 'acceptance-output/P51_LIVE_EVIDENCE_GATEWAY_REPORT.json';
const SNAPSHOT_PATH = 'acceptance-output/P51_GATEWAY_VIEWER_SNAPSHOT.json';

// Freeze the P51 metric catalog from the current GEOX contracts snapshot.
const METRICS = Object.freeze({
  soil_moisture: { unit: '%VWC', aliases: ['%', 'VWC%', 'm3/m3'], min: 0, max: 100 },
  soil_temperature: { unit: '°C', aliases: ['C', 'celsius', '℃'], min: -40, max: 85 },
  air_temperature: { unit: '°C', aliases: ['C', 'celsius'], min: -40, max: 85 },
  air_humidity: { unit: '%RH', aliases: ['%', 'RH%'], min: 0, max: 100 },
  water_pressure: { unit: 'kPa', aliases: ['kpa', 'KPA', 'kilopascal'], min: 0, max: 1600 },
});

// Keep compatibility aliases local to P51 instead of importing production packages.
const METRIC_ALIASES = Object.freeze({
  soil_temp: 'soil_temperature',
  soil_temp_c: 'soil_temperature',
  air_temp: 'air_temperature',
  humidity: 'air_humidity',
  pressure: 'water_pressure',
  pressure_kpa: 'water_pressure',
  water_pressure_kpa: 'water_pressure',
});

// Keep health evidence separate from runtime health.
const HEALTH_NAMES = new Set(['battery_percent', 'rssi_dbm', 'fw_ver']);

// Compute stable SHA-256 ids and hashes.
function sha256Hex(value) {
  return crypto.createHash('sha256').update(String(value), 'utf8').digest('hex');
}

// Stable stringify keeps deterministic hashes independent of object insertion order.
function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

// Read JSON from disk.
function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

// Read JSONL where each line can contain one SenML pack.
function readJsonl(filePath) {
  return fs.readFileSync(filePath, 'utf8').trim().split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
}

// Derive the device id from the P51 base name convention.
function deviceIdFromBaseName(baseName) {
  const match = String(baseName || '').match(/device:([^:]+):?$/);
  if (!match) throw new Error('BASE_NAME_UNSUPPORTED');
  return match[1];
}

// Canonicalize metric names with P51 frozen aliases.
function canonicalMetric(rawMetric) {
  const normalized = String(rawMetric || '').trim().toLowerCase().replace(/\s+/g, '_');
  return METRIC_ALIASES[normalized] || normalized;
}

// Canonicalize unit and optionally convert m3/m3 soil moisture to %VWC.
function canonicalValueUnit(metric, value, unit, manifest) {
  const spec = METRICS[metric];
  if (!spec) throw new Error('METRIC_UNSUPPORTED');
  const incomingUnit = String(unit || '').trim();
  if (!Number.isFinite(value)) throw new Error('VALUE_REQUIRED');

  if (metric === 'soil_moisture' && incomingUnit === 'm3/m3') {
    const profile = manifest.unit_conversion_profile?.soil_moisture_m3m3_to_percent_vwc;
    if (!profile?.enabled) throw new Error('UNIT_UNSUPPORTED');
    return { value: value * Number(profile.factor), unit: spec.unit, explanation: 'converted_m3m3_to_percent_vwc' };
  }

  if (incomingUnit === spec.unit || (spec.aliases || []).includes(incomingUnit)) {
    return { value, unit: spec.unit, explanation: incomingUnit === spec.unit ? 'canonical_unit' : 'alias_unit_normalized' };
  }

  throw new Error('UNIT_UNSUPPORTED');
}

// Block P51 boundary leaks encoded in fixtures.
function assertNoBoundaryClaim(record) {
  const claim = String(record.claim || '').trim();
  if (!claim) return;
  if (claim.includes('runtime_health') || claim.includes('production') || claim.includes('field_pilot')) {
    throw new Error('BOUNDARY_CLAIM_FORBIDDEN');
  }
}

// Resolve a SenML pack into metric observations and health evidence.
function resolveSenmlPack(pack, manifest) {
  if (!Array.isArray(pack) || pack.length < 1) throw new Error('SENML_PACK_REQUIRED');
  const base = pack[0];
  if (!base.bn) throw new Error('BASE_NAME_REQUIRED');
  if (typeof base.bt !== 'number' || !Number.isFinite(base.bt)) throw new Error('SENML_BASE_TIME_REQUIRED');

  const deviceId = deviceIdFromBaseName(base.bn);
  const packCredential = pack.find((record) => typeof record.credential === 'string')?.credential;
  if (packCredential && packCredential !== manifest.credential_id) throw new Error('CREDENTIAL_MISMATCH');

  const observations = [];
  const health = {};

  for (const record of pack) {
    assertNoBoundaryClaim(record);
    const name = String(record.n || '').trim();
    if (!name) continue;
    const tsSeconds = base.bt + Number(record.t || 0);
    if (!Number.isFinite(tsSeconds)) throw new Error('RELATIVE_TIME_UNRESOLVED');
    const observedMs = Math.round(tsSeconds * 1000);

    if (HEALTH_NAMES.has(name)) {
      health[name] = Object.prototype.hasOwnProperty.call(record, 'vs') ? record.vs : record.v;
      continue;
    }

    if (!Object.prototype.hasOwnProperty.call(record, 'v')) throw new Error('VALUE_REQUIRED');
    const metric = canonicalMetric(name);
    const numericValue = Number(record.v);
    const unit = record.u || base.bu;
    const canonical = canonicalValueUnit(metric, numericValue, unit, manifest);
    const spec = METRICS[metric];
    const qc = canonical.value >= spec.min && canonical.value <= spec.max ? 'ok' : 'suspect';

    observations.push({
      device_id: deviceId,
      metric,
      value: Number(canonical.value.toFixed(6)),
      unit: canonical.unit,
      observed_at_ts_ms: observedMs,
      observed_at: new Date(observedMs).toISOString(),
      qc_quality: qc,
      explanation: canonical.explanation,
    });
  }

  return { device_id: deviceId, observations, health };
}

// Build SensorThings-style observations from resolved records.
function toSensorThingsObservation(manifest, obs) {
  const id = `sta_${sha256Hex(`${manifest.manifest_id}|${obs.device_id}|${obs.metric}|${obs.observed_at_ts_ms}`).slice(0, 24)}`;
  return {
    '@iot.id': id,
    phenomenonTime: obs.observed_at,
    resultTime: manifest.ingested_at,
    result: obs.value,
    resultUnit: obs.unit,
    Datastream: { name: obs.metric },
    ObservedProperty: { name: obs.metric },
    FeatureOfInterest: { name: manifest.field_id },
    Thing: { name: obs.device_id },
  };
}

// Build SOSA-style semantic observations.
function toSosaObservation(manifest, obs) {
  return {
    '@type': 'sosa:Observation',
    'sosa:madeBySensor': obs.device_id,
    'sosa:observedProperty': obs.metric,
    'sosa:hasFeatureOfInterest': manifest.field_id,
    'sosa:hasSimpleResult': `${obs.value} ${obs.unit}`,
    'sosa:resultTime': manifest.ingested_at,
  };
}

// Build GEOX RawSampleFactEnvelopeV1-compatible envelope.
function toRawSampleEnvelope(manifest, obs) {
  const idBase = `${manifest.tenant_id}|${manifest.field_id}|${obs.device_id}|${obs.metric}|${obs.observed_at_ts_ms}`;
  return {
    sample_id: `sample_${sha256Hex(idBase).slice(0, 24)}`,
    sensor_id: obs.device_id,
    group_id: manifest.group_id,
    project_id: manifest.project_id,
    field_id: manifest.field_id,
    ts_ms: obs.observed_at_ts_ms,
    metric: obs.metric,
    value: obs.value,
    unit: obs.unit,
    qc_quality: obs.qc_quality,
    source: 'gateway',
    payload_json: {
      p51_manifest_id: manifest.manifest_id,
      standards_refs: ['SenML', 'SensorThings-Sensing', 'SOSA'],
      explanation: obs.explanation,
    },
    fact_id: `fact_${sha256Hex(`raw|${idBase}`).slice(0, 32)}`,
    created_at: manifest.ingested_at,
    interpolated: false,
    synthetic: false,
  };
}

// Build GEOX DeviceObservationV1-compatible envelope.
function toDeviceObservation(manifest, obs) {
  return {
    type: 'device_observation_v1',
    schema_version: '1.0.0',
    tenant_id: manifest.tenant_id,
    project_id: manifest.project_id,
    group_id: manifest.group_id,
    field_id: manifest.field_id,
    device_id: obs.device_id,
    observed_at: obs.observed_at,
    ingested_at: manifest.ingested_at,
    metric_key: obs.metric,
    metric_value: obs.value,
    metric_unit: obs.unit,
    confidence: obs.qc_quality === 'ok' ? 0.9 : 0.45,
    quality_flags: obs.qc_quality === 'ok' ? ['OK'] : ['SUSPECT'],
    explanation_codes: ['p51_senml_gateway_mapping', obs.explanation],
  };
}

// Build device evidence health envelope only, not runtime health.
function toHealthEnvelope(manifest, deviceId, health) {
  return {
    record_type: 'p51_sensor_health_envelope_v1',
    device_id: deviceId,
    field_id: manifest.field_id,
    observed_at: manifest.ingested_at,
    battery_percent: health.battery_percent ?? null,
    rssi_dbm: health.rssi_dbm ?? null,
    fw_ver: health.fw_ver ?? null,
    health_scope: 'device_evidence_health_only',
  };
}

// Build viewer-ready snapshot for later UI/read-model discussion.
function toSnapshot(manifest, observations, healthEnvelope, hashes) {
  return {
    schema_version: 'geox_p51_gateway_viewer_snapshot_v1',
    phase: 'P51',
    snapshot_type: 'viewer_ready_gateway_snapshot',
    gateway_scope: {
      tenant_id: manifest.tenant_id,
      project_id: manifest.project_id,
      group_id: manifest.group_id,
      field_id: manifest.field_id,
      device_id: manifest.device_id,
      device_source_simulated: true,
      live_gateway_path_proof: true,
    },
    observation_summary: {
      count: observations.length,
      metrics: observations.map((obs) => obs.metric),
      first_observed_at: observations[0]?.observed_at || null,
      last_observed_at: observations.at(-1)?.observed_at || null,
    },
    health_evidence: healthEnvelope,
    standards_refs: ['SenML', 'SensorThings-Sensing', 'SOSA'],
    geox_compatibility_refs: ['RawSampleFactEnvelopeV1', 'DeviceObservationV1'],
    hashes,
  };
}

// Build all P51 records from the controlled fixture.
function buildRun(manifestPath = MANIFEST_PATH, senmlPath = SENML_PATH) {
  const manifest = readJson(manifestPath);
  const packs = readJsonl(senmlPath);
  const resolved = packs.flatMap((pack) => {
    const out = resolveSenmlPack(pack, manifest);
    return [{ kind: 'pack', out }];
  });
  const pack = resolved[0].out;
  const observations = pack.observations;
  const healthEnvelope = toHealthEnvelope(manifest, pack.device_id, pack.health);
  const sensorThings = observations.map((obs) => toSensorThingsObservation(manifest, obs));
  const sosa = observations.map((obs) => toSosaObservation(manifest, obs));
  const rawSamples = observations.map((obs) => toRawSampleEnvelope(manifest, obs));
  const deviceObservations = observations.map((obs) => toDeviceObservation(manifest, obs));

  const hashes = {
    resolved_senml_hash: sha256Hex(stableStringify(observations)),
    sensorthings_hash: sha256Hex(stableStringify(sensorThings)),
    sosa_hash: sha256Hex(stableStringify(sosa)),
    geox_raw_hash: sha256Hex(stableStringify(rawSamples)),
    device_observation_hash: sha256Hex(stableStringify(deviceObservations)),
    health_hash: sha256Hex(stableStringify(healthEnvelope)),
  };
  const snapshot = toSnapshot(manifest, observations, healthEnvelope, hashes);
  const records = [
    { record_type: 'p51_gateway_input_manifest_v1', demo_scoped: true, payload: manifest },
    ...observations.map((payload) => ({ record_type: 'p51_resolved_senml_record_v1', demo_scoped: true, payload })),
    ...sensorThings.map((payload) => ({ record_type: 'p51_sensorthings_observation_v1', demo_scoped: true, payload })),
    ...sosa.map((payload) => ({ record_type: 'p51_sosa_observation_v1', demo_scoped: true, payload })),
    ...rawSamples.map((payload) => ({ record_type: 'p51_geox_raw_sample_envelope_v1', demo_scoped: true, payload })),
    ...deviceObservations.map((payload) => ({ record_type: 'p51_device_observation_compat_v1', demo_scoped: true, payload })),
    { record_type: 'p51_sensor_health_envelope_v1', demo_scoped: true, payload: healthEnvelope },
    { record_type: 'p51_gateway_snapshot_v1', demo_scoped: true, payload: snapshot },
  ].map((record, index) => ({
    ...record,
    idempotency_key: `p51:${index}:${sha256Hex(stableStringify(record)).slice(0, 24)}`,
  }));

  const deterministic_hash = sha256Hex(stableStringify(records));
  return { manifest, observations, healthEnvelope, sensorThings, sosa, rawSamples, deviceObservations, snapshot, records, hashes, deterministic_hash };
}

// Write only acceptance-output artifacts.
function writeOutputs(run) {
  fs.mkdirSync('acceptance-output', { recursive: true });
  fs.writeFileSync(LEDGER_PATH, `${run.records.map((record) => JSON.stringify(record)).join('\n')}\n`, 'utf8');
  fs.writeFileSync(SNAPSHOT_PATH, JSON.stringify(run.snapshot, null, 2), 'utf8');
  fs.writeFileSync(REPORT_PATH, JSON.stringify(toReport(run), null, 2), 'utf8');
}

// Build user-facing report JSON.
function toReport(run) {
  return {
    ok: true,
    phase: 'P51',
    source_truth_mode: run.manifest.source_truth_mode,
    device_source_simulated: true,
    live_gateway_path_proof: true,
    real_live_device_proof: false,
    observation_count: run.observations.length,
    health_envelope_count: 1,
    metric_count: new Set(run.observations.map((obs) => obs.metric)).size,
    raw_sample_count: run.rawSamples.length,
    device_observation_count: run.deviceObservations.length,
    target_records_created: 0,
    acceptance_output_only: true,
    deterministic_hash: run.deterministic_hash,
    ...run.hashes,
  };
}

// Run one real negative fixture and require it to block before producing records.
function runNegative(fileName) {
  const manifest = readJson(MANIFEST_PATH);
  const negativeManifest = readJson(NEGATIVE_MANIFEST_PATH);
  const filePath = path.join(negativeManifest.fixture_dir, fileName);
  const bad = readJson(filePath);
  let blocked = false;
  let error = null;
  try {
    resolveSenmlPack(bad.pack, manifest);
  } catch (err) {
    blocked = true;
    error = String(err.message || err);
  }
  return {
    ok: blocked && error === bad.expected_error,
    phase: 'P51',
    negative_fixture: fileName,
    result_state: blocked ? 'BLOCKED' : 'UNBLOCKED',
    expected_error: bad.expected_error,
    actual_error: error,
    target_records_created: 0,
  };
}

// Parse command line flags.
const args = process.argv.slice(2);
const modeArg = args.includes('--mode') ? args[args.indexOf('--mode') + 1] : 'dry-run';
const negativeArg = args.includes('--negative') ? args[args.indexOf('--negative') + 1] : null;

if (negativeArg) {
  console.log(JSON.stringify(runNegative(negativeArg), null, 2));
  process.exit(0);
}

const run = buildRun();
if (modeArg === 'controlled-write') writeOutputs(run);

console.log(JSON.stringify({
  ...toReport(run),
  mode: modeArg,
  records: run.records,
  snapshot: run.snapshot,
}, null, 2));
