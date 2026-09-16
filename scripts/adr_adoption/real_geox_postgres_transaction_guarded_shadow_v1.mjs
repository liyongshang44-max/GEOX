import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
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
  'acceptance-output/ADR_REAL_GEOX_POSTGRES_TRANSACTION_GUARDED_SHADOW_V1.json'
);
const P3_MERGED_PREDECESSOR = '0267c224d5c0c0524997b724b89cbe03d4e8b299';

function exactHead() {
  const expected = String(process.env.GEOX_ADR_TRANSACTION_GUARD_QUALIFICATION_HEAD ?? '').trim();
  assert.match(expected, /^[0-9a-f]{40}$/, 'GEOX_ADR_TRANSACTION_GUARD_QUALIFICATION_HEAD must be an exact SHA');
  return expected;
}

function requireIsolatedDatabase() {
  assert.equal(
    process.env.ADR_POSTGRES_TRANSACTION_GUARD_ISOLATED_ACCEPTANCE,
    '1',
    'P4 requires ADR_POSTGRES_TRANSACTION_GUARD_ISOLATED_ACCEPTANCE=1'
  );
  const raw = String(process.env.DATABASE_URL ?? '').trim();
  assert.ok(raw, 'DATABASE_URL is required');
  const url = new URL(raw);
  assert.ok(
    url.hostname === '127.0.0.1' || url.hostname === 'localhost',
    'P4 refuses non-local PostgreSQL endpoints'
  );
  assert.equal(
    url.pathname.replace(/^\//, ''),
    'geox_adr_transaction_guard',
    'P4 refuses any database other than geox_adr_transaction_guard'
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

function normalizedSql(text) {
  return String(text).replace(/\s+/g, ' ').trim().toUpperCase();
}

async function proveGuardFailure(seam, { readOnly, isolation, expectedError }) {
  const statements = [];
  let released = 0;
  const pool = {
    async connect() {
      return {
        async query(text) {
          const sql = normalizedSql(text);
          statements.push(sql);
          if (sql.startsWith('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY')) return { rows: [] };
          if (sql === 'SHOW TRANSACTION_READ_ONLY') return { rows: [{ transaction_read_only: readOnly }] };
          if (sql === 'SHOW TRANSACTION_ISOLATION') return { rows: [{ transaction_isolation: isolation }] };
          if (sql === 'ROLLBACK') return { rows: [] };
          throw new Error(`P4_FAIL_CLOSED_REACHED_CONTEXT_QUERY:${sql}`);
        },
        release() {
          released += 1;
        },
      };
    },
  };

  await assert.rejects(
    () => seam.exportGeoxAdrPostgresTransactionGuardedReadOnlyShadowContextV1({
      pool,
      tenant_id: 'tenantA',
      project_id: 'projectA',
      group_id: 'groupA',
      field_id: 'field_c8_demo',
    }),
    expectedError
  );
  assert.equal(released, 1, 'failed guard must release its client exactly once');
  assert.equal(statements.at(-1), 'ROLLBACK', 'failed guard must rollback before release');
  assert.equal(
    statements.some((sql) => sql.startsWith('SELECT DISTINCT ON (STATE_TYPE)')),
    false,
    'invalid transaction settings must fail before the GEOX read-model SELECT'
  );
  return statements;
}

const geoxHead = exactHead();
const databaseUrl = requireIsolatedDatabase();
const pool = new Pool({ connectionString: databaseUrl, max: 4 });

try {
  const stateService = await import(pathToFileURL(COMPILED_STATE_SERVICE_PATH).href);
  const seam = await import(pathToFileURL(COMPILED_SEAM_PATH).href);

  assert.equal(typeof stateService.ensureDerivedSensingStateProjectionV1, 'function');
  assert.equal(typeof seam.exportGeoxAdrPostgresTransactionGuardedReadOnlyShadowContextV1, 'function');
  assert.equal(
    seam.GEOX_ADR_POSTGRES_READ_ONLY_SHADOW_TRANSACTION_VERSION,
    'geox.adr-postgres-read-only-shadow-transaction.v1'
  );

  const readOnlyOffTrace = await proveGuardFailure(seam, {
    readOnly: 'off',
    isolation: 'repeatable read',
    expectedError: /ADR_SHADOW_POSTGRES_TRANSACTION_NOT_READ_ONLY/,
  });
  const isolationWrongTrace = await proveGuardFailure(seam, {
    readOnly: 'on',
    isolation: 'read committed',
    expectedError: /ADR_SHADOW_POSTGRES_TRANSACTION_ISOLATION_INVALID/,
  });

  await stateService.ensureDerivedSensingStateProjectionV1(pool);
  await pool.query(
    `DELETE FROM derived_sensing_state_index_v1
      WHERE tenant_id = $1 AND project_id = $2 AND group_id = $3 AND field_id = $4`,
    ['tenantA', 'projectA', 'groupA', 'field_c8_demo']
  );

  const fixtures = [
    {
      stateType: 'irrigation_need_state',
      payload: { level: 'HIGH', action_hint: 'POSTGRES_TRANSACTION_GUARD_CONTEXT' },
      confidence: 0.82,
      explanationCodes: ['ADR_P4_IRRIGATION_NEED'],
      observationIds: ['obs_adr_p4_irrigation_001'],
      deviceIds: ['dev_onboard_accept_001'],
      computedAt: '2026-09-05T15:00:00.000Z',
      computedAtMs: 1788620400000,
      factId: 'fact_adr_p4_irrigation_001',
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
      explanationCodes: ['ADR_P4_CANOPY_TEMPERATURE'],
      observationIds: ['obs_adr_p4_canopy_001'],
      deviceIds: ['dev_onboard_accept_001'],
      computedAt: '2026-09-05T15:00:01.000Z',
      computedAtMs: 1788620401000,
      factId: 'fact_adr_p4_canopy_001',
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
  assert.equal(before.length, 2);

  const statements = [];
  let connectCount = 0;
  let releaseCount = 0;
  const instrumentedPool = {
    async connect() {
      connectCount += 1;
      const client = await pool.connect();
      return {
        async query(text, values) {
          statements.push({ sql: String(text), values: [...(values ?? [])] });
          return client.query(text, values);
        },
        release() {
          releaseCount += 1;
          client.release();
        },
      };
    },
  };

  const guarded = await seam.exportGeoxAdrPostgresTransactionGuardedReadOnlyShadowContextV1({
    pool: instrumentedPool,
    tenant_id: 'tenantA',
    project_id: 'projectA',
    group_id: 'groupA',
    field_id: 'field_c8_demo',
  });

  assert.equal(guarded.contract_version, 'geox.adr-postgres-read-only-shadow-transaction.v1');
  assert.equal(guarded.transaction_mode, 'REPEATABLE_READ_READ_ONLY');
  assert.equal(guarded.transaction_read_only, 'on');
  assert.equal(guarded.transaction_isolation, 'repeatable read');
  assert.equal(connectCount, 1);
  assert.equal(releaseCount, 1);
  assert.equal(guarded.context.reality_rows.length, 2);
  assert.equal(guarded.context.identity_boundary.geox_field_is_adr_target_identity, false);
  assert.equal(guarded.context.identity_boundary.correspondence_or_equality_established, false);
  assert.equal(guarded.context.authority_boundary.database_operation, 'READ_ONLY_SELECT');
  assert.ok(
    guarded.context.reality_rows.every(
      (row) => row.fact_id && row.source_observation_ids.length > 0 && row.source_device_ids.length > 0
    ),
    'P4 must preserve GEOX row provenance'
  );
  for (const value of Object.values(guarded.authority_boundary)) {
    assert.equal(value, false, 'transaction guard must create no write/action authority');
  }

  const normalizedStatements = statements.map((entry) => normalizedSql(entry.sql));
  assert.equal(normalizedStatements.length, 5, 'production transaction guard must own exactly five statements');
  assert.ok(normalizedStatements[0].startsWith('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY'));
  assert.equal(normalizedStatements[1], 'SHOW TRANSACTION_READ_ONLY');
  assert.equal(normalizedStatements[2], 'SHOW TRANSACTION_ISOLATION');
  assert.ok(normalizedStatements[3].startsWith('SELECT DISTINCT ON (STATE_TYPE)'));
  assert.ok(normalizedStatements[3].includes('FROM DERIVED_SENSING_STATE_INDEX_V1'));
  assert.equal(normalizedStatements[4], 'ROLLBACK');
  assert.equal(
    normalizedStatements.some((sql) => /\b(INSERT|UPDATE|DELETE|CREATE|ALTER|DROP|TRUNCATE)\b/.test(sql)),
    false,
    'production transaction guard must issue no DML or DDL'
  );

  const after = normalizeRows((await pool.query(controlSql, scopeValues)).rows);
  assert.deepEqual(after, before, 'P4 production transaction guard must leave fixture rows unchanged');

  const serverVersion = String((await pool.query('SHOW server_version')).rows[0]?.server_version ?? '');
  assert.ok(serverVersion.startsWith('16.'), `P4 expects PostgreSQL 16, got ${serverVersion}`);

  const evidence = {
    status: 'PASS',
    milestone: 'REAL_GEOX_POSTGRES_TRANSACTION_GUARDED_ADR_SHADOW_OBSERVER_V1',
    geoxSourceCommit: geoxHead,
    p3MergedPredecessor: P3_MERGED_PREDECESSOR,
    postgresVersion: serverVersion,
    isolatedPostgresEndpoint: true,
    productionTransactionGuardOwnedByIntegration: true,
    transactionContractVersion: guarded.contract_version,
    transactionMode: guarded.transaction_mode,
    transactionReadOnly: guarded.transaction_read_only,
    transactionIsolation: guarded.transaction_isolation,
    observerConnectionCount: connectCount,
    observerConnectionReleaseCount: releaseCount,
    transactionStatementCount: normalizedStatements.length,
    productionReadModelSelectCount: 1,
    productionWriteCount: 0,
    realityRowCount: guarded.context.reality_rows.length,
    provenancePreserved: true,
    fixtureRowCountBefore: before.length,
    fixtureRowCountAfter: after.length,
    fixtureRowsUnchanged: true,
    readOnlyOffFailsClosedBeforeContextRead: !readOnlyOffTrace.some((sql) => sql.startsWith('SELECT DISTINCT ON (STATE_TYPE)')),
    wrongIsolationFailsClosedBeforeContextRead: !isolationWrongTrace.some((sql) => sql.startsWith('SELECT DISTINCT ON (STATE_TYPE)')),
    liveProductionReadModelObserved: false,
    productionDatabaseEndpointUsed: false,
    productionDatabaseCredentialProvisioned: false,
    productionRuntimeActivated: false,
    mcftRemoteDatabaseSecretUsed: false,
    bLineDatabaseSecretUsed: false,
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
