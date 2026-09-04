const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const cp = require('node:child_process');

const BASE = '612d650244310cd60795c9e66883bd12d9981226';
const ARTIFACT = 'docs/architecture/semantic_convergence/GEOX-BLINE-W6B2-COMMERCIAL-PRINCIPAL-ISOLATION-V1.json';
const BOOTSTRAP = 'apps/server/src/infra/bline_commercial_principal_bootstrap_v1.ts';
const DIST = 'apps/server/scripts/write_dist_entries.cjs';
const COMPOSE = 'docker-compose.commercial_v1.yml';
const ENV_EXAMPLE = '.env.commercial_v1.example';
const W6B1_GATE = 'scripts/governance_acceptance/ACCEPTANCE_BLINE_W6B1_INTERNAL_TASK_ISSUER_PRINCIPAL_V1.cjs';

function sh(args, opts = {}) {
  return cp.execFileSync('git', ['-c', 'core.quotepath=false', ...args], { encoding: 'utf8', ...opts }).trim();
}
function read(p) { return fs.readFileSync(p, 'utf8'); }
function json(p) { return JSON.parse(read(p)); }
function assert(c, m, d) { if (!c) throw new Error(m + (d === undefined ? '' : ': ' + JSON.stringify(d))); }
function lines(s) { return String(s || '').split(/\r?\n/).filter(Boolean).sort(); }

function serviceBlock(compose, name, nextName) {
  const start = compose.indexOf(`  ${name}:\n`);
  assert(start >= 0, `missing compose service ${name}`);
  const end = nextName ? compose.indexOf(`\n  ${nextName}:`, start) : -1;
  return end >= 0 ? compose.slice(start, end) : compose.slice(start);
}

const head = sh(['rev-parse', 'HEAD']);
try { cp.execFileSync('git', ['merge-base', '--is-ancestor', BASE, head], { stdio: 'ignore' }); }
catch { throw new Error(`W6-B2 head is not descended from W6-B1 qualified candidate ${BASE}: ${head}`); }

const inv = json(ARTIFACT);
assert(inv.version === 'GEOX-BLINE-W6B2-COMMERCIAL-PRINCIPAL-ISOLATION-V1', 'W6-B2 artifact version drift');
assert(inv.status === 'FROZEN_BOUNDED_WORKSTREAM_INVENTORY', 'W6-B2 artifact status drift');
assert(inv.authority_base === BASE, 'W6-B2 authority base drift', inv.authority_base);
assert(inv.authority_base_status === 'W6_B1_EXACT_HEAD_QUALIFIED_CANDIDATE_NOT_CTO_ACCEPTED', 'W6-B2 stacked authority status drift');
assert(Array.isArray(inv.blockers) && inv.blockers.length === 1 && inv.blockers[0]?.id === 'COMMERCIAL-PRINCIPAL-01', 'W6-B2 blocker set drift');
assert(inv.database_principals?.server === 'geox_runtime_v1', 'server DB principal drift');
assert(inv.database_principals?.telemetry_ingest === 'geox_telemetry_ingest_v1', 'telemetry DB principal drift');
assert(inv.database_principals?.jobs === 'geox_jobs_v1', 'jobs DB principal drift');
assert(inv.database_principals?.executor === 'geox_executor_runtime_v1', 'executor DB principal drift');

