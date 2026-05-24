#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = process.cwd();

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
  const executorSection = compose.slice(compose.indexOf('  executor:'), compose.indexOf('  web:'));
  assert(executorSection.includes('command: ["node", "apps/executor/dist/runtime_loop.js"]'), 'commercial_v1 executor command must use node apps/executor/dist/runtime_loop.js');
  assert(!executorSection.includes('"pnpm"'), 'commercial_v1 executor command must not contain pnpm');
  assert(!executorSection.includes('"tsx"'), 'commercial_v1 executor command must not contain tsx');
  assert(!executorSection.includes('src/runtime_loop.ts'), 'commercial_v1 executor command must not run TypeScript source');
  assert(executorSection.includes('pnpm --filter @geox/executor build'), 'commercial_v1 executor build arg must build @geox/executor');

  const runtimeLoop = read('apps/executor/src/runtime_loop.ts');
  assert(hasDistSafeImportOrRequire(runtimeLoop, './run_dispatch_once.js'), 'runtime_loop.ts must use dist-safe run_dispatch_once.js import/require');
  assert(!hasTsImportOrRequire(runtimeLoop, './run_dispatch_once'), 'runtime_loop.ts must not import/require run_dispatch_once.ts');

  const dispatchOnce = read('apps/executor/src/run_dispatch_once.ts');
  assert(hasDistSafeImportOrRequire(dispatchOnce, './adapters/index.js'), 'run_dispatch_once.ts must use dist-safe adapters/index.js import/require');
  assert(hasDistSafeImportOrRequire(dispatchOnce, './lib/claim.js'), 'run_dispatch_once.ts must use dist-safe lib/claim.js import/require');
  assert(!hasTsImportOrRequire(dispatchOnce, './adapters/index'), 'run_dispatch_once.ts must not import/require adapters/index.ts');
  assert(!hasTsImportOrRequire(dispatchOnce, './lib/claim'), 'run_dispatch_once.ts must not import/require lib/claim.ts');
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
  const result = run('docker', ['inspect', name, '--format', '{{.State.Status}} {{.State.Restarting}} {{.State.ExitCode}} {{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}']);
  if (result.status !== 0) return null;
  const text = result.stdout.trim();
  const [status, restarting, exitCode, health] = text.split(/\s+/);
  return { status, restarting: restarting === 'true', exit_code: Number(exitCode ?? 0), health: health || 'none' };
}

function containerLogs(name, tail = '80', since = '5m') {
  const result = run('docker', ['logs', name, '--since', since, '--tail', tail]);
  return `${result.stdout ?? ''}\n${result.stderr ?? ''}`.trim();
}

function assertLogsNotContain(name, patterns, tail = '240', since = '5m') {
  const text = containerLogs(name, tail, since);
  const hit = patterns.find((pattern) => text.includes(pattern));
  assert(!hit, `${name} logs must not contain ${hit}. recent logs:
${text}`);
}

function logsContain(name, patterns, since = '5m') {
  const text = containerLogs(name, '160', since);
  return patterns.some((pattern) => text.includes(pattern));
}

function countMatches(text, regex) {
  const matched = text.match(regex);
  return matched ? matched.length : 0;
}

function assertContainerRunning(name) {
  const state = inspectContainer(name);
  assert(state, `container ${name} must be inspectable`);
  if (state.restarting) {
    fail(`container ${name} must not be Restarting. status=${state.status} health=${state.health} exit_code=${state.exit_code}. recent logs:\n${containerLogs(name, '80')}`);
  }
  if (state.status !== 'running') {
    fail(`container ${name} must be running, got ${state.status}. health=${state.health} exit_code=${state.exit_code}. recent logs:\n${containerLogs(name, '80')}`);
  }
  return state;
}

