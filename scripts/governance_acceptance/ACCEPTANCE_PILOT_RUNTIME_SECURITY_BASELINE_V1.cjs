#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const RUNTIME_SECURITY = path.join(ROOT, 'apps/server/src/runtime/runtime_security_v1.ts');
const CORS = path.join(ROOT, 'apps/server/src/runtime/cors_v1.ts');
const ADMIN_MODULE = path.join(ROOT, 'apps/server/src/modules/admin/registerAdminModule.ts');
const COMPOSE = path.join(ROOT, 'docker-compose.commercial_v1.yml');
const ENV_EXAMPLE = path.join(ROOT, '.env.example');
const ENV_PROD_EXAMPLE = path.join(ROOT, '.env.production.example');
const CI = path.join(ROOT, '.github/workflows/ci.yml');

function read(file) {
  if (!fs.existsSync(file)) fail(`missing required file: ${file}`);
  return fs.readFileSync(file, 'utf8');
}

const errors = [];
function check(condition, message) {
  if (!condition) errors.push(message);
}
function fail(message) {
  console.error(`[pilot-runtime-security-baseline-v1] FAIL: ${message}`);
  process.exit(1);
}
function mustInclude(source, needle, label) {
  check(source.includes(needle), `${label} missing ${needle}`);
}
function mustNotInclude(source, needle, label) {
  check(!source.includes(needle), `${label} must not include ${needle}`);
}

function extractServerEnvironmentBlock(compose) {
  const start = compose.indexOf('  server:\n');
  if (start < 0) return '';
  const next = compose.indexOf('\n  telemetry-ingest:', start);
  if (next < 0) return compose.slice(start);
  return compose.slice(start, next);
}

function extractMqttBlock(compose) {
  const start = compose.indexOf('  mqtt:\n');
  if (start < 0) return '';
  const next = compose.indexOf('\n  minio:', start);
  if (next < 0) return compose.slice(start);
  return compose.slice(start, next);
}

async function checkRuntimeHealthz() {
  const baseUrl = String(process.env.BASE_URL || process.env.API_BASE_URL || '').trim();
  if (!baseUrl) return { checked: false, reason: 'BASE_URL_NOT_SET' };
  let response;
  try {
    response = await fetch(`${baseUrl.replace(/\/$/, '')}/api/admin/healthz`);
  } catch (err) {
    return { checked: false, reason: `HEALTHZ_FETCH_FAILED:${String(err?.message ?? err)}` };
  }
  const text = await response.text();
  check(response.status === 200, `runtime healthz expected HTTP 200 got ${response.status}`);
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    check(false, `runtime healthz response is not JSON: ${text.slice(0, 240)}`);
    return { checked: true, ok: false };
  }
  const runtimeSecurity = body?.runtime_security;
  check(runtimeSecurity && typeof runtimeSecurity === 'object', 'runtime healthz missing runtime_security object');
  check(body?.schema_ok === true, `runtime healthz schema_ok must be true, got ${JSON.stringify(body?.schema_ok)}`);
  check(body?.runtime_security_required === true, `runtime healthz runtime_security_required must be true, got ${JSON.stringify(body?.runtime_security_required)}`);
  check(runtimeSecurity?.ok === true, `runtime healthz runtime_security.ok must be true, got ${JSON.stringify(runtimeSecurity)}`);
  check(body?.ok === true, `runtime healthz top-level ok must be true, got ${JSON.stringify(body?.ok)}`);
  check(runtimeSecurity?.runtime_env === 'pilot' || runtimeSecurity?.runtime_env === 'production', `runtime healthz runtime_env must be pilot/production, got ${runtimeSecurity?.runtime_env}`);
  const c = runtimeSecurity?.checks || {};
  for (const key of [
    'runtime_env_pilot_or_production',
    'cors_origins_configured',
    'app_secret_configured',
    'public_base_url_configured',
    'postgres_password_strong',
    'minio_password_strong',
    'mqtt_auth_enabled',
    'single_token_fallback_disabled',
    'execution_enable_reason_present',
    'devtools_disabled',
  ]) {
    check(c[key] === true, `runtime healthz check ${key} must be true, got ${c[key]}`);
  }
  return { checked: true, ok: runtimeSecurity?.ok === true, runtime_env: runtimeSecurity?.runtime_env };
}

