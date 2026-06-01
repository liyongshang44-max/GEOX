#!/usr/bin/env node
const { randomUUID } = require('node:crypto');
const pg = require('pg');

const { Pool } = pg;
const SOURCE_LANE = 'DEMO_CONTROLLED_PILOT';
const FACT_TYPE = 'demo_controlled_pilot_frontend_seed_v1';
const ALLOWED_TENANTS = new Set(['demo', 'tenantA']);

function argValue(name) {
  const idx = process.argv.indexOf(name);
  if (idx === -1) return '';
  return String(process.argv[idx + 1] ?? '').trim();
}
function hasFlag(name) {
  return process.argv.includes(name);
}
function poolConfig() {
  if (process.env.DATABASE_URL) return { connectionString: process.env.DATABASE_URL };
  return {
    host: process.env.PGHOST || '127.0.0.1',
    port: Number(process.env.PGPORT || 5433),
    user: process.env.PGUSER || 'landos',
    password: process.env.PGPASSWORD || 'landos_pwd',
    database: process.env.PGDATABASE || 'landos',
  };
}
function nowIso() {
  return new Date().toISOString();
}
function demoFacts(tenantId) {
  const projectId = tenantId === 'tenantA' ? 'projectA' : 'demo_project';
  const groupId = tenantId === 'tenantA' ? 'groupA' : 'demo_group';
  const fieldId = 'field_c8_demo';
  const seasonId = 'season_demo_c8_corn';
  const sensorId = 'dev_demo_soil_moisture_c8_001';
  const actuatorId = 'dev_demo_valve_pump_c8_001';
  const offlineDeviceId = 'dev_demo_edge_gateway_c8_offline_001';
  return [
    {
      seed_id: 'tenant_controlled_pilot_demo',
      entity_type: 'tenant',
      tenant_id: tenantId,
      project_id: projectId,
      group_id: groupId,
      display_name: tenantId === 'tenantA' ? 'tenantA controlled pilot' : 'demo controlled pilot',
    },
    {
      seed_id: 'field_c8_irrigation_demo',
      entity_type: 'field',
      tenant_id: tenantId,
      project_id: projectId,
      group_id: groupId,
      field_id: fieldId,
      field_name: 'C8 灌溉示范田',
      crop: '玉米',
      crop_stage: '营养生长期',
      geometry_id: 'geom_c8_demo_polygon',
      polygon: [[116.391, 39.901], [116.394, 39.901], [116.394, 39.904], [116.391, 39.904], [116.391, 39.901]],
    },
    {
      seed_id: 'season_c8_corn_demo',
      entity_type: 'crop_season',
      tenant_id: tenantId,
      project_id: projectId,
      group_id: groupId,
      field_id: fieldId,
      season_id: seasonId,
      crop: '玉米',
      crop_stage: '营养生长期',
    },
    {
      seed_id: 'soil_moisture_sensor_c8_demo',
      entity_type: 'device',
      tenant_id: tenantId,
      project_id: projectId,
      group_id: groupId,
      field_id: fieldId,
      device_id: sensorId,
      device_kind: 'soil_moisture_sensor',
      online_status: 'ONLINE',
      last_telemetry: { soil_moisture: 18.4, unit: 'percent', depth_cm: 20 },
    },
    {
      seed_id: 'valve_pump_c8_demo',
      entity_type: 'device',
      tenant_id: tenantId,
      project_id: projectId,
      group_id: groupId,
      field_id: fieldId,
      device_id: actuatorId,
      device_kind: 'simulated_valve_pump',
      online_status: 'ONLINE',
      capability: ['irrigation_valve', 'pump_control'],
    },
    {
      seed_id: 'formal_irrigation_display_record_c8_demo',
      entity_type: 'formal_irrigation_display_record',
      tenant_id: tenantId,
      project_id: projectId,
      group_id: groupId,
      field_id: fieldId,
      season_id: seasonId,
      operation_id: 'op_demo_c8_irrigation_display_001',
      title: 'C8 灌溉示范田正式灌溉展示记录',
      status: 'DISPLAY_ONLY_NOT_FORMAL_ACCEPTANCE',
      recommendation: { water_mm: 22, reason: '土壤水分低于示范阈值，建议补灌。' },
      execution: { actuator_device_id: actuatorId, display_status: 'simulated_completed_for_demo' },
    },
    {
      seed_id: 'pest_disease_inspection_display_record_c8_demo',
      entity_type: 'pest_disease_inspection_display_record',
      tenant_id: tenantId,
      project_id: projectId,
      group_id: groupId,
      field_id: fieldId,
      season_id: seasonId,
      inspection_id: 'pdi_demo_c8_001',
      title: 'C8 玉米病虫害巡检展示记录',
      status: 'DISPLAY_ONLY_NOT_FORMAL_ACCEPTANCE',
      observation: { severity_percent: 6, incidence_percent: 8, scout_note: '叶片轻微虫咬痕迹，建议后续复核。' },
    },
    {
      seed_id: 'device_offline_display_record_c8_demo',
      entity_type: 'device_offline_display_record',
      tenant_id: tenantId,
      project_id: projectId,
      group_id: groupId,
      field_id: fieldId,
      device_id: offlineDeviceId,
      online_status: 'OFFLINE',
      title: 'C8 设备异常/离线展示记录',
      status: 'DISPLAY_ONLY_OPERATOR_FOLLOWUP_REQUIRED',
      handling: { allowed_actions: ['ACK_DEVICE_OFFLINE', 'MARK_DEVICE_OFFLINE_FOLLOWUP', 'CREATE_OFFLINE_INSPECTION_TASK_CANDIDATE'], formal_boundary: 'NO_FORMAL_ACCEPTANCE_NO_FIELD_MEMORY_NO_ROI_NO_AO_ACT' },
    },
  ].map((payload) => ({ ...payload, source_lane: SOURCE_LANE, created_at: nowIso() }));
}
async function ensureFacts(pool) {
  await pool.query(`CREATE TABLE IF NOT EXISTS facts (
    fact_id TEXT PRIMARY KEY,
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    source TEXT NOT NULL,
    record_json JSONB NOT NULL
  )`);
}
async function upsertFacts(pool, facts) {
  await ensureFacts(pool);
  for (const payload of facts) {
    const factId = `demo_seed_${payload.tenant_id}_${payload.seed_id}`;
    const record = { type: FACT_TYPE, payload };
    await pool.query(
      `INSERT INTO facts (fact_id, occurred_at, source, record_json)
       VALUES ($1, NOW(), $2, $3::jsonb)
       ON CONFLICT (fact_id) DO UPDATE SET occurred_at = EXCLUDED.occurred_at, source = EXCLUDED.source, record_json = EXCLUDED.record_json`,
      [factId, 'scripts/demo_seed/controlled_pilot_frontend_demo_v1', JSON.stringify(record)]
    );
  }
}
async function main() {
  const apply = hasFlag('--apply');
  const dryRun = hasFlag('--dry-run') || !apply;
  const tenant = argValue('--tenant') || 'demo';
  if (!ALLOWED_TENANTS.has(tenant)) {
    console.error(`[demo-seed] refused tenant=${tenant}; allowed tenants: demo, tenantA`);
    process.exit(2);
  }
  if (apply && !hasFlag('--tenant')) {
    console.error('[demo-seed] --apply requires explicit --tenant demo or --tenant tenantA');
    process.exit(2);
  }
  const facts = demoFacts(tenant);
  console.log(JSON.stringify({ ok: true, dry_run: dryRun, apply, tenant, source_lane: SOURCE_LANE, fact_type: FACT_TYPE, count: facts.length, facts }, null, 2));
  if (dryRun) return;
  const pool = new Pool(poolConfig());
  try {
    await upsertFacts(pool, facts);
    console.log(`[demo-seed] applied=true tenant=${tenant} count=${facts.length} source_lane=${SOURCE_LANE}`);
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(`[demo-seed] error=${err?.message || err}`);
  process.exit(1);
});
