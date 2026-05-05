#!/usr/bin/env node
/* eslint-disable no-console */
const { ensureTsxRuntime } = require('./_tsx_bootstrap.cjs');
ensureTsxRuntime();
const assert = require('node:assert/strict');

async function loadEvaluators() {
  const evidence = await import('../../apps/server/src/domain/judge/evidence_judge_v2.ts');
  const execution = await import('../../apps/server/src/domain/judge/execution_judge_v2.ts');
  return {
    evaluateEvidenceJudgeV2: evidence.evaluateEvidenceJudgeV2,
    evaluateExecutionJudgeV2: execution.evaluateExecutionJudgeV2,
  };
}

function assertTraceability(judge) {
  assert(Array.isArray(judge.source_refs) && judge.source_refs.length > 0);
  for (const ref of judge.source_refs) {
    assert(ref.skill_id);
    assert(ref.skill_version);
    assert(ref.trace_id);
    assert(ref.run_id);
    assert(ref.input_digest);
    assert(ref.confidence?.level);
  }
}

function includesSkill(judge, skillId) {
  return Array.isArray(judge.source_refs) && judge.source_refs.some((x) => x.skill_id === skillId);
}

(async () => {
  const { evaluateEvidenceJudgeV2, evaluateExecutionJudgeV2 } = await loadEvaluators();
  const base = { tenant_id: 't1', project_id: 'p1', group_id: 'g1' };
  const now = Date.now();

  const missingSoil = evaluateEvidenceJudgeV2({ ...base, now_ts_ms: now, observed_at_ts_ms: now - 60_000, last_heartbeat_ts_ms: now - 60_000 });
  assert.equal(missingSoil.verdict, 'INSUFFICIENT_EVIDENCE');
  assert(includesSkill(missingSoil, 'soil_moisture_quality_skill_v1'));
  assertTraceability(missingSoil);

  const outOfRange = evaluateEvidenceJudgeV2({ ...base, soil_moisture: 2.0, now_ts_ms: now, observed_at_ts_ms: now - 60_000, last_heartbeat_ts_ms: now - 60_000 });
  assert.equal(outOfRange.verdict, 'SENSOR_DRIFT');
  assertTraceability(outOfRange);

  const deviceOffline = evaluateEvidenceJudgeV2({ ...base, soil_moisture: 0.5, now_ts_ms: now, observed_at_ts_ms: now - 60_000, last_heartbeat_ts_ms: now - 10 * 60_000 });
  assert.equal(deviceOffline.verdict, 'DEVICE_OFFLINE');
  assert(includesSkill(deviceOffline, 'device_freshness_skill_v1'));
  assertTraceability(deviceOffline);

  const missingReceipt = evaluateExecutionJudgeV2({ ...base, as_executed: { as_executed_id: 'ae1', task_id: 'task1' }, as_applied: { as_applied_id: 'aa1' } });
  assert.equal(missingReceipt.verdict, 'INSUFFICIENT_EVIDENCE');
  assert(includesSkill(missingReceipt, 'receipt_completeness_skill_v1'));
  assertTraceability(missingReceipt);

  const missingEvidence = evaluateExecutionJudgeV2({ ...base, receipt: { receipt_id: 'r1', task_id: 'task1', status: 'executed', evidence_refs: [] }, as_executed: { as_executed_id: 'ae1', task_id: 'task1' }, as_applied: { as_applied_id: 'aa1' } });
  assert.equal(missingEvidence.verdict, 'INSUFFICIENT_EVIDENCE');
  assertTraceability(missingEvidence);

  const deltaFail = evaluateExecutionJudgeV2({ ...base, receipt: { receipt_id: 'r1', task_id: 'task1', status: 'executed', evidence_refs: ['e1'] }, as_executed: { as_executed_id: 'ae1', task_id: 'task1' }, as_applied: { as_applied_id: 'aa1' }, pre_soil_moisture: 0.3, post_soil_moisture: 0.31 });
  assert.equal(deltaFail.verdict, 'FAIL');
  assert(includesSkill(deltaFail, 'irrigation_effect_acceptance_skill_v1'));
  assertTraceability(deltaFail);

  console.log('ACCEPTANCE_JUDGE_SKILL_TRACEABILITY_V1: PASS (6 scenarios)');
})();
