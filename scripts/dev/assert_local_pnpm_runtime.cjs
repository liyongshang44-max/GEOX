#!/usr/bin/env node
'use strict';

// scripts/dev/assert_local_pnpm_runtime.cjs
// Purpose: validate the local pnpm runtime, then execute the effective MCFT-CAP-05 governance and Runtime acceptance chain.
// Boundary: validation orchestration only; no production authority, public route, scheduler or canonical write path.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const isWindows = process.platform === 'win32';
const env = process.env;
const diagnosticPath = path.join(process.cwd(), 'acceptance-output', 'MCFT_CAP_05_S9_ACCEPTANCE.log');
const SETTLEMENT_BRANCH = 'agent/mcft-cap-05-s9-ssot-settlement-v1';
const SETTLEMENT_EXACT_HEAD = 'f188c2f2c9fd505daefbc31aeab0467242f2fcf8';
const SETTLEMENT_MERGE = '679a1442cc130c174951eb0330b0c82592e4a6df';
const PROBE_FILE = 'scripts/dev/assert_local_pnpm_runtime.cjs';

function run(command, args = [], envOverrides = {}, cwd = process.cwd()) {
  const result = spawnSync(command, args, {
    cwd,
    env: {
      ...process.env,
      CI: process.env.CI || 'true',
      npm_config_confirmModulesPurge: process.env.npm_config_confirmModulesPurge || 'false',
      npm_config_confirm_modules_purge: process.env.npm_config_confirm_modules_purge || 'false',
      ...envOverrides,
    },
    encoding: 'utf8',
    shell: false,
    maxBuffer: 256 * 1024 * 1024,
  });
  return {
    command: [command, ...args].join(' '),
    status: result.status,
    error: result.error ? String(result.error.message || result.error) : '',
    stdout: String(result.stdout || '').trim(),
    stderr: String(result.stderr || '').trim(),
  };
}

function appendDiagnostic(result) {
  fs.mkdirSync(path.dirname(diagnosticPath), { recursive: true });
  fs.appendFileSync(
    diagnosticPath,
    `\n$ ${result.command}\nstatus=${String(result.status)}\n${result.stdout || ''}\n${result.stderr || ''}\n`,
    'utf8',
  );
}

function requireSuccess(result) {
  appendDiagnostic(result);
  if (result.stdout) console.log(result.stdout);
  if (result.stderr) console.error(result.stderr);
  if (result.status !== 0) {
    throw new Error(`COMMAND_FAILED:${result.command}:${String(result.status)}:${result.error}`);
  }
  return result.stdout;
}

function exactChangedFiles(base, head, cwd = process.cwd()) {
  const output = requireSuccess(run('git', ['diff', '--name-only', base, head], {}, cwd));
  return output.split(/\r?\n/).filter(Boolean).sort();
}

function runMergedMainSettlementProbe() {
  requireSuccess(run('git', [
    'fetch',
    '--no-tags',
    'origin',
    '+refs/heads/main:refs/remotes/origin/main',
    `+refs/heads/${SETTLEMENT_BRANCH}:refs/remotes/origin/${SETTLEMENT_BRANCH}`,
  ]));
  assert.equal(
    requireSuccess(run('git', ['rev-parse', `origin/${SETTLEMENT_BRANCH}`])),
    SETTLEMENT_EXACT_HEAD,
    'settlement candidate branch moved after exact-head lock',
  );
  assert.equal(
    requireSuccess(run('git', ['rev-parse', 'origin/main'])),
    SETTLEMENT_MERGE,
    'main moved after settlement merge lock',
  );
  assert.deepEqual(
    exactChangedFiles(SETTLEMENT_EXACT_HEAD, SETTLEMENT_MERGE),
    [],
    'settlement exact head and merge commit must be file-tree equivalent',
  );
  assert.deepEqual(
    exactChangedFiles(SETTLEMENT_MERGE, 'HEAD'),
    [PROBE_FILE],
    'probe must differ from merged main by exactly one validation-only wrapper',
  );

  const worktreePath = fs.mkdtempSync(path.join(os.tmpdir(), 'geox-s9-settlement-effective-'));
  try {
    requireSuccess(run('git', ['worktree', 'add', '--detach', worktreePath, SETTLEMENT_MERGE]));
    requireSuccess(run(
      process.execPath,
      ['scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_05_S9_SETTLEMENT.cjs', '--postmerge'],
      {},
      worktreePath,
    ));
  } finally {
    requireSuccess(run('git', ['worktree', 'remove', '--force', worktreePath]));
  }
}

