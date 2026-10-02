#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync, spawnSync } = require('node:child_process');

const INNER_REF = 'scripts/qualification/PROVISION_MCFT_CAP09_AM19_RUN_SCOPED_DATABASES_INNER_V1.cjs';
const INNER_BLOB_SHA = '80be618af01672a5d913f4334eca665447c91abf';
const SCHEMA_AUTHORITY_REF = 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-T4R1-ACTUAL-FORMAL-STORE-AUTHORITY-V3.json';
const EXPECTED_PARENT_DB = 'geox_mcft_cap09_s6_formal_t4r1_24h_v5';
const EXPECTED_PREDECESSOR_PUBLIC_TABLE_COUNT = 26;
const EXPECTED_V13_PUBLIC_TABLE_COUNT = 29;
const EXPECTED_NEW_RELATIONS = [
  "twin_external_formal_forcing_base_cursor_v1",
  "twin_external_formal_forcing_base_target_v1",
  "twin_external_formal_forcing_controller_lease_v1"
];
const EXPECTED_PUBLIC_TABLES = [
  "facts",
  "twin_action_feedback_cycle_projection_v1",
  "twin_action_feedback_evidence_index_v1",
  "twin_action_feedback_projection_v1",
  "twin_active_lineage_index_v1",
  "twin_approved_plan_binding_projection_v1",
  "twin_decision_record_projection_v1",
  "twin_external_formal_forcing_base_cursor_v1",
  "twin_external_formal_forcing_base_target_v1",
  "twin_external_formal_forcing_controller_lease_v1",
  "twin_forecast_point_projection_v1",
  "twin_forecast_residual_projection_v1",
  "twin_forecast_result_latest_index_v1",
  "twin_forecast_run_projection_v1",
  "twin_forecast_success_latest_index_v1",
  "twin_object_idempotency_index_v1",
  "twin_runtime_authority_snapshot_v1",
  "twin_runtime_checkpoint_latest_index_v1",
  "twin_runtime_health_latest_index_v1",
  "twin_runtime_lease_v1",
  "twin_scenario_latest_index_v1",
  "twin_scenario_point_projection_v1",
  "twin_scenario_set_projection_v1",
  "twin_scenario_set_uniqueness_v1",
  "twin_shadow_online_scheduler_cursor_v1",
  "twin_shadow_online_scheduler_slot_v1",
  "twin_state_history_projection_v1",
  "twin_state_latest_index_v1",
  "twin_terminal_tick_uniqueness_v1"
];
const INIT_COMPLETE_MARKER = 'PostgreSQL init process complete; ready for start up.';
const READINESS_POLICY = 'OFFICIAL_POSTGRES_INIT_COMPLETE_MARKER_THEN_SQL_PROBE_V1';
const SCHEMA_BINDING_POLICY = 'FORMAL_STORE_AUTHORITY_V3_EXACT_V13_29_TABLE_SET_V1';

const SOURCE_OUTPUT_DECLARATION = "const OUTPUT = path.resolve('acceptance-output/MCFT_CAP_09_AM19_RUN_SCOPED_DATABASE_PROVISIONING_V1.json');";
const SOURCE_TABLE_COUNT_GUARD = "  if (mainCount !== 26 || blockedCount !== 26) throw new Error(`AM19_QMIG_DB_PROVISION_REQUIRED_TABLE_COUNT_MISMATCH:${mainCount}:${blockedCount}`);";
const SOURCE_PROOF_TABLE_FIELDS = "    main_required_table_count: mainCount,\n    blocked_required_table_count: blockedCount,";

