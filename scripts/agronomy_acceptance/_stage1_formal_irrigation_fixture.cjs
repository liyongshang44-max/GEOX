const { randomUUID } = require('node:crypto');

const FORMAL_RAW_SAMPLE_METRICS = [
  'soil_moisture',
  'inlet_flow_lpm',
  'outlet_flow_lpm',
  'pressure_drop_kpa',
];
const FORMAL_SAMPLE_POINT_COUNT = 12;
const FORMAL_SAMPLE_INTERVAL_MS = 30 * 60 * 1000;
const SAMPLE_WINDOW_START_BUFFER_MS = ((5 * 60) + 50) * 60 * 1000;

function bool(v) {
  return v === true || v === '1' || String(v ?? '').toLowerCase() === 'true';
}

function nowMsFrom(opts) {
  return Number.isFinite(Number(opts?.now_ms)) ? Number(opts.now_ms) : Date.now();
}

function inferSeasonIdFromFieldId(field_id) {
  const field = String(field_id ?? '').trim();
  let match = field.match(/^demo_field_mvp0_(\d+)$/);
  if (match) return `season_mvp0_${match[1]}`;
  match = field.match(/^field_gap_closure_(\d+)$/);
  if (match) return `season_gap_closure_${match[1]}`;
  return null;
}