function normalized(value) {
  return String(value || '').replace(/\\/g, '/').toLowerCase();
}

function containsForeignPnpm(value) {
  const text = normalized(value);
  return text.includes('/home/')
    || text.includes('/wsl')
    || text.includes('wsl$')
    || text.includes('/corepack/v1/pnpm/11.')
    || text.includes('/.cache/node/corepack/v1/pnpm/11.');
}

function runRuntimeDoctor() {
  const pnpmCommand = isWindows ? 'pnpm.cmd' : 'pnpm';
  const version = run(pnpmCommand, ['--version']);
  const reasons = [];
  if (version.status !== 0 || !version.stdout) {
    reasons.push({ code: 'PNPM_VERSION_UNAVAILABLE', detail: version });
  }

  const candidates = [{ kind: 'pnpm_version', source: pnpmCommand, ...version }];
  if (isWindows) {
    const where = run('where.exe', ['pnpm']);
    candidates.push({ kind: 'where_pnpm', source: 'where.exe pnpm', ...where });
    if (!/^[a-zA-Z]:[\\/]/.test(process.execPath)) {
      reasons.push({ code: 'WINDOWS_PLATFORM_WITH_NON_WINDOWS_NODE_PATH', detail: process.execPath });
    }
    if (containsForeignPnpm(`${where.stdout}\n${where.stderr}`)) {
      reasons.push({ code: 'WINDOWS_POWERSHELL_RESOLVES_NON_WINDOWS_PNPM', detail: where.stdout });
    }
  } else {
    const which = run('which', ['pnpm']);
    candidates.push({ kind: 'which_pnpm', source: 'which pnpm', ...which });
  }

  for (const value of [env.npm_execpath, env.PNPM_HOME, env.COREPACK_ROOT]) {
    if (value && containsForeignPnpm(value) && isWindows) {
      reasons.push({ code: 'WSL_OR_COREPACK_PNPM_11_DETECTED', detail: value });
    }
  }

  if (reasons.length > 0) {
    console.error(JSON.stringify({
      ok: false,
      error: 'LOCAL_PNPM_RUNTIME_MISMATCH',
      reasons,
      process_platform: process.platform,
      process_exec_path: process.execPath,
      candidates,
    }, null, 2));
    process.exit(1);
  }

  console.log(JSON.stringify({
    ok: true,
    message: 'LOCAL_PNPM_RUNTIME_OK',
    process_platform: process.platform,
    process_exec_path: process.execPath,
    pnpm_version: version.stdout,
    candidates,
  }, null, 2));
}

function postgresBaseUrl() {
  if (env.DATABASE_URL) return env.DATABASE_URL;
  if (!env.POSTGRES_USER || !env.POSTGRES_PASSWORD || !env.POSTGRES_DB) return null;
  const host = env.POSTGRES_HOST || '127.0.0.1';
  const port = env.POSTGRES_PORT || '5433';
  return `postgres://${encodeURIComponent(env.POSTGRES_USER)}:${encodeURIComponent(env.POSTGRES_PASSWORD)}@${host}:${port}/${encodeURIComponent(env.POSTGRES_DB)}`;
}

function databaseUrl(base, databaseName) {
  const url = new URL(base);
  url.pathname = `/${databaseName}`;
  return url.toString();
}

function recreateDatabase(base, databaseName) {
  const admin = databaseUrl(base, 'postgres');
  requireSuccess(run('psql', [admin, '-v', 'ON_ERROR_STOP=1', '-c', `DROP DATABASE IF EXISTS ${databaseName} WITH (FORCE)`]));
  requireSuccess(run('psql', [admin, '-v', 'ON_ERROR_STOP=1', '-c', `CREATE DATABASE ${databaseName}`]));
}

function runGate(gatePath, mode = '--auto') {
  if (fs.existsSync(gatePath)) {
    requireSuccess(run(process.execPath, [gatePath, mode]));
  }
}

