import test from 'node:test';
import assert from 'node:assert/strict';
import { projectFieldProgramStateFromFacts, type FieldProgramProjectionFactRow } from '../src/projections/field_program_state_v1';

function fact(type: string, payload: any, occurred_at: string, fact_id: string): FieldProgramProjectionFactRow {
  return { fact_id, occurred_at, record_json: { type, payload } } as FieldProgramProjectionFactRow;
}

test('projects program state with recommendation, pending plan, acceptance and evidence', () => {
  const rows: FieldProgramProjectionFactRow[] = [
    fact('field_program_v1', {
      tenant_id: 't1', project_id: 'p1', group_id: 'g1',
      program_id: 'prg_1', field_id: 'field_1', season_id: 'season_1', crop_code: 'tomato', variety_code: 'cherry',
      goal_profile: { yield_priority: 'medium', quality_priority: 'high', residue_priority: 'high', water_saving_priority: 'high', cost_priority: 'medium' },
      constraints: { forbid_pesticide_classes: ['high_toxicity'], forbid_fertilizer_types: [], max_irrigation_mm_per_day: 12, manual_approval_required_for: ['spray'], allow_night_irrigation: false },
      status: 'ACTIVE'
    }, '2026-03-20T10:00:00.000Z', 'fp1'),
    fact('field_program_transition_v1', { program_id: 'prg_1', status: 'ACTIVE', trigger: 'activate' }, '2026-03-20T10:01:00.000Z', 'tr1'),
    fact('decision_recommendation_v1', {
      recommendation_id: 'rec_1', field_id: 'field_1', season_id: 'season_1', recommendation_type: 'irrigation_recommendation_v1',
      status: 'proposed', confidence: 0.82, created_ts: 1710000000000
    }, '2026-03-20T10:02:00.000Z', 'recf1'),
    fact('operation_plan_v1', {
      operation_plan_id: 'opl_1', recommendation_id: 'rec_1', target: { ref: 'field_1' },
      status: 'CREATED', approval_request_id: 'apr_1', updated_ts: 1710000000100
    }, '2026-03-20T10:03:00.000Z', 'op1'),
    fact('evidence_pack_export_v1', { field_id: 'field_1', artifact_path: '/tmp/evidence_1.zip', artifact_sha256: 'sha1' }, '2026-03-20T10:04:00.000Z', 'ev1'),
    fact('acceptance_result_v1', { verdict: 'PASS', evidence_fact_ids: ['op1', 'recf1'], deterministic_hash: 'dh1' }, '2026-03-20T10:05:00.000Z', 'acc1')
  ];

  const out = projectFieldProgramStateFromFacts(rows);
  assert.equal(out.length, 1);
  assert.equal(out[0].program_id, 'prg_1');
  assert.equal(out[0].status, 'ACTIVE');
  assert.equal(out[0].current_stage, 'EXECUTION_PENDING');
  assert.equal(out[0].latest_recommendation?.recommendation_id, 'rec_1');
  assert.equal(out[0].pending_operation_plan?.operation_plan_id, 'opl_1');
  assert.equal(out[0].latest_acceptance_result?.verdict, 'PASS');
  assert.equal(out[0].latest_evidence?.artifact_sha256, 'sha1');
  assert.equal(out[0].current_risk_summary.level, 'HIGH');
});

test('maps non-active lifecycle statuses to stages', () => {
  const out = projectFieldProgramStateFromFacts([
    fact('field_program_v1', {
      tenant_id: 't1', project_id: 'p1', group_id: 'g1',
      program_id: 'prg_2', field_id: 'field_2', season_id: 'season_2', crop_code: 'cucumber',
      goal_profile: { yield_priority: 'low', quality_priority: 'low', residue_priority: 'low', water_saving_priority: 'low', cost_priority: 'low' },
      constraints: { forbid_pesticide_classes: [], forbid_fertilizer_types: [], manual_approval_required_for: [], allow_night_irrigation: true },
      status: 'DRAFT'
    }, '2026-03-20T10:00:00.000Z', 'fp2'),
    fact('field_program_transition_v1', { program_id: 'prg_2', status: 'PAUSED', trigger: 'manual_pause' }, '2026-03-20T10:01:00.000Z', 'tr2'),
  ]);
  assert.equal(out[0].status, 'PAUSED');
  assert.equal(out[0].current_stage, 'PAUSED');
});
