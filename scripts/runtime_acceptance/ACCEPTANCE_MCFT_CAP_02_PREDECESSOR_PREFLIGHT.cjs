// scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_02_PREDECESSOR_PREFLIGHT.cjs
// Purpose: verify MCFT-CAP-01 on the exact merged-main commit, execute its persisted A0 path in an isolated PostgreSQL database, and extract the canonical predecessor identity snapshot required by MCFT-CAP-02.
// Boundary: governance preflight only; no MCFT-CAP-02 Runtime source, continuation tick, propagation, Forecast success, Scenario, Recommendation, Decision, AO-ACT, scheduler, or production claim.

'use strict';

const assert = require('node:assert/strict');
const cp = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { URL } = require('node:url');
const { Pool } = require('pg');

const ROOT = path.resolve(__dirname, '../..');
const BASELINE_MAIN = '7da8fee4daf1f022edff29078a1bbac207d1a32f';
const IMPLEMENTATION_CANDIDATE = '193f9785e42eb146e300e2a64abeed455f10e54e';
const FINAL_CLOSURE_HEAD = '7fedd85815cd65f0e3d2aedc74e4d0d9ed1b0558';
const LOGICAL_TIME = '2026-06-01T01:00:00.000Z';
const NEXT_LOGICAL_TIME = '2026-06-01T02:00:00.000Z';
const EXPECTED_REALITY_REF = 'mcft_rb_bf1da664164a4fedda249bcb';
const EXPECTED_REALITY_HASH = 'sha256:bf1da664164a4fedda249bcb0e330c1af2083173a52bd704f01eac3ad277ba4f';
const EXPECTED_SOURCE_MATRIX_HASH = 'sha256:c5187c23be0d058ffa23d464ae1139f924f5af064a270248746fbabde4c3e51b';
const EXPECTED_CONFIGURATION_MATRIX_HASH = 'sha256:381ef166454c7b698c6641fadc5d08019fecff127e9529a4c58a1f09d9e1fef5';
const EXPECTED_GEOMETRY_HASH = 'sha256:d3dbc5495485e7af68acdc4b32e6061c2ea99772835be2805ae706b74d75ca51';
const EXPECTED_CONTEXT_HASH = 'sha256:2287c71e983b1ba529e49939f025d9b035e09e195a5effc994fe54b4ef7863ce';
const PNPM = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
const GIT = process.platform === 'win32' ? 'git.exe' : 'git';

let pass = 0;

function ok(message) {
  pass += 1;
  process.stdout.write(`PASS ${message}\n`);
}

