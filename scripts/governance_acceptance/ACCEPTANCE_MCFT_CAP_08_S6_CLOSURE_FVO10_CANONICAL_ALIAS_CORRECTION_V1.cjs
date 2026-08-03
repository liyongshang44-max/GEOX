#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '../..');
const BASE = '40f1c8767438c567ba24cda973725bde3ce87235';
const OUT = path.join(
  ROOT,
  'acceptance-output/MCFT_CAP_08_S6_CLOSURE_FVO10_CANONICAL_ALIAS_CORRECTION_RESULT.json',
);
const P = {
  workflow: '.github/workflows/mcft-cap-08-s6-run-a-closure-fvo10-canonical-alias-correction.yml',
  closureReader: 'scripts/runtime_acceptance/mcft_cap08_s6_single_run_ports/closure_reader_v1.cjs',
  settlement: 'docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-S6-CLOSURE-FVO10-CANONICAL-ALIAS-FAILURE-SETTLEMENT-V1.json',
  boundary: 'docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-S6-CLOSURE-FVO10-CANONICAL-ALIAS-CORRECTION-BOUNDARY-V1.json',
  authority: 'docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-S6-PHASE-ORDER-CORRECTED-FORMAL-RUN-A-EXECUTION-AUTHORITY-EFFECTIVE-V1.json',
  validator: 'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_08_S6_CLOSURE_FVO10_CANONICAL_ALIAS_CORRECTION_V1.cjs',
  receiptManifest: 'scripts/runtime_acceptance/mcft_cap08_s6_single_run_db/receipt_manifest_v1.cjs',
  closureAdapter: 'scripts/runtime_acceptance/mcft_cap08_s6_single_run_db/closure_readback_adapter_v1.cjs',
  finalEvidence: 'scripts/runtime_acceptance/mcft_cap08_s6_single_run_ports/final_evidence_source_v1.cjs',
  completionEvidence: 'apps/server/src/runtime/twin_runtime/cap08_s3_outcome_completion_evidence_service_v1.ts',
  completionTick: 'apps/server/src/runtime/twin_runtime/cap08_s3_completion_evidence_tick_service_v1.ts',
  formalWorkflow: '.github/workflows/mcft-cap-08-s6-single-run-database-execution.yml',
};
const CHANGED = [
  P.workflow,
  P.closureReader,
  P.settlement,
  P.boundary,
  P.authority,
  P.validator,
].sort();
const FINAL_SOURCE = 'mcft_cap08_s6_final_formal_evidence_v1';
const COMPLETION_SOURCE = 'mcft_cap08_s3_completion_evidence_v1';

