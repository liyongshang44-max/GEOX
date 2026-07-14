#!/usr/bin/env node
'use strict';

const { spawnSync } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');

const isWindows = process.platform === 'win32';
const env = process.env;
const acceptanceDiagnosticPath = path.join(process.cwd(), 'acceptance-output', 'MCFT_CAP_05_S7_ACCEPTANCE.log');

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

function splitPathEntries(value) {
  return String(value || '')
    .split(path.delimiter)
    .map((x) => x.trim())
    .filter(Boolean);
}

function normalize(value) {
  return String(value || '').replace(/\\/g, '/');
}

function containsWslOrPnpm11Marker(value) {
  const s = normalize(value).toLowerCase();
  return s.includes('/.cache/node/corepack/v1/pnpm/11.')
    || s.includes('/corepack/v1/pnpm/11.')
    || s.includes('/wsl')
    || s.includes('wsl$')
    || s.includes('\\wsl')
    || (s.includes('ubuntu') && s.includes('pnpm'));
}

function containsWindowsToLinuxPnpmMismatch(value) {
  const s = normalize(value).toLowerCase();
  return containsWslOrPnpm11Marker(s) || s.includes('/home/');
}

function hasWindowsPathShape(value) {
  const s = String(value || '');
  return /^[a-zA-Z]:[\\/]/.test(s) || s.startsWith('\\\\');
}

function collectCandidates() {
  const candidates = [];
  const pnpmCmd = isWindows ? 'pnpm.cmd' : 'pnpm';

  const version = run(pnpmCmd, ['--version']);
  candidates.push({ kind: 'pnpm_version', source: pnpmCmd, ...version });

  if (isWindows) {
    const wherePnpm = run('where.exe', ['pnpm']);
    candidates.push({ kind: 'where_pnpm', source: 'where.exe pnpm', ...wherePnpm });

    const psGetCommand = run('powershell.exe', [
      '-NoProfile',
      '-Command',
      'Get-Command pnpm -All | ForEach-Object { $_.Source }'
    ]);
    candidates.push({ kind: 'powershell_get_command_pnpm', source: 'Get-Command pnpm -All', ...psGetCommand });
  } else {
    const whichPnpm = run('which', ['pnpm']);
    candidates.push({ kind: 'which_pnpm', source: 'which pnpm', ...whichPnpm });
  }

  if (env.npm_execpath) {
    candidates.push({ kind: 'npm_execpath', source: 'process.env.npm_execpath', status: 0, stdout: env.npm_execpath, stderr: '' });
  }
  if (env.npm_config_user_agent) {
    candidates.push({ kind: 'npm_config_user_agent', source: 'process.env.npm_config_user_agent', status: 0, stdout: env.npm_config_user_agent, stderr: '' });
  }
  if (env.COREPACK_ROOT) {
    candidates.push({ kind: 'corepack_root', source: 'process.env.COREPACK_ROOT', status: 0, stdout: env.COREPACK_ROOT, stderr: '' });
  }
  if (env.PNPM_HOME) {
    candidates.push({ kind: 'pnpm_home', source: 'process.env.PNPM_HOME', status: 0, stdout: env.PNPM_HOME, stderr: '' });
  }

  const pathMatches = splitPathEntries(env.PATH)
    .filter((entry) => containsWslOrPnpm11Marker(entry) || (isWindows && containsWindowsToLinuxPnpmMismatch(entry)) || normalize(entry).toLowerCase().includes('corepack'));
  if (pathMatches.length > 0) {
    candidates.push({ kind: 'path_entries', source: 'PATH filtered entries', status: 0, stdout: pathMatches.join('\n'), stderr: '' });
  }

  return candidates;
}

function buildRuntimeReport(candidates) {
  return {
    ok: true,
    process_platform: process.platform,
    process_exec_path: process.execPath,
    node_version: process.version,
    cwd: process.cwd(),
    shell: env.ComSpec || env.SHELL || '',
    wsl_indicators: {
      WSL_DISTRO_NAME: env.WSL_DISTRO_NAME || '',
      WSL_INTEROP: env.WSL_INTEROP || '',
      WT_SESSION: env.WT_SESSION || '',
    },
    pnpm_version: candidates.find((x) => x.kind === 'pnpm_version')?.stdout || '',
    candidates,
  };
}

