import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import pg from 'pg';

const { Pool } = pg;
const ROOT = resolve(process.cwd());
const COMPILED_SEAM_PATH = join(
  ROOT,
  'apps/server/dist/apps/server/src/integrations/adr/read_only_shadow_adoption_v1.js'
);
const COMPILED_STATE_SERVICE_PATH = join(
  ROOT,
  'apps/server/dist/apps/server/src/services/derived_sensing_state_v1.js'
);
const OUTPUT = join(
  ROOT,
  'acceptance-output/ADR_REAL_GEOX_POSTGRES_READONLY_SHADOW_QUALIFICATION_V1.json'
);

function exactHead() {
  const expected = String(process.env.GEOX_ADR_POSTGRES_QUALIFICATION_HEAD ?? '').trim();
  assert.match(expected, /^[0-9a-f]{40}$/, 'GEOX_ADR_POSTGRES_QUALIFICATION_HEAD must be an exact SHA');
  return expected;
}

function requireIsolatedDatabase() {
  assert.equal(
    process.env.ADR_POSTGRES_ISOLATED_ACCEPTANCE,
    '1',
    'real PostgreSQL qualification requires ADR_POSTGRES_ISOLATED_ACCEPTANCE=1'
  );
  const raw = String(process.env.DATABASE_URL ?? '').trim();
  assert.ok(raw, 'DATABASE_URL is required');
  const url = new URL(raw);
  assert.ok(
    url.hostname === '127.0.0.1' || url.hostname === 'localhost',
    'P3 qualification refuses non-local PostgreSQL endpoints'
  );
  assert.equal(
    url.pathname.replace(/^\//, ''),
    'geox_adr_readonly_shadow',
    'P3 qualification refuses any database other than geox_adr_readonly_shadow'
  );
  return raw;
}

function normalizeRows(rows) {
  return rows.map((row) => ({
    tenant_id: row.tenant_id,
    project_id: row.project_id,
    group_id: row.group_id,
    field_id: row.field_id,
    state_type: row.state_type,
    payload_json: row.payload_json,
    confidence: row.confidence == null ? null : Number(row.confidence),
    explanation_codes_json: row.explanation_codes_json,
    source_observation_ids_json: row.source_observation_ids_json,
    source_device_ids_json: row.source_device_ids_json,
    computed_at_ts_ms: Number(row.computed_at_ts_ms),
    fact_id: row.fact_id,
  }));
}

const geoxHead = exactHead();
const databaseUrl = requireIsolatedDatabase();
const pool = new Pool({ connectionString: databaseUrl, max: 4 });

try {
  const stateService = await import(pathToFileURL(COMPILED_STATE_SERVICE_PATH).href);
  const seam = await import(pathToFileURL(COMPILED_SEAM_PATH).href);

  assert.equal(typeof stateService.ensureDerivedSensingStateProjectionV1, 'function');
  assert.equal(typeof seam.exportGeoxAdrReadOnlyShadowContextV1, 'function');

  // Fixture setup is intentionally outside the observer transaction. The target
  // of this qualification is the production shadow read seam, not fixture writes.
  await stateService.ensureDerivedSensingStateProjectionV1(pool);
  await pool.query(
    `DELETE FROM derived_sensing_state_index_v1
      WHERE tenant_id = $1 AND project_id = $2 AND group_id = $3 AND field_id = $4`,
    ['tenantA', 'projectA', 'groupA', 'field_c8_demo']
  );

  const fixtures = [
    {
      stateType: 'irrigation_need_state',
      payload: { level: 'HIGH', action_hint: 'POSTGRES_READ_ONLY_SHADOW_CONTEXT' },
      confidence: 0.82,
      explanationCodes: ['ADR_POSTGRES_SHADOW_IRRIGATION_NEED'],
      observationIds: ['obs_pg_shadow_irrigation_001'],
      deviceIds: ['dev_onboard_accept_001'],
      computedAt: '2026-09-05T14:00:00.000Z',
      computedAtMs: 1788616800000,
      factId: 'fact_pg_shadow_irrigation_001',
    },
    {
      stateType: 'canopy_temperature_state',
      payload: {
        level: 'ELEVATED',
        canopy_temp_c: 31.2,
        ambient_temp_c: 28.4,
        relative_humidity_pct: 52,
      },
      confidence: 0.77,
      explanationCodes: ['ADR_POSTGRES_SHADOW_CANOPY_TEMPERATURE'],
      observationIds: ['obs_pg_shadow_canopy_001'],
      deviceIds: ['dev_onboard_accept_001'],
      computedAt: '2026-09-05T14:00:01.000Z',
      computedAtMs: 1788616801000,
      factId: 'fact_pg_shadow_canopy_001',
    },
  ];

  for (const fixture of fixtures) {
    await pool.query(
      `INSERT INTO derived_sensing_state_index_v1 (
        tenant_id,
        project_id,
        group_id,
        field_id,
        state_type,
        payload_json,
        confidence,
        explanation_codes_json,
        source_observation_ids_json,
        source_device_ids_json,
        computed_at,
        computed_at_ts_ms,
        fact_id
      ) VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7,$8::jsonb,$9::jsonb,$10::jsonb,$11::timestamptz,$12,$13)`,
      [
        'tenantA',
        'projectA',
        'groupA',
        'field_c8_demo',
        fixture.stateType,
        JSON.stringify(fixture.payload),
        fixture.confidence,
        JSON.stringify(fixture.explanationCodes),
        JSON.stringify(fixture.observationIds),
        JSON.stringify(fixture.deviceIds),
        fixture.computedAt,
        fixture.computedAtMs,
        fixture.factId,
      ]
    );
  }

  const controlSql = `SELECT
      tenant_id,
      project_id,
      group_id,
      field_id,
      state_type,
      payload_json,
      confidence,
      explanation_codes_json,
      source_observation_ids_json,
      source_device_ids_json,
      computed_at_ts_ms,
      fact_id
    FROM derived_sensing_state_index_v1
    WHERE tenant_id = $1 AND project_id = $2 AND group_id = $3 AND field_id = $4
    ORDER BY state_type, computed_at_ts_ms, fact_id`;
  const scopeValues = ['tenantA', 'projectA', 'groupA', 'field_c8_demo'];
  const before = normalizeRows((await pool.query(controlSql, scopeValues)).rows);
  assert.equal(before.length, 2, 'isolated PostgreSQL fixture must contain exactly two rows');

  const observer = await pool.connect();
  let transactionReadOnly = null;
  let mutationRejectSqlstate = null;
  const seamStatements = [];
  let context;
  try {
    await observer.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
    const readOnlyState = await observer.query('SHOW transaction_read_only');
    transactionReadOnly = String(readOnlyState.rows[0]?.transaction_read_only ?? '').toLowerCase();
    assert.equal(transactionReadOnly, 'on', 'observer transaction must be PostgreSQL READ ONLY');

    const observerDb = {
      async query(text, values) {
        const sql = String(text);
        seamStatements.push({ sql, values: [...(values ?? [])] });
        return observer.query(text, values);
      },
    };

    context = await seam.exportGeoxAdrReadOnlyShadowContextV1({
      db: observerDb,
      tenant_id: 'tenantA',
      project_id: 'projectA',
      group_id: 'groupA',
      field_id: 'field_c8_demo',
    });

    assert.equal(seamStatements.length, 1, 'production seam must issue exactly one database statement');
    const seamSql = seamStatements[0].sql.replace(/\s+/g, ' ').trim().toUpperCase();
    assert.ok(seamSql.startsWith('SELECT DISTINCT ON (STATE_TYPE)'));
    assert.ok(seamSql.includes('FROM DERIVED_SENSING_STATE_INDEX_V1'));
    assert.equal(/\b(INSERT|UPDATE|DELETE|CREATE|ALTER|DROP|TRUNCATE)\b/.test(seamSql), false);
    assert.equal(context.reality_rows.length, 2);
    assert.equal(context.identity_boundary.geox_field_is_adr_target_identity, false);
    assert.equal(context.identity_boundary.correspondence_or_equality_established, false);
    assert.equal(context.authority_boundary.database_operation, 'READ_ONLY_SELECT');
    assert.ok(
      context.reality_rows.every(
        (row) => row.fact_id && row.source_observation_ids.length > 0 && row.source_device_ids.length > 0
      ),
      'real PostgreSQL read must preserve row provenance'
    );

    // A deliberate mutation probe must be rejected by PostgreSQL itself. This
    // proves database-layer enforcement rather than relying only on source review.
    try {
      await observer.query(
        `INSERT INTO derived_sensing_state_index_v1 (
          tenant_id, project_id, group_id, field_id, state_type, payload_json,
          confidence, explanation_codes_json, source_observation_ids_json,
          source_device_ids_json, computed_at, computed_at_ts_ms, fact_id
        ) VALUES ($1,$2,$3,$4,$5,'{}'::jsonb,NULL,'[]'::jsonb,'[]'::jsonb,'[]'::jsonb,now(),$6,$7)`,
        ['tenantA', 'projectA', 'groupA', 'field_c8_demo', 'sensor_quality_state', 1788616802000, 'forbidden_pg_shadow_write']
      );
      assert.fail('READ ONLY transaction unexpectedly allowed a mutation');
    } catch (error) {
      mutationRejectSqlstate = String(error?.code ?? '');
      assert.equal(
        mutationRejectSqlstate,
        '25006',
        `PostgreSQL must reject the mutation with read_only_sql_transaction (25006), got ${mutationRejectSqlstate}`
      );
    }
  } finally {
    await observer.query('ROLLBACK').catch(() => undefined);
    observer.release();
  }

  const after = normalizeRows((await pool.query(controlSql, scopeValues)).rows);
  assert.deepEqual(after, before, 'observer transaction must leave the real PostgreSQL row set byte-semantically unchanged');

  const serverVersion = String((await pool.query('SHOW server_version')).rows[0]?.server_version ?? '');
  assert.ok(serverVersion.startsWith('16.'), `qualification expects PostgreSQL 16, got ${serverVersion}`);

  const evidence = {
    status: 'PASS',
    milestone: 'REAL_GEOX_POSTGRES_READONLY_SHADOW_QUALIFICATION_V1',
    geoxSourceCommit: geoxHead,
    p2MergedPredecessor: 'ead9d0f0f1c787d75588b4970dd9d315fe28f1fb',
    postgresVersion: serverVersion,
    isolatedPostgresEndpoint: true,
    liveProductionReadModelObserved: false,
    productionDatabaseEndpointUsed: false,
    productionRuntimeActivated: false,
    mcftRemoteDatabaseSecretUsed: false,
    bLineDatabaseSecretUsed: false,
    observerTransactionMode: 'REPEATABLE_READ_READ_ONLY',
    transactionReadOnly,
    databaseLayerReadOnlyEnforced: true,
    mutationProbeRejected: true,
    mutationRejectSqlstate,
    expectedMutationRejectSqlstate: '25006',
    productionSeamStatementCount: seamStatements.length,
    productionSeamSelectCount: seamStatements.length,
    productionSeamWriteCount: 0,
    realityRowCount: context.reality_rows.length,
    provenancePreserved: true,
    fixtureRowCountBefore: before.length,
    fixtureRowCountAfter: after.length,
    fixtureRowsUnchanged: true,
    geoxFieldEqualsAdrTarget: false,
    correspondenceOrEqualityEstablished: false,
    recommendationWriteAuthorized: false,
    approvalAuthorized: false,
    operationPlanOrTaskCreationAuthorized: false,
    dispatchAuthorized: false,
    machineExecutionAuthorized: false,
    newArchitectureDecisionRequired: false,
  };

  mkdirSync(dirname(OUTPUT), { recursive: true });
  writeFileSync(OUTPUT, `${JSON.stringify(evidence, null, 2)}\n`, 'utf8');
  process.stdout.write(`${JSON.stringify(evidence, null, 2)}\n`);
} finally {
  await pool.end();
}
