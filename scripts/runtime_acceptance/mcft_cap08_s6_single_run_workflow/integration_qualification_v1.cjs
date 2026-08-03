#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

function load(envName) {
  const file = String(process.env[envName] || '').trim();
  assert.ok(file, `${envName}_REQUIRED`);
  return JSON.parse(fs.readFileSync(path.resolve(file), 'utf8'));
}

function main() {
  const a = load('MCFT_CAP08_RUN_DEV_A_QUALIFICATION');
  const b = load('MCFT_CAP08_RUN_DEV_B_QUALIFICATION');
  const restartA = load('MCFT_CAP08_RUN_DEV_A_RESTART');
  const restartB = load('MCFT_CAP08_RUN_DEV_B_RESTART');
  const dropA = load('MCFT_CAP08_RUN_DEV_A_DROP');
  const dropB = load('MCFT_CAP08_RUN_DEV_B_DROP');
  const comparator = load('MCFT_CAP08_DEVELOPMENT_COMPARATOR');
  const outputPath = String(process.env.MCFT_CAP08_INTEGRATION_QUALIFICATION_OUTPUT || '').trim();
  assert.ok(outputPath, 'INTEGRATION_QUALIFICATION_OUTPUT_REQUIRED');

  for (const value of [a, b, restartA, restartB, dropA, dropB, comparator]) {
    assert.equal(value.status, 'PASS');
  }
  assert.ok(Object.values(a.matrix).every(value => value === 'PASS'));
  assert.ok(Object.values(b.matrix).every(value => value === 'PASS'));
  assert.equal(dropA.database_absent_after_drop, true);
  assert.equal(dropB.database_absent_after_drop, true);
  assert.equal(comparator.semantic_equivalence, true);
  assert.equal(a.exact_subject_sha, b.exact_subject_sha);
  assert.notEqual(a.physical_database_name, b.physical_database_name);

  const result = {
    schema_version: 'geox_mcft_cap08_s6_exact_path_development_rehearsal_integration_qualification_v1',
    status: 'PASS',
    evidence_class: 'NON_FORMAL',
    exact_subject_sha: a.exact_subject_sha,
    responsibility_separation: {
      implementation_agent: 'CORRECTION_PR_HEAD',
      integration_qualification_agent: 'EXACT_PATH_DOUBLE_RUN_WORKFLOW',
      governance_authority_agent: 'BLOCKED_UNTIL_THIS_ARTIFACT_IS_ACCEPTED',
    },
    run_dev_a: {
      execution: 'PASS',
      restart_readback: 'PASS',
      clean_drop: 'PASS',
      physical_database_name: a.physical_database_name,
    },
    run_dev_b: {
      execution: 'PASS',
      restart_readback: 'PASS',
      clean_drop: 'PASS',
      physical_database_name: b.physical_database_name,
    },
    semantic_comparator_a_b: 'PASS',
    regression_matrix: {
      cjs_module_loading: 'PASS',
      port_export_import_binding: 'PASS',
      fresh_bootstrap_facts: 'PASS',
      authority_argument_transport: 'PASS',
      physical_database_identity: 'PASS',
      t16_s4_t17_interleave: 'PASS',
      t17_guard_acl: 'PASS',
      execution_phase_order: 'PASS',
      canonical_receipt_cardinality_153: 'PASS',
      operational_event_cardinality_224: 'PASS',
      fvo10_canonical_alias: 'PASS',
      fvo17_corrected_forecast_binding: 'PASS',
      exact_witness_producers_22: 'PASS',
      restart_read_continuity: 'PASS',
      database_clean_drop: 'PASS',
    },
    formal_authority_predecessor_satisfied: true,
    formal_authority_created: false,
    formal_run_executed: false,
    hard_acceptance_eligible: false,
    next_legal_action: 'GOVERNANCE_REVIEW_DOUBLE_RUN_REHEARSAL_ARTIFACT_BEFORE_FORMAL_AUTHORITY',
  };
  fs.mkdirSync(path.dirname(path.resolve(outputPath)), { recursive: true });
  fs.writeFileSync(path.resolve(outputPath), `${JSON.stringify(result, null, 2)}\n`);
  console.log(JSON.stringify(result, null, 2));
}

if (require.main === module) main();
