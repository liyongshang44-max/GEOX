#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { Pool } = require('pg');

const ROOT = path.resolve(__dirname, '../../..');
const { createClosureReaderV1 } = require('../mcft_cap08_s6_single_run_ports/closure_reader_v1.cjs');
const { readExactReceiptObjectsV1 } = require('../mcft_cap08_s6_single_run_db/closure_readback_adapter_v1.cjs');
const { loadProduct } = require('../mcft_cap08_s6_single_run_ports/product_loader_v1.cjs');

const S4_AUTHORITY_SCHEMA = 'geox_mcft_cap08_s4_append_forward_authority_v1';
const S4_AUTHORITY_KIND = 'REALITY_BINDING';

function requiredEnv(name) {
  const value = String(process.env[name] ?? '').trim();
  if (!value) throw new Error(`DEVELOPMENT_RESTART_ENV_REQUIRED:${name}`);
  return value;
}

function objectFromRecord(row, code) {
  const record = typeof row.record_json === 'string'
    ? JSON.parse(row.record_json)
    : row.record_json;
  assert.ok(record && typeof record === 'object' && !Array.isArray(record), code);
  const object = record.payload;
  assert.ok(
    object && typeof object === 'object' && !Array.isArray(object),
    `${code}_PAYLOAD`,
  );
  return object;
}

function jsonObject(value, code) {
  const parsed = typeof value === 'string' ? JSON.parse(value) : value;
  assert.ok(parsed && typeof parsed === 'object' && !Array.isArray(parsed), code);
  return parsed;
}

function exactScope(actual, expected, code) {
  for (const field of [
    'tenant_id',
    'project_id',
    'group_id',
    'field_id',
    'season_id',
    'zone_id',
  ]) {
    assert.equal(actual[field], expected[field], `${code}:${field}`);
  }
}

async function scopedRows(pool, type, scope, logicalTime) {
  return (await pool.query(
    `SELECT fact_id,record_json
       FROM facts
      WHERE record_json->>'type'=$1
        AND record_json->'payload'->>'tenant_id'=$2
        AND record_json->'payload'->>'project_id'=$3
        AND record_json->'payload'->>'group_id'=$4
        AND record_json->'payload'->>'field_id'=$5
        AND record_json->'payload'->>'season_id'=$6
        AND record_json->'payload'->>'zone_id'=$7
        AND record_json->'payload'->>'logical_time'=$8
      ORDER BY fact_id`,
    [
      type,
      scope.tenant_id,
      scope.project_id,
      scope.group_id,
      scope.field_id,
      scope.season_id,
      scope.zone_id,
      logicalTime,
    ],
  )).rows;
}

async function exactS4Authority(pool, spec, correctionLogicalTime) {
  const result = await pool.query(
    `SELECT determinism_hash,semantic_payload
       FROM twin_runtime_authority_snapshot_v1
      WHERE authority_kind=$1
        AND semantic_payload->>'schema_version'=$2
        AND semantic_payload->>'formal_run_id'=$3
        AND semantic_payload->'scope'->>'tenant_id'=$4
        AND semantic_payload->'scope'->>'project_id'=$5
        AND semantic_payload->'scope'->>'group_id'=$6
        AND semantic_payload->'scope'->>'field_id'=$7
        AND semantic_payload->'scope'->>'season_id'=$8
        AND semantic_payload->'scope'->>'zone_id'=$9
        AND semantic_payload->>'correction_logical_time'=$10`,
    [
      S4_AUTHORITY_KIND,
      S4_AUTHORITY_SCHEMA,
      spec.formal_run_id,
      spec.scope.tenant_id,
      spec.scope.project_id,
      spec.scope.group_id,
      spec.scope.field_id,
      spec.scope.season_id,
      spec.scope.zone_id,
      correctionLogicalTime,
    ],
  );
  assert.equal(result.rows.length, 1, 'DEVELOPMENT_RESTART_S4_AUTHORITY_CARDINALITY');
  const authority = jsonObject(
    result.rows[0].semantic_payload,
    'DEVELOPMENT_RESTART_S4_AUTHORITY_INVALID',
  );
  assert.equal(authority.determinism_hash, result.rows[0].determinism_hash);
  assert.equal(authority.authority_kind, S4_AUTHORITY_KIND);
  assert.equal(authority.schema_version, S4_AUTHORITY_SCHEMA);
  assert.equal(authority.formal_run_id, spec.formal_run_id);
  assert.equal(authority.correction_logical_time, correctionLogicalTime);
  exactScope(authority.scope, spec.scope, 'DEVELOPMENT_RESTART_S4_AUTHORITY_SCOPE');
  return authority;
}

