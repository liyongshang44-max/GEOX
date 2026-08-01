#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const cp = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '../..');
const D = 'docs/digital_twin/mcft/cap_08';
const FAILURE =
  `${D}/GEOX-MCFT-CAP-08-S6-RUN-A-QUALIFICATION-V9-FAILURE-CLASSIFICATION-V1.json`;
const BOUNDARY =
  `${D}/GEOX-MCFT-CAP-08-S6-DEVELOPMENT-QUALIFICATION-DOUBLE-RUN-BOUNDARY-V1.json`;
const PRODUCT_CHAIN =
  'scripts/runtime_acceptance/mcft_cap08_s6_single_run_ports/product_chain_v1.cjs';
const QUALIFICATION_CHAIN_V2 =
  'scripts/runtime_acceptance/mcft_cap08_s6_run_a_qualification_ports_v2/qualification_product_chain_v2.cjs';
const RUNNER =
  'scripts/runtime_acceptance/mcft_cap08_s6_development_qualification/development_runner_v1.cjs';
const RESTART =
  'scripts/runtime_acceptance/mcft_cap08_s6_development_qualification/restart_readback_v1.cjs';
const SETTLEMENT =
  'scripts/runtime_acceptance/mcft_cap08_s6_development_qualification/double_pass_settlement_v1.cjs';
const WORKFLOW =
  '.github/workflows/mcft-cap-08-s6-development-qualification-double-run.yml';
const OUTPUT = path.join(
  ROOT,
  'acceptance-output/MCFT_CAP_08_S6_DEVELOPMENT_QUALIFICATION_DOUBLE_RUN_STATIC_RESULT.json',
);

const readJson = (relative) =>
  JSON.parse(fs.readFileSync(path.join(ROOT, relative), 'utf8'));
const text = (relative) => fs.readFileSync(path.join(ROOT, relative), 'utf8');
const git = (...args) =>
  cp.execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim();

