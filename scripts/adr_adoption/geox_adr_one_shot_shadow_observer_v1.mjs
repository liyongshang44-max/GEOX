import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import pg from 'pg';

const { Pool } = pg;
const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(SCRIPT_DIR, '../..');
const COMPILED_SEAM_PATH = resolve(
  REPO_ROOT,
  'apps/server/dist/apps/server/src/integrations/adr/read_only_shadow_adoption_v1.js'
);

const ONE_SHOT_RESULT_VERSION = 'geox.adr-one-shot-shadow-observer-result.v1';
const REQUIRED_MODE = 'EXPLICIT_ONE_SHOT_READ_ONLY';
const FORBIDDEN_DATABASE_ALIASES = [
  'DATABASE_URL',
  'GEOX_RUNTIME_DATABASE_URL',
  'GEOX_MCFT_CAP09_T3R1_S6_DATABASE_URL',
  'GEOX_MCFT_CAP09_T4R1_S6_DATABASE_URL',
];

function required(name) {
  const value = String(process.env[name] ?? '').trim();
  if (!value) throw new Error(`ADR_SHADOW_ENV_REQUIRED:${name}`);
  return value;
}

function canonicalDatabaseUrl(raw, label) {
  let parsed;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error(`ADR_SHADOW_DATABASE_URL_INVALID:${label}`);
  }
  if (parsed.protocol !== 'postgres:' && parsed.protocol !== 'postgresql:') {
    throw new Error(`ADR_SHADOW_DATABASE_URL_INVALID:${label}`);
  }
  return parsed.toString();
}

function governedDatabaseUrl() {
  const raw = required('GEOX_ADR_SHADOW_DATABASE_URL');
  const canonical = canonicalDatabaseUrl(raw, 'GEOX_ADR_SHADOW_DATABASE_URL');
  for (const name of FORBIDDEN_DATABASE_ALIASES) {
    const candidate = String(process.env[name] ?? '').trim();
    if (!candidate) continue;
    if (canonicalDatabaseUrl(candidate, name) === canonical) {
      throw new Error(`ADR_SHADOW_DATABASE_ALIAS_FORBIDDEN:${name}`);
    }
  }
  return raw;
}

function governedProjection() {
  const path = resolve(required('GEOX_ADR_SHADOW_PROJECTION_FILE'));
  let parsed;
  try {
    parsed = JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    throw new Error('ADR_SHADOW_PROJECTION_FILE_INVALID');
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('ADR_SHADOW_PROJECTION_FILE_INVALID');
  }
  return parsed;
}

const mode = required('GEOX_ADR_SHADOW_OBSERVATION_MODE');
if (mode !== REQUIRED_MODE) {
  throw new Error('ADR_SHADOW_OBSERVATION_MODE_INVALID');
}

const databaseUrl = governedDatabaseUrl();
const projection = governedProjection();
const scope = {
  tenant_id: required('GEOX_ADR_SHADOW_TENANT_ID'),
  project_id: required('GEOX_ADR_SHADOW_PROJECT_ID'),
  group_id: required('GEOX_ADR_SHADOW_GROUP_ID'),
  field_id: required('GEOX_ADR_SHADOW_FIELD_ID'),
};

const seam = await import(pathToFileURL(COMPILED_SEAM_PATH).href);
const pool = new Pool({ connectionString: databaseUrl, max: 1 });

try {
  const guarded = await seam.exportGeoxAdrPostgresTransactionGuardedReadOnlyShadowContextV1({
    pool,
    ...scope,
  });
  const observation = seam.createGeoxAdrReadOnlyShadowObservationV1({
    geox_context: guarded.context,
    adr_projection: projection,
  });

  const result = Object.freeze({
    contract_version: ONE_SHOT_RESULT_VERSION,
    execution_mode: REQUIRED_MODE,
    transaction_guard: Object.freeze({
      contract_version: guarded.contract_version,
      transaction_mode: guarded.transaction_mode,
      transaction_read_only: guarded.transaction_read_only,
      transaction_isolation: guarded.transaction_isolation,
    }),
    observation,
    operational_boundary: Object.freeze({
      one_shot: true,
      daemon_or_scheduler_started: false,
      database_credential_provisioned: false,
      database_write_authorized: false,
      recommendation_write_authorized: false,
      approval_authorized: false,
      operation_plan_or_task_creation_authorized: false,
      dispatch_authorized: false,
      machine_execution_authorized: false,
    }),
  });

  process.stdout.write(`${JSON.stringify(result)}\n`);
} finally {
  await pool.end();
}