function runS6RemediationAcceptance() {
  const gatePath = path.join(process.cwd(), 'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_05_S6_VALIDATION_ORTHOGONALITY_REMEDIATION.cjs');
  runGate(gatePath, '--auto');

  const base = postgresBaseUrl();
  const shouldRunDatabase = env.CI === 'true' || env.MCFT_CAP_05_S6_VALIDATION_ORTHOGONALITY_RUN_DB_ACCEPTANCE === '1';
  if (!base || !shouldRunDatabase) return;
  const databaseName = 'mcft_cap05_s6_validation_orthogonality_acceptance';
  recreateDatabase(base, databaseName);
  requireSuccess(run(isWindows ? 'pnpm.cmd' : 'pnpm', [
    '-w', 'exec', 'tsx', 'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_05_ACTION_FEEDBACK_H_DB.ts',
  ], {
    DATABASE_URL: databaseUrl(base, databaseName),
    MCFT_CAP_05_S6_DESTRUCTIVE_ACCEPTANCE: '1',
  }));
}

function runS7RuntimeAcceptance({ runHistoricalGovernance }) {
  if (runHistoricalGovernance) {
    runGate(path.join(process.cwd(), 'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_05_S7_RECEIPT_CONSUMING_TICK.cjs'), '--auto');
  }

  const pnpmCommand = isWindows ? 'pnpm.cmd' : 'pnpm';
  requireSuccess(run(pnpmCommand, ['-w', 'exec', 'tsx', 'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_05_RECEIPT_CONSUMING_TICK.ts']));
  requireSuccess(run(pnpmCommand, ['-w', 'exec', 'tsx', 'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_05_NOT_YET_VALIDATED_RECEIPT_CONSUMING_TICK.ts']));
  requireSuccess(run(pnpmCommand, ['-w', 'exec', 'tsx', 'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_04_SINGLE_TICK_INTEGRATION.ts']));

  const base = postgresBaseUrl();
  const shouldRunDatabase = env.CI === 'true' || env.MCFT_CAP_05_S7_RUN_DB_ACCEPTANCE === '1';
  if (!base || !shouldRunDatabase) return;
  const databaseName = 'mcft_cap05_s7_acceptance';
  recreateDatabase(base, databaseName);
  requireSuccess(run(pnpmCommand, [
    '-w', 'exec', 'tsx', 'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_05_RECEIPT_CONSUMING_TICK_DB.ts',
  ], {
    DATABASE_URL: databaseUrl(base, databaseName),
    MCFT_CAP_05_S7_DESTRUCTIVE_ACCEPTANCE: '1',
  }));
}

function runCap05S8ResidualContractRemediationAcceptance({ runHistoricalGovernance }) {
  const gatePath = path.join(process.cwd(), 'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_05_S8_RESIDUAL_CONTRACT_REMEDIATION.cjs');
  if (runHistoricalGovernance) {
    runGate(gatePath, '--auto');
  }
  const pnpmCommand = isWindows ? 'pnpm.cmd' : 'pnpm';
  requireSuccess(run(pnpmCommand, ['-w', 'exec', 'tsx', 'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_05_CONTRACTS_PROJECTION_CONFIG.ts']));
  requireSuccess(run(pnpmCommand, ['-w', 'exec', 'tsx', 'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_05_S8_RESIDUAL_CONTRACT_CONFORMANCE.ts']));

  const shouldRunDatabase = env.CI === 'true' || env.MCFT_CAP_05_S8_RESIDUAL_CONTRACT_REMEDIATION_RUN_DB_ACCEPTANCE === '1';
  const base = postgresBaseUrl();
  if (!shouldRunDatabase || !base) return;
  const databaseName = 'mcft_cap05_s8_residual_contract_remediation_acceptance';
  recreateDatabase(base, databaseName);
  requireSuccess(run(pnpmCommand, ['-w', 'exec', 'tsx', 'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_05_PERSISTENCE_RECOVERY_DB.ts'], {
    DATABASE_URL: databaseUrl(base, databaseName),
    MCFT_CAP_05_S3_DESTRUCTIVE_ACCEPTANCE: '1',
  }));
}

