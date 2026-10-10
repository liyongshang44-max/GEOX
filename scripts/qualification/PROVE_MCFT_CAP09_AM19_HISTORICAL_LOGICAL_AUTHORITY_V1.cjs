#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');

const SOURCE = path.resolve('scripts/runtime_acceptance/PREFLIGHT_MCFT_CAP_09_AMENDMENT_19_CROP_WINDOW_V1.cjs');
const DESCRIPTOR = path.resolve('docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-AM19-HISTORICAL-LOGICAL-EPOCH-V1.json');
const SOURCE_OUTPUT = path.resolve('acceptance-output/MCFT_CAP_09_AMENDMENT_19_CROP_WINDOW_PREFLIGHT_V1.json');
const OUTPUT = path.resolve('acceptance-output/MCFT_CAP_09_AM19_HISTORICAL_LOGICAL_AUTHORITY_V1.json');
const SOURCE_BLOB = '526b3e95ca94692bfbfe7b356868656b239d94fd';

function readJson(file) { return JSON.parse(fs.readFileSync(file, 'utf8')); }
function sha256File(file) { return `sha256:${crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')}`; }
function git(...args) {
  const r = spawnSync('git', args, { encoding: 'utf8', windowsHide: true });
  if (r.error) throw r.error;
  if (r.status !== 0) throw new Error(`AM19_HISTORICAL_AUTHORITY_GIT_FAILED:${args.join(':')}:${(r.stderr || '').trim()}`);
  return (r.stdout || '').trim();
}
function requireCondition(value, code) { if (!value) throw new Error(code); }

function selftest() {
  requireCondition(git('rev-parse', `HEAD:${path.relative(process.cwd(), SOURCE).replaceAll('\\', '/')}`) === SOURCE_BLOB, 'AM19_HISTORICAL_AUTHORITY_SOURCE_BLOB_DRIFT');
  const d = readJson(DESCRIPTOR);
  requireCondition(d.schema_version === 'geox_mcft_cap09_am19_historical_logical_epoch_v1', 'AM19_HISTORICAL_AUTHORITY_DESCRIPTOR_SCHEMA_REQUIRED');
  requireCondition(d.logical_epoch?.target_t === '2026-08-21T19:00:00.000Z', 'AM19_HISTORICAL_AUTHORITY_TARGET_REQUIRED');
  requireCondition(d.authority_v3_historical_viability?.required_context_count === 25 && d.authority_v3_historical_viability?.passing_context_count === 25, 'AM19_HISTORICAL_AUTHORITY_DESCRIPTOR_25_OF_25_REQUIRED');
  process.stdout.write(`${JSON.stringify({status:'PASS',source_blob:SOURCE_BLOB,historical_logical_epoch_only:true,current_season_formal_admission:false})}\n`);
}

function run() {
  selftest();
  const d = readJson(DESCRIPTOR);
  const candidatePath = path.resolve(process.env.MCFT_CAP09_ROLLING_CANDIDATE_PATH || 'rolling-candidate/MCFT_CAP_09_ROLLING_PREBOUNDARY_CANDIDATE.json');
  const candidate = readJson(candidatePath);
  requireCondition(candidate.target_t === d.logical_epoch.target_t, 'AM19_HISTORICAL_AUTHORITY_CANDIDATE_TARGET_MISMATCH');
  requireCondition(candidate.producer_subject_sha === d.historical_producer.producer_subject_sha, 'AM19_HISTORICAL_AUTHORITY_PRODUCER_MISMATCH');
  requireCondition(process.env.MCFT_CAP09_ROLLING_PRODUCER_SUBJECT_SHA === d.historical_producer.producer_subject_sha, 'AM19_HISTORICAL_AUTHORITY_ENV_PRODUCER_MISMATCH');
  const r = spawnSync(process.execPath, [SOURCE, 'run'], { stdio: 'inherit', env: process.env, windowsHide: true });
  if (r.error) throw r.error;
  if (r.status !== 0) throw new Error(`AM19_HISTORICAL_AUTHORITY_SOURCE_PREFLIGHT_FAILED:${r.status}`);
  const p = readJson(SOURCE_OUTPUT);
  requireCondition(p.status === 'PASS' && p.result === 'EXACT_A0_PLUS_O00_O23_CROP_WINDOW_VIABLE', 'AM19_HISTORICAL_AUTHORITY_V3_PASS_REQUIRED');
  requireCondition(p.crop_authority_id === d.authority_v3_historical_viability.authority_id, 'AM19_HISTORICAL_AUTHORITY_ID_MISMATCH');
  requireCondition(p.a0 === d.logical_epoch.target_t && p.o00 === d.authority_v3_historical_viability.o00 && p.o23 === d.authority_v3_historical_viability.o23, 'AM19_HISTORICAL_AUTHORITY_WINDOW_MISMATCH');
  requireCondition(p.required_context_count === 25 && p.passing_context_count === 25 && p.failing_context_count === 0, 'AM19_HISTORICAL_AUTHORITY_25_OF_25_REQUIRED');
  requireCondition(Array.isArray(p.all_contexts) && p.all_contexts.length === 25 && p.all_contexts.every((x) => x.status === 'PASS' && x.stage_code === 'MID'), 'AM19_HISTORICAL_AUTHORITY_ALL_MID_REQUIRED');
  requireCondition(p.provider_request_count === 0 && p.r2_request_count === 0 && p.database_write_count === 0 && p.runtime_write_count === 0 && p.scheduler_write_count === 0 && p.formal_o00_started === false, 'AM19_HISTORICAL_AUTHORITY_ZERO_EFFECT_REQUIRED');
  const out = {
    schema_version: 'geox_mcft_cap09_am19_historical_logical_authority_v1',
    status: 'PASS',
    historical_logical_epoch_id: d.epoch_id,
    historical_logical_epoch_only: true,
    qualification_subject_sha: String(process.env.SUBJECT_SHA || ''),
    producer_subject_sha: d.historical_producer.producer_subject_sha,
    authority_id: p.crop_authority_id,
    a0: p.a0,
    o00: p.o00,
    o23: p.o23,
    required_context_count: 25,
    passing_context_count: 25,
    failing_context_count: 0,
    all_contexts_mid: true,
    source_preflight_digest: sha256File(SOURCE_OUTPUT),
    source_preflight_unchanged_blob_sha: SOURCE_BLOB,
    current_season_formal_admission: 'NOT_EVALUATED_BY_THIS_PROOF',
    current_2026_crop_window_status: d.current_2026_crop_window_status,
    formal_v5_arm: false,
    a0_authorized: false,
    o00_o23_authorized: false,
    provider_request_count: 0,
    database_write_count: 0,
    runtime_write_count: 0,
    scheduler_write_count: 0,
    formal_effect: false
  };
  fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
  fs.writeFileSync(OUTPUT, `${JSON.stringify(out, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify(out)}\n`);
}

const mode = process.argv[2] || '';
if (mode === 'selftest') selftest();
else if (mode === 'run') run();
else throw new Error(`AM19_HISTORICAL_AUTHORITY_MODE_REQUIRED:${mode || 'MISSING'}`);
