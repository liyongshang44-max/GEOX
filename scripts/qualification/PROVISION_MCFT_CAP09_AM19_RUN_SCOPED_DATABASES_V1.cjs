#!/usr/bin/env node
'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const EXPECTED_PARENT_DB = 'geox_mcft_cap09_s6_formal_t4r1_24h_v5';
const EXPECTED_REMOTE_SERVER_MAJOR = 18;
const EXPECTED_LOCAL_SERVER_MAJOR = 18;
const EXPECTED_LOCAL_BASE_DB = 'ea5e2_readiness';
const MAIN_PREFIX = 'geox_mcft_cap09_am19_q_';
const BLOCKED_PREFIX = 'geox_mcft_cap09_am19_b_';
const CONTAINER_PREFIX = 'geox-am19-q-';
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
  if (!['selftest', 'preflight', 'run'].includes(mode)) throw new Error('AM19_QMIG_DB_PROVISION_MODE_REQUIRED');
  const args = { mode };
  for (let i = 1; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('--')) throw new Error(`AM19_QMIG_DB_PROVISION_UNKNOWN_ARGUMENT:${token}`);
    const key = token.slice(2);
    const value = argv[++i];
    if (!value || value.startsWith('--')) throw new Error(`AM19_QMIG_DB_PROVISION_ARGUMENT_VALUE_REQUIRED:${key}`);
    args[key] = value;
  }
  for (const key of ['postgres-image', 'schema-client-image']) {
    if (!args[key]) throw new Error(`AM19_QMIG_DB_PROVISION_ARGUMENT_REQUIRED:${key}`);
    if (!/^.+@sha256:[0-9a-f]{64}$/.test(args[key])) throw new Error(`AM19_QMIG_DB_PROVISION_PINNED_IMAGE_REQUIRED:${key}`);
  }
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
  return { raw, database };
}

