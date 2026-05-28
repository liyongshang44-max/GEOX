#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..', '..');
const COMPOSE_FILE = process.env.COMPOSE_FILE || 'docker-compose.commercial_v1.yml';
const ENV_FILE = process.env.ENV_FILE || '.env.ci';
const CONFIRM = process.env.GEOX_RUNTIME_WORKERS_NEGATIVE_CONFIRM === '1';
const WAIT_MS = Math.max(1000, Number.parseInt(process.env.RUNTIME_WORKERS_NEGATIVE_WAIT_MS || '130000', 10) || 130000);
const RECOVERY_TIMEOUT_MS = Math.max(10000, Number.parseInt(process.env.RUNTIME_WORKERS_NEGATIVE_RECOVERY_TIMEOUT_MS || '90000', 10) || 90000);

function fail(message) {
  console.error(`[runtime-workers-negative] FAIL: ${message}`);
  process.exit(1);
}
function assert(condition, message) { if (!condition) fail(message); }
function sleep(ms) { Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms); }
function run(command, args, opts = {}) {
  const bin = process.platform === 'win32' && command === 'pnpm' ? 'pnpm.cmd' : command;
  return spawnSync(bin, args, { cwd: ROOT, encoding: 'utf8', shell: false, ...opts });
}
function loadDotEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const out = {};
  for (const rawLine of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const idx = line.indexOf('=');
    if (idx <= 0) continue;
    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim().replace(/^[ '\"]|[ '\"]$/g, '');
    out[key] = value;
  }
  return out;
}
function buildGateEnv() {
  const dotEnv = loadDotEnvFile(path.join(ROOT, '.env'));
  const dotEnvCi = loadDotEnvFile(path.join(ROOT, ENV_FILE));
  const env = { ...process.env, ...dotEnv, ...dotEnvCi };
  if (!env.DATABASE_URL) {
    const user = env.POSTGRES_USER || 'landos';
    const pass = env.POSTGRES_PASSWORD || '';
    const db = env.POSTGRES_DB || 'landos';
    env.DATABASE_URL = `postgres://${encodeURIComponent(user)}:${encodeURIComponent(pass)}@127.0.0.1:5433/${encodeURIComponent(db)}`;
  }
  env.RUNTIME_WORKER_HEARTBEAT_MAX_AGE_MS = env.RUNTIME_WORKER_HEARTBEAT_MAX_AGE_MS || '120000';
  return env;
}
function composeArgs(...args) {
  const out = [];
  if (fs.existsSync(path.join(ROOT, ENV_FILE))) out.push('--env-file', ENV_FILE);
  out.push('-f', COMPOSE_FILE, ...args);
  return out;
}
function dockerCompose(...args) {
  return run('docker', ['compose', ...composeArgs(...args)]);
}
function output(result) { return `${result.stdout || ''}\n${result.stderr || ''}`.trim(); }
function runWorkerGate() {
  return run('pnpm', ['run', 'ci:runtime:workers'], { env: buildGateEnv(), maxBuffer: 64 * 1024 * 1024 });
}
function requireGatePass(label) {
  const result = runWorkerGate();
  if (result.status !== 0) fail(`${label} expected ci:runtime:workers PASS, got exit=${result.status}\n${output(result)}`);
  console.log(`[runtime-workers-negative] PASS_CHECK ${label}`);
}
function requireGateFailureContains(label, expected) {
  const result = runWorkerGate();
  const text = output(result);
  if (result.status === 0) fail(`${label} expected ci:runtime:workers failure containing ${expected}, got PASS`);
  if (!text.includes(expected)) fail(`${label} expected failure containing ${expected}, got exit=${result.status}\n${text}`);
  console.log(`[runtime-workers-negative] EXPECTED_FAIL ${label} matched=${expected}`);
}
function serviceState(service) {
  const result = dockerCompose('ps', service, '--format', '{{.Name}} {{.State}}');
  return output(result);
}
function stopService(service) {
  const result = dockerCompose('stop', service);
  if (result.status !== 0) fail(`docker compose stop ${service} failed\n${output(result)}`);
  console.log(`[runtime-workers-negative] stopped service=${service} state=${serviceState(service)}`);
}
function startService(service) {
  const result = dockerCompose('up', '-d', service);
  if (result.status !== 0) fail(`docker compose up -d ${service} failed\n${output(result)}`);
  console.log(`[runtime-workers-negative] started service=${service} state=${serviceState(service)}`);
}
function waitForHealthy(label) {
  const started = Date.now();
  let last = '';
  while (Date.now() - started < RECOVERY_TIMEOUT_MS) {
    const result = runWorkerGate();
    last = output(result);
    if (result.status === 0) {
      console.log(`[runtime-workers-negative] RECOVERED ${label}`);
      return;
    }
    sleep(5000);
  }
  fail(`${label} did not recover within ${RECOVERY_TIMEOUT_MS}ms\n${last}`);
}
function assertDockerAvailable() {
  const result = run('docker', ['compose', 'version']);
  assert(result.status === 0, `docker compose must be available\n${output(result)}`);
}
function assertEnvFile() {
  assert(fs.existsSync(path.join(ROOT, ENV_FILE)), `env file required for destructive negative test: ${ENV_FILE}`);
}
function assertConfirm() {
  if (CONFIRM) return;
  fail('GEOX_RUNTIME_WORKERS_NEGATIVE_CONFIRM=1 is required because this destructive gate stops jobs/executor containers');
}

(async function main() {
  assertConfirm();
  assertDockerAvailable();
  assertEnvFile();
  console.log(`[runtime-workers-negative] starting destructive worker heartbeat negative acceptance compose=${COMPOSE_FILE} env=${ENV_FILE} wait_ms=${WAIT_MS}`);

  requireGatePass('initial fresh worker heartbeats');

  try {
    stopService('jobs');
    sleep(WAIT_MS);
    requireGateFailureContains('jobs stopped -> stale heartbeat', 'RUNTIME_WORKER_HEARTBEAT_STALE worker_type=jobs');
  } finally {
    startService('jobs');
    waitForHealthy('jobs restart fresh heartbeat');
  }

  try {
    stopService('executor');
    sleep(WAIT_MS);
    requireGateFailureContains('executor stopped -> stale heartbeat', 'RUNTIME_WORKER_HEARTBEAT_STALE worker_type=executor');
  } finally {
    startService('executor');
    waitForHealthy('executor restart fresh heartbeat');
  }

  requireGatePass('final fresh worker heartbeats despite existing runtime logs');
  console.log('[runtime-workers-negative] PASS');
})().catch((error) => {
  fail(error?.stack || error?.message || String(error));
});