function canonical(value) {
  if (Array.isArray(value)) {
    return `[${value.map(canonical).join(',')}]`;
  }
  if (value && typeof value === 'object') {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

function semanticDigest(value) {
  const copy = structuredClone(value);
  delete copy.semantic_digest;
  return `sha256:${crypto
    .createHash('sha256')
    .update(canonical(copy))
    .digest('hex')}`;
}

function write(value) {
  fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
  fs.writeFileSync(OUTPUT, `${JSON.stringify(value, null, 2)}\n`);
}

try {
  const failure = readJson(FAILURE);
  const boundary = readJson(BOUNDARY);
  assert.equal(
    failure.semantic_digest,
    semanticDigest(failure),
    'FAILURE_SEMANTIC_DIGEST',
  );
  assert.equal(
    boundary.semantic_digest,
    semanticDigest(boundary),
    'BOUNDARY_SEMANTIC_DIGEST',
  );

  const base = String(process.env.MCFT_BASE_SHA || boundary.base_main_sha).trim();
  assert.equal(base, boundary.base_main_sha, 'DEVELOPMENT_BOUNDARY_BASE');
  assert.equal(git('merge-base', base, 'HEAD'), base, 'DEVELOPMENT_BASE_NOT_ANCESTOR');
  assert.equal(git('diff', '--check', `${base}...HEAD`), '', 'DEVELOPMENT_DIFF_CHECK');
  const changed = git('diff', '--name-only', `${base}...HEAD`)
    .split(/\r?\n/)
    .filter(Boolean)
    .sort();
  assert.deepEqual(
    changed,
    [...boundary.changed_files].sort(),
    'DEVELOPMENT_CHANGED_FILES',
  );
  assert.equal(changed.length, 9, 'DEVELOPMENT_CHANGED_FILE_COUNT');
  assert.equal(
    changed.some((relative) => relative.startsWith('apps/server/')),
    false,
    'PRODUCT_RUNTIME_SOURCE_CHANGE_FORBIDDEN',
  );
  assert.equal(
    changed.some((relative) => relative.includes('/migrations/')),
    false,
    'MIGRATION_CHANGE_FORBIDDEN',
  );
  assert.equal(
    changed.some((relative) => /EXECUTION-AUTHORITY-V\d+\.json$/.test(relative)),
    false,
    'REPLACEMENT_AUTHORITY_FORBIDDEN',
  );

  assert.equal(failure.workflow_run_id, 30687691006);
  assert.equal(
    failure.first_failure_code,
    'CAP04_SINGLE_TICK_NEXT_HANDOFF_STATE_MISMATCH',
  );
  assert.equal(
    failure.failure_class,
    'QUALIFICATION_EXECUTION_CARRIER_TIMING_SEAM',
  );
  assert.equal(failure.v10_immediate_issuance_authorized, false);
  assert.equal(failure.formal_authority_chain_paused, true);
  assert.equal(
    failure.required_development_proof
      .consecutive_independent_fresh_database_pass_count,
    2,
  );
  assert.equal(failure.required_development_proof.postgres_major_version, 16);
  assert.equal(
    failure.required_development_proof.fresh_process_restart_read_continuity_each,
    true,
  );

  const chain = text(PRODUCT_CHAIN);
  assert.doesNotMatch(
    chain,
    /base\.next_logical_tick_time===t17&&!s4/,
    'EARLY_S4_TRIGGER_REMAINS',
  );
  assert.match(chain, /S4_MUST_NOT_EXECUTE_BEFORE_T16_POSTCONDITION/);
  assert.match(
    chain,
    /tickResults\.push\(tickResult\);[\s\S]*if\(index===16\)\{[\s\S]*s4=await s4Service\.execute/,
  );
  assert.match(chain, /base\.next_logical_tick_time===t17LogicalTime&&s4/);
  assert.match(chain, /T17_MUST_CONSUME_CORRECTED_T16_POSTERIOR/);

  const qualificationChainV2 = text(QUALIFICATION_CHAIN_V2);
  assert.match(qualificationChainV2, /createAuthorityAwarePoolV2/);
  assert.match(qualificationChainV2, /twin_runtime_authority_snapshot_v1/);
  assert.match(qualificationChainV2, /QUALIFICATION_V2_S4_AUTHORITY_CARDINALITY/);
  assert.match(qualificationChainV2, /authority\.corrected_objects\?\.forecast/);
  assert.match(qualificationChainV2, /authority\.identity_input\?\.base_t16_forecast/);
  assert.match(
    qualificationChainV2,
    /QUALIFICATION_V2_CORRECTED_FORECAST_BINDING_MISMATCH/,
  );
  assert.match(
    qualificationChainV2,
    /QUALIFICATION_V2_BASE_FORECAST_BINDING_MISMATCH/,
  );
  assert.match(
    qualificationChainV2,
    /authority\.t17_predecessor\?\.previous_forecast_result_ref/,
  );
  assert.match(qualificationChainV2, /return resolveRunProductChainV2\(\)\(\{ \.\.\.input, pool \}\)/);


  const runner = text(RUNNER);
  assert.match(runner, /createPortsV2/);
  assert.match(runner, /invokeDirectMaterializerV1/);
  assert.match(runner, /canonical_receipt_count:\s*153/);
  assert.match(runner, /recovery_vector_count:\s*7/);
  assert.match(runner, /cap07_surface_count:\s*10/);
  assert.match(runner, /governance_execution_authority_issued:\s*false/);
  assert.match(runner, /repeatable_development_runner_only:\s*true/);

  const restart = text(RESTART);
  assert.match(restart, /DEVELOPMENT_RESTART_DISTINCT_TICK_COUNT/);
  assert.match(restart, /DEVELOPMENT_RESTART_APPEND_FORWARD_TICK_COUNT/);
  assert.match(restart, /DEVELOPMENT_RESTART_S4_AUTHORITY_CARDINALITY/);
  assert.match(restart, /authority\.corrected_objects\?\.state/);
  assert.match(restart, /authority\.corrected_objects\?\.forecast/);
  assert.match(restart, /DEVELOPMENT_RESTART_T17_MUST_CONSUME_CORRECTED_T16/);
  assert.match(restart, /DEVELOPMENT_RESTART_FVO17_CORRECTED_FORECAST_REF/);
  assert.match(restart, /DEVELOPMENT_RESTART_FVO17_CORRECTED_FORECAST_HASH/);
  assert.match(restart, /DEVELOPMENT_RESTART_CANONICAL_WRITE_DELTA/);
  assert.match(restart, /fresh_process:\s*true/);
  assert.doesNotMatch(
    restart,
    /const correctedT16=t16States\[1\]/,
    'FACT_ORDER_CORRECTED_STATE_SELECTION_FORBIDDEN',
  );

  const settlement = text(SETTLEMENT);
  assert.match(settlement, /consecutive_fresh_database_pass_count:\s*2/);
  assert.match(settlement, /DEVELOPMENT_DATABASE_DIGEST_INDEPENDENCE/);
  assert.match(settlement, /DEVELOPMENT_S4_AUTHORITY_INDEPENDENCE/);
  assert.match(
    settlement,
    /DEVELOPMENT_FVO17_CORRECTED_FORECAST_SELECTION/,
  );
  assert.match(
    settlement,
    /authority_bound_corrected_forecast_selection_each:\s*true/,
  );
  assert.match(settlement, /clean_database_drop_each:\s*true/);
  assert.match(
    settlement,
    /replacement_execution_authority_eligible_for_separate_final_pr:\s*true/,
  );

  const workflow = text(WORKFLOW);
  assert.match(workflow, /workflow_dispatch:/);
  assert.match(workflow, /pull_request:/);
  assert.match(workflow, /image:\s*postgres:16/);
  assert.match(workflow, /attempt:\s*\[1,\s*2\]/);
  assert.match(workflow, /max-parallel:\s*1/);
  assert.match(
    workflow,
    /ACCEPTANCE_MCFT_CAP_08_PLATFORM_SECURITY_BOOTSTRAP_DB\.ts/,
  );
  assert.match(workflow, /development_runner_v1\.cjs/);
  assert.match(workflow, /restart_readback_v1\.cjs/);
  assert.match(workflow, /DROP DATABASE IF EXISTS/);
  assert.match(workflow, /settle-double-pass:/);
  assert.doesNotMatch(
    workflow,
    /execution_authority_path:/,
    'DEVELOPMENT_WORKFLOW_AUTHORITY_INPUT_FORBIDDEN',
  );
  assert.doesNotMatch(
    workflow,
    /qualification_execution_authority_gate_v1/,
    'DEVELOPMENT_WORKFLOW_AUTHORITY_GATE_FORBIDDEN',
  );

  assert.equal(boundary.required_pass_count, 2);
  assert.equal(boundary.repeatable_runner_requires_one_time_authority, false);
  assert.equal(boundary.replacement_execution_authority_included, false);
  assert.equal(boundary.formal_database_execution_authorized, false);
  assert.equal(boundary.required_authority_bound_append_forward_selection, true);

  const result = {
    schema_version:
      'geox_mcft_cap08_s6_development_qualification_double_run_static_result_v1',
    status: 'PASS',
    subject_sha: git('rev-parse', 'HEAD'),
    base_sha: base,
    changed_file_count: changed.length,
    product_chain_blob_sha: git('rev-parse', `HEAD:${PRODUCT_CHAIN}`),
    qualification_product_chain_v2_blob_sha: git(
      'rev-parse',
      `HEAD:${QUALIFICATION_CHAIN_V2}`,
    ),
    postgres_major_version: 16,
    required_consecutive_pass_count: 2,
    authority_bound_append_forward_selection_required: true,
    formal_authority_chain_paused: true,
    replacement_authority_included: false,
    development_database_execution_performed: false,
  };
  write(result);
  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  write({
    schema_version:
      'geox_mcft_cap08_s6_development_qualification_double_run_static_result_v1',
    status: 'FAIL',
    error: error instanceof Error ? error.stack || error.message : String(error),
  });
  console.error(error);
  process.exitCode = 1;
}