function fail(code, details = '') {
  const suffix = details ? `:${details}` : '';
  throw new Error(`${code}${suffix}`);
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function run(executable, args, options = {}) {
  const result = cp.spawnSync(executable, args, {
    cwd: options.cwd || ROOT,
    env: { ...process.env, ...(options.env || {}) },
    encoding: 'utf8',
    stdio: options.inherit ? 'inherit' : 'pipe',
    shell: false,
    maxBuffer: 64 * 1024 * 1024,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    const stdout = result.stdout || '';
    const stderr = result.stderr || '';
    throw new Error(`COMMAND_FAILED:${executable} ${args.join(' ')}\n${stdout}\n${stderr}`);
  }
  return String(result.stdout || '');
}

function git(args, cwd = ROOT) {
  return run(GIT, args, { cwd }).trim();
}

function resolveDatabaseName(databaseUrl) {
  let parsed;
  try {
    parsed = new URL(databaseUrl);
  } catch {
    fail('DATABASE_URL_INVALID');
  }
  const databaseName = decodeURIComponent(parsed.pathname.replace(/^\//, ''));
  if (!databaseName) fail('DATABASE_NAME_REQUIRED');
  if (!/(mcft.*cap.*02|cap.*02.*mcft|acceptance|test)/i.test(databaseName)) {
    fail('ISOLATED_ACCEPTANCE_DATABASE_REQUIRED', databaseName);
  }
  return databaseName;
}

function assertAuthorizationBranchBoundary() {
  const changed = git(['diff', '--name-only', `${BASELINE_MAIN}...HEAD`]).split(/\r?\n/).filter(Boolean);
  const allowedExact = new Set([
    'docs/digital_twin/mcft/cap_01/GEOX-MCFT-CAP-01-MAIN-VERIFICATION.json',
    'docs/digital_twin/GEOX-MCFT-VERTICAL-CAPABILITY-LINE-MATRIX.json',
    'docs/digital_twin/GEOX-DT-02-MCFT-IMPLEMENTATION-MAP.md',
    'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_02_PREDECESSOR_PREFLIGHT.cjs',
    'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_02_AUTHORIZATION.cjs',
  ]);
  const forbidden = changed.filter((file) => !file.startsWith('docs/digital_twin/mcft/cap_02/') && !allowedExact.has(file));
  assert.deepEqual(forbidden, [], `AUTHORIZATION_CHANGED_FILE_BOUNDARY_VIOLATION:${forbidden.join(',')}`);
  ok('authorization branch changes remain inside the frozen governance boundary');
}

function assertLocalMainRef() {
  const localMain = git(['rev-parse', 'refs/heads/main']);
  assert.equal(localMain, BASELINE_MAIN, 'LOCAL_MAIN_HEAD_MISMATCH');
  ok(`local main ref is exact predecessor merge commit ${BASELINE_MAIN}`);

  try {
    const originMain = git(['rev-parse', 'refs/remotes/origin/main']);
    assert.equal(originMain, BASELINE_MAIN, 'ORIGIN_MAIN_HEAD_MISMATCH');
    ok('origin/main ref is exact predecessor merge commit');
  } catch (error) {
    if (String(error.message).includes('unknown revision') || String(error.message).includes('ambiguous argument')) {
      process.stdout.write('INFO origin/main ref unavailable; local main exactness remains authoritative for this preflight\n');
    } else {
      throw error;
    }
  }
}

async function initializeIsolatedDatabase(pool, worktree) {
  const sqlFiles = [
    'docker/postgres/init/001_schema.sql',
    'apps/server/db/migrations/2026_07_09_mcft_cap_01_a0_persistence.sql',
    'apps/server/db/migrations/2026_07_10_mcft_cap_01_closure_remediation.sql',
  ];
  for (const relativePath of sqlFiles) {
    await pool.query(fs.readFileSync(path.join(worktree, relativePath), 'utf8'));
  }
  for (const table of [
    'twin_runtime_health_latest_index_v1',
    'twin_runtime_checkpoint_latest_index_v1',
    'twin_forecast_success_latest_index_v1',
    'twin_forecast_result_latest_index_v1',
    'twin_state_latest_index_v1',
    'twin_state_history_projection_v1',
    'twin_active_lineage_index_v1',
    'twin_object_idempotency_index_v1',
    'twin_runtime_lease_v1',
    'twin_runtime_authority_snapshot_v1',
  ]) {
    await pool.query(`DELETE FROM ${table}`);
  }
  await pool.query("DELETE FROM facts WHERE source='system'");
  ok('isolated PostgreSQL schema initialized and predecessor Runtime state cleared');
}

function factEnvelope(recordJson) {
  const record = typeof recordJson === 'string' ? JSON.parse(recordJson) : recordJson;
  assert.ok(record && typeof record === 'object' && record.payload && typeof record.payload === 'object', 'CANONICAL_FACT_ENVELOPE_INVALID');
  return record.payload;
}

async function readCanonicalObject(pool, objectId, objectType) {
  const result = await pool.query(
    "SELECT record_json FROM facts WHERE record_json->'payload'->>'object_id'=$1 AND record_json->>'type'=$2",
    [objectId, objectType],
  );
  assert.equal(result.rows.length, 1, `CANONICAL_OBJECT_CARDINALITY:${objectType}:${objectId}`);
  const object = factEnvelope(result.rows[0].record_json);
  assert.equal(object.object_id, objectId, `CANONICAL_OBJECT_ID_MISMATCH:${objectType}`);
  assert.equal(object.object_type, objectType, `CANONICAL_OBJECT_TYPE_MISMATCH:${objectType}`);
  return object;
}

async function extractCanonicalIdentity(pool, worktree) {
  const reality = readJson(path.join(worktree, 'docs/digital_twin/mcft/GEOX-MCFT-00-REALITY-BINDING.json'));
  const context = readJson(path.join(worktree, 'fixtures/mcft/water_state/replay_v1/configuration_context.json'));
  const scope = reality.semantic_payload.scope;
  assert.equal(reality.binding_id, EXPECTED_REALITY_REF);
  assert.equal(reality.determinism_hash, EXPECTED_REALITY_HASH);
  assert.equal(reality.semantic_payload.source_binding_matrix.determinism_hash, EXPECTED_SOURCE_MATRIX_HASH);
  assert.equal(reality.semantic_payload.configuration_binding_matrix.determinism_hash, EXPECTED_CONFIGURATION_MATRIX_HASH);
  assert.equal(reality.semantic_payload.geometry_binding.geometry_semantic_hash, EXPECTED_GEOMETRY_HASH);
  assert.equal(context.determinism_hash, EXPECTED_CONTEXT_HASH);
  ok('frozen Reality, source, configuration, geometry and crop-stage context identities match');

  const scopeValues = [scope.tenant_id, scope.project_id, scope.group_id, scope.field_id, scope.season_id, scope.zone_id];
  const activeResult = await pool.query(
    'SELECT active_lineage_ref FROM twin_active_lineage_index_v1 WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6',
    scopeValues,
  );
  const checkpointResult = await pool.query(
    'SELECT checkpoint_object_id FROM twin_runtime_checkpoint_latest_index_v1 WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6',
    scopeValues,
  );
  const stateResult = await pool.query(
    'SELECT state_object_id FROM twin_state_latest_index_v1 WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6',
    scopeValues,
  );
  assert.equal(activeResult.rows.length, 1, 'ACTIVE_LINEAGE_POINTER_CARDINALITY');
  assert.equal(checkpointResult.rows.length, 1, 'CHECKPOINT_POINTER_CARDINALITY');
  assert.equal(stateResult.rows.length, 1, 'STATE_POINTER_CARDINALITY');

  const activeLineageRef = activeResult.rows[0].active_lineage_ref;
  const checkpointRef = checkpointResult.rows[0].checkpoint_object_id;
  const stateRef = stateResult.rows[0].state_object_id;
  const lineage = await readCanonicalObject(pool, activeLineageRef, 'twin_runtime_lineage_v1');
  const checkpoint = await readCanonicalObject(pool, checkpointRef, 'twin_runtime_checkpoint_v1');
  const state = await readCanonicalObject(pool, stateRef, 'twin_state_estimate_v1');
  assert.equal(typeof state.runtime_config_ref, 'string', 'STATE_RUNTIME_CONFIG_REF_REQUIRED');
  const runtimeConfig = await readCanonicalObject(pool, state.runtime_config_ref, 'twin_runtime_config_v1');

  assert.equal(activeLineageRef, lineage.object_id, 'ACTIVE_LINEAGE_OBJECT_REF_MISMATCH');
  assert.equal(lineage.lineage_id, checkpoint.lineage_id, 'LINEAGE_CHECKPOINT_ID_MISMATCH');
  assert.equal(lineage.lineage_id, state.lineage_id, 'LINEAGE_STATE_ID_MISMATCH');
  assert.equal(lineage.revision_id, checkpoint.revision_id, 'LINEAGE_CHECKPOINT_REVISION_MISMATCH');
  assert.equal(lineage.revision_id, state.revision_id, 'LINEAGE_STATE_REVISION_MISMATCH');
  assert.equal(checkpoint.payload.last_posterior_state_ref, state.object_id, 'CHECKPOINT_STATE_REF_MISMATCH');
  assert.equal(state.runtime_config_ref, runtimeConfig.object_id, 'STATE_RUNTIME_CONFIG_REF_MISMATCH');
  assert.equal(state.runtime_config_hash, runtimeConfig.determinism_hash, 'STATE_RUNTIME_CONFIG_HASH_MISMATCH');
  assert.equal(checkpoint.payload.next_tick_logical_time, NEXT_LOGICAL_TIME, 'NEXT_LOGICAL_TICK_TIME_MISMATCH');

  const realitySnapshotResult = await pool.query(
    "SELECT authority_ref,determinism_hash,semantic_payload FROM twin_runtime_authority_snapshot_v1 WHERE authority_kind='REALITY_BINDING' AND authority_ref=$1",
    [EXPECTED_REALITY_REF],
  );
  assert.equal(realitySnapshotResult.rows.length, 1, 'REALITY_BINDING_SNAPSHOT_CARDINALITY');
  assert.equal(realitySnapshotResult.rows[0].determinism_hash, EXPECTED_REALITY_HASH, 'REALITY_BINDING_SNAPSHOT_HASH_MISMATCH');
  assert.equal(realitySnapshotResult.rows[0].semantic_payload.binding_id, EXPECTED_REALITY_REF, 'REALITY_BINDING_SNAPSHOT_REF_MISMATCH');
  ok('canonical predecessor lineage, checkpoint, State, Runtime Config and Reality snapshot read back consistently from PostgreSQL');

  return {
    schema_version: 'geox_mcft_cap_02_predecessor_identity_evidence_v1',
    extraction_source: 'ISOLATED_POSTGRESQL_CANONICAL_READ_PATH',
    predecessor_merge_commit: BASELINE_MAIN,
    scope,
    reality_binding_ref: reality.binding_id,
    reality_binding_hash: reality.determinism_hash,
    source_matrix_hash: reality.semantic_payload.source_binding_matrix.determinism_hash,
    configuration_matrix_hash: reality.semantic_payload.configuration_binding_matrix.determinism_hash,
    geometry_semantic_hash: reality.semantic_payload.geometry_binding.geometry_semantic_hash,
    active_lineage_object_ref: lineage.object_id,
    lineage_id: lineage.lineage_id,
    revision_id: lineage.revision_id,
    bootstrap_state_ref: state.object_id,
    bootstrap_state_hash: state.determinism_hash,
    bootstrap_checkpoint_ref: checkpoint.object_id,
    bootstrap_checkpoint_hash: checkpoint.determinism_hash,
    bootstrap_runtime_config_ref: runtimeConfig.object_id,
    bootstrap_runtime_config_hash: runtimeConfig.determinism_hash,
    next_logical_tick_time: checkpoint.payload.next_tick_logical_time,
    crop_stage_context_ref: 'fixtures/mcft/water_state/replay_v1/configuration_context.json',
    crop_stage_context_hash: context.determinism_hash,
    validated_relations: [
      'active_lineage_ref_equals_lineage_object_id',
      'lineage_id_equals_checkpoint_lineage_id_equals_state_lineage_id',
      'revision_id_equals_checkpoint_revision_id_equals_state_revision_id',
      'checkpoint_last_posterior_state_ref_equals_state_object_id',
      'state_runtime_config_ref_equals_runtime_config_object_id',
      'state_runtime_config_hash_equals_runtime_config_determinism_hash'
    ]
  };
}

async function main() {
  if (process.env.MCFT_CAP_02_PREFLIGHT_DESTRUCTIVE_ACCEPTANCE !== '1') fail('SET_MCFT_CAP_02_PREFLIGHT_DESTRUCTIVE_ACCEPTANCE_1');
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) fail('DATABASE_URL_REQUIRED');
  const databaseName = resolveDatabaseName(databaseUrl);
  ok(`database name is explicitly isolated for acceptance: ${databaseName}`);

  assert.equal(git(['rev-parse', '--show-toplevel']), ROOT, 'REPOSITORY_ROOT_MISMATCH');
  assertLocalMainRef();
  git(['cat-file', '-e', `${BASELINE_MAIN}^{commit}`]);
  ok('predecessor merge commit exists locally');
  assertAuthorizationBranchBoundary();

  const worktree = path.join(os.tmpdir(), `geox-mcft-cap02-predecessor-${process.pid}`);
  const outputDir = path.join(ROOT, 'acceptance-output');
  const verificationPath = path.join(ROOT, 'docs/digital_twin/mcft/cap_01/GEOX-MCFT-CAP-01-MAIN-VERIFICATION.json');
  const identityEvidencePath = path.join(outputDir, 'MCFT_CAP_02_PREDECESSOR_IDENTITY.json');
  let worktreeCreated = false;
  const pool = new Pool({ connectionString: databaseUrl });

  try {
    if (fs.existsSync(worktree)) fs.rmSync(worktree, { recursive: true, force: true });
    run(GIT, ['worktree', 'add', '--detach', worktree, BASELINE_MAIN], { cwd: ROOT });
    worktreeCreated = true;
    assert.equal(git(['rev-parse', 'HEAD'], worktree), BASELINE_MAIN, 'WORKTREE_HEAD_MISMATCH');
    assert.equal(git(['status', '--short'], worktree), '', 'WORKTREE_NOT_CLEAN_BEFORE_VERIFICATION');
    ok('detached merged-main verification worktree is exact and clean');

    run(PNPM, ['install', '--frozen-lockfile'], { cwd: worktree, inherit: true });
    const closureOutput = run(process.execPath, ['scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_01_CLOSURE_REMEDIATION.cjs'], { cwd: worktree });
    if (!closureOutput.includes('MCFT-CAP-01 closure remediation final: 173 PASS, 0 FAIL')) fail('FINAL_CLOSURE_GATE_SUMMARY_MISMATCH');
    process.stdout.write(closureOutput);
    ok('MCFT-CAP-01 final closure Gate is 173 PASS, 0 FAIL on merged main');

    run(PNPM, ['--filter', '@geox/server', 'typecheck'], { cwd: worktree, inherit: true });
    ok('server typecheck passes on merged main');
    run(PNPM, ['--filter', '@geox/server', 'build'], { cwd: worktree, inherit: true });
    ok('server build passes on merged main');
    run(GIT, ['diff', '--check'], { cwd: worktree });
    ok('git diff --check passes on merged main worktree');
    assert.equal(git(['status', '--short'], worktree), '', 'WORKTREE_NOT_CLEAN_AFTER_VERIFICATION');
    ok('merged-main verification worktree remains clean after Gate, typecheck and build');

    await initializeIsolatedDatabase(pool, worktree);
    const runnerOutput = run(PNPM, [
      '-w', 'exec', 'tsx',
      'apps/server/scripts/mcft/MCFT_1_FIRST_CLASS_WATER_STATE_RUNNER.ts',
      '--logical-time', LOGICAL_TIME,
      '--runtime-config-logical-time', '2026-06-01T00:00:00.000Z',
      '--created-at', LOGICAL_TIME,
      '--database-url', databaseUrl,
      '--lease-owner', 'mcft-cap-02-predecessor-preflight',
      '--lease-duration-seconds', '300'
    ], { cwd: worktree });
    process.stdout.write(runnerOutput);
    const runnerLine = runnerOutput.trim().split(/\r?\n/).filter(Boolean).at(-1);
    const runnerResult = JSON.parse(runnerLine);
    assert.equal(runnerResult.ok, true, 'A0_RUNNER_OK_REQUIRED');
    assert.equal(runnerResult.execution_status, 'INSERTED', 'A0_RUNNER_INSERTED_REQUIRED');
    assert.equal(runnerResult.next_logical_tick_time, NEXT_LOGICAL_TIME, 'A0_RUNNER_NEXT_TICK_MISMATCH');
    ok('MCFT-CAP-01 A0 runner inserted the predecessor record set in isolated PostgreSQL');

    const identity = await extractCanonicalIdentity(pool, worktree);
    writeJson(identityEvidencePath, identity);
    ok(`predecessor identity evidence written to ${path.relative(ROOT, identityEvidencePath)}`);

    const verification = {
      schema_version: 'geox_mcft_cap_01_main_verification_v1',
      capability_line_id: 'MCFT-CAP-01',
      pr: 2316,
      implementation_candidate_head: IMPLEMENTATION_CANDIDATE,
      final_closure_head: FINAL_CLOSURE_HEAD,
      merge_commit: BASELINE_MAIN,
      main_head_verified: BASELINE_MAIN,
      verification_execution_mode: 'DETACHED_EXACT_COMMIT_WORKTREE',
      final_closure_gate: '173_PASS_0_FAIL',
      server_typecheck: 'PASS',
      server_build: 'PASS',
      git_diff_check: 'PASS',
      working_tree: 'CLEAN',
      canonical_identity_extraction: 'PASS',
      canonical_identity_evidence_ref: 'acceptance-output/MCFT_CAP_02_PREDECESSOR_IDENTITY.json',
      verification_status: 'COMPLETE'
    };
    writeJson(verificationPath, verification);
    ok(`merged-main verification artifact written to ${path.relative(ROOT, verificationPath)}`);

    process.stdout.write(`${JSON.stringify({
      ok: true,
      pass_count: pass,
      predecessor_merge_commit: BASELINE_MAIN,
      final_closure_gate: '173_PASS_0_FAIL',
      verification_artifact: path.relative(ROOT, verificationPath).replaceAll('\\', '/'),
      identity_evidence: path.relative(ROOT, identityEvidencePath).replaceAll('\\', '/'),
      active_lineage_object_ref: identity.active_lineage_object_ref,
      lineage_id: identity.lineage_id,
      revision_id: identity.revision_id,
      bootstrap_state_ref: identity.bootstrap_state_ref,
      bootstrap_checkpoint_ref: identity.bootstrap_checkpoint_ref,
      bootstrap_runtime_config_ref: identity.bootstrap_runtime_config_ref,
      next_logical_tick_time: identity.next_logical_tick_time
    })}\n`);
  } finally {
    await pool.end();
    if (worktreeCreated && process.env.MCFT_CAP_02_KEEP_VERIFICATION_WORKTREE !== '1') {
      try {
        run(GIT, ['worktree', 'remove', '--force', worktree], { cwd: ROOT });
      } catch (error) {
        process.stderr.write(`WARN verification worktree cleanup failed: ${error.message}\n`);
      }
    } else if (worktreeCreated) {
      process.stdout.write(`INFO verification worktree retained at ${worktree}\n`);
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
