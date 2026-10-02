#!/usr/bin/env node
'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const EXPECTED_PARENT_DB = 'geox_mcft_cap09_s6_formal_t4r1_24h_v5';
const MAIN_PREFIX = 'geox_mcft_cap09_am19_q_';
const BLOCKED_PREFIX = 'geox_mcft_cap09_am19_b_';
const OUTPUT = path.resolve('acceptance-output/MCFT_CAP_09_AM19_RUN_SCOPED_DATABASE_PROVISIONING_V1.json');

function required(name) {
  const value = String(process.env[name] ?? '').trim();
  if (!value) throw new Error(`AM19_QMIG_DB_PROVISION_ENV_REQUIRED:${name}`);
  return value;
}

function sha256(value) {
  return `sha256:${crypto.createHash('sha256').update(value).digest('hex')}`;
}

function parseArgs(argv) {
  const mode = argv[0] ?? '';
  if (!['selftest', 'run'].includes(mode)) throw new Error('AM19_QMIG_DB_PROVISION_MODE_REQUIRED');
  const args = { mode };
  for (let i = 1; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('--')) throw new Error(`AM19_QMIG_DB_PROVISION_UNKNOWN_ARGUMENT:${token}`);
    const key = token.slice(2);
    const value = argv[++i];
    if (!value || value.startsWith('--')) throw new Error(`AM19_QMIG_DB_PROVISION_ARGUMENT_VALUE_REQUIRED:${key}`);
    args[key] = value;
  }
  if (!args['postgres-image']) throw new Error('AM19_QMIG_DB_PROVISION_POSTGRES_IMAGE_REQUIRED');
  if (!/^.+@sha256:[0-9a-f]{64}$/.test(args['postgres-image'])) throw new Error('AM19_QMIG_DB_PROVISION_PINNED_POSTGRES_IMAGE_REQUIRED');
  return args;
}

function assertTarget(name, prefix, code) {
  if (!new RegExp(`^${prefix}[0-9a-f]{16}$`).test(name)) throw new Error(`${code}:${name}`);
  return name;
}

