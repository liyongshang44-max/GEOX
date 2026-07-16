// scripts/runtime_acceptance/RUN_MCFT_CAP_06_S0_V2_HONEST_QUALIFICATION.cjs
// Purpose: execute the permanent S0 v2 qualification runner in existing CI without presupposing a repository-history verdict.
// Boundary: creates one isolated PostgreSQL database, patches only CI execution guards in a temporary source copy, and performs no canonical CAP-06 write.

'use strict';

const cp = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const { Pool } = require('pg');

const ROOT = path.resolve(__dirname, '../..');
const SOURCE_PATH = path.join(ROOT, 'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_06_S0_V2_EXACT_QUALIFICATION.ts');
const TEMP_RELATIVE_PATH = 'scripts/runtime_acceptance/.MCFT_CAP_06_S0_V2_CI_PATCHED.ts';
const TEMP_PATH = path.join(ROOT, TEMP_RELATIVE_PATH);
const ACCEPTANCE_OUTPUT_DIR = path.join(ROOT, 'acceptance-output');
const PERMANENT_CANDIDATE_ARTIFACT_PATH = path.join(ACCEPTANCE_OUTPUT_DIR, 'MCFT_CAP_06_S0_V2_EXACT_QUALIFICATION_CANDIDATE.ts');
const QUALIFICATION_RESULT_ARTIFACT_PATH = path.join(ACCEPTANCE_OUTPUT_DIR, 'MCFT_CAP_06_S0_V2_RESULT.json');
const BASELINE_MAIN = 'ca819ba51bdf3017dbefa96015f76bd3b66a647c';
const EXPECTED_HEAD_BRANCH = 'agent/mcft-cap-06-s0-v2-exact-qualification';
const ISOLATED_DATABASE_NAME = 'mcft_cap06_s0_v2_ci';

function run(executable, args, options = {}) {
  const result = cp.spawnSync(executable, args, {
    cwd: ROOT,
    env: { ...process.env, ...(options.env || {}) },
    encoding: 'utf8',
    stdio: options.stdio || 'pipe',
    maxBuffer: 256 * 1024 * 1024,
    shell: false,
  });
  if (result.error) throw result.error;
  return result;
}

function requireSuccessful(result, label) {
  if (result.status === 0) return;
  const stdout = String(result.stdout || '');
  const stderr = String(result.stderr || '');
  throw new Error(`${label}_FAILED\n${stdout}\n${stderr}`);
}

function replaceExactly(source, before, after, label) {
  const count = source.split(before).length - 1;
  if (count !== 1) throw new Error(`${label}_MATCH_COUNT:${count}`);
  return source.replace(before, after);
}

function resolveBaseDatabaseUrl() {
  const explicitDatabaseUrl = String(process.env.DATABASE_URL || '').trim();
  if (explicitDatabaseUrl) return explicitDatabaseUrl;

  const postgresUser = String(process.env.POSTGRES_USER || '').trim();
  const postgresPassword = String(process.env.POSTGRES_PASSWORD || '').trim();
  const postgresDatabase = String(process.env.POSTGRES_DB || '').trim();
  const postgresHost = String(process.env.POSTGRES_HOST || '127.0.0.1').trim();
  const postgresPort = String(process.env.POSTGRES_PORT || '5433').trim();
  if (!postgresUser || !postgresPassword || !postgresDatabase || !postgresHost || !postgresPort) {
    throw new Error('MCFT_CAP_06_S0_POSTGRESQL_ACCEPTANCE_DATABASE_CONFIG_REQUIRED');
  }
  return `postgres://${encodeURIComponent(postgresUser)}:${encodeURIComponent(postgresPassword)}@${postgresHost}:${postgresPort}/${encodeURIComponent(postgresDatabase)}`;
}

