#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { Pool } = require('pg');

const root = process.cwd();
const REQUIRED_WORKERS = [
  { worker_type: 'jobs', worker_id: 'geox-v1-jobs', container: 'geox-v1-jobs' },
  { worker_type: 'executor', worker_id: 'geox-v1-executor', container: 'geox-v1-executor' },
];

function fail(message) {
  console.error(`[runtime-workers-packaging] FAIL: ${message}`);
  process.exit(1);
}
function assert(condition, message) { if (!condition) fail(message); }
function read(rel) { return fs.readFileSync(path.join(root, rel), 'utf8'); }
function run(command, args, opts = {}) {
  const bin = process.platform === 'win32' && command === 'pnpm' ? 'pnpm.cmd' : command;
  return spawnSync(bin, args, { cwd: root, encoding: 'utf8', shell: false, ...opts });
}
function sleep(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function hasDistSafeImportOrRequire(source, modulePath) {
  return source.includes(`from "${modulePath}"`) ||
    source.includes(`from '${modulePath}'`) ||
    source.includes(`require("${modulePath}")`) ||
    source.includes(`require('${modulePath}')`);
}

function hasTsImportOrRequire(source, modulePathWithoutExtension) {
  return source.includes(`from "${modulePathWithoutExtension}.ts"`) ||
    source.includes(`from '${modulePathWithoutExtension}.ts'`) ||
    source.includes(`require("${modulePathWithoutExtension}.ts")`) ||
    source.includes(`require('${modulePathWithoutExtension}.ts')`);
}

function checkStaticPackaging() {
  const executorPkg = JSON.parse(read('apps/executor/package.json'));
  const build = String(executorPkg?.scripts?.build ?? '');
  assert(build && !build.includes('process.exit(0)'), 'apps/executor/package.json build must not be a no-op');
  assert(build.includes('tsc -p tsconfig.json'), 'executor build must use tsc -p tsconfig.json');
  assert(String(executorPkg.type ?? '') === 'commonjs', 'executor package type must be commonjs for dist/*.js runtime artifacts');
  assert(String(executorPkg?.scripts?.runtime ?? '') === 'node dist/runtime_loop.js', 'executor runtime script must use dist/runtime_loop.js');

  const compose = read('docker-compose.commercial_v1.yml');
  const jobsSection = compose.slice(compose.indexOf('  jobs:'), compose.indexOf('  executor:'));
  const executorSection = compose.slice(compose.indexOf('  executor:'), compose.indexOf('  web:'));
  assert(jobsSection.includes('GEOX_WORKER_ID: geox-v1-jobs'), 'commercial_v1 jobs must set stable GEOX_WORKER_ID');
  assert(jobsSection.includes('GEOX_WORKER_TYPE: jobs'), 'commercial_v1 jobs must set GEOX_WORKER_TYPE=jobs');
  assert(executorSection.includes('GEOX_WORKER_ID: geox-v1-executor'), 'commercial_v1 executor must set stable GEOX_WORKER_ID');
  assert(executorSection.includes('GEOX_WORKER_TYPE: executor'), 'commercial_v1 executor must set GEOX_WORKER_TYPE=executor');
  assert(executorSection.includes('command: ["node", "apps/executor/dist/runtime_loop.js"]'), 'commercial_v1 executor command must use node apps/executor/dist/runtime_loop.js');
  assert(!executorSection.includes('"pnpm"'), 'commercial_v1 executor command must not contain pnpm');
  assert(!executorSection.includes('"tsx"'), 'commercial_v1 executor command must not contain tsx');
  assert(!executorSection.includes('src/runtime_loop.ts'), 'commercial_v1 executor command must not run TypeScript source');
  assert(executorSection.includes('pnpm --filter @geox/executor build'), 'commercial_v1 executor build arg must build @geox/executor');

  const migration = read('apps/server/db/migrations/2026_05_28_worker_runtime_heartbeat_v1.sql');
  assert(migration.includes('CREATE TABLE IF NOT EXISTS worker_runtime_heartbeat_v1'), 'migration must create worker_runtime_heartbeat_v1');
  assert(migration.includes('PRIMARY KEY (worker_type, worker_id)'), 'worker heartbeat table must use worker_type+worker_id primary key');
  assert(migration.includes('last_heartbeat_at'), 'worker heartbeat migration must include last_heartbeat_at');

  const jobsRuntime = read('apps/server/src/jobs/runtime.ts');
  assert(jobsRuntime.includes('recordWorkerRuntimeStartedV1'), 'jobs runtime must record STARTED heartbeat');
  assert(jobsRuntime.includes('recordWorkerRuntimeHeartbeatV1'), 'jobs runtime must record periodic heartbeat');
  assert(jobsRuntime.includes('WORKER_HEARTBEAT_WRITE_FAILED worker_type=jobs'), 'jobs runtime must diagnose heartbeat write failures');

  const runtimeLoop = read('apps/executor/src/runtime_loop.ts');
  assert(hasDistSafeImportOrRequire(runtimeLoop, './run_dispatch_once.js'), 'runtime_loop.ts must use dist-safe run_dispatch_once.js import/require');
  assert(hasDistSafeImportOrRequire(runtimeLoop, './lib/worker_runtime_heartbeat.js'), 'runtime_loop.ts must use dist-safe worker heartbeat helper');
  assert(!hasTsImportOrRequire(runtimeLoop, './run_dispatch_once'), 'runtime_loop.ts must not import/require run_dispatch_once.ts');
  assert(runtimeLoop.includes('recordWorkerRuntimeStarted'), 'executor runtime must record STARTED heartbeat');
  assert(runtimeLoop.includes('recordWorkerRuntimeHeartbeat'), 'executor runtime must record periodic heartbeat');
  assert(runtimeLoop.includes('WORKER_HEARTBEAT_WRITE_FAILED worker_type=executor'), 'executor runtime must diagnose heartbeat write failures');

  const dispatchOnce = read('apps/executor/src/run_dispatch_once.ts');
  assert(hasDistSafeImportOrRequire(dispatchOnce, './adapters/index.js'), 'run_dispatch_once.ts must use dist-safe adapters/index.js import/require');
  assert(hasDistSafeImportOrRequire(dispatchOnce, './lib/claim.js'), 'run_dispatch_once.ts must use dist-safe lib/claim.js import/require');
  assert(!hasTsImportOrRequire(dispatchOnce, './adapters/index'), 'run_dispatch_once.ts must not import/require adapters/index.ts');
  assert(!hasTsImportOrRequire(dispatchOnce, './lib/claim'), 'run_dispatch_once.ts must not import/require lib/claim.ts');

  const self = read('scripts/governance_acceptance/ACCEPTANCE_RUNTIME_WORKERS_PRODUCTION_PACKAGING_V1.cjs');
  const forbiddenLogPassFunction = 'function ' + 'logsContain';
  const forbiddenLogPassAssert = 'assert(' + 'logsContain';
  assert(!self.includes(forbiddenLogPassFunction), 'runtime worker liveness gate must not define Docker-log keyword liveness helper');
  assert(!self.includes(forbiddenLogPassAssert), 'runtime worker liveness gate must not assert pass through Docker-log keyword matching');
  assert(self.includes('worker_runtime_heartbeat_v1'), 'runtime worker liveness gate must query worker_runtime_heartbeat_v1');
}

function checkBuildArtifacts() {
  const result = run('pnpm', ['--filter', '@geox/executor', 'build'], { stdio: 'inherit' });
  assert(result.status === 0, '@geox/executor build must pass');
  assert(fs.existsSync(path.join(root, 'apps/executor/dist/runtime_loop.js')), 'apps/executor/dist/runtime_loop.js must exist after build');
  assert(fs.existsSync(path.join(root, 'apps/executor/dist/run_dispatch_once.js')), 'apps/executor/dist/run_dispatch_once.js must exist after build');
}

function dockerAvailable() {
  const result = run('docker', ['ps', '--format', '{{.Names}}']);
  return result.status === 0 ? result.stdout.split(/\r?\n/).map((x) => x.trim()).filter(Boolean) : [];
}

function inspectContainer(name) {
  const result = run('docker', ['inspect', name, '--format', '{{.State.Status}} {{.State.Restarting}} {{.State.ExitCode}}']);
  if (result.status !== 0) return null;
  const text = result.stdout.trim();
  const [status, restarting, exitCode] = text.split(/\s+/);
  return { status, restarting: restarting === 'true', exit_code: Number(exitCode ?? 0) };
}

function containerLogs(name, tail = '80', since = '5m') {
  const result = run('docker', ['logs', name, '--since', since, '--tail', tail]);
  return `${result.stdout ?? ''}\n${result.stderr ?? ''}`.trim();
}

function assertLogsNotContain(name, patterns, tail = '240', since = '5m') {
  const text = containerLogs(name, tail, since);
  const hit = patterns.find((pattern) => text.includes(pattern));
  assert(!hit, `${name} logs must not contain ${hit}. recent logs:\n${text}`);
}

function countMatches(text, regex) {
  const matched = text.match(regex);
  return matched ? matched.length : 0;
}

function diagnoseWorkerLogs(names) {
  for (const name of names) {
    console.error(`[runtime-workers-packaging] DIAG ${name} logs:\n${containerLogs(name, '220', '10m')}`);
  }
}

function checkLiveContainersIfPresent() {
  const names = dockerAvailable();
  const required = ['geox-v1-server', 'geox-v1-jobs'];
  const executorName = names.includes('geox-executor-1') ? 'geox-executor-1' : (names.includes('geox-v1-executor') ? 'geox-v1-executor' : null);
  if (!required.every((name) => names.includes(name)) || !executorName) {
    console.log('[runtime-workers-packaging] SKIP docker container state checks: commercial_v1 server/jobs/executor containers not all present');
    return { executorName: null };
  }

  for (const name of [...required, executorName]) {
    const state = inspectContainer(name);
    assert(state, `container ${name} must be inspectable`);
    if (state.restarting) {
      fail(`container ${name} must not be Restarting. status=${state.status} exit_code=${state.exit_code}. recent logs:\n${containerLogs(name, '80')}`);
    }
    if (!['running', 'healthy'].includes(state.status)) {
      fail(`container ${name} must be running, got ${state.status}. exit_code=${state.exit_code}. recent logs:\n${containerLogs(name, '80')}`);
    }
  }

  const warmupMs = Number(process.env.RUNTIME_WORKERS_WARMUP_MS || 15000);
  const stableLogWindow = String(process.env.RUNTIME_WORKERS_STABLE_LOG_WINDOW || '10s');
  sleep(warmupMs);

  assertLogsNotContain('geox-v1-server', ['ERR_HTTP_HEADERS_SENT', 'Reply was already sent'], '240', stableLogWindow);
  assertLogsNotContain('geox-v1-server', ['OPERATION_PLAN_TERMINAL"'], '300', stableLogWindow);

  const serverRecent = containerLogs('geox-v1-server', '400', stableLogWindow);
  assert(!(serverRecent.includes('OPERATION_PLAN_TERMINAL') && serverRecent.includes('statusCode":500')), 'server logs must not contain OPERATION_PLAN_TERMINAL with statusCode 500 in stable runtime logs');

  const executorRecent = containerLogs(executorName, '800', stableLogWindow);
  const runtimeLoopFailedCount = countMatches(executorRecent, /runtime loop iteration failed/g);
  assert(runtimeLoopFailedCount <= 1, `executor logs runtime loop iteration failed must not repeat over threshold(1) after warmup, got ${runtimeLoopFailedCount}. recent logs:\n${executorRecent}`);
  assert(!executorRecent.includes('OPERATION_PLAN_TASK_ID_MISMATCH'), 'executor logs must not contain OPERATION_PLAN_TASK_ID_MISMATCH after warmup');

  const receiptFailedCount = countMatches(executorRecent, /RECEIPT_WRITE_FAILED/g);
  assert(receiptFailedCount <= 3, `executor logs RECEIPT_WRITE_FAILED must not repeat over threshold(3) after warmup, got ${receiptFailedCount}. recent logs:\n${executorRecent}`);

  const leaseRecoverByTask = new Map();
  const leaseRecoverRegex = /LEASE_RECOVER[^\n]*task_id=([^\s]+)/g;
  let m;
  while ((m = leaseRecoverRegex.exec(executorRecent)) !== null) {
    const taskId = String(m[1] ?? '').trim();
    if (!taskId) continue;
    leaseRecoverByTask.set(taskId, (leaseRecoverByTask.get(taskId) ?? 0) + 1);
  }
  for (const [taskId, cnt] of leaseRecoverByTask.entries()) {
    assert(cnt <= 3, `executor logs LEASE_RECOVER task_id=${taskId} repeated over threshold(3) after warmup, got ${cnt}`);
  }
  return { executorName };
}

async function queryHeartbeat(pool, worker) {
  const res = await pool.query(
    `SELECT worker_type, worker_id, runtime_instance_id, status, started_at, last_heartbeat_at,
            heartbeat_count, last_tick_status, last_error, metadata_json, updated_at,
            EXTRACT(EPOCH FROM (now() - last_heartbeat_at)) * 1000 AS age_ms
       FROM worker_runtime_heartbeat_v1
      WHERE worker_type = $1 AND worker_id = $2
      LIMIT 1`,
    [worker.worker_type, worker.worker_id]
  );
  return res.rows?.[0] ?? null;
}

async function checkDbHeartbeats(diagnosticContainers) {
  const databaseUrl = String(process.env.DATABASE_URL || '').trim();
  if (!databaseUrl) fail('RUNTIME_WORKERS_DATABASE_URL_REQUIRED');
  const maxAgeMs = Math.max(1, Number.parseInt(String(process.env.RUNTIME_WORKER_HEARTBEAT_MAX_AGE_MS || '120000'), 10) || 120000);
  const pool = new Pool({ connectionString: databaseUrl });
  try {
    await pool.query(`SELECT 1 FROM worker_runtime_heartbeat_v1 LIMIT 1`);
    for (const worker of REQUIRED_WORKERS) {
      const row = await queryHeartbeat(pool, worker);
      if (!row) {
        diagnoseWorkerLogs(diagnosticContainers);
        fail(`RUNTIME_WORKER_HEARTBEAT_MISSING worker_type=${worker.worker_type} worker_id=${worker.worker_id}`);
      }
      const ageMs = Number(row.age_ms ?? Number.POSITIVE_INFINITY);
      if (!String(row.runtime_instance_id || '').trim()) {
        diagnoseWorkerLogs(diagnosticContainers);
        fail(`RUNTIME_WORKER_HEARTBEAT_RUNTIME_INSTANCE_MISSING worker_type=${worker.worker_type} worker_id=${worker.worker_id}`);
      }
      if (Number(row.heartbeat_count ?? 0) <= 0) {
        diagnoseWorkerLogs(diagnosticContainers);
        fail(`RUNTIME_WORKER_HEARTBEAT_COUNT_INVALID worker_type=${worker.worker_type} worker_id=${worker.worker_id} heartbeat_count=${row.heartbeat_count}`);
      }
      if (['ERROR', 'STOPPING'].includes(String(row.status))) {
        diagnoseWorkerLogs(diagnosticContainers);
        fail(`RUNTIME_WORKER_HEARTBEAT_ERROR worker_type=${worker.worker_type} worker_id=${worker.worker_id} status=${row.status} last_error=${row.last_error ?? ''}`);
      }
      if (!Number.isFinite(ageMs) || ageMs > maxAgeMs) {
        diagnoseWorkerLogs(diagnosticContainers);
        fail(`RUNTIME_WORKER_HEARTBEAT_STALE worker_type=${worker.worker_type} worker_id=${worker.worker_id} age_ms=${Math.round(ageMs)} max_age_ms=${maxAgeMs}`);
      }
      console.log(`[runtime-workers-packaging] heartbeat ok worker_type=${worker.worker_type} worker_id=${worker.worker_id} status=${row.status} age_ms=${Math.round(ageMs)} heartbeat_count=${row.heartbeat_count} last_tick_status=${row.last_tick_status}`);
    }
  } catch (error) {
    if (String(error?.message ?? error).includes('worker_runtime_heartbeat_v1')) {
      diagnoseWorkerLogs(diagnosticContainers);
      fail(`RUNTIME_WORKER_HEARTBEAT_TABLE_UNAVAILABLE message=${String(error?.message ?? error)}`);
    }
    throw error;
  } finally {
    await pool.end().catch(() => undefined);
  }
}

(async function main() {
  checkStaticPackaging();
  checkBuildArtifacts();
  const live = checkLiveContainersIfPresent();
  const diagnostics = ['geox-v1-server', 'geox-v1-jobs'];
  if (live.executorName) diagnostics.push(live.executorName);
  await checkDbHeartbeats(diagnostics);
  console.log('[runtime-workers-packaging] PASS');
})().catch((error) => {
  fail(error?.stack ?? error?.message ?? String(error));
});
