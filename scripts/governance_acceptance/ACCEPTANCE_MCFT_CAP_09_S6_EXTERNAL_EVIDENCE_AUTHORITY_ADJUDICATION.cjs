#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '../..');
const OUT = path.join(ROOT, 'acceptance-output/MCFT_CAP_09_S6_EXTERNAL_EVIDENCE_AUTHORITY_ADJUDICATION_RESULT.json');
const BASE = process.env.MCFT_BASE_SHA || 'HEAD^';

const FILES = [
  '.github/workflows/mcft-cap-09-s0-pre-candidate-governance.yml',
  '.github/workflows/mcft-cap-09-s6-external-evidence-authority-adjudication.yml',
  'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-AMENDMENT-01-EXTERNAL-PUBLIC-EVIDENCE-AUTHORITY.md',
  'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EXTERNAL-EVIDENCE-AUTHORITY-STATUS-V1.json',
  'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-TASK.md',
  'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_S6_EXTERNAL_EVIDENCE_AUTHORITY_ADJUDICATION.cjs',
].sort();

function git(args) {
  return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim();
}
function read(relative) {
  return fs.readFileSync(path.join(ROOT, relative), 'utf8');
}
function json(relative) {
  return JSON.parse(read(relative));
}
function write(value) {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

try {
  const changed = git(['diff', '--name-only', `${BASE}...HEAD`]).split(/\r?\n/).filter(Boolean).sort();
  assert.deepEqual(changed, FILES, 'S6_EA0_EXACT_SIX_FILE_BOUNDARY_REQUIRED');
  assert.equal(changed.length, 6, 'S6_EA0_EXACT_FILE_COUNT_REQUIRED');
  assert(!changed.some((file) => /(^|\/)(apps|packages)\//.test(file)), 'S6_EA0_RUNTIME_SOURCE_DELTA_FORBIDDEN');
  assert(!changed.some((file) => /migration/i.test(file)), 'S6_EA0_MIGRATION_DELTA_FORBIDDEN');
  assert(!changed.some((file) => /MCFT-CANDIDATE-AUTHORITY-REGISTRY|MCFT-DELIVERY-POLICY/.test(file)), 'S6_EA0_DELIVERY_AUTHORITY_SELF_MODIFICATION_FORBIDDEN');

  const taskbook = read('docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-TASK.md');
  const amendment = read('docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-AMENDMENT-01-EXTERNAL-PUBLIC-EVIDENCE-AUTHORITY.md');
  const status = json('docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EXTERNAL-EVIDENCE-AUTHORITY-STATUS-V1.json');
  const signal = json('docs/digital_twin/mcft/MCFT-DELIVERY-CANDIDATE-SIGNAL-CONTRACT-V1.json');
  const s0Workflow = read('.github/workflows/mcft-cap-09-s0-pre-candidate-governance.yml');

  for (const marker of [
    'Complete Taskbook v0.2',
    'S6-EA0  Taskbook Amendment / Architecture Adjudication',
    'External Formal scope requires fresh bootstrap',
    'ASCE_STANDARDIZED_REFERENCE_ET_SHORT_HOURLY_V1',
    'T+1h through T+72h',
  ]) assert(taskbook.includes(marker), `S6_EA0_TASKBOOK_MARKER_MISSING:${marker}`);

  for (const marker of [
    'CAP08_KERNEL_AUTHORITY_REUSED = YES',
    'CAP08_REPLAY_SCOPE_IDENTITY_REQUIRED = NO',
    'EXTERNAL_SCOPE_FRESH_BOOTSTRAP_REQUIRED = YES',
    'CROSS_SCOPE_CANONICAL_STITCHING_FORBIDDEN = YES',
    'FORMAL_DERIVED_CROP_WATER_USE_STAGE_CONTEXT_V1',
    'future PhenoCam observations = FORBIDDEN',
    'latest complete cycle whose required files',
    'ASCE_STANDARDIZED_REFERENCE_ET_SHORT_HOURLY_V1',
    'NO_MCFT_CAP_09_COMPLETION_FROM_AMENDMENT',
  ]) assert(amendment.includes(marker), `S6_EA0_AMENDMENT_MARKER_MISSING:${marker}`);

  for (const marker of [
    "mode='s6-ea0-adjudication'",
    'ACCEPTANCE_MCFT_CAP_09_S6_EXTERNAL_EVIDENCE_AUTHORITY_ADJUDICATION.cjs',
  ]) assert(s0Workflow.includes(marker), `S6_EA0_S0_ROUTING_MARKER_MISSING:${marker}`);

  assert.equal(status.capability_line_id, 'MCFT-CAP-09');
  assert.equal(status.slice_id, 'MCFT-CAP-09.S6');
  assert.equal(status.scope_of_change, 'S6_ONLY');
  assert.equal(status.record_status, 'S6_ARCHITECTURE_ADJUDICATION_AUTHORITY_WHEN_PRESENT_ON_PROTECTED_MAIN');
  assert.equal(status.adjudication_effective_when_present_on_protected_main, true);
  assert.equal(status.s0_to_s5_reopened, false);
  assert.equal(status.canonical_kernel_change, false);
  assert.equal(status.canonical_object_contract_change, false);
  assert.equal(status.transaction_family_change, false);
  assert.equal(status.migration_required_by_adjudication, false);
  assert.equal(status.runtime_source_delta_authorized, false);
  assert.equal(status.database_write_authorized, false);
  assert.equal(status.formal_evidence_write_authorized, false);
  assert.equal(status.formal_window_started, false);
  assert.equal(status.formal_window_completed, false);
  assert.equal(status.s6_completion_externally_effective, false);
  assert.equal(status.mcft_cap_09_complete, false);
  assert.equal(status.architecture_rulings.cap08_kernel_authority_reused, true);
  assert.equal(status.architecture_rulings.cap08_replay_scope_identity_required, false);
  assert.equal(status.architecture_rulings.external_scope_fresh_bootstrap_required, true);
  assert.equal(status.architecture_rulings.cross_scope_canonical_stitching_forbidden, true);
  assert.equal(status.future_weather_primary_authority.model, 'GFS');
  assert.equal(status.future_weather_primary_authority.required_hourly_points, 72);
  assert.equal(status.future_weather_primary_authority.point_alignment, 'T_PLUS_1_THROUGH_T_PLUS_72');
  assert.equal(status.historical_and_future_et0_authority.algorithm_id, 'ASCE_STANDARDIZED_REFERENCE_ET_SHORT_HOURLY_V1');
  assert.equal(status.site_candidates['US-Ne1'].qualification, 'NOT_QUALIFIED');
  assert.equal(status.site_candidates['US-KM1'].qualification, 'INCOMPLETE_AUTHORITY');

  assert(!signal.explicit_candidate_status_values.includes(status.record_status), 'S6_EA0_UNREGISTERED_DELIVERY_CANDIDATE_SIGNAL_FORBIDDEN');
  const candidateBooleanKeys = new Set(signal.explicit_candidate_boolean_field_names);
  for (const key of Object.keys(status)) {
    assert(!(candidateBooleanKeys.has(key) && status[key] === true), `S6_EA0_EXPLICIT_CANDIDATE_BOOLEAN_FORBIDDEN:${key}`);
    for (const pattern of signal.explicit_candidate_boolean_field_patterns) {
      assert(!(new RegExp(pattern).test(key) && status[key] === true), `S6_EA0_PATTERN_CANDIDATE_BOOLEAN_FORBIDDEN:${key}`);
    }
  }

  const result = {
    schema_version: 'geox_mcft_cap09_s6_external_evidence_authority_adjudication_acceptance_v1',
    status: 'PASS',
    base_sha: BASE,
    changed_files: changed,
    exact_file_count: changed.length,
    runtime_source_delta: 0,
    migration_delta: 0,
    canonical_object_contract_delta: 0,
    transaction_family_delta: 0,
    database_write_delta: 0,
    delivery_control_plane_routing_delta: 1,
    routing_delta_scope: 'S0_WORKFLOW_ACCEPTS_S6_EA0_ONLY',
    adjudication_effective_when_present_on_protected_main: true,
    s6_completion_externally_effective: false,
    formal_window_started: false,
    unregistered_delivery_candidate_signal: false,
    taskbook_version: 'v0.2',
    next_lifecycle: status.next_internal_lifecycle,
  };
  write(result);
  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  const result = {
    schema_version: 'geox_mcft_cap09_s6_external_evidence_authority_adjudication_acceptance_v1',
    status: 'FAIL',
    error: error && error.message ? error.message : String(error),
  };
  write(result);
  console.error(JSON.stringify(result, null, 2));
  process.exitCode = 1;
}
