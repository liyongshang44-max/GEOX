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
  const result = spawnSync(command, args, { cwd: root, encoding: 'utf8', shell: process.platform === 'win32', ...opts });
  return result;
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
  const result = run('docker', ['inspect', name, '--format', '{{.State.Status}} {{.State.Restarting}}']);
  if (result.status !== 0) return null;
  const text = result.stdout.trim();
  const [status, restarting] = text.split(/\s+/);
  return { status, restarting: restarting === 'true' };
}

function logsContain(name, patterns) {
  const result = run('docker', ['logs', name, '--tail', '160']);
  if (result.status !== 0) return false;
  const text = `${result.stdout}\n${result.stderr}`;
  return patterns.some((pattern) => text.includes(pattern));
}

function checkLiveContainersIfPresent() {
  const names = dockerAvailable();
  const required = ['geox-v1-server', 'geox-v1-jobs'];
  const executorName = names.includes('geox-executor-1') ? 'geox-executor-1' : (names.includes('geox-v1-executor') ? 'geox-v1-executor' : null);
  if (!required.every((name) => names.includes(name)) || !executorName) {
    console.log('[runtime-workers-packaging] SKIP live docker checks: commercial_v1 server/jobs/executor containers not all present');
    return;
  }

  for (const name of [...required, executorName]) {
    const state = inspectContainer(name);
    assert(state, `container ${name} must be inspectable`);
    assert(!state.restarting, `container ${name} must not be Restarting`);
    assert(['running', 'healthy'].includes(state.status), `container ${name} must be running, got ${state.status}`);
  }
  assert(logsContain(executorName, ['INFO: executor runtime loop started', 'HEARTBEAT_TRACE']), 'executor logs must show runtime loop started or HEARTBEAT_TRACE');
  assert(logsContain('geox-v1-jobs', ['INFO: jobs runtime started', 'JOBS_TRACE']), 'jobs logs must show jobs runtime started or JOBS_TRACE');
}

checkStaticPackaging();
checkBuildArtifacts();
checkLiveContainersIfPresent();
console.log('[runtime-workers-packaging] PASS');