function fail(report, reasons) {
  const payload = {
    ok: false,
    error: 'LOCAL_PNPM_RUNTIME_MISMATCH',
    reasons,
    runtime: report,
    remediation: [
      'Use Windows PowerShell with Windows Node and Windows pnpm for local acceptance.',
      'Run: where.exe pnpm',
      'Run: Get-Command pnpm -All | Format-List Source,Version,CommandType',
      'Run: pnpm --version',
      'Run: node -p "process.execPath"',
      'If pnpm resolves to /home/.../.cache/node/corepack/v1/pnpm/11.x, remove the WSL/Corepack pnpm from the Windows PATH for this shell.',
      'Reopen PowerShell after fixing PATH, then rerun: pnpm run doctor:local-runtime',
    ],
  };
  console.error(JSON.stringify(payload, null, 2));
  process.exit(1);
}

function appendAcceptanceDiagnostic(result) {
  fs.mkdirSync(path.dirname(acceptanceDiagnosticPath), { recursive: true });
  fs.appendFileSync(
    acceptanceDiagnosticPath,
    `\n$ ${result.command}\nstatus=${String(result.status)}\n${result.stdout || ''}\n${result.stderr || ''}\n`,
    'utf8',
  );
}

function requireSuccess(result) {
  appendAcceptanceDiagnostic(result);
  if (result.stdout) console.log(result.stdout);
  if (result.status !== 0) {
    if (result.stderr) console.error(result.stderr);
    throw new Error(`COMMAND_FAILED:${result.command}:${result.status}:${result.error}`);
  }
}