function waitForStableRuntime(required, executorName) {
  const deadlineMs = Date.now() + Number(process.env.RUNTIME_WORKERS_STABLE_TIMEOUT_MS || 90000);
  let lastDiag = '';
  while (Date.now() < deadlineMs) {
    const states = Object.fromEntries([...required, executorName].map((name) => [name, inspectContainer(name)]));
    const badState = Object.entries(states).find(([, state]) => !state || state.restarting || state.status !== 'running');
    if (badState) {
      const [name, state] = badState;
      lastDiag = `${name} state=${JSON.stringify(state)}`;
      if (state?.restarting) fail(`container ${name} must not be Restarting. recent logs:\n${containerLogs(name, '80')}`);
      sleep(1000);
      continue;
    }

    const serverState = states['geox-v1-server'];
    const serverReady = serverState?.health === 'healthy' || serverState?.health === 'none';
    const jobsReady = logsContain('geox-v1-jobs', ['INFO: jobs runtime started', 'JOBS_TRACE'], '2m');
    const executorReady = logsContain(executorName, ['INFO: executor runtime loop started', 'HEARTBEAT_TRACE'], '2m');
    if (serverReady && jobsReady && executorReady) {
      const stableSince = new Date().toISOString();
      sleep(Number(process.env.RUNTIME_WORKERS_STABLE_OBSERVE_MS || 3000));
      console.log('[runtime-workers-packaging] live runtime stable', {
        server_health: serverState?.health ?? null,
        jobs_ready: jobsReady,
        executor_ready: executorReady,
        stable_since: stableSince,
      });
      return stableSince;
    }
    lastDiag = `server_health=${serverState?.health ?? 'unknown'} jobs_ready=${jobsReady} executor_ready=${executorReady}`;
    sleep(1000);
  }
  fail(`commercial_v1 runtime did not become stable before live log checks. last=${lastDiag}. server_logs:\n${containerLogs('geox-v1-server', '120')}\njobs_logs:\n${containerLogs('geox-v1-jobs', '120')}\nexecutor_logs:\n${containerLogs(executorName, '120')}`);
}

function checkLiveContainersIfPresent() {
  const names = dockerAvailable();
  const required = ['geox-v1-server', 'geox-v1-jobs'];
  const executorName = names.includes('geox-executor-1') ? 'geox-executor-1' : (names.includes('geox-v1-executor') ? 'geox-v1-executor' : null);
  if (!required.every((name) => names.includes(name)) || !executorName) {
    console.log('[runtime-workers-packaging] SKIP live docker checks: commercial_v1 server/jobs/executor containers not all present');
    return;
  }

  for (const name of [...required, executorName]) assertContainerRunning(name);

  const stableSince = waitForStableRuntime(required, executorName);
  assert(logsContain(executorName, ['INFO: executor runtime loop started', 'HEARTBEAT_TRACE'], '2m'), 'executor logs must show runtime loop started or HEARTBEAT_TRACE');
  assert(logsContain('geox-v1-jobs', ['INFO: jobs runtime started', 'JOBS_TRACE'], '2m'), 'jobs logs must show jobs runtime started or JOBS_TRACE');
  assertLogsNotContain('geox-v1-server', ['ERR_HTTP_HEADERS_SENT', 'Reply was already sent'], '240', stableSince);
  assertLogsNotContain('geox-v1-server', ['OPERATION_PLAN_TERMINAL"'], '300', stableSince);

  const serverRecent = containerLogs('geox-v1-server', '400', stableSince);
  assert(!(serverRecent.includes('OPERATION_PLAN_TERMINAL') && serverRecent.includes('statusCode":500')), 'server logs must not contain OPERATION_PLAN_TERMINAL with statusCode 500 in stable runtime logs');

  const executorRecent = containerLogs(executorName, '800', stableSince);
  const runtimeLoopFailedCount = countMatches(executorRecent, /runtime loop iteration failed/g);
  assert(runtimeLoopFailedCount <= 1, `executor logs runtime loop iteration failed must not repeat over threshold(1) after stable runtime window, got ${runtimeLoopFailedCount}. recent logs:\n${executorRecent}`);
  assert(!executorRecent.includes('OPERATION_PLAN_TASK_ID_MISMATCH'), 'executor logs must not contain OPERATION_PLAN_TASK_ID_MISMATCH after stable runtime window');

  const receiptFailedCount = countMatches(executorRecent, /RECEIPT_WRITE_FAILED/g);
  assert(receiptFailedCount <= 3, `executor logs RECEIPT_WRITE_FAILED must not repeat over threshold(3) after stable runtime window, got ${receiptFailedCount}. recent logs:\n${executorRecent}`);

  const leaseRecoverByTask = new Map();
  const leaseRecoverRegex = /LEASE_RECOVER[^\n]*task_id=([^\s]+)/g;
  let m;
  while ((m = leaseRecoverRegex.exec(executorRecent)) !== null) {
    const taskId = String(m[1] ?? '').trim();
    if (!taskId) continue;
    leaseRecoverByTask.set(taskId, (leaseRecoverByTask.get(taskId) ?? 0) + 1);
  }
  for (const [taskId, cnt] of leaseRecoverByTask.entries()) {
    assert(cnt <= 3, `executor logs LEASE_RECOVER task_id=${taskId} repeated over threshold(3) after stable runtime window, got ${cnt}`);
  }
}

checkStaticPackaging();
checkBuildArtifacts();
checkLiveContainersIfPresent();
console.log('[runtime-workers-packaging] PASS');