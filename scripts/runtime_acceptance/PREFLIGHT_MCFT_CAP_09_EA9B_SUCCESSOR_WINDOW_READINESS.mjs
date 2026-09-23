#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const CONFIG_PATH = path.join(ROOT, 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA9B-NEW-NATURAL-SEASON-AUTHORITY-ADJUDICATION-V1.json');
const OUT = path.join(ROOT, 'acceptance-output/MCFT_CAP_09_EA9B_SUCCESSOR_WINDOW_READINESS.json');
const SUBJECT_SHA = process.env.MCFT_SUBJECT_SHA || null;

function write(result) {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
}
function assert(condition, code) { if (!condition) throw new Error(code); }

try {
  assert(SUBJECT_SHA && /^[0-9a-f]{40}$/.test(SUBJECT_SHA), 'EA9B_SUCCESSOR_WINDOW_EXACT_SUBJECT_REQUIRED');
  const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
  assert(config.adjudication_contract.candidate_result_is_not_new_season_authority === true, 'EA9B_SUCCESSOR_WINDOW_CANDIDATE_MUST_NOT_BE_AUTHORITY');
  assert(config.adjudication_contract.fresh_season_authority_requires_separate_build === true, 'EA9B_SUCCESSOR_WINDOW_FRESH_AUTHORITY_BUILD_REQUIRED');
  assert(config.decision_policy.whole_window_scan_authorized === false, 'EA9B_SUCCESSOR_WINDOW_CONFIG_DRIFT');
  assert(config.decision_policy.epoch_selection_authorized === false, 'EA9B_SUCCESSOR_WINDOW_EPOCH_SELECTION_DRIFT');
  assert(config.authority_effect.new_natural_season_created === false, 'EA9B_SUCCESSOR_WINDOW_NEW_SEASON_DRIFT');
  assert(config.authority_effect.new_crop_context_authority_established === false, 'EA9B_SUCCESSOR_WINDOW_CROP_AUTHORITY_DRIFT');
  assert(config.authority_effect.successor_epoch_selected === false, 'EA9B_SUCCESSOR_WINDOW_EPOCH_EFFECT_DRIFT');

  const result = {
    schema_version: 'geox_mcft_cap09_ea9b_successor_window_readiness_v1',
    status: 'PASS',
    subject_sha: SUBJECT_SHA,
    readiness: 'WAITING_FOR_FRESH_SEASON_CANDIDATE',
    candidate_to_authority_transition: 'CANDIDATE_DETECTED -> FRESH_SEASON_AUTHORITY_BUILD_REQUIRED',
    authority_to_scan_transition: 'FRESH_SEASON_AUTHORITY_EFFECTIVE -> SUCCESSOR_WHOLE_WINDOW_SCANNER_ALLOWED',
    new_natural_season_created: false,
    new_season_id: null,
    new_crop_context_authority_established: false,
    whole_window_scan_authorized: false,
    successor_epoch_selected: false,
    ea5e2_operational_activation_qualified: false,
    ea5e3_effective: false,
    formal_execution_count: '0/24',
    database_write_count: 0,
    formal_evidence_write_count: 0,
    raw_object_write_count: 0,
    runtime_config_write_count: 0,
    scheduler_write_count: 0,
    canonical_runtime_write_count: 0,
    authority_effect: false
  };
  write(result); console.log(JSON.stringify(result, null, 2));
} catch (error) {
  const result = { schema_version: 'geox_mcft_cap09_ea9b_successor_window_readiness_v1', status: 'FAIL', subject_sha: SUBJECT_SHA, readiness: 'FAIL_CLOSED', error: error instanceof Error ? error.message : String(error), database_write_count: 0, formal_execution_count: '0/24' };
  write(result); console.error(JSON.stringify(result, null, 2)); process.exitCode = 1;
}