function runPredecessorGateOnCurrentTree(gatePath) {
  requireSuccess(run('git', ['fetch', 'origin', 'main']));
  const originalMain = run('git', ['rev-parse', 'refs/remotes/origin/main']);
  requireSuccess(originalMain);
  requireSuccess(run('git', ['update-ref', 'refs/remotes/origin/main', 'HEAD']));
  try {
    requireSuccess(run(process.execPath, [gatePath, '--postmerge']));
  } finally {
    requireSuccess(run('git', ['update-ref', 'refs/remotes/origin/main', originalMain.stdout]));
  }
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

function runCap05S6ValidationOrthogonalityRemediationAcceptance() {
  const gatePath = path.join(process.cwd(), 'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_05_S6_VALIDATION_ORTHOGONALITY_REMEDIATION.cjs');
  if (!fs.existsSync(gatePath)) return;
  runPredecessorGateOnCurrentTree(gatePath);

  const shouldRunDatabase = env.CI === 'true' || env.MCFT_CAP_05_S6_VALIDATION_ORTHOGONALITY_RUN_DB_ACCEPTANCE === '1';
  const base = postgresBaseUrl();
  if (!shouldRunDatabase || !base) return;

  const pnpmCmd = isWindows ? 'pnpm.cmd' : 'pnpm';
  const admin = databaseUrl(base, 'postgres');
  const databaseName = 'mcft_cap05_s6_validation_orthogonality_acceptance';
  requireSuccess(run('psql', [admin, '-v', 'ON_ERROR_STOP=1', '-c', `DROP DATABASE IF EXISTS ${databaseName} WITH (FORCE)`]));
  requireSuccess(run('psql', [admin, '-v', 'ON_ERROR_STOP=1', '-c', `CREATE DATABASE ${databaseName}`]));
  requireSuccess(run(pnpmCmd, ['-w', 'exec', 'tsx', 'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_05_ACTION_FEEDBACK_H_DB.ts'], {
    DATABASE_URL: databaseUrl(base, databaseName),
    MCFT_CAP_05_S6_DESTRUCTIVE_ACCEPTANCE: '1',
  }));
}

function runCap05S7Acceptance() {
  const gatePath = path.join(process.cwd(), 'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_05_S7_RECEIPT_CONSUMING_TICK.cjs');
  if (!fs.existsSync(gatePath)) return;
  runPredecessorGateOnCurrentTree(gatePath);
  const pnpmCmd = isWindows ? 'pnpm.cmd' : 'pnpm';
  requireSuccess(run(pnpmCmd, ['-w', 'exec', 'tsx', 'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_05_RECEIPT_CONSUMING_TICK.ts']));
  requireSuccess(run(pnpmCmd, ['-w', 'exec', 'tsx', 'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_05_NOT_YET_VALIDATED_RECEIPT_CONSUMING_TICK.ts']));
  requireSuccess(run(pnpmCmd, ['-w', 'exec', 'tsx', 'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_04_SINGLE_TICK_INTEGRATION.ts']));

  const shouldRunDatabase = env.CI === 'true' || env.MCFT_CAP_05_S7_RUN_DB_ACCEPTANCE === '1';
  const base = postgresBaseUrl();
  if (!shouldRunDatabase || !base) return;
  const admin = databaseUrl(base, 'postgres');
  const databaseName = 'mcft_cap05_s7_acceptance';
  requireSuccess(run('psql', [admin, '-v', 'ON_ERROR_STOP=1', '-c', `DROP DATABASE IF EXISTS ${databaseName} WITH (FORCE)`]));
  requireSuccess(run('psql', [admin, '-v', 'ON_ERROR_STOP=1', '-c', `CREATE DATABASE ${databaseName}`]));
  requireSuccess(run(pnpmCmd, ['-w', 'exec', 'tsx', 'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_05_RECEIPT_CONSUMING_TICK_DB.ts'], {
    DATABASE_URL: databaseUrl(base, databaseName),
    MCFT_CAP_05_S7_DESTRUCTIVE_ACCEPTANCE: '1',
  }));
}

function main() {
  const candidates = collectCandidates();
  const report = buildRuntimeReport(candidates);
  const reasons = [];

  const version = candidates.find((x) => x.kind === 'pnpm_version');
  if (!version || version.status !== 0) {
    reasons.push({ code: 'PNPM_VERSION_UNAVAILABLE', detail: version || null });
  }

  const allText = candidates
    .map((x) => [x.source, x.stdout, x.stderr].filter(Boolean).join('\n'))
    .join('\n');

  if (containsWslOrPnpm11Marker(allText) || (isWindows && containsWindowsToLinuxPnpmMismatch(allText))) {
    reasons.push({
      code: 'WSL_OR_COREPACK_PNPM_11_DETECTED',
      detail: 'Detected WSL/Linux or Corepack pnpm 11.x marker in pnpm runtime discovery output.',
    });
  }

  if (isWindows && !hasWindowsPathShape(process.execPath)) {
    reasons.push({
      code: 'WINDOWS_PLATFORM_WITH_NON_WINDOWS_NODE_PATH',
      detail: process.execPath,
    });
  }

  if (isWindows) {
    const where = candidates.find((x) => x.kind === 'where_pnpm');
    const whereLines = String(where?.stdout || '').split(/\r?\n/).map((x) => x.trim()).filter(Boolean);
    const nonWindowsPnpm = whereLines.filter((line) => !hasWindowsPathShape(line) || containsWindowsToLinuxPnpmMismatch(line));
    if (nonWindowsPnpm.length > 0) {
      reasons.push({
        code: 'WINDOWS_POWERSHELL_RESOLVES_NON_WINDOWS_PNPM',
        detail: nonWindowsPnpm,
      });
    }
  }

  if (reasons.length > 0) fail(report, reasons);

  console.log(JSON.stringify({
    ok: true,
    message: 'LOCAL_PNPM_RUNTIME_OK',
    process_platform: report.process_platform,
    process_exec_path: report.process_exec_path,
    pnpm_version: report.pnpm_version,
    candidates: report.candidates.map((x) => ({ kind: x.kind, source: x.source, status: x.status, stdout: x.stdout, stderr: x.stderr })),
  }, null, 2));
}

main();

// MCFT_CAP_05_S6_ACTIVATION_GATE_V1: enforce activated CAP-05 S6/S7 governance during standard acceptance.
const activationGatePath = path.join(process.cwd(), 'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_05_S6_ACTIVATION.cjs');
if (fs.existsSync(activationGatePath)) {
  requireSuccess(run(process.execPath, [activationGatePath, '--auto']));
}

// MCFT_CAP_05_S6_VALIDATION_ORTHOGONALITY_REMEDIATION_GATE_V1: preserve the effective validation/eligibility contract and isolated PostgreSQL S6 regression.
runCap05S6ValidationOrthogonalityRemediationAcceptance();

// MCFT_CAP_05_S7_RECEIPT_CONSUMING_TICK_GATE_V1: verify S7 Governance, both validation-status A1 paths, CAP-04 regression and isolated PostgreSQL H source.
runCap05S7Acceptance();


// MCFT_CAP_05_S7_SSOT_SETTLEMENT_GATE_V1: enforce S7 merged effectiveness and explicit S8 authorization during standard acceptance.
const s7SettlementGatePath = path.join(process.cwd(), 'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_05_S7_SETTLEMENT.cjs');
if (fs.existsSync(s7SettlementGatePath)) {
  requireSuccess(run(process.execPath, [s7SettlementGatePath, '--auto']));
}