function parsedLocalBase() {
  const raw = required('GEOX_AM19_QUALIFICATION_DATABASE_BASE_URL');
  const databaseUrl = required('DATABASE_URL');
  if (raw !== databaseUrl) throw new Error('AM19_QMIG_DB_PROVISION_LOCAL_BASE_DATABASE_URL_DRIFT');
  const url = new URL(raw);
  if (!['postgres:', 'postgresql:'].includes(url.protocol)) throw new Error('AM19_QMIG_DB_PROVISION_LOCAL_POSTGRES_REQUIRED');
  if (!['localhost', '127.0.0.1', '::1'].includes(url.hostname)) throw new Error('AM19_QMIG_DB_PROVISION_LOCALHOST_EXECUTION_PLANE_REQUIRED');
  const database = decodeURIComponent(url.pathname.replace(/^\//, ''));
  if (database !== EXPECTED_LOCAL_BASE_DB) throw new Error(`AM19_QMIG_DB_PROVISION_LOCAL_BASE_DB_REQUIRED:${database}`);
  return { raw, database, hostname: url.hostname, port: url.port || '5432' };
}

function containerName() {
  const name = required('GEOX_AM19_QMIG_LOCAL_POSTGRES_CONTAINER');
  if (!new RegExp(`^${CONTAINER_PREFIX}[0-9a-f]{16}$`).test(name)) throw new Error(`AM19_QMIG_DB_PROVISION_CONTAINER_IDENTITY_INVALID:${name}`);
  return name;
}

function docker(args, options = {}) {
  const result = spawnSync('docker', args, {
    input: options.input,
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

function assertContainer(container, image) {
  const out = docker(['inspect', '--format', '{{.State.Status}}|{{.Config.Image}}', container]).trim();
  const [status, configuredImage] = out.split('|');
  if (status !== 'running') throw new Error(`AM19_QMIG_DB_PROVISION_LOCAL_POSTGRES_NOT_RUNNING:${status}`);
  if (configuredImage !== image) throw new Error(`AM19_QMIG_DB_PROVISION_POSTGRES_IMAGE_DRIFT:${configuredImage}`);
}

function dockerExec(container, command, input) {
  const args = ['exec'];
  if (input !== undefined) args.push('-i');
  args.push(container, 'sh', '-c', command);
  return docker(args, { input });
}

function dockerSchemaClient(image, command, input) {
  const args = ['run', '--rm'];
  if (input !== undefined) args.push('-i');
  args.push(image, 'sh', '-c', command);
  return docker(args, { input });
}

function parseLocalRoleCapability(role) {
  const parts = String(role).trim().split('|');
  if (parts.length !== 3 || parts[0] !== 'postgres') throw new Error('AM19_QMIG_DB_PROVISION_LOCAL_ROLE_CAPABILITY_RESULT_INVALID');
  const superuser = parts[1] === '1';
  const createdb = parts[2] === '1';
  if (!superuser && !createdb) throw new Error('AM19_QMIG_DB_PROVISION_LOCAL_CREATEDB_AUTHORITY_REQUIRED');
  return { role: parts[0], superuser, createdb };
}

function localRoleCapability(container) {
  const role = dockerExec(
    container,
    'psql -U postgres -d postgres -v ON_ERROR_STOP=1 -Atqc "SELECT current_user||chr(124)||(CASE WHEN rolsuper THEN \'1\' ELSE \'0\' END)||chr(124)||(CASE WHEN rolcreatedb THEN \'1\' ELSE \'0\' END) FROM pg_roles WHERE rolname=current_user"',
  ).trim();
  return parseLocalRoleCapability(role);
}

function parsePgToolMajor(value, code) {
  const match = String(value).match(/PostgreSQL\)?\s+(\d+)(?:\.\d+)?/i);
  if (!match) throw new Error(`${code}:${String(value).trim()}`);
  return Number(match[1]);
}

function schemaClientMajor(image) {
  const out = docker(['run', '--rm', image, 'pg_dump', '--version']).trim();
  const major = parsePgToolMajor(out, 'AM19_QMIG_DB_PROVISION_SCHEMA_CLIENT_VERSION_UNPARSEABLE');
  if (major !== EXPECTED_REMOTE_SERVER_MAJOR) throw new Error(`AM19_QMIG_DB_PROVISION_SCHEMA_CLIENT_MAJOR_REQUIRED:${major}`);
  return major;
}

function localServerMajor(container) {
  const raw = dockerExec(container, 'psql -U postgres -d postgres -v ON_ERROR_STOP=1 -Atqc "SHOW server_version_num"').trim();
  if (!/^\d+$/.test(raw)) throw new Error(`AM19_QMIG_DB_PROVISION_LOCAL_SERVER_VERSION_INVALID:${raw}`);
  const major = Math.floor(Number(raw) / 10000);
  if (major !== EXPECTED_LOCAL_SERVER_MAJOR) throw new Error(`AM19_QMIG_DB_PROVISION_LOCAL_SERVER_MAJOR_REQUIRED:${major}`);
  return major;
}

function remoteServerMajor(image, sourceUrl) {
  const command = 'IFS= read -r SOURCE_DATABASE_URL; export SOURCE_DATABASE_URL; psql "$SOURCE_DATABASE_URL" -v ON_ERROR_STOP=1 -Atqc "SHOW server_version_num"';
  const raw = dockerSchemaClient(image, command, `${sourceUrl}\n`).trim();
  if (!/^\d+$/.test(raw)) throw new Error(`AM19_QMIG_DB_PROVISION_REMOTE_SERVER_VERSION_INVALID:${raw}`);
  const versionNum = Number(raw);
  const major = Math.floor(versionNum / 10000);
  if (major !== EXPECTED_REMOTE_SERVER_MAJOR) throw new Error(`AM19_QMIG_DB_PROVISION_REMOTE_SERVER_MAJOR_REQUIRED:${major}`);
  return major;
}

function dumpSchemaFromRemoteParent(schemaClientImage, sourceUrl) {
  const command = 'IFS= read -r SOURCE_DATABASE_URL; export SOURCE_DATABASE_URL; pg_dump --schema-only --no-owner --no-privileges "$SOURCE_DATABASE_URL"';
  const schema = dockerSchemaClient(schemaClientImage, command, `${sourceUrl}\n`);
  if (!schema.trim()) throw new Error('AM19_QMIG_DB_PROVISION_SCHEMA_DUMP_EMPTY');
  if (/^COPY\s|^INSERT\s+INTO\s/im.test(schema)) throw new Error('AM19_QMIG_DB_PROVISION_DATA_CLONE_FORBIDDEN');
  return schema;
}

function exists(container, name) {
  const sql = `SELECT count(*)::int FROM pg_database WHERE datname='${name}'`;
  return Number(dockerExec(container, `psql -U postgres -d postgres -v ON_ERROR_STOP=1 -Atqc "${sql}"`).trim());
}

function createDatabase(container, name) {
  if (exists(container, name) !== 0) throw new Error(`AM19_QMIG_DB_PROVISION_FRESH_TARGET_ALREADY_EXISTS:${name}`);
  dockerExec(container, `psql -U postgres -d postgres -v ON_ERROR_STOP=1 -c 'CREATE DATABASE "${name}" TEMPLATE template0' >/dev/null`);
  if (exists(container, name) !== 1) throw new Error(`AM19_QMIG_DB_PROVISION_CREATE_NOT_OBSERVED:${name}`);
}

function restoreSchema(container, name, schema) {
  dockerExec(container, `psql -U postgres -d "${name}" -v ON_ERROR_STOP=1 -f - >/dev/null`, schema);
}

function tableCount(container, name) {
  return Number(dockerExec(container, `psql -U postgres -d "${name}" -v ON_ERROR_STOP=1 -Atqc "SELECT count(*)::int FROM information_schema.tables WHERE table_schema='public'"`).trim());
}

function common(args) {
  if (String(process.env.GITHUB_ACTIONS ?? '').toLowerCase() === 'true') throw new Error('AM19_QMIG_DB_PROVISION_GITHUB_ACTIONS_FORBIDDEN');
  const parent = parsedParent();
  const local = parsedLocalBase();
  const container = containerName();
  const image = args['postgres-image'];
  const schemaClientImage = args['schema-client-image'];
  assertContainer(container, image);
  const executionMajor = localServerMajor(container);
  const capability = localRoleCapability(container);
  const clientMajor = schemaClientMajor(schemaClientImage);
  const serverMajor = remoteServerMajor(schemaClientImage, parent.raw);
  const schema = dumpSchemaFromRemoteParent(schemaClientImage, parent.raw);
  return { parent, local, container, image, schemaClientImage, executionMajor, capability, clientMajor, serverMajor, schema };
}

function preflight(args) {
  const { parent, local, container, image, schemaClientImage, executionMajor, capability, clientMajor, serverMajor, schema } = common(args);
  process.stdout.write(`${JSON.stringify({
    status: 'PASS',
    mode: 'READ_ONLY_PREFLIGHT',
    parent_database_name: parent.database,
    parent_database_policy: 'REMOTE_READ_ONLY_SCHEMA_SOURCE',
    remote_parent_server_major: serverMajor,
    schema_client_image: schemaClientImage,
    schema_client_major: clientMajor,
    schema_client_policy: 'EXACT_PINNED_POSTGRESQL_18_CLIENT_ONLY',
    qualification_database_execution_plane: 'LOCAL_EPHEMERAL_PINNED_POSTGRES_CONTAINER',
    local_base_database: local.database,
    local_postgres_container: container,
    postgres_image: image,
    execution_postgres_image: image,
    execution_postgres_major: executionMajor,
    execution_postgres_policy: 'EXACT_PINNED_POSTGRESQL_18_LOCAL_EPHEMERAL_EXECUTION_ONLY',
    local_createdb_authority: capability.createdb || capability.superuser,
    local_superuser: capability.superuser,
    source_schema_dump_digest: sha256(schema),
    source_schema_only: true,
    data_clone_forbidden: true,
    database_write_count: 0,
    remote_parent_mutation: false,
    formal_database_mutation: false,
    production_database_mutation: false,
    credential_values_recorded: false,
  })}\n`);
}

function run(args) {
  const { parent, local, container, image, schemaClientImage, executionMajor, clientMajor, serverMajor, schema } = common(args);
  const mainDb = assertTarget(required('GEOX_AM19_QMIG_MAIN_DB'), MAIN_PREFIX, 'AM19_QMIG_DB_PROVISION_MAIN_DB_INVALID');
  const blockedDb = assertTarget(required('GEOX_AM19_QMIG_BLOCKED_DB'), BLOCKED_PREFIX, 'AM19_QMIG_DB_PROVISION_BLOCKED_DB_INVALID');
  if (mainDb === blockedDb) throw new Error('AM19_QMIG_DB_PROVISION_TARGET_COLLISION');

  createDatabase(container, mainDb);
  createDatabase(container, blockedDb);
  restoreSchema(container, mainDb, schema);
  restoreSchema(container, blockedDb, schema);

  const mainCount = tableCount(container, mainDb);
  const blockedCount = tableCount(container, blockedDb);
  if (mainCount !== 26 || blockedCount !== 26) throw new Error(`AM19_QMIG_DB_PROVISION_REQUIRED_TABLE_COUNT_MISMATCH:${mainCount}:${blockedCount}`);

  fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
  const proof = {
    schema_version: 'geox_mcft_cap09_am19_run_scoped_database_provisioning_v1',
    status: 'PASS',
    mode: 'REMOTE_PARENT_SCHEMA_READ_ONLY_TO_LOCAL_EPHEMERAL_TEMPLATE0_DATABASES',
    parent_database_name: parent.database,
    parent_database_policy: 'REMOTE_READ_ONLY_SCHEMA_SOURCE',
    remote_parent_server_major: serverMajor,
    schema_client_image: schemaClientImage,
    schema_client_major: clientMajor,
    schema_client_policy: 'EXACT_PINNED_POSTGRESQL_18_CLIENT_ONLY',
    qualification_database_execution_plane: 'LOCAL_EPHEMERAL_PINNED_POSTGRES_CONTAINER',
    local_base_database: local.database,
    local_postgres_container: container,
    qualification_main_database: mainDb,
    qualification_blocked_database: blockedDb,
    postgres_image: image,
    execution_postgres_image: image,
    execution_postgres_major: executionMajor,
    execution_postgres_policy: 'EXACT_PINNED_POSTGRESQL_18_LOCAL_EPHEMERAL_EXECUTION_ONLY',
    source_schema_dump_digest: sha256(schema),
    source_schema_only: true,
    data_clone_forbidden: true,
    main_required_table_count: mainCount,
    blocked_required_table_count: blockedCount,
    fresh_target_reuse_forbidden: true,
    local_qualification_database_mutation: true,
    remote_qualification_database_mutation: false,
    remote_parent_mutation: false,
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
  const remote = new URL('postgres://readonly:secret@example.invalid:5432/geox_mcft_cap09_s6_formal_t4r1_24h_v5?sslmode=require');
  const local = new URL('postgres://postgres:postgres@127.0.0.1:55432/ea5e2_readiness');
  if (decodeURIComponent(remote.pathname.replace(/^\//, '')) !== EXPECTED_PARENT_DB) throw new Error('AM19_QMIG_DB_PROVISION_SELFTEST_PARENT');
  if (!['127.0.0.1', 'localhost', '::1'].includes(local.hostname)) throw new Error('AM19_QMIG_DB_PROVISION_SELFTEST_LOCALHOST');
  if (decodeURIComponent(local.pathname.replace(/^\//, '')) !== EXPECTED_LOCAL_BASE_DB) throw new Error('AM19_QMIG_DB_PROVISION_SELFTEST_LOCAL_BASE');
  const localCapability = parseLocalRoleCapability('postgres|1|1');
  if (!localCapability.superuser || !localCapability.createdb) throw new Error('AM19_QMIG_DB_PROVISION_SELFTEST_LOCAL_ROLE_CAPABILITY');
  if (parsePgToolMajor('pg_dump (PostgreSQL) 18.6', 'SELFTEST_SCHEMA_CLIENT') !== EXPECTED_REMOTE_SERVER_MAJOR) throw new Error('AM19_QMIG_DB_PROVISION_SELFTEST_SCHEMA_CLIENT_MAJOR');
  process.stdout.write(`${JSON.stringify({
    status: 'PASS',
    mode: 'SELFTEST',
    postgres_image_pinned: true,
    execution_postgres_image_pinned: true,
    execution_postgres_required_major: EXPECTED_LOCAL_SERVER_MAJOR,
    schema_client_image_pinned: true,
    expected_remote_server_major: EXPECTED_REMOTE_SERVER_MAJOR,
    parent_database: EXPECTED_PARENT_DB,
    parent_database_policy: 'REMOTE_READ_ONLY_SCHEMA_SOURCE',
    qualification_database_execution_plane: 'LOCAL_EPHEMERAL_PINNED_POSTGRES_CONTAINER',
    local_base_database: EXPECTED_LOCAL_BASE_DB,
    local_role_capability_encoding: 'CASE_BOOLEAN_TO_1_0_V1',
    template0_required: true,
    schema_only_restore_required: true,
    data_clone_forbidden: true,
    remote_admin_credential_required: false,
    database_access: false,
  })}\n`);
}

const args = parseArgs(process.argv.slice(2));
if (args.mode === 'selftest') selftest(args);
else if (args.mode === 'preflight') preflight(args);
else run(args);