const bootstrap = read(BOOTSTRAP);
for (const marker of [
  'BLINE_COMMERCIAL_TELEMETRY_ROLE_V1 = "geox_telemetry_ingest_v1"',
  'BLINE_COMMERCIAL_JOBS_ROLE_V1 = "geox_jobs_v1"',
  'BLINE_COMMERCIAL_EXECUTOR_ROLE_V1 = "geox_executor_runtime_v1"',
  'LOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS',
  'REVOKE ${MCFT_CAP07_RUNTIME_ROLE_V1} FROM ${BLINE_COMMERCIAL_TELEMETRY_ROLE_V1}',
  'REVOKE ${MCFT_CAP07_RUNTIME_ROLE_V1} FROM ${BLINE_COMMERCIAL_JOBS_ROLE_V1}',
  'REVOKE ${MCFT_CAP07_RUNTIME_ROLE_V1} FROM ${BLINE_COMMERCIAL_EXECUTOR_ROLE_V1}',
  'GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO ${roles}',
  'GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA public TO ${roles}',
  'GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO ${roles}',
  "BLINE_COMMERCIAL_PRINCIPAL_BOOTSTRAP_INVALID:ROLE_GRAPH"
]) assert(bootstrap.includes(marker), 'W6-B2 DB principal marker missing', marker);
assert(!bootstrap.includes(`GRANT ${'${MCFT_CAP07_RUNTIME_ROLE_V1}'} TO ${'${BLINE_COMMERCIAL'}`), 'W6-B2 must not implement isolation through MCFT runtime-role membership');

const dist = read(DIST);
assert(dist.includes('bline_commercial_principal_bootstrap.js'), 'compiled B-Line principal bootstrap entry missing');
assert(dist.includes('runBlineCommercialPrincipalBootstrapFromEnvironmentV1'), 'compiled B-Line principal bootstrap runner missing');

const compose = read(COMPOSE);
const dbBootstrap = serviceBlock(compose, 'bline-commercial-principal-bootstrap', 'mqtt');
const mqtt = serviceBlock(compose, 'mqtt', 'minio');
const server = serviceBlock(compose, 'server', 'telemetry-ingest');
const telemetry = serviceBlock(compose, 'telemetry-ingest', 'jobs');
const jobs = serviceBlock(compose, 'jobs', 'executor');
const executor = serviceBlock(compose, 'executor', 'web');

assert(dbBootstrap.includes('apps/server/dist/database/bline_commercial_principal_bootstrap.js'), 'W6-B2 bootstrap service entry drift');
assert(dbBootstrap.includes('server:\n        condition: service_healthy'), 'W6-B2 bootstrap must run after server schema readiness');
for (const v of ['GEOX_TELEMETRY_DATABASE_PASSWORD', 'GEOX_JOBS_DATABASE_PASSWORD', 'GEOX_EXECUTOR_DATABASE_PASSWORD']) {
  assert(dbBootstrap.includes(v), 'W6-B2 bootstrap missing DB credential', v);
}

assert(server.includes('DATABASE_URL: postgres://geox_runtime_v1:'), 'server must retain frozen geox_runtime_v1 DB principal');
assert(!server.includes('GEOX_TELEMETRY_DATABASE_PASSWORD'), 'server received telemetry DB credential');
assert(!server.includes('GEOX_JOBS_DATABASE_PASSWORD'), 'server received jobs DB credential');
assert(!server.includes('GEOX_EXECUTOR_DATABASE_PASSWORD'), 'server received executor DB credential');
assert(server.includes('mcft-cap07-migration:\n        condition: service_completed_successfully'), 'server must remain downstream of canonical MCFT migration');
assert(!server.includes('bline-commercial-principal-bootstrap:'), 'server must not depend on worker-principal bootstrap');

assert(telemetry.includes('DATABASE_URL: postgres://geox_telemetry_ingest_v1:'), 'telemetry-ingest DB principal not isolated');
assert(jobs.includes('DATABASE_URL: postgres://geox_jobs_v1:'), 'jobs DB principal not isolated');
assert(executor.includes('DATABASE_URL: postgres://geox_executor_runtime_v1:'), 'executor DB principal not isolated');
for (const block of [telemetry, jobs, executor]) {
  assert(block.includes('bline-commercial-principal-bootstrap:\n        condition: service_completed_successfully'), 'worker does not wait for W6-B2 principal bootstrap');
  assert(!block.includes('postgres://geox_runtime_v1:'), 'worker still reuses geox_runtime_v1');
}
assert(!telemetry.includes('GEOX_AO_ACT_TOKEN:'), 'telemetry-ingest still receives shared AO-ACT token');
assert(!jobs.includes('GEOX_AO_ACT_TOKEN:'), 'jobs still receives shared AO-ACT token');
assert(!jobs.includes('GEOX_MQTT_URL:'), 'jobs still receives unused MQTT transport');
assert(!jobs.includes('GEOX_MQTT_USERNAME:'), 'jobs still receives unused MQTT credential');
assert(!jobs.includes('GEOX_MQTT_PASSWORD:'), 'jobs still receives unused MQTT credential');
assert(executor.includes('GEOX_AO_ACT_TOKEN: ${GEOX_EXECUTOR_TOKEN:?GEOX_EXECUTOR_TOKEN is required}'), 'executor must retain dedicated executor HTTP principal only');