function sleep(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function git(...args) {
  return execFileSync('git', args, { encoding: 'utf8', windowsHide: true }).trim();
}

function exactReplace(source, oldValue, newValue, code) {
  const count = source.split(oldValue).length - 1;
  if (count !== 1) throw new Error(`${code}:${count}`);
  return source.replace(oldValue, newValue);
}

function required(name) {
  const value = String(process.env[name] ?? '').trim();
  if (!value) throw new Error(`AM19_QMIG_DB_PROVISION_WRAPPER_ENV_REQUIRED:${name}`);
  return value;
}

function dockerRaw(args) {
  const result = spawnSync('docker', args, {
    encoding: 'utf8',
    windowsHide: true,
    maxBuffer: 64 * 1024 * 1024,
  });
  if (result.error) throw result.error;
  return {
    status: result.status ?? 1,
    stdout: String(result.stdout ?? ''),
    stderr: String(result.stderr ?? ''),
  };
}

function verifyInner(repoRoot) {
  const actual = git('rev-parse', `HEAD:${INNER_REF}`);
  if (actual !== INNER_BLOB_SHA) {
    throw new Error(`AM19_QMIG_DB_PROVISION_INNER_BLOB_DRIFT:${actual}`);
  }
  return path.join(repoRoot, INNER_REF);
}

function verifySchemaAuthority() {
  const blob = git('rev-parse', `HEAD:${SCHEMA_AUTHORITY_REF}`);
  const authority = JSON.parse(git('show', `HEAD:${SCHEMA_AUTHORITY_REF}`));

  if (authority.schema_version !== 'geox_mcft_cap09_t4r1_actual_formal_store_authority_v3') {
    throw new Error('AM19_QMIG_DB_PROVISION_SCHEMA_AUTHORITY_VERSION_REQUIRED');
  }
  if (authority.database_identity?.database_name !== EXPECTED_PARENT_DB) {
    throw new Error(`AM19_QMIG_DB_PROVISION_SCHEMA_AUTHORITY_DATABASE_MISMATCH:${authority.database_identity?.database_name ?? ''}`);
  }
  if (authority.qualification_generation?.generation !== 'v13') {
    throw new Error(`AM19_QMIG_DB_PROVISION_SCHEMA_AUTHORITY_V13_REQUIRED:${authority.qualification_generation?.generation ?? ''}`);
  }
  if (authority.schema_contract?.predecessor_required_public_table_count !== EXPECTED_PREDECESSOR_PUBLIC_TABLE_COUNT) {
    throw new Error('AM19_QMIG_DB_PROVISION_SCHEMA_AUTHORITY_PREDECESSOR_COUNT_DRIFT');
  }
  if (authority.schema_contract?.v13_required_public_table_count !== EXPECTED_V13_PUBLIC_TABLE_COUNT) {
    throw new Error('AM19_QMIG_DB_PROVISION_SCHEMA_AUTHORITY_V13_COUNT_DRIFT');
  }
  if (JSON.stringify(authority.schema_contract?.new_operational_relations ?? []) !== JSON.stringify(EXPECTED_NEW_RELATIONS)) {
    throw new Error(`AM19_QMIG_DB_PROVISION_SCHEMA_AUTHORITY_NEW_RELATIONS_DRIFT:${JSON.stringify(authority.schema_contract?.new_operational_relations ?? [])}`);
  }
  if (EXPECTED_PUBLIC_TABLES.length !== EXPECTED_V13_PUBLIC_TABLE_COUNT) {
    throw new Error('AM19_QMIG_DB_PROVISION_EXPECTED_TABLE_SET_CARDINALITY_INVALID');
  }
  for (const relation of EXPECTED_NEW_RELATIONS) {
    if (!EXPECTED_PUBLIC_TABLES.includes(relation)) {
      throw new Error(`AM19_QMIG_DB_PROVISION_EXPECTED_NEW_RELATION_MISSING:${relation}`);
    }
  }
  return { blob };
}

function buildAuthorityBoundInner(innerPath, authorityBlob) {
  let source = fs.readFileSync(innerPath, 'utf8');

  const generatedConstants = [
    SOURCE_OUTPUT_DECLARATION,
    `const SCHEMA_AUTHORITY_REF = ${JSON.stringify(SCHEMA_AUTHORITY_REF)};`,
    `const SCHEMA_AUTHORITY_BLOB_SHA = ${JSON.stringify(authorityBlob)};`,
    `const SCHEMA_BINDING_POLICY = ${JSON.stringify(SCHEMA_BINDING_POLICY)};`,
    `const EXPECTED_PUBLIC_TABLES = ${JSON.stringify(EXPECTED_PUBLIC_TABLES)};`,
  ].join('\n');

  source = exactReplace(
    source,
    SOURCE_OUTPUT_DECLARATION,
    generatedConstants,
    'AM19_QMIG_DB_PROVISION_OUTPUT_DECLARATION_CARDINALITY',
  );

  const authorityBoundGuard = [
    "  if (mainCount !== EXPECTED_PUBLIC_TABLES.length || blockedCount !== EXPECTED_PUBLIC_TABLES.length) throw new Error(`AM19_QMIG_DB_PROVISION_REQUIRED_TABLE_COUNT_MISMATCH:${mainCount}:${blockedCount}:${EXPECTED_PUBLIC_TABLES.length}`);",
    "  const mainTables = dockerExec(container, `psql -U postgres -d \"${mainDb}\" -v ON_ERROR_STOP=1 -Atqc \"SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE' ORDER BY table_name\"`).trim().split(/\\r?\\n/).filter(Boolean);",
    "  const blockedTables = dockerExec(container, `psql -U postgres -d \"${blockedDb}\" -v ON_ERROR_STOP=1 -Atqc \"SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE' ORDER BY table_name\"`).trim().split(/\\r?\\n/).filter(Boolean);",
    "  if (JSON.stringify(mainTables) !== JSON.stringify(EXPECTED_PUBLIC_TABLES)) throw new Error(`AM19_QMIG_DB_PROVISION_MAIN_EXACT_TABLE_SET_MISMATCH:${JSON.stringify(mainTables)}`);",
    "  if (JSON.stringify(blockedTables) !== JSON.stringify(EXPECTED_PUBLIC_TABLES)) throw new Error(`AM19_QMIG_DB_PROVISION_BLOCKED_EXACT_TABLE_SET_MISMATCH:${JSON.stringify(blockedTables)}`);",
  ].join('\n');

  source = exactReplace(
    source,
    SOURCE_TABLE_COUNT_GUARD,
    authorityBoundGuard,
    'AM19_QMIG_DB_PROVISION_TABLE_GUARD_CARDINALITY',
  );

  const authorityProofFields = [
    "    schema_authority_ref: SCHEMA_AUTHORITY_REF,",
    "    schema_authority_blob_sha: SCHEMA_AUTHORITY_BLOB_SHA,",
    "    schema_binding_policy: SCHEMA_BINDING_POLICY,",
    "    expected_public_table_count: EXPECTED_PUBLIC_TABLES.length,",
    "    main_required_table_count: mainCount,",
    "    blocked_required_table_count: blockedCount,",
    "    main_public_tables: mainTables,",
    "    blocked_public_tables: blockedTables,",
    "    exact_public_table_set_match: true,",
  ].join('\n');

  source = exactReplace(
    source,
    SOURCE_PROOF_TABLE_FIELDS,
    authorityProofFields,
    'AM19_QMIG_DB_PROVISION_PROOF_TABLE_FIELDS_CARDINALITY',
  );

  if (source.includes('mainCount !== 26') || source.includes('blockedCount !== 26')) {
    throw new Error('AM19_QMIG_DB_PROVISION_PREDECESSOR_26_GUARD_SURVIVED');
  }

  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'geox-am19-provision-authority-'));
  const generatedPath = path.join(root, 'PROVISION_MCFT_CAP09_AM19_RUN_SCOPED_DATABASES_AUTHORITY_BOUND_GENERATED.cjs');
  fs.writeFileSync(generatedPath, source, { flag: 'wx' });

  const check = spawnSync(process.execPath, ['--check', generatedPath], {
    encoding: 'utf8',
    windowsHide: true,
  });
  if (check.error) throw check.error;
  if (check.status !== 0) {
    throw new Error(`AM19_QMIG_DB_PROVISION_AUTHORITY_BOUND_SYNTAX_FAILED:${check.stderr ?? ''}`);
  }

  return { root, generatedPath };
}

