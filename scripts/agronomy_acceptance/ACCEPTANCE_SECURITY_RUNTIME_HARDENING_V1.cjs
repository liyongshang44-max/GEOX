#!/usr/bin/env node
/* eslint-disable no-console */
const { env, fetchJson } = require('./_common.cjs');
const { execFileSync } = require('node:child_process');
const path = require('node:path');
function runWith(e){const out=execFileSync('node',['--import','tsx','-e',`import { getRuntimeSecurityStatusV1 } from './apps/server/src/runtime/runtime_security_v1.ts';console.log(JSON.stringify(getRuntimeSecurityStatusV1()));`],{cwd:path.resolve(__dirname,'../..'),env:{...process.env,...e},encoding:'utf8'});return JSON.parse(out.trim().split('\n').pop());}
(async()=>{const checks={};
const dev=runWith({GEOX_RUNTIME_ENV:'development',GEOX_ALLOWED_ORIGINS:''}); checks.development_returns_status=dev.runtime_env==='development'&&Array.isArray(dev.errors);
const noToken=runWith({GEOX_RUNTIME_ENV:'production',GEOX_TOKENS_JSON:'',GEOX_TOKENS_FILE:'',GEOX_TOKEN_SSOT_PATH:''}); checks.production_token_source_required=(noToken.errors||[]).includes('RUNTIME_TOKEN_SOURCE_REQUIRED');
const single=runWith({GEOX_RUNTIME_ENV:'production',GEOX_TOKEN:'abc'}); checks.single_token_forbidden=(single.errors||[]).includes('RUNTIME_SINGLE_TOKEN_FALLBACK_FORBIDDEN');
const cors=runWith({GEOX_RUNTIME_ENV:'production',GEOX_TOKENS_JSON:'{"version":"ao_act_tokens_v0","tokens":[]}',GEOX_ALLOWED_ORIGINS:'*'}); checks.cors_wildcard_forbidden=(cors.errors||[]).includes('RUNTIME_CORS_WILDCARD_FORBIDDEN');
const valid=runWith({GEOX_RUNTIME_ENV:'production',GEOX_TOKENS_JSON:'{"version":"ao_act_tokens_v0","tokens":[]}',GEOX_ALLOWED_ORIGINS:'https://app.geox.example',POSTGRES_PASSWORD:'StrongPostgresPassword_123',MINIO_ROOT_PASSWORD:'StrongMinioPassword_123',MQTT_AUTH_REQUIRED:'1',MQTT_PASSWORD:'StrongMqttPassword_123',GEOX_EXECUTION_DEFAULT_DISABLED:'1',GEOX_APP_SECRET:'StrongAppSecret_123',GEOX_PUBLIC_BASE_URL:'https://api.geox.example'}); checks.valid_prod_ok=valid.ok===true&&((valid.errors||[]).length===0);
const base=env('BASE_URL', process.env.GEOX_BASE_URL || 'http://127.0.0.1:3001'); const h=await fetchJson(`${base}/api/admin/healthz`); checks.healthz_runtime_security=Boolean(h.json?.runtime_security?.checks);
console.log(JSON.stringify({ok:Object.values(checks).every(Boolean),checks},null,2));})();