function parsedParent() {
  const raw = required('MCFT_CAP09_PARENT_DATABASE_URL');
  const url = new URL(raw);
  if (!['postgres:', 'postgresql:'].includes(url.protocol)) throw new Error('AM19_QMIG_DB_PROVISION_POSTGRES_PARENT_REQUIRED');
  if (['localhost', '127.0.0.1', '::1'].includes(url.hostname)) throw new Error('AM19_QMIG_DB_PROVISION_REMOTE_PARENT_REQUIRED');
  const database = decodeURIComponent(url.pathname.replace(/^\//, ''));
  if (database !== EXPECTED_PARENT_DB) throw new Error(`AM19_QMIG_DB_PROVISION_PARENT_IDENTITY_REQUIRED:${database}`);
  return { raw, url, database };
}

function withDatabase(url, database) {
  const out = new URL(url.toString());
  out.pathname = `/${database}`;
  return out.toString();
}

function docker(image, envVars, command, input) {
  const args = ['run', '--rm'];
  if (input !== undefined) args.push('-i');
  for (const name of Object.keys(envVars).sort()) args.push('-e', name);
  args.push(image, 'sh', '-c', command);
  const result = spawnSync('docker', args, {
    env: { ...process.env, ...envVars },
    input,
    encoding: 'utf8',
    windowsHide: true,
    maxBuffer: 64 * 1024 * 1024,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    const stderr = String(result.stderr ?? '').trim().slice(-4000);
    throw new Error(`AM19_QMIG_DB_PROVISION_DOCKER_COMMAND_FAILED:${result.status}:${stderr}`);
  }
  return String(result.stdout ?? '');
}

function exists(image, adminUrl, name) {
  const sql = `SELECT count(*)::int FROM pg_database WHERE datname='${name}'`;
  const out = docker(image, { ADMIN_DATABASE_URL: adminUrl }, `psql "$ADMIN_DATABASE_URL" -v ON_ERROR_STOP=1 -Atqc "${sql}"`);
  return Number(out.trim());
}

function createDatabase(image, adminUrl, name) {
  if (exists(image, adminUrl, name) !== 0) throw new Error(`AM19_QMIG_DB_PROVISION_FRESH_TARGET_ALREADY_EXISTS:${name}`);
  docker(image, { ADMIN_DATABASE_URL: adminUrl }, `psql "$ADMIN_DATABASE_URL" -v ON_ERROR_STOP=1 -c 'CREATE DATABASE "${name}" TEMPLATE template0' >/dev/null`);
  if (exists(image, adminUrl, name) !== 1) throw new Error(`AM19_QMIG_DB_PROVISION_CREATE_NOT_OBSERVED:${name}`);
}

function tableCount(image, targetUrl) {
  const out = docker(image, { TARGET_DATABASE_URL: targetUrl }, 'psql "$TARGET_DATABASE_URL" -v ON_ERROR_STOP=1 -Atqc "SELECT count(*)::int FROM information_schema.tables WHERE table_schema=\'public\'"');
  return Number(out.trim());
}

function run(args) {
  if (String(process.env.GITHUB_ACTIONS ?? '').toLowerCase() === 'true') throw new Error('AM19_QMIG_DB_PROVISION_GITHUB_ACTIONS_FORBIDDEN');
  const { raw, url, database } = parsedParent();
  const mainDb = assertTarget(required('GEOX_AM19_QMIG_MAIN_DB'), MAIN_PREFIX, 'AM19_QMIG_DB_PROVISION_MAIN_DB_INVALID');
  const blockedDb = assertTarget(required('GEOX_AM19_QMIG_BLOCKED_DB'), BLOCKED_PREFIX, 'AM19_QMIG_DB_PROVISION_BLOCKED_DB_INVALID');
  if (mainDb === blockedDb) throw new Error('AM19_QMIG_DB_PROVISION_TARGET_COLLISION');

  const adminUrl = withDatabase(url, 'postgres');
  const mainUrl = withDatabase(url, mainDb);
  const blockedUrl = withDatabase(url, blockedDb);
  const image = args['postgres-image'];

  const role = docker(image, { ADMIN_DATABASE_URL: adminUrl }, 'psql "$ADMIN_DATABASE_URL" -v ON_ERROR_STOP=1 -Atqc "SELECT current_user||\'|\'||rolsuper::text||\'|\'||rolcreatedb::text FROM pg_roles WHERE rolname=current_user"').trim();
  const parts = role.split('|');
  if (parts.length !== 3 || (parts[1] !== 't' && parts[2] !== 't')) throw new Error('AM19_QMIG_DB_PROVISION_CREATEDB_AUTHORITY_REQUIRED');

  const schema = docker(image, { SOURCE_DATABASE_URL: raw }, 'pg_dump --schema-only --no-owner --no-privileges "$SOURCE_DATABASE_URL"');
  if (!schema.trim()) throw new Error('AM19_QMIG_DB_PROVISION_SCHEMA_DUMP_EMPTY');
  if (/^COPY\s|^INSERT\s+INTO\s/im.test(schema)) throw new Error('AM19_QMIG_DB_PROVISION_DATA_CLONE_FORBIDDEN');

  createDatabase(image, adminUrl, mainDb);
  createDatabase(image, adminUrl, blockedDb);

  docker(image, { TARGET_DATABASE_URL: mainUrl }, 'psql "$TARGET_DATABASE_URL" -v ON_ERROR_STOP=1 -f - >/dev/null', schema);
  docker(image, { TARGET_DATABASE_URL: blockedUrl }, 'psql "$TARGET_DATABASE_URL" -v ON_ERROR_STOP=1 -f - >/dev/null', schema);

  const mainCount = tableCount(image, mainUrl);
  const blockedCount = tableCount(image, blockedUrl);
  if (mainCount !== 26 || blockedCount !== 26) throw new Error(`AM19_QMIG_DB_PROVISION_REQUIRED_TABLE_COUNT_MISMATCH:${mainCount}:${blockedCount}`);

  fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
  const proof = {
    schema_version: 'geox_mcft_cap09_am19_run_scoped_database_provisioning_v1',
    status: 'PASS',
    mode: 'FRESH_TEMPLATE0_PLUS_SCHEMA_ONLY_RESTORE',
    parent_database_name: database,
    qualification_main_database: mainDb,
    qualification_blocked_database: blockedDb,
    postgres_image: image,
    source_schema_dump_digest: sha256(schema),
    source_schema_only: true,
    data_clone_forbidden: true,
    main_required_table_count: mainCount,
    blocked_required_table_count: blockedCount,
    fresh_target_reuse_forbidden: true,
    remote_qualification_database_mutation: true,
    formal_database_mutation: false,
    production_database_mutation: false,
    credential_values_recorded: false,
  };
  fs.writeFileSync(OUTPUT, `${JSON.stringify(proof, null, 2)}\n`, { flag: 'wx' });
  process.stdout.write(`${JSON.stringify(proof)}\n`);
}

function selftest(args) {
  assertTarget(`${MAIN_PREFIX}${'a'.repeat(16)}`, MAIN_PREFIX, 'SELFTEST_MAIN');
  assertTarget(`${BLOCKED_PREFIX}${'b'.repeat(16)}`, BLOCKED_PREFIX, 'SELFTEST_BLOCKED');
  const u = new URL('postgres://user:secret@example.invalid:5432/geox_mcft_cap09_s6_formal_t4r1_24h_v5?sslmode=require');
  if (decodeURIComponent(u.pathname.replace(/^\//, '')) !== EXPECTED_PARENT_DB) throw new Error('AM19_QMIG_DB_PROVISION_SELFTEST_PARENT');
  if (withDatabase(u, 'postgres').includes(EXPECTED_PARENT_DB)) throw new Error('AM19_QMIG_DB_PROVISION_SELFTEST_ADMIN_DATABASE_REWRITE');
  process.stdout.write(`${JSON.stringify({status:'PASS',mode:'SELFTEST',postgres_image_pinned:true,parent_database:EXPECTED_PARENT_DB,template0_required:true,schema_only_restore_required:true,data_clone_forbidden:true,database_access:false})}\n`);
}

const args = parseArgs(process.argv.slice(2));
if (args.mode === 'selftest') selftest(args);
else run(args);