function git(...args) {
  return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim();
}
function text(file) {
  return fs.readFileSync(path.join(ROOT, file), 'utf8');
}
function json(file) {
  return JSON.parse(text(file));
}
function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map(
      key => `${JSON.stringify(key)}:${canonical(value[key])}`,
    ).join(',')}}`;
  }
  return JSON.stringify(value);
}
function semantic(value) {
  const clone = structuredClone(value);
  delete clone.semantic_digest;
  return `sha256:${crypto.createHash('sha256').update(canonical(clone)).digest('hex')}`;
}
function save(value) {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, `${JSON.stringify(value, null, 2)}\n`);
}
function fvo(id, hash = 'sha256:' + 'a'.repeat(64), extra = {}) {
  return {
    type: 'soil_moisture_observation_v1',
    payload: {
      tenant_id: 'tenantA',
      project_id: 'projectA',
      group_id: 'groupA',
      field_id: 'fieldA',
      season_id: 'seasonA',
      zone_id: 'zoneA',
      dataset_id: 'mcft_cap08_stage1a_replay_v2',
      source_record_id: id,
      source_record_hash: hash,
      record_type: 'soil_moisture_observation_v1',
      binding_id: 'soil_obs_c8_20cm_v1',
      origin_source_kind: 'CONTROLLED_REPLAY_FIXTURE',
      origin_source_id: 'mcft_cap08_stage1a_replay_v2_fvo_source',
      epistemic_class: 'OBSERVED',
      available_to_runtime_at: '2026-06-01T10:00:00.000Z',
      role_time: {
        observed_at: '2026-06-01T10:00:00.000Z',
        ingested_at: '2026-06-01T10:00:00.000Z',
      },
      quality: { status: 'PASS' },
      source_payload: {
        value: 0.31,
        unit: 'fraction',
        quantity_kind: 'VOLUMETRIC_WATER_CONTENT',
        forecast_verification_observation_id: id,
        source_version: '2-final-formal-closure',
      },
      canonical_payload: {
        value: 0.31,
        unit: 'fraction',
        quantity_kind: 'VOLUMETRIC_WATER_CONTENT',
        forecast_verification_observation_id: id,
      },
      source_unit: 'fraction',
      canonical_unit: 'fraction',
      conversion_rule: { id: 'IDENTITY_V1', version: '1' },
      limitations: ['CONTROLLED_SYNTHETIC', 'FINAL_FORMAL_CLOSURE_INPUT'],
      formal_run_id: 'formal-run-test',
      ...extra,
    },
  };
}
async function read(rows, refs) {
  const { createClosureReaderV1 } = require(
    '../runtime_acceptance/mcft_cap08_s6_single_run_ports/closure_reader_v1.cjs',
  );
  return createClosureReaderV1({
    pool: {
      async query(sql, params) {
        assert.match(sql, /SELECT fact_id,source,record_json FROM facts/);
        assert.deepEqual(params, [refs]);
        return { rows: structuredClone(rows) };
      },
    },
  }).query('IGNORED_BY_PORT', [refs]);
}

(async () => {
  try {
    const base = String(process.env.MCFT_BASE_SHA || BASE).trim();
    assert.equal(base, BASE);
    assert.equal(git('merge-base', base, 'HEAD'), base);
    assert.equal(git('rev-list', '--count', `${base}..HEAD`), '1');
    assert.equal(git('diff', '--check', `${base}...HEAD`), '');
    assert.deepEqual(
      git('diff', '--name-only', `${base}...HEAD`)
        .split(/\r?\n/)
        .filter(Boolean)
        .sort(),
      CHANGED,
    );

    assert.equal(git('rev-parse', `HEAD:${P.receiptManifest}`), '68ef6934bab0243b29c3ae90b22d4e5603f1c4fb');
    assert.equal(git('rev-parse', `HEAD:${P.closureAdapter}`), 'f3e477e64b9d5eb9fbaf51eac13567e6b2e8000e');
    assert.equal(git('rev-parse', `HEAD:${P.finalEvidence}`), '3f2108991f64f63fb17606a75a491620f6fd8a27');
    assert.equal(git('rev-parse', `HEAD:${P.completionEvidence}`), '9de83009285fb7cacb12b2a49ad5ebb75ce2486b');
    assert.equal(git('rev-parse', `HEAD:${P.completionTick}`), '5a5a38b44150fb2eb41ed67581feda570c50c90f');
    assert.equal(git('rev-parse', `HEAD:${P.formalWorkflow}`), '2371b3797999f61f55c58551b85c59279eb2f0a2');

    const hash = 'sha256:' + 'a'.repeat(64);
    const finalCarrier = {
      fact_id: 'fact-final',
      source: FINAL_SOURCE,
      record_json: fvo('FVO-10', hash, {
        closure_evidence_class: 'FORECAST_VERIFICATION_OBSERVATION',
      }),
    };
    const completionCarrier = {
      fact_id: 'fact-completion',
      source: COMPLETION_SOURCE,
      record_json: fvo('FVO-10', hash),
    };
    const coalesced = await read([finalCarrier, completionCarrier], ['FVO-10']);
    assert.equal(coalesced.rows.length, 1);
    assert.equal(coalesced.rows[0].fact_id, 'fact-completion');
    assert.equal(coalesced.rows[0].source, COMPLETION_SOURCE);
    assert.equal(coalesced.rows[0].object.object_id, 'FVO-10');
    assert.equal(coalesced.rows[0].object.determinism_hash, hash);

    await assert.rejects(
      () => read([
        finalCarrier,
        {
          ...completionCarrier,
          record_json: fvo('FVO-10', 'sha256:' + 'b'.repeat(64)),
        },
      ], ['FVO-10']),
      /CLOSURE_REF_DUPLICATE:FVO-10/,
    );
    await assert.rejects(
      () => read([
        finalCarrier,
        { ...finalCarrier, fact_id: 'fact-final-duplicate' },
      ], ['FVO-10']),
      /CLOSURE_REF_DUPLICATE:FVO-10/,
    );
    await assert.rejects(
      () => read([
        { ...finalCarrier, record_json: fvo('FVO-09', hash), fact_id: 'fact-09-a' },
        { ...completionCarrier, record_json: fvo('FVO-09', hash), fact_id: 'fact-09-b' },
      ], ['FVO-09']),
      /CLOSURE_REF_DUPLICATE:FVO-09/,
    );
    await assert.rejects(
      () => read([
        finalCarrier,
        completionCarrier,
        { ...finalCarrier, fact_id: 'fact-third' },
      ], ['FVO-10']),
      /CLOSURE_REF_DUPLICATE:FVO-10/,
    );

    const authority = json(P.authority);
    const settlement = json(P.settlement);
    const boundary = json(P.boundary);
    for (const value of [authority, settlement, boundary]) {
      assert.equal(value.semantic_digest, semantic(value));
    }
    assert.equal(
      authority.record_status,
      'SINGLE_FINAL_FORMAL_RUN_AUTHORITY_CONSUMED_CLOSURE_FVO10_ALIAS_FAILURE',
    );
    assert.equal(authority.authority_consumed, true);
    assert.equal(authority.single_use_contract.dispatch_count_consumed, 1);
    assert.equal(authority.single_use_contract.rerun_authorized, false);
    assert.equal(authority.consumption_evidence.github_workflow_run_id, 30778431135);
    assert.equal(authority.consumption_evidence.authority_artifact_id, 8842832130);
    assert.equal(authority.consumption_evidence.failed_run_artifact_id, 8842846060);
    assert.equal(authority.consumption_evidence.database_dropped, true);
    assert.equal(authority.failure_classification.code, 'CLOSURE_FVO10_CANONICAL_ALIAS_UNRECONCILED');
    assert.equal(authority.failure_classification.receipt_manifest_duplicate, false);
    assert.equal(authority.replacement_authority_issued, false);
    assert.equal(authority.sequence_contract.run_b_remains_blocked, true);

    assert.equal(
      settlement.record_status,
      'RUN_A_CLOSURE_FVO10_CANONICAL_ALIAS_FAILURE_SETTLED',
    );
    assert.equal(settlement.failed_dispatch.workflow_run_id, 30778431135);
    assert.equal(settlement.root_cause.canonical_ref, 'FVO-10');
    assert.equal(settlement.root_cause.canonical_hash_equal, true);
    assert.equal(settlement.correction.same_source_duplicate_rejected, true);
    assert.equal(settlement.correction.non_fvo10_duplicate_rejected, true);
    assert.equal(
      settlement.next_legal_action_after_merge,
      'ISSUE_NEW_NON_EFFECTIVE_RUN_A_AUTHORITY_CANDIDATE',
    );

    assert.equal(boundary.base_main_sha, BASE);
    assert.equal(boundary.changed_file_count, 6);
    assert.deepEqual([...boundary.changed_files].sort(), CHANGED);
    assert.equal(boundary.correction.canonical_ref, 'FVO-10');
    assert.equal(boundary.correction.arbitrary_duplicate_coalescing_forbidden, true);
    assert.equal(boundary.replacement_authority_present, false);
    assert.equal(boundary.database_execution_performed, false);
    assert.equal(boundary.workflow_dispatch_performed, false);

    const workflow = text(P.workflow);
    assert.doesNotMatch(workflow, /workflow_dispatch:/);
    assert.doesNotMatch(workflow, /postgres:16/);
    assert.doesNotMatch(workflow, /workflow_entrypoint_v1\.ts/);
    assert.doesNotMatch(CHANGED.join('\n'), /AUTHORITY-CANDIDATE|AUTHORITY-EFFECTIVENESS/);
    assert.doesNotMatch(CHANGED.join('\n'), /single-run-database-execution\.yml/);

    const result = {
      schema_version: 'geox_mcft_cap08_s6_closure_fvo10_canonical_alias_correction_result_v1',
      status: 'PASS',
      base_main_sha: BASE,
      exact_head_sha: git('rev-parse', 'HEAD'),
      changed_file_count: 6,
      failed_workflow_run_id: 30778431135,
      consumed_operational_identity: 'MCFT-CAP-08-S6-FORMAL-RUN-A-20260802-REPLACEMENT-008',
      terminal_error: 'CLOSURE_REF_DUPLICATE:FVO-10',
      canonical_alias_ref: 'FVO-10',
      exact_allowed_sources: [FINAL_SOURCE, COMPLETION_SOURCE],
      semantic_alias_coalesced: true,
      preferred_carrier_source: COMPLETION_SOURCE,
      conflicting_hash_rejected: true,
      same_source_duplicate_rejected: true,
      non_fvo10_duplicate_rejected: true,
      third_carrier_rejected: true,
      product_runtime_changed: false,
      migration_changed: false,
      formal_database_workflow_changed: false,
      replacement_authority_present: false,
      database_execution_performed: false,
      workflow_dispatch_performed: false,
      run_b_dispatch_authorized: false,
    };
    save(result);
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    save({
      schema_version: 'geox_mcft_cap08_s6_closure_fvo10_canonical_alias_correction_result_v1',
      status: 'FAIL',
      error: error instanceof Error ? error.message : String(error),
    });
    console.error(error);
    process.exitCode = 1;
  }
})();