function waitForStablePostgres(container) {
  let markerObserved = false;
  let lastState = 'UNKNOWN';
  let lastProbe = '';

  for (let attempt = 0; attempt < 120; attempt += 1) {
    const inspect = dockerRaw(['inspect', '--format', '{{.State.Status}}', container]);
    if (inspect.status !== 0) {
      lastProbe = inspect.stderr.trim().slice(-1000);
      sleep(1000);
      continue;
    }

    lastState = inspect.stdout.trim();
    if (lastState === 'exited' || lastState === 'dead') {
      const logs = dockerRaw(['logs', container]);
      throw new Error(`AM19_QMIG_DB_PROVISION_LOCAL_POSTGRES_TERMINATED:${lastState}:${(logs.stdout + logs.stderr).slice(-4000)}`);
    }

    const logs = dockerRaw(['logs', container]);
    const combinedLogs = `${logs.stdout}\n${logs.stderr}`;
    markerObserved = markerObserved || combinedLogs.includes(INIT_COMPLETE_MARKER);

    if (markerObserved) {
      const probe = dockerRaw([
        'exec', container,
        'psql', '-U', 'postgres', '-d', 'postgres',
        '-v', 'ON_ERROR_STOP=1', '-Atqc', 'SELECT 1;',
      ]);
      lastProbe = `${probe.stdout}\n${probe.stderr}`.trim().slice(-1000);
      if (probe.status === 0 && probe.stdout.trim() === '1') {
        return { readiness_policy: READINESS_POLICY, init_complete_marker_observed: true };
      }
    }

    sleep(1000);
  }

  throw new Error(`AM19_QMIG_DB_PROVISION_STABLE_POSTGRES_TIMEOUT:${lastState}:${markerObserved}:${lastProbe}`);
}

function main() {
  const args = process.argv.slice(2);
  const mode = args[0] ?? '';
  if (!['selftest', 'preflight', 'run'].includes(mode)) {
    throw new Error('AM19_QMIG_DB_PROVISION_WRAPPER_MODE_REQUIRED');
  }

  const repoRoot = git('rev-parse', '--show-toplevel');
  const inner = verifyInner(repoRoot);
  const authority = verifySchemaAuthority();
  const generated = buildAuthorityBoundInner(inner, authority.blob);

  try {
    if (mode !== 'selftest') {
      const container = required('GEOX_AM19_QMIG_LOCAL_POSTGRES_CONTAINER');
      waitForStablePostgres(container);
    }

    const result = spawnSync(process.execPath, [generated.generatedPath, ...args], {
      cwd: process.cwd(),
      env: process.env,
      stdio: 'inherit',
      windowsHide: true,
    });
    if (result.error) throw result.error;
    if (result.status !== 0) process.exitCode = result.status || 1;
  } finally {
    fs.rmSync(generated.root, { recursive: true, force: true });
  }
}

main();