async function seedFormalCropContextV1(pool, {
  tenant_id,
  project_id,
  group_id,
  field_id,
  season_id,
  crop_code = 'corn',
  crop_stage = 'V8',
  now_ms = Date.now(),
}) {
  const fact_id = `cropctx_${randomUUID()}`;
  const record = {
    type: 'crop_context_v1',
    schema_version: '1',
    payload: {
      tenant_id,
      project_id,
      group_id,
      field_id,
      season_id,
      status: 'PLANTED_CONFIRMED',
      crop_code,
      crop_stage,
      variety_code: 'demo_corn',
      planting_date: new Date(now_ms - 45 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
      confidence: 0.9,
      source: 'USER_DECLARED',
      fixture: 'commercial_mvp0_crop_context',
    },
  };

  await pool.query(
    `INSERT INTO facts (fact_id, occurred_at, source, record_json)
     VALUES ($1, to_timestamp($2 / 1000.0), 'acceptance_fixture', $3::jsonb)
     ON CONFLICT (fact_id) DO NOTHING`,
    [fact_id, now_ms, JSON.stringify(record)]
  );

  return { fact_id, crop_context: record.payload };
}

async function ensureStage1FixtureColumns(pool) {
  await pool.query(`ALTER TABLE derived_sensing_state_index_v1 ADD COLUMN IF NOT EXISTS project_id text`);
  await pool.query(`ALTER TABLE derived_sensing_state_index_v1 ADD COLUMN IF NOT EXISTS group_id text`);
  await pool.query(`ALTER TABLE derived_sensing_state_index_v1 ADD COLUMN IF NOT EXISTS source_observation_ids_json jsonb NOT NULL DEFAULT '[]'::jsonb`);
}

function buildRawSampleRows({
  tenant_id,
  project_id,
  group_id,
  field_id,
  device_id,
  now_ms,
  sample_mode,
  pre_soil_moisture,
}) {
  if (sample_mode === 'insufficient') {
    const ts = now_ms - 10 * 60 * 1000;
    return [{
      sample_id: `rs_${randomUUID()}`,
      sensor_id: device_id,
      ts_ms: ts,
      metric: 'soil_moisture',
      value: pre_soil_moisture,
      qc_quality: 'ok',
      source: 'device',
      payload_json: { tenant_id, project_id, group_id, field_id, device_id, fixture: 'stage1_formal_irrigation', sample_mode },
    }];
  }

  const staleOffset = sample_mode === 'stale' ? 48 * 60 * 60 * 1000 : 0;
  const sampleStartTs = now_ms - staleOffset - SAMPLE_WINDOW_START_BUFFER_MS;
  const rows = [];
  for (let i = 0; i < FORMAL_SAMPLE_POINT_COUNT; i += 1) {
    const ts = sampleStartTs + (i * FORMAL_SAMPLE_INTERVAL_MS);
    const base = {
      sample_id: `rs_${randomUUID()}`,
      sensor_id: device_id,
      ts_ms: ts,
      qc_quality: 'ok',
      source: 'device',
      payload_json: { tenant_id, project_id, group_id, field_id, device_id, fixture: 'stage1_formal_irrigation', sample_mode },
    };
    rows.push({ ...base, metric: 'soil_moisture', value: Number((pre_soil_moisture + i * 0.001).toFixed(4)) });
    rows.push({ ...base, sample_id: `rs_${randomUUID()}`, metric: 'inlet_flow_lpm', value: 12.5 });
    rows.push({ ...base, sample_id: `rs_${randomUUID()}`, metric: 'outlet_flow_lpm', value: 12.1 });
    rows.push({ ...base, sample_id: `rs_${randomUUID()}`, metric: 'pressure_drop_kpa', value: 6.5 });
  }
  return rows;
}

async function insertRawSamples(pool, rows) {
  for (const row of rows) {
    await pool.query(
      `INSERT INTO raw_samples
        (sample_id, sensor_id, ts_ms, metric, value, qc_quality, source, payload_json)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb)
       ON CONFLICT (sample_id) DO NOTHING`,
      [
        row.sample_id,
        row.sensor_id,
        row.ts_ms,
        row.metric,
        row.value,
        row.qc_quality,
        row.source,
        JSON.stringify(row.payload_json),
      ]
    );
  }
}

async function insertDeviceObservations(pool, {
  tenant_id,
  project_id,
  group_id,
  field_id,
  device_id,
  now_ms,
  sample_mode,
  pre_soil_moisture,
  observation_id,
}) {
  const observedAt = sample_mode === 'stale' ? now_ms - 48 * 60 * 60 * 1000 : now_ms - 5 * 60 * 1000;
  await pool.query(
    `INSERT INTO device_observation_index_v1
      (tenant_id, project_id, group_id, field_id, device_id, metric, observed_at, observed_at_ts_ms, value_num, confidence, fact_id)
     VALUES ($1,$2,$3,$4,$5,'soil_moisture',to_timestamp($6 / 1000.0),$6,$7,0.93,$8)
     ON CONFLICT DO NOTHING`,
    [tenant_id, project_id, group_id, field_id, device_id, observedAt, pre_soil_moisture, observation_id]
  );
}

async function insertDerivedStates(pool, {
  tenant_id,
  project_id,
  group_id,
  field_id,
  now_ms,
  sample_mode,
  observation_ids,
}) {
  const computedAt = sample_mode === 'stale' ? now_ms - 48 * 60 * 60 * 1000 : now_ms - 4 * 60 * 1000;
  const sourceObservedAt = computedAt;
  const rows = [
    ['irrigation_effectiveness_state', { level: 'LOW', irrigation_effectiveness: 'low', source_observed_at_ts_ms: sourceObservedAt, action_hint: 'irrigate' }, 0.96, randomUUID()],
    ['leak_risk_state', { level: 'LOW', leak_risk: 'low', source_observed_at_ts_ms: sourceObservedAt }, 0.94, randomUUID()],
    ['sensor_quality_state', { level: 'GOOD', sensor_quality_level: 'GOOD', source_observed_at_ts_ms: sourceObservedAt }, 0.95, randomUUID()],
    ['canopy_temperature_state', { level: 'normal', canopy_temp_status: 'normal', source_observed_at_ts_ms: sourceObservedAt }, 0.9, randomUUID()],
    ['evapotranspiration_risk_state', { level: 'high', evapotranspiration_risk: 'high', source_observed_at_ts_ms: sourceObservedAt }, 0.9, randomUUID()],
  ];

  for (const [stateType, payload, confidence, factId] of rows) {
    await pool.query(
      `INSERT INTO derived_sensing_state_index_v1
        (tenant_id, project_id, group_id, field_id, state_type, payload_json, confidence, explanation_codes_json, source_device_ids_json, computed_at, computed_at_ts_ms, fact_id, source_observation_ids_json)
       VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7,'[]'::jsonb,'[]'::jsonb,to_timestamp($8 / 1000.0),$8,$9,$10::jsonb)
       ON CONFLICT DO NOTHING`,
      [tenant_id, project_id, group_id, field_id, stateType, JSON.stringify(payload), confidence, computedAt, factId, JSON.stringify(observation_ids)]
    );
  }
}

async function insertDeviceRuntimeRows(pool, {
  tenant_id,
  project_id,
  group_id,
  field_id,
  device_id,
  now_ms,
}) {
  await pool.query(
    `INSERT INTO device_status_index_v1
      (tenant_id, project_id, group_id, device_id, last_telemetry_ts_ms, last_heartbeat_ts_ms, battery_percent, rssi_dbm, fw_ver, updated_ts_ms)
     VALUES ($1,$2,$3,$4,$5,$5,95,-55,'mvp0-test',$5)
     ON CONFLICT (tenant_id, device_id) DO UPDATE SET
       project_id = EXCLUDED.project_id,
       group_id = EXCLUDED.group_id,
       last_telemetry_ts_ms = EXCLUDED.last_telemetry_ts_ms,
       last_heartbeat_ts_ms = EXCLUDED.last_heartbeat_ts_ms,
       battery_percent = EXCLUDED.battery_percent,
       rssi_dbm = EXCLUDED.rssi_dbm,
       fw_ver = EXCLUDED.fw_ver,
       updated_ts_ms = EXCLUDED.updated_ts_ms`,
    [tenant_id, project_id, group_id, device_id, now_ms]
  );

  await pool.query(
    `INSERT INTO device_binding_index_v1
      (tenant_id, device_id, field_id, bound_ts_ms)
     VALUES ($1,$2,$3,$4)
     ON CONFLICT (tenant_id, device_id, field_id) DO UPDATE SET
       field_id = EXCLUDED.field_id,
       bound_ts_ms = EXCLUDED.bound_ts_ms`,
    [tenant_id, device_id, field_id, now_ms]
  );

  await pool.query(
    `INSERT INTO device_capability
      (tenant_id, device_id, capabilities, updated_ts_ms)
     VALUES ($1,$2,$3::jsonb,$4)
     ON CONFLICT (tenant_id, device_id) DO UPDATE SET
       capabilities = EXCLUDED.capabilities,
       updated_ts_ms = EXCLUDED.updated_ts_ms`,
    [
      tenant_id,
      device_id,
      JSON.stringify([
        'device.irrigation.valve.open',
        'irrigation.valve.open',
        'IRRIGATION_CONTROLLER',
      ]),
      now_ms,
    ]
  );
}

async function seedFormalIrrigationStage1Evidence(pool, opts) {
  const tenant_id = opts.tenant_id;
  const project_id = opts.project_id;
  const group_id = opts.group_id;
  const field_id = opts.field_id;
  const device_id = opts.device_id;
  const now_ms = nowMsFrom(opts);
  const season_id = opts.season_id ?? inferSeasonIdFromFieldId(field_id);
  const pre_soil_moisture = Number(opts.pre_soil_moisture ?? 0.16);
  const sample_mode = opts.sample_mode
    ?? (bool(opts.simulate_stale) ? 'stale' : bool(opts.simulate_insufficient_evidence) ? 'insufficient' : 'formal');

  await ensureStage1FixtureColumns(pool);

  const crop_context_seed = season_id
    ? await seedFormalCropContextV1(pool, { tenant_id, project_id, group_id, field_id, season_id, crop_code: opts.crop_code ?? 'corn', crop_stage: opts.crop_stage ?? 'V8', now_ms })
    : null;

  const rawRows = buildRawSampleRows({ tenant_id, project_id, group_id, field_id, device_id, now_ms, sample_mode, pre_soil_moisture });
  const rawSampleIds = rawRows.map((x) => x.sample_id);
  const observation_id = opts.observation_id ?? `obs_stage1_irrigation_${randomUUID()}`;

  await insertRawSamples(pool, rawRows);
  await insertDeviceObservations(pool, { tenant_id, project_id, group_id, field_id, device_id, now_ms, sample_mode, pre_soil_moisture, observation_id });
  await insertDerivedStates(pool, { tenant_id, project_id, group_id, field_id, now_ms, sample_mode, observation_ids: [observation_id, ...rawSampleIds.slice(0, 5)] });
  await insertDeviceRuntimeRows(pool, { tenant_id, project_id, group_id, field_id, device_id, now_ms });

  return {
    field_id,
    device_id,
    season_id,
    crop_context_seed,
    observation_id,
    raw_sample_ids: rawSampleIds,
    sample_mode,
    formal_sample_count: sample_mode === 'formal' ? rawSampleIds.length : rawRows.filter((x) => x.source === 'device').length,
    stage1_sensing_summary: {
      irrigation_effectiveness: 'low',
      leak_risk: 'low',
      canopy_temp_status: 'normal',
      evapotranspiration_risk: 'high',
      sensor_quality_level: 'GOOD',
    },
  };
}

module.exports = { seedFormalIrrigationStage1Evidence, seedFormalCropContextV1 };