// MCFT_CAP_05_S8_FORECAST_RESIDUAL_C_COMMIT_GATE_V1: execute the bounded outcome-tick plus C commit and PostgreSQL source/recovery acceptance.
function runCap05S8ForecastResidualRuntimeAcceptance({ runHistoricalGovernance }) {
  const gatePath = path.join(process.cwd(), 'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_05_S8_FORECAST_RESIDUAL_C_COMMIT.cjs');
  if (runHistoricalGovernance) {
    runGate(gatePath, '--auto');
  }
  const pnpmCommand = isWindows ? 'pnpm.cmd' : 'pnpm';
  requireSuccess(run(pnpmCommand, ['-w', 'exec', 'tsx', 'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_05_FORECAST_RESIDUAL_OUTCOME_TICK.ts']));

  const base = postgresBaseUrl();
  const shouldRunDatabase = env.CI === 'true' || env.MCFT_CAP_05_S8_RUN_DB_ACCEPTANCE === '1';
  if (!base || !shouldRunDatabase) return;
  const databaseName = 'mcft_cap05_s8_forecast_residual_acceptance';
  recreateDatabase(base, databaseName);
  requireSuccess(run(pnpmCommand, [
    '-w', 'exec', 'tsx', 'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_05_FORECAST_RESIDUAL_OUTCOME_TICK_DB.ts',
  ], {
    DATABASE_URL: databaseUrl(base, databaseName),
    MCFT_CAP_05_S8_DESTRUCTIVE_ACCEPTANCE: '1',
  }));
}

// MCFT_CAP_05_S8_STRICT_FORECAST_AVAILABILITY_GATE_V1: reject Forecasts created at or after observation availability and keep the generic orchestrator lifecycle-aware.
function runCap05S8StrictForecastAvailabilityAcceptance() {
  runGate(
    path.join(process.cwd(), 'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_05_S8_STRICT_FORECAST_AVAILABILITY.cjs'),
    '--auto',
  );
}

// MCFT_CAP_05_S9_RESTART_LATE_RECEIPT_REBUILD_GATE_V1: execute S9 governance, PostgreSQL recovery and inherited fencing/CAS regressions.
function runCap05S9RestartRecoveryAcceptance({ runHistoricalGovernance }) {
  if (runHistoricalGovernance) {
    runGate(
      path.join(process.cwd(), 'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_05_S9_RESTART_LATE_RECEIPT_REBUILD.cjs'),
      '--auto',
    );
  }

  const base = postgresBaseUrl();
  const shouldRunDatabase = env.CI === 'true' || env.MCFT_CAP_05_S9_RUN_DB_ACCEPTANCE === '1';
  if (!base || !shouldRunDatabase) return;
  const pnpmCommand = isWindows ? 'pnpm.cmd' : 'pnpm';

  const s9DatabaseName = 'mcft_cap05_s9_restart_recovery_acceptance';
  recreateDatabase(base, s9DatabaseName);
  requireSuccess(run(pnpmCommand, [
    '-w', 'exec', 'tsx', 'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_05_S9_RESTART_LATE_RECEIPT_REBUILD_DB.ts',
  ], {
    DATABASE_URL: databaseUrl(base, s9DatabaseName),
    MCFT_CAP_05_S9_DESTRUCTIVE_ACCEPTANCE: '1',
  }));

  const inheritedDatabaseName = 'mcft_cap03_s3b_cap05_s9_inherited_recovery_acceptance';
  recreateDatabase(base, inheritedDatabaseName);
  requireSuccess(run(pnpmCommand, [
    '-w', 'exec', 'tsx', 'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_03_ASSIMILATED_PERSISTENCE_RECOVERY_DB.ts',
  ], {
    DATABASE_URL: databaseUrl(base, inheritedDatabaseName),
    MCFT_CAP_03_S3B_DESTRUCTIVE_ACCEPTANCE: '1',
  }));
}

runMergedMainSettlementProbe();

runRuntimeDoctor();