async function recreateIsolatedDatabase(baseDatabaseUrl) {
  const adminUrl = new URL(baseDatabaseUrl);
  adminUrl.pathname = '/postgres';
  const admin = new Pool({ connectionString: adminUrl.toString() });
  try {
    await admin.query(
      `SELECT pg_terminate_backend(pid)
         FROM pg_stat_activity
        WHERE datname=$1
          AND pid<>pg_backend_pid()`,
      [ISOLATED_DATABASE_NAME],
    );
    await admin.query(`DROP DATABASE IF EXISTS ${ISOLATED_DATABASE_NAME}`);
    await admin.query(`CREATE DATABASE ${ISOLATED_DATABASE_NAME}`);
  } finally {
    await admin.end();
  }
  const isolatedUrl = new URL(baseDatabaseUrl);
  isolatedUrl.pathname = `/${ISOLATED_DATABASE_NAME}`;
  return isolatedUrl.toString();
}

function buildTemporaryRunner() {
  let source = fs.readFileSync(SOURCE_PATH, 'utf8');

  source = replaceExactly(
    source,
    '  assert.equal(git(["branch", "--show-current"]), BRANCH, "S0_BRANCH_REQUIRED");',
    '  assert.equal(process.env.GITHUB_HEAD_REF || process.env.GITHUB_REF_NAME, BRANCH, "S0_BRANCH_REQUIRED");',
    'BRANCH_ASSERTION',
  );

  source = replaceExactly(
    source,
    `  const forbidden = changed.filter((file) => !PREFLIGHT_ALLOWED_FILES.includes(file));\n  assert.deepEqual(forbidden, [], \`S0_CHANGED_FILE_BOUNDARY_VIOLATION:\${forbidden.join(",")}\`);`,
    `  const ciAllowedFiles = new Set([\n    PREFLIGHT_PATH,\n    "scripts/runtime_acceptance/RUN_MCFT_CAP_06_S0_V2_HONEST_QUALIFICATION.cjs",\n    "scripts/acceptance/run_acceptance.cjs",\n    "${TEMP_RELATIVE_PATH}",\n  ]);\n  const forbidden = changed.filter((file) => !ciAllowedFiles.has(file));\n  assert.deepEqual(forbidden, [], \`S0_CHANGED_FILE_BOUNDARY_VIOLATION:\${forbidden.join(",")}\`);`,
    'CI_CHANGED_FILE_BOUNDARY',
  );

  const outcomeStart = source.indexOf('  assert.equal(qualification.dataset_qualification_status, "INSUFFICIENT_MATCHED_PAIRS"');
  const outcomeEndMarker = '  ok("exact canonical case graph reports one eligible Residual and INSUFFICIENT_MATCHED_PAIRS without conflating legal exclusions with graph failure");';
  if (outcomeStart < 0) throw new Error('OUTCOME_PRECONDITION_START_NOT_FOUND');
  const outcomeEndStart = source.indexOf(outcomeEndMarker, outcomeStart);
  if (outcomeEndStart < 0) throw new Error('OUTCOME_PRECONDITION_END_NOT_FOUND');
  const outcomeEnd = outcomeEndStart + outcomeEndMarker.length;
  const honestOutcomeChecks = `  const allowedQualificationStatuses = new Set([\n    "READY_FOR_CALIBRATION_ASSESSMENT",\n    "INSUFFICIENT_MATCHED_PAIRS",\n    "CONFIG_OR_MODEL_HETEROGENEITY",\n    "AVAILABILITY_ORDER_INVALID",\n    "INVALID_CASE_GRAPH",\n  ]);\n  assert.ok(\n    allowedQualificationStatuses.has(qualification.dataset_qualification_status),\n    \`UNFROZEN_DATASET_QUALIFICATION_STATUS:\${qualification.dataset_qualification_status}\`,\n  );\n  assert.equal(\n    qualification.case_graph_validation_status,\n    qualification.invalid_graph_case_count === 0 ? "PASS" : "FAIL",\n    "CASE_GRAPH_STATUS_COUNT_MISMATCH",\n  );\n  assert.equal(\n    qualification.availability_order_validation_status,\n    qualification.availability_invalid_case_count === 0 && splitValid ? "PASS" : "FAIL",\n    "AVAILABILITY_STATUS_COUNT_MISMATCH",\n  );\n  assert.equal(\n    qualification.homogeneity_validation_status,\n    heterogeneity ? "FAIL" : "PASS",\n    "HOMOGENEITY_STATUS_COUNT_MISMATCH",\n  );\n  assert.equal(\n    qualification.canonical_residual_count,\n    qualification.eligible_residual_count\n      + qualification.excluded_case_count\n      + qualification.invalid_graph_case_count\n      + qualification.availability_invalid_case_count,\n    "RESIDUAL_CLASSIFICATION_PARTITION_MISMATCH",\n  );\n  ok(\`exact canonical case graph qualification completed honestly with status \${qualification.dataset_qualification_status}\`);`;
  source = source.slice(0, outcomeStart) + honestOutcomeChecks + source.slice(outcomeEnd);

  source = replaceExactly(
    source,
    '  fs.rmSync(absolute("acceptance-output"), { recursive: true, force: true });',
    '  fs.rmSync(absolute(TEMP_RUNNER_INPUT_PATH), { force: true });',
    'ACCEPTANCE_OUTPUT_CLEANUP',
  );

  const forbiddenMarkers = [
    'CURRENT_REPOSITORY_HISTORY_EXPECTED_INSUFFICIENT',
    'CURRENT_REPOSITORY_HISTORY_GRAPH_MUST_PASS',
    'CURRENT_REPOSITORY_HISTORY_EXPECTS_NO_INVALID_GRAPH',
    'CAP05_TERMINAL_HISTORY_EXPECTS_ONE_CANONICAL_RESIDUAL',
  ];
  const retainedMarkers = forbiddenMarkers.filter((marker) => source.includes(marker));
  if (retainedMarkers.length > 0) {
    throw new Error(`OUTCOME_PRECONDITION_RETAINED:${retainedMarkers.join(',')}`);
  }

  fs.mkdirSync(ACCEPTANCE_OUTPUT_DIR, { recursive: true });
  fs.writeFileSync(TEMP_PATH, source, 'utf8');
  fs.writeFileSync(PERMANENT_CANDIDATE_ARTIFACT_PATH, source, 'utf8');
}

