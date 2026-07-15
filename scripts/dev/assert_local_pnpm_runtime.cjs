#!/usr/bin/env node
'use strict';

// scripts/dev/assert_local_pnpm_runtime.cjs
// Purpose: validate the local pnpm runtime, then execute the effective MCFT-CAP-05 governance and Runtime acceptance chain.
// Boundary: validation orchestration only; no production authority, public route, scheduler or canonical write path.

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const isWindows = process.platform === 'win32';
const env = process.env;
const diagnosticPath = path.join(process.cwd(), 'acceptance-output', 'MCFT_CAP_05_S10_ACCEPTANCE.log');

function run(command, args = [], envOverrides = {}) {
  const result = spawnSync(command, args, {
    cwd: process.cwd(),
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

// MCFT_CAP_05_S10_BOUNDED_EIGHT_TICK_FEEDBACK_CHAIN_GATE_V1: preserve bounded-chain Runtime behavior permanently; retire the historical static implementation Gate after S10 settlement materializes.
function runCap05S10BoundedFeedbackChainAcceptance({ runHistoricalGovernance }) {
  if (runHistoricalGovernance) {
    runGate(
      path.join(process.cwd(), 'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_05_S10_BOUNDED_EIGHT_TICK_FEEDBACK_CHAIN.cjs'),
      '--auto',
    );
  }
  requireSuccess(run(isWindows ? 'pnpm.cmd' : 'pnpm', [
    '-w', 'exec', 'tsx', 'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_05_BOUNDED_EIGHT_TICK_FEEDBACK_CHAIN.ts',
  ]));
}

runRuntimeDoctor();

const activationGatePath = path.join(process.cwd(), 'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_05_S6_ACTIVATION.cjs');
const s7SettlementGatePath = path.join(process.cwd(), 'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_05_S7_SETTLEMENT.cjs');
const s8SettlementGatePath = path.join(process.cwd(), 'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_05_S8_SETTLEMENT.cjs');
const s9SettlementGatePath = path.join(process.cwd(), 'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_05_S9_SETTLEMENT.cjs');
const s10SettlementGatePath = path.join(process.cwd(), 'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_05_S10_SETTLEMENT.cjs');
const s8RuntimeStatusPath = path.join(process.cwd(), 'docs/digital_twin/mcft/cap_05/GEOX-MCFT-CAP-05-S8-STATUS.json');
const strictForecastAvailabilityStatusPath = path.join(process.cwd(), 'docs/digital_twin/mcft/cap_05/GEOX-MCFT-CAP-05-S8-STRICT-FORECAST-AVAILABILITY-STATUS.json');
const s9StatusPath = path.join(process.cwd(), 'docs/digital_twin/mcft/cap_05/GEOX-MCFT-CAP-05-S9-STATUS.json');
const s9SettlementStatusPath = path.join(process.cwd(), 'docs/digital_twin/mcft/cap_05/GEOX-MCFT-CAP-05-S9-SETTLEMENT-STATUS.json');
const s10StatusPath = path.join(process.cwd(), 'docs/digital_twin/mcft/cap_05/GEOX-MCFT-CAP-05-S10-STATUS.json');
const s10SettlementStatusPath = path.join(process.cwd(), 'docs/digital_twin/mcft/cap_05/GEOX-MCFT-CAP-05-S10-SETTLEMENT-STATUS.json');
const cap05ClosureRecordPath = path.join(process.cwd(), 'docs/digital_twin/mcft/cap_05/GEOX-MCFT-CAP-05-CLOSURE-RECORD.json');
const settlementActive = fs.existsSync(s7SettlementGatePath);
const s8SettlementActive = fs.existsSync(s8SettlementGatePath);
const s8RuntimeActive = fs.existsSync(s8RuntimeStatusPath);
const strictForecastAvailabilityActive = fs.existsSync(strictForecastAvailabilityStatusPath);
const s9Active = fs.existsSync(s9StatusPath);
const s9SettlementActive = fs.existsSync(s9SettlementStatusPath);
const s10Active = fs.existsSync(s10StatusPath);
const s10SettlementActive = fs.existsSync(s10SettlementStatusPath);
const cap05ClosureActive = fs.existsSync(cap05ClosureRecordPath);

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

// MCFT_CAP_05_S9_SSOT_SETTLEMENT_GATE_V1: preserve the S9 settlement only until S10 materializes.
if (!s10Active) {
  runGate(s9SettlementGatePath, '--auto');
}

// MCFT_CAP_05_S10_BOUNDED_EIGHT_TICK_FEEDBACK_CHAIN_GATE_V1: verify the authorized bounded-chain implementation and permanent orchestration behavior.
runCap05S10BoundedFeedbackChainAcceptance({ runHistoricalGovernance: !s10SettlementActive });

// MCFT_CAP_05_S10_SSOT_SETTLEMENT_GATE_V1: settle S10 effectiveness and authorize governance-only S11 closure work until a canonical closure record materializes.
if (s10SettlementActive && !cap05ClosureActive) {
  runGate(s10SettlementGatePath, '--auto');
}


// MCFT_CAP_05_S11_CLOSURE_FINALIZATION_GATE_V1: preserve the historical S11A candidate Gate only before final effectiveness materializes.
const cap05S11ClosureGatePath = path.join(process.cwd(), 'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_05_S11_CLOSURE_FINALIZATION.cjs');
const cap05FinalizationEffectivenessPath = path.join(process.cwd(), 'docs/digital_twin/mcft/cap_05/GEOX-MCFT-CAP-05-FINALIZATION-EFFECTIVENESS.json');
const cap05FinalizationEffectivenessGatePath = path.join(process.cwd(), 'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_05_FINALIZATION_EFFECTIVENESS.cjs');
if (!fs.existsSync(cap05FinalizationEffectivenessPath) && fs.existsSync(cap05S11ClosureGatePath)) {
  runGate(cap05S11ClosureGatePath, '--auto');
}
if (fs.existsSync(cap05FinalizationEffectivenessPath) && fs.existsSync(cap05FinalizationEffectivenessGatePath)) {
  runGate(cap05FinalizationEffectivenessGatePath, '--auto');
}
