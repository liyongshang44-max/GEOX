#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '../../..');
const INPUT_ROOT = path.join(ROOT, 'acceptance-output/development-double-pass');
const OUTPUT = path.join(
  ROOT,
  'acceptance-output/MCFT_CAP_08_S6_DEVELOPMENT_QUALIFICATION_DOUBLE_PASS_RESULT.json',
);

function read(attempt, name) {
  const file = path.join(INPUT_ROOT, `attempt-${attempt}`, name);
  if (!fs.existsSync(file)) {
    throw new Error(`DEVELOPMENT_DOUBLE_PASS_FILE_REQUIRED:${file}`);
  }
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function main() {
  const primary = [1, 2].map((attempt) => read(attempt, 'primary_result.json'));
  const restart = [1, 2].map((attempt) => read(attempt, 'restart_result.json'));
  const drop = [1, 2].map((attempt) => read(attempt, 'drop_result.json'));

  for (let index = 0; index < 2; index += 1) {
    const attempt = index + 1;
    assert.equal(primary[index].status, 'PASS', `DEVELOPMENT_PRIMARY_PASS:${attempt}`);
    assert.equal(primary[index].canonical_receipt_count, 153, `DEVELOPMENT_RECEIPTS:${attempt}`);
    assert.equal(primary[index].recovery_vector_count, 7, `DEVELOPMENT_RECOVERY:${attempt}`);
    assert.equal(primary[index].cap07_surface_count, 10, `DEVELOPMENT_CAP07:${attempt}`);

    assert.equal(restart[index].status, 'PASS', `DEVELOPMENT_RESTART_PASS:${attempt}`);
    assert.equal(restart[index].fresh_process, true, `DEVELOPMENT_FRESH_PROCESS:${attempt}`);
    assert.equal(
      restart[index].canonical_receipt_readback_count,
      153,
      `DEVELOPMENT_RESTART_RECEIPTS:${attempt}`,
    );
    assert.equal(restart[index].distinct_tick_count, 24, `DEVELOPMENT_TICK_COUNT:${attempt}`);
    assert.equal(
      restart[index].append_forward_tick_count,
      25,
      `DEVELOPMENT_APPEND_FORWARD_COUNT:${attempt}`,
    );
    assert.equal(
      restart[index].t17_consumed_corrected_t16,
      true,
      `DEVELOPMENT_T17_CONSUMPTION:${attempt}`,
    );
    assert.equal(
      restart[index].fvo17_selected_corrected_t16_forecast,
      true,
      `DEVELOPMENT_FVO17_CORRECTED_FORECAST_SELECTION:${attempt}`,
    );
    assert.equal(
      restart[index].canonical_write_delta,
      0,
      `DEVELOPMENT_RESTART_WRITE_DELTA:${attempt}`,
    );

    assert.equal(drop[index].status, 'PASS', `DEVELOPMENT_DROP_PASS:${attempt}`);
    assert.equal(
      drop[index].database_absent_after_drop,
      true,
      `DEVELOPMENT_DROP_ABSENT:${attempt}`,
    );
  }

  assert.equal(
    primary[0].exact_subject_sha,
    primary[1].exact_subject_sha,
    'DEVELOPMENT_SUBJECT_EQUALITY',
  );
  assert.notEqual(
    primary[0].operational_run_instance_id,
    primary[1].operational_run_instance_id,
    'DEVELOPMENT_INSTANCE_INDEPENDENCE',
  );
  assert.notEqual(
    primary[0].database_name,
    primary[1].database_name,
    'DEVELOPMENT_DATABASE_INDEPENDENCE',
  );
  assert.notEqual(
    primary[0].database_instance_digest,
    primary[1].database_instance_digest,
    'DEVELOPMENT_DATABASE_DIGEST_INDEPENDENCE',
  );
  assert.notEqual(
    restart[0].s4_authority_ref,
    restart[1].s4_authority_ref,
    'DEVELOPMENT_S4_AUTHORITY_INDEPENDENCE',
  );

  const result = {
    schema_version:
      'geox_mcft_cap08_s6_development_qualification_double_pass_result_v1',
    status: 'PASS',
    exact_subject_sha: primary[0].exact_subject_sha,
    consecutive_fresh_database_pass_count: 2,
    operational_run_instance_ids: primary.map(
      (value) => value.operational_run_instance_id,
    ),
    database_names: primary.map((value) => value.database_name),
    database_instance_digests: primary.map(
      (value) => value.database_instance_digest,
    ),
    s4_authority_refs: restart.map((value) => value.s4_authority_ref),
    canonical_receipt_count_each: 153,
    recovery_vector_count_each: 7,
    cap07_surface_count_each: 10,
    complete_24_tick_chain_each: true,
    s4_t17_interleave_each: true,
    authority_bound_corrected_forecast_selection_each: true,
    final_readback_each: true,
    fresh_process_restart_read_continuity_each: true,
    clean_database_drop_each: true,
    governance_execution_authority_issued: false,
    replacement_execution_authority_eligible_for_separate_final_pr: true,
    formal_run_a_authorized: false,
    run_b_authorized: false,
    s6_candidate_evidence_eligible: false,
  };
  fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
  fs.writeFileSync(OUTPUT, `${JSON.stringify(result, null, 2)}\n`);
  console.log(JSON.stringify(result, null, 2));
}

try {
  main();
} catch (error) {
  console.error(error);
  process.exitCode = 1;
}