assert(mqtt.includes('allow_anonymous false'), 'MQTT anonymous access re-enabled');
assert(mqtt.includes('acl_file /tmp/mosquitto-config/acl'), 'MQTT ACL file missing');
assert(mqtt.includes('GEOX_TELEMETRY_MQTT_USERNAME'), 'telemetry MQTT principal missing');
assert(mqtt.includes('GEOX_TELEMETRY_MQTT_PASSWORD'), 'telemetry MQTT credential missing');
assert(mqtt.includes('GEOX_EXECUTOR_MQTT_USERNAME'), 'executor MQTT principal missing');
assert(mqtt.includes('GEOX_EXECUTOR_MQTT_PASSWORD'), 'executor MQTT credential missing');
assert(mqtt.includes('topic read telemetry/+/+'), 'telemetry MQTT telemetry read ACL missing');
assert(mqtt.includes('topic read heartbeat/+/+'), 'telemetry MQTT heartbeat read ACL missing');
assert(mqtt.includes('topic write #'), 'executor MQTT write-only compatibility ACL missing');
assert(telemetry.includes('GEOX_MQTT_USERNAME: ${GEOX_TELEMETRY_MQTT_USERNAME:-geox_telemetry_ingest_v1}'), 'telemetry runtime MQTT identity drift');
assert(telemetry.includes('GEOX_MQTT_PASSWORD: ${GEOX_TELEMETRY_MQTT_PASSWORD:?GEOX_TELEMETRY_MQTT_PASSWORD is required}'), 'telemetry runtime MQTT credential drift');
assert(executor.includes('GEOX_MQTT_USERNAME: ${GEOX_EXECUTOR_MQTT_USERNAME:-geox_executor_v1}'), 'executor runtime MQTT identity drift');
assert(executor.includes('GEOX_MQTT_PASSWORD: ${GEOX_EXECUTOR_MQTT_PASSWORD:?GEOX_EXECUTOR_MQTT_PASSWORD is required}'), 'executor runtime MQTT credential drift');
assert(!server.includes('GEOX_MQTT_USERNAME:'), 'server must not receive a broker username');
assert(!server.includes('GEOX_MQTT_PASSWORD:'), 'server must not receive a broker password');
assert(!server.includes('GEOX_TELEMETRY_MQTT_PASSWORD'), 'server leaked telemetry broker credential');
assert(!server.includes('GEOX_EXECUTOR_MQTT_PASSWORD'), 'server leaked executor broker credential');
assert(server.includes('MQTT_PASSWORD: ${APP_SECRET:?APP_SECRET is required}'), 'server runtime-security MQTT auth assertion drift');

const envExample = read(ENV_EXAMPLE);
for (const marker of [
  'GEOX_TELEMETRY_DATABASE_PASSWORD=',
  'GEOX_JOBS_DATABASE_PASSWORD=',
  'GEOX_EXECUTOR_DATABASE_PASSWORD=',
  'GEOX_TELEMETRY_MQTT_USERNAME=geox_telemetry_ingest_v1',
  'GEOX_TELEMETRY_MQTT_PASSWORD=',
  'GEOX_EXECUTOR_MQTT_USERNAME=geox_executor_v1',
  'GEOX_EXECUTOR_MQTT_PASSWORD=',
  'GEOX_EXECUTOR_TOKEN=executor_token'
]) assert(envExample.includes(marker), 'Commercial env example missing isolated principal wiring', marker);

