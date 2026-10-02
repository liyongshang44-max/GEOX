#!/usr/bin/env node
'use strict';

const path = require('node:path');
const { execFileSync, spawnSync } = require('node:child_process');

const INNER_REF = 'scripts/qualification/PROVISION_MCFT_CAP09_AM19_RUN_SCOPED_DATABASES_INNER_V1.cjs';
const INNER_BLOB_SHA = '80be618af01672a5d913f4334eca665447c91abf';
const INIT_COMPLETE_MARKER = 'PostgreSQL init process complete; ready for start up.';
const READINESS_POLICY = 'OFFICIAL_POSTGRES_INIT_COMPLETE_MARKER_THEN_SQL_PROBE_V1';

function sleep(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function git(...args) {
  return execFileSync('git', args, { encoding: 'utf8', windowsHide: true }).trim();
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

  if (mode !== 'selftest') {
    const container = required('GEOX_AM19_QMIG_LOCAL_POSTGRES_CONTAINER');
    waitForStablePostgres(container);
  }

  const result = spawnSync(process.execPath, [inner, ...args], {
    cwd: process.cwd(),
    env: process.env,
    stdio: 'inherit',
    windowsHide: true,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exitCode = result.status || 1;
}

main();
