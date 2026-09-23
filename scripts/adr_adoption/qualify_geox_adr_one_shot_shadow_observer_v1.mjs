import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import pg from 'pg';

const { Pool } = pg;
const ROOT = resolve(process.cwd());
const CLI = join(ROOT, 'scripts/adr_adoption/geox_adr_one_shot_shadow_observer_v1.mjs');
const COMPILED_STATE_SERVICE = join(
  ROOT,
  'apps/server/dist/apps/server/src/services/derived_sensing_state_v1.js'
);
const OUTPUT = join(
  ROOT,
  'acceptance-output/ADR_GEOX_ONE_SHOT_SHADOW_OBSERVER_V1.json'
);
const P4_MERGED_PREDECESSOR = 'bf5bd1dda29d8fef2ddc21dc758c2126077bf98b';

function exactHead() {
  const expected = String(process.env.GEOX_ADR_P5_QUALIFICATION_HEAD ?? '').trim();
  assert.match(expected, /^[0-9a-f]{40}$/, 'GEOX_ADR_P5_QUALIFICATION_HEAD must be an exact SHA');
  return expected;
}

function acceptanceDatabaseUrl() {
  assert.equal(process.env.ADR_P5_ISOLATED_ACCEPTANCE, '1');
  const raw = String(process.env.GEOX_ADR_P5_ACCEPTANCE_DATABASE_URL ?? '').trim();
  assert.ok(raw, 'GEOX_ADR_P5_ACCEPTANCE_DATABASE_URL is required');
  const url = new URL(raw);
  assert.ok(url.hostname === '127.0.0.1' || url.hostname === 'localhost');
  assert.equal(url.pathname.replace(/^\//, ''), 'geox_adr_one_shot_shadow');
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

function baseChildEnv(databaseUrl, projectionFile) {
  return {
    ...process.env,
    GEOX_ADR_SHADOW_OBSERVATION_MODE: 'EXPLICIT_ONE_SHOT_READ_ONLY',
    GEOX_ADR_SHADOW_DATABASE_URL: databaseUrl,
    GEOX_ADR_SHADOW_PROJECTION_FILE: projectionFile,
    GEOX_ADR_SHADOW_TENANT_ID: 'tenantA',
    GEOX_ADR_SHADOW_PROJECT_ID: 'projectA',
    GEOX_ADR_SHADOW_GROUP_ID: 'groupA',
    GEOX_ADR_SHADOW_FIELD_ID: 'field_c8_demo',
    DATABASE_URL: '',
    GEOX_RUNTIME_DATABASE_URL: '',
    GEOX_MCFT_CAP09_T3R1_S6_DATABASE_URL: '',
    GEOX_MCFT_CAP09_T4R1_S6_DATABASE_URL: '',
  };
}

function runSuccess(env) {
  const result = spawnSync(process.execPath, [CLI], {
    cwd: ROOT,
    env,
    encoding: 'utf8',
    maxBuffer: 8 * 1024 * 1024,
  });
  if (result.status !== 0) {
    process.stderr.write(result.stdout ?? '');
    process.stderr.write(result.stderr ?? '');
  }
  assert.equal(result.status, 0, 'one-shot observer must exit successfully');
  return JSON.parse(result.stdout.trim());
}

function runFailure(env, expectedCode) {
  const result = spawnSync(process.execPath, [CLI], {
    cwd: ROOT,
    env,
    encoding: 'utf8',
    maxBuffer: 8 * 1024 * 1024,
  });
  assert.notEqual(result.status, 0, `one-shot observer must fail closed: ${expectedCode}`);
  assert.match(`${result.stdout}\n${result.stderr}`, new RegExp(expectedCode));
  return true;
}

const geoxHead = exactHead();
const databaseUrl = acceptanceDatabaseUrl();
const pool = new Pool({ connectionString: databaseUrl, max: 3 });
const temp = mkdtempSync(join(tmpdir(), 'geox-adr-p5-'));

try {
  const stateService = await import(pathToFileURL(COMPILED_STATE_SERVICE).href);
  await stateService.ensureDerivedSensingStateProjectionV1(pool);
  await pool.query(
    `DELETE FROM derived_sensing_state_index_v1
      WHERE tenant_id = $1 AND project_id = $2 AND group_id = $3 AND field_id = $4`,
    ['tenantA', 'projectA', 'groupA', 'field_c8_demo']
  );

  const fixtures = [
    {
      stateType: 'irrigation_need_state',
      payload: { level: 'HIGH', action_hint: 'P5_ONE_SHOT_SHADOW_CONTEXT' },
      confidence: 0.82,
      codes: ['ADR_P5_IRRIGATION_NEED'],
      observations: ['obs_adr_p5_irrigation_001'],
      devices: ['dev_onboard_accept_001'],
      at: '2026-09-05T17:00:00.000Z',
      atMs: 1788627600000,
      factId: 'fact_adr_p5_irrigation_001',
    },
    {
      stateType: 'canopy_temperature_state',
      payload: { level: 'ELEVATED', canopy_temp_c: 31.2, ambient_temp_c: 28.4, relative_humidity_pct: 52 },
      confidence: 0.77,
      codes: ['ADR_P5_CANOPY_TEMPERATURE'],
      observations: ['obs_adr_p5_canopy_001'],
      devices: ['dev_onboard_accept_001'],
      at: '2026-09-05T17:00:01.000Z',
      atMs: 1788627601000,
      factId: 'fact_adr_p5_canopy_001',
    },
  ];

  for (const fixture of fixtures) {
    await pool.query(
      `INSERT INTO derived_sensing_state_index_v1 (
        tenant_id, project_id, group_id, field_id, state_type, payload_json,
        confidence, explanation_codes_json, source_observation_ids_json,
        source_device_ids_json, computed_at, computed_at_ts_ms, fact_id
      ) VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7,$8::jsonb,$9::jsonb,$10::jsonb,$11::timestamptz,$12,$13)`,
      [
        'tenantA', 'projectA', 'groupA', 'field_c8_demo', fixture.stateType,
        JSON.stringify(fixture.payload), fixture.confidence, JSON.stringify(fixture.codes),
        JSON.stringify(fixture.observations), JSON.stringify(fixture.devices), fixture.at,
        fixture.atMs, fixture.factId,
      ]
    );
  }

  const controlSql = `SELECT
      tenant_id, project_id, group_id, field_id, state_type, payload_json,
      confidence, explanation_codes_json, source_observation_ids_json,
      source_device_ids_json, computed_at_ts_ms, fact_id
    FROM derived_sensing_state_index_v1
    WHERE tenant_id = $1 AND project_id = $2 AND group_id = $3 AND field_id = $4
    ORDER BY state_type, computed_at_ts_ms, fact_id`;
  const scopeValues = ['tenantA', 'projectA', 'groupA', 'field_c8_demo'];
  const before = normalizeRows((await pool.query(controlSql, scopeValues)).rows);
  assert.equal(before.length, 2);

  const projection = {
    contract_version: 'adr.geox-decision-result-sink.v1',
    routing_scope: { tenant_id: 'tenantA', project_id: 'projectA', group_id: 'groupA' },
    adr_decision_result_ref: {
      kind: 'DecisionResult',
      logical_id: 'adr-p5-qualified-projection-fixture',
      version: 1,
      semantic_hash: 'sha256:p5-qualified-projection-fixture',
    },
    decision_disposition: 'ACT',
    adr_structured_action: { actionCode: 'SET_SOYBEAN_SEEDING_RATE' },
    target_binding: {
      status: 'UNRESOLVED',
      source_mode: 'ADR_TARGET_UNBOUND_TO_GEOX_FIELD',
      reason_code: 'P5_NO_GOVERNED_GEOX_FIELD_BINDING',
    },
    consumer_disposition: 'DISPLAY_ONLY_ADVISORY_CANDIDATE',
    dispatch_authorized: false,
    field_actionable: false,
    upstream_authority_boundary: {
      human_approval_authority: 'NONE_DECISION_RESULT_IS_NOT_HUMAN_APPROVAL_AUTHORITY',
      machine_execution_authority: 'NONE_DECISION_RESULT_IS_NOT_MACHINE_EXECUTION_AUTHORITY',
    },
    authority_claim: 'NONE_GEOX_ADAPTER_RESULT_PROJECTION_ONLY',
  };
  const projectionPath = join(temp, 'projection.json');
  writeFileSync(projectionPath, `${JSON.stringify(projection, null, 2)}\n`, 'utf8');

  const positive = runSuccess(baseChildEnv(databaseUrl, projectionPath));
  assert.equal(positive.contract_version, 'geox.adr-one-shot-shadow-observer-result.v1');
  assert.equal(positive.execution_mode, 'EXPLICIT_ONE_SHOT_READ_ONLY');
  assert.equal(positive.transaction_guard.contract_version, 'geox.adr-postgres-read-only-shadow-transaction.v1');
  assert.equal(positive.transaction_guard.transaction_mode, 'REPEATABLE_READ_READ_ONLY');
  assert.equal(positive.transaction_guard.transaction_read_only, 'on');
  assert.equal(positive.transaction_guard.transaction_isolation, 'repeatable read');
  assert.equal(positive.observation.contract_version, 'geox.adr-read-only-shadow-observation.v1');
  assert.equal(positive.observation.geox_context.reality_rows.length, 2);
  assert.equal(positive.observation.geox_context.identity_boundary.geox_field_is_adr_target_identity, false);
  assert.equal(positive.observation.geox_context.identity_boundary.correspondence_or_equality_established, false);
  assert.equal(positive.observation.comparison_status, 'NOT_ESTABLISHED_NO_SAME_DOMAIN_INPUT_EQUIVALENCE_PROOF');
  assert.equal(positive.observation.target_relationship, 'UNRESOLVED_NO_GEOX_FIELD_TO_ADR_TARGET_EQUALITY_CLAIM');
  assert.equal(positive.operational_boundary.one_shot, true);
  for (const [key, value] of Object.entries(positive.operational_boundary)) {
    if (key === 'one_shot') continue;
    assert.equal(value, false, `operational authority must remain false: ${key}`);
  }

  const missingDedicatedUrl = baseChildEnv(databaseUrl, projectionPath);
  missingDedicatedUrl.GEOX_ADR_SHADOW_DATABASE_URL = '';
  missingDedicatedUrl.DATABASE_URL = databaseUrl;
  runFailure(missingDedicatedUrl, 'ADR_SHADOW_ENV_REQUIRED:GEOX_ADR_SHADOW_DATABASE_URL');

  const genericAlias = baseChildEnv(databaseUrl, projectionPath);
  genericAlias.DATABASE_URL = databaseUrl;
  runFailure(genericAlias, 'ADR_SHADOW_DATABASE_ALIAS_FORBIDDEN:DATABASE_URL');

  const mcftAlias = baseChildEnv(databaseUrl, projectionPath);
  mcftAlias.GEOX_MCFT_CAP09_T4R1_S6_DATABASE_URL = databaseUrl;
  runFailure(mcftAlias, 'ADR_SHADOW_DATABASE_ALIAS_FORBIDDEN:GEOX_MCFT_CAP09_T4R1_S6_DATABASE_URL');

  const invalidMode = baseChildEnv(databaseUrl, projectionPath);
  invalidMode.GEOX_ADR_SHADOW_OBSERVATION_MODE = 'AUTO';
  runFailure(invalidMode, 'ADR_SHADOW_OBSERVATION_MODE_INVALID');

  const promotedPath = join(temp, 'projection-promoted.json');
  writeFileSync(promotedPath, `${JSON.stringify({ ...projection, field_actionable: true }, null, 2)}\n`, 'utf8');
  runFailure(baseChildEnv(databaseUrl, promotedPath), 'ADR_SHADOW_ACTIONABILITY_PROMOTION_FORBIDDEN');

  const after = normalizeRows((await pool.query(controlSql, scopeValues)).rows);
  assert.deepEqual(after, before, 'P5 one-shot observer and all failure probes must leave rows unchanged');

  const serverVersion = String((await pool.query('SHOW server_version')).rows[0]?.server_version ?? '');
  assert.ok(serverVersion.startsWith('16.'));

  const evidence = {
    status: 'PASS',
    milestone: 'GEOX_ADR_EXPLICIT_ONE_SHOT_SHADOW_OBSERVER_V1',
    geoxSourceCommit: geoxHead,
    p4MergedPredecessor: P4_MERGED_PREDECESSOR,
    postgresVersion: serverVersion,
    isolatedPostgresEndpoint: true,
    operationalEntrypointQualified: true,
    explicitOneShotModeRequired: true,
    dedicatedDatabaseUrlRequired: true,
    genericDatabaseFallbackRejected: true,
    genericDatabaseAliasRejected: true,
    mcftDatabaseAliasRejected: true,
    invalidModeRejected: true,
    projectionActionabilityPromotionRejected: true,
    transactionReadOnly: positive.transaction_guard.transaction_read_only,
    transactionIsolation: positive.transaction_guard.transaction_isolation,
    realityRowCount: positive.observation.geox_context.reality_rows.length,
    fixtureRowCountBefore: before.length,
    fixtureRowCountAfter: after.length,
    fixtureRowsUnchanged: true,
    provenancePreserved: positive.observation.geox_context.reality_rows.every(
      (row) => row.fact_id && row.source_observation_ids.length > 0 && row.source_device_ids.length > 0
    ),
    liveProductionReadModelObserved: false,
    productionDatabaseEndpointUsed: false,
    productionDatabaseCredentialProvisioned: false,
    productionRuntimeActivated: false,
    daemonOrSchedulerStarted: false,
    persistentWriteCreated: false,
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
  rmSync(temp, { recursive: true, force: true });
}