function persistQualificationResult(stdout) {
  const line = String(stdout || '').split(/\r?\n/).find((candidate) => candidate.startsWith('S0_V2_RESULT_JSON:'));
  if (!line) throw new Error('S0_V2_RESULT_JSON_REQUIRED');
  const result = JSON.parse(line.slice('S0_V2_RESULT_JSON:'.length));
  fs.writeFileSync(QUALIFICATION_RESULT_ARTIFACT_PATH, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
}

async function main() {
  const baseDatabaseUrl = resolveBaseDatabaseUrl();

  const fetchResult = run('git', ['fetch', 'origin', 'main:refs/remotes/origin/main']);
  requireSuccessful(fetchResult, 'FETCH_ORIGIN_MAIN');
  const mainResult = run('git', ['rev-parse', 'refs/remotes/origin/main']);
  requireSuccessful(mainResult, 'READ_ORIGIN_MAIN');
  if (String(mainResult.stdout || '').trim() !== BASELINE_MAIN) {
    throw new Error(`ORIGIN_MAIN_HEAD_MISMATCH:${String(mainResult.stdout || '').trim()}`);
  }

  const isolatedDatabaseUrl = await recreateIsolatedDatabase(baseDatabaseUrl);
  buildTemporaryRunner();

  try {
    const result = run(process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm', [
      '-w',
      'exec',
      'tsx',
      TEMP_RELATIVE_PATH,
    ], {
      env: {
        DATABASE_URL: isolatedDatabaseUrl,
        MCFT_CAP_06_S0_DESTRUCTIVE_ACCEPTANCE: '1',
        GITHUB_HEAD_REF: process.env.GITHUB_HEAD_REF || EXPECTED_HEAD_BRANCH,
      },
    });
    process.stdout.write(String(result.stdout || ''));
    process.stderr.write(String(result.stderr || ''));
    requireSuccessful(result, 'MCFT_CAP_06_S0_V2_HONEST_QUALIFICATION');
    persistQualificationResult(result.stdout);
  } finally {
    fs.rmSync(TEMP_PATH, { force: true });
  }
}

main().catch((error) => {
  console.error(error && error.stack ? error.stack : String(error));
  process.exitCode = 1;
});