const activationGatePath = path.join(process.cwd(), 'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_05_S6_ACTIVATION.cjs');
const s7SettlementGatePath = path.join(process.cwd(), 'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_05_S7_SETTLEMENT.cjs');
const s8SettlementGatePath = path.join(process.cwd(), 'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_05_S8_SETTLEMENT.cjs');
const s9SettlementGatePath = path.join(process.cwd(), 'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_05_S9_SETTLEMENT.cjs');
const s8RuntimeStatusPath = path.join(process.cwd(), 'docs/digital_twin/mcft/cap_05/GEOX-MCFT-CAP-05-S8-STATUS.json');
const strictForecastAvailabilityStatusPath = path.join(process.cwd(), 'docs/digital_twin/mcft/cap_05/GEOX-MCFT-CAP-05-S8-STRICT-FORECAST-AVAILABILITY-STATUS.json');
const s9StatusPath = path.join(process.cwd(), 'docs/digital_twin/mcft/cap_05/GEOX-MCFT-CAP-05-S9-STATUS.json');
const s9SettlementStatusPath = path.join(process.cwd(), 'docs/digital_twin/mcft/cap_05/GEOX-MCFT-CAP-05-S9-SETTLEMENT-STATUS.json');
const settlementActive = fs.existsSync(s7SettlementGatePath);
const s8SettlementActive = fs.existsSync(s8SettlementGatePath);
const s8RuntimeActive = fs.existsSync(s8RuntimeStatusPath);
const strictForecastAvailabilityActive = fs.existsSync(strictForecastAvailabilityStatusPath);
const s9Active = fs.existsSync(s9StatusPath);
const s9SettlementActive = fs.existsSync(s9SettlementStatusPath);

// MCFT_CAP_05_S6_ACTIVATION_GATE_V1: run only while S6→S7 activation is the current lifecycle frontier.
if (!settlementActive) {
  runGate(activationGatePath, '--auto');
}

// MCFT_CAP_05_S6_VALIDATION_ORTHOGONALITY_REMEDIATION_GATE_V1: preserve the corrected validation/eligibility contract and permanent PostgreSQL S6 regression.
runS6RemediationAcceptance();

// MCFT_CAP_05_S7_RECEIPT_CONSUMING_TICK_GATE_V1: always rerun S7 Runtime behavior; the historical static gate is superseded once S7 settlement exists.
runS7RuntimeAcceptance({ runHistoricalGovernance: !settlementActive });

// MCFT_CAP_05_S7_SSOT_SETTLEMENT_GATE_V1: preserve the historical S7 settlement only while it remains the lifecycle frontier.
if (!s8SettlementActive) {
  runGate(s7SettlementGatePath, '--auto');
}

// MCFT_CAP_05_S8_RESIDUAL_CONTRACT_REMEDIATION_GATE_V1: preserve the corrected contract behavior permanently, but do not reassert its historical eight-file candidate boundary after S8 Runtime materializes.
runCap05S8ResidualContractRemediationAcceptance({ runHistoricalGovernance: !s8RuntimeActive });

// MCFT_CAP_05_S8_FORECAST_RESIDUAL_C_COMMIT_GATE_V1: preserve Runtime and PostgreSQL behavior permanently, but do not reassert its historical ten-file candidate boundary after strict-availability hardening materializes.
runCap05S8ForecastResidualRuntimeAcceptance({ runHistoricalGovernance: !strictForecastAvailabilityActive });

// MCFT_CAP_05_S8_STRICT_FORECAST_AVAILABILITY_GATE_V1: preserve its static candidate boundary only while it remains the lifecycle frontier; its Runtime equality rejection remains covered by the permanent S8 behavior regression.
if (!s8SettlementActive) {
  runCap05S8StrictForecastAvailabilityAcceptance();
}

// MCFT_CAP_05_S8_SSOT_SETTLEMENT_GATE_V1: preserve the historical S8 settlement only until S9 materializes.
if (!s9Active) {
  runGate(s8SettlementGatePath, '--auto');
}

// MCFT_CAP_05_S9_RESTART_LATE_RECEIPT_REBUILD_GATE_V1: preserve S9 Runtime and PostgreSQL recovery behavior permanently, but do not reassert its historical six-file candidate boundary after settlement materializes.
runCap05S9RestartRecoveryAcceptance({ runHistoricalGovernance: !s9SettlementActive });

// MCFT_CAP_05_S9_SSOT_SETTLEMENT_GATE_V1: the probe preflight runs this Gate against the exact settlement merge commit in a detached worktree.
// Do not re-run the exact eight-file settlement boundary against the one-file probe checkout.