const protectedUnchanged = [
  'apps/server/src/infra/mcft_cap07_database_platform_bootstrap_v1.ts',
  'apps/server/src/infra/mcft_cap07_runtime_startup_preflight_v1.ts',
  'apps/server/src/infra/mcft_cap07_startup_migration_runner_v1.ts',
  'apps/server/src/server.ts',
  'apps/server/src/auth/internal_task_issuer_principal_v1.ts',
  'apps/server/src/routes/control_approval_request_v1.ts',
  'apps/server/src/routes/control_ao_act.ts',
  'apps/server/src/auth/ao_act_authz_v0.ts',
  'apps/server/src/domain/auth/roles.ts',
  'config/auth/security_acceptance_tokens.json',
  'apps/telemetry-ingest/src/main.ts',
  'apps/server/src/jobs/runtime.ts',
  'apps/server/src/jobs/agronomy_agent.ts',
  'apps/executor/src/runtime_loop.ts',
  'apps/executor/src/run_dispatch_once.ts',
  'apps/executor/src/adapters/mqtt.ts'
];
const protectedDrift = lines(sh(['diff', '--name-only', BASE, 'HEAD', '--', ...protectedUnchanged]));
assert(protectedDrift.length === 0, 'W6-B2 reopened protected W1-W6B1/MCFT/runtime semantic source', protectedDrift);

const changed = lines(sh(['diff', '--name-only', BASE, 'HEAD']));
for (const p of changed) assert(!/docs\/digital_twin\/mcft|\.github\/workflows\/mcft-|apps\/server\/src\/infra\/mcft_/i.test(p), 'W6-B2 touched MCFT path', p);
for (const p of changed) assert(!/action.qualification|action_qualification/i.test(p), 'W6-B2 entered Action Qualification', p);

const coreAllowed = new Set([
  ARTIFACT,
  BOOTSTRAP,
  DIST,
  COMPOSE,
  ENV_EXAMPLE,
  'scripts/governance_acceptance/ACCEPTANCE_BLINE_W6B2_COMMERCIAL_PRINCIPAL_ISOLATION_V1.cjs',
  'scripts/runtime_acceptance/ACCEPTANCE_BLINE_W6B2_COMMERCIAL_PRINCIPAL_ISOLATION_V1.ts',
  '.github/workflows/bline-w6b2-commercial-principal-isolation.yml',
  'docs/architecture/semantic_convergence/GEOX-BLINE-W6B2-QUALIFICATION-WIRING-V1.json',
  '.github/workflows/ci.yml'
]);
for (const p of changed) assert(coreAllowed.has(p), 'W6-B2 scope expansion', p);

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'geox-w6b1-qualified-'));
try {
  cp.execFileSync('git', ['worktree', 'add', '--detach', tmp, BASE], { stdio: 'ignore' });
  cp.execFileSync(process.execPath, [W6B1_GATE], { cwd: tmp, stdio: 'inherit' });
} finally {
  try { cp.execFileSync('git', ['worktree', 'remove', '--force', tmp], { stdio: 'ignore' }); } catch {}
  try { fs.rmSync(tmp, { recursive: true, force: true }); } catch {}
}

console.log(JSON.stringify({
  result: 'PASS',
  workstream: 'W6_B2_COMMERCIAL_PRINCIPAL_ISOLATION',
  authority_base: BASE,
  authority_base_status: inv.authority_base_status,
  head,
  blocker_id: 'COMMERCIAL-PRINCIPAL-01',
  database_principals: inv.database_principals,
  mqtt_principals: inv.mqtt_principals,
  server_runtime_role_preserved: true,
  mcft_source_unchanged: true,
  w6b1_qualified_gate_replayed: true,
  changed_files: changed,
  mcft_delta: 0
}, null, 2));