async function main() {
  const runtime = read(RUNTIME_SECURITY);
  const cors = read(CORS);
  const admin = read(ADMIN_MODULE);
  const compose = read(COMPOSE);
  const envExample = read(ENV_EXAMPLE);
  const envProd = read(ENV_PROD_EXAMPLE);
  const ci = read(CI);
  const serverBlock = extractServerEnvironmentBlock(compose);
  const mqttBlock = extractMqttBlock(compose);

  mustInclude(runtime, '"pilot"', 'runtime security must recognize pilot runtime env');
  mustInclude(runtime, 'RUNTIME_ENV_MUST_BE_PILOT_OR_PRODUCTION', 'runtime security must enforce pilot/production profile');
  mustInclude(runtime, 'RUNTIME_SINGLE_TOKEN_FALLBACK_FORBIDDEN', 'runtime security must forbid single token fallback');
  mustInclude(runtime, 'RUNTIME_CORS_ORIGINS_REQUIRED', 'runtime security must require CORS origins');
  mustInclude(runtime, 'RUNTIME_POSTGRES_PASSWORD_WEAK', 'runtime security must reject weak Postgres password');
  mustInclude(runtime, 'RUNTIME_MINIO_PASSWORD_WEAK', 'runtime security must reject weak MinIO password');
  mustInclude(runtime, 'RUNTIME_MQTT_AUTH_REQUIRED', 'runtime security must require MQTT auth');
  mustInclude(runtime, 'RUNTIME_EXECUTION_ENABLE_REASON_REQUIRED', 'runtime security must require execution enable reason');
  mustInclude(runtime, 'RUNTIME_DEVTOOLS_FORBIDDEN', 'runtime security must disable devtools');
  mustInclude(runtime, 'PUBLIC_BASE_URL', 'runtime security must accept PUBLIC_BASE_URL');
  mustInclude(runtime, 'APP_SECRET', 'runtime security must accept APP_SECRET');

  mustInclude(cors, 'process.env.CORS_ORIGINS ?? process.env.GEOX_ALLOWED_ORIGINS', 'CORS runtime must use CORS_ORIGINS alias');
  mustInclude(runtime, 'strong-random', 'runtime security must reject strong-random placeholders');
  mustInclude(runtime, 'placeholder', 'runtime security must reject placeholder secrets');
  mustInclude(runtime, 'secret-manager', 'runtime security must reject secret-manager placeholders');
  mustInclude(runtime, '^<[^>]+>$', 'runtime security must reject angle-bracket placeholders');

  mustInclude(admin, 'schema_ok', 'healthz must expose schema_ok');
  mustInclude(admin, 'runtime_security_required', 'healthz must expose runtime_security_required');
  mustInclude(admin, 'runtimeSecurity.ok', 'healthz top-level ok must include runtime security');

  mustInclude(serverBlock, 'GEOX_RUNTIME_ENV: ${GEOX_RUNTIME_ENV:-pilot}', 'server compose must default to pilot runtime env');
  mustInclude(serverBlock, 'POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:?POSTGRES_PASSWORD is required}', 'server compose must expose Postgres password to runtime security check');
  mustInclude(serverBlock, 'CORS_ORIGINS: ${CORS_ORIGINS:?CORS_ORIGINS is required}', 'server compose must require CORS origins');
  mustInclude(serverBlock, 'APP_SECRET: ${APP_SECRET:?APP_SECRET is required}', 'server compose must require APP secret');
  mustInclude(serverBlock, 'PUBLIC_BASE_URL: ${PUBLIC_BASE_URL:?PUBLIC_BASE_URL is required}', 'server compose must require public base URL');
  mustInclude(serverBlock, 'MQTT_AUTH_REQUIRED: "1"', 'server compose must mark MQTT auth required');
  mustInclude(serverBlock, 'GEOX_EXECUTION_ENABLE_REASON:', 'server compose must carry execution enable reason');
  mustInclude(serverBlock, 'GEOX_DEVTOOLS_ENABLED: ${GEOX_DEVTOOLS_ENABLED:-0}', 'server compose must disable devtools by default');
  mustNotInclude(serverBlock, 'GEOX_TOKEN:', 'server compose must not inject single-token fallback into server');
  mustNotInclude(serverBlock, 'GEOX_AO_ACT_TOKEN:', 'server compose must not inject single-token fallback into server');

  mustInclude(mqttBlock, 'allow_anonymous false', 'MQTT broker must disable anonymous access');
  mustInclude(mqttBlock, 'password_file', 'MQTT broker must use password file');
  mustInclude(mqttBlock, 'mosquitto_passwd', 'MQTT broker must create password file');
  mustInclude(compose, 'GEOX_MQTT_USERNAME', 'runtime components must receive MQTT username');
  mustInclude(compose, 'GEOX_MQTT_PASSWORD', 'runtime components must receive MQTT password');

  mustInclude(envProd, 'GEOX_RUNTIME_ENV=pilot', 'production example must document pilot env');
  mustInclude(envProd, 'CORS_ORIGINS=', 'production example must document CORS_ORIGINS');
  mustInclude(envProd, 'APP_SECRET=', 'production example must document APP_SECRET');
  mustInclude(envProd, 'PUBLIC_BASE_URL=', 'production example must document PUBLIC_BASE_URL');
  mustInclude(envProd, 'MQTT_AUTH_REQUIRED=1', 'production example must require MQTT auth');
  mustInclude(envProd, 'GEOX_DEVTOOLS_ENABLED=0', 'production example must disable devtools');
  mustInclude(envExample, 'development/test only', 'env example must be explicitly non-pilot');

  mustInclude(ci, 'GEOX_RUNTIME_ENV=pilot', 'CI must run commercial compose in pilot runtime mode');
  mustInclude(ci, 'POSTGRES_PASSWORD=ci-pilot-postgres-strong-2026', 'CI must not use default Postgres password');
  mustInclude(ci, 'MINIO_ROOT_PASSWORD=ci-pilot-minio-strong-2026', 'CI must not use default MinIO password');
  mustInclude(ci, 'MQTT_AUTH_REQUIRED=1', 'CI must enable MQTT auth');
  mustInclude(ci, 'CORS_ORIGINS=https://pilot-ci.geox.invalid', 'CI must configure CORS origins');
  mustInclude(ci, 'APP_SECRET=ci-pilot-app-secret-strong-2026', 'CI must configure app secret');
  mustInclude(ci, 'PUBLIC_BASE_URL=https://pilot-ci.geox.invalid', 'CI must configure public base URL');
  mustNotInclude(ci, 'GEOX_TOKEN=$ACCEPTANCE_TOKEN', 'CI must not inject single-token fallback');
  mustNotInclude(ci, 'POSTGRES_PASSWORD=landos_pwd', 'CI must not use weak Postgres password');
  mustNotInclude(ci, 'MINIO_ROOT_PASSWORD=minioadmin', 'CI must not use weak MinIO password');

  const runtimeHealthz = await checkRuntimeHealthz();

  if (errors.length) {
    console.error('[pilot-runtime-security-baseline-v1] FAIL');
    for (const error of errors) console.error(`- ${error}`);
    process.exit(1);
  }

  console.log('[pilot-runtime-security-baseline-v1] PASS', JSON.stringify({
    checks: {
      runtime_security: true,
      healthz_exposes_runtime_security: true,
      compose_pilot_security: true,
      ci_pilot_security: true,
      env_examples: true,
      runtime_healthz: runtimeHealthz,
    }
  }, null, 2));
}

main().catch((err) => {
  console.error('[pilot-runtime-security-baseline-v1] FAIL', err?.stack || err);
  process.exit(1);
});