async function exactFvo17(pool, spec) {
  const result = await pool.query(
    `SELECT record_json
       FROM facts
      WHERE record_json->>'type'='soil_moisture_observation_v1'
        AND record_json->'payload'->>'formal_run_id'=$1
        AND record_json->'payload'->>'source_record_id'='FVO-17'
        AND record_json->'payload'->>'tenant_id'=$2
        AND record_json->'payload'->>'project_id'=$3
        AND record_json->'payload'->>'group_id'=$4
        AND record_json->'payload'->>'field_id'=$5
        AND record_json->'payload'->>'season_id'=$6
        AND record_json->'payload'->>'zone_id'=$7
      ORDER BY fact_id`,
    [
      spec.formal_run_id,
      spec.scope.tenant_id,
      spec.scope.project_id,
      spec.scope.group_id,
      spec.scope.field_id,
      spec.scope.season_id,
      spec.scope.zone_id,
    ],
  );
  assert.equal(result.rows.length, 1, 'DEVELOPMENT_RESTART_FVO17_CARDINALITY');
  return objectFromRecord(result.rows[0], 'DEVELOPMENT_RESTART_FVO17');
}

async function main() {
  const databaseUrl = requiredEnv('DATABASE_URL');
  const contextPath = path.resolve(requiredEnv('MCFT_CAP08_DEV_CONTINUITY_CONTEXT_PATH'));
  const resultPath = path.resolve(requiredEnv('MCFT_CAP08_DEV_RESTART_RESULT_PATH'));
  const context = JSON.parse(fs.readFileSync(contextPath, 'utf8'));
  const spec = context.spec;
  const receiptManifest = context.receipt_manifest;
  assert.equal(receiptManifest.receipt_count, 153, 'DEVELOPMENT_RESTART_MANIFEST_COUNT');

  const pool = new Pool({ connectionString: databaseUrl, max: 3 });
  const adminUrl = String(process.env.MCFT_CAP08_ADMIN_DATABASE_URL || databaseUrl);
  const adminPool = new Pool({ connectionString: adminUrl, max: 2 });
  try {
    const before = Number(
      (await adminPool.query('SELECT count(*)::int AS n FROM facts')).rows[0].n,
    );
    const readback = await readExactReceiptObjectsV1(
      createClosureReaderV1({ pool }),
      spec,
      receiptManifest,
    );
    assert.equal(readback.object_count, 153, 'DEVELOPMENT_RESTART_READBACK_COUNT');

    const product = await loadProduct(ROOT);
    const handoff = await new product.PrepareNextTickInputServiceV1(
      new product.PostgresNextTickRepositoryV1(pool),
    ).prepareNextTickInput(spec.scope);
    const expectedNext = new Date(
      Date.parse(product.cap08TickLogicalTimeV1(23)) + 3_600_000,
    ).toISOString();
    assert.equal(
      handoff.next_logical_tick_time,
      expectedNext,
      'DEVELOPMENT_RESTART_FINAL_HANDOFF',
    );

    const tickCounts = (await adminPool.query(
      `SELECT record_json->'payload'->>'logical_time' AS logical_time,
              count(*)::int AS n
         FROM facts
        WHERE record_json->>'type'='twin_runtime_tick_v1'
          AND record_json->'payload'->>'tenant_id'=$1
          AND record_json->'payload'->>'project_id'=$2
          AND record_json->'payload'->>'group_id'=$3
          AND record_json->'payload'->>'field_id'=$4
          AND record_json->'payload'->>'season_id'=$5
          AND record_json->'payload'->>'zone_id'=$6
        GROUP BY record_json->'payload'->>'logical_time'
        ORDER BY logical_time`,
      [
        spec.scope.tenant_id,
        spec.scope.project_id,
        spec.scope.group_id,
        spec.scope.field_id,
        spec.scope.season_id,
        spec.scope.zone_id,
      ],
    )).rows;
    assert.equal(tickCounts.length, 24, 'DEVELOPMENT_RESTART_DISTINCT_TICK_COUNT');
    assert.equal(
      tickCounts.reduce((sum, row) => sum + Number(row.n), 0),
      25,
      'DEVELOPMENT_RESTART_APPEND_FORWARD_TICK_COUNT',
    );

    const t16 = product.cap08TickLogicalTimeV1(16);
    const t17 = product.cap08TickLogicalTimeV1(17);
    assert.equal(
      Number(tickCounts.find((row) => row.logical_time === t16)?.n),
      2,
      'DEVELOPMENT_RESTART_T16_CORRECTED_CARDINALITY',
    );
    assert.equal(
      Number(tickCounts.find((row) => row.logical_time === t17)?.n),
      1,
      'DEVELOPMENT_RESTART_T17_CARDINALITY',
    );

    const authority = await exactS4Authority(adminPool, spec, t16);
    const correctedStateBinding = jsonObject(
      authority.corrected_objects?.state,
      'DEVELOPMENT_RESTART_CORRECTED_STATE_BINDING_REQUIRED',
    );
    const correctedForecastBinding = jsonObject(
      authority.corrected_objects?.forecast,
      'DEVELOPMENT_RESTART_CORRECTED_FORECAST_BINDING_REQUIRED',
    );
    const baseStateBinding = jsonObject(
      authority.identity_input?.base_t16_state,
      'DEVELOPMENT_RESTART_BASE_STATE_BINDING_REQUIRED',
    );

    const t16States = (await scopedRows(
      adminPool,
      'twin_state_estimate_v1',
      spec.scope,
      t16,
    )).map((row, index) => objectFromRecord(
      row,
      `DEVELOPMENT_RESTART_T16_STATE_${index}`,
    ));
    const t17States = (await scopedRows(
      adminPool,
      'twin_state_estimate_v1',
      spec.scope,
      t17,
    )).map((row, index) => objectFromRecord(
      row,
      `DEVELOPMENT_RESTART_T17_STATE_${index}`,
    ));
    assert.equal(t16States.length, 2, 'DEVELOPMENT_RESTART_T16_STATE_CARDINALITY');
    assert.equal(t17States.length, 1, 'DEVELOPMENT_RESTART_T17_STATE_CARDINALITY');

    const correctedMatches = t16States.filter(
      (state) => state.object_id === correctedStateBinding.ref
        && state.determinism_hash === correctedStateBinding.hash,
    );
    const baseMatches = t16States.filter(
      (state) => state.object_id === baseStateBinding.ref
        && state.determinism_hash === baseStateBinding.hash,
    );
    assert.equal(
      correctedMatches.length,
      1,
      'DEVELOPMENT_RESTART_CORRECTED_T16_STATE_BINDING',
    );
    assert.equal(baseMatches.length, 1, 'DEVELOPMENT_RESTART_BASE_T16_STATE_BINDING');
    assert.notEqual(
      correctedStateBinding.ref,
      baseStateBinding.ref,
      'DEVELOPMENT_RESTART_APPEND_FORWARD_STATE_REF_MUST_ADVANCE',
    );

    const t17State = t17States[0];
    assert.equal(
      t17State.payload?.previous_posterior_ref,
      correctedStateBinding.ref,
      'DEVELOPMENT_RESTART_T17_MUST_CONSUME_CORRECTED_T16',
    );
    assert.equal(
      authority.t17_predecessor?.previous_posterior_ref,
      correctedStateBinding.ref,
      'DEVELOPMENT_RESTART_AUTHORITY_T17_POSTERIOR_BINDING',
    );

    const fvo17 = await exactFvo17(adminPool, spec);
    assert.equal(
      fvo17.canonical_payload?.source_forecast_ref,
      correctedForecastBinding.ref,
      'DEVELOPMENT_RESTART_FVO17_CORRECTED_FORECAST_REF',
    );
    assert.equal(
      fvo17.canonical_payload?.source_forecast_hash,
      correctedForecastBinding.hash,
      'DEVELOPMENT_RESTART_FVO17_CORRECTED_FORECAST_HASH',
    );

    const residualCount = Number((await adminPool.query(
      `SELECT count(*)::int AS n
         FROM twin_forecast_residual_projection_v1
        WHERE tenant_id=$1
          AND project_id=$2
          AND group_id=$3
          AND field_id=$4
          AND season_id=$5
          AND zone_id=$6`,
      [
        spec.scope.tenant_id,
        spec.scope.project_id,
        spec.scope.group_id,
        spec.scope.field_id,
        spec.scope.season_id,
        spec.scope.zone_id,
      ],
    )).rows[0].n);
    assert.equal(
      residualCount,
      24,
      'DEVELOPMENT_RESTART_RESIDUAL_PROJECTION_COUNT',
    );

    const after = Number(
      (await adminPool.query('SELECT count(*)::int AS n FROM facts')).rows[0].n,
    );
    assert.equal(after, before, 'DEVELOPMENT_RESTART_CANONICAL_WRITE_DELTA');

    const result = {
      schema_version:
        'geox_mcft_cap08_s6_repeatable_development_qualification_restart_readback_result_v1',
      status: 'PASS',
      exact_subject_sha: context.exact_subject_sha,
      operational_run_instance_id: context.operational_run_instance_id,
      fresh_process: true,
      canonical_receipt_readback_count: 153,
      distinct_tick_count: 24,
      append_forward_tick_count: 25,
      corrected_t16_tick_count: 2,
      t17_tick_count: 1,
      s4_authority_ref: authority.authority_ref,
      corrected_t16_state_ref: correctedStateBinding.ref,
      corrected_t16_forecast_ref: correctedForecastBinding.ref,
      t17_consumed_corrected_t16: true,
      fvo17_selected_corrected_t16_forecast: true,
      final_handoff_next_logical_time: handoff.next_logical_tick_time,
      residual_projection_count: 24,
      canonical_write_delta: 0,
      formal_evidence_eligible: false,
      s6_candidate_evidence_eligible: false,
    };
    fs.mkdirSync(path.dirname(resultPath), { recursive: true });
    fs.writeFileSync(resultPath, `${JSON.stringify(result, null, 2)}\n`);
    console.log(JSON.stringify(result, null, 2));
  } finally {
    await Promise.allSettled([pool.end(), adminPool.end()]);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
